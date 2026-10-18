/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `sleepAsync` / `sleepSync`: a mid-sleep abort rejecting with
 * `signal.reason`, the pre-aborted sync throw, and the blocking variant.
 */
import { sleepAsync, sleepSync } from "jutilities/sleep";

// ---- mid-sleep abort (rejects with the reason) --------------------------------
const controller = new AbortController();
const started = performance.now();
setTimeout(() => controller.abort(), 30);
try {
  await sleepAsync({ sleep: 1000, signal: controller.signal });
} catch (reason) {
  console.log("woke early after ~ms:", Math.round(performance.now() - started));
  console.log("abort rejects with the reason itself:", (reason as Error).name === "AbortError");
}

// ---- natural expiry ----------------------------------------------------------
await sleepAsync({ sleep: 20 });
console.log("natural sleep resolves undefined: true");

// ---- pre-aborted signal throws synchronously --------------------------------
const alreadyAborted = new AbortController();
alreadyAborted.abort();
try {
  sleepAsync({ signal: alreadyAborted.signal, sleep: 1000 });
} catch (error) {
  console.log("pre-aborted sleepAsync throws sync:", (error as Error).name);
}

// ---- blocking variant --------------------------------------------------------
const blocking = performance.now();
sleepSync({ sleep: 10 }); // blocks the event loop for ~10ms
console.log("sleepSync blocked the loop ~ms:", Math.round(performance.now() - blocking));
