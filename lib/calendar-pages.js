// lib/calendar-pages.js
//
// DESK CALENDAR PAGES (22 Sep 2026). Printify's blank desk calendar (blueprint
// 1170) has thirteen print areas -- front_cover and january..december -- and
// NO date grids: every month's dates are ours to draw. Each page is 10 x 5 in
// (3075 x 1575): the customer's picture square on the left, the month on the
// right. The cover is the picture with the year across it.
//
// Text is drawn by sharp (Pango) from the DejaVu fonts bundled in lib/fonts,
// because Vercel's machines have no system fonts. DejaVu is free to
// redistribute (Bitstream Vera licence).
import sharp from "sharp";
import { fileURLToPath } from "url";

const FONT = fileURLToPath(new URL("./fonts/DejaVuSans.ttf", import.meta.url));
const FONT_BOLD = fileURLToPath(new URL("./fonts/DejaVuSans-Bold.ttf", import.meta.url));
const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const DAYS = ["S","M","T","W","T","F","S"];
const INK = "#1b2a4a", SOFT = "#7a8699", ACCENT = "#c0392b";

// The calendar year: next year from September on, this year before.
export function calendarYear(now = new Date()) {
  return now.getUTCMonth() >= 8 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function text(str, { size, bold = false, color = INK }) {
  return sharp({ text: {
    text: `<span foreground="${color}">${esc(str)}</span>`,
    font: `${bold ? "DejaVu Sans Bold" : "DejaVu Sans"} ${size}`,
    fontfile: bold ? FONT_BOLD : FONT,
    rgba: true, dpi: 72
  } }).png().toBuffer();
}
async function sizeOf(buf) { const m = await sharp(buf).metadata(); return { w: m.width, h: m.height }; }

async function picture(imageBuffer, w, h) {
  return sharp(imageBuffer).resize(w, h, { fit: "cover", position: "centre" }).png().toBuffer();
}

// Returns { position: pngBuffer } for all thirteen pages. only: a list of
// positions to build (the mockup builds the cover alone).
export async function buildCalendarPages(imageBuffer, W = 3075, H = 1575, year = calendarYear(), only = null) {
  const want = (p) => !only || only.includes(p);
  const out = {};
  if (want("front_cover")) {
    const pic = await picture(imageBuffer, W, H);
    const band = await sharp({ create: { width: W, height: Math.round(H * 0.2), channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.82 } } }).png().toBuffer();
    const yr = await text(String(year), { size: Math.round(H * 0.13), bold: true });
    const ys = await sizeOf(yr);
    out.front_cover = await sharp(pic).composite([
      { input: band, left: 0, top: H - Math.round(H * 0.2) },
      { input: yr, left: Math.round((W - ys.w) / 2), top: H - Math.round(H * 0.2) + Math.round((Math.round(H * 0.2) - ys.h) / 2) }
    ]).png().toBuffer();
  }
  const need = MONTHS.filter(want);
  if (!need.length) return out;
  // Shared glyphs, rendered once.
  const picSide = H;
  const pic = await picture(imageBuffer, picSide, H);
  const gridX = picSide + Math.round((W - picSide) * 0.08), gridW = Math.round((W - picSide) * 0.84);
  const cellW = Math.floor(gridW / 7), titleH = Math.round(H * 0.2), headH = Math.round(H * 0.09);
  const rowsTop = Math.round(H * 0.08) + titleH + headH, cellH = Math.floor((H - rowsTop - Math.round(H * 0.05)) / 6);
  const dayHead = await Promise.all(DAYS.map((d, i) => text(d, { size: Math.round(H * 0.045), bold: true, color: i === 0 ? ACCENT : SOFT })));
  const nums = {};
  for (let n = 1; n <= 31; n++) {
    nums[n] = await text(String(n), { size: Math.round(H * 0.05) });
    nums["s" + n] = await text(String(n), { size: Math.round(H * 0.05), color: ACCENT });
  }
  const centreIn = async (buf, x, y, w, h) => { const s = await sizeOf(buf); return { input: buf, left: x + Math.round((w - s.w) / 2), top: y + Math.round((h - s.h) / 2) }; };
  for (const m of need) {
    const mi = MONTHS.indexOf(m);
    const title = await text(`${m[0].toUpperCase() + m.slice(1)} ${year}`, { size: Math.round(H * 0.085), bold: true });
    const layers = [{ input: pic, left: 0, top: 0 }, await centreIn(title, gridX, Math.round(H * 0.08), gridW, titleH)];
    for (let i = 0; i < 7; i++) layers.push(await centreIn(dayHead[i], gridX + i * cellW, Math.round(H * 0.08) + titleH, cellW, headH));
    const first = new Date(Date.UTC(year, mi, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const slot = first + d - 1, col = slot % 7, row = Math.floor(slot / 7);
      layers.push(await centreIn(col === 0 ? nums["s" + d] : nums[d], gridX + col * cellW, rowsTop + row * cellH, cellW, cellH));
    }
    out[m] = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite(layers).png().toBuffer();
  }
  return out;
}
