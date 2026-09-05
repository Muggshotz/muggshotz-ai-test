// BUILD MARKER: cambridge-blue-fix-aug24-2026
// BUILD-MARKER: LIVE-EXACT-MUG-VARIANT-RESOLUTION-v4
// If you can see this comment on GitHub, this exact paste landed.
import sharp from "sharp";
import { getProduct } from "../lib/products-catalog.js";

const SHOP_ID = "27439202";

// EVERY image bound for Printify is compressed here, on its way out (Alyx's
// request: "compress it to its smallest possible size without losing image
// resolution"). Resolution is never traded away except as a last-resort guard
// rail that realistic artwork does not reach.
//
// Why this exists: Printify rejects oversized uploads with {"error":"The POST
// data is too large."}, and the payload is base64, which inflates a buffer by
// ~37% before the JSON envelope. It never surfaced while the catalogue was
// mugs -- a mug print area is 2475x1155, about 2.9 megapixels. Every large
// format added since is far bigger: a 12x18 poster is 19.4 MP, an 18x24 is
// 38.9, a 24x36 is 77.8, the 1000-piece puzzle is 50.4, a large suitcase is
// 69.0. As lossless PNG those run from tens of MB into the hundreds. Alyx hit
// it on a live suitcase run.
//
// Measured on art-like content at FULL print resolution: a 24x36 poster is
// 4.03 MB as PNG and 0.91 MB as JPEG q95; the large suitcase, 3.59 MB against
// 0.86. So quality-95 JPEG at native size is both far smaller than the PNG and
// nowhere near any limit -- downscaling is not needed and is not done.
//
// Guarded HERE, not in buildSingleImage(), because every image reaching
// Printify passes through this one function -- the mockup path and the real
// order path, single-image and wraparound alike. Fixing it at one of the five
// call sites would have left the other four broken.
const PRINTIFY_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const PRINTIFY_JPEG_QUALITY = 92;

async function compressForPrintify(imageBuffer, fileName) {
  let meta;
  try {
    meta = await sharp(imageBuffer).metadata();
  } catch (err) {
    console.error(`Printify upload: could not read image metadata, sending as-is: ${err.message}`);
    return { buffer: imageBuffer, fileName };
  }

  // Already lossy and already small enough: send it untouched. buildSingleImage
  // now hands over a finished JPEG, and re-encoding a JPEG would cost seconds
  // of CPU only to degrade it a second time. Just make sure the extension
  // matches what is actually in the buffer, since callers name everything .png.
  if ((meta.format === "jpeg" || meta.format === "jpg") && imageBuffer.length <= PRINTIFY_MAX_UPLOAD_BYTES) {
    return { buffer: imageBuffer, fileName: fileName.replace(/\.png$/i, ".jpg") };
  }

  // Transparency must survive. A mug wraparound composited over a transparent
  // background would render its gaps as solid black under JPEG, so anything
  // carrying an alpha channel stays PNG and is merely packed tighter.
  if (meta.hasAlpha) {
    const packed = await sharp(imageBuffer).png({ compressionLevel: 9, effort: 10 }).toBuffer();
    const out = packed.length < imageBuffer.length ? packed : imageBuffer;
    if (out.length > PRINTIFY_MAX_UPLOAD_BYTES) {
      console.error(
        `Printify upload: "${fileName}" has alpha and is ${(out.length / 1048576).toFixed(1)}MB ` +
        `after PNG packing — above the ${PRINTIFY_MAX_UPLOAD_BYTES / 1048576}MB ceiling. Sending anyway.`
      );
    }
    return { buffer: out, fileName };
  }

  const jpegName = fileName.replace(/\.png$/i, ".jpg");
  // No mozjpeg: it compresses perhaps 20% better but took 9.9s on a 77.8MP
  // canvas against 2.8s for standard libjpeg. Not worth the wait when the
  // result already fits comfortably.
  const encode = (quality) =>
    sharp(imageBuffer).jpeg({ quality, chromaSubsampling: "4:4:4" }).toBuffer();

  let out = await encode(PRINTIFY_JPEG_QUALITY);

  // Last-resort guard rail. Realistic artwork never gets here -- only genuinely
  // incompressible content (heavy noise, dense fine detail) could. Quality is
  // stepped down first; resolution is only touched once quality is exhausted.
  if (out.length > PRINTIFY_MAX_UPLOAD_BYTES) {
    for (const quality of [90, 85, 80]) {
      out = await encode(quality);
      if (out.length <= PRINTIFY_MAX_UPLOAD_BYTES) {
        console.log(`Printify upload: "${jpegName}" needed q${quality} to fit (unusual — check the source art).`);
        break;
      }
    }
  }
  if (out.length > PRINTIFY_MAX_UPLOAD_BYTES && meta.width) {
    for (const scale of [0.8, 0.65, 0.5]) {
      out = await sharp(imageBuffer)
        .resize(Math.round(meta.width * scale), null, { withoutEnlargement: true })
        .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
        .toBuffer();
      if (out.length <= PRINTIFY_MAX_UPLOAD_BYTES) {
        console.error(
          `Printify upload: "${jpegName}" could not fit at full resolution and was reduced to ` +
          `${Math.round(scale * 100)}% (${meta.width}x${meta.height} source). Print quality is degraded.`
        );
        break;
      }
    }
  }

  if (imageBuffer.length > 1048576 || out.length > 1048576) {
    console.log(
      `Printify upload: ${fileName} ${(imageBuffer.length / 1048576).toFixed(2)}MB -> ` +
      `${(out.length / 1048576).toFixed(2)}MB (${meta.width}x${meta.height} kept)`
    );
  }
  return { buffer: out, fileName: jpegName };
}

