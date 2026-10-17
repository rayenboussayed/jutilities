import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import { jsdoc } from "eslint-plugin-jsdoc";
import node from "eslint-plugin-n";
import deslint from "@deslint/eslint-plugin";

const JS_FILES = "**/*.{js,mjs,cjs}";
const TS_FILES = "**/*.{ts,mts,cts}";

export default defineConfig([
  globalIgnores(["node_modules/**", "dist/**", "*.config.*"]),
  {
    files: [JS_FILES, TS_FILES],
    plugins: { js, n: node },
    extends: ["js/recommended", "n/recommended-module"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: [TS_FILES],
    extends: [
      tseslint.configs.recommended,
      jsdoc({ config: "flat/recommended-tsdoc" }),
    ],
  },
  {
    files: [JS_FILES],
    extends: [jsdoc({ config: "flat/recommended" })],
  },
  deslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
