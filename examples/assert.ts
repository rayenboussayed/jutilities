/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates the `assert` invariants: truthy checks, nil guards, exhaustive
 * `switch` coverage, the decorator-domain paren-less-misfire guards, and the
 * `withAssert` wrappers that gate a wrapped call's result on those guards.
 */
import {
  assert,
  assertGuardConsistency,
  assertNever,
  assertNotNil,
  assertNotRawApplication,
  assertNotRawMemberApplication,
  withAssertAsync,
  withAssertSync,
} from "jutilities/assert";

try {
  assert(false, "cache store must be provided", "withCache");
} catch (error) {
  console.log("assert throws:", (error as Error).constructor.name, "—", (error as Error).message);
}

assert(1 + 1 === 2, "should never fail");
console.log("assert(false === unmet precondition) survived ✓");

try {
  assertNotNil(null);
} catch (error) {
  console.log("assertNotNil(null) :", (error as Error).message);
}

try {
  assertNotNil(undefined, "config");
} catch (error) {
  console.log("assertNotNil(undefined, 'config') :", (error as Error).message);
}

/**
 * Explores an impossible `switch` leftover: every real kind returns early, so
 * the only value that can reach this line is one that TypeScript types as
 * `never` — assert it.
 * @param kind - The leftover branch value handed to the default arm.
 */
function unreachable(kind: string): never {
  assertNever(kind as never, "impossible reach kind");
}

try {
  unreachable("leftover");
} catch (error) {
  console.log("assertNever('leftover') :", (error as Error).message);
}

try {
  assertNotRawApplication({ kind: "method", name: "load" }, "decorateMethod");
} catch (error) {
  console.log("raw @decorator misfire :", (error as Error).message);
}

try {
  assertNotRawMemberApplication(
    [(value: unknown) => value, { kind: "method", name: "load" }],
    "decorateMethod",
  );
} catch (error) {
  console.log("raw converter misfire  :", (error as Error).message);
}

try {
  assertGuardConsistency({ require: "sync" }, true, "decorateMethod", "load");
} catch (error) {
  console.log("guard mismatch         :", (error as Error).message);
}

/**
 * Doubles a positive number, reporting `null` for non-positive input — an
 * easy-to-fail fake loader so the assert gate has something to catch.
 * @param value - The number to double.
 * @returns The doubled number, or null for non-positive input.
 */
const checkedDouble = withAssertSync(
  (value: number) => (value > 0 ? value * 2 : null),
  {
    onResult: ({ result }) => assertNotNil(result, "doubled value"),
  },
);

console.log("withAssertSync valid   :", checkedDouble(3));
try {
  checkedDouble(0);
} catch (error) {
  console.log("withAssertSync invalid :", (error as Error).message);
}

const checkedLoadUser = withAssertAsync(
  async (id: number) => (id > 0 ? { id } : null),
  {
    onResult: ({ result }) => assertNotNil(result, "user"),
  },
);

console.log("withAssertAsync valid  :", JSON.stringify(await checkedLoadUser(7)));
try {
  await checkedLoadUser(0);
} catch (error) {
  console.log("withAssertAsync invalid:", (error as Error).message);
}
