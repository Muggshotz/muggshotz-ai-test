// Wraparound, unshelved (Aug 2026, Alyx). Wraparound was pulled from
// customer view in full because neither engine behind it was sellable: the
// per-panel method drifted at the seams, and the Gemini one-shot panorama
// that fixes that by construction could not run at all on a free-tier key.
// The key is funded, so the option is back for coffee mugs and travel cups.
//
// What this suite pins, and why each line is here rather than assumed:
//   * the Print Style card actually REAPPEARS on both rails. The shelving
//     was three separate edits in three separate functions; restoring two of
//     them and forgetting the third leaves a card that never shows and a
//     flow that silently still can't reach it.
//   * Wraparound routes through the PANORAMA action, not the per-panel one.
//     Both paths end on the same screen with three filled panels, so "it
//     finished" proves nothing about which engine ran -- the API call does.
//   * a panorama OUTAGE falls back to per-panel instead of throwing. This
//     used to throw, which was right while it was an opt-in experiment the
//     customer could untick. It is the product now; a Gemini outage must not
//     strand someone who picked a valid option.
//   * a 403 (out of credits) does NOT fall back. That is the one failure
//     that must never quietly run a second, chargeable generation.
//   * travel cups take the UNCUT panorama, mugs take the three thirds. Same
//     call, two shapes; a cup that got handed slices would print a third of
//     the scene stretched across the whole wrap.
//   * the 40oz still never sees the option. It is excluded for a reason that
//     has nothing to do with the generator -- its handle breaks the front
//     face, so there is no continuous surface to wrap -- and funding Gemini
//     does not change the shape of a cup.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const T = (page, ms) => page.waitForTimeout(ms);

async function pickProduct(page, val) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await T(page, 700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await T(page, 1000);
}

const cardVisible = (page, id) => page.evaluate((i) => {
  const c = document.getElementById(i);
  if (!c) return { exists: false };
  const r = c.getBoundingClientRect();
  return { exists: true, display: getComputedStyle(c).display, height: Math.round(r.height) };
}, id);

// Mug rail up to (and stopping at) the Print Style card: size -> style ->
// colour -> Satisfied. Driven through the real functions rather than raw
// clicks so a scroll race can't be mistaken for a flow failure.
async function mugToPrintStyle(page) {
  await pickProduct(page, 'mug');
  await page.evaluate(() => pickPreGenMugSize('11oz'));
  await T(page, 500);
  await page.evaluate(() => pickPreGenMugStyle(Object.keys(GEN_MUG_STYLES)[0]));
  await T(page, 500);
  await page.evaluate(() => {
    const btn = document.querySelector('#preGenMugColorGrid .color-btn');
    if (btn) btn.click();
  });
  await T(page, 500);
  await page.evaluate(() => finishPreGenMugColorPick());
  await T(page, 900);
  await dismissAlerts(page);
}

// Only the mug rail routes through the idea box; travel cups go straight
// from Print Style to Style/Generate. Fill it when it is genuinely there --
// and never force it, because "the box the notice points at is reachable"
// is one of the things under test, not a precondition to paper over.
async function ideaBoxUsable(page) {
  return page.evaluate(() => {
    const t = document.getElementById('ideaDesc');
    if (!t) return false;
    const r = t.getBoundingClientRect();
    return r.height > 0 && r.width > 0 && getComputedStyle(t).display !== 'none';
  });
}

async function describeAndGenerate(page, text) {
  // Exact-transfer era (2026-08-28): an empty idea box no longer silently
  // generates. On the travel rail the box starts collapsed, so the FIRST
  // Generate press now fires the guard -- wraparound: a refusal that lands
  // on the box; classic: the photo-as-is confirm (declined here) that does
  // the same -- and THEN the customer types. This walks that exact
  // journey rather than papering over it.
  if (!(await ideaBoxUsable(page))) {
    await page.evaluate(() => { window.confirm = () => false; });
    await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
    await page.click('#generateBtn');
    await T(page, 1400);
    await dismissAlerts(page);
    if (!(await ideaBoxUsable(page)))
      throw new Error('the empty-box guard did not land on a usable idea box');
  }
  await page.fill('#ideaDesc', text);
  await dismissAlerts(page);
  await T(page, 400);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
}

const waitSeamFix = (page, t = 120000) =>
  page.waitForFunction(() => {
    const o = document.getElementById('seamFixOverlay');
    return o && getComputedStyle(o).display !== 'none';
  }, null, { timeout: t });

