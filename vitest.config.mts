import { playwright } from "@vitest/browser-playwright";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { defineConfig } from "vitest/config";
import {
  deckGolden,
  layoutGolden,
  orphanLayoutGoldens,
  writeLayoutPreview,
} from "./tests/helpers/golden-commands.ts";

// Mirror esbuild's `.yaml` / `.css` text loaders (see esbuild.config.mjs) so
// modules that import bundled resources as raw text also load under vitest.
// The import is resolved to a virtual id of its own that does not end in
// `.css`, so neither Vite's CSS pipeline nor vitest's CSS stub sees a
// stylesheet module and empties it.
const TEXT_PREFIX = "\0text:";
const TEXT_SUFFIX = ".text";
const rawTextLoader = {
  name: "raw-text-loader",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer || !/\.(ya?ml|css)$/.test(source)) return null;
    return TEXT_PREFIX + resolve(dirname(importer), source) + TEXT_SUFFIX;
  },
  load(id: string) {
    if (!id.startsWith(TEXT_PREFIX)) return null;
    const file = id.slice(TEXT_PREFIX.length, -TEXT_SUFFIX.length);
    const text = readFileSync(file, "utf-8");
    return { code: `export default ${JSON.stringify(text)};`, map: null };
  },
};

// Two projects. Everything that never touches a layout runs in node; what
// reads a layout — `scrollHeight`, a committed font size, a face that
// overflows — runs in a real Chromium under `tests/browser/`, where those
// numbers mean something. `npx playwright install chromium` fetches the
// browser once per machine. The layout goldens' file side runs here in node,
// as browser commands (`tests/helpers/golden-commands.ts`).
export default defineConfig({
  plugins: [rawTextLoader],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/browser/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            commands: {
              deckGolden,
              layoutGolden,
              orphanLayoutGoldens,
              writeLayoutPreview,
            },
          },
        },
      },
    ],
  },
});
