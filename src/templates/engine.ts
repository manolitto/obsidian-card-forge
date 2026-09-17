import Handlebars from "handlebars";
import { IGNORE_DIAGNOSTICS, type Diagnostics } from "../definitions/diagnostics";
import { parseSystemPath, type SystemPath } from "../definitions/game-system";
import { resolveTranslations } from "../definitions/translations";
import type { CardSize } from "../model/card-size";
import { readAsset, type Asset } from "../systems/assets";
import type { LoadedSystem } from "../systems/loader";
import { templateAssetReferences } from "../systems/references";
import { MissingFileError } from "../systems/source";
import { blockMarkdown } from "./block-markdown";
import { STATE_KEY, type RenderState, type TemplateContext } from "./context";
import { registerHelpers } from "./helpers";
import { escapeHtml } from "./inline-markdown";

/** One face of one card, to render. */
export interface FaceRequest {
  system: LoadedSystem;
  cardTypeId: string;
  face: "front" | "back";
  /** The note's values, prepared — `prepareCardProps`, so the slot chain resolves. */
  props: Record<string, unknown>;
  language: string;
  cardSize: CardSize;
  /**
   * The pictures the note refers to, resolved before the render: link target
   * → `data:` URI. Helpers are synchronous and the vault is not, so what a
   * face may show has to be read first; `image=true` and a body's
   * `![[embed]]` look it up here, and a miss is reported at the call.
   */
  images?: ReadonlyMap<string, string>;
}

/**
 * Turns a face template and a card's values into the face's HTML.
 *
 * Templates are Handlebars, compiled once per `LoadedSystem` and kept in a
 * `WeakMap` keyed by it: a bundled system is loaded once and stays, and a
 * vault system whose files change is replaced by a fresh `LoadedSystem`, so
 * identity is the cache key and nothing here watches a file. The helpers
 * live on an isolated Handlebars instance — never the global one.
 *
 * A problem with the declaration is reported to the sink the caller hands
 * in; a problem with the template — a syntax error, a file the source does
 * not have — throws, naming `<system>/<path>`. Nothing here writes to the
 * console.
 */
export class TemplateEngine {
  private readonly hb = Handlebars.create();
  private readonly systems = new WeakMap<LoadedSystem, SystemTemplates>();

  constructor() {
    registerHelpers(this.hb);
  }

  async renderFace(request: FaceRequest, diagnostics: Diagnostics): Promise<string> {
    const { system, cardTypeId, face, props, language, cardSize } = request;
    const images = request.images ?? new Map<string, string>();
    const cardType = system.cardTypes[cardTypeId];
    if (!cardType) throw new Error(`${system.id} has no card type "${cardTypeId}"`);
    const path =
      face === "front"
        ? cardType.declaration.frontTemplate
        : cardType.declaration.backTemplate;
    if (!path) {
      throw new Error(`${system.id}/${cardTypeId} declares no ${face}-template`);
    }

    const templates = this.templatesOf(system);
    const [template, partials] = await Promise.all([
      templates.face(path),
      templates.partials(),
    ]);

    const where = `${system.id}/${cardTypeId}`;
    const state: RenderState = {
      where,
      props,
      translations: resolveTranslations(
        [cardType.translations],
        language,
        system.declaration.languages[0]
      ),
      assets: templates.assets,
      images,
      glyphs: cardType.glyphs,
      classifiers: cardType.classifiers,
      block: blockMarkdown(
        embedRenderer(
          system,
          partials[system.declaration.markdownImagePartial ?? ""],
          images,
          where,
          diagnostics
        )
      ),
      diagnostics,
    };
    const context: TemplateContext = {
      "card-type": cardTypeId,
      system: system.id,
      language,
    };

    let html: string;
    try {
      html = template(context, { data: { [STATE_KEY]: state }, partials });
    } catch (error) {
      throw new Error(`${system.id}/${path}: ${describe(error)}`, { cause: error });
    }
    return stampRoot(html, cardSize, language, `${system.id}/${path}`, diagnostics);
  }

  private templatesOf(system: LoadedSystem): SystemTemplates {
    let templates = this.systems.get(system);
    if (!templates) {
      templates = new SystemTemplates(this.hb, system);
      this.systems.set(system, templates);
    }
    return templates;
  }
}

type Compiled = Handlebars.TemplateDelegate<TemplateContext>;

/**
 * One system's compiled templates: faces by path, compiled on first use;
 * the declared partials, compiled together on first use; and the assets
 * their `{{asset "…"}}` literals name, read once each, beside every asset
 * the root document names — a classifier's token, a property's default.
 *
 * The asset map grows as templates compile. A helper is synchronous and the
 * source is not, so the read has to happen before the render — and what it
 * can find is a literal in a template or a value in the document, which is
 * also all the loader checks. A path composed at render from anything else
 * cannot be served.
 */
