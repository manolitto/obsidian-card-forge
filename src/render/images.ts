import { assetMimeType } from "../systems/references";
import { linkTarget } from "../templates/inline-markdown";

/**
 * The pictures a card shows, from the vault.
 *
 * A note refers to a picture the way it refers to anything: `[[Beil.png]]`,
 * `![[Beil.png|the axe]]`, or a bare path. Helpers are synchronous and the
 * vault is not, so every picture a face might show is read before the face
 * renders — collected from the prepared props, resolved through this
 * interface, and handed to the engine as link target → `data:` URI. There
 * is no other form: the HTML export is one file and the PDF window has
 * nothing to resolve.
 *
 * What resolves a link is the vault's business — Obsidian's link
 * resolution and a binary read, a few lines where the renderer is built —
 * and a test's, which answers from a folder.
 */
export interface ImageSource {
  /**
   * The picture `link` names, seen from the note at `fromNotePath`, as a
   * `data:` URI; `undefined` when the vault has no such file.
   */
  resolve(link: string, fromNotePath: string): Promise<string | undefined>;
}

/** Every `[[…]]` or `![[…]]` in a text; capture 1 is the target. */
const LINKS = /!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/**
 * Every picture the props refer to: the target of each wikilink or embed
 * in any string value, and any string value that is itself a path — when
 * the target ends in an image extension. Nested lists and mappings are
 * walked, so a body's embeds and a table's cells are found too. A link to
 * a note is not a picture and is not collected.
 */
export function collectImageLinks(props: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(LINKS)) {
        const target = (match[1] ?? "").trim();
        if (isImagePath(target)) out.add(target);
      }
      const bare = linkTarget(value);
      if (!value.includes("[[") && isImagePath(bare)) out.add(bare);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(props);
  return [...out];
}

/** Resolve every link once; the map holds only what the source answered. */
export async function resolveImages(
  links: Iterable<string>,
  source: ImageSource,
  fromNotePath: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    [...new Set(links)].map(async (link) => {
      const uri = await source.resolve(link, fromNotePath);
      if (uri !== undefined) out.set(link, uri);
    })
  );
  return out;
}

function isImagePath(target: string): boolean {
  return assetMimeType(target)?.startsWith("image/") === true;
}
