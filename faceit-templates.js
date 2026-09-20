/* ===========================================================================
   FACE IT — TEMPLATE DEFINITIONS AND SHARED GEOMETRY
   ---------------------------------------------------------------------------
   Loaded by BOTH needles-studio.html (the live flow) and faceit-bench.html
   (the preview/calibration tool). It exists as a separate file for exactly
   one reason: every number in here -- chart scale, placard rectangles, the
   height-to-pixels math -- has to be identical in the bench and in the real
   flow, or the bench is lying. HANDOFF.md lesson one is "a comment is not the
   code"; a second copy of these constants would be the same trap with extra
   steps.

   Plain script, no modules, everything hung off window -- matches the rest of
   the browser code in this project, which has no build step.

   WHY THE CATALOG BECAME OBJECTS (Sep 2026)
   The roster used to be a flat array of twenty filenames with a side Set
   (FACE_IT_TEXT_TEMPLATES) marking the two that open a text box. That worked
   while "which bucket is this" had exactly two answers. The three templates
   added in this batch need, between them: a different prompt class each, a
   different panel mode each, per-template product restrictions, a customer
   height input, three text inputs instead of one, and two different height
   chart scales. Five more parallel Sets would have been unreadable. Each
   template now carries its own metadata and the old flat array + Set are
   derived from it at the bottom of this file, so nothing that read them
   before has to change.
   =========================================================================== */
(function(global){
'use strict';

/* ---------------------------------------------------------------------------
   PRINT SURFACES
   Measured, not guessed -- these come from Printify's own variants.json via
   the same probe that produced the ratio table in needles-studio.html. A mug
   wrap is 2475 x 1155 (2.14:1); the 14oz travel handle is 1995 x 930 (2.15:1),
   near enough the same shape that one composition serves both.
   --------------------------------------------------------------------------- */
const SURFACES = {
  'mug':                    { w: 2475, h: 1155 },
  'travel-mug-14oz-handle': { w: 1995, h:  930 }
};

/* ---------------------------------------------------------------------------
   HEIGHT CHARTS
   One renderer, two ranges. The only thing separating a police lineup from a
   dog booking photo is where the numbers start and stop -- baking that into
   two separate art files would mean two files to keep in sync, and the
   numbers are the single most AI-hostile element on either template, so they
   are drawn here rather than generated.

   PET: 4" to 2'0" in 4" steps. A medium dog's head lands at 1'8", which is an
   actual labelled line rather than a gap between two -- real booking photos
   read that way and it stays legible at mug size.
   HUMAN: 3'0" to 7'6" in 6" steps. Tops out above any customer so the lineup's
   alien can clear the chart entirely, which is the joke.
   --------------------------------------------------------------------------- */
const CHARTS = {
  pet:   { minIn:  4, maxIn:  24, stepIn: 4 },
  /* 3'6" to 7'6". The delivered lineup plate has nine labelled rules, and once
     the missing 5'6" is restored the bottom one is 3'6", not the 3'0" it was
     printed with. See relabelLineupChart. */
  human: { minIn: 42, maxIn:  90, stepIn: 6 }
};

/* Inches -> the way a booking chart writes it. 72 -> 6'0", 20 -> 1'8", 8 -> 8". */
function formatHeight(totalInches){
  const ft = Math.floor(totalInches / 12);
  const inch = Math.round(totalInches - ft * 12);
  if (ft === 0) return inch + '"';
  return ft + "'" + inch + '"';
}

/* Parse "5'10", "5 10", "70", "178cm" into inches. The studio uses two
   dropdowns so it can never send garbage, but the bench takes free text and
   plenty of customers think in centimetres. */
function parseHeightToInches(raw){
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const cm = s.match(/^([\d.]+)\s*cm$/);
  if (cm) return parseFloat(cm[1]) / 2.54;
  const ftIn = s.match(/^(\d+)\s*(?:'|ft|feet|-|\s)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inches)?$/);
  if (ftIn) return parseInt(ftIn[1], 10) * 12 + (ftIn[2] ? parseFloat(ftIn[2]) : 0);
  const plain = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)?$/);
  if (plain) return parseFloat(plain[1]);
  return null;
}

/* ---------------------------------------------------------------------------
   THE SCALE OBJECT — why the height input is exact and not a suggestion
   ---------------------------------------------------------------------------
   Asking an image model to put a head at "62% of frame height" is a request it
   half-honours, and two customers of different heights come back the same size.
   So height never enters the prompt at all. The model paints a full standing
   figure on transparency at whatever size it likes; this maps the customer's
   real height onto the chart and canvas scales the figure to fit exactly.

   The chart defines the scale, and 0" IS the floor by definition -- extrapolate
   the two labelled reference lines down to zero and that is where feet go. A
   plate whose painted floor sits somewhere else gets a floorYOverride, which is
   what the bench's slider writes.
   --------------------------------------------------------------------------- */
function buildChartScale(chart, topY, bottomY, floorYOverride){
  const { minIn, maxIn, stepIn } = chart;
  const span = maxIn - minIn;
  const pxPerInch = (bottomY - topY) / span;   // positive: y grows downward
  const inchesToY = (inches) => bottomY - (inches - minIn) * pxPerInch;
  const floorY = (floorYOverride == null) ? inchesToY(0) : floorYOverride;
  return {
    minIn, maxIn, stepIn, topY, bottomY, floorY,
    pxPerInch,
    inchesToY,
    yToInches: (y) => minIn + (bottomY - y) / pxPerInch,
    /* Feet on the floor, head on their line. Both satisfied at once because a
       figure's pixel height is simply the gap between the two. */
    figureHeightPx: (inches) => floorY - inchesToY(inches)
  };
}

/* ---------------------------------------------------------------------------
   DRAWING THE CHART
   Lines run the FULL width of the strip in one pass, never per panel. On a
   wraparound the three panels are thirds of one image, so a chart drawn once
   across the whole width is continuous through both seams by construction; a
   chart drawn three times would have to align by luck.
   --------------------------------------------------------------------------- */
function drawHeightChart(ctx, opts){
  const {
    scale, x = 0, w,
    lineColor = '#1b1b1b', lineWidth = 2,
    labelColor = '#141414', labelFont = 'bold %SIZEpx "Helvetica Neue",Arial,sans-serif',
    labelSize, labelPad,
    labelSides = 'both',
    majorEvery = 1
  } = opts;

  const size = labelSize || Math.round(w * 0.018);
  const pad  = (labelPad == null) ? Math.round(w * 0.012) : labelPad;
  ctx.save();
  ctx.font = labelFont.replace('%SIZE', size);
  ctx.textBaseline = 'middle';

  let i = 0;
  for (let inches = scale.minIn; inches <= scale.maxIn + 0.001; inches += scale.stepIn, i++){
    const y = Math.round(scale.inchesToY(inches)) + 0.5;
    const major = (i % majorEvery === 0);
    const label = formatHeight(inches);
    const labelW = major ? ctx.measureText(label).width : 0;

    /* The rule stops short of its own labels rather than running under them --
       a line through the numbers is what makes a cheap chart look cheap. */
    const gutter = major ? labelW + pad * 2 : 0;
    const x1 = x + (labelSides === 'right' ? 0 : gutter);
    const x2 = x + w - (labelSides === 'left' ? 0 : gutter);

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    if (major){
      ctx.fillStyle = labelColor;
      if (labelSides !== 'right'){
        ctx.textAlign = 'left';
        ctx.fillText(label, x + pad, y);
      }
      if (labelSides !== 'left'){
        ctx.textAlign = 'right';
        ctx.fillText(label, x + w - pad, y);
      }
    }
  }
  ctx.restore();
}

global.FaceItGeom = {
  SURFACES, CHARTS,
  formatHeight, parseHeightToInches,
  buildChartScale, drawHeightChart
};

})(window);

/* ===========================================================================
   THE MUG SHOT — DRAWN, NOT PAINTED
   ---------------------------------------------------------------------------
   Everything on this template except the subject is furniture: a wall, a ruled
   chart, three placards on cords. All of it is straight lines, rectangles and
   text, so it is drawn here at the print surface's real pixel size rather than
   scaled up from a PNG. Three things fall out of that for free:

     - the numbers are never garbled, because no model ever touches them
     - the pet/human chart is a flag, not a second art file
     - the 14oz's different ratio re-renders instead of needing its own export

   The subject is the only thing generated. It arrives as three views on a
   transparent background and is composited between the wall and the placards.
   =========================================================================== */
