/* eslint-disable deslint/no-prod-console -- examples are demo scripts; printing is their purpose */

import { clearFsCache } from "jutilities/node/fs/cache";
import {
  copyDirectory,
  createTempDirectory,
  directoryFiles,
  directoryMetadata,
  directorySize,
  directoryTree,
  emptyDirectory,
  moveDirectory,
  removeDirectory,
} from "jutilities/node/fs/dir";
import { readJsonFile, writeJsonFile } from "jutilities/node/fs/json";
import {
  ensureDirectory,
  fileSize,
  pathExists,
  removeFiles,
} from "jutilities/node/fs/utils";
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
/**
 * Demonstrates the Node filesystem helpers: directory creation, JSON sidecars,
 * existence/size probes, safe multi-file cleanup, recursive scans, and
 * directory copy/move/removal. Everything lives in a temp workspace. It also
 * shows how cached facts behave after an external write and after
 * `clearFsCache()`.
 */

const directory = await createTempDirectory();
const nested = join(directory, "nested");
const metaPath = join(nested, "meta.json");
const secondPath = join(directory, "second.json");

await ensureDirectory({ directory: nested });
await writeJsonFile({ filePath: metaPath, value: { name: "demo", size: 3 } });
await writeJsonFile({ filePath: secondPath, value: [1, 2, 3] });

console.log("meta exists:", await pathExists({ filePath: metaPath }));
console.log("meta contents:", await readJsonFile({ filePath: metaPath }));
console.log("meta size:", await fileSize({ filePath: metaPath }));

// eslint-disable-next-line security/detect-non-literal-fs-filename -- demo writes inside its own temp workspace
writeFileSync(metaPath, JSON.stringify({ name: "external", size: 9 }));
console.log(
  "stale after external write:",
  await readJsonFile({ filePath: metaPath }),
);
clearFsCache();
console.log(
  "fresh after clearFsCache:",
  await readJsonFile({ filePath: metaPath }),
);

console.log(
  "files:",
  (await directoryFiles({ directory })).map((file) => relative(directory, file)),
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
console.log("moved exists:", await pathExists({ filePath: join(directory, "moved") }));

await removeFiles({ filePaths: [metaPath, secondPath] });
console.log("second still exists:", await pathExists({ filePath: secondPath }));

await emptyDirectory({ directory });
console.log("directory is empty:", (await directoryFiles({ directory })).length === 0);
await removeDirectory({ directory });
console.log("directory still exists:", await pathExists({ filePath: directory }));
