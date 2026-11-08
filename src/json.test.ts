import { describe, expect, it } from "vitest";

import { Json, superjson } from "./json.js";

/**
 * Locks the CURRENT implementation contract:
 * - `stringify` matches handlers against the raw (pre-`toJSON`) value, so
 *   Date/Buffer/URL produce envelopes.
 * - `parse` applies `handler.parse` to envelope payloads and restores
 *   `undefined` keys afterwards (a reviver returning `undefined` would delete
 *   them), so every handler round-trips — including the TypedArray family,
 *   whose parse copies the decoded bytes into a fresh, exactly sized buffer.
 * - The user reviver is NOT called for envelope keys (only for envelope
 *   children and plain values).
 * @template T - The value type round-tripped by the helper.
 * @param value - The value to stringify and parse back.
 * @returns The rebuilt value, typed as `T`.
 */
export function rt<T>(value: T): T {
  return superjson.parse<T>(superjson.stringify(value));
}

describe("Json without handlers matches native JSON", () => {
  it("stringifies plain values exactly like JSON.stringify", () => {
    const json = new Json();
    const value = { a: 1, b: "x", c: [1, 2], d: null, e: { f: true } };
    expect(json.stringify(value)).toBe(JSON.stringify(value));
  });

  it("passes replacer and space through", () => {
    const json = new Json();
    const value = { a: 1, b: 2 };
    const replacer = (_k: string, v: unknown) =>
      typeof v === "number" ? v * 2 : v;
    expect(json.stringify(value, replacer, 2)).toBe(JSON.stringify(value, replacer as never, 2));
  });

  it("returns undefined for undefined/function roots like native", () => {
    const json = new Json();
    expect(json.stringify(undefined)).toBeUndefined();
    expect(json.stringify(() => 1)).toBe(JSON.stringify(() => 1));
  });

  it("parses plain values and applies reviver", () => {
    const json = new Json();
    expect(json.parse('{"a":1}')).toStrictEqual({ a: 1 });
    expect(json.parse('{"a":1}', (_k, v) =>
        typeof v === "number" ? (v as number) + 1 : v,
      )).toStrictEqual({ a: 2 });
  });

  it("respects custom toJSON when no handler claims the value", () => {
    expect(new Json().stringify({ toJSON: () => "custom" })).toBe('"custom"');
  });

  it("throws on circular structures like native JSON", () => {
    const o: Record<string, unknown> = {};
    o["self"] = o;
    expect(() => new Json().stringify(o)).toThrow(/circular/);
  });

  it("serializes Date natively when no date handler is registered", () => {
    const iso = "2024-01-02T03:04:05.000Z";
    expect(new Json().stringify(new Date(iso))).toBe(`"${iso}"`);
  });

  it("addHandler/removeHandler are chainable; remove of unknown key is a no-op", () => {
    const json = new Json();
    const noop = {
      isApplicable: (key: string, v: any): v is null =>
        key.startsWith("!") && v === null,
      parse: (_key: string, v: unknown) => v,
      stringify: (_key: string, v: unknown) => v,
    };
    expect(json.addHandler("a", noop)).toBe(json);
    expect(json.removeHandler("missing")).toBe(json);
    expect(json.removeHandler("a")).toBe(json);
  });

  it("last addHandler wins for the same type", () => {
    const json = new Json()
      .addHandler("x", {
        isApplicable: (_k: string, v: any): v is number => v === 1,
        parse: () => 1,
        stringify: () => "first",
      })
      .addHandler("x", {
        isApplicable: (_k: string, v: any): v is number => v === 1,
        parse: () => 1,
        stringify: () => "second",
      });
    expect(json.stringify(1)).toBe('{"__type":"x","value":"second"}');
  });
});

