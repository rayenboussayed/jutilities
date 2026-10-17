import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import { jsdoc } from "eslint-plugin-jsdoc";
import node from "eslint-plugin-n";

export default defineConfig([
  globalIgnores(["node_modules/**", "dist/**", "*.config.*"]),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js, n: node },
    extends: ["js/recommended", "n/recommended-module"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  tseslint.configs.recommended,
  jsdoc({
    config: "flat/recommended-tsdoc",
  }),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
