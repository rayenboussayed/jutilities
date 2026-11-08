import { describe, expect, it } from "vitest";

import { abort } from "./signal.js";

describe("abort", () => {
  it("is a no-op when signal is undefined", () => {
    let called = 0;
    const onAbort = () => {
      called++;
    };
    let remover: unknown;
    expect(() => {
      remover = abort({ onAbort });
    }).not.toThrow();
    expect(typeof remover).toBe("function");
    expect(() => (remover as () => void)()).not.toThrow();
    expect(called).toBe(0);
  });

  it("calls onAbort when signal aborts", () => {
    const controller = new AbortController();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    expect(called).toBe(0);
    controller.abort();
    expect(called).toBe(1);
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
    expect(called).toBe(0);
  });

  it("double remove is idempotent", () => {
    const controller = new AbortController();
    let called = 0;
    const remove = abort({
      onAbort: () => called++,
      signal: controller.signal,
    });
    remove();
    expect(() => remove()).not.toThrow();
    controller.abort();
    expect(called).toBe(0);
  });

  it("does not retro-fire for already-aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    expect(called).toBe(0);
  });

  it("stacks multiple listeners, each remover only removes its own", () => {
    const controller = new AbortController();
    let a = 0;
    let b = 0;
    const removeA = abort({ onAbort: () => a++, signal: controller.signal });
    abort({ onAbort: () => b++, signal: controller.signal });
    removeA();
    controller.abort();
    expect(a).toBe(0);
    expect(b).toBe(1);
  });

  it("always returns a function", () => {
    const controller = new AbortController();
    expect(typeof abort({ onAbort: () => {}, signal: controller.signal })).toBe("function");
    expect(typeof abort({ onAbort: () => {} })).toBe("function");
  });

  it("repeated abort fires onAbort only once", () => {
    const controller = new AbortController();
    let called = 0;
    abort({ onAbort: () => called++, signal: controller.signal });
    controller.abort();
    controller.abort();
    expect(called).toBe(1);
  });
});
