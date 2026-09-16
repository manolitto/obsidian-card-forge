/** Paper geometry in millimetres, and which way round the deck is imposed on it. */
export interface PaperSize {
  width: number;
  height: number;
  /** `auto` lets the deck pick whichever orientation fits more cards. */
  orientation: PaperOrientation;
}

export type PaperOrientation = "portrait" | "landscape" | "auto";

/** Named paper sizes accepted by `paper-size:` on a deck. Portrait dimensions. */
export const PAPER_PRESETS = {
  a3: { width: 297, height: 420 },
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
} as const satisfies Record<string, { width: number; height: number }>;

export type PaperPreset = keyof typeof PAPER_PRESETS;

export const DEFAULT_PAPER_PRESET: PaperPreset = "a4";

const DIMENSIONS = /^(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?$/i;
const ORIENTATIONS: readonly PaperOrientation[] = ["portrait", "landscape", "auto"];

/**
 * Normalize a `paper-size:` value.
 *
 * Accepts a preset name with an optional orientation (`"A4"`, `"A4 landscape"`,
 * case-insensitive) or explicit dimensions (`"210 x 297 mm"`), which are taken
 * as written — the wider way round is `landscape`. A preset alone means
 * `auto`. Returns `undefined` for anything else, so the layer below can answer
 * instead.
 */
export function parsePaperSize(raw: unknown): PaperSize | undefined {
  if (typeof raw !== "string") return undefined;

  const words = raw.trim().toLowerCase().split(/\s+/);
  if (words.length === 0 || words[0] === "") return undefined;

  const dims = DIMENSIONS.exec(raw.trim());
  if (dims) {
    const width = Number(dims[1]);
    const height = Number(dims[2]);
    return width > 0 && height > 0
      ? { width, height, orientation: width > height ? "landscape" : "portrait" }
      : undefined;
  }

  const preset = words[0] as PaperPreset;
  if (!(preset in PAPER_PRESETS)) return undefined;
  const orientation = words[1] as PaperOrientation | undefined;
  if (words.length > 2) return undefined;
  if (orientation !== undefined && !ORIENTATIONS.includes(orientation)) return undefined;
  return { ...PAPER_PRESETS[preset], orientation: orientation ?? "auto" };
}
