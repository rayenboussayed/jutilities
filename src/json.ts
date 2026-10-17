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
 * - TypedArray handler `parse` builds its view over a fresh Buffer from the
 *   shared Node pool — see the pool-dependency note in tests/docs.
 */
import { fromBase64 } from "./from.js";
import { isRecord } from "./is.js";
import { toBase64 } from "./to.js";

/**
 * A custom (de)serialization rule for one logical `__type` tag.
 * @template TA - The runtime value type this handler owns.
 * @template TS - The (JSON-safe) shape produced by `stringify` and consumed
 * by `parse`.
 */
type JsonHandler<TA = any, TS = any> = {
  /** Type guard deciding whether the raw value belongs to this handler. */
  isApplicable: (key: string, value: any) => value is TA;
  /** Converts the tagged value into a JSON-safe form. */
  stringify: (key: string, value: TA) => TS;
  /** Rebuilds the runtime value from its JSON-safe form. */
  parse: (key: string, value: TS) => TA;
};

/**
 * The universal envelope shape stored for every handler match.
 * @template T - The handler's stringified payload type.
 */
type Tagged<T = unknown> = { __type: string; value: T };

/**
 * Type guard for the `{ __type, value }` envelope of a given handler key.
 * @param v - The candidate value.
 * @param type - The exact `__type` value to match.
 * @returns `true` when `v` is a record with this `__type` and a `value`
 * property.
 */
function isTagged(v: any, type: string): v is Tagged {
  return isRecord(v) && v.__type === type && "value" in v;
}

/**
 * Phantom-typed JSON string: a string that is known (at compile time) to
 * serialize a value of type `T`.
 * @template T - The type of the original value.
 */
type JsonStringified<T> = string & { __source: T };

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
  private readonly handlers = new Map<string, JsonHandler>();

  /**
   * Registers (or replaces) the handler for a `__type` key.
   *
   * Registration order matters: the first matching handler wins, and
   * re-adding an existing key moves it... it replaces it in place (Map keeps
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
    space?: string | number,
  ) {
    const handlers = this.handlers;
    return JSON.stringify(
      value,
      function (this, key, value) {
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
    text: string | JsonStringified<T>,
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
    for (const [holder, key] of undefs) holder[key] = undefined;
    return result as T;
  }
}

/**
 * Constructor shape required by the generic typed-array handler factory.
 * @template T - The typed array / view type the constructor builds.
 */
type TypedArrayCtor<T> = {
  new (buffer: ArrayBuffer, byteOffset: number, length: number): T;
  BYTES_PER_ELEMENT: number;
};

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
const typedArray = <T extends ArrayBufferView>(
  Ctor: TypedArrayCtor<T>,
): JsonHandler<T, string> => ({
  isApplicable: (_, v): v is T => v instanceof (Ctor as any),
  stringify: (_, v) =>
    toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
  parse: (_, v) => {
    const bytes = fromBase64(v); // fresh buffer, so alignment is guaranteed
    return new Ctor(
      bytes.buffer as ArrayBuffer,
      0,
      bytes.byteLength / Ctor.BYTES_PER_ELEMENT,
    );
  },
});

/**
 * The batteries-included `Json` instance with all built-in handlers
 * pre-registered.
 *
 * Handler coverage (registration order — first match wins):
 * `undefined`, non-finite/`-0` numbers, `bigint`, globally-registered symbols
 * (only `Symbol.for` keys round-trip), boxed `Number`/`String`/`Boolean`,
 * invalid dates, `Date`, `Map`, `Set`, `Buffer` (Node only — guarded with
 * `typeof window === "undefined"`), all typed arrays (10 ctors),
 * `DataView`, `ArrayBuffer`, `Error` (preserves name/message/stack/cause plus
 * own enumerable props, but NOT subclasses of `Error` — which always rebuild
 * as plain `Error`), `RegExp`, `URL`, `URLSearchParams`, `Headers`.
 *
 * Caveats (locked by tests):
 * - `ArrayBuffer`/`DataView`/typed-array `parse` views may share the Node
 *   Buffer pool; `DataView`/`ArrayBuffer` parse even expose pooled neighbors.
 * - `SharedArrayBuffer` is deliberately NOT handled.
 * - The `Error` handler matches via `Error.isError` (needs Node 24).
 */
