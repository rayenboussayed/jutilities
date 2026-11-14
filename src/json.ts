/**
 * Branded serialization ("super JSON") built on native `JSON`: a `Json` class
 * with a set of named, typed handlers that add round-trip support for values
 * `JSON` cannot represent natively (bigint, Map/Set, Date, RegExp, typed
 * arrays, Errors, URLs, boxed primitives, NaN family, globally-registered
 * symbols, ...).
 *
 * Envelope format: any handler match is serialized as
 * `{ __type: "<handler key>", value: <handler stringified value> }`.
 *
 * Known implementation contract (locked by tests):
 * - `stringify` matches handlers against the RAW (pre-`toJSON`) value, so
 *   `Date`/`Buffer`/`URL` produce envelopes rather than their JSON views.
 * - The user `reviver` is NOT called for envelope keys (only for envelope
 *   children and plain values).
 * - Keys whose parsed value came out as `undefined` are restored after parse,
 *   since the reviver mechanism would otherwise delete them.
 * - TypedArray handler `parse` builds its view over a fresh, exactly sized
 *   buffer (the decoded bytes are copied out of Node's shared pool).
 */
import { fromBase64 } from "./from.js";
import { isRecord } from "./is.js";
import { isServer } from "./runtime.js";
import { toBase64 } from "./to.js";

/**
 * A custom (de)serialization rule for one logical `__type` tag.
 * @template TA - The runtime value type this handler owns.
 * @template TS - The (JSON-safe) shape produced by `stringify` and consumed
 * by `parse`.
 */
export type JsonHandler<TA = any, TS = any> = {
  /** Type guard deciding whether the raw value belongs to this handler. */
  isApplicable: (key: string, value: any) => value is TA;
  /** Rebuilds the runtime value from its JSON-safe form. */
  parse: (key: string, value: TS) => TA;
  /** Converts the tagged value into a JSON-safe form. */
  stringify: (key: string, value: TA) => TS;
};

/**
 * Phantom-typed JSON string: a string that is known (at compile time) to
 * serialize a value of type `T`.
 * @template T - The type of the original value.
 */
export type JsonStringified<T> = string & { __source: T };

/**
 * The universal envelope shape stored for every handler match.
 * @template T - The handler's stringified payload type.
 */
export type Tagged<T = unknown> = { __type: string; value: T };

/**
 * Constructor shape required by the generic typed-array handler factory.
 * @template T - The typed array / view type the constructor builds.
 */
export type TypedArrayCtor<T> = {
  new (buffer: ArrayBuffer, byteOffset: number, length: number): T;
  BYTES_PER_ELEMENT: number;
  prototype: T;
};

/**
 * Configurable JSON-like (de)serializer with a registry of typed handlers.
 *
 * Handlers apply on top of native `JSON.stringify`/`JSON.parse`: values that
 * match a handler's `isApplicable` are wrapped into `{ __type, value }`
 * envelopes and restored on parse. Parse calls the user reviver only for
 * non-envelope values (envelope children included); keys that resolve to
 * `undefined` are re-assigned afterwards.
 */
export class Json {
  /**
   * The handler registry keyed by `__type` license plate. Managed through
   * {@link addHandler} / {@link removeHandler}; internal to the class — the
   * registry is not part of the public surface.
   */
  private readonly handlers = new Map<string, JsonHandler>();

