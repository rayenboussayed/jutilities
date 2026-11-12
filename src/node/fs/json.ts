import fs from "node:fs";
import path from "node:path";

import { clearFsCache, readTextPath } from "./cache.js";
import { ensureDirectory } from "./utils.js";

/* eslint-disable security/detect-non-literal-fs-filename */

/**
 * Reads and parses a JSON file.
 *
 * Read and parse failures are thrown. The file text is cached, but parsing
 * runs on every call so each caller receives a fresh value and custom
 * `parse` functions keep working.
 * @template T - The expected parsed shape.
 * @param root0 - Options object.
 * @param root0.filePath - Path to the JSON file.
 * @param root0.parse - parse applied to the file text (default `JSON.parse`).
 * @returns The parsed value.
 */
export async function readJsonFile<T = unknown>({
  filePath,
  parse = JSON.parse,
}: {
  filePath: string;
  parse?: typeof JSON.parse;
}): Promise<T> {
  const text = await readTextPath({ filePath });
  return parse(text);
}

/**
 * Serializes a value as JSON and writes it to disk.
 *
 * The parent directory is created when missing. Throws when the value is not
 * JSON-serializable (for example `undefined`, a function, or a symbol) or when
 * the write itself fails. Cached filesystem facts are invalidated, including
 * after a failure.
 * @param root0 - Options object.
 * @param root0.filePath - Destination path.
 * @param root0.value - Value to serialize.
 * @param root0.stringify - Serializer applied to the value (default
 * `JSON.stringify`).
 * @returns Resolves once the file is written.
 */
export async function writeJsonFile({
  filePath,
  stringify = JSON.stringify,
  value,
}: {
  filePath: string;
  stringify?: typeof JSON.stringify;
  value: unknown;
}) {
  try {
    await ensureDirectory({ directory: path.dirname(filePath) });
    await fs.promises.writeFile(filePath, stringify(value));
  } finally {
    clearFsCache();
  }
}
