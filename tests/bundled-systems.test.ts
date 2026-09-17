import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import type { SystemPath } from "../src/definitions/game-system";
import { BUNDLED_SYSTEMS, type BundledFile } from "../src/generated/bundled-systems";
import { BundledSystemSource } from "../src/systems/bundled-source";
import { loadSystem } from "../src/systems/loader";

/**
 * Every bundled system, loaded the way a vault system is loaded, must come
 * through with nothing to report: no declared file missing, no reference to
 * nowhere, no call to a partial nobody declares.
 *
 * It is also held to what a vault system is not: every byte in its folder
 * ships inside the plugin, so a file nothing uses — the old copy of a
 * renamed template, say — and a partial nothing calls fail here. A font's
 * licence and a readme travel with the system without being part of it.
 */
describe.each(BUNDLED_SYSTEMS.map((system) => [system.id, system] as const))(
  "bundled system %s",
  (id, bundled) => {
    it("loads with nothing to report", async () => {
      const diagnostics = collectDiagnostics();
      const system = await loadSystem(new BundledSystemSource(bundled), id, diagnostics);
      expect(diagnostics.messages).toEqual([]);
      expect(system).toBeDefined();
      expect(Object.keys(system!.cardTypes).length).toBeGreaterThan(0);
    });

    it("uses every file it ships and every partial it declares", async () => {
      const system = await loadSystem(
        new BundledSystemSource(bundled),
        id,
        collectDiagnostics()
      );
      expect(system!.unusedFiles.filter((file) => !ridesAlong(file))).toEqual([]);
      expect(system!.unusedPartials).toEqual([]);
    });

    it("assembles a stylesheet for each card type with every url() inlined", async () => {
      const system = await loadSystem(
        new BundledSystemSource(bundled),
        id,
        collectDiagnostics()
      );
      for (const cardTypeId of Object.keys(system!.cardTypes)) {
        const css = await system!.stylesheet(cardTypeId);
        expect(css, cardTypeId).not.toMatch(/url\((['"]?)(?!data:)[^'")]/);
      }
    });
  }
);

it("ships at least the simple system", () => {
  expect(BUNDLED_SYSTEMS.map((s) => s.id)).toContain("simple");
});

/**
 * A font or a parchment two systems both carry is one file in the plugin:
 * the manifest holds each distinct content once, and every path with that
 * content points at the same object.
 */
it("holds a file two systems share once", () => {
  const byContent = new Map<string, BundledFile>();
  for (const system of BUNDLED_SYSTEMS) {
    for (const file of Object.values(system.files)) {
      const key = "text" in file ? `text:${file.text}` : `base64:${file.base64}`;
      const seen = byContent.get(key);
      if (seen) expect(file).toBe(seen);
      else byContent.set(key, file);
    }
  }
});

it("reads a shared file byte-exact under either path", async () => {
  const shared: BundledFile = { base64: Buffer.from([1, 2, 3, 250]).toString("base64") };
  const source = new BundledSystemSource({
    id: "two",
    name: "Two",
    document: "two.yaml",
    files: { "fonts/a.woff2": shared, "fonts/b.woff2": shared },
  });
  const a = await source.readBinary("fonts/a.woff2" as SystemPath);
  const b = await source.readBinary("fonts/b.woff2" as SystemPath);
  expect([...a]).toEqual([1, 2, 3, 250]);
  expect([...b]).toEqual([1, 2, 3, 250]);
});

/** A licence, a notice, a readme: shipped beside the system, named by nobody. */
function ridesAlong(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return (
    name.startsWith("license") ||
    name.startsWith("licence") ||
    name.startsWith("notice") ||
    name.startsWith("readme") ||
    name.endsWith(".txt")
  );
}
