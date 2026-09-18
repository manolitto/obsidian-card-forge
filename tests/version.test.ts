import { readFileSync } from "fs";
import { join } from "path";
import { expect, it } from "vitest";

/**
 * A release is three files agreeing: `manifest.json` names the version and
 * the oldest app it runs on, `package.json` the same version, and
 * `versions.json` maps that version to that app. Bumped by hand, held
 * equal here — a bump that misses a file fails this test and nothing else.
 */

const read = (file: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", file), "utf-8")) as Record<
    string,
    string
  >;

it("names one version and one minAppVersion across manifest, package and versions", () => {
  const manifest = read("manifest.json");
  const pkg = read("package.json");
  const versions = read("versions.json");
  expect(pkg["version"]).toBe(manifest["version"]);
  expect(versions[manifest["version"]!]).toBe(manifest["minAppVersion"]);
});
