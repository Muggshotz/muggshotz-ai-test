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
  human: { minIn: 36, maxIn:  90, stepIn: 6 }
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

global.FaceItComposite = { opaqueBounds, placeFigure, placeBust, drawContactShadow };

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

global.FaceItPrompts = {
  MAGENTA_FIELD, faceNoteFrom,
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
    shape: 'portrait', panels: 'any', textInputs: 1, poseNote: 'three-quarter' },
  { file: 'come_to_think_of_it.jpg', name: 'Come To Think Of It', kind: 'text-merge',
    shape: 'portrait', panels: 'any', textInputs: 1, poseNote: 'three-quarter' },

  /* --- NEW, Sep 2026 ----------------------------------------------------- */

  /* Needs a plate: five-head Rushmore, blank unworked rock in the fifth
     position, composed at 2475 x 1155. The headline is carved into the art and
     the model redraws it every run, which is the known risk on this one --
     crop budget comes off the foreground, never the headroom. */
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

  /* Needs a plate: the lineup room with the empty slot moved to the CENTRE of
     the strip. At the far right the customer lands on the handle seam and gets
     bisected, with the alien and the granny across the front of the mug. */
  // HELD BACK ON A CHART DEFECT, not on missing artwork (Sep 2026). The plate
  // is delivered and is the right size, but its labels are wrong: the rules are
  // uniformly spaced every 6 inches (measured at 69-76px apart across the whole
  // chart, perspective accounting for the drift), while the labels read
  //   7'6"  7'0"  6'6"  6'0"  5'0"  4'6"  4'0"  3'6"  3'0"
  // The step from 6'0" to 5'0" is twelve inches and gets the same spacing as
  // every six-inch step, so 5'6" is missing and every label below it is six
  // inches out. The bottom rule reads 3'0" but physically sits where 3'6"
  // belongs.
  //
  // That matters more here than it would on ordinary artwork, because this is
  // the chart customers are measured against: buildChartScale anchors on the
  // top and bottom labels, so mapping 54 inches onto a span that is really 48
  // would stretch every figure by about 12%. Anchoring on the pitch instead
  // would place people correctly but still print a label six inches wrong
  // beside their own head. Fix belongs in the art.
  { file: 'lineup.webp', name: 'The Lineup', kind: 'lineup',
    shape: 'wrap', panels: 'any', needsPlate: true, awaitingArt: true,
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
function isLive(t){ return !t.awaitingArt; }

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
  lineup: {
    chart:          'human',
    chartTopPct:    0.080,   // the 7'6" line
    chartBottomPct: 0.572,   // the 3'0" line
    floorPct:       0.900    // where feet meet the stage
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
   REPAINTING THE LINEUP'S CHART LABELS  —  FALLBACK ONLY, OFF BY DEFAULT
   ---------------------------------------------------------------------------
   VERDICT (Sep 2026): this gets the numbers right and the picture wrong. Keep
   it as the fallback for a plate nobody can re-export; prefer fixing the label
   in the artwork's own source every time.

   Four techniques were tried against the delivered plate -- probe-column fill,
   row-median fill, row-median fill inside per-label boxes, and finally
   horizontal inpainting of the glyph runs. Each removed the numbers. Each also
   left a visible patch, because the wall behind them is not a flat tone: it
   carries a horizontal vignette, a pool of lamplight across the top, a warm
   bounce off the biker's skin, and the chart rules running through it. Any
   reconstruction good enough to fool the eye is doing real inpainting, and this
   is not that.

   Relabelling in the source file is a minute's work for whoever holds it, and
   it is the version customers should see. This exists so that a plate whose
   source is lost is still shippable, not because it is the better answer.
   ---------------------------------------------------------------------------
   The delivered plate's rules are right -- uniformly spaced, correctly drawn,
   carrying the room's perspective and lighting. Its LABELS are not: 5'6" was
   never written, so every number below it reads six inches low, and the bottom
   rule says 3'0" where 3'6" belongs.

   Sending that back to be relabelled would have worked and would have been
   slower. It would also have left the same failure possible again, because the
   numbers on the wall and the numbers the placement maths uses would still be
   two separate sources that agree only by care.

   So the labels are painted here instead, from the same array the scale is
   built from. They cannot disagree now: the label beside a customer's head and
   the arithmetic that put their head there are the same nine values.

   This works because of where those labels sit -- two clean margin bands of
   bare wall, no rules running under them and no figure within reach. Masking
   is a per-row sample of the wall just inboard of each band, so the wall's
   vertical gradient and its lamp falloff carry across the patch.
   --------------------------------------------------------------------------- */
const LINEUP_CHART = {
  /* measured off lineup.webp at 2475 x 1155, top rule down */
  ruleY:  [170.5, 239.5, 312, 387, 461.5, 536.5, 612.5, 688, 763.5],
  inches: [    90,    84,  78,  72,    66,    60,    54,  48,    42],
  /* The numbers occupy far less width than the margin does -- roughly 2% to 6%
     in from each edge. The first attempt used a band out to 13.4%, which on
     this plate reaches the biker: he stands at about 10%, so he was inside the
     patch and bled into it. */
  leftBand:  { x0: 0,      x1: 0.0820 },
  rightBand: { x0: 0.9180, x1: 1 },
  fontPx: 46,
  color: '#141414'
};

function repaintLineupLabels(ctx, W, H, cfg){
  const k = cfg || LINEUP_CHART;
  const sy = H / 1155;

  const top = Math.max(0, Math.floor(k.ruleY[0] * sy - 60 * sy));
  const bot = Math.min(H, Math.ceil(k.ruleY[k.ruleY.length - 1] * sy + 60 * sy));

  /* MASK BY PER-ROW MEDIAN, NOT BY A PROBE COLUMN (fixed on the bench).
     The first version sampled one column just inboard of each band and painted
     each row that colour. That column runs straight through the biker, so from
     his shoulders down it was sampling skin, tattoo and black vest and laying
     them across the margin in stripes.

     The median of the row WITHIN the band needs no clean column and no guess:
     - a plain wall row is mostly wall, so the median is the wall, gradient and
       lamp falloff included, sampled at the exact height it is needed;
     - a rule row is rule-coloured right across the band (the rules do run under
       the labels here), so the median is the rule and the rule survives;
     - a row carrying a number is wall for most of its width and text for the
       rest, so the median is the wall and only the text goes.
     One rule covers all three cases, which is why it is the one to use. */
  /* INPAINT THE GLYPHS, DO NOT FILL THE BAND (fourth attempt, and the reason
     the first three failed the same way).

     Every earlier version painted whole rows a single colour -- by probe
     column, then by row median, then by row median inside a smaller box. All
     three removed the numbers and all three were obvious, because the wall in
     that margin is not one colour: it carries a horizontal vignette, a pool of
     lamplight at the top, and a warm bounce off the biker. Flatten a row and
     you erase all of that, leaving a visible slab with a seam down its inside
     edge -- and the rules with it.

     Inpainting touches only the pixels the lettering actually occupies. Each
     run of glyph pixels is replaced by a straight interpolation between the
     untouched pixels either side of it, so the gradient continues through the
     patch and a rule crossing the band is redrawn as itself. The mask is
     symmetric, because these numbers carry a pale bevel as well as dark
     strokes, and dilated a little so the anti-aliased rim goes with them.  */
  const boxH = Math.round(34 * sy);
  const DILATE = 3, THRESH = 10;
  [k.leftBand, k.rightBand].forEach(band => {
    const x0 = Math.floor(band.x0 * W), x1 = Math.ceil(band.x1 * W);
    const bw = x1 - x0;
    if (bw <= 0) return;
    k.ruleY.forEach(ry => {
      const y0 = Math.max(0, Math.round(ry * sy - boxH));
      const y1 = Math.min(H, Math.round(ry * sy + boxH));
      if (y1 - y0 <= 0) return;
      const img = ctx.getImageData(x0, y0, bw, y1 - y0);
      const d = img.data;
      const lum = new Array(bw), hit = new Array(bw), grow = new Array(bw);
      for (let r = 0; r < y1 - y0; r++){
        for (let i = 0; i < bw; i++){
          const o = (r * bw + i) * 4;
          lum[i] = (d[o] + d[o+1] + d[o+2]) / 3;
        }
        const mid = median(lum);
        for (let i = 0; i < bw; i++) hit[i] = Math.abs(lum[i] - mid) > THRESH;
        for (let i = 0; i < bw; i++){
          grow[i] = false;
          for (let j = Math.max(0, i - DILATE); j <= Math.min(bw - 1, i + DILATE); j++)
            if (hit[j]) { grow[i] = true; break; }
        }
        let i = 0;
        while (i < bw){
          if (!grow[i]) { i++; continue; }
          let a = i; while (i < bw && grow[i]) i++;
          const bEnd = i - 1;
          const L = a - 1, R = bEnd + 1;
          const okL = L >= 0, okR = R < bw;
          if (!okL && !okR) continue;      // whole row is lettering: leave it
          for (let t = a; t <= bEnd; t++){
            const oT = (r * bw + t) * 4;
            for (let ch = 0; ch < 3; ch++){
              const vL = okL ? d[(r * bw + L) * 4 + ch] : d[(r * bw + R) * 4 + ch];
              const vR = okR ? d[(r * bw + R) * 4 + ch] : vL;
              const f = (bEnd === a) ? 0.5 : (t - a) / (bEnd - a);
              d[oT + ch] = Math.round(vL + (vR - vL) * f);
            }
            d[oT + 3] = 255;
          }
        }
      }
      ctx.putImageData(img, x0, y0);
    });
  });

  ctx.save();
  ctx.font = 'bold ' + Math.round(k.fontPx * sy) + 'px "Arial Narrow","Helvetica Neue",Arial,sans-serif';
  ctx.fillStyle = k.color;
  ctx.textBaseline = 'middle';
  const padL = Math.round(W * 0.022), padR = Math.round(W * 0.019);
  k.ruleY.forEach((ry, i) => {
    const label = G.formatHeight(k.inches[i]);
    const y = ry * sy;
    ctx.textAlign = 'left';  ctx.fillText(label, padL, y);
    ctx.textAlign = 'right'; ctx.fillText(label, W - padR, y);
  });
  ctx.restore();
}

function median(arr){
  const a = arr.slice().sort((x, y) => x - y);
  return a[a.length >> 1];
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
    const sw = subjectImg.naturalWidth || subjectImg.width;
    const sh = subjectImg.naturalHeight || subjectImg.height;
    const headIn = (cal.chart === 'pet') ? 20 : 68;
    for (let i = 0; i < 3; i++){
      /* cut one view out of the three-up sheet, then measure THAT view */
      const slice = document.createElement('canvas');
      slice.width = Math.floor(sw / 3); slice.height = sh;
      slice.getContext('2d').drawImage(subjectImg, -Math.floor(sw / 3) * i, 0);
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
    /* OFF BY DEFAULT, and see the note on repaintLineupLabels for why. The
       function works -- it produces a chart whose numbers are correct and which
       can never disagree with the placement maths. It does not produce a chart
       that looks untouched, and on a plate this photographic that is the bar. */
    if (o.repaintLabels === true) repaintLineupLabels(ctx, W, H, o.chartCfg);
  }

  const scale = G.buildChartScale(
    G.CHARTS[plate.chart || 'human'],
    H * plate.chartTopPct, H * plate.chartBottomPct,
    plate.floorPct ? H * plate.floorPct : null
  );

  if (subjectImg && o.heightInches){
    /* Centre of the strip, not the end of the lineup. On a wraparound the two
       outer edges meet at the handle, so a figure placed where the reference
       art had its empty slot gets sawn in half by it -- with the rest of the
       lineup across the front of the mug and the customer nowhere. */
    C.placeFigure(ctx, subjectImg, scale, o.heightInches, W * (o.centerPct == null ? 0.5 : o.centerPct));
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

global.FaceItBuild = { buildMugshotStrip, buildLineupStrip, sliceIntoPanels, surfaceOf,
                       repaintLineupLabels, LINEUP_CHART };

})(window);
