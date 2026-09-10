/** Physical card geometry, in millimetres. */
export interface CardSize {
  width: number;
  height: number;
}

/** Named card sizes offered in the UI and accepted by `card-size:` in a note. */
export const CARD_PRESETS = {
  mini: { width: 44, height: 63 },
  bridge: { width: 57, height: 89 },
  poker: { width: 63, height: 88 },
  tarot: { width: 70, height: 120 },
  dixit: { width: 80, height: 120 },
  large: { width: 88.9, height: 127 },
} as const satisfies Record<string, CardSize>;

export type CardPreset = keyof typeof CARD_PRESETS;

export const DEFAULT_CARD_PRESET: CardPreset = "poker";

const DIMENSIONS = /^(\d+(?:\.\d+)?)\s*(?:mm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?$/i;

/**
 * Normalize a `card-size:` value into millimetres.
 *
 * Accepts a preset name (`"poker"`, case-insensitive) or explicit dimensions
 * (`"63x88"`, `"63 mm x 88 mm"`). Returns `undefined` for anything else, so the
 * next layer of the definition cascade can answer instead.
 */
export function parseCardSize(raw: unknown): CardSize | undefined {
  if (typeof raw !== "string") return undefined;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const preset = (Object.keys(CARD_PRESETS) as CardPreset[]).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase()
  );
  if (preset) return { ...CARD_PRESETS[preset] };

  const match = DIMENSIONS.exec(trimmed);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}