// The panorama path no longer stops at Fix the Seams (there is nothing to
// fix on an exact cut), so a test that waits for that overlay would hang on
// the very path it is meant to check. This waits for the wraparound to LAND,
// on whichever screen it lands on.
const waitWrapDone = (page, t = 120000) =>
  page.waitForFunction(() => {
    const shown = (id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    };
    return shown('seamFixOverlay') || shown('accessorizeCard') ||
           shown('frameFadeOverlay') || shown('approveRow');
  }, null, { timeout: t });

const waitApprove = (page, t = 120000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

const panoramaCalls = (log) => log.apiCalls.filter(c => c.action === 'wraparoundPanorama').length;
const plainGenCalls = (log) => log.apiCalls.filter(c => c.path === '/api/generate' && !c.action).length;

const scenarios = {};

// ---- 1. The card comes back on the mug rail, lit. ----
scenarios.mugPrintStyleCardReturns = async (page) => {
  await mugToPrintStyle(page);
  const st = await cardVisible(page, 'mugPrintModeCard');
  if (!st.exists) return 'FAIL: mugPrintModeCard is gone from the DOM entirely';
  if (st.display === 'none' || st.height === 0)
    return `FAIL: Print Style card still hidden after Size/Style/Colour (display=${st.display}, h=${st.height}) — refreshMugPrintModeVisibility never unshelved`;
  const lit = await page.evaluate(() => document.body.classList.contains('print-mode-focus'));
  if (!lit) return 'FAIL: card is visible but nothing spotlights it — every other rail step lights its own card';
  const wrapBtn = await page.evaluate(() => {
    const b = document.getElementById('printModeWrapBtn');
    const r = b ? b.getBoundingClientRect() : null;
    return r ? { h: Math.round(r.height) } : null;
  });
  if (!wrapBtn || wrapBtn.h === 0) return 'FAIL: Wraparound button not rendered';
  return 'PASS: Print Style card returns after Size/Style/Colour, spotlit, Wraparound offered';
};

// ---- 2. Wraparound hides the props and asks for a description instead. ----
scenarios.mugWraparoundHidesProps = async (page) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  const s = await page.evaluate(() => ({
    mode: mugPrintMode,
    tiles: document.getElementById('designMethodTiles')?.style.display,
    notice: document.getElementById('designMethodWraparoundNotice')?.style.display,
    intro: document.getElementById('designMethodPropsIntro')?.style.display,
  }));
  if (s.mode !== 'wraparound') return `FAIL: mugPrintMode=${s.mode} after picking Wraparound`;
  if (s.tiles !== 'none') return `FAIL: prop tiles still showing (display=${s.tiles}) — a prop is a fixed picture and cannot wrap`;
  if (s.notice !== 'block') return `FAIL: wraparound description notice not shown (display=${s.notice})`;
  if (s.intro !== 'none') return `FAIL: "try our fun props" intro still showing alongside a wraparound`;
  // The notice says "describe your idea for us in the box above." It was
  // pointing at a collapsed, zero-height textarea sitting off-screen above
  // the scroll position -- an instruction naming something the customer
  // could not see, let alone type into.
  if (!(await ideaBoxUsable(page)))
    return 'FAIL: the notice says "the box above" but #ideaDesc is collapsed/hidden — nothing to describe into';
  const box = await page.evaluate(() => {
    const r = document.getElementById('ideaDesc').getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  if (box.bottom <= 0 || box.top >= box.vh)
    return `FAIL: idea box is off-screen (top=${box.top}, vh=${box.vh}) — the customer is looking at a notice about a box they cannot see`;
  if (await page.evaluate(() => document.body.classList.contains('design-method-focus')))
    return 'FAIL: design-method-focus is dimming the page including the idea box the notice points at';
  return 'PASS: Wraparound hides the props, explains why, and lands on a live idea box';
};

// ---- 3. Wraparound on a mug runs the PANORAMA call, not three per-panel ones. ----
scenarios.mugWraparoundUsesPanorama = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitWrapDone(page);
  await T(page, 1200);
  const pano = panoramaCalls(log);
  const plain = plainGenCalls(log);
  if (pano !== 1) return `FAIL: expected exactly 1 wraparoundPanorama call, saw ${pano}`;
  if (plain !== 0) return `FAIL: ${plain} per-panel generate call(s) fired alongside the panorama — both engines ran`;
  const s = await page.evaluate(() => ({
    method: lastWraparoundMethod,
    left: !!placements.left, front: !!placements.front, right: !!placements.right,
    seamShown: getComputedStyle(document.getElementById('seamFixOverlay')).display !== 'none',
    seams: [seamLeftOverlapPx, seamRightOverlapPx, seamLeftVertPx,
            seamRightVertPx, seamLeftCoveragePct, seamRightCoveragePct],
  }));
  if (s.method !== 'panorama') return `FAIL: lastWraparoundMethod=${s.method}`;
  if (!s.left || !s.front || !s.right) return `FAIL: panels missing (l=${s.left} c=${s.front} r=${s.right})`;
  // Alyx: "Why have we still got the Fix the Seams tool in mugs for wrap
  // around? I thought they were supposed to be doing it as one just big
  // panel now?" The cut is exact, so there is no seam and no screen.
  if (s.seamShown)
    return 'FAIL: Fix the Seams still opens on the panorama path — the cut is exact, so its sliders can only introduce a mismatch, not repair one';
  if (s.seams.some(v => v !== 0))
    return `FAIL: seam offsets carried into a panorama render: ${JSON.stringify(s.seams)} — these feed the final print files`;
  // THE PROMPT IS THE IDEA, NOTHING ELSE. The shared client template used to
  // ride in this field and land inside the server's own "CUSTOMER REQUEST"
  // slot, carrying per-panel seam language into a prompt whose whole job is
  // to convince the model there are no panels. It was fixed once and has to
  // stay fixed, so it is asserted rather than trusted.
  const sent = log.apiCalls.filter((c) => c.action === 'wraparoundPanorama').pop();
  if (!sent || sent.prompt == null) return 'FAIL: no panorama request body captured';
  if (sent.prompt !== 'a wide desert canyon at sunrise')
    return `FAIL: the panorama call sent more than the customer's idea (${sent.prompt.length} chars): ${JSON.stringify(sent.prompt.slice(0, 160))}`;
  const banner = await page.evaluate(() => { const b = document.getElementById('wrapMethodBanner'); return { shown: getComputedStyle(b).display !== 'none', text: document.getElementById('wrapMethodBannerText').textContent }; });
  if (!banner.shown) return 'FAIL: no engine banner after a panorama run';
  if (!/panorama/i.test(banner.text)) return 'FAIL: banner does not name the panorama engine: ' + banner.text;
  return 'PASS: mug Wraparound = 1 panorama call carrying the idea alone, 3 aligned panels, no Fix the Seams, and the banner says panorama';
};

// ---- 4. Panorama outage falls back to per-panel rather than dead-ending. ----
scenarios.mugWraparoundFallsBackOnOutage = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitSeamFix(page);
  const pano = panoramaCalls(log);
  const plain = plainGenCalls(log);
  // A 502 is transient, so it is RETRIED before the fallback runs. Three of
  // four probe calls came back 503 in real testing; falling back on the first
  // one would hand most customers the drifting-seam path on a merely busy day.
  if (pano !== 3) return `FAIL: a transient 502 should be retried to 3 attempts, saw ${pano}`;
  if (plain < 3) return `FAIL: panorama failed but only ${plain} per-panel call(s) followed — the fallback did not run`;
  const s = await page.evaluate(() => ({
    method: lastWraparoundMethod,
    left: !!placements.left, front: !!placements.front, right: !!placements.right,
  }));
  if (s.method !== 'classic') return `FAIL: lastWraparoundMethod=${s.method} after a panorama outage`;
  if (!s.left || !s.front || !s.right) return `FAIL: fallback left panels missing (l=${s.left} c=${s.front} r=${s.right})`;
  const fb = await page.evaluate(() => { const b = document.getElementById('wrapMethodBanner'); return { shown: getComputedStyle(b).display !== 'none', text: document.getElementById('wrapMethodBannerText').textContent }; });
  if (!fb.shown) return 'FAIL: a silent fallback stayed silent — no banner';
  if (!/FALLBACK/.test(fb.text)) return 'FAIL: banner does not announce the fallback: ' + fb.text;
  return 'PASS: panorama outage falls back, still finishes, and says so on screen instead of silently';
};

