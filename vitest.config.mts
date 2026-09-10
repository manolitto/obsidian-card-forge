import { defineConfig } from "vitest/config";

// Mirror esbuild's `.yaml` / `.css` text loaders (see esbuild.config.mjs) so
// modules that import bundled resources as raw text also load under vitest.
const rawTextLoader = {
  name: "raw-text-loader",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (/\.(ya?ml|css)$/.test(id.split("?")[0] ?? "")) {
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [rawTextLoader],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
