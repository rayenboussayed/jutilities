/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `toBase64` / `toArray` and their `fromBase64` counterpart
 * (round-trips, viewed-slice handling, and reference semantics).
 */
import { toBase64, toArray } from "../dist/to.js";
import { fromBase64 } from "../dist/from.js";

// ---- toBase64 / fromBase64 round-trip ----------------------------------------
const payload = new TextEncoder().encode("jutilities");
const b64 = toBase64(payload);
const decoded = fromBase64(b64);
console.log("b64:", b64);
console.log("round-trip:", Buffer.from(decoded).toString() === "jutilities");

// ---- only the viewed slice is encoded ----------------------------------------
const windowed = Uint8Array.from([0, 0, 1, 2, 3, 0, 0]).subarray(2, 5);
console.log("windowed slice encoded:", toBase64(windowed)); // AQID (1,2,3)

// ---- toArray: arrays pass through by reference, scalars get wrapped ----------
const arr = [1, 2, 3];
console.log("array identity kept:", toArray(arr) === arr);
console.log("scalar wrapped:", toArray(42).length === 1 && toArray(42)[0] === 42);
console.log("null wrapped:", toArray(null)); // [null]