// ---- 5. Out of credits does NOT fall back to a second chargeable path. ----
scenarios.mugWraparoundOutOfCreditsDoesNotRetry = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await page.waitForFunction(() => {
    const p = document.getElementById('creditsModalOverlay');
    return !!(p && getComputedStyle(p).display !== 'none');
  }, null, { timeout: 60000 }).catch(() => {});
  await T(page, 2500);
  const plain = plainGenCalls(log);
  if (plain > 0) return `FAIL: a 403 (out of credits) fell through to ${plain} per-panel generate call(s) — that path charges again`;
  // A 403 is an ANSWER, not a busy signal. Retrying it would hammer the
  // endpoint on behalf of someone who simply has no credits left.
  const panoTries = panoramaCalls(log);
  if (panoTries !== 1) return `FAIL: out of credits was retried ${panoTries} times — 403 is not transient`;
  const standby = await page.evaluate(() => document.getElementById('wraparoundStandbyPrompt')?.style.display);
  if (standby === 'block') return 'FAIL: left spinning on "Please Stand By" after being told they are out of credits';
  return 'PASS: out of credits stops cleanly — not retried, no second generation attempted';
};

// ---- 6. Three Panels is untouched: no panorama call, props still offered. ----
scenarios.mugThreePanelUnaffected = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('three-panel'));
  await T(page, 1200);
  await dismissAlerts(page);
  const s = await page.evaluate(() => ({
    mode: mugPrintMode,
    tiles: document.getElementById('designMethodTiles')?.style.display,
    notice: document.getElementById('designMethodWraparoundNotice')?.style.display,
  }));
  if (s.mode !== 'three-panel') return `FAIL: mugPrintMode=${s.mode}`;
  if (s.tiles === 'none') return 'FAIL: Three Panels lost the prop tiles — the whole reason track one exists';
  if (s.notice !== 'none') return 'FAIL: wraparound notice showing on the Three Panels path';
  if (panoramaCalls(log) !== 0) return 'FAIL: Three Panels fired a panorama call';
  return 'PASS: Three Panels still lands on the props, no panorama call';
};

