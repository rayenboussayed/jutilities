import { superjson } from "jutilities/json";
import { afterAll, describe, expect, test } from "vitest";

const parse = superjson.parse.bind(superjson);
const stringify = superjson.stringify.bind(superjson);

const plain = {
  id: 1,
  name: "jutilities",
  nested: { at: 0, ok: true },
  tags: ["a", "b"],
};
const rich = {
  bigint: 10n,
  date: new Date(0),
  map: new Map([["key", "value"]]),
  set: new Set([1, 2, 3]),
  typed: new Uint8Array([1, 2, 3]),
};
const plainText = superjson.stringify(plain);
const richText = superjson.stringify(rich);

let sink: unknown;

describe("superjson", () => {
  test("superjson.stringify plain", async ({ bench }) => {
    await bench("superjson.stringify plain", () => {
      sink = stringify(plain);
    }).run();

    expect(sink).toBeDefined();
  });

  test("superjson.parse plain", async ({ bench }) => {
    await bench("superjson.parse plain", () => {
      sink = parse(plainText);
    }).run();

    expect(sink).toBeDefined();
  });

  test("superjson.stringify rich", async ({ bench }) => {
    await bench("superjson.stringify rich", () => {
      sink = stringify(rich);
    }).run();

    expect(sink).toBeDefined();
  });

  test("superjson.parse rich", async ({ bench }) => {
    await bench("superjson.parse rich", () => {
      sink = parse(richText);
    }).run();

    expect(sink).toBeDefined();
  });
});

afterAll(() => {
  expect(sink).toBeDefined();
});
