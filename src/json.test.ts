import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Json, superjson } from "./json.js";

/**
 * Locks the CURRENT implementation contract:
 * - `stringify` matches handlers against the raw (pre-`toJSON`) value, so
 *   Date/Buffer/URL produce envelopes.
 * - `parse` applies `handler.parse` to envelope payloads and restores
 *   `undefined` keys afterwards (a reviver returning `undefined` would delete
 *   them), so every handler round-trips — except the TypedArray family, whose
 *   parse reads from the shared Buffer pool (see the dedicated pool test).
 * - The user reviver is NOT called for envelope keys (only for envelope
 *   children and plain values).
 * @template T - The value type round-tripped by the helper.
 * @param value - The value to stringify and parse back.
 * @returns The rebuilt value, typed as `T`.
 */
function rt<T>(value: T): T {
  return superjson.parse<T>(superjson.stringify(value));
}

describe("Json without handlers matches native JSON", () => {
  it("stringifies plain values exactly like JSON.stringify", () => {
    const json = new Json();
    const value = { a: 1, b: "x", c: [1, 2], d: null, e: { f: true } };
    assert.strictEqual(json.stringify(value), JSON.stringify(value));
  });

  it("passes replacer and space through", () => {
    const json = new Json();
    const value = { a: 1, b: 2 };
    const replacer = (_k: string, v: unknown) =>
      typeof v === "number" ? v * 2 : v;
    assert.strictEqual(
      json.stringify(value, replacer, 2),
      JSON.stringify(value, replacer as never, 2),
    );
  });

  it("returns undefined for undefined/function roots like native", () => {
    const json = new Json();
    assert.strictEqual(json.stringify(undefined), undefined);
    assert.strictEqual(
      json.stringify(() => 1),
      JSON.stringify(() => 1),
    );
  });

  it("parses plain values and applies reviver", () => {
    const json = new Json();
    assert.deepStrictEqual(json.parse('{"a":1}'), { a: 1 });
    assert.deepStrictEqual(
      json.parse('{"a":1}', (_k, v) =>
        typeof v === "number" ? (v as number) + 1 : v,
      ),
      { a: 2 },
    );
  });

  it("respects custom toJSON when no handler claims the value", () => {
    assert.strictEqual(
      new Json().stringify({ toJSON: () => "custom" }),
      '"custom"',
    );
  });

  it("throws on circular structures like native JSON", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    assert.throws(() => new Json().stringify(o), /circular/);
  });

  it("serializes Date natively when no date handler is registered", () => {
    const iso = "2024-01-02T03:04:05.000Z";
    assert.strictEqual(
      new Json().stringify(new Date(iso)),
      `"${iso}"`,
    );
  });

  it("addHandler/removeHandler are chainable; remove of unknown key is a no-op", () => {
    const json = new Json();
    const noop = {
      isApplicable: (key: string, v: any): v is null =>
        key.startsWith("!") && v === null,
      stringify: (key: string, v: unknown) => v,
      parse: (key: string, v: unknown) => v,
    };
    assert.strictEqual(json.addHandler("a", noop), json);
    assert.strictEqual(json.removeHandler("missing"), json);
    assert.strictEqual(json.removeHandler("a"), json);
  });

  it("last addHandler wins for the same type", () => {
    const json = new Json()
      .addHandler("x", {
        isApplicable: (_k: string, v: any): v is number => v === 1,
        stringify: () => "first",
        parse: () => 1,
      })
      .addHandler("x", {
        isApplicable: (_k: string, v: any): v is number => v === 1,
        stringify: () => "second",
        parse: () => 1,
      });
    assert.strictEqual(json.stringify(1), '{"__type":"x","value":"second"}');
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
      stringify: (_k, v) => v.text,
      parse: (_k, v: string) => new Upper(v),
    });
  }

  it("round-trips a custom type at root and nested", () => {
    const json = upperJson();
    const back = json.parse<Upper>(json.stringify(new Upper("hi")));
    assert.ok(back instanceof Upper);
    assert.strictEqual(back.text, "hi");

    const nested = json.parse<{ u: Upper; list: Upper[] }>(
      json.stringify({ u: new Upper("a"), list: [new Upper("b")] }),
    );
    assert.ok(nested.u instanceof Upper);
    assert.ok(nested.list[0] instanceof Upper);
  });

  it("locks the envelope shape", () => {
    assert.strictEqual(
      upperJson().stringify(new Upper("hi")),
      '{"__type":"upper","value":"hi"}',
    );
  });

  it("removeHandler falls back to plain traversal", () => {
    const json = upperJson().removeHandler("upper");
    const back = json.parse(json.stringify(new Upper("hi")));
    assert.deepStrictEqual(back, { text: "hi" });
    assert.ok(!(back instanceof Upper));
  });

  it("handler wins over user replacer for claimed values", () => {
    const json = upperJson();
    const text = json.stringify({ u: new Upper("a"), n: 1 }, (_k, v) =>
      typeof v === "number" ? 99 : v,
    );
    assert.match(text as string, /"n":99/);
    assert.match(text as string, /"__type":"upper"/);
  });
});