// ---- 7. Travel cups: card returns, and Wraparound takes the UNCUT panorama. ----
// Driven on the 14oz (2.15:1), a genuinely panoramic wrap. See scenario 9
// for why the 20oz deliberately does NOT come down this path.
scenarios.travelWraparoundUsesUncutPanorama = async (page, log, mockupBodies) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-14oz-handle'));
  await T(page, 1000);
  await dismissAlerts(page);
  const st = await cardVisible(page, 'mugPrintModeCard');
  if (st.display === 'none' || st.height === 0)
    return `FAIL: Print Style card still hidden for the 14oz (display=${st.display}) — travel cups never got unshelved`;

  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1000);
  await dismissAlerts(page);
  const slot = await page.evaluate(() => getSlotMode());
  if (slot !== 'one') return `FAIL: travel-cup Wraparound slot mode is "${slot}" — a continuous wrap is one surface, not ${slot}`;

  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitApprove(page);
  const pano = panoramaCalls(log);
  if (pano !== 1) return `FAIL: expected 1 wraparoundPanorama call, saw ${pano}`;
  if (plainGenCalls(log) !== 0) return 'FAIL: a per-panel generate call fired for a travel cup wraparound';
  const standby = await page.evaluate(() => document.getElementById('wraparoundStandbyPrompt')?.style.display);
  if (standby === 'block') return 'FAIL: "Please Stand By" never cleared on the travel-cup path';

  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await T(page, 1500);
  await page.locator('button:has-text("Continue to Order")').first().click({ timeout: 10000 });
  await T(page, 7000);
  const start = mockupBodies.find(b => b && b.action === 'start');
  if (!start) return 'FAIL: no start-mockup fired after a travel-cup wraparound';
  if (start.productKey !== 'travel-mug-14oz-handle') return `FAIL: productKey=${start.productKey}`;
  if (!start.image) return 'FAIL: single-image body carries no image — the uncut panorama never reached the order';
  if (start.frontImage || start.backImage)
    return 'FAIL: travel cup sent a front/back split — that is the 40oz shape, not a continuous wrap';
  return 'PASS: travel-cup Wraparound = 1 panorama call, one uncut image, single-image order body';
};

