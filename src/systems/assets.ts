import { parseSystemPath, type SystemPath } from "../definitions/game-system";
import { IGNORE_DIAGNOSTICS } from "../definitions/diagnostics";
import { assetMimeType, isExternalUrl, STYLESHEET_URL } from "./references";
import type { SystemSource } from "./source";

/**
 * Turning a system's assets into something a card can show.
 *
 * One form for everything: a `data:` URI. A bundled asset has no other form —
 * it lives inside the plugin — and giving a vault asset the same one means
 * the stylesheet, the HTML export and the PDF window never see a path. The
 * export is a single file; the window has nothing to resolve.
 */

/** Bytes as a `data:` URI, typed by the path's extension. */
export function dataUri(bytes: Uint8Array, path: string): string {
  const mime = assetMimeType(path) ?? "application/octet-stream";
  return `data:${mime};base64,${encodeBase64(bytes)}`;
}

/** Read one asset from the source as a `data:` URI. Throws when it is not there. */
export async function readAssetUri(
  source: SystemSource,
  path: SystemPath
): Promise<string> {
  return dataUri(await source.readBinary(path), path);
}

/**
 * One asset as a template may use it: its `data:` URI always, and for an
 * SVG its text as well — an icon written into the markup takes the text
 * colour and the size the stylesheet gives it, which a `data:` URI in an
 * `<img>` cannot.
 */
export interface Asset {
  uri: string;
  /** The file's text, for an SVG; a bitmap or a font has none. */
  text?: string;
}

/** Read one asset from the source in both forms it can take. Throws when it is not there. */
export async function readAsset(source: SystemSource, path: SystemPath): Promise<Asset> {
  const bytes = await source.readBinary(path);
  const asset: Asset = { uri: dataUri(bytes, path) };
  if (assetMimeType(path) === "image/svg+xml")
    asset.text = new TextDecoder().decode(bytes);
  return asset;
}

/**
 * Rewrite every `url()` in a stylesheet that names a file of the system into
 * a `data:` URI read from the source. Paths are relative to the system folder,
 * wherever the stylesheet itself sits — the same rule every other reference
 * follows. A `url()` pointing outside — `data:`, `http:` — is left as it is,
 * and so is one whose path the shape check refuses; the loader has already
 * reported that one.
 */
export async function inlineStylesheet(
  css: string,
  source: SystemSource
): Promise<string> {
  const replacements = new Map<string, string>();
  for (const match of css.matchAll(STYLESHEET_URL)) {
    const target = (match[2] ?? "").trim();
    if (replacements.has(target) || isExternalUrl(target)) continue;
    const path = parseSystemPath(target, "url()", IGNORE_DIAGNOSTICS);
    if (!path) continue;
    replacements.set(target, await readAssetUri(source, path));
  }
  return css.replace(STYLESHEET_URL, (whole, _quote: string, target: string) => {
    const uri = replacements.get(target.trim());
    return uri ? `url("${uri}")` : whole;
  });
}

function encodeBase64(bytes: Uint8Array): string {
  // btoa wants a binary string; build it in chunks so a font does not blow
  // the argument list of `String.fromCharCode`.
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
