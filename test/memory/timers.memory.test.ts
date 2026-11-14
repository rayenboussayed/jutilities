import { getEventListeners } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withDelayAsync } from "../../src/hof/delay.js";
import { withTimeoutAsync } from "../../src/hof/timeout.js";
import { sleepAsync } from "../../src/sleep.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("timer cleanup", () => {
  it("sleepAsync clears its timer and abort listener on abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sleepAsync({ signal: controller.signal, sleep: 60_000 });
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("sleepAsync clears its abort listener on normal completion", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = sleepAsync({ signal: controller.signal, sleep: 10 });
    await vi.advanceTimersByTimeAsync(10);
    await expect(pending).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("withTimeoutAsync cleans up its timer when the wrapped function throws synchronously", () => {
    vi.useFakeTimers();
    const syncThrow = (): Promise<never> => {
      throw new Error("sync boom");
    };
    const wrapped = withTimeoutAsync(syncThrow, { timeoutMs: 60_000 });
    expect(() => wrapped()).toThrow(/sync boom/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("withTimeoutAsync clears its timer and abort listener on abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = withTimeoutAsync(
      () => new Promise<string>(() => {}),
      {
        signal: controller.signal,
        timeoutMs: 60_000,
      },
    )();
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  it("withDelayAsync clears its timer and abort listener on abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const wrapped = withDelayAsync(async () => "ok", {
      delay: 60_000,
      signal: controller.signal,
    });
    const pending = wrapped();
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });
});