describe("superjson: undefined", () => {
  it("locks envelope shapes for object/array/root", () => {
    assert.strictEqual(
      superjson.stringify({ a: undefined }),
      '{"a":{"__type":"undefined","value":null}}',
    );
    assert.strictEqual(
      superjson.stringify([undefined]),
      '[{"__type":"undefined","value":null}]',
    );
    assert.strictEqual(
      superjson.stringify(undefined),
      '{"__type":"undefined","value":null}',
    );
  });

  it("round-trips undefined (keys restored after parse)", () => {
    assert.deepStrictEqual(rt({ a: undefined }), { a: undefined });
    assert.deepStrictEqual(rt([undefined]), [undefined]);
    assert.strictEqual(rt(undefined), undefined);
  });
});

describe("superjson: number (non-finite and -0)", () => {
  it("locks envelopes for NaN/Infinity/-Infinity/-0", () => {
    assert.strictEqual(
      superjson.stringify(NaN),
      '{"__type":"number","value":"NaN"}',
    );
    assert.strictEqual(
      superjson.stringify(Infinity),
      '{"__type":"number","value":"Infinity"}',
    );
    assert.strictEqual(
      superjson.stringify(-Infinity),
      '{"__type":"number","value":"-Infinity"}',
    );
    assert.strictEqual(
      superjson.stringify(-0),
      '{"__type":"number","value":"-0"}',
    );
  });

  it("round-trips, preserving -0 identity", () => {
    assert.ok(Number.isNaN(rt(NaN)));
    assert.strictEqual(rt(Infinity), Infinity);
    assert.strictEqual(rt(-Infinity), -Infinity);
    assert.ok(Object.is(rt(-0), -0));
  });

  it("leaves finite numbers (incl. 0) untouched", () => {
    assert.strictEqual(superjson.stringify(0), "0");
    assert.strictEqual(superjson.stringify(1.5), "1.5");
    assert.deepStrictEqual(rt({ n: 0, m: 1.5 }), { n: 0, m: 1.5 });
  });

  it("parses hand-written number envelopes", () => {
    assert.ok(
      Object.is(superjson.parse('{"__type":"number","value":"-0"}'), -0),
    );
  });
});

describe("superjson: bigint", () => {
  it("locks the envelope", () => {
    assert.strictEqual(
      superjson.stringify(123n),
      '{"__type":"bigint","value":"123"}',
    );
  });

  it("round-trips incl. root, zero, negative, and huge", () => {
    assert.strictEqual(rt(0n), 0n);
    assert.strictEqual(rt(-5n), -5n);
    assert.strictEqual(
      rt(123456789012345678901234567890n),
      123456789012345678901234567890n,
    );
    assert.deepStrictEqual(rt([0n, -5n, 10n]), [0n, -5n, 10n]);
  });

  it("does not throw on root bigint (native JSON would)", () => {
    assert.doesNotThrow(() => superjson.stringify(10n));
  });
});

describe("superjson: symbol", () => {
  it("round-trips globally registered symbols", () => {
    const back = rt(Symbol.for("shared"));
    assert.strictEqual(back, Symbol.for("shared"));
    assert.strictEqual(Symbol.keyFor(back), "shared");
  });

  it("falls back to native for non-global symbols (dropped/null)", () => {
    assert.strictEqual(superjson.stringify({ s: Symbol("x") }), "{}");
    assert.strictEqual(superjson.stringify([Symbol("x")]), "[null]");
    assert.strictEqual(superjson.stringify(Symbol("x")), undefined);
  });
});

describe("superjson: boxed primitives", () => {
  it("round-trips Number/String/Boolean objects with prototype", () => {
    const n = rt(new Number(5));
    assert.ok(n instanceof Number);
    assert.strictEqual(n.valueOf(), 5);

    const s = rt(new String("hi"));
    assert.ok(s instanceof String);
    assert.strictEqual(s.valueOf(), "hi");

    const b = rt(new Boolean(true));
    assert.ok(b instanceof Boolean);
    assert.strictEqual(b.valueOf(), true);

    const f = rt(new Boolean(false));
    assert.ok(f instanceof Boolean);
    assert.strictEqual(f.valueOf(), false);
  });
});

