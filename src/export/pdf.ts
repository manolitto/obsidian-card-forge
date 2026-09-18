import type { DeckDocument } from "./document";

/*
 * The PDF: the export document printed by a hidden Electron window.
 *
 * This is the one module that names Electron, and the plugin calls it on
 * the desktop only. The window loads the document from a file rather than
 * a `data:` URL — a deck's fonts alone run past the URL length Chromium
 * accepts — waits for its fonts and pictures, and prints through
 * `printToPDF` onto the paper the document was composed for. Nothing is
 * injected into the window: the document is complete when it gets there.
 *
 * The file is the caller's: written and removed through the vault's
 * adapter, so nothing here reaches for Node's file system, and the bundle
 * evaluates on a phone even though this function is never called there.
 */

/** Where the document goes for the print window to load. */
export interface TempFile {
  /** The absolute path, as `loadFile` wants it. */
  absolutePath: string;
  write(html: string): Promise<void>;
  remove(): Promise<void>;
}

/** The parts of Electron's main-process API this module touches, as `@electron/remote` exposes them. */
interface PrintWindow {
  loadFile(path: string): Promise<void>;
  close(): void;
  webContents: {
    executeJavaScript(code: string): Promise<unknown>;
    printToPDF(options: {
      printBackground: boolean;
      preferCSSPageSize: boolean;
      landscape: boolean;
      pageSize: { width: number; height: number };
      margins: { top: number; bottom: number; left: number; right: number };
    }): Promise<Uint8Array>;
  };
}

interface Remote {
  BrowserWindow: new (options: {
    show: boolean;
    webPreferences: { nodeIntegration: boolean; contextIsolation: boolean };
  }) => PrintWindow;
}

/** Fonts loaded and every picture decoded, evaluated inside the print window. */
const READY = `(async () => {
  await document.fonts.ready;
  await Promise.all(Array.from(document.images, (img) =>
    img.complete ? Promise.resolve() : img.decode().catch(() => undefined)));
  return "ready";
})()`;

/**
 * Print the document to PDF. `file` is where the document is written for
 * the window and removed from again. Resolves to the PDF's bytes as an
 * `ArrayBuffer` sized to the PDF and nothing else.
 */
export async function printDeckPdf(
  doc: DeckDocument,
  file: TempFile
): Promise<ArrayBuffer> {
  const remote = loadRemote();
  await file.write(doc.html);

  const win = new remote.BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    await win.loadFile(file.absolutePath);
    await win.webContents.executeJavaScript(READY);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      landscape: doc.paper.width > doc.paper.height,
      // Microns. `preferCSSPageSize` takes the document's `@page` when it
      // has one; this is the same paper, said the way the API asks.
      pageSize: {
        width: Math.round(doc.paper.width * 1000),
        height: Math.round(doc.paper.height * 1000),
      },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    // What comes back is a Node `Buffer`: a view into a store that may be a
    // shared pool holding other bytes before and after. The slice by the
    // view's own offset and length is the PDF alone.
    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer;
  } finally {
    win.close();
    await file.remove().catch(() => undefined);
  }
}

/** The renderer's `require`, which the desktop app provides and a phone does not. */
declare const require: (id: string) => unknown;

/** The main-process bridge Obsidian ships; an error naming what is missing when it is not there. */
function loadRemote(): Remote {
  try {
    // A dynamic require: the module exists only in Obsidian's desktop app.
    return require("@electron/remote") as Remote;
  } catch {
    throw new Error(
      "The PDF export needs Obsidian's desktop app; the HTML export works everywhere."
    );
  }
}
