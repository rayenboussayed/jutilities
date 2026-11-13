import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("runtime", () => {
  it("reports the server on node and guards clientFn", async () => {
    const { clientFn, isClient, isServer, serverFn } = await import(
      "./runtime.js"
    );
    const fn = () => "call";

    expect(isServer).toBe(true);
    expect(isClient).toBe(false);
    expect(serverFn(fn)).toBe(fn);
    expect(clientFn(fn)).toBeUndefined();
  });

  it("reports the client when window exists and guards serverFn", async () => {
    vi.stubGlobal("window", {});
    vi.resetModules();
    const { clientFn, isClient, isServer, serverFn } = await import(
      "./runtime.js"
    );
    const fn = () => "call";

    expect(isServer).toBe(false);
    expect(isClient).toBe(true);
    expect(clientFn(fn)).toBe(fn);
    expect(serverFn(fn)).toBeUndefined();
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
