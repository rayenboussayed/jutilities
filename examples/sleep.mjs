/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `sleepAsync` / `sleepSync`: the pre-aborted sync throw, a
 * mid-sleep abort resolving with `signal.reason`, and the blocking variant.
 */
import { sleepAsync, sleepSync } from "jutilities/sleep";

// ---- mid-sleep abort (resolves with the reason, does not reject) ------------
const controller = new AbortController();
const started = performance.now();
setTimeout(() => controller.abort(), 30);
const woke = await sleepAsync({ sleep: 1000, signal: controller.signal });
console.log("woke early after ~ms:", Math.round(performance.now() - started));
console.log("abort wakes you with the reason itself:", woke !== undefined);

// ---- natural expiry ----------------------------------------------------------
await sleepAsync({ sleep: 20 });
console.log("natural sleep resolves undefined: true");

// ---- pre-aborted signal throws synchronously --------------------------------
const alreadyAborted = new AbortController();
alreadyAborted.abort();
try {
  sleepAsync({ signal: alreadyAborted.signal, sleep: 1000 });
} catch (error) {
  console.log("pre-aborted sleepAsync throws sync:", error.name);
}

// ---- blocking variant --------------------------------------------------------
const blocking = performance.now();
sleepSync({ sleep: 10 }); // blocks the event loop for ~10ms
console.log("sleepSync blocked the loop ~ms:", Math.round(performance.now() - blocking));