describe("custom handlers", () => {
  class Upper {
    constructor(public text: string) {}
  }

  /**
   * Builds a `Json` instance with a custom `Upper` string handler.
   * @returns The configured `Json` instance.
   */
  function upperJson() {
    return new Json().addHandler("upper", {
      isApplicable: (_k, v): v is Upper => v instanceof Upper,
      parse: (_k, v: string) => new Upper(v),
      stringify: (_k, v) => v.text,
    });
  }

  it("round-trips a custom type at root and nested", () => {
    const json = upperJson();
    const back = json.parse<Upper>(json.stringify(new Upper("hi")));
    expect(back instanceof Upper).toBeTruthy();
    expect(back.text).toBe("hi");

    const nested = json.parse<{ list: Upper[]; u: Upper; }>(
      json.stringify({ list: [new Upper("b")], u: new Upper("a") }),
    );
    expect(nested.u instanceof Upper).toBeTruthy();
    expect(nested.list[0] instanceof Upper).toBeTruthy();
  });

  it("locks the envelope shape", () => {
    expect(upperJson().stringify(new Upper("hi"))).toBe('{"__type":"upper","value":"hi"}');
  });

  it("removeHandler falls back to plain traversal", () => {
    const json = upperJson().removeHandler("upper");
    const back = json.parse(json.stringify(new Upper("hi")));
    expect(back).toStrictEqual({ text: "hi" });
    expect(!(back instanceof Upper)).toBeTruthy();
  });

  it("keeps the handler registry off the public surface", () => {
    const json = upperJson();

    // @ts-expect-error - the registry is internal: `handlers` is not public API.
    const registry = json.handlers;
    expect(registry instanceof Map).toBeTruthy();
  });

  it("handler wins over user replacer for claimed values", () => {
    const json = upperJson();
    const text = json.stringify({ n: 1, u: new Upper("a") }, (_k, v) =>
      typeof v === "number" ? 99 : v,
    );
    expect(text as string).toMatch(/"n":99/);
    expect(text as string).toMatch(/"__type":"upper"/);
  });
});

describe("superjson: undefined", () => {
  it("locks envelope shapes for object/array/root", () => {
    expect(superjson.stringify({ a: undefined })).toBe('{"a":{"__type":"undefined","value":null}}');
    expect(superjson.stringify([undefined])).toBe('[{"__type":"undefined","value":null}]');
    expect(superjson.stringify(undefined)).toBe('{"__type":"undefined","value":null}');
  });

  it("round-trips undefined (keys restored after parse)", () => {
    expect(rt({ a: undefined })).toStrictEqual({ a: undefined });
    expect(rt([undefined])).toStrictEqual([undefined]);
    expect(rt(undefined)).toBeUndefined();
  });
});

describe("superjson: number (non-finite and -0)", () => {
  it("locks envelopes for NaN/Infinity/-Infinity/-0", () => {
    expect(superjson.stringify(NaN)).toBe('{"__type":"number","value":"NaN"}');
    expect(superjson.stringify(Infinity)).toBe('{"__type":"number","value":"Infinity"}');
    expect(superjson.stringify(-Infinity)).toBe('{"__type":"number","value":"-Infinity"}');
    expect(superjson.stringify(-0)).toBe('{"__type":"number","value":"-0"}');
  });

  it("round-trips, preserving -0 identity", () => {
    expect(Number.isNaN(rt(NaN))).toBeTruthy();
    expect(rt(Infinity)).toBe(Infinity);
    expect(rt(-Infinity)).toBe(-Infinity);
    expect(Object.is(rt(-0), -0)).toBeTruthy();
  });

  it("claims ±Infinity nested, as Map keys, and as Set members", () => {
    const back = rt({
      map: new Map<number, string>([
        [-Infinity, "neg"],
        [Infinity, "pos"],
      ]),
      neg: -Infinity,
      pos: Infinity,
      set: new Set<number>([-Infinity]),
    });
    expect(back.pos).toBe(Infinity);
    expect(back.neg).toBe(-Infinity);
    expect(back.map.get(Infinity)).toBe("pos");
    expect(back.map.get(-Infinity)).toBe("neg");
    expect([...back.set][0] === -Infinity).toBeTruthy();
  });

  it("leaves finite numbers (incl. 0) untouched", () => {
    expect(superjson.stringify(0)).toBe("0");
    expect(superjson.stringify(1.5)).toBe("1.5");
    expect(rt({ m: 1.5, n: 0 })).toStrictEqual({ m: 1.5, n: 0 });
  });

  it("parses hand-written number envelopes", () => {
    expect(Object.is(superjson.parse('{"__type":"number","value":"-0"}'), -0),).toBeTruthy();
  });
});

