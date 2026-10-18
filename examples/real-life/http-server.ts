/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Real-life scenario: a miniature HTTP API on `node:http` whose handlers are
 * hardened with jutilities wrappers — result gating, per-route caching,
 * retries with backoff, a wall-clock deadline, and superjson round-trips.
 */
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  AssertError,
  assert,
  assertNotNil,
  withAssertAsync,
} from "jutilities/assert";
import { withCacheAsync } from "jutilities/cache";
import { superjson } from "jutilities/json";
import { isRecord } from "jutilities/is";
import { withLogger } from "jutilities/logger";
import { stream2buffer } from "jutilities/node-stream";
import { withRetryAsync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";
import { withTimeoutAsync } from "jutilities/timeout";

/** A minimal user record served by the API. */
type User = { id: number; name: string; email: string };

/** In-memory "database" backing the `/users/:id` route. */
const users = new Map<number, User>([
  [1, { id: 1, name: "Ada", email: "ada@example.com" }],
]);

let upstreamAttempts = 0;

/**
 * Flaky third-party call that fails its first two attempts, then succeeds.
 * @returns The eventual upstream payload.
 */
async function fetchUpstream(): Promise<string> {
  upstreamAttempts += 1;
  if (upstreamAttempts <= 2) {
    throw new Error(`upstream 503 (attempt ${upstreamAttempts})`);
  }
  return "upstream payload";
}

const resilientFetch = withRetryAsync(fetchUpstream, async ({ retries, error }) => {
  console.log(`    upstream attempt ${retries + 1} failed:`, (error as Error).message);
  if (retries >= 4) throw error; // give up -> error becomes the rejection
  await sleepAsync({ sleep: 40 }); // backoff between attempts
});

/**
 * Simulated user lookup with database-like latency.
 * @param id - The user id to find.
 * @returns The user, or `undefined` when absent.
 */
async function findUser(id: number): Promise<User | undefined> {
  await sleepAsync({ sleep: 10 });
  return users.get(id);
}

/** Lookup whose results are gated: a `nil` row throws `AssertError` -> 404. */
const findUserGated = withAssertAsync(
  withLogger("db.findUser", findUser),
  ({ result }) => assertNotNil(result, "user row"),
);

let reportComputations = 0;

/**
 * Expensive per-region aggregation (simulated with a 60ms pass).
 * @param region - The region to aggregate.
 * @returns The aggregated report row.
 */
async function buildReport(region: string): Promise<{ region: string; orders: number; cents: number }> {
  reportComputations += 1;
  await sleepAsync({ sleep: 60 });
  return { region, orders: 3, cents: 4_200 };
}

/** Cached + logged report handler: the second call is a cache hit. */
const report = withCacheAsync(withLogger("analytics.buildReport", buildReport));

/** Handler that always overshoots its 80ms deadline. */
const slow = withTimeoutAsync(async () => {
  await sleepAsync({ sleep: 500 });
  return "too late";
}, { timeoutMs: 80 });

/**
 * Renders a route error for a response body (the timeout wrapper rejects with
 * `signal?.reason`, i.e. `undefined` when no signal is wired).
 * @param error - The caught route error.
 * @returns A readable one-line description.
 */
function renderError(error: unknown): string {
  return error instanceof Error ? error.message : "request deadline exceeded";
}

/**
 * Routes one request; every handler failure funnels through the bottom catch.
 * @param req - The incoming request.
 * @param res - The response to write.
 */
async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "unknown-host"}`);
  const send = (status: number, payload: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(superjson.stringify(payload));
  };
  try {
    if (url.pathname.startsWith("/users/")) {
      const id = Number(url.pathname.slice("/users/".length));
      assert(Number.isInteger(id) && id > 0, "user id must be a positive integer", "router");
      send(200, await findUserGated(id));
      return;
    }
    if (url.pathname === "/report") {
      send(200, await report(url.searchParams.get("region") ?? "global"));
      return;
    }
    if (url.pathname === "/flaky") {
      send(200, { upstream: await resilientFetch() });
      return;
    }
    if (url.pathname === "/slow") {
      try {
        send(200, { slow: await slow() });
      } catch (error) {
        console.log("    slow handler rejected:", renderError(error));
        send(504, { error: "gateway deadline exceeded" });
      }
      return;
    }
    if (url.pathname === "/echo" && req.method === "POST") {
      const payload = superjson.parse<unknown>((await stream2buffer(req)).toString("utf8"));
      assert(isRecord(payload), "echo payload must be a JSON object", "router");
      send(200, payload);
      return;
    }
    send(404, { error: `no route for ${url.pathname}` });
  } catch (error) {
    send(error instanceof AssertError ? 404 : 500, { error: renderError(error) });
  }
}

/**
 * Starts the server on an ephemeral loopback port.
 * @param server - The server to start.
 * @returns The bound port.
 */
function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address !== null) resolve(address.port);
      else reject(new Error("server did not report a port"));
    });
  });
}

/**
 * Stops the server and force-closes lingering keep-alive sockets so the demo
 * process can exit.
 * @param server - The running server.
 * @returns Resolves once the server reported close.
 */
async function shutdown(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

const server = createServer((req, res) => {
  void dispatch(req, res);
});

try {
  const base = `http://127.0.0.1:${await listen(server)}`;
  console.log(`api listening on ${base}`);

  /**
   * Performs one request against the demo API and prints the outcome.
   * @param label - Printed row label.
   * @param path - Request path (with query).
   * @param init - Optional fetch init (method/body).
   */
  const show = async (label: string, path: string, init?: RequestInit) => {
    const res = await fetch(base + path, init);
    console.log(label, "->", res.status, await res.text());
  };

  await show("GET   /users/1", "/users/1");
  await show("GET   /users/2 (missing -> gated)", "/users/2");
  await show("GET   /report (first, computed)", "/report?region=eu");
  await show("GET   /report (second, cached)", "/report?region=eu");
  await show("GET   /flaky (retried)", "/flaky");
  await show("GET   /slow (deadline)", "/slow");
  await show("POST  /echo", "/echo", {
    method: "POST",
    body: superjson.stringify({ at: new Date(0), tags: new Set(["core"]), n: 42n }),
  });

  const echoed = await fetch(`${base}/echo`, {
    method: "POST",
    body: superjson.stringify({ at: new Date(0), tags: new Set(["core"]), n: 42n }),
  });
  const back = superjson.parse<{ at: Date; tags: Set<string>; n: bigint }>(await echoed.text());
  console.log("echo round-trip restored:", back.at instanceof Date, back.tags instanceof Set, typeof back.n === "bigint");
  console.log("report computations:", reportComputations, "(1 computation -> cached)");
} finally {
  await shutdown(server);
  console.log("api shut down cleanly");
}
