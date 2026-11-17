/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * Regenerates `docs/` after `tsc`: runs mdaics over `src/`, removes the test
 * pages mdaics writes there, and rebuilds `docs/README.md`.
 *
 * mdaics has no ignore facility, and colocated `src/**\/*.test.ts` files are
 * not docs input: jsdoc crashes on `BigInt` literals in test sources, and
 * test helpers carry only inner-scope JSDoc, which mdaics reports as a
 * "single default export needs `@module`" failure. Failures attributed to
 * test files are therefore downgraded to warnings here; any failure in a
 * non-test file still fails the build.
 *
 * `"parallelism": false` pins sequential execution: the default pool spawns
 * one jsdoc child per core, which intermittently kills a single, random
 * file's render (observed on unchanged inputs). The sequential run takes
 * about 20s, on par with the previous generator, and is deterministic.
 */
import { run } from "mdaics";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const outRoot = path.join(root, "docs");

const result = await run({ cwd: root, parallelism: false });
for (const warning of result.warnings) console.warn(`note ${warning}`);
for (const issue of result.issues) {
  if (!issue.file.endsWith(".test.ts")) console.warn(`note ${issue.file}: ${issue.issue}`);
}
const nonTestFailures = result.failed.filter((failure) => !failure.file.endsWith(".test.ts"));
if (nonTestFailures.length > 0) {
  for (const failure of nonTestFailures) console.error(`error ${failure.file}: ${failure.error}`);
  throw new Error("mdaics failed; see the output above.");
}
console.log(
  `mdaics: ${result.written.length} doc(s) written, ${result.skipped.length} skipped, ` +
  `${result.failed.length} failed (${(result.durationMs / 1000).toFixed(2)}s)`,
);
if (result.failed.length > 0)
  console.warn(`mdaics reported ${result.failed.length} failure line(s), all confined to test files; continuing.`);

/**
 * Recursively removes every `*.test.md` page below `dir`.
 * @param {string} dir - Directory to clean.
 * @returns {number} The number of pages removed.
 */
function removeTestPages(dir) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) removed += removeTestPages(full);
    else if (entry.name.endsWith(".test.md")) {
      fs.rmSync(full, { force: true });
      removed += 1;
    }
  }
  return removed;
}
const removed = removeTestPages(outRoot);
if (removed > 0) console.log(`Removed ${removed} test page(s) from docs/`);

/**
 * First sentence of a free-text block.
 * @param {string} text - The text to condense.
 * @returns {string} The first sentence of the first non-empty line.
 */
function firstSentence(text) {
  const line = stripLinks(text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!line) return "—";
  const sentence = /^[^\n.!?]{1,400}[.!?]/.exec(line)?.[0] ?? line;
  return sentence.trim();
}

/**
 * Recursively collects every generated page below `dir`, except the index.
 * @param {string} dir - Directory to walk.
 * @returns {string[]} Absolute page paths.
 */
function listPages(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pages.push(...listPages(full));
    else if (entry.name.endsWith(".md") && entry.name !== "README.md") pages.push(full);
  }
  return pages;
}

/**
 * The module's own file-level JSDoc summary, when it exists.
 * @param {string} modulePath - The module's subpath (`json`).
 * @returns {string | undefined} The first sentence, or `undefined` when absent.
 */
function moduleSummary(modulePath) {
  const file = path.join(srcRoot, `${modulePath}.ts`);
  if (!fs.existsSync(file)) return undefined;
  const src = fs.readFileSync(file, "utf8");
  // eslint-disable-next-line sonarjs/super-linear-regex -- lazy `[\s\S]*?` stops at the first `*/`
  const block = /^\s*\/\*\*[\s\S]*?\*\//m.exec(src);
  if (!block) return undefined;
  const inner = block[0].replace(/^\s*\/\*\*/, "").replace(/\*\/\s*$/, "");
  const text = inner
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .filter((line) => line.length > 0)
    .join(" ");
  return firstSentence(text);
}

/**
 * Strips `{@link ...}` tags down to the link target.
 * @param {string} text - Raw JSDoc text.
 * @returns {string} The text with link tags replaced by their target name.
 */
function stripLinks(text) {
  return text.replace(/\{@link[^}]*\}/g, (match) => {
    const body = match.slice(6, -1).trim();
    return body.split(/\s/)[0].split("|")[0];
  });
}

const REPO_URL = "https://github.com/rayenboussayed/jutilities";
const modules = listPages(outRoot)
  .map((page) => path.relative(outRoot, page).split(path.sep).join("/").replace(/\.md$/, ""))
  .sort();
for (const modulePath of modules) {
  const srcPath = `src/${modulePath}.ts`;
  const repoLink = `${REPO_URL}/blob/main/${srcPath}`;
  const header = [
    `# \`jutilities/${modulePath}\``,
    "",
    `<!-- This file is generated. Do not edit by hand — change the JSDoc in [\`${srcPath}\`](${repoLink}) and run \`npm run build\` instead. -->`,
    "",
    `> Generated by [mdaics](https://github.com/rayenboussayed/mdaics) from [\`${srcPath}\`](${repoLink}). Behavior contracts and quirks are pinned by the tests.`,
    "",
    "",
  ].join("\n");
  const page = path.join(outRoot, `${modulePath}.md`);
  fs.writeFileSync(page, header + fs.readFileSync(page, "utf8"));
}

const lines = [
  "# jutilities — auto-generated API reference",
  "",
  "One page per module, generated from the JSDoc in the source. Regenerate with",
  "`npm run build` after changing the JSDoc — these files must never be edited by hand.",
  "",
  "Per-module quirks and runtime caveats live next to the code: the README's module table",
  "and [known-quirks section](../README.md#known-quirks-documented-intentional), plus the",
  "executable behavior contracts in `src/**/*.test.ts`. The exports below are the complete",
  "public surface.",
  "",
  "## Modules",
  "",
];
for (const modulePath of modules)
  lines.push(`- [jutilities/${modulePath}](./${modulePath}.md) — ${moduleSummary(modulePath) ?? "—"}`);
lines.push("");
fs.writeFileSync(path.join(outRoot, "README.md"), lines.join("\n"));
console.log(`Generated index for ${modules.length} module docs in docs/`);