  /**
   * Registers (or replaces) the handler for a `__type` key.
   *
   * Registration order matters: the first matching handler wins, and
   * re-adding an existing key replaces it in place (the Map keeps its
   * original insertion order).
   * @template TA - The handler's runtime value type.
   * @template TS - The handler's JSON-safe payload type.
   * @param type - The `__type` license plate this handler claims.
   * @param handler - The stringify/parse/isApplicable triple.
   * @returns This instance, for chaining.
   */
  addHandler<TA, TS>(type: string, handler: JsonHandler<TA, TS>) {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Parses JSON text produced by this class (or any JSON), restoring envelopes
   * through registered handlers.
   *
   * The user reviver is invoked only for values no handler claimed — including
   * envelope children — never for the envelope value itself. Keys whose parsed
   * result is `undefined` are restored after parsing (a reviver returning
   * `undefined` would otherwise delete them), so `undefined` round-trips.
   * @template T - The expected parsed type.
   * @param text - JSON text (plain string or {@link JsonStringified}).
   * @param reviver - Optional per-key transform for values no handler
   * claimed (same signature as `JSONHandler.parse`).
   * @returns The rebuilt value, typed as `T`.
   */
  parse<T = unknown>(
    text: JsonStringified<T> | string,
    reviver?: JsonHandler["parse"],
  ) {
    const handlers = this.handlers;
    const undefs: [any, string][] = [];
    const result = JSON.parse(text, function (this, key, value) {
      for (const [type, handler] of handlers) {
        if (!isTagged(value, type)) continue;
        const out = handler.parse(key, value.value);
        if (out === undefined) undefs.push([this, key]);
        return out;
      }
      return reviver ? reviver.call(this, key, value) : value;
    });
    // eslint-disable-next-line security/detect-object-injection
    for (const [holder, key] of undefs) holder[key] = undefined;
    return result as T;
  }

  /**
   * Deletes the handler registered under a `__type` key.
   *
   * Removing an unknown/already-removed key is a silent no-op.
   * @param type - The `__type` key to remove.
   * @returns This instance, for chaining.
   */
  removeHandler(type: string) {
    this.handlers.delete(type);
    return this;
  }

  /**
   * Serializes a value like `JSON.stringify`, but with handler envelopes.
   *
   * Handlers are matched against the raw (pre-`toJSON`) value; non-matching
   * values fall through to the optional user replacer.
   * @template T - The value being serialized.
   * @param value - The value to serialize.
   * @param replacer - Optional per-key replacer for values no handler
   * claimed (same signature as `JSONHandler.stringify`).
   * @param space - Pretty-printing spacer, forwarded to `JSON.stringify`.
   * @returns The JSON text, branded as {@link JsonStringified} of `T`.
   */
  stringify<T>(
    value: T,
    replacer?: JsonHandler["stringify"],
    space?: number | string,
  ) {
    const handlers = this.handlers;
    return JSON.stringify(
      value,
      function (this, key, value) {
        // eslint-disable-next-line security/detect-object-injection
        const raw = this[key];
        for (const [type, handler] of handlers) {
          if (!handler.isApplicable(key, raw)) continue;
          return {
            __type: type,
            value: handler.stringify(key, raw),
          } satisfies Tagged;
        }
        return replacer ? replacer.call(this, key, value) : value;
      },
      space,
    ) as JsonStringified<T>;
  }
}

/**
 * Type guard for the `{ __type, value }` envelope of a given handler key.
 * @param v - The candidate value.
 * @param type - The exact `__type` value to match.
 * @returns `true` when `v` is a record with this `__type` and a `value`
 * property.
 */
export function isTagged(v: any, type: string): v is Tagged {
  return isRecord(v) && v["__type"] === type && "value" in v;
}

/**
 * Builds a JSON handler for any typed array family over `ArrayBuffer` views.
 *
 * Stringifies the viewed slice to base64 (honoring `byteOffset`/`byteLength`);
 * parse allocates a fresh backing buffer from base64 and reinterprets it at
 * element alignment — the returned view is therefore always a `byteOffset: 0`
 * view covering the whole (fresh) buffer, and its total byte length must be
 * divisible by `BYTES_PER_ELEMENT`.
 * @template T - The concrete view class this handler produces.
 * @param Ctor - The typed array constructor (e.g. `Uint8Array`).
 * @returns A handler tagging values as that typed array.
 */
export const typedArray = <T extends ArrayBufferView>(
  Ctor: TypedArrayCtor<T>,
): JsonHandler<T, string> => ({
  isApplicable: (_, v): v is T =>
    Object.prototype.isPrototypeOf.call(Ctor.prototype, v),
  parse: (_, v) => {
    // A fresh, exactly sized copy: the decoded buffer may be a slice of
    // Node's shared pool, so its byteOffset is not necessarily 0.
    const bytes = new Uint8Array(fromBase64(v));
    return new Ctor(bytes.buffer, 0, bytes.byteLength / Ctor.BYTES_PER_ELEMENT);
  },
  stringify: (_, v) =>
    toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
});

/**
 * The batteries-included `Json` instance with all built-in handlers
 * pre-registered.
 *
 * Handler coverage (registration order — first match wins):
 * `undefined`, non-finite/`-0` numbers, `bigint`, globally-registered symbols
 * (only `Symbol.for` keys round-trip), boxed `Number`/`String`/`Boolean`,
 * invalid dates, `Date`, `Map`, `Set`, `Buffer` (Node only — guarded with
 * `isServer` from `jutilities/runtime`), all typed arrays (10 ctors),
 * `DataView`, `ArrayBuffer`, `Error` (preserves name/message/stack/cause plus
 * own enumerable props, but NOT subclasses of `Error` — which always rebuild
 * as plain `Error`), `RegExp`, `URL`, `URLSearchParams`, `Headers`, `Function.
 *
 * Caveats (locked by tests):
 * - `ArrayBuffer`/`DataView`/typed-array `parse` views cover a fresh, exactly
 *   sized buffer — the decoded bytes are copied out of Node's shared pool.
 * - `SharedArrayBuffer` is deliberately NOT handled.
 * - The `Error` handler matches via `Error.isError` (needs Node 24).
 */
export const superjson = new Json()
  .addHandler("undefined", {
    isApplicable: (_, v): v is undefined => v === undefined,
    parse: () => undefined,
    stringify: () => null,
  })
  .addHandler("number", {
    // NaN, Infinity, -Infinity, -0
    isApplicable: (_, v): v is number =>
      typeof v === "number" && (!Number.isFinite(v) || Object.is(v, -0)),
    parse: (_, v) => (v === "-0" ? -0 : Number(v)),
    stringify: (_, v) => (Object.is(v, -0) ? "-0" : String(v)),
  })
  .addHandler("bigint", {
    isApplicable: (_, v): v is bigint => typeof v === "bigint",
    parse: (_, v: string) => BigInt(v),
    stringify: (_, v) => v.toString(),
  })
  .addHandler("symbol", {
    // only globally registered symbols (Symbol.for) can round-trip
    isApplicable: (_, v): v is symbol =>
      typeof v === "symbol" && Symbol.keyFor(v) !== undefined,
    parse: (_, v: string) => Symbol.for(v),
    stringify: (_, v) => Symbol.keyFor(v)!,
  })
  .addHandler("number-object", {
    isApplicable: (_, v) => v instanceof Number,
    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    parse: (_, v: string) => new Number(v),
    stringify: (_, v) => String(v.valueOf()),
  })
  .addHandler("string-object", {
    isApplicable: (_, v) => v instanceof String,
    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    parse: (_, v: string) => new String(v),
    stringify: (_, v) => v.valueOf(),
  })
  .addHandler("boolean-object", {
    isApplicable: (_, v) => v instanceof Boolean,
    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    parse: (_, v: boolean) => new Boolean(v),
    stringify: (_, v) => v.valueOf(),
  })
  .addHandler("invalid-date", {
    isApplicable: (_, v): v is Date =>
      v instanceof Date && Number.isNaN(v.getTime()),
    parse: () => new Date(NaN),
    stringify: () => null,
  })
  .addHandler("date", {
    isApplicable: (_, v): v is Date => v instanceof Date,
    parse: (_, v: string) => new Date(v),
    stringify: (_, v) => v.toISOString(),
  })
  .addHandler("map", {
    isApplicable: (_, v): v is Map<any, any> => v instanceof Map,
    parse: (_, v: [unknown, unknown][]) => new Map(v),
    stringify: (_, v) => Array.from(v.entries()),
  })
  .addHandler("set", {
    isApplicable: (_, v): v is Set<any> => v instanceof Set,
    parse: (_, v: unknown[]) => new Set(v),
    stringify: (_, v) => Array.from(v),
  })
  .addHandler("buffer", {
    isApplicable: (_, v): v is Buffer =>
      isServer && Buffer.isBuffer(v),
    parse: (_, v: string) => Buffer.from(v, "base64"),
    stringify: (_, v) => toBase64(v),
  })
  .addHandler("uint8array", typedArray(Uint8Array))
  .addHandler("uint8clampedarray", typedArray(Uint8ClampedArray))
  .addHandler("int8array", typedArray(Int8Array))
  .addHandler("int16array", typedArray(Int16Array))
  .addHandler("uint16array", typedArray(Uint16Array))
  .addHandler("int32array", typedArray(Int32Array))
  .addHandler("uint32array", typedArray(Uint32Array))
  .addHandler("float32array", typedArray(Float32Array))
  .addHandler("float64array", typedArray(Float64Array))
  .addHandler("bigint64array", typedArray(BigInt64Array))
  .addHandler("biguint64array", typedArray(BigUint64Array))
  .addHandler("dataview", {
    isApplicable: (_, v): v is DataView => v instanceof DataView,
    parse: (_, v: string) => new DataView(new Uint8Array(fromBase64(v)).buffer),
    stringify: (_, v) =>
      toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
  })
  .addHandler("arraybuffer", {
    isApplicable: (_, v): v is ArrayBuffer => v instanceof ArrayBuffer,
    parse: (_, v: string) => new Uint8Array(fromBase64(v)).buffer,
    stringify: (_, v) => toBase64(new Uint8Array(v)),
  })
  .addHandler("error", {
    isApplicable: (_, v): v is Error => Error.isError(v),
    parse: (
      _,
      v: Record<string, unknown> & {
        cause?: unknown;
        message: string;
        name: string;
        stack?: string;
      },
    ) => {
      const { cause, message, name, stack, ...rest } = v;
      const e = new Error(message, cause !== undefined ? { cause } : undefined);
      e.name = name;
      if (stack) e.stack = stack;
      return Object.assign(e, rest);
    },
    stringify: (_, v) => ({
      ...v,
      cause: v.cause,
      message: v.message,
      name: v.name,
      stack: v.stack,
    }),
  })
  .addHandler("regexp", {
    isApplicable: (_, v): v is RegExp => v instanceof RegExp,
    // eslint-disable-next-line security/detect-non-literal-regexp
    parse: (_, v: { readonly flags: string; readonly source: string; }) => new RegExp(v.source, v.flags),
    stringify: (_, v) => ({ flags: v.flags, source: v.source }),
  })
  .addHandler("url", {
    isApplicable: (_, v): v is URL => v instanceof URL,
    parse: (_, v: string) => new URL(v),
    stringify: (_, v) => v.href,
  })
  .addHandler("urlsearchparams", {
    isApplicable: (_, v): v is URLSearchParams =>
      typeof URLSearchParams !== "undefined" && v instanceof URLSearchParams,
    parse: (_, v: string) => new URLSearchParams(v),
    stringify: (_, v) => v.toString(),
  })
  .addHandler("headers", {
    isApplicable: (_, v): v is Headers =>
      typeof Headers !== "undefined" && v instanceof Headers,
    parse: (_, v: [string, string][]) => new Headers(v),
    stringify: (_, v) => [...v.entries()],
  })
  .addHandler("function", {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    isApplicable: (_, v): v is Function => typeof v === "function",
    // eslint-disable-next-line sonarjs/code-eval, deslint/no-eval
    parse: (_, v: string) => new Function(`return ${v}`)(),
    stringify: (_, v) => v.toString(),
  });