// ---- 9. Narrow wraps do NOT get the panorama, and that is the point. ----
// The panorama prompt puts the subject in the CENTER THIRD. At ratio R
// that third is R/3 : 1 -- fine at 2.15 (0.72:1), a useless sliver at 1.33
// (0.44:1). A 21:9 image letterboxed into a 4:3 wrap would also leave the
// art on barely half the cup's height. These cups keep the single-image
// path they already had, which asks for 1.5:1 -- closer to 1.33 and 1.75
// than 2.33 ever gets. Wraparound is still OFFERED on them; only the
// engine behind it differs, which is not something a customer can see.
const NARROW = { 'travel-mug-20oz': '1.33:1', 'travel-mug-32oz-gator': '1.75:1' };
for (const [key, ratio] of Object.entries(NARROW)) {
  scenarios['narrowWrapSkipsPanorama_' + key.replace(/-/g, '_')] = async (page, log) => {
    await pickProduct(page, 'water bottle');
    await page.evaluate((k) => pickPreGenTravelVariant(k), key);
    await T(page, 1000);
    await dismissAlerts(page);
    const st = await cardVisible(page, 'mugPrintModeCard');
    if (st.display === 'none' || st.height === 0)
      return `FAIL: ${key} lost the Wraparound option entirely — it has a full wrap, just a narrow one`;
    await page.evaluate(() => pickMugPrintMode('wraparound'));
    await T(page, 1000);
    await dismissAlerts(page);
    if (await page.evaluate(() => wrapIsPanoramic()))
      return `FAIL: ${key} (${ratio}) is classed as panoramic — its centre third would be a sliver`;
    await describeAndGenerate(page, 'a wide desert canyon at sunrise');
    await waitApprove(page);
    if (panoramaCalls(log) !== 0)
      return `FAIL: ${key} (${ratio}) fired a 21:9 panorama call anyway`;
    if (plainGenCalls(log) !== 1)
      return `FAIL: ${key} expected exactly 1 single-image generate call, saw ${plainGenCalls(log)}`;
    return `PASS: ${key} (${ratio}) keeps the single-image path — no 21:9 letterbox`;
  };
}

// The ratio table is measured from Printify, not guessed. If someone edits
// it by eye, this catches it before a customer gets a letterboxed cup.
scenarios.wrapRatiosMatchPrintify = async (page) => {
  const MEASURED = {
    'travel-mug-20oz': 1.33,
    'travel-mug-32oz-gator': 1.75,
    'travel-mug-14oz-handle': 2.15,
    'travel-mug-30oz-tundra': 3.50,
  };
  const table = await page.evaluate(() => TRAVEL_WRAP_RATIO);
  for (const [k, v] of Object.entries(MEASURED)) {
    if (Math.abs((table[k] ?? -1) - v) > 0.01)
      return `FAIL: ${k} ratio is ${table[k]}, Printify's placeholders say ${v}`;
  }
  const min = await page.evaluate(() => PANORAMA_MIN_WRAP_RATIO);
  if (min !== 2.0) return `FAIL: panorama threshold moved to ${min} — recheck the centre-third maths before changing it`;
  return 'PASS: wrap ratios match Printify\'s measured placeholders, threshold intact';
};

// ---- 8. The 40oz is still excluded, and for its own reason. ----
scenarios.fortyOzNeverOffersWraparound = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-40oz-insulated'));
  await T(page, 1000);
  await dismissAlerts(page);
  const st = await cardVisible(page, 'mugPrintModeCard');
  if (st.display !== 'none' && st.height > 0)
    return `FAIL: 40oz was offered a Print Style choice (display=${st.display}) — its handle breaks the front face`;
  const s = await page.evaluate(() => ({
    mode: mugPrintMode,
    threeSelected: document.getElementById('printModeThreeBtn')?.classList.contains('selected'),
    wrapSelected: document.getElementById('printModeWrapBtn')?.classList.contains('selected'),
    focus: document.body.classList.contains('print-mode-focus'),
  }));
  if (s.mode !== 'three-panel') return `FAIL: 40oz mugPrintMode=${s.mode}, should be silently locked to three-panel`;
  if (!s.threeSelected || s.wrapSelected) return 'FAIL: 40oz button state does not reflect the silent three-panel lock';
  if (s.focus) return 'FAIL: print-mode-focus left on the body for a card the 40oz never sees — dims the rail with nothing lit';
  return 'PASS: 40oz silently locked to Three Panels, no card, no stray spotlight';
};

// Per-scenario launch options: which stub behaviour that scenario needs.
const OPTS = {
  mugWraparoundFallsBackOnOutage: { panoramaFails: true },
  mugWraparoundOutOfCreditsDoesNotRetry: { panoramaOutOfCredits: true },
  classicFallbackHasNoPanorama: { panoramaFails: true },
};

