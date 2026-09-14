import { describe, expect, it } from "vitest";
import { collectDiagnostics } from "../src/definitions/diagnostics";
import { BUNDLED_SYSTEMS } from "../src/generated/bundled-systems";
import { BundledSystemSource } from "../src/systems/bundled-source";
import { loadSystem } from "../src/systems/loader";

/**
 * Every bundled system, loaded the way a vault system is loaded, must come
 * through with nothing to report: no declared file missing, no reference to
 * nowhere, no partial declared but never called, and — the one that costs
 * real bytes — no file in the folder that nothing uses.
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
