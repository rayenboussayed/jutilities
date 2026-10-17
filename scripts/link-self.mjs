/**
 * Wires this repository checkout to its own package manifest so the examples
 * can self-import through the canonical `jutilities/<module>` subpath style
 * while running from inside the repository. Runs as part of `npm install` via
 * the `prepare` hook — npm executes it with the package root as the working
 * directory, which this script relies on — and is a no-op when the link
 * already exists. Published packages resolve their own examples through the
 * consumer's `node_modules` and never need this shim.
 */
import { existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const nodeModulesDir = join(process.cwd(), "node_modules");
const shim = join(nodeModulesDir, "jutilities");

// A working link (from a previous `prepare` run or a manual `npm link`) makes
// this a no-op; a broken leftover link is recreated instead of failing.
if (!existsSync(shim)) {
  mkdirSync(nodeModulesDir, { recursive: true });
  try {
    symlinkSync(".", shim, "junction");
  } catch (error) {
    if (error.code === "EEXIST") {
      unlinkSync(shim);
      symlinkSync(".", shim, "junction");
    } else {
      throw error;
    }
  }
}
