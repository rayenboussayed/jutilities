/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Real-life scenario: file management with `node:fs` — a flaky disk write is
 * retried, readiness is polled against a deadline, one stream is teed to disk
 * and memory with hash verification, and a directory scan cancels itself
 * through an AbortSignal. Everything lives in a temp workspace removed at the
 * end.
 */
import { createWriteStream, existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { djb2, sdbm } from "jutilities/hash";
import { stream2buffer, tee } from "jutilities/node-stream";
import { withRetrySync } from "jutilities/retry";
import { sleepAsync } from "jutilities/sleep";
import { abort } from "jutilities/signal";

let writeAttempts = 0;

/**
 * Config writer that rides out two simulated `EBUSY` locks before succeeding.
 * @param path - The config file to write.
 * @param content - The config content to write.
 * @returns The attempt number that finally succeeded.
 */
const persistConfig = withRetrySync((path: string, content: string) => {
  writeAttempts += 1;
  if (writeAttempts <= 2) {
    throw Object.assign(new Error(`EBUSY: resource busy or locked (attempt ${writeAttempts})`), { code: "EBUSY" });
  }
  writeFileSync(path, content, "utf8");
  return writeAttempts;
}, ({ retries, error }) => {
  console.log(`    write attempt ${retries + 1} failed:`, (error as Error).message);
  if (retries >= 4) throw error;
});

/**
 * Polls until a file shows up, bounded by an abort signal deadline.
 * @param path - The file to wait for.
 * @param signal - Deadline signal; rejects with `signal.reason` when it fires.
 */
async function waitForFile(path: string, signal: AbortSignal): Promise<void> {
  while (!existsSync(path)) {
    await sleepAsync({ signal, sleep: 25 });
  }
}

/** Cancellation controller for the directory scan below. */
const stop = new AbortController();
abort({ signal: stop.signal, onAbort: () => console.log("    (scan: abort handler fired)") });

/**
 * Lists directory entries until a quarantined name appears, then cancels the
 * scan through its signal.
 * @param dir - The directory to scan.
 * @param signal - The scan's cancellation signal.
 * @returns The names inspected before cancellation.
 */
async function scanFiles(dir: string, signal: AbortSignal): Promise<string[]> {
  const inspected: string[] = [];
  for (const entry of await readdir(dir)) {
    signal.throwIfAborted();
    inspected.push(entry);
    if (entry.startsWith("quarantine")) {
      stop.abort(new Error(`quarantined file: ${entry}`));
      signal.throwIfAborted(); // cancel immediately
    }
  }
  return inspected;
}

const workspace = await mkdtemp(join(tmpdir(), "jutilities-fs-"));
console.log("workspace:", workspace);

try {
  // ---- flaky write, retried ---------------------------------------------------
  const configPath = join(workspace, "app.config");
  const attempts = persistConfig(configPath, "port=8080\nretries=3\n");
  console.log("config written on attempt:", attempts);

  // ---- wait for a readiness file created by a "concurrent" writer -------------
  const readyPath = join(workspace, "worker.ready");
  const writerDone = writeFile(readyPath, "ok", "utf8")
    .then(() => console.log("    (writer: readiness file created)"));
  await waitForFile(readyPath, AbortSignal.timeout(2000));
  await writerDone;
  console.log("worker is ready");

  // ---- one stream, two destinations: disk + memory, verified by hash ----------
  const config = await readFile(configPath, "utf8");
  const [disk, memory] = tee({ source: Readable.from([Buffer.from(config, "utf8")]) });
  const memoryCopy = stream2buffer(memory);
  await pipeline(disk, createWriteStream(join(workspace, "app.copy")));
  const diskCopy = await readFile(join(workspace, "app.copy"), "utf8");
  const memoryText = (await memoryCopy).toString("utf8");
  const match = djb2(config) === djb2(diskCopy) && djb2(config) === djb2(memoryText);
  console.log("checksums djb2 (original/disk/memory):", djb2(config), djb2(diskCopy), djb2(memoryText), "match:", match);
  console.log("checksum sdbm (second opinion):", sdbm(config));

  // ---- self-cancelling scan ---------------------------------------------------
  const docsPath = join(workspace, "docs");
  await mkdir(docsPath, { recursive: true });
  await writeFile(join(docsPath, "notes.txt"), "fine", "utf8");
  await writeFile(join(docsPath, "quarantine-me.txt"), "suspicious", "utf8");

  try {
    const inspected = await scanFiles(docsPath, stop.signal);
    console.log("scan finished:", inspected); // never reached in this demo
  } catch (error) {
    console.log("scan cancelled:", error instanceof Error ? error.message : error);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
  console.log("workspace removed:", !existsSync(workspace));
}
