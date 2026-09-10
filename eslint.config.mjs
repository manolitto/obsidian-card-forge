import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Browser/Electron surface used by the plugin and its injected scripts. */
const browserGlobals = {
  document: "readonly",
  window: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  requestAnimationFrame: "readonly",
  getComputedStyle: "readonly",
  fetch: "readonly",
  URL: "readonly",
  Node: "readonly",
  NodeFilter: "readonly",
  Element: "readonly",
  HTMLElement: "readonly",
  DOMParser: "readonly",
};

/** Node surface used by scripts/ and tests/. */
const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "main.js",
      "node_modules/**",
      "dist/**",
      "src/generated/**",
      "resources/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Card text carries deliberate non-breaking spaces; flagging them in
      // strings and comments would be noise.
      "no-irregular-whitespace": ["error", { skipStrings: true, skipComments: true }],
    },
  }
);
