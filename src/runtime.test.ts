import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("runtime", () => {
  it("reports the server on node and guards browserFn", async () => {
    const {
      browserFn,
      isBrowser,
      isBrowserWorker,
      isServer,
      isServerWorker,
      serverFn,
    } = await import("./runtime.js");
    const fn = () => "call";

    expect(isServer).toBe(true);
    expect(isBrowser).toBe(false);
    expect(isBrowserWorker).toBe(false);
    expect(isServerWorker).toBe(false);
    expect(serverFn(fn)).toBe(fn);
    expect(browserFn(fn)).toBeUndefined();
  });

  it("reports the browser when window exists and guards serverFn", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const {
      browserFn,
      isBrowser,
      isBrowserWorker,
      isServer,
      isServerWorker,
      serverFn,
    } = await import("./runtime.js");
    const fn = () => "call";

    expect(isServer).toBe(false);
    expect(isBrowser).toBe(true);
    expect(isBrowserWorker).toBe(false);
    expect(isServerWorker).toBe(false);
    expect(browserFn(fn)).toBe(fn);
    expect(serverFn(fn)).toBeUndefined();
  });

  it("detects a browser worker scope (window absent, self scope, importScripts)", async () => {
    vi.stubGlobal("self", globalThis);
    vi.stubGlobal("importScripts", () => undefined);
    vi.resetModules();
    const { isBrowserWorker, isServer, isServerWorker } = await import(
      "./runtime.js"
    );

    expect(isServer).toBe(true);
    expect(isBrowserWorker).toBe(true);
    expect(isServerWorker).toBe(false);
  });

  it("is not a browser worker when self is not the global scope", async () => {
    vi.stubGlobal("self", {});
    vi.stubGlobal("importScripts", () => undefined);
    vi.resetModules();
    const { isBrowserWorker } = await import("./runtime.js");

    expect(isBrowserWorker).toBe(false);
  });

  it("is not a browser worker when importScripts is missing", async () => {
    vi.stubGlobal("self", globalThis);
    vi.resetModules();
    const { isBrowserWorker } = await import("./runtime.js");

    expect(isBrowserWorker).toBe(false);
  });

  it("reports no server worker when process is missing", async () => {
    vi.stubGlobal("process", undefined);
    vi.resetModules();
    const { isServerWorker } = await import("./runtime.js");

    expect(isServerWorker).toBe(false);
  });

  it("reports no server worker when getBuiltinModule is unavailable", async () => {
    vi.stubGlobal("process", {});
    vi.resetModules();
    const { isServerWorker } = await import("./runtime.js");

    expect(isServerWorker).toBe(false);
  });

  it("reports no server worker on the main thread", async () => {
    vi.stubGlobal("process", {
      getBuiltinModule: () => ({ isMainThread: true }),
    });
    vi.resetModules();
    const { isServerWorker } = await import("./runtime.js");

    expect(isServerWorker).toBe(false);
  });

  it("detects a Node worker thread via worker_threads", async () => {
    vi.stubGlobal("process", {
      getBuiltinModule: () => ({ isMainThread: false }),
    });
    vi.resetModules();
    const { isServerWorker } = await import("./runtime.js");

    expect(isServerWorker).toBe(true);
  });

  it("supports static boolean conditions", async () => {
    const { createConditionalFn } = await import("./runtime.js");
    const fn = () => "call";

    expect(createConditionalFn(true)(fn)).toBe(fn);
    expect(createConditionalFn(false)(fn)).toBeUndefined();
  });

  it("evaluates thunk conditions once per call", async () => {
    const { createConditionalFn } = await import("./runtime.js");
    const fn = () => "call";
    let enabled = true;
    const condition = vi.fn(() => enabled);
    const conditional = createConditionalFn(condition);

    expect(conditional(fn)).toBe(fn);
    enabled = false;
    expect(conditional(fn)).toBeUndefined();
    expect(condition).toHaveBeenCalledTimes(2);
  });
});
