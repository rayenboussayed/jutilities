import fs from "node:fs";

/**
 * Reads and parses a JSON file.
 *
 * Read and parse failures are thrown. Each call reads and parses the file, so
 * callers receive independent values and custom `parse` functions keep
 * working.
 * @template T - The expected parsed shape.
 * @param root0 - Options object.
 * @param root0.filePath - Path to the JSON file.
 * @param root0.parse - parse applied to the file text (default `JSON.parse`).
 * @returns The parsed value.
 */
export function readJsonFile<T = unknown>({
  filePath,
  parse = JSON.parse,
}: {
  filePath: string;
  parse?: typeof JSON.parse;
}) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.promises.readFile(filePath, "utf-8").then<T>(parse);
}

/**
 * Serializes a value as JSON and writes it to disk.
 *
 * The parent directory must already exist. Throws when the value is not
 * JSON-serializable (for example `undefined`, a function, or a symbol) or when
 * the write itself fails.
 * @param root0 - Options object.
 * @param root0.filePath - Destination path.
 * @param root0.value - Value to serialize.
 * @param root0.stringify - Serializer applied to the value (default
 * `JSON.stringify`).
 * @returns Resolves once the file is written.
 */
export function writeJsonFile({
  filePath,
  stringify = JSON.stringify,
  value,
}: {
  filePath: string;
  stringify?: typeof JSON.stringify;
  value: unknown;
}) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.promises.writeFile(filePath, stringify(value));
}
