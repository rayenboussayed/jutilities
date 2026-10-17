/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Demonstrates `fromBase64`: the lenient Node behavior against the strict
 * browser `atob` branch, plus empty-input handling.
 */
import { fromBase64 } from "../dist/from.js";
import { toBase64 } from "../dist/to.js";

// ---- Node branch: lenient, invalid characters skipped -------------------------
console.log("valid decode:", Buffer.from(fromBase64("aGVsbG8=")).toString());
console.log("lenient decode:", Buffer.from(fromBase64("aGV s bG8=")).toString()); // "hello"

// ---- empty input --------------------------------------------------------------
console.log("empty input -> empty buffer:", fromBase64("").length === 0);

// ---- round-trip with toBase64 -------------------------------------------------
const bytes = Uint8Array.from([255, 0, 127]);
console.log("round-trip identity:", toBase64(fromBase64(toBase64(bytes))) === toBase64(bytes));
