/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

/**
 * Runs every example in this directory — the flat module demos, the Stage 3
 * decorator demos in `decorators/`, and the multi-module real-life scenarios
 * in `real-life/` — as its own Node process and reports pass/fail; sets a
 * non-zero `process.exitCode` when one fails.
 *
 * Examples are TypeScript, and the decorator demos additionally rely on Stage 3
 * decorator syntax that plain Node cannot parse, so every child starts through
 * tsx (`node --import tsx <file>`); the runner itself needs the same loader,
 * which is why `npm run examples` invokes it the same way.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Discovers the runnable demo scripts: every `.ts` next to this runner except
 * itself, plus every `.ts` in the `decorators/` and `real-life/` subfolders,
 * sorted for deterministic output.
 * @returns The demo paths relative to `examples/`, sorted.
 */
function listExamples(): string[] {
  const flat = readdirSync(here)
    .filter((name) => name.endsWith(".ts") && name !== "run-all.ts")
    .sort();
  const inFolder = (folder: string) =>
    readdirSync(join(here, folder))
      .filter((name) => name.endsWith(".ts"))
      .sort()
      .map((name) => join(folder, name));
  return [...flat, ...inFolder("decorators"), ...inFolder("real-life")];
}

/**
 * Spawns one example as its own process, inheriting stdio for visibility.
 * @param name - The example path inside `examples/` (may enter a subfolder).
 * @returns The process exit code (`1` when the child never reported one).
 */
function runExample(name: string): Promise<number> {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", join(here, name)],
    { stdio: "inherit" },
  );
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
