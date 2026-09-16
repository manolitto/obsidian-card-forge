import { writeFileSync } from "fs";
import { join } from "path";
import { chromium, type Browser } from "playwright";
import type { BrowserCommand } from "vitest/node";

/**
 * Printing an export document to PDF on the node side, for the browser
 * project. Playwright's Chromium prints through the same engine Electron's
 * `printToPDF` does, so what comes back is the PDF the plugin would write,
 * and the test can hold its page count and its paper to the composition.
 *
 * Under `UPDATE_GOLDENS=1` the PDF is also written beside the fixture
 * deck, gitignored, as `_deck.pdf` — the file to look at, and the input of
 * the Quartz check.
 */

const UPDATE = process.env["UPDATE_GOLDENS"] === "1";
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

export interface PrintedPdf {
  pageCount: number;
  /** The first page's `/MediaBox`, in points. */
  mediaBox: { width: number; height: number };
  bytes: number;
}

/**
 * Print `html` as the PDF its `@page` rule asks for — the paper the document
 * says, no margins, backgrounds on — once its fonts have loaded and every
 * picture has decoded.
 */
export const printPdf: BrowserCommand<[system: string, html: string]> = async (
  _ctx,
  system,
  html
): Promise<PrintedPdf> => {
  // A Chromium per print, closed after it: one kept open across the run
  // would hold vitest's process after the last test.
  const browser: Browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (img) =>
          img.complete ? Promise.resolve() : img.decode().catch(() => undefined)
        )
      );
    });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    if (UPDATE) writeFileSync(join(FIXTURES_DIR, system, "_deck.pdf"), pdf);
    return { ...describePdf(pdf), bytes: pdf.byteLength };
  } finally {
    await browser.close();
  }
};

/**
 * What the PDF says of itself, read off its plain-text objects: Chromium
 * writes page dictionaries and media boxes uncompressed, so a count of
 * `/Type /Page` objects and the first `/MediaBox` are there to be read
 * without a PDF library.
 */
export function describePdf(pdf: Uint8Array): Omit<PrintedPdf, "bytes"> {
  const text = Buffer.from(pdf).toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  const box = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(
    text
  );
  const mediaBox = box
    ? { width: Number(box[3]) - Number(box[1]), height: Number(box[4]) - Number(box[2]) }
    : { width: 0, height: 0 };
  return { pageCount, mediaBox };
}
