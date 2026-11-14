import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config";

export default defineConfig({
  test: {
    ...baseConfig.test,
    coverage: { enabled: false },
    execArgv: ["--expose-gc"],
    fileParallelism: false,
    include: ["test/memory/**/*.test.ts"],
  },
});
