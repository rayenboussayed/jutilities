/* eslint-disable security/detect-non-literal-fs-filename */
import jsdoc2md from "jsdoc-to-markdown";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const distRoot = path.join(root, "dist");
const outRoot = path.join(root, "docs");
const repoUrl = "https://github.com/rayenboussayed/jutilities";

/**
 * Collects the exported names declared in a `.d.ts` file, in declaration order.
 * @param {string} dts - The declaration source.
 * @returns {{ types: string[], values: string[] }} The type and value export names.
 */
function exportsOf(dts) {
  const values = [];
  const types = [];
  const push = (list) => (name) => {
    if (!list.includes(name)) list.push(name);
  };
  // eslint-disable-next-line security/detect-unsafe-regex -- declarations are short and well-formed; no nested quantifiers
  for (const match of dts.matchAll(/export\s+declare\s+(?:async\s+)?(?:function|class|const|let|var)\s+\w+/g))
    push(values)(/\w+$/.exec(match[0])?.[0] ?? ""); // eslint-disable-line sonarjs/super-linear-regex -- anchored at the end, linear
  for (const match of dts.matchAll(/export\s+(?:type|interface)\s+\w+/g))
    push(types)(/\w+$/.exec(match[0])?.[0] ?? ""); // eslint-disable-line sonarjs/super-linear-regex -- anchored at the end, linear
  for (const match of dts.matchAll(/export\s*\{([^}]+)\}/g))
    for (const part of match[1].split(",")) {
      const name = part.split(/\s+as\s+/).at(-1).trim().split(/\s/)[0]; // eslint-disable-line sonarjs/super-linear-regex -- short keyword, linear
      if (name && !types.includes(name) && !values.includes(name)) values.push(name);
    }
  return { types, values };
}

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
 * Auto-generated header for one module's page.
 * @param {string} modulePath - The module's subpath (`node/fs/file`).
 * @returns {string} The header Markdown.
 */
function headerOf(modulePath) {
  const srcPath = `src/${modulePath}.ts`;
  const lines = [
    `# \`jutilities/${modulePath}\``,
    "",
    `<!-- This file is generated. Do not edit by hand — change the JSDoc in [\`${srcPath}\`](${repoUrl}/blob/main/${srcPath}) and run \`npm run build\` instead. -->`,
    "",
    `> Generated with [jsdoc-to-markdown](https://github.com/jsdoc2md/jsdoc-to-markdown/tree/master/docs/API.md) from the JSDoc in [\`${srcPath}\`](${repoUrl}/blob/main/${srcPath}). Behavior contracts and quirks are pinned by the tests.`,
    "",
  ];
  const dts = path.join(distRoot, `${modulePath}.d.ts`);
  if (fs.existsSync(dts)) {
    const { types, values } = exportsOf(fs.readFileSync(dts, "utf8"));
    lines.push("```ts");
    if (values.length > 0) lines.push(`import { ${values.join(", ")} } from "jutilities/${modulePath}";`);
    if (types.length > 0) lines.push(`import type { ${types.join(", ")} } from "jutilities/${modulePath}";`);
    if (lines.at(-1) === "```ts") lines.push(`import "jutilities/${modulePath}";`);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Recursively lists every compiled `.js` file below `dir`.
 * @param {string} dir - Directory to walk.
 * @returns {string[]} Absolute file paths, sorted for stable output.
 */
function listJs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJs(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files.sort();
}

/**
 * The module's subpath, relative to the package root (`node/fs/file`).
 * @param {string} file - Absolute path of the compiled file inside `dist/`.
 * @returns {string} The POSIX subpath without its `.js` extension.
 */
function modulePathOf(file) {
  return path.relative(distRoot, file).split(path.sep).join("/").replace(/\.js$/, "");
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
 * Normalizes the doclets jsdoc-parse produces for ES-module classes.
 * @param {object[]} data - The raw template data.
 */
function normalize(data) {
  for (const doclet of data) {
    if (doclet.kind === "class" && doclet.memberof === doclet.name) delete doclet.memberof;
    if (doclet.kind === "constructor") doclet.name = doclet.memberof;
  }
}

/**
 * Renders one module's page, or returns `undefined` for type-only modules.
 * @param {string} modulePath - The module's subpath (`json`).
 * @returns {{ markdown: string, summary: string } | undefined} The page, or `undefined` to skip.
 */
async function renderModule(modulePath) {
  const file = path.join(distRoot, `${modulePath}.js`);
  const source = fs.readFileSync(file, "utf8");
  const data = await jsdoc2md.getTemplateData({ "no-cache": true, source });
  normalize(data);

  const dts = path.join(distRoot, `${modulePath}.d.ts`);
  const { types, values } = exportsOf(fs.readFileSync(dts, "utf8"));
  const exported = new Set([...types, ...values]);
  const doclets = data.filter((doclet) =>
    doclet.memberof ? exported.has(doclet.memberof) : exported.has(doclet.name),
  );
  if (doclets.length === 0) return undefined;

  const rendered = await jsdoc2md.render({
    data: doclets,
    headingDepth: 3,
    "no-cache": true,
    separators: true,
  });
  const summary = moduleSummary(modulePath) ?? summaryOf(doclets);
  return { markdown: `${headerOf(modulePath)}${rendered}\n`, summary };
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

/**
 * The first doclet description for a module, used when no file-level JSDoc exists.
 * @param {object[]} doclets - The kept doclets, in declaration order.
 * @returns {string} The summary.
 */
function summaryOf(doclets) {
  const doclet = doclets.find((entry) => entry.kind === "class") ?? doclets[0];
  return firstSentence(doclet?.description);
}

const modules = listJs(distRoot).map(modulePathOf).filter((name) => !name.startsWith("__"));
const entries = [];
fs.rmSync(outRoot, { force: true, recursive: true });
for (const modulePath of modules) {
  const page = await renderModule(modulePath);
  if (!page) continue;
  const file = path.join(outRoot, `${modulePath}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, page.markdown);
  entries.push({ modulePath, summary: page.summary });
}

const indexLines = [
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
for (const { modulePath, summary } of entries)
  indexLines.push(`- [jutilities/${modulePath}](./${modulePath}.md) — ${summary}`);
indexLines.push("");
fs.writeFileSync(path.join(outRoot, "README.md"), indexLines.join("\n"));

console.log(`Generated ${entries.length} module docs in ${path.relative(root, outRoot)}`);
for (const { modulePath } of entries) console.log(`  ${modulePath}`);
