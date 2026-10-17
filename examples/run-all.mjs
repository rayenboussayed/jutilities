/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runs every standalone example in this directory in its own Node process and
 * reports pass/fail; sets a non-zero `process.exitCode` when one fails.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Discovers the runnable example scripts (every `.mjs` that is not this
 * runner), sorted for deterministic output.
 * @returns {string[]} The example file names, sorted.
 */
function listExamples() {
  return readdirSync(here)
    .filter((name) => name.endsWith(".mjs") && name !== "run-all.mjs")
    .sort();
}

/**
 * Spawns one example as its own process, inheriting stdio for visibility.
 * @param {string} name - The example file name inside `examples/`.
 * @returns {Promise<number>} The process exit code (`1` when the child never
 * reported one).
 */
function runExample(name) {
  const child = spawn(process.execPath, [join(here, name)], { stdio: "inherit" });
  return new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const examples = listExamples();
let failures = 0;

for (const example of examples) {
  console.log(`--- running ${example}`);
  const code = await runExample(example);
  if (code !== 0) {
    failures += 1;
    console.log(`    failed with exit code ${code}`);
  }
}

console.log(failures === 0
  ? `All ${examples.length} examples ran successfully.`
  : `${failures} of ${examples.length} examples failed.`);
process.exitCode = failures > 0 ? 1 : 0;
