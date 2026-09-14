import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { defineConfig } from "vitest/config";

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

export default defineConfig({
  plugins: [rawTextLoader],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
