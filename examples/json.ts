/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `superjson` (and the `Json` builder): round-trips for Map, Set,
 * Date, bigint, errors with causes, typed arrays, and how to add custom
 * handlers.
 */
import { Json, superjson } from "jutilities/json";

// ---- value families native JSON cannot carry ---------------------------------
const value = {
  map: new Map([["k", "v"]]),
  set: new Set([1, 2, 3]),
  date: new Date(0),
  invalidDate: new Date(Number.NaN),
  big: 9007199254740993n, // exceeds Number.MAX_SAFE_INTEGER
  notANumber: Number.NaN,
  minusZero: -0,
  inf: Infinity,
  negInf: -Infinity,
  re: /jutilities/g,
  url: new URL("https://example.com/p?a=1"),
  bytes: Uint8Array.from([1, 2, 3, 4]),
};

const text = superjson.stringify(value);
console.log("envelopes in flight:", text.slice(0, 72) + "…");

/**
 * The expected shape of `value` after a full round-trip. `superjson.parse`
 * defaults its payload to `unknown`, so the demo pins the type explicitly.
 */
type ValueShape = {
  map: Map<string, string>;
  set: Set<number>;
  date: Date;
  invalidDate: Date;
  big: bigint;
  inf: number;
  negInf: number;
  bytes: Uint8Array;
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
const err = superjson.parse<{ message: string; cause: { message: string } }>(
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
    stringify: (_key, up) => up.text,
    parse: (_key, text2) => new Upper(text2),
  });
}

const roundTripped = upperJson().parse<Upper>(upperJson().stringify(new Upper("hi")));
console.log("custom handler:", roundTripped instanceof Upper, roundTripped.text);
