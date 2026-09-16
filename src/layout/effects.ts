/*
 * The edge fade: a picture whose margins dissolve into the paper.
 *
 * A template marks an `<img>` with `.fade-edges`, and the stylesheet says
 * how far in the fade reaches with `--card-image-fade`, a fraction of the
 * picture's width and height. The fade is baked into the pixels here — the
 * image is drawn onto a canvas, its alpha multiplied by a gradient along
 * each axis, and the PNG that results replaces the `src` — rather than
 * drawn with a CSS mask: a gradient mask becomes a soft mask in the PDF,
 * and one PDF reader in common use paints those as grey rectangles. Pixels
 * with real transparency survive every renderer.
 *
 * The layout host runs this once the faces have settled, before anything
 * is measured, so the faded picture is what every surface gets in the
 * settled HTML — the export documents carry no script.
 */

const FADE_SELECTOR = "img.fade-edges";
const FADE_PROPERTY = "--card-image-fade";

/**
 * The longest edge of the canvas the fade is drawn on. A card shows a
 * picture a few hundred pixels tall at most, and encoding a phone photo's
 * twelve megapixels to PNG — synchronous, on the main thread — would take
 * seconds for no visible gain. Sources at or below the cap are drawn at
 * their own size; nothing is ever scaled up.
 */
export const MAX_FADE_CANVAS_EDGE = 1500;

/**
 * How far the fade reaches on `img`, as the stylesheet says: a fraction
 * in [0, 0.5]. Beyond a half the two gradient stops would cross and the
 * fade turn into a hard edge, so it is clamped there. Absent or
 * unreadable: 0, nothing to fade.
 */
export function readFade(img: HTMLImageElement): number {
  const win = img.ownerDocument.defaultView;
  if (!win) return 0;
  const raw = win.getComputedStyle(img).getPropertyValue(FADE_PROPERTY).trim();
  const fade = Number.parseFloat(raw);
  return Number.isFinite(fade) ? Math.max(0, Math.min(0.5, fade)) : 0;
}

/**
 * Bake the fade into one picture and put it back as a PNG data URI, its
 * size unchanged. Resolves once the new picture has decoded, so a
 * measurement taken next sees the final box. A picture that has not
 * loaded, has no pixels, or is set to fade nothing is left alone.
 */
export async function fadeImage(img: HTMLImageElement): Promise<void> {
  if (!img.complete) return;
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width === 0 || height === 0) return;
  const fade = readFade(img);
  if (fade === 0) return;

  const scale = Math.min(1, MAX_FADE_CANVAS_EDGE / Math.max(width, height));
  const canvas = img.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // `destination-in` keeps a pixel only as far as the fill is opaque, so
  // two passes — across, then down — multiply into a fade on all four
  // edges with the corners fading on both axes.
  ctx.globalCompositeOperation = "destination-in";
  for (const across of [true, false]) {
    const gradient = across
      ? ctx.createLinearGradient(0, 0, canvas.width, 0)
      : ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(fade, "rgba(0,0,0,1)");
    gradient.addColorStop(1 - fade, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  img.src = canvas.toDataURL("image/png");
  try {
    await img.decode();
  } catch {
    // A picture that will not decode is what it was; layout goes on.
  }
}

/** Fade every marked picture under `scope`. One that fails is skipped, not the batch. */
export async function fadeEdges(scope: ParentNode): Promise<void> {
  const images = scope.querySelectorAll<HTMLImageElement>(FADE_SELECTOR);
  await Promise.all(
    Array.from(images, (img) =>
      fadeImage(img).catch(() => {
        /* the picture stays as it was */
      })
    )
  );
}