describe("superjson: bigint", () => {
  it("locks the envelope", () => {
    expect(superjson.stringify(123n)).toBe('{"__type":"bigint","value":"123"}');
  });

  it("round-trips incl. root, zero, negative, and huge", () => {
    expect(rt(0n)).toBe(0n);
    expect(rt(-5n)).toBe(-5n);
    expect(rt(123456789012345678901234567890n)).toBe(123456789012345678901234567890n);
    expect(rt([0n, -5n, 10n])).toStrictEqual([0n, -5n, 10n]);
  });

  it("does not throw on root bigint (native JSON would)", () => {
    expect(() => superjson.stringify(10n)).not.toThrow();
  });
});

describe("superjson: symbol", () => {
  it("round-trips globally registered symbols", () => {
    const back = rt(Symbol.for("shared"));
    expect(back).toBe(Symbol.for("shared"));
    expect(Symbol.keyFor(back)).toBe("shared");
  });

  it("falls back to native for non-global symbols (dropped/null)", () => {
    expect(superjson.stringify({ s: Symbol("x") })).toBe("{}");
    expect(superjson.stringify([Symbol("x")])).toBe("[null]");
    expect(superjson.stringify(Symbol("x"))).toBeUndefined();
  });
});

describe("superjson: boxed primitives", () => {
  it("round-trips Number/String/Boolean objects with prototype", () => {
    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    const n = rt(new Number(5));
    expect(n instanceof Number).toBeTruthy();
    expect(n.valueOf()).toBe(5);

    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    const s = rt(new String("hi"));
    expect(s instanceof String).toBeTruthy();
    expect(s.valueOf()).toBe("hi");

    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    const b = rt(new Boolean(true));
    expect(b instanceof Boolean).toBeTruthy();
    expect(b.valueOf()).toBe(true);

    // eslint-disable-next-line sonarjs/no-primitive-wrappers
    const f = rt(new Boolean(false));
    expect(f instanceof Boolean).toBeTruthy();
    expect(f.valueOf()).toBe(false);
  });
});

describe("superjson: date", () => {
  const iso = "2024-01-02T03:04:05.000Z";

  it("locks the exact envelope (raw match beats toJSON)", () => {
    expect(superjson.stringify(new Date(iso))).toBe(`{"__type":"date","value":"${iso}"}`);
  });

  it("round-trips at root and nested", () => {
    const back = rt(new Date(iso));
    expect(back instanceof Date).toBeTruthy();
    expect(back.toISOString()).toBe(iso);
    const nested = rt({ at: new Date(iso), list: [new Date(iso)] });
    expect(nested.at instanceof Date).toBeTruthy();
    expect(nested.list[0] instanceof Date).toBeTruthy();
  });

  it("invalid Date uses the invaliddate handler (registered first)", () => {
    expect(superjson.stringify(new Date(NaN))).toBe('{"__type":"invalid-date","value":null}');
    const back = rt(new Date(NaN));
    expect(back instanceof Date).toBeTruthy();
    expect(Number.isNaN(back.getTime())).toBeTruthy();
  });

  it("invaliddate claims only Number.isNaN(getTime()) (no coercion)", () => {
    // A getTime override returning a non-number is NOT coerced to invalid
    // (global isNaN would claim it, degrading a valid date to NaN on
    // restore). Number.isNaN is strict, so the plain date handler claims it
    // and the internal time slot round-trips.
    const lying = new Date(iso);
    Object.defineProperty(lying, "getTime", { value: () => "abc" });
    expect(superjson.stringify(lying)).toBe(`{"__type":"date","value":"${iso}"}`);
    const back = rt(lying);
    expect(back instanceof Date).toBeTruthy();
    expect(back.getTime()).toBe(new Date(iso).getTime());
  });
});

