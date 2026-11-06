import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { abort } from "./signal.js";

describe("abort", () => {
  it("is a no-op when signal is undefined", () => {
    let called = 0;
    const onAbort = () => {
      called++;
    };
    let remover: unknown;
    assert.doesNotThrow(() => {
      remover = abort({ onAbort });
    });
    assert.strictEqual(typeof remover, "function");
    assert.doesNotThrow(() => (remover as () => void)());
    assert.strictEqual(called, 0);
  });

  it("calls onAbort when signal aborts", () => {
    const controller = new AbortController();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    assert.strictEqual(called, 0);
    controller.abort();
    assert.strictEqual(called, 1);
  });

  it("remover prevents onAbort from firing", () => {
    const controller = new AbortController();
    let called = 0;
    const remove = abort({
      onAbort: () => called++,
      signal: controller.signal,
    });
    remove();
    controller.abort();
    assert.strictEqual(called, 0);
  });

  it("double remove is idempotent", () => {
    const controller = new AbortController();
    let called = 0;
    const remove = abort({
      onAbort: () => called++,
      signal: controller.signal,
    });
    remove();
    assert.doesNotThrow(() => remove());
    controller.abort();
    assert.strictEqual(called, 0);
  });

  it("does not retro-fire for already-aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    assert.strictEqual(called, 0);
  });

  it("stacks multiple listeners, each remover only removes its own", () => {
    const controller = new AbortController();
    let a = 0;
    let b = 0;
    const removeA = abort({ onAbort: () => a++, signal: controller.signal });
    abort({ onAbort: () => b++, signal: controller.signal });
    removeA();
    controller.abort();
    assert.strictEqual(a, 0);
    assert.strictEqual(b, 1);
  });

  it("always returns a function", () => {
    const controller = new AbortController();
    assert.strictEqual(
      typeof abort({ onAbort: () => {}, signal: controller.signal }),
      "function",
    );
    assert.strictEqual(typeof abort({ onAbort: () => {} }), "function");
  });

  it("repeated abort fires onAbort only once", () => {
    const controller = new AbortController();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    controller.abort();
    controller.abort();
    assert.strictEqual(called, 1);
  });
});