export async function uploadImageToPrintify(rawBuffer, rawFileName) {
  const { buffer: imageBuffer, fileName } = await compressForPrintify(rawBuffer, rawFileName);
  const base64Data = imageBuffer.toString("base64");
  const response = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file_name: fileName,
      contents: base64Data
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify image upload failed: " + JSON.stringify(data));
  return data.id;
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Image must be a base64 data URL.");
  return Buffer.from(match[1], "base64");
}

async function resolveImageBuffer(source) {
  if (source.startsWith("data:")) {
    return dataUrlToBuffer(source);
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not fetch design image: ${source}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getPlaceholderDimensions(blueprintId, printProviderId, variantId, position) {
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));
  const variant = (data.variants || []).find(v => v.id === variantId);
  if (!variant || !variant.placeholders) {
    throw new Error(`No placeholders found for variant ${variantId}`);
  }
  const ph = position
    ? variant.placeholders.find(p => p.position === position)
    : variant.placeholders[0];
  if (!ph) throw new Error(`No "${position || "default"}" placeholder found for variant ${variantId}`);
  return { width: ph.width, height: ph.height, position: ph.position };
}

const PRINT_PROVIDER_ID_CACHE = {};

async function resolvePrintProviderId(blueprintId, providerNameHint) {
  if (PRINT_PROVIDER_ID_CACHE[blueprintId]) return PRINT_PROVIDER_ID_CACHE[blueprintId];
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch print providers: " + JSON.stringify(data));
  const match = (providerNameHint
    ? data.find(p => p.title?.toLowerCase().includes(providerNameHint.toLowerCase()))
    : null) || data[0];
  if (!match) throw new Error(`No print providers found for blueprint ${blueprintId}`);
  PRINT_PROVIDER_ID_CACHE[blueprintId] = match.id;
  return match.id;
}

// Now exported — reused directly by placeProductOrder() below for
// travel-mug-20oz, which (like photo-poster's unresolved sizes) has no
// hardcoded variantId in the catalog and needs it looked up live by name.
// ALSO reused (July 2026, Alyx's request) by resolveVariant() below as a
// generic fallback for any catalog color entry missing a hardcoded
// variantId — e.g. a color just confirmed to exist on Printify but not
// yet manually looked up. Lets a color go live immediately from just its
// name, no manual ID-hunting required, then be backfilled with the real
// number later if ever needed for speed.
export async function resolveVariantIdByTitleMatch(blueprintId, printProviderId, matchTerms) {
  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));
  const variant = (data.variants || []).find(v =>
    matchTerms.every(term => v.title?.toLowerCase().includes(term.toLowerCase()))
  );
  if (!variant) throw new Error(`No Printify variant matched [${matchTerms.join(", ")}] for blueprint ${blueprintId}`);
  return variant.id;
}

// NEW (Aug 2026): exact live resolver for colored coffee mugs. The older
// title matcher above intentionally uses substring matching because several
// non-mug callers need that flexibility. That is unsafe for mug colors:
// "Blue" is a substring of "Light Blue" / "Cambridge Blue", and "Green"
// is a substring of "Light Green". This helper treats Printify's slash/pipe/
// comma-separated variant title options as discrete values and requires an
// EXACT option match for both size and color. It is deliberately used only
// by colored coffee mugs below.
const EXACT_VARIANT_CACHE = new Map();

function normalizeVariantOption(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(\d+)\s*oz\b/g, '$1oz')
    .replace(/\s+/g, ' ');
}

function splitVariantTitleOptions(title) {
  return String(title || '')
    .split(/\s*(?:\/|\||,|;)\s*/g)
    .map(normalizeVariantOption)
    .filter(Boolean);
}