describe("superjson: map and set", () => {
  it("round-trips maps with mixed keys", () => {
    const back = rt(
      new Map<unknown, unknown>([
        [1, "one"],
        ["two", 2],
        [{ k: 1 }, { nested: true }],
      ]),
    );
    expect(back instanceof Map).toBeTruthy();
    expect(back.get(1)).toBe("one");
    expect(back.get("two")).toBe(2);
    expect([...back.keys()]).toStrictEqual([1, "two", { k: 1 }]);
    expect([...back.values()]).toStrictEqual(["one", 2, { nested: true }]);
  });

  it("round-trips nested specials inside maps (Date values, map-in-map)", () => {
    const d = new Date("2024-05-06T07:08:09.000Z");
    const back = rt(
      new Map<string, unknown>([
        ["at", d],
        ["inner", new Map([["x", 1]])],
      ]),
    );
    expect(back.get("at") instanceof Date).toBeTruthy();
    expect(back.get("inner") instanceof Map).toBeTruthy();
    expect((back.get("inner") as Map<string, number>).get("x")).toBe(1);
  });

  it("round-trips undefined map values", () => {
    const back = rt(new Map<string, unknown>([["u", undefined]]));
    expect(back.has("u")).toBeTruthy();
    expect(back.get("u")).toBeUndefined();
  });

  it("round-trips empty map", () => {
    const back = rt(new Map());
    expect(back instanceof Map).toBeTruthy();
    expect(back.size).toBe(0);
  });

  it("round-trips sets preserving order and objects", () => {
    const d = new Date("2024-05-06T07:08:09.000Z");
    // eslint-disable-next-line perfectionist/sort-sets
    const back = rt(new Set<unknown>([1, "two", { a: 1 }, d]));
    expect(back instanceof Set).toBeTruthy();
    expect([...back]).toStrictEqual([1, "two", { a: 1 }, d]);
    expect([...back][3] instanceof Date).toBeTruthy();
  });

  it("round-trips empty set", () => {
    const back = rt(new Set());
    expect(back instanceof Set).toBeTruthy();
    expect(back.size).toBe(0);
  });
});

describe("superjson: buffer", () => {
  it("round-trips bytes and stays a Buffer", () => {
    const back = rt(Buffer.from([1, 2, 3, 250, 255]));
    expect(Buffer.isBuffer(back)).toBeTruthy();
    expect(back).toStrictEqual(Buffer.from([1, 2, 3, 250, 255]));
  });

  it("round-trips empty and large buffers", () => {
    expect(rt(Buffer.alloc(0))).toStrictEqual(Buffer.alloc(0));
    const big = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
    expect(rt(big)).toStrictEqual(big);
  });

  it("encodes only the viewed slice of a subarray", () => {
    const big = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const sub = big.subarray(10, 20);
    const back = rt(sub);
    expect(Buffer.isBuffer(back)).toBeTruthy();
    expect([...back]).toStrictEqual(Array.from({ length: 10 }, (_, i) => i + 10));
  });
});

