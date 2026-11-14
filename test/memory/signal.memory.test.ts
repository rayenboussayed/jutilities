import { getEventListeners } from "node:events";
import { describe, expect, it } from "vitest";

import { abort } from "../../src/signal.js";

const LISTENER_COUNT = 5;

describe("abort", () => {
  it("returns a safe no-op remover without a signal", () => {
    const remove = abort({ onAbort: () => {} });

    expect(remove()).toBeUndefined();
  });

  it("registers one listener per call and removes each one", () => {
    const controller = new AbortController();

    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);

    const removers = Array.from({ length: LISTENER_COUNT }, () =>
      abort({ onAbort: () => {}, signal: controller.signal }),
    );

    expect(getEventListeners(controller.signal, "abort")).toHaveLength(
      LISTENER_COUNT,
    );

    for (const remove of removers) {
      remove();
    }

    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("is idempotent when a remover is called twice", () => {
    const controller = new AbortController();
    const remove = abort({ onAbort: () => {}, signal: controller.signal });

    remove();

    expect(() => remove()).not.toThrow();
  });
});