export async function resolveVariantIdByExactOptions(blueprintId, printProviderId, optionTerms) {
  const normalizedTerms = optionTerms.map(normalizeVariantOption);
  const cacheKey = `${blueprintId}:${printProviderId}:${normalizedTerms.join('|')}`;
  if (EXACT_VARIANT_CACHE.has(cacheKey)) return EXACT_VARIANT_CACHE.get(cacheKey);

  const response = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    { headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error("Failed to fetch blueprint variants: " + JSON.stringify(data));

  const matches = (data.variants || []).filter(v => {
    const parts = splitVariantTitleOptions(v.title);
    return normalizedTerms.every(term => parts.includes(term));
  });

  if (matches.length === 0) {
    throw new Error(`Printify does not currently list an exact ${optionTerms.join(' / ')} variant for blueprint ${blueprintId}. No substitute color was used.`);
  }
  if (matches.length > 1) {
    throw new Error(`Printify returned more than one exact ${optionTerms.join(' / ')} variant for blueprint ${blueprintId}; refusing to guess.`);
  }

  EXACT_VARIANT_CACHE.set(cacheKey, matches[0].id);
  return matches[0].id;
}

export async function resolvePhotoPosterSelection(product, { framed, sizeLabel, orientation, finish, frameColor }) {
  if (framed) {
    const tree = product.framedUpsell;
    const sizeEntry = tree.sizes[sizeLabel];
    if (!sizeEntry) throw new Error(`Unknown framed poster size "${sizeLabel}".`);
    if (!frameColor) throw new Error("A frame color selection is required.");
    const colorEntry = sizeEntry.colors.find(c => c.name === frameColor);
    if (!colorEntry) throw new Error(`Unknown frame color "${frameColor}" for size "${sizeLabel}".`);
    return {
      variantId: colorEntry.variantId,
      price: sizeEntry.price,
      blueprintId: tree.blueprintId,
      printProviderId: tree.printProviderId,
      aspectRatio: sizeEntry.aspectRatio
    };
  }

  const tree = product.base;
  const sizeEntry = tree.sizes[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown poster size "${sizeLabel}".`);
  if (!orientation || !sizeEntry.orientations.includes(orientation)) {
    throw new Error(`Unknown or missing orientation "${orientation}" for size "${sizeLabel}".`);
  }
  if (!finish || !tree.finishes.includes(finish)) {
    throw new Error(`Unknown or missing finish "${finish}".`);
  }

  const printProviderId = tree.printProviderId || await resolvePrintProviderId(tree.blueprintId, "Prima Printing");

  const variantKey = `${orientation.toLowerCase()}${finish}`;
  let variantId = sizeEntry.variantIds?.[variantKey];

  if (!variantId) {
    const [a, b] = sizeLabel.split("x").map(s => s.trim());
    const dimsTerm = orientation === "Vertical" ? `${a}" x ${b}"` : `${b}" x ${a}"`;
    variantId = await resolveVariantIdByTitleMatch(tree.blueprintId, printProviderId, [dimsTerm, orientation, finish]);
  }

  return {
    variantId,
    price: sizeEntry.price,
    blueprintId: tree.blueprintId,
    printProviderId,
    aspectRatio: sizeEntry.aspectRatio
  };
}

// Where a photo of imgW x imgH lands inside a boxW x boxH print area for a
// given zoom (0.5..2) and offset (-1..1 per axis). Returns the drawn size
// and the top-left corner relative to the box (negative = hangs outside).
// zoom >= 1: the photo covers the box, so at least one axis overflows and
// gets cropped. zoom < 1: the whole photo fits inside with white around it.
// offX/offY = +1 pushes the photo right/down as far as the slack allows,
// -1 left/up, 0 centered. MIRRORED VERBATIM in needles-studio.html
// (computePanelFit) -- the customer's on-screen box is only honest if
// both sides do the same arithmetic. Change one, change both.
export function computePanelFit(imgW, imgH, boxW, boxH, zoom, offX, offY) {
  const base = zoom >= 1
    ? Math.max(boxW / imgW, boxH / imgH)
    : Math.min(boxW / imgW, boxH / imgH);
  const scale = base * zoom;
  const w = Math.max(1, Math.round(imgW * scale));
  const h = Math.max(1, Math.round(imgH * scale));
  const left = Math.round((boxW - w) / 2 + offX * Math.abs(boxW - w) / 2);
  const top = Math.round((boxH - h) / 2 + offY * Math.abs(boxH - h) / 2);
  return { w, h, left, top };
}

export async function buildWraparoundImage(placements, canvasWidth, canvasHeight, borderHex = null, adjustments = {}) {
  const { left, front, right } = placements;
  const WHITE = { r: 255, g: 255, b: 255 };
  const sectionWidth = Math.round(canvasWidth / 3);
  const lastSectionWidth = canvasWidth - sectionWidth * 2;

  const filledFlags = { left: !!left, front: !!front, right: !!right };
  const filledCount = Object.values(filledFlags).filter(Boolean).length;

  // UPDATED (Aug 2026, Alyx's request): the zoom that used to be applied
  // uniformly to the WHOLE composited 3-panel canvas via Printify's own
  // placement scale has moved in here instead, applied per-panel. A
  // single whole-canvas zoom doesn't know where the panel seams are --
  // magnifying everything around one shared center can push any one
  // panel's own content past ITS true edge (e.g. the panel next to the
  // handle), which is exactly the truncation Alyx caught. Scaling each
  // panel independently within its own box guarantees no panel's
  // content can ever spill past its own boundary, no matter how
  // aggressive the zoom gets. Printify's own imageScale for coffee mugs
  // is back to 1 (see isCoffeeMug in the two files that call this) so
  // the zoom only ever happens once, here, not twice.
  //
  // UPDATED again: after real testing through 1.2 -> 1.05 -> 1.0 (with
  // fill-count-dependent scaling built across two rounds), Alyx
  // confirmed via a fresh committed test that it was STILL too big --
  // landed back on a flat 0.8 across every fill-count case, matching
  // what he'd already concluded before this whole tuning arc started.
  //
  // UPDATED (Aug 2026, border feature): with the new colored border
  // tracing each panel's true edge, 0.8 left a wide white gap between
  // the art and the border -- pushed to 0.92, still safely inside the
  // zoom<1 branch's contain-fit behavior (nothing ever gets cropped at
  // any value below 1, only the size of the white buffer changes), so
  // this can't reintroduce the truncation problem. Leaves a small,
  // deliberate buffer between the art and the border -- close, not
  // touching.
  //
  // TRIED a filledCount===3 special case reverting to 0.92 here, on the
  // theory that with no widening to reclaim, a full fill would crowd the
  // border against the seam between panels. Alyx tested it on a real
  // 3-panel mockup and it was still smaller than he wanted -- the theory
  // didn't hold up against the actual photo. Back to a flat 1 for every
  // fill count.
  //
  // UPDATED (Sep 2026, per-panel Adjust sliders): this flat default is
  // now only the FALLBACK for a panel the customer never touched --
  // `adjustments[pos]` (zoom/offX/offY, from the panel-selection screen's
  // Adjust sliders) overrides it per panel when present. A photo that
  // isn't a portrait/face (a landscape, a pet, a product shot) can crop
  // badly under a fixed centered zoom with no way for the customer to
  // see or fix it before the physical mug arrives -- these sliders are
  // the fix, and they have to reach all the way here to mean anything.
  const PANEL_ZOOM = 1;

  const baseSlots = {
    left: { x: 0, width: sectionWidth },
    front: { x: sectionWidth, width: sectionWidth },
    right: { x: sectionWidth * 2, width: lastSectionWidth }
  };

  // UPDATED (July 2026, Alyx's request; extended Aug 2026): when a slot
  // is empty, its space shouldn't just sit reserved and unused -- it
  // should go to whichever filled neighbor(s) are actually adjacent to
  // it. Previously this ONLY triggered when exactly one slot total was
  // filled; a customer with two panels filled (one empty) got no extra
  // room at all, wasting the empty third's space even though nothing
  // was competing for it. Now handles both 1-filled (existing) and
  // 2-filled (new) cases; 3-filled keeps the exact fixed thirds,
  // unaffected, since there's no empty space to reclaim.
  function computeBoxes() {
    if (filledCount === 3 || filledCount === 0) {
      return baseSlots;
    }
    if (filledCount === 1) {
      const key = filledFlags.left ? "left" : filledFlags.front ? "front" : "right";
      const slot = baseSlots[key];
      const centerX = slot.x + slot.width / 2;
      const widenedWidth = Math.min(canvasWidth, Math.round(slot.width * 1.8));
      let x = Math.round(centerX - widenedWidth / 2);
      if (x < 0) x = 0;
      if (x + widenedWidth > canvasWidth) x = canvasWidth - widenedWidth;
      return { [key]: { x, width: widenedWidth } };
    }
    // filledCount === 2 -- find the one empty slot and give its space
    // to its neighbor(s).
    if (!filledFlags.left) {
      // left empty -- only front is adjacent to it, front absorbs it.
      const boxes = {};
      boxes.front = { x: 0, width: sectionWidth + sectionWidth };
      if (filledFlags.right) boxes.right = baseSlots.right;
      return boxes;
    }
    if (!filledFlags.right) {
      // right empty -- only front is adjacent to it, front absorbs it.
      const boxes = {};
      boxes.left = baseSlots.left;
      boxes.front = { x: sectionWidth, width: sectionWidth + lastSectionWidth };
      return boxes;
    }
    // front empty -- it's adjacent to BOTH left and right, split its
    // space between them down the middle.
    const half = Math.round(sectionWidth / 2);
    return {
      left: { x: 0, width: sectionWidth + half },
      right: { x: sectionWidth + half, width: canvasWidth - (sectionWidth + half) }
    };
  }

  const boxes = computeBoxes();

  // Alyx's request: a thin single-color border traced around each
  // filled panel's own content, in whatever color the customer picked
  // for the mug's trim/accent -- gives the art a clean, definite edge
  // instead of just sitting as a bare rectangle on the mug. No color
  // selected (e.g. Classic White, which has no trim/accent option) ->
  // no border at all, borderHex stays null and this is skipped
  // entirely. Deliberately plain: a solid stroke, no ornamentation,
  // sized as a small fraction of the panel so it reads as a clean line
  // regardless of the print's actual resolution.
  function buildBorderSvg(width, height, hex, strokeWidth) {
    return Buffer.from(
      `<svg width="${width}" height="${height}"><rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${width - strokeWidth}" height="${height - strokeWidth}" fill="none" stroke="${hex}" stroke-width="${strokeWidth}"/></svg>`
    );
  }

  async function applyBorderIfNeeded(buffer, width, height) {
    if (!borderHex) return buffer;
    const strokeWidth = Math.max(6, Math.round(Math.min(width, height) * 0.008));
    return await sharp(buffer)
      .composite([{ input: buildBorderSvg(width, height, borderHex, strokeWidth), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  async function renderSection(imageSource, box, pos) {
    if (!imageSource || !box) return null;
    const targetW = box.width;
    const targetH = canvasHeight;
    const adjust = adjustments[pos] || {};
    // Clamp defensively -- this crosses an HTTP boundary from client input,
    // so a stray/garbled value can't zoom to absurdity or divide by zero.
    const zoom = Math.min(2, Math.max(0.5, Number(adjust.zoom) || PANEL_ZOOM));
    // -1..1: how far to push the image toward one edge, as a fraction of
    // the room actually available at this zoom. 0 is dead center, same as
    // the old fixed behavior when a panel is never touched.
    const offX = Math.min(1, Math.max(-1, Number(adjust.offX) || 0));
    const offY = Math.min(1, Math.max(-1, Number(adjust.offY) || 0));

    // REWRITTEN (Sep 2026, "Fit your picture" screen). The old version
    // cover-fitted the photo into the box and only let the offset move
    // within the extra room the ZOOM added -- so a wide photo in a tall
    // box lost its sides symmetrically and no slider could bring either
    // side back. The fit is now computed from the photo's real dimensions
    // (computePanelFit, mirrored exactly in needles-studio.html so the
    // on-screen box shows what will print), and the offset ranges over
    // ALL the overflow, aspect mismatch included. Zoom >= 1 covers the
    // box (some of the photo is cropped); zoom < 1 shrinks the whole
    // photo inside it on white. Either way the piece that lands inside
    // the box is what prints.
    const srcBuffer = await resolveImageBuffer(imageSource);
    const meta = await sharp(srcBuffer).rotate().metadata();
    const imgW = meta.width || targetW;
    const imgH = meta.height || targetH;
    const fit = computePanelFit(imgW, imgH, targetW, targetH, zoom, offX, offY);
    const cropLeft = Math.max(0, -fit.left);
    const cropTop = Math.max(0, -fit.top);
    const pasteLeft = Math.max(0, fit.left);
    const pasteTop = Math.max(0, fit.top);
    const visW = Math.max(1, Math.min(fit.w - cropLeft, targetW - pasteLeft));
    const visH = Math.max(1, Math.min(fit.h - cropTop, targetH - pasteTop));
    const piece = await sharp(srcBuffer)
      .rotate()
      .resize(fit.w, fit.h, { fit: "fill" })
      .extract({ left: cropLeft, top: cropTop, width: visW, height: visH })
      .png()
      .toBuffer();
    const buffer = await sharp({
      create: { width: targetW, height: targetH, channels: 3, background: WHITE }
    })
      .composite([{ input: piece, left: pasteLeft, top: pasteTop }])
      .png()
      .toBuffer();
    return { input: await applyBorderIfNeeded(buffer, targetW, targetH), left: box.x, top: 0 };
  }

  const [leftComposite, frontComposite, rightComposite] = await Promise.all([
    renderSection(left, boxes.left, "left"),
    renderSection(front, boxes.front, "front"),
    renderSection(right, boxes.right, "right")
  ]);

  const composites = [leftComposite, frontComposite, rightComposite].filter(Boolean);

  return await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: WHITE }
  })
    .composite(composites)
    .png()
    .toBuffer();
}

export async function buildFullBleedImage(imageSource, canvasWidth, canvasHeight) {
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

// NEW (July 2026, Alyx's request): the customer-facing "Wraparound"
// print mode (auto-generated three-panel continuous scene) was sharing
// buildFullBleedImage's cover-fit crop -- same head-cropping bug as the
// three-slot-wrap fix, just reached through a different code path
// (printMode === "fullBleed"), which is why lowering the Printify
// placement scale didn't help: the crop was already baked into the
// print file before it ever reached Printify. This function uses
// contain-fit instead, so nothing gets cropped away. Deliberately kept
// SEPARATE from buildFullBleedImage -- that one's cover-fit crop-to-fill
// behavior is reserved for the future Ewww Stew line, where designs are
// supposed to intentionally overflow past the print margins. Only
// printMode === "allCup" should ever call buildFullBleedImage going
// forward; printMode === "fullBleed" (the Wraparound scene-continuation
// customers actually use today) calls this one instead.
export async function buildSeamlessWrapImage(placements, canvasWidth, canvasHeight) {
  // UPDATED (Aug 2026, Alyx's request/correction): a real single-angle
  // photo of a wraparound mug can only ever show roughly 85-90% of its
  // true circumference -- the outer few percent on each side always
  // curves out of camera view, no matter how the print itself is
  // composed. An earlier attempt shrank the whole framed image and
  // padded the edges white -- but that scales frame and photo down
  // together, so the frame's proportion of the visible area never
  // actually changes (confirmed by Alyx as no visible difference).
  // This instead crops the outer edges off the already-framed image
  // and stretches what remains back out to fill the full true width --
  // removes the always-invisible sliver entirely, and whatever frame
  // border material was just inside it now reaches the true edge with
  // no white gap and no bare unframed edge. 10% total (5% each side)
  // chosen as a reasonable starting estimate -- may need a small
  // adjustment up or down after seeing a real printed/photographed
  // result.
  //
  // FIXED (Aug 2026): this used to take a single imageSource (just
  // placements.front, falling back to left/right) and crop/resize that
  // one panel alone. But compositeFrameAcrossThreePanels on the client
  // only draws the frame border on each panel's TRUE outer edge (left
  // panel's left edge, right panel's right edge, and top/bottom on
  // all three) -- the seams between panels are deliberately left
  // unframed so the wraparound scene reads as continuous. Using only
  // the center panel meant its only real edges (left+right) were both
  // unframed internal seams, so the frame never appeared in the final
  // Printify mockup at all -- root cause of "the frame disappears."
  // Fix: take the full `placements` object and reassemble left+front+
  // right back into one continuous strip before cropping/resizing.
  // Since the client slices the true combined+framed panorama into
  // these exact three same-height, same-width thirds with zero
  // overlap, placing them back edge-to-edge reconstructs that same
  // original combined image -- frame and all.
  const WHITE = { r: 255, g: 255, b: 255 };
  const { left, front, right } = placements;
  const sources = [left, front, right].filter(Boolean);
  if (sources.length === 0) throw new Error("No design provided for seamless wrap.");

  const buffers = await Promise.all(sources.map(s => resolveImageBuffer(s)));
  const metas = await Promise.all(buffers.map(b => sharp(b).metadata()));
  const panelHeight = metas[0].height;
  let x = 0;
  const composites = buffers.map((buf, i) => {
    const c = { input: buf, left: x, top: 0 };
    x += metas[i].width;
    return c;
  });
  const stripBuffer = await sharp({
    create: { width: x, height: panelHeight, channels: 3, background: WHITE }
  })
    .composite(composites)
    .png()
    .toBuffer();

  return await finishWrapStrip(stripBuffer, canvasWidth, canvasHeight);
}

// THE UNCUT PANORAMA GOES STRAIGHT THROUGH. Alyx: "Why you keep talking about
// cutting and the cutting tool and piecing it together it's supposed to be one
// long panel."
//
// It is, and Printify agrees: every mug blueprint we sell exposes exactly ONE
// print area (bp 478 front 2475x1155, bp 1151 front 2538x1211, bp 2692 and
// 2693 front 2538x1088, and the 15oz of each at 2475x1275). There is no
// left/centre/right slot anywhere in their catalogue. The three-way split was
// ours, and on the panorama path it was a round trip: cut one wide image into
// thirds, then glue the thirds back edge-to-edge to send one wide image.
//
// So when the client has an uncut panorama it hands that over instead, and the
// strip step is simply skipped. Everything downstream -- the 10% circumference
// crop, the explicit aspect-match crop, the pure-stretch resize -- is the same
// code as the reassembled path, deliberately, so the two cannot drift apart.
//
// buildSeamlessWrapImage above stays for the paths that really do hold three
// separate pictures: Three Panels mode, and the classic per-panel fallback
// when the panorama call fails.
export async function buildSeamlessWrapFromPanorama(panoramaSource, canvasWidth, canvasHeight) {
  if (!panoramaSource) throw new Error("No panorama provided for seamless wrap.");
  const stripBuffer = await resolveImageBuffer(panoramaSource);
  return await finishWrapStrip(stripBuffer, canvasWidth, canvasHeight);
}

// The shared tail: takes ONE wide strip, however it was arrived at, and fits
// it to the print canvas.
async function finishWrapStrip(stripBuffer, canvasWidth, canvasHeight) {
  const CROP_FRACTION = 0.10;
  const meta = await sharp(stripBuffer).metadata();
  // Intentional circumference-compensation crop (10% total, 5% each side).
  const preCropWidth = Math.round(meta.width * (1 - CROP_FRACTION));
  const preCropLeft = Math.round((meta.width - preCropWidth) / 2);

  // FIXED (Aug 2026, found via Alyx watching the actual pre-mockup image):
  // this used to hand the 10%-cropped strip straight to .resize(...,
  // {fit:"cover"}) -- but "cover" is allowed to crop AGAIN, silently,
  // whenever the cropped strip's aspect ratio doesn't already exactly
  // match the target print canvas (which it essentially never does --
  // a 3-panel panorama is far wider than almost any mug print area).
  // That silent second crop undid part of the 5%-per-side compensation
  // we'd already carefully accounted for client-side (see
  // drawFrameOnCanvas's insetFractionX), re-cutting into the frame
  // border a second time in a spot nothing upstream could see or
  // predict. Fix: explicitly crop the REST of the way to the target
  // aspect ratio ourselves, evenly from both sides, so the final
  // .resize() is a pure stretch with zero cropping left for it to do.
  const targetAspect = canvasWidth / canvasHeight;
  const preCropAspect = preCropWidth / meta.height;
  let cropLeft = preCropLeft, cropWidth = preCropWidth, cropTop = 0, cropHeight = meta.height;
  if (preCropAspect > targetAspect) {
    cropWidth = Math.round(meta.height * targetAspect);
    cropLeft = preCropLeft + Math.round((preCropWidth - cropWidth) / 2);
  } else if (preCropAspect < targetAspect) {
    cropHeight = Math.round(preCropWidth / targetAspect);
    cropTop = Math.round((meta.height - cropHeight) / 2);
  }
  return await sharp(stripBuffer)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    // "fill" is now safe (no distortion) since the extract above already
    // matches canvasWidth/canvasHeight's exact aspect ratio -- this is
    // purely a scale, not a second crop.
    .resize(canvasWidth, canvasHeight, { fit: "fill" })
    .png()
    .toBuffer();
}
// Encodes JPEG directly rather than building a full-resolution PNG and
// re-compressing it afterwards. Measured on a 24x36 poster (77.8 megapixels,
// the largest print area in the catalogue): the old two-step path spent 2.6s
// building a 24.85MB PNG and a further 9.9s re-encoding it with mozjpeg, 12.6s
// in total. One pipeline at q92 produces a SMALLER file, 3.93MB, in 2.8s --
// about four and a half times faster for a better result.
//
// The canvas is contain-fitted onto solid white, so there is no alpha to lose
// and JPEG is safe here. 4:4:4 chroma keeps full colour resolution, which
// matters for print: the default 4:2:0 would throw away three quarters of the
// colour detail to save about half a megabyte.
export async function buildSingleImage(imageSource, canvasWidth, canvasHeight) {
  const WHITE = { r: 255, g: 255, b: 255 };
  return await sharp(await resolveImageBuffer(imageSource))
    .resize(canvasWidth, canvasHeight, { fit: "contain", background: WHITE })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// UPDATED (Aug 2026, Alyx's request): switched from "contain" (shrink
// the whole composited image to fit inside the print area, padding the
// leftover space with white) to "cover" (fill the print area completely,
// cropping only what doesn't fit). Root cause: the AI-generated canvas
// for front-back products (1024x1536, a tall 0.667 aspect ratio) never
// matches the real Printify print area (900x1200 for the 40oz, a
// squarer 0.75 ratio) -- "contain" was shrinking the whole design down
// and padding it with a visible white border on the real printed/
// mockup output, confirmed live on a 40oz Parisian Balcony Window Sill
// test. "cover" is also consistent with how Window Sill already treats
// photo-fit elsewhere in the app (fills the opening completely, crops
// like a real window, never pads with white) -- this just applies the
// same philosophy at the final Printify-placement layer. Only affects
// front-back layoutType products (currently just the 40oz); every other
// layoutType (three-slot-wrap, single-image, full-bleed) is untouched.
export async function buildFrontBackImages(frontSource, backSource, frontDims, backDims) {
  async function build(source, dims) {
    if (!source || !dims) return null;
    return await sharp(await resolveImageBuffer(source))
      .resize(dims.width, dims.height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }
  const [frontBuf, backBuf] = await Promise.all([
    build(frontSource, frontDims),
    build(backSource, backDims)
  ]);
  return { frontBuf, backBuf };
}

// UPDATED (July 2026, Alyx's request): now ASYNC. A color entry in the
// catalog can be added with variantId left out (null/undefined) the
// moment it's confirmed to exist on Printify -- this function then
// resolves the real numeric variant ID live, by matching the size and
// color name against Printify's own variant titles for that blueprint/
// provider (same resolveVariantIdByTitleMatch() helper travel-mug-20oz
// already relies on). This means a newly-confirmed color can go live
// immediately from just its name, with no manual ID lookup required.
// Every color that already has a real variantId hardcoded is completely
// unaffected -- this fallback only ever runs when one is missing.
export async function resolveVariant(product, sizeLabel, colorName) {
  const sizeEntry = product.sizes?.[sizeLabel];
  if (!sizeEntry) throw new Error(`Unknown size "${sizeLabel}" for this product.`);

  if (sizeEntry.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = sizeEntry.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}" for size "${sizeLabel}".`);

    // UNIVERSAL COLORED-COFFEE-MUG FIX (Aug 2026): never trust the old
    // hardcoded numeric variant IDs for these mugs. Resolve the CURRENT
    // Printify variant live from the exact size + exact color option every
    // time (cached after the first lookup in this server instance). This
    // simultaneously eliminates stale IDs and prevents ambiguous substring
    // matches such as Blue -> Light Blue/Cambridge Blue or Green -> Light
    // Green. If Printify does not genuinely offer the requested combination,
    // fail explicitly instead of silently showing/ordering a different color.
    if (product.layoutType === "three-slot-wrap") {
      const variantId = await resolveVariantIdByExactOptions(
        product.blueprintId,
        product.printProviderId,
        [sizeLabel, colorName]
      );
      return { variantId, price: sizeEntry.price, hex: colorEntry.hex || null };
    }

    if (colorEntry.variantId) return { variantId: colorEntry.variantId, price: sizeEntry.price, hex: colorEntry.hex || null };
    const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel, colorName]);
    return { variantId, price: sizeEntry.price, hex: colorEntry.hex || null };
  }

  if (product.colors) {
    if (!colorName) throw new Error("A color selection is required for this product.");
    const colorEntry = product.colors.find(c => c.name === colorName);
    if (!colorEntry) throw new Error(`Unknown color "${colorName}".`);
    if (colorEntry.variantId) return { variantId: colorEntry.variantId, price: sizeEntry.price, hex: colorEntry.hex || null };
    const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel, colorName]);
    return { variantId, price: sizeEntry.price, hex: colorEntry.hex || null };
  }

  // UPDATED (Aug 2026): this branch previously threw immediately if a
  // size-only product (no colors at all, like the Gator Tumbler and
  // Tundra Tumbler) was missing a hardcoded variantId. The two color
  // branches above already had a live-lookup fallback for exactly this
  // situation -- a product confirmed to genuinely exist on Printify
  // whose numeric variant ID just hasn't been manually looked up yet --
  // this branch simply never got the same treatment, which is why the
  // 32oz Gator Tumbler's real-photo preview failed with "No variantId
  // configured for size '32oz'" the first time it was used. Brought in
  // line with the same resolveVariantIdByTitleMatch() fallback already
  // used for Trimmed's 15oz Black, Accented's Black, and travel-mug-20oz.
  if (sizeEntry.variantId) return { variantId: sizeEntry.variantId, price: sizeEntry.price, hex: null };
  const variantId = await resolveVariantIdByTitleMatch(product.blueprintId, product.printProviderId, [sizeLabel]);
  return { variantId, price: sizeEntry.price, hex: null };
}

