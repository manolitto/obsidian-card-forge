import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../src/generated/bundled-systems";
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