export const superjson = new Json()
  .addHandler("undefined", {
    isApplicable: (_, v): v is undefined => v === undefined,
    stringify: () => null,
    parse: () => undefined,
  })
  .addHandler("number", {
    // NaN, Infinity, -Infinity, -0
    isApplicable: (_, v): v is number =>
      typeof v === "number" && (!Number.isFinite(v) || Object.is(v, -0)),
    stringify: (_, v) => (Object.is(v, -0) ? "-0" : String(v)),
    parse: (_, v) => (v === "-0" ? -0 : Number(v)),
  })
  .addHandler("bigint", {
    isApplicable: (_, v): v is bigint => typeof v === "bigint",
    stringify: (_, v) => v.toString(),
    parse: (_, v) => BigInt(v),
  })
  .addHandler("symbol", {
    // only globally registered symbols (Symbol.for) can round-trip
    isApplicable: (_, v): v is symbol =>
      typeof v === "symbol" && Symbol.keyFor(v) !== undefined,
    stringify: (_, v) => Symbol.keyFor(v)!,
    parse: (_, v) => Symbol.for(v),
  })
  .addHandler("numberobject", {
    isApplicable: (_, v) => v instanceof Number,
    stringify: (_, v) => String(v.valueOf()),
    parse: (_, v) => new Number(v),
  })
  .addHandler("stringobject", {
    isApplicable: (_, v) => v instanceof String,
    stringify: (_, v) => v.valueOf(),
    parse: (_, v) => new String(v),
  })
  .addHandler("booleanobject", {
    isApplicable: (_, v) => v instanceof Boolean,
    stringify: (_, v) => v.valueOf(),
    parse: (_, v) => new Boolean(v),
  })
  .addHandler("invaliddate", {
    isApplicable: (_, v): v is Date => v instanceof Date && isNaN(v.getTime()),
    stringify: () => null,
    parse: () => new Date(NaN),
  })
  .addHandler("date", {
    isApplicable: (_, v): v is Date => v instanceof Date,
    stringify: (_, v) => v.toISOString(),
    parse: (_, v) => new Date(v),
  })
  .addHandler("map", {
    isApplicable: (_, v): v is Map<any, any> => v instanceof Map,
    stringify: (_, v) => Array.from(v.entries()),
    parse: (_, v) => new Map(v),
  })
  .addHandler("set", {
    isApplicable: (_, v): v is Set<any> => v instanceof Set,
    stringify: (_, v) => Array.from(v),
    parse: (_, v) => new Set(v),
  })
  .addHandler("buffer", {
    isApplicable: (_, v): v is Buffer =>
      typeof window === "undefined" && Buffer.isBuffer(v),
    stringify: (_, v) => toBase64(v),
    parse: (_, v) => Buffer.from(v, "base64"),
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
    stringify: (_, v) =>
      toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)),
    parse: (_, v) => new DataView(fromBase64(v).buffer as ArrayBuffer),
  })
  .addHandler("arraybuffer", {
    isApplicable: (_, v): v is ArrayBuffer => v instanceof ArrayBuffer,
    stringify: (_, v) => toBase64(new Uint8Array(v)),
    parse: (_, v) => fromBase64(v).buffer as ArrayBuffer,
  })
  .addHandler("error", {
    isApplicable: (_, v): v is Error => Error.isError(v),
      stringify: (_, v) => ({
        ...v,
      name: v.name,
      message: v.message,
      stack: v.stack,
      cause: (v as any).cause,
    }),
    parse: (_, v) => {
        const { name, message, stack, cause, ...rest } = v;
        const e = new Error(
          message,
          cause !== undefined ? { cause } : undefined,
        );
        e.name = name;
        if (stack) e.stack = stack;
        return Object.assign(e, rest);
    },
  })
  .addHandler("regexp", {
    isApplicable: (_, v): v is RegExp => v instanceof RegExp,
    stringify: (_, v) => ({ source: v.source, flags: v.flags }),
    parse: (_, v) => new RegExp(v.source, v.flags),
  })
  .addHandler("url", {
    isApplicable: (_, v): v is URL => v instanceof URL,
    stringify: (_, v) => v.href,
    parse: (_, v) => new URL(v),
  })
  .addHandler("urlsearchparams", {
    isApplicable: (_, v): v is URLSearchParams =>
      typeof URLSearchParams !== "undefined" && v instanceof URLSearchParams,
    stringify: (_, v) => v.toString(),
    parse: (_, v) => new URLSearchParams(v),
  })
  .addHandler("headers", {
    isApplicable: (_, v): v is Headers =>
      typeof Headers !== "undefined" && v instanceof Headers,
    stringify: (_, v) => [...v.entries()],
    parse: (_, v) => new Headers(v),
  });
