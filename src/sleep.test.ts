import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sleepAsync, sleepSync } from "./sleep.js";

describe("sleepAsync", () => {
  it("resolves immediately for sleep 0, negative, and default", async () => {
    const t0 = performance.now();
    assert.strictEqual(await sleepAsync({ sleep: 0 }), undefined);
    assert.strictEqual(await sleepAsync({ sleep: -5 }), undefined);
    assert.strictEqual(await sleepAsync({}), undefined);
    assert.strictEqual(await sleepAsync(), undefined);
    assert.strictEqual(await sleepAsync(undefined), undefined);
    assert.ok(performance.now() - t0 < 50);
  });

  it("waits at least the requested delay", async () => {
    const start = performance.now();
    assert.strictEqual(await sleepAsync({ sleep: 20 }), undefined);
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 15, `elapsed ${elapsed} should be >= 15`);
    assert.ok(elapsed < 500, `elapsed ${elapsed} should be < 500`);
  });

  it("throws synchronously when pre-aborted, even with sleep 0", async () => {
    const controller = new AbortController();
    controller.abort();
    // NOTE: sleepAsync throws synchronously via throwIfAborted (not a rejection)
    assert.throws(() =>
      sleepAsync({ signal: controller.signal, sleep: 10 }),
    );
    assert.throws(() => sleepAsync({ signal: controller.signal, sleep: 0 }));
    assert.throws(() => sleepAsync({ signal: controller.signal }));
  });

  it("abort during sleep rejects with signal.reason, early", async () => {
    const controller = new AbortController();
    const reason = new Error("custom-stop");
    const p = sleepAsync({ signal: controller.signal, sleep: 1000 });
    const start = performance.now();
    setTimeout(() => controller.abort(reason), 10);
    await assert.rejects(p, (e) => e === reason);
    assert.ok(
      performance.now() - start < 800,
      "should reject early on abort",
    );
  });

  it("abort with default reason rejects with AbortError DOMException", async () => {
    const controller = new AbortController();
    const p = sleepAsync({ signal: controller.signal, sleep: 1000 });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(
      p,
      (e) => e instanceof DOMException && e.name === "AbortError",
    );
  });

  it("resolves undefined without signal", async () => {
    assert.strictEqual(await sleepAsync({ sleep: 5 }), undefined);
  });

  it("NaN sleep resolves quickly (setTimeout NaN ~= 0)", async () => {
    const start = performance.now();
    await sleepAsync({ sleep: NaN });
    assert.ok(performance.now() - start < 200);
  });

  it("concurrent sleeps resolve independently (~sleep, not 3*sleep)", async () => {
    const start = performance.now();
    const results = await Promise.all([
      sleepAsync({ sleep: 20 }),
      sleepAsync({ sleep: 20 }),
      sleepAsync({ sleep: 20 }),
    ]);
    const elapsed = performance.now() - start;
    assert.deepStrictEqual(results, [undefined, undefined, undefined]);
    assert.ok(elapsed < 200, `parallel should be ~20ms, took ${elapsed}`);
  });
});

describe("sleepSync", () => {
  it("returns immediately for sleep 0, negative, and default", () => {
    const t0 = Date.now();
    assert.strictEqual(sleepSync({ sleep: 0 }), undefined);
    assert.strictEqual(sleepSync({ sleep: -5 }), undefined);
    assert.strictEqual(sleepSync({}), undefined);
    assert.strictEqual(sleepSync(), undefined);
    assert.strictEqual(sleepSync(undefined), undefined);
    assert.ok(Date.now() - t0 < 50);
  });

  it("blocks for approximately the requested delay", () => {
    const start = Date.now();
    sleepSync({ sleep: 20 });
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 15, `elapsed ${elapsed} should be >= 15`);
    assert.ok(elapsed < 500, `elapsed ${elapsed} should be < 500`);
  });

  it("throws when pre-aborted, even with sleep 0", () => {
    const controller = new AbortController();
    controller.abort();
    assert.throws(() => sleepSync({ signal: controller.signal, sleep: 10 }));
    assert.throws(() => sleepSync({ signal: controller.signal, sleep: 0 }));
    assert.throws(() => sleepSync({ signal: controller.signal }));
  });

  it("NaN sleep returns immediately (finish is NaN, loop never runs)", () => {
    const start = Date.now();
    sleepSync({ sleep: NaN });
    assert.ok(Date.now() - start < 100);
  });

  it("blocks the event loop (timers cannot fire mid-sleep)", async () => {
    let fired = false;
    setTimeout(() => {
      fired = true;
    }, 5);
    sleepSync({ sleep: 30 });
    // still in the same synchronous execution: the timer could not have run
    assert.strictEqual(fired, false);
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(fired, true);
  });
});