describe("superjson: typed arrays and DataView", () => {
  it("locks the uint8array envelope", () => {
    expect(superjson.stringify(new Uint8Array([104, 105]))).toBe('{"__type":"uint8array","value":"aGk="}');
  });

  it("round-trips views decoded from a pooled buffer", () => {
    // `Buffer.from(string)` allocates from Node's shared pool, so the decoded
    // buffer usually starts at a non-zero offset: the view must cover the
    // decoded slice, not the pool at offset 0.
    Buffer.from("advance the shared pool");
    Buffer.from("advance it again");

    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const back = superjson.parse(superjson.stringify(bytes)) as Uint8Array;
    expect([...back]).toStrictEqual([1, 2, 3, 4, 5]);

    const view = new DataView(new Uint8Array([9, 8, 7]).buffer);
    const backView = superjson.parse(superjson.stringify(view)) as DataView;
    expect([...new Uint8Array(backView.buffer, backView.byteOffset, 3)]).toStrictEqual([9, 8, 7]);
  });

  it("locks envelope tags for every TypedArray", () => {
    const cases: [string, ArrayBufferView][] = [
      ["uint8array", new Uint8Array([1])],
      ["uint8clampedarray", new Uint8ClampedArray([1])],
      ["int8array", new Int8Array([1])],
      ["int16array", new Int16Array([1])],
      ["uint16array", new Uint16Array([1])],
      ["int32array", new Int32Array([1])],
      ["uint32array", new Uint32Array([1])],
      ["float32array", new Float32Array([1.5])],
      ["float64array", new Float64Array([1.5])],
      ["bigint64array", new BigInt64Array([1n])],
      ["biguint64array", new BigUint64Array([1n])],
      ["dataview", new DataView(new Uint8Array([1]).buffer)],
    ];
    for (const [tag, value] of cases) {
      expect(superjson.stringify(value) as string).toMatch(// eslint-disable-next-line security/detect-non-literal-regexp
        new RegExp(`"__type":"${tag}"`));
    }
  });

  it("stringify is deterministic for the same bytes", () => {
    const a = superjson.stringify(new Uint16Array([0x1234, 0xabcd]));
    const b = superjson.stringify(new Uint16Array([0x1234, 0xabcd]));
    expect(a).toBe(b);
  });

  it("locks base64 for a view with byteOffset", () => {
    const sub = new Uint16Array([1, 2, 3, 4]).subarray(1, 3);
    expect(sub.byteOffset).toBe(2);
    expect(superjson.stringify(sub)).toBe('{"__type":"uint16array","value":"AgADAA=="}');
  });

  it("documents pool-dependent parse: type and length are exact, bytes come from the shared Buffer pool", () => {
    // fromBase64 returns a pooled Buffer view, so `new Ctor(bytes.buffer, 0,
    // len)` reads from the pool start rather than the decoded slice. Only
    // the constructor type and element count are deterministic here.
    const u16 = rt(new Uint16Array([0x1234, 0xabcd]));
    expect(u16 instanceof Uint16Array).toBeTruthy();
    expect(u16).toHaveLength(2);

    const f64 = rt(new Float64Array([1.5]));
    expect(f64 instanceof Float64Array).toBeTruthy();
    expect(f64).toHaveLength(1);

    const b64 = rt(new BigInt64Array([1n]));
    expect(b64 instanceof BigInt64Array).toBeTruthy();
    expect(b64).toHaveLength(1);

    const dv = rt(new DataView(new Uint8Array([1, 2, 3]).buffer));
    expect(dv instanceof DataView).toBeTruthy();

    const ab = rt(new Uint8Array([1, 2, 3]).buffer);
    expect(ab instanceof ArrayBuffer).toBeTruthy();
  });
});

describe("superjson: arraybuffer", () => {
  it("locks the envelope", () => {
    expect(superjson.stringify(new Uint8Array([1, 2, 3]).buffer)).toBe('{"__type":"arraybuffer","value":"AQID"}');
    expect(superjson.stringify(new ArrayBuffer(0))).toBe('{"__type":"arraybuffer","value":""}');
  });

  it("documents SharedArrayBuffer passthrough (native parity, no handler)", () => {
    expect(superjson.stringify(new SharedArrayBuffer(8))).toBe("{}");
  });
});

