/* eslint-disable sonarjs/void-use */
/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */
import type { JsonHandler, JsonStringified } from "jutilities/json";

import { Json, superjson } from "jutilities/json";
import assert from "node:assert/strict";


/**
 * Demonstrates `superjson` (and the `Json` builder): round-trips for Map, Set,
 * Date, bigint, errors with causes, typed arrays, and how to add custom
 * handlers.
 */

// ---- value families native JSON cannot carry ---------------------------------
const value = {
  big: 9007199254740993n, // exceeds Number.MAX_SAFE_INTEGER
  bytes: Uint8Array.from([1, 2, 3, 4]),
  date: new Date(0),
  inf: Infinity,
  invalidDate: new Date(Number.NaN),
  map: new Map([["k", "v"]]),
  minusZero: -0,
  negInf: -Infinity,
  notANumber: Number.NaN,
  re: /jutilities/g,
  set: new Set([1, 2, 3]),
  url: new URL("https://example.com/p?a=1"),
};

const text = superjson.stringify(value);
console.log("envelopes in flight:", text.slice(0, 72) + "…");

/**
 * The expected shape of `value` after a full round-trip. `superjson.parse`
 * defaults its payload to `unknown`, so the demo pins the type explicitly.
 */
type ValueShape = {
  big: bigint;
  bytes: Uint8Array;
  date: Date;
  inf: number;
  invalidDate: Date;
  map: Map<string, string>;
  negInf: number;
  set: Set<number>;
};

const back = superjson.parse<ValueShape>(text);
console.log("Map survives:", back.map instanceof Map, back.map.get("k"));
console.log("Set survives:", back.set instanceof Set, back.set.size);
console.log("Date survives:", back.date.getTime() === 0);
console.log(
  "±Infinity survive:",
  back.inf === Infinity,
  back.negInf === -Infinity,
);
console.log(
  "invalid date survives as NaN:",
  back.invalidDate instanceof Date,
  Number.isNaN(back.invalidDate.getTime()),
);
console.log("bigint survives:", back.big === 9007199254740993n);
console.log("typed array survives:", back.bytes instanceof Uint8Array);

// ---- errors keep cause chains (but subclass identity is lost) ----------------
const err = superjson.parse<{ cause: { message: string }; message: string; }>(
  superjson.stringify(new Error("outer", { cause: new Error("inner") })),
);
console.log("error round-trip:", err.message, "->", err.cause.message);

// ---- custom handlers with the builder API ------------------------------------
/**
 * Domain type used to demo `addHandler` round-tripping.
 */
class Upper {
  /**
   * Creates an `Upper`.
   * @param text - The stored text.
   */
  constructor(public readonly text: string) {}
}

/**
 * Builds a `Json` with a custom `Upper` handler registered.
 * @returns The configured instance.
 */
function upperJson(): Json {
  return new Json().addHandler("upper", {
    isApplicable: (_key, value2): value2 is Upper => value2 instanceof Upper,
    parse: (_key, text2) => new Upper(text2 as string),
    stringify: (_key, up) => up.text,
  });
}

const roundTripped = upperJson().parse<Upper>(upperJson().stringify(new Upper("hi")));
console.log("custom handler:", roundTripped instanceof Upper, roundTripped.text);


// ---- appended generic example ----------------------------------------------
// ---- generic domain round-trip -----------------------------------------------
interface Envelope<T> {
  kind: string;
  payload: T;
}

/**
 * Typed round-trip helper.
 * @template T - The value type being round-tripped.
 * @param value - The value.
 * @returns The rebuilt value, typed as `T` (no cast at the call site).
 */
function roundTrip<T>(value: T): T {
  return superjson.parse<T>(superjson.stringify(value));
}

const boxed: Envelope<{ n: number }> = { kind: "box", payload: { n: 7 } };
const rebuilt = roundTrip(boxed);
assert.deepStrictEqual(rebuilt, boxed);
console.log("round-tripped:", rebuilt);

interface Point {
  x: number;
  y: number;
}

// ---- generic handler factory --------------------------------------------------
/**
 * Builds a handler that round-trips values of a given type `T`, where the
 * JSON-safe form is a single string (`TS = string`).
 * @template T - The runtime value type.
 * @param encode - Stringify strategy.
 * @param decode - Parse strategy.
 * @returns A typed `JsonHandler<T, string>`.
 */
function stringHandler<T>(
  encode: (value: T) => string,
  decode: (text: string) => T,
): JsonHandler<T, string> {
  return {
    isApplicable: (_key, value): value is T => value !== null && typeof value === "object",
    parse: (_key, text) => decode(text),
    stringify: (_key, value) => encode(value),
  };
}

const pointHandler = stringHandler<Point>(
  (p) => `${p.x},${p.y}`,
  (text) => {
    const [xs, ys] = text.split(",");
    return { x: Number(xs), y: Number(ys) };
  },
);

const j = new Json().addHandler("point", pointHandler);
const pointText = j.stringify<Point>({ x: 3, y: 4 });
// stringify() returns the branded type directly — no cast at the call site:
const branded: JsonStringified<Point> = pointText;
const genericBack = j.parse<Point>(branded);
console.log("point round-trip:", back);

// ---- superjson typed arrays under generics ------------------------------------
const typed = superjson.stringify(Uint8Array.from([1, 2, 3]));
const typedBack = superjson.parse<Uint8Array>(typed);
assert.ok(typedBack instanceof Uint8Array);
console.log("typed array round-trip length:", typedBack.length);


// ===== appended generic Json handler demo from examples/generic-complex.ts =====
// ---- parameterized Json handler --------------------------------------------
/**
 * Builds a `Json` whose single custom handler round-trips values of a
 * parameterized domain type `T`.
 * @template T - The domain value type carried by the envelope.
 * @returns A `Json` with the generic `upper` handler registered.
 */
function typedUpperJson<T extends { text: string }>() {
  return new Json().addHandler<T, string>("upper", {
    isApplicable: (_key, value): value is T =>
      typeof value === "object" && value !== null && "text" in value,
    parse: (_key, text) => ({ text } as T),
    stringify: (_key, value) => (value as T).text,
  });
}

const ujson = typedUpperJson<{ text: string }>();
const uRound = ujson.parse(ujson.stringify({ text: "HI" }));
console.log("generic upper:", uRound);

void genericBack;
