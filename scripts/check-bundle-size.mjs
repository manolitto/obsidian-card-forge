/*
 * The bundle-size budget.
 *
 * Every bundled system's fonts and images travel inside `main.js` as base64,
 * so the bundle grows silently whenever a system gains an asset. The budget
 * is a ratchet, not a target: lower it whenever the bundle shrinks, and never
 * raise it without the commit message saying what the new bytes are for.
 *
 * Runs after `npm run build`; fails the build when `main.js` is over budget.
 */

import { statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Hard ceiling in KiB. */
const BUDGET_KIB = 3950;

const path = resolve(ROOT, "main.js");
let bytes;
try {
  bytes = statSync(path).size;
} catch {
  console.error("check-bundle-size: main.js not found — run `npm run build` first.");
  process.exit(1);
}

const kib = bytes / 1024;
const line = `main.js: ${kib.toFixed(0)} KiB (budget ${BUDGET_KIB} KiB)`;

if (kib > BUDGET_KIB) {
  console.error(`${line} — OVER BUDGET`);
  process.exit(1);
}
console.log(line);