describe("superjson: date", () => {
  const iso = "2024-01-02T03:04:05.000Z";

  it("locks the exact envelope (raw match beats toJSON)", () => {
    assert.strictEqual(
      superjson.stringify(new Date(iso)),
      `{"__type":"date","value":"${iso}"}`,
    );
  });

  it("round-trips at root and nested", () => {
    const back = rt(new Date(iso));
    assert.ok(back instanceof Date);
    assert.strictEqual(back.toISOString(), iso);
    const nested = rt({ at: new Date(iso), list: [new Date(iso)] });
    assert.ok(nested.at instanceof Date);
    assert.ok(nested.list[0] instanceof Date);
  });

  it("invalid Date uses the invaliddate handler (registered first)", () => {
    assert.strictEqual(
      superjson.stringify(new Date(NaN)),
      '{"__type":"invaliddate","value":null}',
    );
    const back = rt(new Date(NaN));
    assert.ok(back instanceof Date);
    assert.ok(Number.isNaN(back.getTime()));
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
    assert.ok(back instanceof Map);
    assert.strictEqual(back.get(1), "one");
    assert.strictEqual(back.get("two"), 2);
    assert.deepStrictEqual([...back.keys()], [1, "two", { k: 1 }]);
    assert.deepStrictEqual([...back.values()], ["one", 2, { nested: true }]);
  });

  it("round-trips nested specials inside maps (Date values, map-in-map)", () => {
    const d = new Date("2024-05-06T07:08:09.000Z");
    const back = rt(
      new Map<string, unknown>([
        ["at", d],
        ["inner", new Map([["x", 1]])],
      ]),
    );
    assert.ok(back.get("at") instanceof Date);
    assert.ok(back.get("inner") instanceof Map);
    assert.strictEqual((back.get("inner") as Map<string, number>).get("x"), 1);
  });

  it("round-trips undefined map values", () => {
    const back = rt(new Map<string, unknown>([["u", undefined]]));
    assert.ok(back.has("u"));
    assert.strictEqual(back.get("u"), undefined);
  });

  it("round-trips empty map", () => {
    const back = rt(new Map());
    assert.ok(back instanceof Map);
    assert.strictEqual(back.size, 0);
  });

  it("round-trips sets preserving order and objects", () => {
    const d = new Date("2024-05-06T07:08:09.000Z");
    const back = rt(new Set<unknown>([1, "two", { a: 1 }, d]));
    assert.ok(back instanceof Set);
    assert.deepStrictEqual([...back], [1, "two", { a: 1 }, d]);
    assert.ok([...back][3] instanceof Date);
  });

  it("round-trips empty set", () => {
    const back = rt(new Set());
    assert.ok(back instanceof Set);
    assert.strictEqual(back.size, 0);
  });
});

describe("superjson: buffer", () => {
  it("round-trips bytes and stays a Buffer", () => {
    const back = rt(Buffer.from([1, 2, 3, 250, 255]));
    assert.ok(Buffer.isBuffer(back));
    assert.deepStrictEqual(back, Buffer.from([1, 2, 3, 250, 255]));
  });

  it("round-trips empty and large buffers", () => {
    assert.deepStrictEqual(rt(Buffer.alloc(0)), Buffer.alloc(0));
    const big = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
    assert.deepStrictEqual(rt(big), big);
  });

  it("encodes only the viewed slice of a subarray", () => {
    const big = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const sub = big.subarray(10, 20);
    const back = rt(sub);
    assert.ok(Buffer.isBuffer(back));
    assert.deepStrictEqual(
      [...back],
      Array.from({ length: 10 }, (_, i) => i + 10),
    );
  });
});

