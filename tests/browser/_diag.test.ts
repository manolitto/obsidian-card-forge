import { expect, it } from "vitest";
import { mountLayoutHost, waitForSettledLayout } from "../../src/layout/host";
import { loadedSystem } from "../helpers/render";
import { listFixtures, renderFixture } from "./helpers/fixtures";

const FAMILIES = ["Source Sans 3", "Barlow Condensed", "Cinzel", "Pathfinder2eActions"];

it("diag", async () => {
  const lines: string[] = [];
  const system = await loadedSystem("pf2e");
  for (const fixture of listFixtures().filter((f) => f.system === "pf2e")) {
    for (const rendered of await renderFixture(fixture)) {
      if (!rendered.faces.front) continue;
      const css = await system.stylesheet(rendered.cardTypeId);
      const host = mountLayoutHost(document, "pf2e", css, [rendered.faces.front]);
      await waitForSettledLayout(host.root);
      const root = host.root.querySelector<HTMLElement>(".card-root")!;
      lines.push(`## ${fixture.name} lang=${root.getAttribute("lang")} class=${root.className} root=${root.offsetWidth}x${root.offsetHeight}`);
      const body = root.querySelector<HTMLElement>(".card-body-scalable");
      if (body) {
        lines.push(`  body ${body.offsetWidth}x${body.offsetHeight} scroll=${body.scrollHeight} font=${getComputedStyle(body).fontFamily} size=${getComputedStyle(body).fontSize}`);
        for (const el of Array.from(body.children) as HTMLElement[]) {
          const cs = getComputedStyle(el);
          lines.push(`  ${el.className.replace(/\s+/g, ".").padEnd(40)} h=${el.offsetHeight.toString().padStart(4)} font=${cs.fontFamily.slice(0, 40)} ${cs.fontSize} lh=${cs.lineHeight} hy=${cs.hyphens}`);
        }
      }
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(".pf2e-stat-label, .pf2e-entry-label, .pf2e-item-activation-actions, .pf2e-trait")).slice(0, 3)) {
        const cs = getComputedStyle(el);
        lines.push(`    ${el.className} w=${el.offsetWidth} h=${el.offsetHeight} font=${cs.fontFamily.slice(0, 50)} ${cs.fontSize} ${cs.fontWeight}`);
      }
      host.remove();
    }
  }
  // Font metrics, each family alone.
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-9999px;top:0;font-size:20px;white-space:nowrap";
  document.body.appendChild(probe);
  for (const fam of FAMILIES) {
    for (const weight of ["400", "700", "900"]) {
      probe.style.fontFamily = `"${fam}"`;
      probe.style.fontWeight = weight;
      probe.textContent = "Wahrnehmung +12; Dunkelsicht, Lebensspüren 18 m ⬻⬺⬲";
      lines.push(`font ${fam} ${weight}: ${probe.offsetWidth}x${probe.offsetHeight} loaded=${document.fonts.check(`${weight} 20px "${fam}"`)}`);
    }
  }
  probe.style.fontFamily = "serif"; probe.style.fontWeight = "400"; probe.textContent = "Wahrnehmung +12; Dunkelsicht, Lebensspüren 18 m ⬻⬺⬲";
  lines.push(`font serif: ${probe.offsetWidth}x${probe.offsetHeight}`);
  probe.style.fontFamily = "sans-serif";
  lines.push(`font sans-serif: ${probe.offsetWidth}x${probe.offsetHeight}`);
  // Hyphenation.
  probe.style.cssText = "position:absolute;left:-9999px;top:0;font-size:20px;width:120px;font-family:'Source Sans 3';hyphens:auto";
  for (const lang of ["de", "en", ""]) {
    if (lang) probe.setAttribute("lang", lang); else probe.removeAttribute("lang");
    probe.textContent = "Donaudampfschifffahrtsgesellschaftskapitän Bewusstlos Voraussetzung angrenzende";
    lines.push(`hyphens lang=${lang || "-"}: h=${probe.offsetHeight} scroll=${probe.scrollHeight}`);
  }
  probe.remove();
  lines.push(`ua=${navigator.userAgent} dpr=${devicePixelRatio} fonts=${document.fonts.size}`);
  expect(lines.join("\n")).toBe("DIAG");
});
