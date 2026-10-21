/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */
/* eslint-disable n/no-unsupported-features/node-builtins -- node:sqlite has no stable release in eslint-plugin-n's dataset, so no engines range can satisfy the rule; this example pins the real unflagged floor (Node >= 22.13) in its header and consciously accepts the experimental status */

/**
 * Real-life scenario: managing an SQLite database with `node:sqlite` — the
 * connection opens lazily, migrations retry through transient locks, hot
 * aggregate queries memoize, inserts are gated by invariants, and a snapshot
 * round-trips through superjson. Requires Node >= 22.13 (unflagged
 * `node:sqlite`).
 */
import { DatabaseSync } from "node:sqlite";
import {
  AssertError,
  assert,
  assertNotNil,
  withAssertSync,
} from "jutilities/assert";
import { withCacheSync } from "jutilities/cache";
import { superjson } from "jutilities/json";
import { lazy } from "jutilities/lazy";
import { withLoggerSync } from "jutilities/logger";
import { withRetrySync } from "jutilities/retry";

/** One orders-table row as read back from SQLite. */
type OrderRow = { id: number; region: string; cents: number };

/** The aggregated revenue report for one region. */
type RegionReport = { region: string; orders: number; totalCents: number };

let connectionsOpened = 0;

/** Lazily opened shared connection: `openDb()` reuses the first instance. */
const openDb = lazy(() => {
  connectionsOpened += 1;
  return new DatabaseSync(":memory:");
});

let migrationAttempts = 0;

/**
 * Schema migration that rides out two transient `SQLITE_BUSY` locks.
 * @param db - The database to migrate.
 * @returns The applied schema version.
 */
const migrate = withRetrySync((db: DatabaseSync) => {
  migrationAttempts += 1;
  if (migrationAttempts <= 2) {
    throw new Error(`SQLITE_BUSY: schema is locked (attempt ${migrationAttempts})`);
  }
  db.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, region TEXT NOT NULL, cents INTEGER NOT NULL)");
  return "orders@v1";
}, {
  onError: ({ retries, error }) => {
    console.log(`    migration attempt ${retries + 1} failed:`, (error as Error).message);
    if (retries >= 5) throw error;
  },
});

/**
 * Gated insert: the run result must report exactly one affected row.
 * @param db - Target database.
 * @param region - Order region.
 * @param cents - Order amount in cents.
 * @returns The raw run result.
 */
const insertOrder = withAssertSync((db: DatabaseSync, region: string, cents: number) => {
  return db.prepare("INSERT INTO orders (region, cents) VALUES (?, ?)").run(region, cents);
}, {
  onResult: ({ result }) => assert(Number(result.changes) === 1, "expected exactly one inserted row", "db.insertOrder"),
});

console.log("applied schema:", migrate(openDb()));
const db = openDb(); // same connection — lazy memoized

let aggregateComputations = 0;

/**
 * Expensive per-region aggregate over the orders table (memoized by region).
 * @param region - The region to aggregate.
 * @returns Order count and total cents for the region.
 */
const revenueByRegion = withCacheSync(withLoggerSync((region: string): RegionReport => {
  aggregateComputations += 1;
  const rows = db.prepare("SELECT cents FROM orders WHERE region = ?").all(region) as Array<{ cents: number }>;
  let totalCents = 0;
  for (const row of rows) totalCents += row.cents;
  return { region, orders: rows.length, totalCents };
}, { name: "db.revenueByRegion" }));

/**
 * Finds one order row or throws `AssertError` for a missing id.
 * @param id - The order id to find.
 * @returns The order row.
 */
function findOrder(id: number): OrderRow {
  const row = db.prepare("SELECT id, region, cents FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  assertNotNil(row, "order row");
  return row;
}

const demoOrders: Array<[string, number]> = [
  ["eu", 1200],
  ["eu", 900],
  ["us", 2500],
  ["us", 400],
  ["apac", 700],
];
for (const [region, cents] of demoOrders) insertOrder(db, region, cents);
console.log("seeded orders:", demoOrders.length);

console.log("eu report (first, computed):", revenueByRegion("eu"));
console.log("eu report (second, cached):", revenueByRegion("eu"));
console.log("us report:", revenueByRegion("us"));
console.log("apac report:", revenueByRegion("apac"));

console.log("order 1:", findOrder(1));
try {
  findOrder(999);
} catch (error) {
  console.log("order 999:", error instanceof AssertError ? error.message : error);
}

const reports: Array<[string, RegionReport]> = [
  ["eu", revenueByRegion("eu")],
  ["us", revenueByRegion("us")],
  ["apac", revenueByRegion("apac")],
];
const snapshot = { exportedAt: new Date(), reports: new Map(reports) };
const restored = superjson.parse<typeof snapshot>(superjson.stringify(snapshot));
console.log("snapshot round-trip:", restored.exportedAt instanceof Date, restored.reports instanceof Map);
console.log("connections opened:", connectionsOpened, "| aggregate computations:", aggregateComputations);
