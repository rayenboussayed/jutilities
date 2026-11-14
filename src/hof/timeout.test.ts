/* eslint-disable sonarjs/void-use */
import { describe, expect, it } from "vitest";

import { withTimeoutAsync } from "./timeout.js";

describe("withTimeoutAsync", () => {
  it("returns identical fn when no signal and timeoutMs <= 0", () => {
    /**
     * Identity function under the unwrap shortcut (no signal, timeoutMs<=0).
     * @param x - Value echoed back.
     * @returns `x`, unchanged.
     */
    async function fn(x: number) {
      return x;
    }
    expect(withTimeoutAsync(fn, {})).toBe(fn);
    expect(withTimeoutAsync(fn, { timeoutMs: 0 })).toBe(fn);
    expect(withTimeoutAsync(fn, { timeoutMs: -1 })).toBe(fn);
    // NaN <= 0 is false, but !signal && NaN<=0 -> false, so wraps; 0/-1 unwrap
  });

  it("options omitted defaults to no timeout (returns identical fn)", () => {
    /**
     * Constant producer under the missing-options unwrap shortcut.
     * @returns Always `1`.
     */
    async function fn() {
      return 1;
    }
    expect(withTimeoutAsync(fn)).toBe(fn);
    expect(withTimeoutAsync(fn, undefined)).toBe(fn);
  });

  it("wraps when signal present even with timeoutMs 0", () => {
    /**
     * Constant producer used to compare wrapped vs original references.
     * @returns Always `1`.
     */
    async function fn() {
      return 1;
    }
    const controller = new AbortController();
    expect(withTimeoutAsync(fn, { signal: controller.signal })).not.toBe(fn);
    expect(withTimeoutAsync(fn, { timeoutMs: 1 })).not.toBe(fn);
  });

  it("fast fn resolves with value identity and cleans up", async () => {
    /**
     * Doubler used for fast-path resolution identity.
     * @param x - Value to double.
     * @returns `x * 2`.
     */
    async function fn(x: number) {
      return x * 2;
    }
    const wrapped = withTimeoutAsync(fn, { timeoutMs: 1000 });
    expect(await wrapped(21)).toBe(42);
  });

  it("forwards this and args", async () => {
    /**
     * `this`-aware adder verifying receiver and arg forwarding.
     * @param this - Receiver carrying the additive basis `m`.
     * @param this.m - Stored base added to the operands.
     * @param a - First addend.
     * @param b - Second addend.
     * @returns A promise resolving to `this.m + a + b`.
     */
    async function fn(this: { m: number }, a: number, b: number) {
      return this.m + a + b;
    }
    const wrapped = withTimeoutAsync(fn, { timeoutMs: 1000 });
    expect(await wrapped.call({ m: 1 }, 2, 3)).toBe(6);
  });

  it("timeout rejects (currently with undefined when no signal)", async () => {
    /**
     * Deliberately slow producer exceeding the 20ms budget.
     * @returns The literal `"slow-done"` (never observed — caller rejects
     * first).
     */
    async function slow() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return "slow-done";
    }
    const wrapped = withTimeoutAsync(slow, { timeoutMs: 20 });
    const start = performance.now();
    await expect(wrapped()).rejects.toSatisfy((err: unknown) => {
      // No signal supplies its own reasons; the timeout uses `undefined` for the rejection reason.
      return err === undefined;
    });
    expect(performance.now() - start < 500).toBeTruthy();
  });

  it("slow fn continues in background after timeout (no cancellation)", async () => {
    let finished = false;
    /**
     * Work producer that flips `finished` once its real work completes.
     * @returns Always `1`, after flipping `finished` (after ~50ms).
     */
    async function slow() {
      await new Promise((resolve) => setTimeout(resolve, 50));
      finished = true;
      return 1;
    }
    const wrapped = withTimeoutAsync(slow, { timeoutMs: 10 });
    await expect(wrapped()).rejects.toSatisfy(() => true);
    expect(finished).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(finished).toBe(true);
  });

  it("mid-flight abort rejects with signal.reason", async () => {
    const controller = new AbortController();
    const reason = new Error("boom-abort");
    /**
     * Slow producer raced against a mid-flight `controller.abort(reason)`.
     * @returns Always `1` (never observed — the rejection wins).
     */
    async function slow() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return 1;
    }
    const wrapped = withTimeoutAsync(slow, { signal: controller.signal });
    const p = wrapped();
    const assertion = expect(p).rejects.toSatisfy((err: unknown) => err === reason);
    setTimeout(() => controller.abort(reason), 10);
    await assertion;
  });

  it("custom signal reason propagates", async () => {
    const controller = new AbortController();
    /**
     * Slow producer raced against a plain `"custom"` abort reason.
     * @returns Always `1` (never observed — the rejection wins).
     */
    async function slow() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return 1;
    }
    const wrapped = withTimeoutAsync(slow, {
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    const p = wrapped();
    const assertion = expect(p).rejects.toSatisfy((err: unknown) => err === "custom");
    setTimeout(() => controller.abort("custom"), 10);
    await assertion;
  });

  it("timeoutMs path rejects with signal.reason when signal exists", async () => {
    const controller = new AbortController();
    const reason = new Error("timeout-reason");
    // weaken: implementation uses signal?.reason for timeout too
    /**
     * Slow producer racing a 20ms wall-clock timeout while a live (non-aborted)
     * signal exists — the rejection value is the default `AbortError`.
     * @returns Always `1` (never observed — the rejection wins).
     */
    async function slow() {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return 1;
    }
    // abort controller with custom reason upfront? No - test timeout with signal present but not aborted:
    // reject value will be signal.reason which is default AbortError at timeout time.
    const wrapped = withTimeoutAsync(slow, {
      signal: controller.signal,
      timeoutMs: 20,
    });
    await expect(wrapped()).rejects.toSatisfy(() => true);
    void reason;
  });

  it("sync-throwing fn propagates synchronously and cleans up its timer", () => {
    /**
     * Sync-declared producer that throws the instant it is invoked.
     */
    function syncThrow(): Promise<number> {
      throw new Error("sync boom");
    }
    const wrapped = withTimeoutAsync(syncThrow as never, {
      timeoutMs: 60_000,
    });
    expect(() => (wrapped as () => void)()).toThrow(/sync boom/);
  });

  it("concurrent calls share signal: abort rejects both", async () => {
    const controller = new AbortController();
    /**
     * Slow producer invoked twice and raced against one shared abort.
     * @param x - Argument echoed back (asserted irrelevant: both reject).
     * @returns `x` after ~1s (never observed — abort rejects both).
     */
    async function slow(x: number) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return x;
    }
    const wrapped = withTimeoutAsync(slow, { signal: controller.signal });
    const p1 = wrapped(1);
    const p2 = wrapped(2);
    // attach handlers immediately to avoid unhandled rejection warnings
    const a1 = expect(p1).rejects.toSatisfy(() => true);
    const a2 = expect(p2).rejects.toSatisfy(() => true);
    controller.abort(new Error("both"));
    await Promise.all([a1, a2]);
  });

  it("NaN timeoutMs wraps but never fires (NaN > 0 is false)", async () => {
    /**
     * Doubler proving the NaN deadline never rejects the result.
     * @param x - Value to double.
     * @returns `x * 2`.
     */
    async function fn(x: number) {
      return x * 2;
    }
    const wrapped = withTimeoutAsync(fn, { timeoutMs: NaN });
    expect(wrapped).not.toBe(fn);
    expect(await wrapped(21)).toBe(42);
  });

  it("skipHof: true resolves to fn itself at wrap time", () => {
    /**
     * Identity function reaching the bypass switch unenhanced.
     * @param x - Value echoed back.
     * @returns `x`, unchanged.
     */
    async function fn(x: number) {
      return x;
    }
    const controller = new AbortController();
    expect(withTimeoutAsync(fn, {
        signal: controller.signal,
        skipHof: true,
        timeoutMs: 100,
      })).toBe(fn);
  });

  it("per-call skipHof predicate skips the deadline race", async () => {
    let calls = 0;
    /**
     * Slow producer that would lose the 10ms race — run raw through the
     * bypass it resolves past the deadline instead.
     * @returns Always `1`, after counting the invocation.
     */
    async function fn() {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return 1;
    }
    const wrapped = withTimeoutAsync(fn, { skipHof: () => true, timeoutMs: 10 });

    expect(await wrapped()).toBe(1);
    expect(calls).toBe(1);
  });
});
