/**
 * Removes the previous `dist/` so stale files of deleted sources are never
 * shipped. Runs automatically before `npm run build` via `prebuild`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
fs.rmSync(path.join(root, "dist"), { force: true, recursive: true });
