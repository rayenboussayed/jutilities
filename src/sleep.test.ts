import { describe, expect, it } from "vitest";

import { sleepAsync, sleepSync } from "./sleep.js";

describe("sleepAsync", () => {
  it("resolves immediately for sleep 0, negative, and default", async () => {
    const t0 = performance.now();
    expect(await sleepAsync({ sleep: 0 })).toBeUndefined();
    expect(await sleepAsync({ sleep: -5 })).toBeUndefined();
    expect(await sleepAsync({})).toBeUndefined();
    expect(await sleepAsync()).toBeUndefined();
    expect(await sleepAsync(undefined)).toBeUndefined();
    expect(performance.now() - t0 < 50).toBeTruthy();
  });

  it("waits at least the requested delay", async () => {
    const start = performance.now();
    expect(await sleepAsync({ sleep: 20 })).toBeUndefined();
    const elapsed = performance.now() - start;
    expect(elapsed >= 15, `elapsed ${elapsed} should be >= 15`).toBeTruthy();
    expect(elapsed < 500, `elapsed ${elapsed} should be < 500`).toBeTruthy();
  });

  it("throws synchronously when pre-aborted, even with sleep 0", async () => {
    const controller = new AbortController();
    controller.abort();
    // NOTE: sleepAsync throws synchronously via throwIfAborted (not a rejection)
    expect(() =>
      sleepAsync({ signal: controller.signal, sleep: 10 })).toThrow();
    expect(() => sleepAsync({ signal: controller.signal, sleep: 0 })).toThrow();
    expect(() => sleepAsync({ signal: controller.signal })).toThrow();
  });

  it("abort during sleep rejects with signal.reason, early", async () => {
    const controller = new AbortController();
    const reason = new Error("custom-stop");
    const p = sleepAsync({ signal: controller.signal, sleep: 1000 });
    const start = performance.now();
    setTimeout(() => controller.abort(reason), 10);
    await expect(p).rejects.toSatisfy((e) => e === reason);
    expect(performance.now() - start < 800,
      "should reject early on abort",).toBeTruthy();
  });

  it("abort with default reason rejects with AbortError DOMException", async () => {
    const controller = new AbortController();
    const p = sleepAsync({ signal: controller.signal, sleep: 1000 });
    setTimeout(() => controller.abort(), 10);
    await expect(p).rejects.toSatisfy((e) => e instanceof DOMException && e.name === "AbortError");
  });

  it("resolves undefined without signal", async () => {
    expect(await sleepAsync({ sleep: 5 })).toBeUndefined();
  });

  it("NaN sleep resolves quickly (setTimeout NaN ~= 0)", async () => {
    const start = performance.now();
    await sleepAsync({ sleep: NaN });
    expect(performance.now() - start < 200).toBeTruthy();
  });

  it("rounds a fractional delay to whole milliseconds (still a timer)", async () => {
    // `sleep: 0` resolves through an already-resolved promise (microtask),
    // while `sleep: 0.4` rounds to 0 ms and still goes through a timer
    // (macrotask) — so the fractional sleep settles last.
    const order: string[] = [];
    await Promise.all([
      sleepAsync({ sleep: 0 }).then(() => order.push("zero")),
      sleepAsync({ sleep: 0.4 }).then(() => order.push("fractional")),
    ]);
    expect(order).toStrictEqual(["zero", "fractional"]);
  });

  it("rounds a fractional delay up, not down", async () => {
    // Node truncates a fractional timer delay, so the 1 ms difference between
    // rounding (1.6 -> 2 ms) and truncating (1.6 -> 1 ms) is too small to
    // observe in one call. Repeating it 20 times amplifies that to 20 ms:
    // rounded, the waits take >= 40 ms; truncated, about 20 ms.
    const rounds = 20;
    const start = performance.now();
    for (let i = 0; i < rounds; i++) {
      await sleepAsync({ sleep: 1.6 });
    }
    const elapsed = performance.now() - start;
    expect(elapsed >= 35,
      `20 rounded 1.6 ms waits should take >= 35 ms, took ${elapsed}`,).toBeTruthy();
  });

  it("concurrent sleeps resolve independently (~sleep, not 3*sleep)", async () => {
    const start = performance.now();
    const results = await Promise.all([
      sleepAsync({ sleep: 20 }),
      sleepAsync({ sleep: 20 }),
      sleepAsync({ sleep: 20 }),
    ]);
    const elapsed = performance.now() - start;
    expect(results).toStrictEqual([undefined, undefined, undefined]);
    expect(elapsed < 200, `parallel should be ~20ms, took ${elapsed}`).toBeTruthy();
  });
});

describe("sleepSync", () => {
  it("returns immediately for sleep 0, negative, and default", () => {
    const t0 = Date.now();
    expect(sleepSync({ sleep: 0 })).toBeUndefined();
    expect(sleepSync({ sleep: -5 })).toBeUndefined();
    expect(sleepSync({})).toBeUndefined();
    expect(sleepSync()).toBeUndefined();
    expect(sleepSync(undefined)).toBeUndefined();
    expect(Date.now() - t0 < 50).toBeTruthy();
  });

  it("blocks for approximately the requested delay", () => {
    const start = Date.now();
    sleepSync({ sleep: 20 });
    const elapsed = Date.now() - start;
    expect(elapsed >= 15, `elapsed ${elapsed} should be >= 15`).toBeTruthy();
    expect(elapsed < 500, `elapsed ${elapsed} should be < 500`).toBeTruthy();
  });

  it("throws when pre-aborted, even with sleep 0", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => sleepSync({ signal: controller.signal, sleep: 10 })).toThrow();
    expect(() => sleepSync({ signal: controller.signal, sleep: 0 })).toThrow();
    expect(() => sleepSync({ signal: controller.signal })).toThrow();
  });

  it("NaN sleep returns immediately (finish is NaN, loop never runs)", () => {
    const start = Date.now();
    sleepSync({ sleep: NaN });
    expect(Date.now() - start < 100).toBeTruthy();
  });

  it("blocks the event loop (timers cannot fire mid-sleep)", async () => {
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 5);
    sleepSync({ sleep: 30 });
    // still in the same synchronous execution: the timer could not have run
    expect(fired).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fired).toBe(true);
  });
});