describe("superjson: typed arrays and DataView", () => {
  it("locks the uint8array envelope", () => {
    assert.strictEqual(
      superjson.stringify(new Uint8Array([104, 105])),
      '{"__type":"uint8array","value":"aGk="}',
    );
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
      assert.match(
        superjson.stringify(value) as string,
        new RegExp(`"__type":"${tag}"`),
        tag,
      );
    }
  });

  it("stringify is deterministic for the same bytes", () => {
    const a = superjson.stringify(new Uint16Array([0x1234, 0xabcd]));
    const b = superjson.stringify(new Uint16Array([0x1234, 0xabcd]));
    assert.strictEqual(a, b);
  });

  it("locks base64 for a view with byteOffset", () => {
    const sub = new Uint16Array([1, 2, 3, 4]).subarray(1, 3);
    assert.strictEqual(sub.byteOffset, 2);
    assert.strictEqual(
      superjson.stringify(sub),
      '{"__type":"uint16array","value":"AgADAA=="}',
    );
  });

  it("documents pool-dependent parse: type and length are exact, bytes come from the shared Buffer pool", () => {
    // fromBase64 returns a pooled Buffer view, so `new Ctor(bytes.buffer, 0,
    // len)` reads from the pool start rather than the decoded slice. Only
    // the constructor type and element count are deterministic here.
    const u16 = rt(new Uint16Array([0x1234, 0xabcd]));
    assert.ok(u16 instanceof Uint16Array);
    assert.strictEqual(u16.length, 2);

    const f64 = rt(new Float64Array([1.5]));
    assert.ok(f64 instanceof Float64Array);
    assert.strictEqual(f64.length, 1);

    const b64 = rt(new BigInt64Array([1n]));
    assert.ok(b64 instanceof BigInt64Array);
    assert.strictEqual(b64.length, 1);

    const dv = rt(new DataView(new Uint8Array([1, 2, 3]).buffer));
    assert.ok(dv instanceof DataView);

    const ab = rt(new Uint8Array([1, 2, 3]).buffer);
    assert.ok(ab instanceof ArrayBuffer);
  });
});

describe("superjson: arraybuffer", () => {
  it("locks the envelope", () => {
    assert.strictEqual(
      superjson.stringify(new Uint8Array([1, 2, 3]).buffer),
      '{"__type":"arraybuffer","value":"AQID"}',
    );
    assert.strictEqual(
      superjson.stringify(new ArrayBuffer(0)),
      '{"__type":"arraybuffer","value":""}',
    );
  });

  it("documents SharedArrayBuffer passthrough (native parity, no handler)", () => {
    assert.strictEqual(superjson.stringify(new SharedArrayBuffer(8)), "{}");
  });
});

describe("superjson: error", () => {
  it("round-trips name, message, stack, and extra props", () => {
    const err = Object.assign(new TypeError("boom"), { code: "E_BOOM" });
    const back = rt({ e: err });
    assert.ok(back.e instanceof Error);
    assert.strictEqual(back.e.name, "TypeError");
    assert.strictEqual(back.e.message, "boom");
    assert.strictEqual((back.e as { code?: string }).code, "E_BOOM");
    assert.ok(
      typeof back.e.stack === "string" && back.e.stack.includes("boom"),
    );
  });

  it("round-trips subclass as name only (documents: prototype not preserved)", () => {
    const back = rt(new RangeError("out of range"));
    assert.ok(back instanceof Error);
    assert.ok(!(back instanceof RangeError));
    // NOTE: the instanceof-not assertion above narrows `back` to never,
    // so read through Error explicitly.
    assert.strictEqual((back as Error).name, "RangeError");
    assert.strictEqual((back as Error).message, "out of range");
  });

  it("round-trips cause chains incl. Error causes", () => {
    const outer = new Error("outer", { cause: new Error("inner") });
    const back = rt(outer);
    assert.strictEqual(back.message, "outer");
    assert.ok(back.cause instanceof Error);
    assert.strictEqual((back.cause as Error).message, "inner");
  });

  it("undefined cause is encoded by the undefined handler", () => {
    const text = superjson.stringify(new Error("m")) as string;
    assert.match(text, /"cause":\{"__type":"undefined","value":null\}/);
    const back = rt(new Error("m"));
    assert.strictEqual(back.message, "m");
    assert.strictEqual(back.cause, undefined);
  });

  it("documents AggregateError loss (errors array is non-enumerable, dropped)", () => {
    const back = rt(new AggregateError([new Error("a"), "b"], "agg"));
    // read the assertions' targets before the negative instanceof narrowing
    const { name, message, errors } = back;
    assert.ok(back instanceof Error);
    assert.ok(!(back instanceof AggregateError));
    assert.strictEqual(name, "AggregateError");
    assert.strictEqual(message, "agg");
    assert.strictEqual(errors, undefined);
  });
});

describe("superjson: regexp", () => {
  it("round-trips source and flags", () => {
    const back = rt(/ab+c/gi);
    assert.ok(back instanceof RegExp);
    assert.strictEqual(back.source, "ab+c");
    assert.strictEqual(back.flags, "gi");
    assert.strictEqual(back.test("ABBC"), true);
  });

  it("round-trips flagless and special-char patterns", () => {
    const back = rt(/(?:a.b)\d+/);
    assert.strictEqual(back.source, "(?:a.b)\\d+");
    assert.strictEqual(back.flags, "");
  });
});