// UPDATED (July 2026, Alyx's request): added optional imageScale and
// imageY parameters (default 1 / 0.5 -- both unchanged from before)
// instead of hardcoding one value for every product. Coffee mugs
// specifically were coming out too tightly cropped -- text and faces
// running edge-to-edge with zero margin -- so placeProductOrder/
// start-mockup.js pass 0.8 (80%) scale only for three-slot-wrap
// (coffee mug) products. After fixing the crop, the design still sat
// too high on the mug (centered vertically leaves it looking too close
// to the rim) -- imageY nudges it down toward center-lower instead.
// Travel mugs, suitcases, and everything else keep the original
// full-size, centered placement, since those were already coming out
// correctly. This is the exact same x/y/scale placement control
// Printify's own manual editor exposes when a person resizes/repositions
// a design by hand.
export async function createPrintifyProduct(images, { blueprintId, printProviderId, displayName }, variantId, title, imageScale = 1, imageY = 0.5) {
  const placeholders = Object.entries(images).map(([position, imageId]) => ({
    position,
    images: [{ id: imageId, x: 0.5, y: imageY, scale: imageScale, angle: 0 }]
  }));

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: title,
      description: `Custom Muggshotz ${displayName}.`,
      blueprint_id: blueprintId,
      print_provider_id: printProviderId,
      variants: [{ id: variantId, price: 1, is_enabled: true }],
      print_areas: [{ variant_ids: [variantId], placeholders }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify product creation failed: " + JSON.stringify(data));
  return { productId: data.id };
}

async function submitPrintifyOrder(productId, variantId, shippingAddress, externalOrderId) {
  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_id: externalOrderId,
      line_items: [{ product_id: productId, variant_id: variantId, quantity: 1 }],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: shippingAddress
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify order submission failed: " + JSON.stringify(data));
  return data;
}

function calculateUpsellCharge(placements) {
  if (!placements) return { upsellCharge: 0, reason: "Not applicable to this product." };
  const { left, front, right } = placements;
  const filled = [left, front, right].filter(Boolean);
  const distinctCount = new Set(filled).size;

  if (filled.length <= 1) return { upsellCharge: 0, reason: "Single design, base price only." };
  if (filled.length === 2) {
    return distinctCount === 1
      ? { upsellCharge: 3, reason: "Two placements, same design." }
      : { upsellCharge: 5, reason: "Two placements, different designs." };
  }
  return distinctCount === 1
    ? { upsellCharge: 3, reason: "Three placements, same design." }
    : { upsellCharge: 6, reason: "Three placements, all different designs." };
}

export async function placeProductOrder({
  productKey,
  sizeLabel,
  colorName,
  placements,
  placementAdjust,
  frontImage,
  backImage,
  image,
  shippingAddress,
  customerName,
  orderId,
  printMode = "standard",
  panoramaImage = null,
  posterFramed,
  posterOrientation,
  posterFinish
}) {
  const product = getProduct(productKey);
  if (!product) throw new Error(`Unknown product: "${productKey}"`);
  if (!shippingAddress) throw new Error("shippingAddress is required.");

  let variantId, price, hex, effectiveBlueprintId, effectivePrintProviderId;

  if (productKey === "photo-poster") {
    const resolved = await resolvePhotoPosterSelection(product, {
      framed: !!posterFramed,
      sizeLabel,
      orientation: posterOrientation,
      finish: posterFinish,
      frameColor: colorName
    });
    variantId = resolved.variantId;
    price = resolved.price;
    effectiveBlueprintId = resolved.blueprintId;
    effectivePrintProviderId = resolved.printProviderId;
  } else if (productKey === "travel-mug-20oz") {
    // UPDATED (July 2026): this blueprint (SPOKE Custom Products, swapped
    // in after the previous Polar Camel blueprint turned out to be
    // Printify "Early Access" with no real mockup support) has exactly
    // one orderable variant and no hardcoded ID in the catalog -- same
    // reasoning as photo-poster's not-yet-looked-up sizes. Resolved live
    // by name match instead.
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
    variantId = await resolveVariantIdByTitleMatch(effectiveBlueprintId, effectivePrintProviderId, [sizeLabel]);
    price = product.sizes[sizeLabel].price;
  } else {
    ({ variantId, price, hex } = await resolveVariant(product, sizeLabel, colorName));
    effectiveBlueprintId = product.blueprintId;
    effectivePrintProviderId = product.printProviderId;
  }

  let printifyImages = {};
  let pricing = { upsellCharge: 0, reason: "N/A" };

  if (product.layoutType === "three-slot-wrap") {
    if (!placements || !(placements.left || placements.front || placements.right)) {
      throw new Error("At least one design is required, in any slot.");
    }
    // "fullBleed" = customer-facing Wraparound scene-continuation mode
    // (no cropping). "allCup" = reserved for the future Ewww Stew line,
    // which deliberately wants overflow/crop. Do NOT collapse these
    // back into one branch -- see buildSeamlessWrapImage's comment above.
    const isSeamlessWrap = printMode === "fullBleed";
    const isFullBleed = printMode === "allCup";
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    // ONE LONG PANEL WHEN WE HAVE ONE. panoramaImage is the uncut Gemini
    // panorama; when the client sends it, the three thirds are only ever a
    // display detail and the print file is built straight from the original.
    // Falls back to reassembling the thirds when it is absent, which is the
    // case for Three Panels mode and for the classic per-panel fallback.
    const buffer = isFullBleed
      ? await buildFullBleedImage(placements.front || placements.left || placements.right, width, height)
      : isSeamlessWrap
      ? (panoramaImage
          ? await buildSeamlessWrapFromPanorama(panoramaImage, width, height)
          : await buildSeamlessWrapImage(placements, width, height))
      : await buildWraparoundImage(placements, width, height, hex || null, placementAdjust || {});
    const imageId = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);
    printifyImages[position] = imageId;
    pricing = isFullBleed
      ? { upsellCharge: 0, reason: "All-Cup full-bleed print — offered free of charge." }
      : isSeamlessWrap
      ? { upsellCharge: 0, reason: "Wraparound scene-continuation print — offered free of charge." }
      : calculateUpsellCharge(placements);

  } else if (product.layoutType === "front-back") {
    if (!frontImage && !backImage) throw new Error("At least a front or back image is required.");
    const frontDims = product.printDimensions?.front;
    const backDims = product.printDimensions?.back;
    const { frontBuf, backBuf } = await buildFrontBackImages(frontImage, backImage, frontDims, backDims);
    if (frontBuf) printifyImages["mug_front"] = await uploadImageToPrintify(frontBuf, `muggshotz-front-${Date.now()}.png`);
    if (backBuf) printifyImages["mug_back"] = await uploadImageToPrintify(backBuf, `muggshotz-back-${Date.now()}.png`);

  } else if (product.layoutType === "single-image") {
    if (!image) throw new Error("An image is required.");
    const dims = product.printDimensions?.front;
    const { width, height, position } = dims
      ? { ...dims, position: "front" }
      : await getPlaceholderDimensions(effectiveBlueprintId, effectivePrintProviderId, variantId);
    const buffer = await buildSingleImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else if (product.layoutType === "full-bleed") {
    if (!image) throw new Error("An image is required.");
    const { width, height, position } = await getPlaceholderDimensions(
      effectiveBlueprintId, effectivePrintProviderId, variantId
    );
    const buffer = await buildFullBleedImage(image, width, height);
    printifyImages[position] = await uploadImageToPrintify(buffer, `muggshotz-${Date.now()}.png`);

  } else {
    throw new Error(`Unknown layoutType "${product.layoutType}" for product "${productKey}".`);
  }

  // RESOLVED (July 2026): the calibration test confirmed scale/position
  // was never the real problem -- the actual bug was buildFullBleedImage
  // still cropping, reached only through the Wraparound auto-continuation
  // path. Now that buildSeamlessWrapImage fixes the crop at the source,
  // restoring the values already validated as correct for the manual
  // three-slot-wrap mode.
  const isCoffeeMug = product.layoutType === "three-slot-wrap";
  // UPDATED (July 2026, Alyx's request): the 20oz travel mug (SPOKE
  // Custom Products, single-image) was printing too large on some
  // designs depending on how the source image happened to be framed --
  // scoped narrowly to ONLY this product key so it can't accidentally
  // affect the suitcase, phone case, or anything else that was already
  // coming out correctly.
  const isTravelMug20oz = productKey === "travel-mug-20oz";
  // REVERTED (Aug 2026): the coffee-mug zoom now happens per-panel
  // inside buildWraparoundImage() (see PANEL_ZOOM there) instead of
  // here as one uniform whole-canvas scale -- that uniform version was
  // what pushed the panel next to the handle past its own true edge.
  // Back to 1 for both so the zoom only ever applies once. (History:
  // this went 1 -> 1.05 -> 1.2 as a Printify placement scale before
  // moving into per-panel compositing instead.)
  const imageScale = 1;
  const imageY = isCoffeeMug ? 0.5 : 0.5;

  const productTitle = `Muggshotz ${product.displayName}${customerName ? " - " + customerName : ""}`;
  const { productId } = await createPrintifyProduct(
    printifyImages,
    { blueprintId: effectiveBlueprintId, printProviderId: effectivePrintProviderId, displayName: product.displayName },
    variantId,
    productTitle,
    imageScale,
    imageY
  );

  const orderResult = await submitPrintifyOrder(
    productId, variantId, shippingAddress, orderId || `muggshotz-${Date.now()}`
  );

  return {
    success: true,
    printifyOrderId: orderResult.id,
    productId,
    basePrice: price,
    upsellCharge: pricing.upsellCharge,
    upsellReason: pricing.reason
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const result = await placeProductOrder(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