class SystemTemplates {
  private readonly faces = new Map<string, Promise<Compiled>>();
  private declaredPartials?: Promise<Record<string, Compiled>>;
  private readonly assetReads = new Map<string, Promise<void>>();
  private documentAssets?: Promise<void>;
  readonly assets = new Map<string, Asset>();

  constructor(
    private readonly hb: typeof Handlebars,
    private readonly system: LoadedSystem
  ) {}

  face(path: SystemPath): Promise<Compiled> {
    let pending = this.faces.get(path);
    if (!pending) {
      pending = this.compile(path);
      this.faces.set(path, pending);
    }
    return pending;
  }

  partials(): Promise<Record<string, Compiled>> {
    if (!this.declaredPartials) {
      this.declaredPartials = (async () => {
        const out: Record<string, Compiled> = {};
        const declared = Object.entries(this.system.declaration.partialTemplates);
        const compiled = await Promise.all(
          declared.map(([, path]) => this.compile(path))
        );
        declared.forEach(([name], i) => (out[name] = compiled[i] as Compiled));
        return out;
      })();
    }
    return this.declaredPartials;
  }

  private async compile(path: SystemPath): Promise<Compiled> {
    const text = await this.system.source.readText(path);
    await this.readAssets(text);
    await this.readDocumentAssets();
    try {
      // Parsed eagerly so a syntax error surfaces here, with the path, rather
      // than at the first render.
      return this.hb.compile(this.hb.parse(text));
    } catch (error) {
      throw new Error(`${this.system.id}/${path}: ${describe(error)}`, { cause: error });
    }
  }

  /**
   * Read every asset a template names that is not in the map yet. A file the
   * source does not have is left out — the loader reported it when the
   * system loaded — and the helper reports the miss again at the call.
   */
  private async readAssets(hbs: string): Promise<void> {
    const paths: SystemPath[] = [];
    for (const ref of templateAssetReferences(hbs)) {
      const path = parseSystemPath(ref.path, ref.where, IGNORE_DIAGNOSTICS);
      if (path) paths.push(path);
    }
    await this.read(paths);
  }

  /** The assets the root document names, once. */
  private readDocumentAssets(): Promise<void> {
    if (!this.documentAssets) this.documentAssets = this.read(this.system.documentAssets);
    return this.documentAssets;
  }

  private async read(paths: readonly SystemPath[]): Promise<void> {
    const reads: Promise<void>[] = [];
    for (const path of paths) {
      if (this.assetReads.has(path)) continue;
      const read = readAsset(this.system.source, path).then(
        (asset) => {
          this.assets.set(path, asset);
        },
        (error: unknown) => {
          if (!(error instanceof MissingFileError)) throw error;
        }
      );
      this.assetReads.set(path, read);
      reads.push(read);
    }
    await Promise.all(reads);
  }
}

/**
 * What an `![[embed]]` in a body becomes: the system's markdown-image
 * partial when it declares one, called with `url`, `alt` and
 * `placement="body"` so a body picture gets the design's chrome; a bare
 * `<img class="cf-body-image">` otherwise. A picture the vault could not
 * answer is reported and shows as its alt text in a link span, so the miss
 * is visible on the card rather than a blank.
 */
function embedRenderer(
  system: LoadedSystem,
  partial: Compiled | undefined,
  images: ReadonlyMap<string, string>,
  where: string,
  diagnostics: Diagnostics
): (target: string, alt: string) => string {
  return (target, alt) => {
    const url = images.get(target.trim());
    if (url === undefined) {
      diagnostics.warn(
        `![[${target}]] in a body of ${where}: not a picture the vault has; showing its text`
      );
      return `<span class="cf-wikilink">${escapeHtml(alt)}</span>`;
    }
    if (partial) {
      return partial({ url, alt, placement: "body" } as unknown as TemplateContext);
    }
    return `<img class="cf-body-image" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
  };
}

/** The element every face starts with. */
const ROOT_CLASS = /class="card-root(?=[\s"])[^"]*"/;

/**
 * Give the root element its size and its language.
 *
 * The size is the one place a physical unit belongs on a face: everything
 * inside is `%` of the parent and `em`, and this is the parent. `lang` is
 * what lets `hyphens: auto` pick a dictionary. A face without the token is
 * reported and returned as it is.
 */
function stampRoot(
  html: string,
  size: CardSize,
  language: string,
  where: string,
  diagnostics: Diagnostics
): string {
  if (!ROOT_CLASS.test(html)) {
    diagnostics.warn(
      `${where}: no element carries class="card-root"; the face renders without a size`
    );
    return html;
  }
  const lang = language.replace(/[^A-Za-z0-9-]/g, "");
  const attributes =
    ` style="--card-width: ${size.width}mm; --card-height: ${size.height}mm;"` +
    (lang ? ` lang="${lang}"` : "");
  return html.replace(ROOT_CLASS, (token) => token + attributes);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
