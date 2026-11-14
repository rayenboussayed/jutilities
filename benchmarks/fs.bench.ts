/* eslint-disable security/detect-non-literal-fs-filename */
import {
  directorySize,
  directoryTree,
  walkEntries,
} from "jutilities/node/fs/dir";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

let sink: unknown;

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fs-bench-"));
const payload = Buffer.alloc(1024, 1);

beforeAll(() => {
  for (let dir = 0; dir < 4; dir += 1) {
    const sub = path.join(directory, `d-${dir}`);
    fs.mkdirSync(sub);
    for (let file = 0; file < 10; file += 1) {
      fs.writeFileSync(path.join(sub, `f-${file}.bin`), payload);
    }
  }
});

afterAll(() => {
  fs.rmSync(directory, { force: true, recursive: true });
  expect(sink).toBeDefined();
});

describe("fs directory scanning", () => {
  test("directoryTree (44 entries)", async ({ bench }) => {
    await bench("directoryTree (44 entries)", async () => {
      sink = await directoryTree({ directory });
    }).run();

    expect(sink).toBeDefined();
  });

  test("directorySize (44 entries)", async ({ bench }) => {
    await bench("directorySize (44 entries)", async () => {
      sink = await directorySize({ directory });
    }).run();

    expect(sink).toBeDefined();
  });

  test("walkEntries (44 entries)", async ({ bench }) => {
    await bench("walkEntries (44 entries)", async () => {
      let count = 0;
      for await (const entry of walkEntries({ directory })) {
        sink = entry;
        count += 1;
      }
      sink = count;
    }).run();

    expect(sink).toBeDefined();
  });
});
