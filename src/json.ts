import { fromBase64 } from "./from.js";
import { isRecord } from "./is.js";
import { toBase64 } from "./to.js";

type JsonHandler<TA = any, TS = any> = {
  isApplicable: (key: string, value: any) => value is TA;
  stringify: (key: string, value: TA) => TS;
  parse: (key: string, value: TS) => TA;
};

type Tagged<T = unknown> = { __type: string; value: T };

/**
 *
 * @param v
 * @param type
 */
function isTagged(v: any, type: string): v is Tagged {
  return isRecord(v) && v.__type === type && "value" in v;
}

type JsonStringified<T> = string & { __source: T };

export class Json {
  private readonly handlers = new Map<string, JsonHandler>();

  addHandler<TA, TS>(type: string, handler: JsonHandler<TA, TS>) {
    this.handlers.set(type, handler);
    return this;
  }

  removeHandler(type: string) {
    this.handlers.delete(type);
    return this;
  }

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

type TypedArrayCtor<T> = {
  new (buffer: ArrayBuffer, byteOffset: number, length: number): T;
  BYTES_PER_ELEMENT: number;
};

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
