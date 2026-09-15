/**
 * Finding the files a system's text points at.
 *
 * Images and fonts are not declared anywhere: every reference to one carries
 * the file's full path relative to the system folder — `url(fonts/x.woff2)`
 * in a stylesheet, `{{asset "assets/logo.png"}}` in a template, `default:
 * assets/logo.png` on a property — so the reference is the declaration, and
 * this module reads them out. The loader checks each in both directions: a
 * reference to a file that is not there, and a file that nothing refers to.
 *
 * Partials are the other thing a template points at, by name rather than by
 * path; the same scan collects those for the same two-way check.
 *
 * Pure functions over text and parsed YAML. Nothing here reads a file.
 */

/** A reference and where it was made, for the message when it dangles. */
export interface Reference {
  /** As written — relative to the system folder. */
  path: string;
  /** `line 21`, or the dotted key of a YAML value. */
  where: string;
}

/**
 * What counts as an asset, and how it is served. A file with one of these
 * extensions is what a reference may name; a YAML value ending in one IS a
 * reference, which is the rule that lets a property's `default:` be checked
 * without a declaration beside it.
 */
const ASSET_MIME: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The media type an asset is served as, or `undefined` for a path that is not an asset. */
export function assetMimeType(path: string): string | undefined {
  return ASSET_MIME[extensionOf(path)];
}

export function isAssetPath(value: string): boolean {
  return assetMimeType(value) !== undefined;
}

// ── Stylesheets ─────────────────────────────────────────────────────

/** A `url()` in a stylesheet; group 2 is the target. */
export const STYLESHEET_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/**
 * Every `url()` in a stylesheet that names a file, with its line. A `data:`
 * URI, an `http(s):` or protocol-relative address and a bare fragment are
 * left alone — they name nothing in the folder.
 */
export function stylesheetReferences(css: string): Reference[] {
  const out: Reference[] = [];
  for (const match of css.matchAll(STYLESHEET_URL)) {
    const target = (match[2] ?? "").trim();
    if (isExternalUrl(target)) continue;
    out.push({ path: target, where: `line ${lineOf(css, match.index ?? 0)}` });
  }
  return out;
}

/** A `url()` target that names nothing in the folder — an address, a data URI, a fragment. */
export function isExternalUrl(target: string): boolean {
  return (
    target === "" ||
    target.startsWith("data:") ||
    target.startsWith("http:") ||
    target.startsWith("https:") ||
    target.startsWith("//") ||
    target.startsWith("#")
  );
}

// ── Templates ───────────────────────────────────────────────────────

const TEMPLATE_ASSET = /\{\{\s*asset\s+(['"])([^'"]+)\1/g;
const TEMPLATE_PARTIAL = /\{\{#?>\s*([A-Za-z0-9_-]+)/g;

/** Every `{{asset "…"}}` literal in a template, with its line. */
export function templateAssetReferences(hbs: string): Reference[] {
  const out: Reference[] = [];
  for (const match of hbs.matchAll(TEMPLATE_ASSET)) {
    out.push({ path: match[2] ?? "", where: `line ${lineOf(hbs, match.index ?? 0)}` });
  }
  return out;
}

/** The names a template calls as partials — `{{> name}}` and `{{#> name}}`. */
export function templatePartialCalls(hbs: string): Reference[] {
  const out: Reference[] = [];
  for (const match of hbs.matchAll(TEMPLATE_PARTIAL)) {
    out.push({
      path: (match[1] ?? "").toLowerCase(),
      where: `line ${lineOf(hbs, match.index ?? 0)}`,
    });
  }
  return out;
}

/** Every mustache, so a literal outside one — in prose — does not count. */
const TEMPLATE_MUSTACHE = /\{\{[^}]*\}\}/g;
const STRING_LITERAL = /(['"])([^'"]*)\1/g;

/**
 * Every string literal inside a mustache, lowercased — the places a
 * template reads, in the widest sense: `{{slot "front-stat-1a"}}` names
 * one directly, and a partial called with `for="front-stat-1a"` reads it
 * through a path, the literal being at the call site.
 */
export function templateStringLiterals(hbs: string): Set<string> {
  const out = new Set<string>();
  for (const mustache of hbs.matchAll(TEMPLATE_MUSTACHE)) {
    for (const match of mustache[0].matchAll(STRING_LITERAL)) {
      out.add((match[2] ?? "").trim().toLowerCase());
    }
  }
  return out;
}

// ── YAML ────────────────────────────────────────────────────────────

/**
 * Every string in a parsed document that ends in an asset extension, with the
 * dotted key it sits under. A path mentioned in prose that happens to end in
 * `.png` counts too — the harmless direction: a dead file is kept, never a
 * live one reported dead.
 */
export function documentAssetReferences(doc: unknown): Reference[] {
  const out: Reference[] = [];
  const visit = (value: unknown, where: string): void => {
    if (typeof value === "string") {
      if (isAssetPath(value)) out.push({ path: value, where });
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, `${where}[${i}]`));
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        visit(item, where ? `${where}.${key}` : key);
      }
    }
  };
  visit(doc, "");
  return out;
}

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
