/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

import {
  copyDirectory,
  createTempDirectory,
  directoryFiles,
  directoryMetadata,
  directorySize,
  directoryTree,
  emptyDirectory,
  ensureDirectory,
  moveDirectory,
} from "jutilities/node/fs/dir";
import { removeFiles } from "jutilities/node/fs/file";
import { readJsonFile, writeJsonFile } from "jutilities/node/fs/json";
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
/**
 * Demonstrates the Node filesystem helpers: directory creation, JSON sidecars,
 * safe multi-file cleanup, recursive scans, and directory copy/move/empty
 * operations. Everything lives in a temp workspace. JSON reads always hit the
 * disk, so an external write is visible immediately.
 */

const directory = await createTempDirectory();
const nested = join(directory, "nested");
const metaPath = join(nested, "meta.json");
const secondPath = join(directory, "second.json");

await ensureDirectory({ directory: nested });
await writeJsonFile({ filePath: metaPath, value: { name: "demo", size: 3 } });
await writeJsonFile({ filePath: secondPath, value: [1, 2, 3] });

console.log("meta contents:", await readJsonFile({ filePath: metaPath }));

// eslint-disable-next-line security/detect-non-literal-fs-filename -- demo writes inside its own temp workspace
writeFileSync(metaPath, JSON.stringify({ name: "external", size: 9 }));
console.log("updated contents:", await readJsonFile({ filePath: metaPath }));

console.log(
  "files:",
  (await directoryFiles({ directory })).map((file) =>
    relative(directory, file),
  ),
);
console.log("directory size:", await directorySize({ directory }));
console.log("metadata:", await directoryMetadata({ directory }));
console.log(
  "tree children:",
  (await directoryTree({ directory }))?.children.map((child) => child.name),
);

const copy = join(directory, "copy");
await copyDirectory({ destination: copy, source: nested });
await moveDirectory({ destination: join(directory, "moved"), source: copy });
console.log(
  "moved metadata:",
  await directoryMetadata({ directory: join(directory, "moved") }),
);

await removeFiles({ filePaths: [metaPath, secondPath] });
console.log(
  "files after removal:",
  (await directoryFiles({ directory })).map((file) =>
    relative(directory, file),
  ),
);

await emptyDirectory({ directory });
console.log(
  "directory is empty:",
  (await directoryFiles({ directory })).length === 0,
);