(function(global){
'use strict';
const G = global.FaceItGeom;

/* Placard geometry, as fractions so one set of numbers serves both surfaces.
   These are starting values -- faceit-bench.html writes over them live, and
   whatever comes out of that session is what ships. Same approach as
   WINDOW_SILL_CALIBRATION in needles-studio.html, which learned the hard way
   that eyeballed insets do not survive contact with real artwork. */
const MUGSHOT_DEFAULTS = {
  chartTopPct:     0.095,   // y of the topmost chart line, as a fraction of strip height
  chartBottomPct:  0.930,   // y of the bottommost chart line
  chart:           'pet',
  wallTop:         '#f2f2f0',
  wallBottom:      '#d9d9d6',
  placardWPct:     0.46,    // of ONE panel's width
  placardHPct:     0.145,   // of strip height
  placardTopPct:   0.640,   // y of the placard's top edge
  cordRisePct:     0.115,   // how far above the placard the cords run before they stop
  cordSpreadPct:   0.075,   // how far INWARD they converge on the way up, toward the neck
  subjectHPct:     0.780,   // bust height as a fraction of strip height -- see placeBust
  frameColor:      '#111111',
  cardColor:       '#fbfbfb',
  textColor:       '#141414'
};

/* Shrink-to-fit, wrapping to a second line only if that actually helps. A
   booking placard with three words on one squinting line reads worse than two
   comfortable ones, and "ATE MY UNDERWEAR" is three words. */
function fitPlacardText(ctx, text, maxW, maxH){
  const words = String(text || '').toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size: 0 };

  const layouts = [];
  layouts.push([words.join(' ')]);
  for (let split = 1; split < words.length; split++){
    layouts.push([words.slice(0, split).join(' '), words.slice(split).join(' ')]);
  }

  let best = { lines: [words.join(' ')], size: 1 };
  for (const lines of layouts){
    const lineH = maxH / lines.length;
    let size = Math.floor(lineH * 0.78);
    while (size > 4){
      ctx.font = 'bold ' + size + 'px "Arial Narrow","Helvetica Neue",Arial,sans-serif';
      const widest = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
      if (widest <= maxW) break;
      size--;
    }
    if (size > best.size) best = { lines, size };
  }
  return best;
}

function drawPlacard(ctx, rect, text, opts){
  const o = Object.assign({}, MUGSHOT_DEFAULTS, opts || {});
  const { x, y, w, h } = rect;
  const border = Math.max(2, Math.round(h * 0.11));
  const radius = Math.round(h * 0.06);

  ctx.save();

  /* Cords first so the placard frame covers where they attach. They run up and
     outward and simply STOP -- they do not cross the subject. On a real booking
     photo the cord disappears behind the neck, and a line drawn over the throat
     is the single clearest tell that something was pasted on. Where they stop is
     a calibration value because it depends on where the generated subject's neck
     lands, which is not knowable until real output exists. */
  const rise   = (o.cordRisePct   || 0) * (o.stripH || h * 6);
  const spread = (o.cordSpreadPct || 0) * (o.panelW || w * 2);
  ctx.strokeStyle = o.frameColor;
  ctx.lineWidth = Math.max(1.5, h * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + border * 0.6, y + border * 0.4);
  ctx.lineTo(x + border * 0.6 + spread, y - rise);
  ctx.moveTo(x + w - border * 0.6, y + border * 0.4);
  ctx.lineTo(x + w - border * 0.6 - spread, y - rise);
  ctx.stroke();

  /* Frame, then card. */
  ctx.fillStyle = o.frameColor;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.fillStyle = o.cardColor;
  roundRect(ctx, x + border, y + border, w - border * 2, h - border * 2, Math.max(1, radius - border * 0.5));
  ctx.fill();

  /* Text. */
  const innerW = (w - border * 2) * 0.90;
  const innerH = (h - border * 2) * 0.80;
  const fit = fitPlacardText(ctx, text, innerW, innerH);
  if (fit.lines.length){
    ctx.fillStyle = o.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + fit.size + 'px "Arial Narrow","Helvetica Neue",Arial,sans-serif';
    const cx = x + w / 2;
    const cy = y + h / 2;
    const lineH = fit.size * 1.06;
    const startY = cy - (lineH * (fit.lines.length - 1)) / 2;
    fit.lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineH));
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/* The wall and the chart -- everything that sits BEHIND the subject. Split out
   from the placards so the subject can be composited in between the two layers
   in one pass, which is the whole reason this template is drawn rather than
   generated. */
function drawMugshotBackplate(ctx, W, H, opts){
  const o = Object.assign({}, MUGSHOT_DEFAULTS, opts || {});
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, o.wallTop);
  grad.addColorStop(1, o.wallBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const scale = mugshotScale(H, o);
  G.drawHeightChart(ctx, {
    scale, x: 0, w: W,
    lineColor: '#1b1b1b',
    lineWidth: Math.max(1.5, H * 0.0028),
    labelSize: Math.round(H * 0.045),
    labelPad:  Math.round(W * 0.010),
    labelSides: 'both'
  });
  return scale;
}

function mugshotScale(H, opts){
  const o = Object.assign({}, MUGSHOT_DEFAULTS, opts || {});
  return G.buildChartScale(G.CHARTS[o.chart] || G.CHARTS.pet, H * o.chartTopPct, H * o.chartBottomPct, o.floorY);
}

/* The three placards -- everything that sits IN FRONT of the subject. */
function drawMugshotForeplate(ctx, W, H, texts, opts){
  const o = Object.assign({}, MUGSHOT_DEFAULTS, opts || {});
  const panelW = W / 3;
  for (let i = 0; i < 3; i++){
    const pw = panelW * o.placardWPct;
    const ph = H * o.placardHPct;
    drawPlacard(ctx, {
      x: panelW * i + (panelW - pw) / 2,
      y: H * o.placardTopPct,
      w: pw,
      h: ph
    }, (texts && texts[i]) || '', Object.assign({}, o, { stripH: H, panelW: panelW }));
  }
}

global.FaceItMugshot = {
  DEFAULTS: MUGSHOT_DEFAULTS,
  drawBackplate: drawMugshotBackplate,
  drawForeplate: drawMugshotForeplate,
  drawPlacard, fitPlacardText, roundRect, scaleFor: mugshotScale
};

})(window);

/* ===========================================================================
   COMPOSITING A GENERATED FIGURE ONTO A CHART
   ---------------------------------------------------------------------------
   Used by both the lineup (one figure) and the mug shot (three views). The
   model returns a subject on a transparent background at whatever size suits
   it; none of the height targeting happens in the prompt, because a model asked
   to put a head at "62% of frame height" treats that as a suggestion and two
   customers of different heights come back identical. Here it is arithmetic.
   =========================================================================== */
(function(global){
'use strict';
const G = global.FaceItGeom;

/* Where the actual pixels are. A generated PNG is mostly empty space around the
   subject and the amount varies run to run, so the transparent margin has to be
   measured off every result rather than assumed -- otherwise the scaling below
   is scaling the padding. alphaFloor ignores the near-transparent halo the
   magenta chroma-key leaves behind on hair and fur. */
function opaqueBounds(img, alphaFloor){
  const floor = (alphaFloor == null) ? 24 : alphaFloor;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      if (d[(y * w + x) * 4 + 3] > floor){
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: w, h: h, empty: true };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, empty: false };
}

/* Feet on the floor, head on their line. Both at once, because a figure's pixel
   height is just the gap between the two -- there is nothing left to reconcile. */
function placeFigure(ctx, img, scale, heightInches, centerX, opts){
  const o = opts || {};
  const bounds = o.bounds || opaqueBounds(img);
  if (bounds.empty) return null;

  const targetH = scale.figureHeightPx(heightInches);
  const k = targetH / bounds.h;
  const drawW = bounds.w * k;
  const dx = centerX - drawW / 2;
  const dy = scale.floorY - targetH;

  if (o.contactShadow !== false) drawContactShadow(ctx, centerX, scale.floorY, drawW, targetH);

  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, drawW, targetH);
  return { x: dx, y: dy, w: drawW, h: targetH };
}

/* A figure lit in isolation and dropped onto a plate reads as pasted on. Most of
   that is the missing contact shadow -- the eye checks where a thing meets the
   floor before it checks anything else. Cheap to draw, and it does more for the
   composite than any amount of prompt wording about lighting. */