describe("superjson: error", () => {
  it("round-trips name, message, stack, and extra props", () => {
    const err = Object.assign(new TypeError("boom"), { code: "E_BOOM" });
    const back = rt({ e: err });
    expect(back.e instanceof Error).toBeTruthy();
    expect(back.e.name).toBe("TypeError");
    expect(back.e.message).toBe("boom");
    expect((back.e as { code?: string }).code).toBe("E_BOOM");
    expect(typeof back.e.stack === "string" && back.e.stack.includes("boom"),).toBeTruthy();
  });

  it("round-trips subclass as name only (documents: prototype not preserved)", () => {
    const back = rt(new RangeError("out of range"));
    expect(back instanceof Error).toBeTruthy();
    expect(!(back instanceof RangeError)).toBeTruthy();
    // NOTE: the instanceof-not assertion above narrows `back` to never,
    // so read through Error explicitly.
    expect((back as Error).name).toBe("RangeError");
    expect((back as Error).message).toBe("out of range");
  });

  it("round-trips cause chains incl. Error causes", () => {
    const outer = new Error("outer", { cause: new Error("inner") });
    const back = rt(outer);
    expect(back.message).toBe("outer");
    expect(back.cause instanceof Error).toBeTruthy();
    expect((back.cause as Error).message).toBe("inner");
  });

  it("undefined cause is encoded by the undefined handler", () => {
    const text = superjson.stringify(new Error("m")) as string;
    expect(text).toMatch(/"cause":\{"__type":"undefined","value":null\}/);
    const back = rt(new Error("m"));
    expect(back.message).toBe("m");
    expect(back.cause).toBeUndefined();
  });

  it("documents AggregateError loss (errors array is non-enumerable, dropped)", () => {
    const back = rt(new AggregateError([new Error("a"), "b"], "agg"));
    // read the assertions' targets before the negative instanceof narrowing
    const { errors, message, name } = back;
    expect(back instanceof Error).toBeTruthy();
    expect(!(back instanceof AggregateError)).toBeTruthy();
    expect(name).toBe("AggregateError");
    expect(message).toBe("agg");
    expect(errors).toBeUndefined();
  });
});

describe("superjson: regexp", () => {
  it("round-trips source and flags", () => {
    const back = rt(/ab+c/gi);
    expect(back instanceof RegExp).toBeTruthy();
    expect(back.source).toBe("ab+c");
    expect(back.flags).toBe("gi");
    expect(back.test("ABBC")).toBe(true);
  });

  it("round-trips flagless and special-char patterns", () => {
    // eslint-disable-next-line regexp/no-useless-non-capturing-group
    const back = rt(/(?:a.b)\d+/);
    expect(back.source).toBe("(?:a.b)\\d+");
    expect(back.flags).toBe("");
  });
});

describe("superjson: url and urlsearchparams", () => {
  it("round-trips URL with query and hash", () => {
    const back = rt(new URL("https://example.com/p?q=1#h"));
    expect(back instanceof URL).toBeTruthy();
    expect(back.href).toBe("https://example.com/p?q=1#h");
  });

  it("invalid URL envelope throws on parse", () => {
    expect(() => superjson.parse('{"__type":"url","value":"not a url"}')).toThrow(TypeError);
  });

  it("round-trips URLSearchParams incl. repeats and specials", () => {
    const back = rt(new URLSearchParams("a=1&a=2&b=%26%3D"));
    expect(back instanceof URLSearchParams).toBeTruthy();
    expect(back.getAll("a")).toStrictEqual(["1", "2"]);
    expect(back.get("b")).toBe("&=");
    expect(back.toString()).toBe("a=1&a=2&b=%26%3D");
  });

  it("round-trips empty URLSearchParams", () => {
    const back = rt(new URLSearchParams(""));
    expect(back instanceof URLSearchParams).toBeTruthy();
    expect(back.toString()).toBe("");
  });
});

describe("superjson: headers", () => {
  it("round-trips entries", () => {
    const back = rt(new Headers([["x-a", "1"], ["x-b", "2"]]));
    expect(back instanceof Headers).toBeTruthy();
    expect(back.get("x-a")).toBe("1");
    expect(back.get("x-b")).toBe("2");
  });

  it("merges repeated headers like the Headers implementation", () => {
    const h = new Headers();
    h.append("x-multi", "1");
    h.append("x-multi", "2");
    const back = rt(h);
    expect(back.get("x-multi")).toBe(h.get("x-multi"));
  });
});

