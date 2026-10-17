import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromBase64 } from "./from.js";
import { toBase64 } from "./to.js";

describe("fromBase64 (Node branch)", () => {
  it("decodes known vectors as Buffers", () => {
    const out = fromBase64("aGk=");
    assert.ok(Buffer.isBuffer(out));
    assert.deepStrictEqual([...out], [104, 105]);
    assert.deepStrictEqual([...fromBase64("")], []);
    assert.strictEqual(
      Buffer.from(fromBase64("aGVsbG8gd29ybGQ=")).toString(),
      "hello world",
    );
  });

  it("documents pooled view: backing store may be shared and offset", () => {
    // churn the Buffer pool so pooled slices show shared backing stores
    for (let i = 0; i < 50; i++) fromBase64("aGk=");
    const out = fromBase64("aGk=");
    assert.ok(Buffer.isBuffer(out));
    assert.strictEqual(out.byteLength, 2);
    // pooled: backing ArrayBuffer is at least as large as the view
    assert.ok(out.buffer.byteLength >= out.byteLength);
    assert.deepStrictEqual([...out], [104, 105]);
  });

  it("round-trips arbitrary bytes incl. 0 and 255", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 250, 255]);
    assert.deepStrictEqual([...fromBase64(toBase64(bytes))], [...bytes]);
  });

  it("round-trips large payloads", () => {
    const bytes = new Uint8Array(10_000).map((_, i) => i % 256);
    const out = fromBase64(toBase64(bytes));
    assert.strictEqual(out.byteLength, 10_000);
    assert.deepStrictEqual([...out.slice(0, 4)], [0, 1, 2, 3]);
    assert.deepStrictEqual([...out.slice(-2)], [14, 15]);
  });

  it("is lenient with invalid input (Buffer ignores bad chars)", () => {
    assert.doesNotThrow(() => fromBase64("!!!"));
  });
});

describe("fromBase64 (browser branch via window stub)", () => {
  const g = globalThis as { window?: unknown };

  it("round-trips through atob", () => {
    g.window = {};
    try {
      const bytes = new Uint8Array([0, 1, 2, 250, 255]);
      assert.deepStrictEqual(fromBase64(toBase64(bytes)), bytes);
      assert.deepStrictEqual(fromBase64("aGk="), new Uint8Array([104, 105]));
    } finally {
      delete g.window;
    }
  });

  it("atob branch is strict with invalid input", () => {
    g.window = {};
    try {
      assert.throws(() => fromBase64("!!!"));
    } finally {
      delete g.window;
    }
  });
});