// ---- 12. The mug prints from ONE strip, not three glued back together. ----
// Alyx: "Why you keep talking about cutting and the cutting tool and piecing
// it together it's supposed to be one long panel."
//
// Checked against Printify's own catalogue: every mug blueprint we sell has
// exactly ONE print area -- bp 478 front 2475x1155, bp 1151 front 2538x1211,
// bp 2692 and 2693 front 2538x1088, and the 15oz of each at 2475x1275. There
// is no left/centre/right slot anywhere in it. So the round trip was real:
// cut one wide image into thirds, ship all three, and have the server glue
// them back edge-to-edge to fill the single slot.
//
// This asserts the uncut panorama actually reaches the wire, because that is
// the only part a customer's printed mug depends on. The thirds still travel
// alongside it -- they are what the order page renders, and what the server
// falls back to when there is no panorama.
scenarios.mugWraparoundPrintsFromOneStrip = async (page, log, mockupBodies) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitWrapDone(page);
  await T(page, 1500);

  const held = await page.evaluate(() => ({
    method: lastWraparoundMethod,
    hasPanorama: !!wraparoundPanoramaUrl,
    body: typeof buildMockupRequestBody === 'function' ? buildMockupRequestBody() : null,
  }));
  if (held.method !== 'panorama') return `FAIL: lastWraparoundMethod=${held.method}`;
  if (!held.hasPanorama)
    return 'FAIL: the uncut panorama was discarded — the print file would still be rebuilt from three thirds';
  if (!held.body?.panoramaImage)
    return 'FAIL: panoramaImage missing from the mockup body — the server would fall back to reassembling the thirds';
  if (held.body.printMode !== 'fullBleed')
    return `FAIL: printMode=${held.body.printMode} on a wraparound`;

  // And it must survive the hop to order.html, which is a different document
  // reading a localStorage handoff -- an easy place for a new field to be
  // dropped silently.
  const handed = await page.evaluate(() => {
    goToOrder();
    try { return JSON.parse(localStorage.getItem('muggshotz_pending_order') || 'null'); }
    catch (e) { return null; }
  });
  if (!handed) return 'FAIL: no pending order was written';
  if (!handed.panoramaImage)
    return 'FAIL: panoramaImage dropped in the handoff to order.html — the order would print from the reassembly';
  if (!handed.placements?.front)
    return 'FAIL: the thirds stopped travelling — the order page renders them and the server needs them as fallback';
  return 'PASS: mug wraparound carries the uncut strip to both the mockup and the order, thirds still alongside';
};

// ---- 13. The classic fallback must NOT claim to have a panorama. ----
// Its left and right panels came from two independent "continue this scene"
// calls, so there is no single strip they are thirds of. Handing one over
// would print something that was never generated as a whole. This is the
// failure mode that matters most: it would be silent, and it would reach a
// physical mug.
scenarios.classicFallbackHasNoPanorama = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitSeamFix(page);
  const s = await page.evaluate(() => ({
    method: lastWraparoundMethod,
    hasPanorama: !!wraparoundPanoramaUrl,
    body: buildMockupRequestBody(),
  }));
  if (s.method !== 'classic') return `FAIL: expected the classic fallback, got ${s.method}`;
  if (s.hasPanorama)
    return 'FAIL: the classic fallback is carrying a panorama — its panels are independent generations, not thirds of one image';
  if (s.body?.panoramaImage)
    return 'FAIL: panoramaImage sent on the classic path — the server must reassemble the three real panels instead';
  return 'PASS: classic fallback carries no panorama, so the server reassembles its three real panels';
};


(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch(OPTS[name] || {});
    const mockupBodies = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/start-mockup')) {
        try { mockupBodies.push(r.postDataJSON()); } catch (e) {}
      }
    });
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log, mockupBodies);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-wrap-fail-${name}.png` }).catch(() => {});
    }
    // Scenarios that deliberately provoke an API failure. Their console noise
    // IS the expected outcome, not a defect -- driven off the same OPTS map
    // that stubs the failure, so a new outage scenario cannot be added without
    // its exemption coming along automatically. Keeping this list by hand is
    // what made the newest one look like a regression.
    const ignore = !!(OPTS[name]?.panoramaFails || OPTS[name]?.panoramaOutOfCredits);
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length && !ignore) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails === 0 ? '\nALL WRAPAROUND VERIFICATIONS PASSED' : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
})();
