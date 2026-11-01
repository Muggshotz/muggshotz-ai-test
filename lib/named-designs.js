// lib/named-designs.js
//
// NAMED MATS (Alyx, 1 Nov 2026: "the blank line will be an interface through
// which the customer can enter the name of their choice"). A pre-made design
// with a blank in it: the customer types a name on the occasion page, and the
// server letters it into the blank -- on the page's picture for the preview,
// on the print file for the order (api/named-print.js). The order carries no
// new field: its placements.left is the print's URL with the name in it, so
// checkout, the webhook and the Printify order are unchanged.
//
// Each design: its print and page pictures, the blank as fractions of the
// picture (left, top, right, bottom), the longest name the blank takes, and
// how it is lettered. The occasion file marks the design `named: true`
// (occasions/thanksgiving.js) and flow-tests/verify-named-print.mjs holds the
// two together.
import sharp from "sharp";
import { fileURLToPath } from "url";

// Bevan (OFL): the closest free face to the signs' own weathered slab capitals.
const BEVAN = fileURLToPath(new URL("./fonts/Bevan.ttf", import.meta.url));

export const NAMED_DESIGNS = {
  // ALL TURKEYS PLEASE USE REAR ENTRANCE / EXCEPT UNCLE ____ (Bud, 1 Nov 2026).
  // The name is lettered in the sign's black, no quotes, no underline (Alyx).
  "rear-entrance": {
    print: "art/thanksgiving-mats/print/rear-entrance.jpg",
    show: "art/thanksgiving-mats/show/rear-entrance.jpg",
    // Where Bud lettered NAMEGOESHERE on his redraw (1 Nov 2026); the
    // placeholder was painted out with the board's own texture.
    box: { x0: 0.515, y0: 0.705, x1: 0.935, y1: 0.805 },
    maxLen: 14, caps: true, color: "#1a1512",
    prompt: "Whose name goes on the sign?", placeholder: "Bob"
  }
};

/** The name as it will be lettered: trimmed, one space between words, capitals
 *  if the design wants them; "" when empty; null when it will not do. */
export function cleanName(raw, design) {
  const d = typeof design === "string" ? NAMED_DESIGNS[design] : design;
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (!/^[A-Za-z0-9 .'&-]+$/.test(s) || s.length > (d ? d.maxLen : 14)) return null;
  return d && d.caps ? s.toUpperCase() : s;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The picture (a buffer of the design's print or page file) with the name
 *  lettered into the blank. A blank name returns the picture as it is. */
export async function renderNamed(design, name, baseBuffer) {
  const d = typeof design === "string" ? NAMED_DESIGNS[design] : design;
  if (!d) throw new Error("Not a named design");
  const base = sharp(baseBuffer);
  const { width: W, height: H } = await base.metadata();
  if (!name) return base.jpeg({ quality: 92 }).toBuffer();
  const b = d.box, x0 = Math.round(W * b.x0), y0 = Math.round(H * b.y0), x1 = Math.round(W * b.x1), y1 = Math.round(H * b.y1);
  const boxW = x1 - x0, boxH = y1 - y0;
  // Lettered at the blank's height, then narrowed to its width if the name is long.
  let text = await sharp({ text: { text: `<span foreground="${d.color}">${esc(name)}</span>`, font: `Bevan ${Math.round(boxH * 1.35)}`, fontfile: BEVAN, rgba: true, dpi: 72 } }).png().toBuffer();
  let m = await sharp(text).metadata();
  const scale = Math.min(1, boxW / m.width, boxH / m.height);
  if (scale < 1) { text = await sharp(text).resize(Math.max(1, Math.round(m.width * scale)), Math.max(1, Math.round(m.height * scale))).png().toBuffer(); m = await sharp(text).metadata(); }
  // Flush left, so a short name follows the words before it as one sentence.
  const left = x0, top = y1 - m.height;
  // Multiplied onto the picture, so the sign's grain shows through the ink.
  return base.composite([{ input: text, left, top, blend: "multiply" }]).jpeg({ quality: 92 }).toBuffer();
}