function drawContactShadow(ctx, centerX, floorY, figureW, figureH){
  const rx = figureW * 0.42;
  const ry = Math.max(3, figureH * 0.022);
  const g = ctx.createRadialGradient(centerX, floorY, 0, centerX, floorY, rx);
  g.addColorStop(0,   'rgba(0,0,0,0.42)');
  g.addColorStop(0.55,'rgba(0,0,0,0.18)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(centerX, floorY);
  ctx.scale(1, ry / rx);
  ctx.translate(-centerX, -floorY);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(centerX, floorY, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* THE MUG SHOT IS NOT A FIGURE (caught on the bench, Sep 2026). placeFigure
   solves for feet-on-floor AND crown-on-line at once, which is exactly right for
   the lineup and exactly wrong here: a booking photo is cropped at mid-chest, so
   there are no feet and the floor line sits well below the frame. Reusing it
   scaled the bust to a notional full body and pushed almost all of it off the
   bottom of the mug.

   A bust has one anchor, the crown, and its size is a framing decision rather
   than something derivable -- hence subjectHPct, which is a calibration value
   like every other number on this template. */
function placeBust(ctx, img, scale, headInches, centerX, stripH, heightPct, opts){
  const o = opts || {};
  const bounds = o.bounds || opaqueBounds(img);
  if (bounds.empty) return null;

  const targetH = stripH * heightPct;
  const k = targetH / bounds.h;
  const drawW = bounds.w * k;
  const dx = centerX - drawW / 2;
  const dy = scale.inchesToY(headInches);          // crown sits ON the line

  ctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, drawW, targetH);
  return { x: dx, y: dy, w: drawW, h: targetH };
}

/* ---------------------------------------------------------------------------
   SOFT-KEYING WHAT THE SERVER KEYED HARD
   ---------------------------------------------------------------------------
   api/generate.js drops the magenta field to transparency with a binary test --
   r>200 && g<70 && b>200, alpha straight to zero. That is exactly right for the
   templates it was written for, whose magenta meets the artwork along a clean
   rectangular edge.

   It is not enough for a cutout. A strand of fur covers a pixel only partly, so
   that pixel comes back a BLEND of fur and magenta -- something like
   (242, 90, 187), which fails the test on green and survives at full opacity.
   Proved on the first real generation: a golden retriever composited onto the
   wall wearing a bright pink outline round every hair.

   Fixing it server-side would touch every templateMerge generation in the
   product, including flows nobody asked me to change, so it is done here on the
   way in instead. Nothing is lost by waiting: the edge pixels still carry their
   blended colour, so the original is recoverable.

   Two steps, and the second is the one people forget:
     alpha  -- how magenta a pixel is, as a ramp rather than a yes/no. Magenta is
               high red and blue against low green, so min(R,B) - G measures it.
     colour -- having decided a pixel is半 transparent, the magenta still mixed
               into it must come OUT, or the edge stays pink and merely fades.
               edge = fur*a + magenta*(1-a), so fur = (edge - magenta*(1-a)) / a.
               Unpremultiplying like that returns the true fur colour rather than
               a desaturated guess.
   --------------------------------------------------------------------------- */
function despillMagenta(img, opts){
  const o = opts || {};
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const softness = o.softness || 110;

  /* WHY NOT UNPREMULTIPLY (tried first, and it went green).
     Recovering fur = (edge - magenta*(1-a)) / a is the textbook move and it
     assumes the pixel really is fur mixed with pure #FF00FF. These pixels are
     not: the model paints its own soft pink rim, so dividing it back out
     overshoots and swings the edge to green.

     Suppression is the right tool for a rim that was painted rather than mixed.
     Magenta needs a high BLUE channel; golden fur has almost none. So pulling
     blue down to the green level kills the pink and leaves warm tones alone --
     and the spill>0 gate means an orange dog is never touched in the first
     place, because for fur min(R,B) is the low blue, not the high red. */
  for (let i = 0; i < d.length; i += 4){
    if (d[i + 3] === 0) continue;
    const R = d[i], G = d[i + 1], B = d[i + 2];
    const spill = Math.min(R, B) - G;
    if (spill <= 0) continue;

    let a = 1 - spill / softness;
    if (a <= 0.02){ d[i + 3] = 0; continue; }
    if (a > 1) a = 1;

    if (B > G) d[i + 2] = G;                  // the pink comes out of blue
    if (R > G + 90) d[i] = G + 90;            // and a little off extreme red
    d[i + 3] = Math.round(d[i + 3] * a);
  }

  /* ERODE ONE PIXEL. Whatever survives the two passes above is the outermost
     rim of the cutout, which is the half-covered pixel the key could never have
     got right anyway. On fur, losing a pixel off the silhouette is invisible;
     keeping a pink one is not. */
  if (o.erode !== false){
    const alpha = new Uint8ClampedArray(w * h);
    for (let i = 0, k = 0; i < d.length; i += 4, k++) alpha[k] = d[i + 3];
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        const k = y * w + x;
        if (alpha[k] === 0) continue;
        const up    = y > 0     ? alpha[k - w] : 0;
        const down  = y < h - 1 ? alpha[k + w] : 0;
        const left  = x > 0     ? alpha[k - 1] : 0;
        const right = x < w - 1 ? alpha[k + 1] : 0;
        if (up < 128 || down < 128 || left < 128 || right < 128) d[k * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(id, 0, 0);
  return c;
}

/* SET THE ACTOR DOWN ON THE STAGE (Sep 2026, Alyx's design).
   The band is a fixed painting and the merge returns its subject on magenta, so
   all that is left is to key it and stand it in the room. Nothing here has to
   agree with anything generated -- that is the entire point of a static stage,
   and why this is three dozen lines rather than a seam-matching problem.

   Height, not width, decides the scale: the figure is a person standing in a
   room, so what must be right is how tall they are against that wall. On the
   14oz band the mirror comes out around a third of the wrap, which is the
   presence the template needs to carry.

   The stage is drawn at its own size and never stretched. Fitting the band to
   the product is extendWrapToProductRatio()'s job downstream, exactly as it is
   for every other wrap plate. */
function buildStagedWrap(stage, cutout, opts){
  const o = opts || {};
  const W = stage.naturalWidth || stage.width;
  const H = stage.naturalHeight || stage.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(stage, 0, 0, W, H);

  const keyed = despillMagenta(cutout, o.despill || {});
  const b = opaqueBounds(keyed, 8);
  // A key that took everything is a bad generation, not a reason to hand the
  // customer a crash. The empty room is a poor design; a broken page is worse.
  if (b.empty || b.w < 8 || b.h < 8) return c;

  const targetH = Math.round(H * (o.fillHeight || 0.96));
  const drawW = Math.max(1, Math.round(b.w * (targetH / b.h)));
  const floorY = Math.round(H * (o.floorY || 1));
  const x = Math.round((W - drawW) / 2 + (o.offsetX || 0) * W);
  const y = floorY - targetH;

  if (o.contactShadow !== false) drawContactShadow(ctx, x + drawW / 2, floorY, drawW, targetH);
  ctx.drawImage(keyed, b.x, b.y, b.w, b.h, x, y, drawW, targetH);
  return c;
}

global.FaceItComposite = { opaqueBounds, placeFigure, placeBust, drawContactShadow, despillMagenta, buildStagedWrap };

})(window);


/* ===========================================================================
   PROMPTS
   ---------------------------------------------------------------------------
   NOTE FOR REVIEW: flow-tests/AUDIT-CATALOG.md lists the Face It merge prompts
   in needles-studio.html as read-only secret sauce. Nothing in that block is
   edited -- the two existing variants stay exactly as they are. These are new
   strings for new templates, kept here beside the geometry they depend on.

   Two of the three ask for a subject on a flat magenta field. That is not an
   arbitrary colour: api/generate.js already keys #FF00FF to real transparency
   after every templateMerge generation (chromaKeyMagentaToTransparent), so a
   subject painted that way arrives back as a transparent PNG ready to composite.
   The key is a hard threshold with no feathering, so fur and hair are the place
   to look for a pink halo -- faceit-bench.html shows the raw cutout against a
   checkerboard for exactly that reason.
   =========================================================================== */
(function(global){
'use strict';

const MAGENTA_FIELD =
  'BACKGROUND (technical requirement): place the subject on a completely flat, ' +
  'solid pure magenta field, hex #FF00FF, RGB(255,0,255), filling the entire canvas ' +
  'behind and around the subject. No floor, no wall, no scenery, no shadow cast onto ' +
  'the magenta, no gradient, no vignette, no soft edges -- one uniform magenta with a ' +
  'clean boundary at the subject. This field is removed programmatically and is never ' +
  'seen, so it must not be styled or blended in any way. Keep fur, hair and clothing ' +
  'edges crisp against it rather than softly feathered.';

function faceNoteFrom(text){
  const t = (text || '').trim();
  return t ? ' The customer notes: "' + t.replace(/"/g, "'") + '" -- use this to identify which face in the photo to use if there is more than one.' : '';
}

/* MOUNT RUSHMORE. The one template in this batch where the model paints the
   whole picture. Note how hard it pulls the other way from the existing plain
   face-merge, which asks for "a genuine, seamlessly composited portrait" -- here
   a photographic face is the failure mode, not the goal. */
function stoneCarvePrompt(note){
  return 'The reference image is a five-head Mount Rushmore carving. Four heads are finished ' +
  'presidents. The far-right position is blank, unworked rock where a fifth head belongs.\n\n' +
  'Carve the face of the person in the uploaded photo into that blank rock as a monumental ' +
  'granite sculpture -- a carving, not a photograph. It must read as if it were blasted and ' +
  'chiselled from the same mountain, by the same hands, at the same time as the other four.\n\n' +
  'MATERIAL: solid weathered granite throughout. No skin tone, no hair colour, no eye colour, ' +
  'no fabric -- every surface is the same warm grey-tan stone as the existing heads, carrying ' +
  'the same coarse chisel facets, drill scars, hairline fractures and pale lichen staining. ' +
  'Hair and any beard are carved stone locks and grooves, never soft photographic hair. Eyes ' +
  'are hollow sculpted pupils cut in shadow, exactly like the presidents\' eyes -- never glossy ' +
  'photographic eyes.\n\n' +
  'LIKENESS: the person must stay instantly recognisable -- same facial proportions, bone ' +
  'structure, nose and jaw shape, brow, hairline and any distinctive features. Translate those ' +
  'into stone; do not idealise, slim, age, or drift toward a generic presidential face. If the ' +
  'person wears a cap, glasses or sunglasses in the photo, carve those in the same granite as ' +
  'part of the sculpture rather than omitting them.\n\n' +
  'INTEGRATION: match the neighbouring heads in scale -- the same head height as Lincoln -- in ' +
  'the slightly upward and outward gaze and head angle, and in sunlight direction and shadow ' +
  'depth. The head must grow out of the cliff itself, with jaw, neck and shoulders dissolving ' +
  'into rough unworked rock. No seam, no outline, no cut-out edge, no floating head.\n\n' +
  'PRESERVE EXACTLY: the four existing presidents, the sky and clouds, the pine trees, the ' +
  'surrounding rock, and all lettering -- reproduce the lettering verbatim and unchanged in its ' +
  'existing carved-stone style, position and size. Change nothing outside the fifth position.' + note;
}

/* THE MUG SHOT. One generation, three views, deliberately -- three separate runs
   would give three subtly different animals, and on a wraparound those sit
   inches apart where the difference is obvious. Painting all three at once lets
   the model see its own front view while it works out the profiles. */
function mugshotSubjectPrompt(note, subjectKind){
  const who = subjectKind === 'pet'
    ? 'the pet in the uploaded photo'
    : 'the person in the uploaded photo';
  return 'Produce THREE views of ' + who + ', side by side in a single image, evenly spaced and ' +
  'all at exactly the same scale, in this order: left profile facing left, front view facing the ' +
  'camera, right profile facing right.\n\n' +
  'It must be recognisably the same individual in all three -- identical markings, colouring, ' +
  'build, fur or hair pattern, and any distinctive features. The three views are one subject ' +
  'photographed three times, not three lookalikes. Work out the profiles from the face in the ' +
  'photo; keep the head at the same height and the eyeline level across all three views.\n\n' +
  'Framing: head, neck and upper chest only, cropped at roughly mid-chest, as a booking photograph ' +
  'is. Flat, even, frontal lighting with no dramatic shadow and no coloured cast. Neutral, ' +
  'unamused expression -- this subject is not enjoying the process.\n\n' +
  'Do not draw any height chart, wall, backdrop, sign, placard, board, cord, text, numbers or ' +
  'lettering of any kind. The subject and nothing else.\n\n' + MAGENTA_FIELD + note;
}

/* THE LINEUP. A full standing body invented from what is usually a head-and-
   shoulders photo, so stance and wardrobe need saying out loud or every run
   returns a different person's body. Height is deliberately absent -- see
   placeFigure(); the canvas does that part exactly. */
function lineupFigurePrompt(note){
  return 'Produce a single full-length standing figure of the person in the uploaded photo, ' +
  'head to feet, facing the camera straight on, arms relaxed at their sides, weight evenly on ' +
  'both feet, shoes clearly visible and both feet flat on the ground at the very bottom of the ' +
  'figure.\n\n' +
  'The face must be an unmistakable likeness of the photo -- same bone structure, hairline, ' +
  'complexion and any distinctive features. Build the body to plausibly match the face and any ' +
  'visible shoulders; ordinary everyday clothing, nothing costumed or uniformed. Neutral, ' +
  'slightly resigned expression, mouth closed, looking directly ahead.\n\n' +
  'LIGHTING: flat, even, slightly cool overhead light as from industrial lamps directly above, ' +
  'falling evenly down the front of the figure with soft shadow under the chin and no strong ' +
  'shadow to either side. No rim light, no warm key, no coloured cast.\n\n' +
  'Do not draw any floor, wall, height chart, backdrop, shadow, scenery, text or numbers. The ' +
  'complete standing figure and nothing else, with the whole body including the feet inside the ' +
  'frame and not cropped at any edge.\n\n' + MAGENTA_FIELD + note;
}

/* MIRROR MIRROR. The one prompt in here that asks for a BETTER face than the
   photograph, which is why its template carries `idealise` and why the server's
   identityLock steps aside for it. Everything else in the roster is defending a
   likeness; this is spending one, on purpose, with the customer's consent.

   Two things it must not do, and both are load-bearing. It must not give the
   figure standing with her back to us a face -- she has none by design, and the
   whole composition depends on it. And it must not idealise so far that the
   person stops being recognisable: a lie needs a subject, and "you, at your
   best" is the product where "somebody else entirely" is a refund. */
function mirrorPrompt(note){
  return 'The reference image shows a figure standing with their BACK to us before a large ' +
  'ornate storybook mirror, and the mirror is showing them a flattering reflection.\n\n' +
  'Replace the face in the MIRROR\'S REFLECTION with the face of the person in the uploaded ' +
  'photo. That reflection is the only FACE in this picture you may change.\n\n' +
  'THE FIGURE AT THE GLASS IS THE SAME PERSON, SEEN FROM BEHIND, so repaint the back of them to ' +
  'match the person in the photo: hair colour, length, texture and the way it is worn; the build ' +
  'and width of the shoulders; the apparent age; the skin tone of the neck and any visible arm. ' +
  'Short hair in the photo means short hair on the figure. Let their stance and carriage follow ' +
  'the person too -- how someone holds themselves reads from behind.\n\n' +
  'THE FIGURE AND THE REFLECTION ARE ONE HEAD AT ONE MOMENT. Whatever hair the figure has from ' +
  'behind is the same hair the reflection has from the front -- same colour, same length, same ' +
  'style, same day. They must agree exactly, or the mirror is showing somebody else.\n\n' +
  'BUT THE FIGURE NEVER GETS A FACE. We see the back of the head and shoulders only. Do not turn ' +
  'them, do not show a profile, do not let one eye or the line of a nose come into view, and do ' +
  'not put a second face anywhere in the room. Keep them in the costume they are painted in and ' +
  'standing where they are painted standing, at the same size and the same distance from the ' +
  'glass -- this is a change of PERSON, not of wardrobe, framing or staging.\n\n' +
  'THE MIRROR FLATTERS, AND THAT IS THE ENTIRE POINT OF THIS PICTURE. Paint the reflected face ' +
  'as the finest version of this person: more radiant, more poised, more powerful, more stately ' +
  'and wiser than they look in the photograph. Light them the way a court painter lights someone ' +
  'they admire -- warm, generous, a little golden. This idealisation is deliberate and requested, ' +
  'and it overrides any general instruction not to beautify.\n\n' +
  'IT MUST STILL BE UNMISTAKABLY THEM. Keep the real bone structure, the real nose, the real eye ' +
  'shape and eye colour, the real mouth, the real jaw width, the real hairline, the real age and ' +
  'skin tone, and any distinctive features. Do not narrow the face, do not substitute a model or ' +
  'a stock beauty, do not invent a new person. A stranger who knows them must recognise them ' +
  'instantly and think only that they have never looked better.\n\n' +
  'PRESERVE EXACTLY: the mirror, its carved gilt frame and the WINKING face carved into the crest ' +
  'at the top, the candlelight, the room, the furniture, and the costume the figure is wearing. ' +
  'The two things that change are the reflected face and the back of the figure wearing it.' + note;
}

/* THE MIRROR AS AN ACTOR, NOT A PICTURE (Sep 2026, Alyx).
   A 3:4 portrait cannot fill a 2.15:1 band, so on a cup Mirror Mirror could
   only ever be a small picture marooned in a lot of nothing. Alyx's way out was
   the trick his own studio already runs: "all we're using is the same technique
   as we used to make our little theater where Needles paints his little studio
   images. That background is static. It's the foreground image that does all
   the moving."
   So the band is a painted stage (mirror_stage.webp) and this prompt returns
   the mirror and the figure alone on magenta, to be keyed and set down on it.
   Everything about the merge itself is unchanged from mirrorPrompt -- the same
   flattery, the same likeness lock, the same never-a-face-on-the-figure, the
   same back-of-the-head following the customer. Only the delivery changes.
   The stage is fixed, which is the whole reason this works: the lighting here
   can be written to match a painting that exists rather than hoped into
   agreement with a second generation. Candles at the LEFT, in both. */
function mirrorStagePrompt(note){
  return 'The reference image shows a figure standing with their BACK to us before a large ' +
  'ornate storybook mirror, in a candlelit room.\n\n' +
  'CUT THEM OUT OF THAT ROOM. Give me ONLY the mirror and the figure standing at it. Do not ' +
  'paint the room around them: no wall, no tapestry, no curtain, no candelabra, no table, no ' +
  'vase, no flowers, no books, no floor. Everything that is not the mirror itself or the person ' +
  'in front of it is gone.\n\n' +
  'Replace the face in the MIRROR\'S REFLECTION with the face of the person in the uploaded ' +
  'photo. That reflection is the only FACE in this picture you may change.\n\n' +
  'THE FIGURE AT THE GLASS IS THE SAME PERSON, SEEN FROM BEHIND, so repaint the back of them to ' +
  'match the person in the photo: hair colour, length, texture and the way it is worn; the build ' +
  'and width of the shoulders; the apparent age; the skin tone of the neck and any visible arm. ' +
  'Short hair in the photo means short hair on the figure. Let their stance and carriage follow ' +
  'the person too.\n\n' +
  'THE FIGURE AND THE REFLECTION ARE ONE HEAD AT ONE MOMENT. Whatever hair the figure has from ' +
  'behind is the same hair the reflection has from the front -- same colour, same length, same ' +
  'style, same day.\n\n' +
  'BUT THE FIGURE NEVER GETS A FACE. We see the back of the head and shoulders only. Do not turn ' +
  'them, do not show a profile, do not let one eye or the line of a nose come into view, and do ' +
  'not put a second face anywhere in the picture. Keep them in the costume they are painted in ' +
  'and standing where they are painted standing relative to the glass.\n\n' +
  'THE MIRROR FLATTERS, AND THAT IS THE ENTIRE POINT OF THIS PICTURE. Paint the reflected face ' +
  'as the finest version of this person: more radiant, more poised, more powerful, more stately ' +
  'and wiser than they look in the photograph. Light them the way a court painter lights someone ' +
  'they admire -- warm, generous, a little golden. This idealisation is deliberate and requested, ' +
  'and it overrides any general instruction not to beautify.\n\n' +
  'IT MUST STILL BE UNMISTAKABLY THEM. Keep the real bone structure, the real nose, the real eye ' +
  'shape and eye colour, the real mouth, the real jaw width, the real hairline, the real age and ' +
  'skin tone, and any distinctive features. Do not narrow the face, do not substitute a model or ' +
  'a stock beauty, do not invent a new person.\n\n' +
  'KEEP THE MIRROR EXACTLY AS PAINTED: its carved gilt frame, and the WINKING face carved into ' +
  'the crest at the top, which must survive intact -- one eye closed, the knowing smile.\n\n' +
  'LIGHTING: warm candlelight falling from the LEFT, gold on the left side of the mirror and the ' +
  'figure, deeper shadow on their right. The glass still glows from within.\n\n' + MAGENTA_FIELD + note;
}

/* THE COURT PAINTER. The masculine half of the pair, and the difference is the
   delivery system rather than the subject: a mirror returns you to yourself,
   while a portrait presents you to everyone else. So this one flatters along a
   different axis -- not beauty but STATURE, which is the thing the motif has
   always adjudicated for men. Powerful, stately, wise.

   Its evidence is the photograph clipped to the easel, and the photograph only
   works HERE. At an easel the customer is the one being depicted, so the picture
   indicts the painter for taking liberties. At a mirror the customer is the one
   looking, so the same picture would indict them for believing it. Alyx caught
   that, and the plot hole underneath it: put a camera in the room and a magic
   mirror has no job at all.

   Two faces are in the scene and only one is a slot. The painter is turned away
   on purpose so there is nothing on him to merge onto, and the prompt says so
   twice, because a model that picks wrong paints the customer as the help. */
function courtPainterPrompt(note){
  return 'The reference image shows a painter standing back from an easel, considering a grand ' +
  'state portrait they have just finished. A small photograph is clipped to the easel beside it.\n\n' +
  'Replace the face in the PAINTED PORTRAIT ON THE CANVAS with the face of the person in the ' +
  'uploaded photo. That canvas face is the only face you may change. The painter standing in the ' +
  'foreground is turned away from us -- do NOT give the painter this face, do not alter the ' +
  'painter at all, and do not touch the small photograph clipped to the easel.\n\n' +
  'THE PORTRAIT FLATTERS, AND THAT IS THE ENTIRE POINT OF THIS PICTURE. Paint them as the court ' +
  'painter would have: more powerful, more stately, more commanding and wiser than they appear ' +
  'in the photograph. A face that belongs above ermine and a laurel -- composed, unhurried, ' +
  'certain of itself, lit the way a master lights a patron they want to keep. This idealisation is ' +
  'deliberate and requested, and it overrides any general instruction not to beautify.\n\n' +
  'IT MUST STILL BE UNMISTAKABLY THEM. Keep the real bone structure, the real nose, the real eye ' +
  'shape and eye colour, the real mouth, the real jaw width, the real hairline, the real age and ' +
  'skin tone, and any distinctive features. Do not slim the face, do not substitute a model or a ' +
  'noble-looking stranger, do not invent a new person. The joke only works if the figure in the ' +
  'ermine is recognisably the person in the snapshot.\n\n' +
  'Render it as OIL PAINT, matching the canvas it sits in -- visible brushwork, the same palette ' +
  'and the same light as the rest of the painting. It is a painting of them, not a photograph ' +
  'pasted into one.\n\n' +
  'PRESERVE EXACTLY: the painter, the easel, the studio, the robes, the crown, the sceptre, the ' +
  'column and landscape behind, and the small clipped photograph. Change nothing but the face on ' +
  'the canvas.' + note;
}

global.FaceItPrompts = {
  MAGENTA_FIELD, faceNoteFrom, mirror: mirrorPrompt, mirrorStage: mirrorStagePrompt,
  courtPainter: courtPainterPrompt,
  stoneCarve: stoneCarvePrompt,
  mugshotSubject: mugshotSubjectPrompt,
  lineupFigure: lineupFigurePrompt
};

})(window);

/* ===========================================================================
   THE ROSTER
   ---------------------------------------------------------------------------
   kind          what the generator is asked for, and what happens afterwards
     face-merge    the original: one face onto a fixed 3:4 scene. 18 of these.
     text-merge    face-merge plus the customer's own words in the reference's
                   watercolor lettering. The two that were FACE_IT_TEXT_TEMPLATES.
     stone-carve   the model repaints the whole picture; the face becomes granite.
     mugshot       furniture drawn in canvas, subject generated, three fixed panels.
     lineup        fixed plate, one generated figure composited in at true height.

   shape         'portrait' for the 3:4 scenes, 'wrap' for anything that needs the
                 full band. Wrap templates are the ones showDesignMethodCard()
                 currently hides, and the reason that rule needs lifting.

   panels        'any'      customer puts the result on whichever panels they like
                 'triptych' three fixed views, positions locked, all or nothing

   products      omitted means every product the gimmicks run on. Present means
                 this template is fussy about its surface -- see the mug shot.

   preferredStyle  the Art Style this template is painted for, matched against the
                 style tiles' data-val prefix. Picking the template switches the
                 customer to it and says so; they can switch back. Present only
                 where the HOUSE DEFAULT actively fights the template: Muggshotz
                 Classic asks for "a premium painted caricature" with
                 "caricature-level exaggeration" and "funny but respectful
                 exaggeration", which is the wrong instruction to hand a soft
                 watercolour memorial portrait -- and it is what a customer gets
                 by scrolling past the Art Style card without choosing, which
                 many do. Not a lock: the style block still reads whatever is
                 selected at generation time.
   =========================================================================== */
(function(global){
'use strict';

const face = (file, name) => ({ file, name, kind: 'face-merge', shape: 'portrait', panels: 'any' });

const FACE_IT_TEMPLATES = [
  face('king.jpg',        'King'),
  face('queen.jpg',       'Queen'),
  face('emperor.jpg',     'Emperor'),
  face('empress.jpg',     'Empress'),
  face('the_don.jpg',     'The Don'),
  face('the_donna.jpg',   'The Donna'),
  face('hero_him.jpg',    'Hero'),
  face('hero_her.jpg',    'Heroine'),
  face('home_him.jpg',    'Home Sweet Home'),
  face('home_her.jpg',    'Home Sweet Home'),
  face('its_alive.jpg',   "It's Alive"),
  face('aww_hell.jpg',    'Aww Hell'),
  face('your_future.jpg', 'Your Future'),
  face('all_hail.jpg',    'All Hail'),
  face('cloud_9_her.jpg', 'Cloud 9'),
  face('cloud_9_him.jpg', 'Cloud 9'),
  face('heavenly_host.jpg',    'Heavenly Host'),
  face('heavenly_hostess.jpg', 'Heavenly Hostess'),

  { file: 'on_my_mind.jpg', name: 'On My Mind', kind: 'text-merge',
    shape: 'portrait', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic' },
  { file: 'come_to_think_of_it.jpg', name: 'Come To Think Of It', kind: 'text-merge',
    shape: 'portrait', panels: 'any', textInputs: 1, poseNote: 'three-quarter' },

  /* --- NEW, Sep 2026 ----------------------------------------------------- */

  /* Needs a plate: five-head Rushmore, blank unworked rock in the fifth
     position, composed at 2475 x 1155. The headline is carved into the art and
     the model redraws it every run, which is the known risk on this one --
     crop budget comes off the foreground, never the headroom. */
  // PROVED AGAINST THE REAL MODEL (2026-09-15). Two live runs through the
  // face-on-template harness with this exact prompt and plate: likeness held,
  // the four presidents and the carved headline survived, and the fifth head
  // grew out of the cliff with no seam or cut-out edge.
  //
  // It does NOT come back as granite. The face stays photographic -- real skin,
  // real teeth, real eyes -- because identityLock is prepended to every
  // generation and insists on "the real ... skin tone" and the person's actual
  // clothing. Two attempts to win that argument from the customer prompt both
  // failed: three paragraphs of granite insistence, then a scoped permission to
  // suspend skin tone, texture, eye colour and clothing. The second also
  // loosened the likeness, drifting the face toward a generic bald archetype,
  // so it was dropped.
  //
  // Shipped as-is on Alyx's call: the photographic version is instantly
  // recognisable as the customer, which is what they are buying. The MATERIAL
  // paragraph stays despite producing no granite -- it is what keeps the head
  // embedded in the rock rather than pasted onto it, which Alyx had established
  // from earlier runs of his own without it.
  { file: 'mount_rushmore.webp', name: 'The 5th Face', kind: 'stone-carve',
    shape: 'wrap', panels: 'any', poseNote: 'three-quarter',
    needsPlate: true },

  /* No plate at all -- drawn by FaceItMugshot at the surface's real size.
     Restricted to the two surfaces whose wrap is actually panoramic: three
     booking views across a 20oz's 1.33:1 band are three slivers, and the 30oz
     Tundra mirrors its flanks to fill 3.50:1, which would duplicate a profile. */
  { file: null, name: 'Mug Shot', kind: 'mugshot',
    shape: 'wrap', panels: 'triptych', procedural: true,
    textInputs: 3,
    textDefaults: ['ATE MY UNDERWEAR', 'IT WAS THE CAT', 'WOULD DO IT AGAIN'],
    textRoster: ['ATE THE COUCH', 'NO REMORSE', 'COUNTER SURFING', 'REPEAT OFFENDER',
                 'UNREPENTANT', 'THE COUCH HAD IT COMING', 'DUG IT UP', 'BARKED ALL NIGHT'],
    subjectScale: 'choice',
    products: ['mug', 'travel-mug-14oz-handle'],
    poseNote: 'frontal' },

  /* THE COURT PAINTER (Sep 2026, Alyx). Mirror Mirror's companion and its
     opposite. The mirror is private, reflexive and about beauty, so it is bought
     for yourself; this is public, testimonial and about stature, so it can be
     GIVEN. That difference is not decoration -- it decides who the joke lands on.
     Flattery that comes from a third party leaves the customer innocent by
     construction: nobody is caught being vain, they are being honoured by
     somebody who evidently got carried away.

     THE WINK IS THE PHOTOGRAPH, and it needs no second asset. A wink announces a
     joke and costs the customer the deniability they bought; the snapshot clipped
     to the easel merely proves the painter had the truth six inches from his
     brush and painted something else. Evidence rather than announcement, which is
     why this template ships one picture where Mirror Mirror needs two.

     photoQuad is that snapshot's four corners as fractions of the plate, so it
     scales to whatever size the model returns. Measured off the delivered art and
     proved by compositing a test pattern into it: 113 x 187 px on the 1086 x 1448
     plate, tilted 3.5 degrees, which is why it is a quad and not a rectangle.
     A replacement plate needs this re-measured; nothing detects it at runtime. */
  { file: 'court_painter.webp', name: 'The Court Painter', kind: 'painter',
    shape: 'portrait', panels: 'any', poseNote: 'three-quarter',
    idealise: true,
    photoQuad: [[0.8306,0.0760],[0.9346,0.0711],[0.9411,0.1989],[0.8352,0.2051]] },

  /* MIRROR MIRROR (Sep 2026, Alyx's idea end to end).
     A figure stands with their back to us at an ornate storybook mirror, and the
     reflection is flattering them. The gag is the lie -- and a lie needs a liar,
     which is what the face carved into the crest of the frame supplies. Without
     it a generous reflection is just a bad mirror; with it, something lives in
     the glass and is CHOOSING what to show. That carved face is the whole device.

     `idealise` is the switch that lets the server's identityLock stand down, and
     this is one of only two templates that carries it. Flattery stopped being
     something that happens to customers by accident this afternoon; here it is
     something they ask for by name, which is the difference between a gag and a
     defect.

     THE WINK SHIPS. This template briefly had two paintings: a straight-faced
     plate to print and a winking one to advertise, on my reasoning that an
     object that winks announces the vanity the customer paid not to have to
     admit. That reasoning was wrong, and Alyx had already said why before I
     wrote it: "the face carved at the top of the mirror, that was the thing
     that immediately sold me. It was not just decoration, it was a clue...
     almost an invocation."
     Deniability was never what the carving was for. The gag is a lie, a lie
     needs a liar, and the wink is the liar's tell -- it is the one mark in the
     picture that says something is IN there, choosing what to show. Sell the
     device and ship a mirror that merely flatters and you have sold the joke
     and delivered the defect. So the winking painting is the plate now, and it
     is the tile too, because a picture good enough to sell the thing is good
     enough to be the thing. It is also the better merge target: its reflection
     sits larger in frame, which is more paint on the only slot we fill.

     THE BACK OF THE HEAD IS THE ONE PLACE WE CAN AFFORD TO BE WRONG, and that
     is exactly why the merge is allowed to repaint it (Alyx, Sep 2026: "the
     person standing looking in the mirror should approximate the pose of the
     person in the picture, except it would show what it looked like from
     behind"). The prompt used to freeze that figure -- "leave them exactly as
     painted" -- which left every customer watching a stranger with their own
     face in the glass.
     Note what is being asked of the model: a back view is INFERRED, not
     derived. A silhouette is the same viewpoint with the detail thrown away,
     so it can be computed; the nape, the crown, the way hair falls behind the
     ear are invented. That is fine here and nowhere else in the roster,
     because this figure is not the identity slot -- the reflection is, and it
     carries the whole recognition burden. Nobody can check a back. It does not
     have to be provably them, it only has to stop being somebody else.
     The hard line is the face: a figure that turns even to a profile puts two
     faces in the picture and the mirror stops being a mirror.

     Portrait only, deliberately. A wrap version would need the mirror composed
     to a band, and a mirror that wide stops reading as a mirror.

     A photograph of the customer was tried here as the evidence, the way the
     court painter uses one, and Alyx killed it on three counts worth recording:
     at an easel the customer is being DEPICTED so the photo indicts the painter,
     while at a mirror the customer is LOOKING so the same photo indicts them for
     believing it; a photograph is the wrong century for a fairy tale; and it is
     a plot hole -- put a camera in the room and the magic mirror has no job. */
  { file: 'mirror_mirror.webp',
    name: 'Mirror Mirror', kind: 'mirror',
    shape: 'portrait', panels: 'any', poseNote: 'three-quarter',
    idealise: true },

  /* MIRROR MIRROR, AS THE BAND (Sep 2026, Alyx). Not a wider painting of the
     same scene, the way On My Mind's band is -- a 3:4 mirror stretched to
     2.15:1 stops being a mirror. This is the portrait STANDING IN A ROOM that
     was painted to be a band.

     Alyx's design, and it is the studio's own trick turned on a template:
     "all we're using is the same technique as we used to make our little
     theater where Needles paints his little studio images. That background is
     static. It's the foreground image that does all the moving."

     `stage` is what makes it work. The merge returns the mirror and the figure
     alone on magenta (mirrorStagePrompt), and buildStagedWrap keys them and
     stands them in this room. Nothing has to agree with anything generated,
     which is why a seam that would otherwise be a per-run gamble is settled
     once, by the painter: the stage's far edges measure 5.5/255 apart.

     It also fixes the lighting the honest way round. Two generated halves can
     only be hoped into agreement about where the candles are; against a fixed
     painting the cut-out's prompt is written to match what is already there.
     Candles at the LEFT, in both.

     `tile` earns its exemption here -- see tileFor(). The plate is a portrait
     reference for the merge and would advertise the wrong shape entirely, so
     the tile shows the band the customer is actually buying.

     The mirror lands at about a third of the wrap at full band height, which
     is the presence this template needs. Both surfaces that share the 2.14-2.15
     band are listed; the narrower cups would crowd it and the Tundra's 3.50
     would strand it in the middle of a very long room. */
  { file: 'mirror_mirror.webp', tile: 'mirror_stage_tile.webp',
    stage: 'mirror_stage.webp',
    name: 'Mirror Mirror', kind: 'mirror',
    shape: 'wrap', panels: 'any', poseNote: 'three-quarter',
    idealise: true,
    products: ['mug', 'travel-mug-14oz-handle'] },

  /* ON MY MIND, AS THE BAND (Sep 2026). Not a variant of the 3:4 plate -- a
     second painting of the same idea, composed wide from the start, which is
     the only honest way a portrait template becomes a wraparound. The 3:4 one
     stays exactly where it is for Three Panels.
     
     Proof that this was always an artwork problem and never a code one: these
     go through the text-merge branch untouched. Nothing in that prompt, or in
     the merge path, or in FACE_IT_TEXT_TEMPLATES, asks what shape the plate
     is -- the branch keys off `kind`. The only thing that changes downstream
     is the plate being sent at 2048px instead of 1024.

     Composed for the seam rather than for a frame, which is the one demand a
     3:4 plate never has to meet: the far left and far right thirds are empty
     uniform wash, ending at the same tone as each other, so the two edges meet
     at the back of the cup with nothing at the join to misalign. Measured on
     delivery at a mean row deviation of 2.7/255 across the full height, worst
     row under 9. Judge any replacement plate the same way -- it is the only
     property here that the 3:4 original does not already prove.

     Two of them, mirrored, for the same reason king/queen and home_him/home_her
     are two: same name in the grid, customer picks the side. Named for where
     the SUBJECT sits, not the text.

     Restricted, on the Mug Shot's precedent and for the Mug Shot's reason. The
     band is 2.14:1 and these are painted to it -- the coffee mug (2.14) and the
     14oz handle (2.15) are the two surfaces that wear it without distortion.
     The 20oz and the vacuum 40oz are 1.33:1 and 1.32:1, so the plate would have
     to lose a third of its width; the Tundra is 3.50:1 and mirrors its flanks,
     which here would be harmless (those flanks are bare wash) but has never
     been printed. Widen this list from a real print, not from arithmetic. */
  /* AND THE TUNDRA, THE WIDEST BAND WE SELL (Sep 2026). 3.50:1, nearly twice the
     coffee mug's, and the first plate in this set with room to spare: she and
     the lettering sit well apart with a broad stretch of open wash between them
     instead of shoulder to shoulder.

     DELIVERED AT 3.00, NOT 3.50, and it does not matter -- which is worth
     recording so nobody "fixes" it later. The model returns 1536x1024 whatever
     shape the plate is (getImageSizeParam asks for that on every wraparound),
     and extendWrapToProductRatio then widens the RESULT to the cup's band by
     clamping the bare flanks outward. So a plate's ratio guides the composition
     it suggests; it does not constrain the output. Any reference between about
     2.5 and 3.5 lands in the same place here.

     Seams 1.52 and 1.61 out of 255, worst rows 4.5 and 3.5, margins 21/23 and
     22/24 per cent. Every band we sell now has a plate painted for it. */
  { file: 'on_my_mind_tundra_left.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-30oz-tundra'] },
  { file: 'on_my_mind_tundra_right.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-30oz-tundra'] },

  /* AND AGAIN FOR THE GATOR (Sep 2026). The third band, and the last one that
     needed its own composition rather than a crop: 1.75 sits between the 2.14
     pair and the 1.32 pair, so she and the lettering sit further apart than on
     the narrow plates and closer than on the wide ones. Nothing else changes.

     Tightest seams delivered so far, and the left-facing one is the best plate
     in the roster: mean row deviation 1.38 and 1.88 out of 255, worst rows 4.2
     and 4.8, on a ratio that measured 1.750 against a 1.75 band. Margins 24/20
     and 22/25 per cent, comfortably past the 15 asked for.

     One cup wears this band today. Named for it rather than for the ratio
     because that is how the other two pairs ended up named, and consistency
     beats precision in a filename. */
  { file: 'on_my_mind_gator_left.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-32oz-gator'] },
  { file: 'on_my_mind_gator_right.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-32oz-gator'] },

  /* THE SAME PAINTING AGAIN, FOR THE NARROW BANDS (Sep 2026). The pair above is
     painted to 2.14:1 and wears the mug and the 14oz. The 20oz and the vacuum
     40oz are 1.33:1 and 1.32:1 -- barely wider than tall -- so putting a 2.14
     plate on one means throwing away a third of its width, and the first thing
     lost is the empty flank the seam depends on. Hence a second pair rather
     than a crop.

     Not a resize: at 1.32 there is no room for a third of the width at each
     end, so she and the lettering sit closer together and the margins come down
     to roughly a fifth. Same wash, same hand, same face treatment.

     Measured on delivery, and these are the tightest plates in the roster:
     mean row deviation 1.37 and 1.54 out of 255, worst rows 4.6 and 3.9 -- half
     the wide pair's. They also carry 1091px of height against the wide pair's
     857, which is the dimension a face has to survive the merge on.

     NO PLATE-PICKER NEEDED, and that is worth saying because it looks like it
     should be: one template still means one plate. These four entries never
     compete, because `products` keeps each pair on the surfaces it was painted
     for, and no surface appears in both lists. A picker only becomes necessary
     the day one cup has two plates claiming it. */
  { file: 'on_my_mind_narrow_left.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-40oz-vacuum', 'travel-mug-20oz'] },
  { file: 'on_my_mind_narrow_right.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['travel-mug-40oz-vacuum', 'travel-mug-20oz'] },

  { file: 'on_my_mind_left.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['mug', 'travel-mug-14oz-handle'] },
  { file: 'on_my_mind_right.webp', name: 'On My Mind', kind: 'text-merge',
    shape: 'wrap', panels: 'any', textInputs: 1, poseNote: 'three-quarter',
    preferredStyle: 'photorealistic',
    products: ['mug', 'travel-mug-14oz-handle'] },

  /* Needs a plate: the lineup room with the empty slot moved to the CENTRE of
     the strip. At the far right the customer lands on the handle seam and gets
     bisected, with the alien and the granny across the front of the mug. */
  // The delivered plate's rules are uniformly spaced every six inches, but its
  // labels read 7'6" 7'0" 6'6" 6'0" 5'0" 4'6" 4'0" 3'6" 3'0" -- the step from
  // 6'0" to 5'0" claims twelve inches and gets the same spacing as every
  // six-inch step either side of it. So 5'6" was never written and every label
  // below it is six inches low; the bottom rule says 3'0" where 3'6" belongs.
  //
  // That is not a cosmetic typo here. This chart is the instrument customers
  // are measured against, so relabelLineupChart moves the existing numbers onto
  // the lines they belong to before anything is composited onto the plate.
  // Plate delivered, chart relabelled, height maths proved arithmetically. Not
  // proved visually: no real cutout has ever been composited onto it, and the
  // prompt has to invent a whole standing body from a head shot. The despill is
  // also only proved on golden fur, not on skin and hair.
  { file: 'lineup.webp', name: 'The Lineup', kind: 'lineup',
    shape: 'wrap', panels: 'any', needsPlate: true, unvalidated: true,
    heightInput: true, chart: 'human', poseNote: 'frontal' }
];

const byFile = {};
FACE_IT_TEMPLATES.forEach(t => { if (t.file) byFile[t.file] = t; });

/* Stable key for templates with no file of their own. */
FACE_IT_TEMPLATES.forEach(t => { t.id = t.file || ('procedural:' + t.name.toLowerCase().replace(/\s+/g, '-')); });
const byId = {};
FACE_IT_TEMPLATES.forEach(t => { byId[t.id] = t; });

/* Derived, so every existing reader keeps working unchanged. The flat array was
   the roster for three years; nothing that reads it needs to learn about objects
   on the same day the roster grows. */
/* awaitingArt keeps a template out of the customer-facing grid until its plate
   actually exists in the repo. Without it the grid renders an <img> pointing at
   a file nobody has delivered yet, and a broken tile is worse than no tile --
   it is a customer clicking something that cannot generate. Flip the flag in
   the same commit that adds the artwork. The bench ignores it on purpose, which
   is how the layout gets calibrated before the art arrives. */
/* unvalidated is a different thing from awaitingArt and deserves its own flag.
   awaitingArt means the picture does not exist yet. unvalidated means it does,
   and the code is wired and tested, but the PROMPT has never been run against
   the real model -- so we do not know what the customer would actually get.
   Both keep a template out of the grid; only one is fixed by a delivery.

   faceit-bench.html ignores both on purpose, so all three can be previewed and
   calibrated while the storefront offers only what has been proved. */
function isLive(t){ return !t.awaitingArt && !t.unvalidated; }

const FACE_IT_CATALOG = FACE_IT_TEMPLATES.filter(t => t.file && isLive(t)).map(t => t.file);
const FACE_IT_TEXT_TEMPLATES = new Set(
  FACE_IT_TEMPLATES.filter(t => t.kind === 'text-merge' && t.file).map(t => t.file)
);

/* What the customer-facing grid should actually offer, in order. */
function liveTemplates(){ return FACE_IT_TEMPLATES.filter(isLive); }

/* The procedural template has no file to point an <img> at, so its tile is
   drawn by the same code that draws the template. One source of truth: if the
   placards move, the thumbnail moves with them. */
function tileFor(t, px){
  // THE ADVERT NEED NOT BE THE ARTWORK (Sep 2026) -- a capability, currently
  // with no takers. It was added for Mirror Mirror, which shipped a straight
  // plate and a winking tile until Alyx caught the swap and pointed out that
  // the wink is the device, not the advertising for it (see that template's
  // note). Every template now prints the picture it shows, which is the
  // healthier default: a tile that differs from its plate is a promise the
  // parcel has to keep. Kept, because a genuinely croppable advert is a fair
  // use of it -- but the bar is that the plate must not be the weaker picture.
  if (t.tile) return t.tile;
  if (t.file) return t.file;
  if (t.kind !== 'mugshot' || !global.FaceItMugshot) return null;
  const mug = global.FaceItGeom.SURFACES.mug;
  const W = px || 480, H = Math.round(W * (mug.h / mug.w));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const opts = Object.assign({}, global.FaceItMugshot.DEFAULTS, { chart: 'pet' });
  global.FaceItMugshot.drawBackplate(ctx, W, H, opts);
  global.FaceItMugshot.drawForeplate(ctx, W, H, t.textDefaults || [], opts);
  return c.toDataURL('image/png');
}

function get(idOrFile){ return byId[idOrFile] || byFile[idOrFile] || null; }
function isWrapNative(t){ t = (typeof t === 'string') ? get(t) : t; return !!(t && t.shape === 'wrap'); }
function textInputCount(t){ t = (typeof t === 'string') ? get(t) : t; return (t && t.textInputs) || 0; }
function allowsProduct(t, productKey){
  t = (typeof t === 'string') ? get(t) : t;
  if (!t || !t.products) return true;
  return t.products.indexOf(productKey) !== -1;
}

/* ---------------------------------------------------------------------------
   PLATE CONSTANTS, PER TEMPLATE
   ---------------------------------------------------------------------------
   These are as much a specification for the artwork as they are code: they say
   where on the strip the chart's top and bottom lines sit and where the floor
   is, and a plate painted to different numbers will not line up. Caught on the
   bench (Sep 2026): seeding the lineup from MUGSHOT_DEFAULTS put its floor at
   1717px on an 1155px strip, so every figure ran off the bottom of the mug.

   The two templates differ because they are different photographs. A booking
   photo is cropped at the chest and never shows a floor, so its chart fills the
   frame. A lineup is a full-length standing shot, so its chart has to stop well
   short of the bottom and leave room for legs and stage.
   --------------------------------------------------------------------------- */
const PLATE_DEFAULTS = {
  mugshot: null,   // uses FaceItMugshot.DEFAULTS -- it draws its own furniture
  /* MEASURED OFF lineup.webp, not chosen. The rules were found by scanning two
     independent columns of bare wall; the floor by the strongest sustained
     brightness step low in the frame.

     Note the chart does NOT extrapolate to the floor -- its implied zero sits
     at y=1282 on an 1155px plate. That is not an error, it is the perspective
     of the room: the chart is on the back wall and the cast stands in front of
     it. Because floorPct is anchored to the painted floor rather than to the
     chart's zero, a generated figure comes out in the same relationship to the
     chart as the painted cast. Checked: a 5'4" customer renders 533px tall and
     the biker, whose crown sits on 5'4", is 535px. */
  lineup: {
    chart:          'human',
    chartTopPct:    0.1476,  // the 7'6" rule, y=170.5
    chartBottomPct: 0.6610,  // the 3'6" rule, y=763.5
    floorPct:       0.8874   // where feet meet the stage, y=1025
  },
  'stone-carve': null
};

global.FaceItCatalog = {
  PLATE_DEFAULTS, isLive, liveTemplates, tileFor,
  TEMPLATES: FACE_IT_TEMPLATES,
  FACE_IT_CATALOG, FACE_IT_TEXT_TEMPLATES,
  get, isWrapNative, textInputCount, allowsProduct
};

})(window);

/* ===========================================================================
   BUILDING THE FINISHED STRIP
   ---------------------------------------------------------------------------
   Both of the composited templates end up here: one canvas at the print
   surface's real size, which the caller then cuts into thirds exactly the way
   the panorama path already cuts a generated panorama. Returning a canvas
   rather than writing to placements keeps this testable from the bench, which
   has no placements to write to.
   =========================================================================== */
(function(global){
'use strict';
const G = global.FaceItGeom, C = global.FaceItComposite, M = global.FaceItMugshot;

function surfaceOf(key){ return G.SURFACES[key] || G.SURFACES.mug; }

/* ---------------------------------------------------------------------------
   FIXING THE LINEUP'S CHART LABELS BY MOVING THEM, NOT REDRAWING THEM
   ---------------------------------------------------------------------------
   The plate's rules are evenly spaced every six inches and correct. Its labels
   are not: 5'6" was never written, so from the fifth line down each number
   reads six inches low and the bottom rule says 3'0" where 3'6" belongs.

   Four earlier attempts tried to ERASE the wrong numbers and draw new ones --
   probe-column fill, row-median fill, per-label boxes, then inpainting of the
   glyph runs. All of them removed the numbers and all of them left a patch,
   because the wall behind them carries a vignette, a pool of lamplight and a
   warm bounce off the biker, and because a synthesised font never quite sits
   in a photograph.

   Nothing has to be drawn. Line up what the chart has against what it needs:

       line   has     needs
        5th   5'0"    5'6"
        6th   4'6"    5'0"
        7th   4'0"    4'6"
        8th   3'6"    4'0"
        9th   3'0"    3'6"

   Every one of those except the fifth is the label from the line ABOVE it. So
   each block moves down one position, bottom-up, and it arrives as real pixels
   -- his typeface, his bevel, his lighting, already photographic.

   That leaves the fifth line wanting 5'6", which exists nowhere. Its parts do:
   keep the 5' that is already there and borrow the 6 from 6'6" four lines up,
   which sits at the same x, so it drops in without a nudge.

   Sources are read from a snapshot of the untouched plate, so a block that has
   already been moved can never become the source for the next one. Edges are
   feathered because each block brings its own slice of wall down with it and
   the wall is a shade different 75px lower.
   --------------------------------------------------------------------------- */
const LINEUP_LABELS = {
  ruleY: [170.5, 239.5, 312, 387, 461.5, 536.5, 612.5, 688, 763.5],
  /* the number blocks, clear of the rules either side of them */
  leftRect:  { x: 48,   w: 70 },
  rightRect: { x: 2368, w: 72 },
  /* just the second digit, for splicing 5'6" together */
  leftDigit2:  { x: 77,   w: 20 },
  rightDigit2: { x: 2398, w: 20 },
  halfH: 24,
  feather: 7,
  sourceOfSix: 2,     // index of 6'6", whose second digit is the 6 we borrow
  brokenFrom: 4       // index of the first wrong label (the one reading 5'0")
};

function relabelLineupChart(ctx, W, H, cfg){
  const k = cfg || LINEUP_LABELS;
  const sx = W / 2475, sy = H / 1155;

  /* untouched copy: every source is read from here */
  const snap = document.createElement('canvas');
  snap.width = W; snap.height = H;
  snap.getContext('2d').drawImage(ctx.canvas, 0, 0);

  const cols = [
    { rect: k.leftRect,  digit: k.leftDigit2  },
    { rect: k.rightRect, digit: k.rightDigit2 }
  ];

  const move = (col, rect, fromIdx, toIdx) => {
    const x = Math.round(rect.x * sx), w = Math.round(rect.w * sx);
    const h = Math.round(k.halfH * 2 * sy);
    const ys = Math.round(k.ruleY[fromIdx] * sy - k.halfH * sy);
    const yd = Math.round(k.ruleY[toIdx]   * sy - k.halfH * sy);
    ctx.drawImage(feathered(snap, x, ys, w, h, Math.round(k.feather * sy)), x, yd);
  };

  /* bottom-up, so nothing is overwritten before it has been read */
  for (let i = k.ruleY.length - 1; i > k.brokenFrom; i--){
    cols.forEach(c => move(c, c.rect, i - 1, i));
  }
  /* and the one number the chart never had */
  cols.forEach(c => move(c, c.digit, k.sourceOfSix, k.brokenFrom));
}

/* A copy whose edges fade out, so the slice of wall it carries blends into the
   wall it lands on instead of announcing itself with four hard sides. */
function feathered(src, x, y, w, h, f){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(src, x, y, w, h, 0, 0, w, h);
  if (f > 0){
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let yy = 0; yy < h; yy++){
      for (let xx = 0; xx < w; xx++){
        const e = Math.min(xx, yy, w - 1 - xx, h - 1 - yy);
        if (e < f) d[(yy * w + xx) * 4 + 3] = Math.round(255 * (e / f));
      }
    }
    g.putImageData(img, 0, 0);
  }
  return c;
}

/* THE MUG SHOT. The model returns one wide image holding three views side by
   side -- one generation, not three, so the three are the same animal and the
   placards read identically. Splitting it into equal thirds is the same
   assumption the prompt is written around ("evenly spaced, all at exactly the
   same scale"), and each third is then measured and placed on its own, so a
   model that centres a view slightly off still lands right. */
function buildMugshotStrip(subjectImg, opts){
  const o = opts || {};
  const S = surfaceOf(o.surface);
  const W = S.w, H = S.h;
  const cal = Object.assign({}, M.DEFAULTS, o.cal || {}, { chart: o.chart || 'pet' });

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  const scale = M.drawBackplate(ctx, W, H, cal);

  if (subjectImg){
    const clean = (o.despill === false) ? subjectImg : C.despillMagenta(subjectImg);
    const sw = clean.naturalWidth || clean.width;
    const sh = clean.naturalHeight || clean.height;
    const headIn = (cal.chart === 'pet') ? 20 : 68;
    for (let i = 0; i < 3; i++){
      /* cut one view out of the three-up sheet, then measure THAT view */
      const slice = document.createElement('canvas');
      slice.width = Math.floor(sw / 3); slice.height = sh;
      slice.getContext('2d').drawImage(clean, -Math.floor(sw / 3) * i, 0);
      C.placeBust(ctx, slice, scale, headIn, W / 3 * (i + 0.5), H, cal.subjectHPct);
    }
  }

  M.drawForeplate(ctx, W, H, o.texts || [], cal);
  return cv;
}

/* THE LINEUP. Plate, then one figure at the customer's real height, and that is
   the whole composite -- the plate carries everything else and is never redrawn,
   so the alien and the granny are identical on every mug that ships. */
function buildLineupStrip(plateImg, subjectImg, opts){
  const o = opts || {};
  const S = surfaceOf(o.surface);
  const W = S.w, H = S.h;
  const plate = Object.assign({}, (global.FaceItCatalog && global.FaceItCatalog.PLATE_DEFAULTS.lineup) || {}, o.cal || {});

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  if (plateImg){
    ctx.drawImage(plateImg, 0, 0, W, H);
    /* The plate ships with one label missing; relabelLineupChart moves the
       existing numbers onto the lines they belong to. Pass relabel:false to see
       the plate exactly as delivered. */
    if (o.relabel !== false) relabelLineupChart(ctx, W, H, o.chartCfg);
  }

  const scale = G.buildChartScale(
    G.CHARTS[plate.chart || 'human'],
    H * plate.chartTopPct, H * plate.chartBottomPct,
    plate.floorPct ? H * plate.floorPct : null
  );

  if (subjectImg && o.heightInches){
    const cleanFig = (o.despill === false) ? subjectImg : C.despillMagenta(subjectImg);
    /* Centre of the strip, not the end of the lineup. On a wraparound the two
       outer edges meet at the handle, so a figure placed where the reference
       art had its empty slot gets sawn in half by it -- with the rest of the
       lineup across the front of the mug and the customer nowhere. */
    C.placeFigure(ctx, cleanFig, scale, o.heightInches, W * (o.centerPct == null ? 0.5 : o.centerPct));
  }
  return cv;
}

/* Cut a finished strip into the three panels the mug flow expects. Same thirds
   the panorama slicer uses, so the joins stay continuous by construction. */
function sliceIntoPanels(cv, type, quality){
  const W = cv.width, H = cv.height, t = W / 3;
  const out = [];
  for (let i = 0; i < 3; i++){
    const p = document.createElement('canvas');
    p.width = Math.round(t); p.height = H;
    p.getContext('2d').drawImage(cv, Math.round(t * i), 0, Math.round(t), H, 0, 0, Math.round(t), H);
    out.push(p.toDataURL(type || 'image/png', quality));
  }
  return { left: out[0], center: out[1], right: out[2] };
}

/* ---------------------------------------------------------------------------
   THE REFERENCE PHOTOGRAPH ON THE EASEL
   ---------------------------------------------------------------------------
   The court painter's joke is the distance between the snapshot clipped to his
   easel and the coronation on his canvas -- so the snapshot has to be the
   CUSTOMER'S, and it has to be exact. Asking the model for it fails twice: it
   would invent a second face for the merge to confuse itself with, and it would
   have to be told to paint somebody deliberately plainer, which is the exact
   instruction identityLock exists to forbid.

   So the model never sees it. It paints the scene, and the real photograph is
   dropped in afterwards, the same way the mug shot draws its own placards rather
   than trusting the model with lettering. Exact every run, by construction.

   The quad is stored as fractions of the plate so it survives whatever size the
   generation comes back at. It is very nearly a rotated rectangle -- a couple of
   pixels of taper over 187 -- so this rotates and scales rather than doing a
   real perspective warp, which canvas has no native support for and which nobody
   could tell apart at this size.
   --------------------------------------------------------------------------- */
function quadGeometry(quad, W, H){
  const p = quad.map(([fx,fy]) => [fx*W, fy*H]);
  const [tl,tr,br,bl] = p;
  const mid = (a,b) => [(a[0]+b[0])/2, (a[1]+b[1])/2];
  const top = mid(tl,tr), bot = mid(bl,br);
  const left = mid(tl,bl), right = mid(tr,br);
  return {
    cx: (tl[0]+tr[0]+br[0]+bl[0])/4,
    cy: (tl[1]+tr[1]+br[1]+bl[1])/4,
    w: Math.hypot(right[0]-left[0], right[1]-left[1]),
    h: Math.hypot(bot[0]-top[0], bot[1]-top[1]),
    angle: Math.atan2(tr[1]-tl[1], tr[0]-tl[0])
  };
}

/* Centre-cropped to the card's own proportions first, so a portrait phone photo
   and a square one both fill it without stretching anybody sideways. */
function drawPhotoIntoQuad(ctx, photo, quad, W, H){
  const g = quadGeometry(quad, W, H);
  const want = g.w / g.h;
  const pw = photo.naturalWidth || photo.width, ph = photo.naturalHeight || photo.height;
  let sx=0, sy=0, sw=pw, sh=ph;
  if (pw/ph > want) { sw = Math.round(ph*want); sx = Math.round((pw-sw)/2); }
  else              { sh = Math.round(pw/want); sy = Math.round((ph-sh)/2); }
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate(g.angle);
  ctx.drawImage(photo, sx, sy, sw, sh, -g.w/2, -g.h/2, g.w, g.h);
  // A breath of the studio's warmth over it. Without this a phone snapshot sits
  // on the painting like a sticker; with it, it reads as a print in candlelight.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#c99a5e';
  ctx.fillRect(-g.w/2, -g.h/2, g.w, g.h);
  ctx.restore();
  return g;
}

global.FaceItBuild = { buildMugshotStrip, buildLineupStrip, sliceIntoPanels, surfaceOf,
                       relabelLineupChart, LINEUP_LABELS,
                       quadGeometry, drawPhotoIntoQuad };

})(window);
