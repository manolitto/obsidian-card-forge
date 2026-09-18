import { expect, it } from "vitest";
import { mountLayoutHost } from "../../src/layout/host";
import { loadedSystem } from "../helpers/render";

it("diag", async () => {
  const lines: string[] = [];
  const system = await loadedSystem("pf2e");
  const css = await system.stylesheet("creature");
  const host = mountLayoutHost(document, "pf2e", css, ['<div class="card-root"></div>']);
  await document.fonts.ready;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap";
  document.body.appendChild(probe);
  const text = "Wahrnehmung Fertigkeiten Gegenstände Immunitäten";
  for (const family of [
    '"Source Sans 3"',
    '"Pathfinder2eActions", "Source Sans 3"',
    '"Barlow Condensed"',
  ]) {
    for (const size of ["10.6673px", "11.3333px", "16px", "20px", "40px"]) {
      for (const weight of ["400", "500", "600", "700"]) {
        const widths: string[] = [];
        for (const tr of [
          "auto",
          "geometricPrecision",
          "optimizeLegibility",
          "optimizeSpeed",
        ]) {
          probe.style.fontFamily = family;
          probe.style.fontSize = size;
          probe.style.fontWeight = weight;
          probe.style.textRendering = tr;
          probe.style.fontSynthesis = "";
          probe.textContent = text;
          widths.push(`${tr}=${probe.getBoundingClientRect().width.toFixed(2)}`);
        }
        probe.style.textRendering = "auto";
        probe.style.fontSynthesis = "none";
        widths.push(`synthNone=${probe.getBoundingClientRect().width.toFixed(2)}`);
        lines.push(
          `${family.padEnd(42)} ${size.padEnd(10)} w${weight}: ${widths.join(" ")}`
        );
      }
    }
  }
  probe.remove();
  host.remove();
  lines.push(`ua=${navigator.userAgent}`);
  expect(lines.join("\n")).toBe("DIAG");
});