describe("superjson: url and urlsearchparams", () => {
  it("round-trips URL with query and hash", () => {
    const back = rt(new URL("https://example.com/p?q=1#h"));
    assert.ok(back instanceof URL);
    assert.strictEqual(back.href, "https://example.com/p?q=1#h");
  });

  it("invalid URL envelope throws on parse", () => {
    assert.throws(
      () => superjson.parse('{"__type":"url","value":"not a url"}'),
      TypeError,
    );
  });

  it("round-trips URLSearchParams incl. repeats and specials", () => {
    const back = rt(new URLSearchParams("a=1&a=2&b=%26%3D"));
    assert.ok(back instanceof URLSearchParams);
    assert.deepStrictEqual(back.getAll("a"), ["1", "2"]);
    assert.strictEqual(back.get("b"), "&=");
    assert.strictEqual(back.toString(), "a=1&a=2&b=%26%3D");
  });

  it("round-trips empty URLSearchParams", () => {
    const back = rt(new URLSearchParams(""));
    assert.ok(back instanceof URLSearchParams);
    assert.strictEqual(back.toString(), "");
  });
});

describe("superjson: headers", () => {
  it("round-trips entries", () => {
    const back = rt(new Headers([["x-a", "1"], ["x-b", "2"]]));
    assert.ok(back instanceof Headers);
    assert.strictEqual(back.get("x-a"), "1");
    assert.strictEqual(back.get("x-b"), "2");
  });

  it("merges repeated headers like the Headers implementation", () => {
    const h = new Headers();
    h.append("x-multi", "1");
    h.append("x-multi", "2");
    const back = rt(h);
    assert.strictEqual(back.get("x-multi"), h.get("x-multi"));
  });
});

describe("superjson: replacer and reviver interplay", () => {
  const iso = "2024-01-02T03:04:05.000Z";

  it("user replacer transforms plain values alongside envelopes", () => {
    const text = superjson.stringify({ n: 1, at: new Date(iso) }, (_k, v) =>
      typeof v === "number" ? 99 : v,
    ) as string;
    assert.match(text, /"n":99/);
    assert.match(text, /"__type":"date"/);
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
    assert.deepStrictEqual(seen, ["number", "NaN", { n: NaN }]);
    assert.ok(Number.isNaN(back.n));
  });

  it("space pretty-prints", () => {
    const text = superjson.stringify({ a: 1 }, undefined, 2) as string;
    assert.match(text, /\n/);
    assert.deepStrictEqual(superjson.parse(text), { a: 1 });
  });
});

describe("superjson: edges and documented caveats", () => {
  it("unknown __type envelopes pass through untouched", () => {
    assert.deepStrictEqual(superjson.parse('{"__type":"nope","value":1}'), {
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
    assert.ok(back instanceof Date);
  });

  it("kitchen sink: nested mix round-trips with prototypes", () => {
    const d = new Date("2024-01-02T03:04:05.000Z");
    const value = {
      when: d,
      m: new Map<string, unknown>([["k", [1n, /x/]]]),
      s: new Set<unknown>([d]),
      u: new URL("https://example.com/"),
      buf: Buffer.from("hi"),
      big: 9007199254740993n,
      err: new TypeError("t"),
      sym: Symbol.for("k"),
      nan: NaN,
    };
    const back = rt(value);
    assert.ok(back.when instanceof Date);
    assert.ok(back.m instanceof Map);
    const inner = back.m.get("k") as [bigint, RegExp];
    assert.strictEqual(inner[0], 1n);
    assert.ok(inner[1] instanceof RegExp);
    assert.ok(back.s instanceof Set);
    assert.ok([...back.s][0] instanceof Date);
    assert.ok(back.u instanceof URL);
    assert.ok(Buffer.isBuffer(back.buf));
    assert.strictEqual(back.big, 9007199254740993n);
    assert.ok(back.err instanceof Error);
    assert.strictEqual(back.err.name, "TypeError");
    assert.strictEqual(back.sym, Symbol.for("k"));
    assert.ok(Number.isNaN(back.nan));
  });

  it("branded JsonStringified output feeds parse directly", () => {
    const text = superjson.stringify({ a: 1 });
    assert.deepStrictEqual(superjson.parse<{ a: number }>(text), { a: 1 });
  });
});