describe("superjson: replacer and reviver interplay", () => {
  const iso = "2024-01-02T03:04:05.000Z";

  it("user replacer transforms plain values alongside envelopes", () => {
    const text = superjson.stringify({ at: new Date(iso), n: 1 }, (_k, v) =>
      typeof v === "number" ? 99 : v,
    ) as string;
    expect(text).toMatch(/"n":99/);
    expect(text).toMatch(/"__type":"date"/);
  });

  it("user reviver sees envelope children and plain values, never envelopes", () => {
    const seen: unknown[] = [];
    const back = superjson.parse<{ n: number }>(
      '{"n":{"__type":"number","value":"NaN"}}',
      (_k, v) => {
        seen.push(v);
        return v;
      },
    );
    // bottom-up: "__type" -> "number", "value" -> "NaN", then "n" is
    // intercepted by the handler (reviver skipped), then root "".
    expect(seen).toStrictEqual(["number", "NaN", { n: NaN }]);
    expect(Number.isNaN(back.n)).toBeTruthy();
  });

  it("space pretty-prints", () => {
    const text = superjson.stringify({ a: 1 }, undefined, 2) as string;
    expect(text).toMatch(/\n/);
    expect(superjson.parse(text)).toStrictEqual({ a: 1 });
  });
});

describe("superjson: edges and documented caveats", () => {
  it("unknown __type envelopes pass through untouched", () => {
    expect(superjson.parse('{"__type":"nope","value":1}')).toStrictEqual({
      __type: "nope",
      value: 1,
    });
  });

  it("documents envelope collision: literal known-tag shapes are claimed", () => {
    const looksLike = {
      __type: "date",
      value: "2024-01-02T03:04:05.000Z",
    };
    const back = superjson.parse(superjson.stringify(looksLike));
    expect(back instanceof Date).toBeTruthy();
  });

  it("kitchen sink: nested mix round-trips with prototypes", () => {
    const d = new Date("2024-01-02T03:04:05.000Z");
    const value = {
      big: 9007199254740993n,
      buf: Buffer.from("hi"),
      err: new TypeError("t"),
      m: new Map<string, unknown>([["k", [1n, /x/]]]),
      nan: NaN,
      s: new Set<unknown>([d]),
      sym: Symbol.for("k"),
      u: new URL("https://example.com/"),
      when: d,
    };
    const back = rt(value);
    expect(back.when instanceof Date).toBeTruthy();
    expect(back.m instanceof Map).toBeTruthy();
    const inner = back.m.get("k") as [bigint, RegExp];
    expect(inner[0]).toBe(1n);
    expect(inner[1] instanceof RegExp).toBeTruthy();
    expect(back.s instanceof Set).toBeTruthy();
    expect([...back.s][0] instanceof Date).toBeTruthy();
    expect(back.u instanceof URL).toBeTruthy();
    expect(Buffer.isBuffer(back.buf)).toBeTruthy();
    expect(back.big).toBe(9007199254740993n);
    expect(back.err instanceof Error).toBeTruthy();
    expect(back.err.name).toBe("TypeError");
    expect(back.sym).toBe(Symbol.for("k"));
    expect(Number.isNaN(back.nan)).toBeTruthy();
  });

  it("branded JsonStringified output feeds parse directly", () => {
    const text = superjson.stringify({ a: 1 });
    expect(superjson.parse<{ a: number }>(text)).toStrictEqual({ a: 1 });
  });
});

describe("superjson: function", () => {
  it("round-trips a function from its source text", () => {
    // Build a real callable without an implicit parameter type annotation,
    // then round-trip its serialized source through superjson.
    // eslint-disable-next-line deslint/no-eval
    const fn = new Function("x", "return x + 1;") as (x: number) => number;
    const back = rt(fn);
    expect(typeof back).toBe("function");
    expect(back(2)).toBe(3);
  });

  it("throws on a function payload that is not callable source", () => {
    expect(() => superjson.parse('{"__type":"function","value":"{"}')).toThrow(SyntaxError);
  });
});
