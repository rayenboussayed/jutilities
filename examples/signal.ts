/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `abort`: register/remove an abort listener, the no-retro-fire
 * rule for already-aborted signals, and the no-signal no-op.
 */
import { abort } from "jutilities/signal";

// ---- register + fire + remove --------------------------------------------------
const controller = new AbortController();
let fired = 0;

const remove = abort({
  onAbort: () => {
    fired += 1;
  },
  signal: controller.signal,
});

controller.abort();
console.log("listener fired on abort:", fired === 1);
remove(); // detach (already fired here)
remove(); // idempotent

// remover also removes listeners that never fired yet
const second = new AbortController();
const removeSecond = abort({ onAbort: () => {
  fired += 1;
}, signal: second.signal });
removeSecond();
second.abort();
console.log("removed listener never fired:", fired === 1);

// ---- already-aborted signals do NOT fire retroactively -------------------------
const pre = new AbortController();
pre.abort();
let fires = 0;
abort({ onAbort: () => (fires += 1), signal: pre.signal });
console.log("no retro-fire on aborted signal:", fires === 0);

// ---- missing signal is a no-op with a safe remover -----------------------------
const noopRemove = abort({ onAbort: () => (fires += 1), signal: undefined });
noopRemove();
console.log("no-signal no-op:", fires === 0);
