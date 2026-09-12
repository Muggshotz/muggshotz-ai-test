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
  // v97: a wraparound with an empty box PAINTS now (the refusal popup is
  // gone), so pressing Generate here would spend a generation instead of
  // revealing the box. Open the idea box the way the rail itself does.
  if (!(await ideaBoxUsable(page))) {
    await page.evaluate(() => { window.confirm = () => false; });
    await page.evaluate(() => handOffToIdeaAfterProductChoice());
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
  // RETIRED (Alyx, Sep 2026). This used to require a green banner announcing
  // the panorama engine. It said "cut into three" -- the exact idea this flow
  // spent a night removing -- and it reported which backend ran, which is
  // engineering news, not customer news. When it works there is nothing to
  // say. The fallback banner is still required; see the outage scenario.
  if (banner.shown) return 'FAIL: a working panorama should say nothing: ' + banner.text;
  return 'PASS: mug Wraparound = 1 panorama call carrying the idea alone, 3 aligned panels, no Fix the Seams, and no banner when it works';
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
  // v107: the 14oz has a body now, so Yes goes straight to the cup and
  // there is no Continue to Order to press.
  const cont = page.locator('button:has-text("Continue to Order")').first();
  if (await cont.isVisible().catch(() => false)) await cont.click({ timeout: 10000 });
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



// WHAT YOU SEE IS WHAT WRAPS: the wraparound preview must show the strip
// after the same circumference and shape trim the printed mug gets, not the
// wider raw strip -- a customer judging the far edges of a picture that
// never prints is exactly how a good wrap gets rejected.
scenarios.wrapPreviewMatchesThePrint = async (page) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a long wooden fence with a mountain range behind it');
  await waitWrapDone(page);
  await T(page, 1000);
  const r = await page.evaluate(async () => {
    const area = getMugPrintArea();
    const raw = revealOriginalArtworkUrls[0];
    const img = await loadImageFromUrl(raw);
    const trimmedUrl = await wrapPreviewUrl(raw);
    const t = await loadImageFromUrl(trimmedUrl);
    return {
      area, mode: mugPrintMode,
      raw: img.naturalWidth + 'x' + img.naturalHeight,
      rawAspect: +(img.naturalWidth / img.naturalHeight).toFixed(3),
      trimmed: t.naturalWidth + 'x' + t.naturalHeight,
      trimmedAspect: +(t.naturalWidth / t.naturalHeight).toFixed(3),
      targetAspect: +(area.w / area.h).toFixed(3),
      changed: trimmedUrl !== raw,
      onScreen: (document.getElementById('revealArtworkImg') || {}).src ? true : false,
    };
  });
  if (!r.changed) return 'FAIL: the preview was not trimmed at all: ' + JSON.stringify(r);
  if (Math.abs(r.trimmedAspect - r.targetAspect) > 0.02) {
    return `FAIL: trimmed preview is ${r.trimmedAspect}, print area is ${r.targetAspect}: ` + JSON.stringify(r);
  }
  if (r.trimmedAspect >= r.rawAspect) return 'FAIL: trimming should narrow the strip: ' + JSON.stringify(r);
  return `PASS: the wraparound preview is trimmed to the print's own shape (${r.rawAspect} raw -> ${r.trimmedAspect}, print area ${r.targetAspect})`;
};

// Three Panels is genuinely three separate pictures and must NOT be trimmed
// as though it wrapped.
scenarios.threePanelPreviewIsNotTrimmed = async (page) => {
  await openStudio(page);
  const same = await page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'three-panel';
    const u = 'about:blank-not-a-wrap';
    return (await wrapPreviewUrl(u)) === u;
  });
  if (!same) return 'FAIL: a three-panel design was trimmed as a wraparound';
  return 'PASS: Three Panels is left alone — only Wraparound is trimmed to the wrap';
};


// ONE SOURCE FOR THE SCREEN AND THE PRINT (Alyx, Sep 2026).
//
// This test used to assert the opposite -- that the screen showed the strip
// while the print path kept baking from a stitch of the three sliced panels --
// and it passed for a day while Alyx was looking at a preview that was not
// what he was buying. The stitch is not the mug: it reassembles thirds that
// have already been sliced, faded and cover-cropped, and it reads the three
// panel records, which is exactly what applying a frame overwrites. That is
// how a declined frame stayed on the finished artwork.
//
// The contract now: one picture, from one place. If a picture goes in one end
// and a different picture comes out the other, something in between switched
// it.
scenarios.oneSourceForScreenAndPrint = async (page, log, mockupBodies) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a long wooden fence with a mountain range behind it');
  await waitWrapDone(page);
  await T(page, 1000);
  const r = await page.evaluate(() => ({
    displayOverride: wrapDisplayOverrideUrl,
    toTheMug: wraparoundPanoramaUrl,
    // What bakeFadeIntoDesigns() bakes into the PRINTED designs.
    bakedFrom: revealOriginalArtworkUrls[0],
    // The unframed original, kept so a frame can be taken back off.
    base: wraparoundPanoramaBaseUrl,
    unframedThirds: unframedWrapDesignUrls,
  }));
  if (!r.toTheMug) return 'FAIL: no panorama was kept for the mug at all';
  if (r.displayOverride !== r.toTheMug) {
    return "FAIL: the screen is not showing the mug's own strip: " + JSON.stringify(r);
  }
  if (r.bakedFrom !== r.toTheMug) {
    return 'FAIL: the print path is baking from something other than the mug\'s own strip: ' + JSON.stringify(r);
  }
  if (r.base !== r.toTheMug) {
    return 'FAIL: the unframed original was not captured: ' + JSON.stringify(r);
  }
  if (!r.unframedThirds || !r.unframedThirds.left || !r.unframedThirds.center || !r.unframedThirds.right) {
    return 'FAIL: the unframed panel records were not captured: ' + JSON.stringify(r);
  }

  // A FRAME MUST COME BACK OFF (Alyx: "it doesn't remove the frame").
  // Applying one overwrites the strip and all three panel records; No Thank
  // You and Cancel both call restoreUnframedDesigns(), which has to undo it.
  const undo = await page.evaluate(() => {
    const framed = 'http://127.0.0.1:8788/__fake/framed-strip.jpg';
    wraparoundPanoramaUrl = framed;
    ['left', 'front', 'right'].forEach((pos) => {
      const d = placements[pos] ? findDesignById(placements[pos]) : null;
      if (d) d.url = framed;
    });
    restoreUnframedDesigns();
    return {
      strip: wraparoundPanoramaUrl,
      left: (findDesignById(placements.left) || {}).url,
      center: (findDesignById(placements.front) || {}).url,
      right: (findDesignById(placements.right) || {}).url,
    };
  });
  if (undo.strip !== r.base) {
    return 'FAIL: the frame did not come off the mug\'s strip: ' + JSON.stringify(undo);
  }
  if (undo.left !== r.unframedThirds.left || undo.center !== r.unframedThirds.center || undo.right !== r.unframedThirds.right) {
    return 'FAIL: the frame did not come off the panel records: ' + JSON.stringify(undo);
  }
  return 'PASS: screen, print and mug all read one strip, and a frame comes back off both it and the panels';
};

// THE FRAME GOES ON THE WHOLE STRIP, NOT ON THREE PANELS (Alyx, Sep 2026).
// compositeFrameAcrossThreePanels cover-crops each third into the centre
// panel's slot and, because seamLeftCoveragePct/seamRightCoveragePct default
// to 0, vertically zooms the OUTER two to 0.8 and stretches them back to full
// height -- 25% taller than the untouched middle one. The horizon stepped at
// both seams and a face crossing a seam came out as two mismatched halves.
// The panorama path frames the uncut strip as one picture instead.
scenarios.frameGoesOnTheWholeStrip = async (page) => {
  await openStudio(page);
  const r = await page.evaluate(async () => {
    if (typeof compositeFrameAcrossPanorama !== 'function') return { missing: true };
    const strip = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    const img = await loadImageFromUrl(strip);
    const out = await compositeFrameAcrossPanorama(strip);
    const back = await loadImageFromUrl(out.combined);
    const l = await loadImageFromUrl(out.left);
    const c = await loadImageFromUrl(out.center);
    return {
      srcW: img.naturalWidth, srcH: img.naturalHeight,
      outW: back.naturalWidth, outH: back.naturalHeight,
      leftW: l.naturalWidth, leftH: l.naturalHeight,
      centerW: c.naturalWidth, centerH: c.naturalHeight,
    };
  });
  if (r.missing) return 'FAIL: compositeFrameAcrossPanorama is not defined';
  if (r.outW !== r.srcW || r.outH !== r.srcH) {
    return 'FAIL: framing changed the strip\'s own dimensions: ' + JSON.stringify(r);
  }
  // Every panel comes off the same canvas at the same height -- no outer-panel
  // zoom, so nothing can step at a seam.
  if (r.leftH !== r.centerH || r.leftH !== r.outH) {
    return 'FAIL: the panels are not all the strip\'s full height: ' + JSON.stringify(r);
  }
  if (r.leftW !== r.centerW) {
    return 'FAIL: the panels are not equal thirds: ' + JSON.stringify(r);
  }
  return `PASS: the frame goes on the whole strip (${r.outW}x${r.outH}), sliced afterwards into equal full-height thirds`;
};


// IDENTITY TRAVELS WITH THE WRAPAROUND (Alyx, Sep 2026). Sequestering the
// prompt fixed the seams and silently dropped the identity protection and the
// Degree of Caricature setting, and the faces stopped being the customer that
// same afternoon. The prompt field must stay the raw idea AND the likeness
// setting must still reach the server.
scenarios.wraparoundCarriesIdentityAndStrength = async (page, log) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => { likeness = '0.15'; });
  await describeAndGenerate(page, 'a long wooden fence with a mountain range behind it');
  await waitWrapDone(page);
  const call = log.apiCalls.find((c) => c.action === 'wraparoundPanorama');
  if (!call) return 'FAIL: no panorama call was made';
  const body = call.body || {};
  if (body.likeness !== '0.15') {
    return 'FAIL: the Degree of Caricature never reached the server: ' + JSON.stringify({ likeness: body.likeness });
  }
  // The seam fix must not be undone in the process: the prompt stays the idea.
  const p = String(body.prompt || '');
  if (/this panel joins|IDENTITY PRESERVATION IS THE TOP PRIORITY|PRIORITY ORDER/i.test(p)) {
    return 'FAIL: the shared template is back in the prompt field: ' + JSON.stringify(p.slice(0, 120));
  }
  if (p.length > 400) return `FAIL: prompt is ${p.length} chars — that is a template, not an idea`;
  // THE SERVER'S OWN IDENTITY GUARD (updated Sep 2026). This used to demand
  // the client's identity block character for character; Alyx restored the
  // server to a build that words its guard differently, so the old check
  // failed every run while the likeness itself was fine. What actually
  // matters is that the panorama prompt the server builds still carries a
  // guard, and that the guard still says the things that keep a face the
  // customer's -- so that is what is checked now.
  const fs = require('fs'), pathmod = require('path');
  const server = fs.readFileSync(pathmod.join(__dirname, '..', 'api', 'generate.js'), 'utf8');
  if (!/const panoramaPrompt = `\$\{identityGuard\}/.test(server)) {
    return 'FAIL: the panorama prompt no longer starts with the identity guard';
  }
  const guard = server.slice(server.indexOf('const identityGuard = `'), server.indexOf('const panoramaPrompt = `'));
  const musts = [
    [/IDENTITY PRESERVATION IS THE TOP PRIORITY/i, 'identity ranked above the scene'],
    [/source of truth[\s\S]*?Do not invent a new person/i, 'the uploaded face is the source of truth'],
    [/Do NOT beautify[\s\S]*?gender-shift/i, 'no beautifying or shifting the face'],
    [/recognise them instantly/i, 'a stranger must recognise them'],
    [/\$\{strengthLine\}/, 'the Degree of Caricature rides along'],
  ];
  for (const [re, what] of musts) {
    if (!re.test(guard)) return `FAIL: the panorama identity guard has lost ${what}`;
  }
  return `PASS: the wraparound sends the idea alone (${p.length} chars), carries the caricature strength, and its prompt still leads with the server's full identity guard`;
};


// The two-column frame studio was gated on the mockup entry point, so the
// Wraparound frame offer -- which arrives through the reveal flow -- kept the
// old stacked layout and pushed the picture off the screen you judge against.
scenarios.wraparoundFrameOfferOpensTheStudio = async (page) => {
  await mugToPrintStyle(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1200);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a long wooden fence with a mountain range behind it');
  await waitWrapDone(page);
  await T(page, 800);
  const opened = await page.evaluate(async () => {
    if (typeof openAccessorizeForRevealFlow === 'function') openAccessorizeForRevealFlow();
    await new Promise(r => setTimeout(r, 900));
    const l = document.querySelector('#frameStudio .fsLeft'), r2 = document.querySelector('#frameStudio .fsRight');
    if (!l || !r2) return { missing: true };
    const lb = l.getBoundingClientRect(), rb = r2.getBoundingClientRect();
    return {
      sideBySide: lb.right <= rb.left + 2,
      sticky: getComputedStyle(l).position,
      previewLeft: !!l.querySelector('#accessorizePreviewStrip'),
      framesRight: !!r2.querySelector('#frameSectionCard'),
    };
  });
  if (opened.missing) return 'FAIL: the frame studio did not mount on the wraparound frame offer';
  if (!opened.sideBySide || opened.sticky !== 'sticky') return 'FAIL: not two columns with a pinned picture: ' + JSON.stringify(opened);
  if (!opened.previewLeft || !opened.framesRight) return 'FAIL: pieces in the wrong columns: ' + JSON.stringify(opened);
  // The layout is the default now, not a per-entry-point special case: the
  // Window Sill catalogue rides in the right column too when it is offered.
  const sill = await page.evaluate(() => {
    const sc = document.getElementById('windowSillSectionCard');
    if (!sc || getComputedStyle(sc).display === 'none') return { notOffered: true };
    return { inRight: !!document.querySelector('#frameStudio .fsRight #windowSillSectionCard') };
  });
  if (!sill.notOffered && !sill.inRight) return 'FAIL: Window Sill is on offer but sits outside the studio columns';
  return 'PASS: the Wraparound frame offer opens the same two-column studio, picture pinned left, catalogues scrolling right';
};

// PICTURES SHOWN ONCE (Alyx's rule), CHECKED BY OPENING THE SCREEN.
//
// This test exists because the fix for the duplicate photograph shipped in a
// build doing nothing. It asked the DOM whether the two-column studio was
// mounted -- nineteen lines BEFORE the line that mounts it -- so on FIRST
// open there was no studio yet, the check said "not mounted", and the second
// copy appeared. Reopening the screen looked fine, which is why it read as
// intermittent.
//
// So this counts visible pictures on the actual screen rather than testing a
// variable, and it opens the screen TWICE, because the broken version was
// only wrong the first time.
scenarios.thePictureIsShownOnce = async (page) => {
  const open = () => page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false; frameOfferFromMockup = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    wraparoundPanoramaUrl = wraparoundPanoramaBaseUrl;
    pendingWraparoundRaw = {
      left: 'http://127.0.0.1:8788/__fake/pano-left.jpg',
      center: 'http://127.0.0.1:8788/__fake/pano-center.jpg',
      right: 'http://127.0.0.1:8788/__fake/pano-right.jpg',
    };
    selectedFrame = 'Mirror Mirror'; windowSillChoice = null; revealFadeSliderTouched = false;
    showAccessorizeStep();
    await updateAccessorizePreview();
    if (accessorizePreviewInFlight) await accessorizePreviewInFlight;
    const visible = (el) => {
      let n = el;
      while (n && n !== document.body) {
        const st = getComputedStyle(n);
        if (st.display === 'none' || st.visibility === 'hidden') return false;
        n = n.parentElement;
      }
      return true;
    };
    const imgs = [...document.querySelectorAll('#accessorizePreviewStrip img, #frameCatalogInlinePreview img')]
      .filter(visible)
      .map((i) => (i.closest('#frameCatalogInlinePreview') ? 'under the catalogue' : 'left column'));
    return { count: imgs.length, where: imgs, studioMounted: !!document.getElementById('frameStudio') };
  });

  const first = await open();
  if (!first.studioMounted) return 'FAIL: the two-column studio did not mount: ' + JSON.stringify(first);
  if (first.count !== 1) {
    return `FAIL: ${first.count} copies of the same photograph on first open (${first.where.join(', ')})`;
  }
  const second = await open();
  if (second.count !== 1) {
    return `FAIL: ${second.count} copies of the same photograph on reopen (${second.where.join(', ')})`;
  }
  return 'PASS: one picture on the screen, pinned in the left column, on first open and on reopen';
};

// THE PICTURE HOLDS STILL WHILE YOU WORK THE SLIDERS (Alyx, Sep 2026).
// "the image keeps shifting it doesn't hold still... you can't see what
// you're doing to the picture."
// Every slider tick used to wipe the strip, drop in a one-line "Updating
// preview..." message, and build a brand new <img>. The box fell from ~187px
// tall to ~22px and back, forty-odd times per drag, so the page jumped under
// the slider being aimed. This simulates a real drag and watches the box's
// height on every frame.
scenarios.thePreviewHoldsStillWhileDragging = async (page) => {
  await page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false; frameOfferFromMockup = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    wraparoundPanoramaUrl = wraparoundPanoramaBaseUrl;
    pendingWraparoundRaw = {
      left: 'http://127.0.0.1:8788/__fake/pano-left.jpg',
      center: 'http://127.0.0.1:8788/__fake/pano-center.jpg',
      right: 'http://127.0.0.1:8788/__fake/pano-right.jpg',
    };
    selectedFrame = 'Mirror Mirror'; windowSillChoice = null; frameStudioFadePct = null;
    showAccessorizeStep();
    await updateAccessorizePreview();
    if (accessorizePreviewInFlight) await accessorizePreviewInFlight;
    await refreshFrameFitSliders();
  });
  const r = await page.evaluate(async () => {
    const strip = document.getElementById('accessorizePreviewStrip');
    const heights = []; let stop = false;
    (function watch() { heights.push(Math.round(strip.getBoundingClientRect().height)); if (!stop) requestAnimationFrame(watch); })();
    const el = document.getElementById('frameFitHeight');
    const startImg = strip.querySelector('img.fsPreviewImg');
    for (let v = 100; v >= 67; v--) { el.value = String(v); handleFrameFitSliderChange(); await new Promise((r2) => setTimeout(r2, 12)); }
    await new Promise((r2) => setTimeout(r2, 600));
    if (accessorizePreviewInFlight) await accessorizePreviewInFlight;
    await new Promise((r2) => setTimeout(r2, 300));
    stop = true;
    const endImg = strip.querySelector('img.fsPreviewImg');
    const sorted = [...new Set(heights)].sort((a, b) => a - b);
    return {
      sameElement: !!startImg && startImg === endImg,
      min: sorted[0], max: sorted[sorted.length - 1],
      settledAt: customFrameCalibration[FRAME_CATALOG['Mirror Mirror'].asset]?.heightPct,
    };
  });
  if (!r.sameElement) return 'FAIL: the picture element was destroyed and rebuilt during the drag: ' + JSON.stringify(r);
  if (r.min < 100) return `FAIL: the preview collapsed to ${r.min}px mid-drag — that is the jump: ` + JSON.stringify(r);
  if (r.max - r.min > 60) return `FAIL: the preview moved ${r.max - r.min}px during the drag: ` + JSON.stringify(r);
  if (r.settledAt !== 67) return `FAIL: the slider did not settle where it was left (${r.settledAt})`;
  return `PASS: one image element throughout, height held between ${r.min} and ${r.max}px across a 34-step drag`;
};

// THE FADE, WHERE THE CUSTOMER CAN SEE IT. A fifth slider under the fit
// sliders, with the picture above it -- so the corners can be watched
// disappearing instead of being decided blind on another screen.
scenarios.theFrameStudioHasAFadeSlider = async (page) => {
  const probe = (frame) => page.evaluate(async (f) => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    pendingWraparoundRaw = { left: 'a', center: 'b', right: 'c' };
    frameStudioFadePct = null; selectedFrame = f; windowSillChoice = null;
    await refreshFrameFitSliders();
    const sl = document.getElementById('frameFitFade');
    const note = document.getElementById('frameFitFadeNote');
    const out = { start: Number(sl.value), min: Number(sl.min), noteShown: note.style.display === 'block' };
    sl.value = '0'; handleFrameFadeSliderChange();
    out.floored = frameStudioFadeAmount();
    sl.value = '60'; handleFrameFadeSliderChange();
    out.raised = frameStudioFadeAmount();
    // v94: the fade is painted on the box inside the composite, so ask the
    // composite whether the raised fade whitened the frame's opening.
    const whiteShare = async (pct) => {
      const framed = await compositeFrameAcrossPanorama(wraparoundPanoramaBaseUrl, pct);
      const im = await loadImageFromUrl(framed.combined);
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
      const frac = await getFrameInsetFraction(FRAME_CATALOG[f].asset);
      const d = ctx.getImageData(Math.floor(frac.x * c.width), Math.floor(frac.y * c.height), Math.floor(frac.w * c.width), Math.floor(frac.h * c.height)).data;
      let w = 0; for (let k = 0; k < d.length; k += 4) if (d[k] > 215 && d[k + 1] > 215 && d[k + 2] > 215) w++;
      return w / (d.length / 4);
    };
    out.sourceFaded = (await whiteShare(frameStudioFadeAmount())) - (await whiteShare(0)) > 0.08;
    return out;
  }, frame);

  const listed = await probe('Mirror Mirror');
  if (listed.start !== 40) return `FAIL: a listed frame should start at 40%, got ${listed.start}`;
  if (listed.min !== 0) return `FAIL: a listed frame's slider is capped at ${listed.min}% — it should reach zero`;
  if (!listed.noteShown) return 'FAIL: nothing explains why a listed frame carries a fade';
  if (listed.floored !== 0) return `FAIL: a listed frame could not be taken back to no fade (${listed.floored})`;
  if (listed.raised !== 60) return `FAIL: the slider did not raise the fade (${listed.raised})`;
  if (!listed.sourceFaded) return 'FAIL: the slider moved but the picture was not faded';

  const plain = await probe('Ornate Gold');
  if (plain.start !== 0) return `FAIL: an unlisted frame should start with no fade, got ${plain.start}`;
  if (plain.min !== 0) return `FAIL: an unlisted frame should reach zero, floor was ${plain.min}`;
  if (plain.noteShown) return 'FAIL: the "comes with a fade" note is showing on a frame that does not';
  if (plain.floored !== 0) return `FAIL: an unlisted frame could not be taken back to no fade (${plain.floored})`;
  if (plain.raised !== 60) return 'FAIL: an unlisted frame could not be given a fade on request';
  return 'PASS: listed frames start at 40%, unlisted at none, and every one runs the full 0-100';
};

// THE HEIGHT SLIDER MAKES THE PICTURE TALLER (Alyx, Sep 2026): "the height
// refuses to expand at all even though it should be at 150%". The hand-set
// box used to be shrink-to-fit, so a 21:9 strip in a near-square opening hit
// the width first and Height above that point did nothing. Now a box the
// customer sets is FILLED. Measured on the real placement function with a
// solid-colour 21:9 strip: the picture's drawn height must grow with the
// slider, must stay inside the box, and must go back to shrink-to-fit on
// Reset. Same function serves the wraparound strip, the three-panel strip
// and a single picture, so this covers all three.
scenarios.theHeightSliderMakesThePictureTaller = async (page) => {
  const r = await page.evaluate(async () => {
    const asset = FRAME_CATALOG['Crystal Champagne'].asset;
    selectedFrame = 'Crystal Champagne'; windowSillChoice = null; product = 'mug';
    // a 21:9 strip of pure blue -- trivially separable from a white base
    const src = document.createElement('canvas'); src.width = 2100; src.height = 900;
    src.getContext('2d').fillStyle = '#0000ff'; src.getContext('2d').fillRect(0, 0, 2100, 900);
    const measure = async () => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
      const ctx = c.getContext('2d');
      await drawPhotoInsetForFrame(ctx, c, src, src.width, src.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const blueAt = (x, y) => { const i = (y * c.width + x) * 4; return d[i] < 80 && d[i + 1] < 80 && d[i + 2] > 150; };
      // bounding box of the blue, so a shift shows up as a moved centre
      let top = -1, bot = -1, left = 1e9, right = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x += 2) if (blueAt(x, y)) {
        if (top < 0) top = y; bot = y; if (x < left) left = x; if (x > right) right = x;
      }
      return { h: bot - top, w: right - left, cx: (left + right) / 2, cy: (top + bot) / 2 };
    };
    const def = await getFrameDefaultCalibrationPct(asset);
    delete customFrameCalibration[asset];
    const untouched = await measure();
    customFrameCalibration[asset] = { ...def };
    const atDefault = await measure();
    // 1. Height
    const tallPct = Math.min(150, def.heightPct * 1.5);
    customFrameCalibration[asset] = { ...def, heightPct: tallPct };
    const taller = await measure();
    const boxH = Math.round(900 * (tallPct / 100));
    // 2. Width
    customFrameCalibration[asset] = { ...def, widthPct: def.widthPct * 0.6 };
    const narrower = await measure();
    // 3. Left/Right
    customFrameCalibration[asset] = { ...def, offsetXPct: 8 };
    const shiftedRight = await measure();
    // 4. Up/Down
    customFrameCalibration[asset] = { ...def, offsetYPct: 8 };
    const shiftedDown = await measure();
    // 5. Edge Fade is measured by theFrameStudioHasAFadeSlider, same suite.
    delete customFrameCalibration[asset];
    const reset = await measure();
    return { def, tallPct, untouched, atDefault, taller, boxH, narrower, shiftedRight, shiftedDown, reset };
  });
  if (!(r.taller.h > r.atDefault.h * 1.2))
    return `FAIL: Height ${r.def.heightPct}% -> ${r.tallPct}% only took the picture from ${r.atDefault.h}px to ${r.taller.h}px tall`;
  if (r.taller.h > r.boxH + 2)
    return `FAIL: the picture (${r.taller.h}px) overflowed the box it was given (${r.boxH}px) — nothing is clipping it`;
  if (!(r.narrower.w < r.atDefault.w * 0.75))
    return `FAIL: Width at 60% of default only took the picture from ${r.atDefault.w}px to ${r.narrower.w}px wide`;
  if (!(r.shiftedRight.cx > r.atDefault.cx + 40))
    return `FAIL: Left/Right +8% moved the picture's centre from x=${r.atDefault.cx} to x=${r.shiftedRight.cx}`;
  if (!(r.shiftedDown.cy > r.atDefault.cy + 30))
    return `FAIL: Up/Down +8% moved the picture's centre from y=${r.atDefault.cy} to y=${r.shiftedDown.cy}`;
  if (r.reset.h !== r.untouched.h)
    return `FAIL: Reset did not return to shrink-to-fit (${r.reset.h}px vs ${r.untouched.h}px untouched)`;
  return `PASS: Height ${Math.round(r.def.heightPct)}%->${Math.round(r.tallPct)}% makes the strip ${r.atDefault.h}->${r.taller.h}px tall inside its ${r.boxH}px box; Width 60% makes it ${r.atDefault.w}->${r.narrower.w}px wide; Left/Right +8% moves it ${Math.round(r.shiftedRight.cx - r.atDefault.cx)}px right; Up/Down +8% moves it ${Math.round(r.shiftedDown.cy - r.atDefault.cy)}px down; Reset returns to shrink-to-fit`;
};

// THE BUTTON UNDER THE PICTURE (Alyx, v94): "the button to go ahead and
// generate is all the way the hell at the bottom, merely vaguely named
// Satisfied?". An Apply Frame -- Continue button now sits in the left
// column right under the picture, and Satisfied? stays at the bottom of the
// catalogue as well ("do that as an and too"). Both go the same way.
scenarios.theApplyFrameButtonSitsUnderThePicture = async (page) => {
  const r = await page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false; frameOfferFromMockup = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    wraparoundPanoramaUrl = wraparoundPanoramaBaseUrl;
    pendingWraparoundRaw = { left: 'a', center: 'b', right: 'c' };
    selectedFrame = 'Mirror Mirror'; windowSillChoice = null; frameStudioFadePct = null;
    showAccessorizeStep();
    await updateAccessorizePreview();
    if (accessorizePreviewInFlight) await accessorizePreviewInFlight;
    const btn = document.getElementById('accessorizeApplyFrameBtn');
    const satisfied = document.getElementById('frameCatalogSatisfiedBtn');
    const strip = document.getElementById('accessorizePreviewStrip');
    const vis = (el) => !!el && el.offsetParent !== null;
    return {
      shown: vis(btn), label: btn ? btn.textContent.trim() : null,
      onclick: btn ? btn.getAttribute('onclick') : null,
      inLeftColumn: !!btn && !!btn.closest('.fsLeft'),
      belowPicture: !!btn && !!strip && btn.getBoundingClientRect().top >= strip.getBoundingClientRect().bottom - 1,
      satisfiedStillThere: vis(satisfied) && satisfied.getAttribute('onclick') === 'applyAccessorizeFrame()',
    };
  });
  if (!r.shown) return 'FAIL: no Apply Frame button is showing in the studio: ' + JSON.stringify(r);
  if (!/Apply Frame/.test(r.label) || !/Continue/.test(r.label)) return `FAIL: the button reads "${r.label}"`;
  if (r.onclick !== 'applyAccessorizeFrame()') return `FAIL: the button is wired to ${r.onclick}`;
  if (!r.inLeftColumn) return 'FAIL: the button is not in the left column with the picture';
  if (!r.belowPicture) return 'FAIL: the button is not under the picture: ' + JSON.stringify(r);
  if (!r.satisfiedStillThere) return 'FAIL: Satisfied? at the bottom of the catalogue was lost: ' + JSON.stringify(r);
  return `PASS: "${r.label}" sits under the picture in the left column, Satisfied? still at the bottom, both wired the same`;
};

// THE FRAMES ARE WARMED WHEN THE STUDIO OPENS (v94, with Alyx's go-ahead).
// Every frame file in the catalogue is fetched and its opening measured in
// the background as soon as the studio mounts, so the first frame tapped
// draws instead of downloading.
scenarios.theFramesAreWarmedWhenTheStudioOpens = async (page) => {
  const r = await page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false; frameOfferFromMockup = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    wraparoundPanoramaUrl = wraparoundPanoramaBaseUrl;
    pendingWraparoundRaw = {
      left: 'http://127.0.0.1:8788/__fake/pano-left.jpg',
      center: 'http://127.0.0.1:8788/__fake/pano-center.jpg',
      right: 'http://127.0.0.1:8788/__fake/pano-right.jpg',
    };
    selectedFrame = null; windowSillChoice = null;
    Object.keys(frameInsetCache).forEach((k) => delete frameInsetCache[k]);
    frameStudioWarmed = false;
    const assets = Object.values(FRAME_CATALOG).filter((d) => d.type === 'image' && d.asset).map((d) => d.asset);
    const before = Object.keys(frameInsetCache).length;
    showAccessorizeStep();
    const t0 = performance.now();
    while (Object.keys(frameInsetCache).length < assets.length && performance.now() - t0 < 20000) {
      await new Promise((r2) => setTimeout(r2, 100));
    }
    const missing = assets.filter((a) => !frameInsetCache[a]);
    return { before, total: assets.length, warmed: assets.length - missing.length, missing, ms: Math.round(performance.now() - t0) };
  });
  if (r.before !== 0) return `FAIL: the cache was not empty at the start (${r.before})`;
  if (r.missing.length) return `FAIL: ${r.warmed}/${r.total} frames warmed after ${r.ms}ms, still cold: ${r.missing.join(', ')}`;
  return `PASS: all ${r.total} frame files loaded and measured in the background within ${r.ms}ms of the studio opening`;
};

// ART STYLE HAS A BACK (Alyx, v94): "There is no back button anywhere on
// this page... My only recourse is to completely exit the entire program."
// Every panel gets a Back. Here Back is back to the photo: the spotlight
// lifts, the step puts itself away, and the upload boards are back in view.
scenarios.artStyleHasABackButton = async (page) => {
  const r = await page.evaluate(async () => {
    const back = document.getElementById('styleBackBtn');
    const vis = (el) => !!el && el.offsetParent !== null;
    const out = { shownAfterUpload: vis(back), label: back ? back.textContent.trim() : null,
      spotlitBefore: document.body.classList.contains('style-focus') };
    if (back) back.click();
    await new Promise((r2) => setTimeout(r2, 900));
    out.spotlitAfter = document.body.classList.contains('style-focus');
    out.continueHidden = !vis(document.getElementById('styleContinueBtn'));
    out.forkHidden = !vis(document.getElementById('postUploadForkRow'));
    const up = document.getElementById('uploadPhotoCard').getBoundingClientRect();
    out.uploadInView = up.bottom > 0 && up.top < window.innerHeight;
    out.boardStillTappable = !!document.getElementById('uploadZone') && !!document.getElementById('aiCollabUploadBtn');
    return out;
  });
  if (!r.shownAfterUpload) return 'FAIL: no Back button under Art Style after the photo lands: ' + JSON.stringify(r);
  if (!/Back/.test(r.label)) return `FAIL: the button reads "${r.label}"`;
  if (!r.spotlitBefore) return 'FAIL: Art Style was not spotlit before Back (test setup)';
  if (r.spotlitAfter) return 'FAIL: Back left the Art Style spotlight on';
  if (!r.continueHidden || !r.forkHidden) return 'FAIL: Back left the step on screen: ' + JSON.stringify(r);
  if (!r.uploadInView) return 'FAIL: Back did not bring the upload boards into view: ' + JSON.stringify(r);
  if (!r.boardStillTappable) return 'FAIL: the upload boards are gone';
  return `PASS: "${r.label}" under Art Style lifts the spotlight, puts the step away and lands on the upload boards`;
};

// THE TUNDRA'S FULL WRAP (Alyx, Sep 2026: "B plus D"). The 30oz band is
// 3.50:1, the picture 2.33:1, so a third of the band was bare. Now the scene
// is mirrored out into the flanks (B) and the outer ends fade to the cup's
// colour (D). Measured on the real function: the result is the band's own
// ratio, the scene sits untouched in the middle, each flank is a mirror of
// the edge beside it, and the outer ends are the cup's white. The 14oz is
// narrower than the picture and must come back exactly as it went in.
scenarios.tundraWrapIsMirroredAndFaded = async (page) => {
  const r = await page.evaluate(async () => {
    const src = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    product = 'water bottle'; selectedTravelColor = null;
    selectedTravelProductKey = 'travel-mug-14oz-handle';
    // v105: a picture wider than a band is cropped to the band rather than
    // handed back for the server to letterbox; the 14oz is 2.15:1.
    const narrowIm = await loadImageFromUrl(await extendWrapToProductRatio(src));
    const narrow = narrowIm.naturalWidth / narrowIm.naturalHeight;
    selectedTravelProductKey = 'travel-mug-30oz-tundra';
    const out = await extendWrapToProductRatio(src);
    const orig = await loadImageFromUrl(src);
    const ext = await loadImageFromUrl(out);
    const px = (im, x, y) => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]];
    };
    const w = orig.naturalWidth, h = orig.naturalHeight, W = ext.naturalWidth;
    const flank = (W - w) / 2, y = h * 0.35;
    return {
      narrowRatio: narrow,
      ratio: W / ext.naturalHeight, flank, w, h,
      centreOrig: px(orig, w / 2, h / 2), centreExt: px(ext, flank + w / 2, h / 2),
      edgeOrig: px(orig, 4, y), mirrorExt: px(ext, flank - 5, y),
      // The back seam: the file's last column must be the neighbour of its
      // first (v102), and neither end is the cup's white any more.
      seamLeft: px(ext, 0, y), seamRight: px(ext, W - 1, y),
      // v108: the top and bottom edges are softened into the cup too.
      topEdge: px(ext, W / 2, 1), bottomEdge: px(ext, W / 2, ext.naturalHeight - 2),
      outerLeft: px(ext, 1, y), outerRight: px(ext, W - 2, y),
      // NO HAIRLINES (v104): no column of the wrap may be white from top to
      // bottom -- that is the cup showing through a gap between flank and
      // picture, and it prints.
      whiteColumns: (() => {
        const c = document.createElement('canvas'); c.width = ext.naturalWidth; c.height = ext.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(ext, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data; const cols = [];
        for (let x = 0; x < c.width; x++) {
          let white = 0;
          for (let yy = 0; yy < c.height; yy += 4) { const i = (yy * c.width + x) * 4; if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++; }
          if (white > (c.height / 4) * 0.6) cols.push(x);
        }
        return cols;
      })(),
      hex: getSelectedProductColorHex(),
    };
  });
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  if (Math.abs(r.narrowRatio - 2.15) > 0.02) return `FAIL: the 14oz wrap came out ${r.narrowRatio.toFixed(3)}:1, not its band's 2.15:1`;
  if (Math.abs(r.ratio - 3.5) > 0.02) return `FAIL: the Tundra wrap came out ${r.ratio.toFixed(3)}:1, not 3.50:1`;
  if (!near(r.centreOrig, r.centreExt, 6)) return `FAIL: the scene moved or changed in the middle: rgb(${r.centreOrig}) vs rgb(${r.centreExt})`;
  if (!near(r.edgeOrig, r.mirrorExt, 14)) return `FAIL: the flank beside the seam is not a mirror of the scene's edge: rgb(${r.edgeOrig}) vs rgb(${r.mirrorExt}) ` + JSON.stringify(r);
  if (!near(r.seamLeft, r.seamRight, 40)) {
    return `FAIL: the two ends do not meet: first column rgb(${r.seamLeft}) vs last column rgb(${r.seamRight}) — the back seam would show`;
  }
  if (near(r.outerLeft, [255, 255, 255], 8) && near(r.outerRight, [255, 255, 255], 8)) {
    return 'FAIL: the ends still fade to white — the old fade-to-cup is back';
  }
  if (!near(r.topEdge, [255, 255, 255], 10) || !near(r.bottomEdge, [255, 255, 255], 10)) return `FAIL: the top and bottom edges are still hard: rgb(${r.topEdge}) / rgb(${r.bottomEdge})`;
  if (r.whiteColumns.length) return `FAIL: white hairline(s) down the wrap at x=${r.whiteColumns.slice(0, 6).join(',')} — a gap between flank and picture`;
  return `PASS: Tundra wrap is ${r.ratio.toFixed(2)}:1, scene untouched in the middle, flanks mirror the edges, and the two ends meet each other at the back; the 14oz is cropped to its own band`;
};

// And through the real flow: a Tundra wraparound order carries the full
// band, not the bare 21:9 picture.
scenarios.tundraOrderCarriesTheFullWrap = async (page, log, mockupBodies) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 1000);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1000);
  await dismissAlerts(page);
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitApprove(page);
  if (panoramaCalls(log) !== 1) return `FAIL: expected 1 wraparoundPanorama call, saw ${panoramaCalls(log)}`;
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await T(page, 1500);
  // v101: Yes opens the cup's mockup directly; Continue to Order is only
  // there for cups the engine cannot draw.
  const cont = page.locator('button:has-text("Continue to Order")').first();
  if (await cont.isVisible().catch(() => false)) await cont.click({ timeout: 10000 });
  await T(page, 7000);
  const start = mockupBodies.find(b => b && b.action === 'start');
  if (!start) return 'FAIL: no start-mockup fired after a Tundra wraparound';
  if (start.productKey !== 'travel-mug-30oz-tundra') return `FAIL: productKey=${start.productKey}`;
  if (!start.image) return 'FAIL: the order body carries no image';
  const ratio = await page.evaluate(async (u) => { const im = await loadImageFromUrl(u); return im.naturalWidth / im.naturalHeight; }, start.image);
  if (Math.abs(ratio - 3.5) > 0.02) return `FAIL: the Tundra order image is ${ratio.toFixed(3)}:1 — the band would print with bare ends`;
  return `PASS: the Tundra order carries a ${ratio.toFixed(2)}:1 wrap, the band's own shape`;
};

// EVERY PANEL HAS A BACK, and the result screen is pinned (Alyx, v100).
// Walks the travel rail and checks each panel's Back is there and wired,
// then generates and checks the result screen cannot be scrolled away from.
scenarios.theTravelRailHasBacksAndThePinnedResult = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 800);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 800);
  await dismissAlerts(page);
  const backs = await page.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const check = (id, fn) => { const b = document.getElementById(id); return { shown: vis(b), wired: !!b && b.getAttribute('onclick') === fn }; };
    return {
      fork: check('trackForkBackBtn', 'trackForkBack()'),
      travel: check('travelVariantBackBtn', 'travelVariantBack()'),
      print: check('printModeBackBtn', 'printModeBack()'),
    };
  });
  for (const [name, r] of Object.entries(backs)) {
    if (!r.shown) return `FAIL: the ${name} panel has no visible Back`;
    if (!r.wired) return `FAIL: the ${name} panel's Back is not wired`;
  }
  await describeAndGenerate(page, 'a wide desert canyon at sunrise');
  await waitApprove(page);
  await T(page, 1500);
  const pin = await page.evaluate(async () => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const back = document.getElementById('approveBackBtn');
    const row = document.getElementById('approveRow');
    const rowBottom = row.getBoundingClientRect().bottom + window.scrollY;
    const picTop = document.getElementById('previewImg').getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
    const atTop = window.scrollY;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
    const atBottom = window.scrollY + window.innerHeight;
    resultScreenBack();
    await new Promise((r) => setTimeout(r, 400));
    const rowHiddenOrPinReleased = true;
    return { backShown: vis(back), backWired: !!back && back.getAttribute('onclick') === 'resultScreenBack()', atTop, picTop, atBottom, rowBottom };
  });
  if (!pin.backShown) return 'FAIL: the result screen has no visible Back';
  if (!pin.backWired) return 'FAIL: the result screen Back is not wired';
  if (pin.atTop < pin.picTop - 60) return `FAIL: the result screen scrolled away to the top of the page (${pin.atTop} vs picture at ${pin.picTop})`;
  if (pin.atBottom > pin.rowBottom + 60) return `FAIL: the result screen scrolled away below its buttons (${pin.atBottom} vs row bottom ${pin.rowBottom})`;
  return 'PASS: fork, travel-mug and print-style panels have Backs; the result screen has a Back and holds between its picture and its buttons';
};

// THE SCREEN YOU ARE ON IS THE ONLY SCREEN (Alyx, v101). A spotlit panel
// pins the page to itself: scrolling to the top of the page or the bottom
// is pulled back to the panel's own edges. Measured on Art Style, which is
// spotlit the moment the photo lands.
scenarios.theSpotlitPanelIsPinned = async (page) => {
  const r = await page.evaluate(async () => {
    const card = document.getElementById('styleSectionCard');
    const top = card.getBoundingClientRect().top + window.scrollY;
    const bottom = card.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo(0, 0);
    await new Promise((r2) => setTimeout(r2, 400));
    const atTop = window.scrollY;
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r2) => setTimeout(r2, 400));
    const atBottom = window.scrollY + window.innerHeight;
    return { focus: Array.from(document.body.classList).find((c) => c.endsWith('-focus')), top, bottom, atTop, atBottom, innerH: window.innerHeight, pageH: document.body.scrollHeight };
  });
  if (r.focus !== 'style-focus') return `FAIL: expected Art Style to be spotlit, body has ${r.focus}`;
  // Wherever the pin parks, the panel has to be wholly on screen: after a
  // scroll to the top its bottom edge is still in view, after a scroll to
  // the bottom its top edge is.
  if (r.atTop + r.innerH < r.bottom - 60) return `FAIL: scrolled away above the spotlit panel (window ${r.atTop}..${r.atTop + r.innerH} vs panel ${r.top}..${r.bottom})`;
  if (r.atBottom - r.innerH > r.top + 60) return `FAIL: scrolled away below the spotlit panel (window ${r.atBottom - r.innerH}..${r.atBottom} vs panel ${r.top}..${r.bottom}, page ${r.pageH})`;
  return `PASS: with Art Style spotlit the page holds between ${Math.round(r.top)} and ${Math.round(r.bottom)}`;
};

// THE IDEA BOX LANDS ON GENERATE (Alyx, v101: "Meanwhile the Generate Image
// button is way here at the bottom"). With the product, cup and print style
// already chosen, "Click here when you are satisfied" goes to Generate, lit,
// with a Back, and the frame catalogue dimmed like everything else.
scenarios.ideaSatisfiedLandsOnGenerate = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 800);
  await dismissAlerts(page);
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 800);
  await dismissAlerts(page);
  await page.evaluate(() => handOffToIdeaAfterProductChoice());
  await T(page, 600);
  await page.fill('#ideaDesc', 'a lighthouse in a storm');
  await page.evaluate(() => confirmIdeaSatisfied());
  await T(page, 1500);
  const r = await page.evaluate(() => {
    const vis = (el) => !!el && el.offsetParent !== null;
    const gen = document.getElementById('generateBtn').getBoundingClientRect();
    const back = document.getElementById('generateBackBtn');
    const frames = document.getElementById('frameSectionCard');
    return {
      focus: Array.from(document.body.classList).find((c) => c.endsWith('-focus')),
      genInView: gen.top >= 0 && gen.bottom <= window.innerHeight,
      backShown: vis(back), backWired: !!back && back.getAttribute('onclick') === 'generateStepBack()',
      framesOpacity: frames ? parseFloat(getComputedStyle(frames).opacity) : null,
      framesShown: vis(frames),
    };
  });
  if (r.focus !== 'generate-focus') return `FAIL: expected the Generate step lit, body has ${r.focus}`;
  if (!r.genInView) return 'FAIL: Generate is not on screen after "satisfied"';
  if (!r.backShown || !r.backWired) return 'FAIL: the Generate step has no wired Back: ' + JSON.stringify(r);
  if (r.framesShown && r.framesOpacity >= 0.99) return `FAIL: the frame catalogue is still lit under the Generate dim (opacity ${r.framesOpacity})`;
  return 'PASS: "satisfied" lands on Generate, lit, with a Back, and the frames dim with the rest';
};

// THE TUNDRA COMES IN THREE (Alyx, v101, from Printify's own variant list:
// Black / White / Steel). The badge is gone, the colour card shows, the
// order body names White until a colour is picked, and a picked colour
// reaches the body and the 3D cup.
scenarios.tundraOffersThreeColours = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 800);
  await dismissAlerts(page);
  const r = await page.evaluate(() => {
    const prod = TRAVEL_MUG_CATALOG['travel-mug-30oz-tundra'];
    const names = (prod.colors || []).map((c) => c.name);
    const badge = !!document.querySelector('#travelMugVariantGrid .stock-badge');
    const colorCard = document.getElementById('travelMugColorCard');
    const swatches = document.querySelectorAll('#travelMugColorGridGen .color-btn').length;
    selectedTravelProductKey = 'travel-mug-30oz-tundra'; selectedTravelColor = null;
    placements.front = null; placements.left = null; placements.right = null;
    const d = addToRecentDesigns('http://127.0.0.1:8788/__fake/panorama.jpg'); placements.front = d;
    const defaultBody = buildMockupRequestBody();
    selectedTravelColor = 'Black'; selectedTravelColor = 'Black';
    const blackBody = buildMockupRequestBody();
    const entry = travelColorEntry();
    return { names, badge, colorCardShown: colorCard && colorCard.style.display !== 'none', swatches,
      defaultColor: defaultBody.colorName, blackColor: blackBody.colorName, hex: entry && entry.hex };
  });
  if (r.names.join() !== 'White,Black,Steel') return `FAIL: Tundra colours are ${r.names.join(', ')}`;
  if (r.badge) return 'FAIL: the "Only White In Stock" badge is still on the Tundra tile';
  if (!r.colorCardShown || r.swatches !== 3) return `FAIL: the colour card shows ${r.swatches} swatches: ` + JSON.stringify(r);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#travelMugColorGridGen .color-cell')).map((c) => [c.querySelector('.color-name')?.textContent, c.querySelector('.color-btn')?.title]));
  if (labels.map((l) => l[0]).join() !== 'White,Black,Steel' || labels.some((l) => l[0] !== l[1])) return 'FAIL: the swatches are not labelled by name: ' + JSON.stringify(labels);
  if (r.defaultColor !== 'White') return `FAIL: with no colour picked the order body says ${JSON.stringify(r.defaultColor)} — Printify would take its first variant, the black one`;
  if (r.blackColor !== 'Black') return `FAIL: picking Black sent ${JSON.stringify(r.blackColor)}`;
  if (r.hex !== '#111214') return `FAIL: the 3D cup would be painted ${r.hex}, not the black picked`;
  return 'PASS: Tundra offers White, Black and Steel, each labelled, no badge, White by default, Black when picked, and the cup takes the hex';
};

// BLANK BANDS COME OFF (Alyx, v101, item 8). A 21:9 file with an empty
// fifth top and bottom loses the bands before the wrap is built, so the
// band on the cup is all picture. A file with no bands is left alone.
scenarios.blankBandsAreTrimmedFromTheWrap = async (page) => {
  const r = await page.evaluate(async () => {
    product = 'water bottle'; selectedTravelProductKey = 'travel-mug-30oz-tundra'; selectedTravelColor = null;
    const make = (banded) => {
      const c = document.createElement('canvas'); c.width = 1536; c.height = 658;
      const g = c.getContext('2d');
      g.fillStyle = '#3366cc'; g.fillRect(0, 0, 1536, 658);
      g.fillStyle = '#cc3333'; g.fillRect(0, 300, 1536, 60);
      if (banded) { g.clearRect(0, 0, 1536, 130); g.fillStyle = '#ffffff'; g.fillRect(0, 528, 1536, 130); }
      return c.toDataURL('image/png');
    };
    const size = async (u) => { const im = await loadImageFromUrl(u); return [im.naturalWidth, im.naturalHeight]; };
    const banded = await size(await extendWrapToProductRatio(make(true)));
    const plain = await size(await extendWrapToProductRatio(make(false)));
    const top = await (async () => {
      const im = await loadImageFromUrl(await extendWrapToProductRatio(make(true)));
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      // v108 softens the top tenth into the cup colour, so read a quarter
      // of the way down: that is picture if the bands were trimmed.
      const d = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.25), 1, 1).data; return [d[0], d[1], d[2]];
    })();
    return { banded, plain, top };
  });
  if (Math.abs(r.banded[1] - 398) > 4) return `FAIL: the banded file kept ${r.banded[1]}px of height — the empty fifths were not trimmed (expected ~398)`;
  if (Math.abs(r.banded[0] / r.banded[1] - 3.5) > 0.02) return `FAIL: the trimmed wrap is ${(r.banded[0] / r.banded[1]).toFixed(2)}:1, not 3.50:1`;
  if (r.plain[1] !== 658) return `FAIL: a file with no bands was trimmed to ${r.plain[1]}px`;
  if (r.top[0] > 200 && r.top[1] > 200 && r.top[2] > 200) return `FAIL: the top of the wrap is still blank: rgb(${r.top})`;
  return `PASS: empty bands trimmed (658 -> ${r.banded[1]}px), wrap 3.50:1 and picture to the top edge; an unbanded file is untouched`;
};

// THE PALETTE COMES NEXT (Alyx, v102): a cup with colours lands on its
// colour card, a colour lands on Print Style, and Print Style with an
// empty idea box lands on the idea box, not Generate.
scenarios.theCupsPaletteComesNext = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 1500);
  await dismissAlerts(page);
  const inView = (id) => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }, id);
  const focus = () => page.evaluate(() => Array.from(document.body.classList).find((c) => c.endsWith('-focus')));
  if (await focus() !== 'travel-color-focus') return `FAIL: after picking the Tundra the spotlight is ${await focus()}, not the colour card`;
  if (!(await inView('travelMugColorCard'))) return 'FAIL: the colour card is not on screen after picking the Tundra';
  await page.evaluate(() => { const b = document.querySelector('#travelMugColorGridGen .color-btn[data-color="Black"]'); b.click(); });
  await T(page, 1500);
  await dismissAlerts(page);
  if (await focus() !== 'print-mode-focus') return `FAIL: after picking Black the spotlight is ${await focus()}, not Print Style`;
  if (!(await inView('mugPrintModeCard'))) return 'FAIL: Print Style is not on screen after picking a colour';
  await page.evaluate(() => pickMugPrintMode('wraparound'));
  await T(page, 1500);
  await dismissAlerts(page);
  const idea = await page.evaluate(() => { const t = document.getElementById('ideaDesc'); const r = t.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; });
  if (!idea) return 'FAIL: Print Style with an empty idea box did not land on the idea box';
  return 'PASS: Tundra -> colour card -> Print Style -> idea box, each the next open question';
};

// A BAND THAT STOPS SHORT FADES TO THE CUP (Alyx, v105). The Gator's band
// does not meet itself at the back, so its wrap's ends fade to the bottle's
// colour instead of dissolving into each other; the centre stays untouched.
scenarios.gatorWrapFadesToTheBottle = async (page) => {
  const r = await page.evaluate(async () => {
    const src = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    product = 'water bottle'; selectedTravelColor = null;
    selectedTravelProductKey = 'travel-mug-32oz-gator';
    const out = await extendWrapToProductRatio(src);
    const orig = await loadImageFromUrl(src);
    const ext = await loadImageFromUrl(out);
    const px = (im, x, y) => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]];
    };
    const W = ext.naturalWidth, H = ext.naturalHeight, y = H * 0.35;
    return { closes: travelWrapCloses(selectedTravelProductKey), ratio: W / H,
      left: px(ext, 1, y), right: px(ext, W - 2, y), centre: px(ext, W / 2, H / 2), origCentre: px(orig, orig.naturalWidth / 2, orig.naturalHeight / 2) };
  });
  const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  if (r.closes) return 'FAIL: the Gator is marked as a band that meets itself';
  if (Math.abs(r.ratio - 1.75) > 0.02) return `FAIL: the Gator wrap is ${r.ratio.toFixed(3)}:1, not 1.75:1`;
  if (!near(r.left, [255, 255, 255], 8) || !near(r.right, [255, 255, 255], 8)) return `FAIL: the ends did not fade to the bottle's white: rgb(${r.left}) / rgb(${r.right})`;
  if (!near(r.centre, r.origCentre, 8)) return `FAIL: the centre of the picture changed: rgb(${r.origCentre}) -> rgb(${r.centre})`;
  return 'PASS: the Gator wrap is 1.75:1 with both ends faded to the bottle and the centre untouched';
};

// THE 40oz LANDS ON THE IDEA BOX (Alyx, v108). It has no Print Style step,
// so the colour pick is what has to land on the next open question.
scenarios.theFortyOunceLandsOnTheIdeaBox = async (page) => {
  await pickProduct(page, 'water bottle');
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-40oz-insulated'));
  await T(page, 1200);
  await dismissAlerts(page);
  await page.evaluate(() => { const b = document.querySelector('#travelMugColorGridGen .color-btn[data-color="Black"]'); b.click(); });
  await T(page, 1500);
  await dismissAlerts(page);
  const idea = await page.evaluate(() => { const t = document.getElementById('ideaDesc'); const r = t.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; });
  if (!idea) return 'FAIL: the 40oz colour pick did not land on the idea box';
  return 'PASS: the 40oz insulated lands on the idea box after its colour pick';
};

// FRAMES ON CUPS (Alyx, v108: "why can't we put frames on this mug?").
scenarios.framesAreOfferedOnCups = async (page) => {
  const r = await page.evaluate(() => {
    product = 'water bottle'; selectedTravelProductKey = 'travel-mug-30oz-tundra'; 
    mugPrintMode = 'wraparound'; windowSillChoice = null; selectedDesignMethod = null;
    placements.front = null; placements.left = null; placements.right = null;
    const before = frameOfferAvailable();
    placements.front = addToRecentDesigns('http://127.0.0.1:8788/__fake/panorama.jpg');
    const after = frameOfferAvailable();
    return { before, after };
  });
  if (r.before) return 'FAIL: a frame was offered on a cup with no picture on it';
  if (!r.after) return 'FAIL: no frame offered on a cup with a picture on it';
  return 'PASS: a cup with a picture is offered a frame';
};

// ONE CUP ONCE ONE IS CHOSEN (Alyx, v108): the other five go, the chosen
// cup sits beside the swatches in its colour, and Change cup brings the six
// back.
scenarios.pickingACupIsolatesIt = async (page) => {
  await pickProduct(page, 'water bottle');
  const six = await page.evaluate(() => document.querySelectorAll('#travelMugVariantGrid .theme-btn').length);
  if (six !== 6) return `FAIL: expected six cups before a pick, saw ${six}`;
  await page.evaluate(() => pickPreGenTravelVariant('travel-mug-30oz-tundra'));
  await T(page, 1200);
  await dismissAlerts(page);
  const one = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#travelMugVariantGrid .theme-btn').length,
    change: !!document.getElementById('travelChangeCupBtn'),
    // v109: the swatches share the row with the chosen cup, inside the picker card.
    beside: (() => {
      const tile = document.querySelector('#travelMugVariantGrid .theme-btn');
      const pal = document.getElementById('travelMugColorCard');
      if (!tile || !pal || pal.style.display === 'none') return false;
      if (!document.getElementById('travelMugVariantCard').contains(pal)) return false;
      const a = tile.getBoundingClientRect(), b = pal.getBoundingClientRect();
      return b.left >= a.right - 2 && b.top < a.bottom && b.bottom > a.top;
    })(),
  }));
  if (one.tiles !== 1) return `FAIL: ${one.tiles} cups still showing after a pick`;
  if (!one.change) return 'FAIL: no way back to the six cups';
  if (!one.beside) return 'FAIL: the colour swatches are not beside the chosen cup';
  await page.evaluate(() => changeTravelCup());
  await T(page, 800);
  const back = await page.evaluate(() => document.querySelectorAll('#travelMugVariantGrid .theme-btn').length);
  if (back !== 6) return `FAIL: Change cup brought back ${back} cups`;
  return 'PASS: one cup after a pick with its swatches beside it, six again after Change cup';
};

// THE TOOLS BUTTON IS ON EVERY FRAME (Alyx, Sep 2026): "Almost all the
// frames won't need it, but it doesn't hurt anything just to have it there
// just in case."
// It used to appear only on the twenty frames drawn from an artwork file.
// The other seven paint their border straight onto the canvas edge --
// drawPhotoInsetForFrame returns early for them and the photo fills the whole
// canvas -- so Width, Height and Position have nothing to grip and are hidden
// with a line saying why. Edge Fade works on any frame and is always there.
// Checks all 27, not a sample.
scenarios.everyFrameHasTheToolsPanel = async (page) => {
  const rows = await page.evaluate(async () => {
    product = 'mug'; mugPrintMode = 'wraparound';
    revealFlowActive = true; revealFlowThreePanel = false;
    lastWraparoundMethod = 'panorama';
    wraparoundPanoramaBaseUrl = 'http://127.0.0.1:8788/__fake/panorama.jpg';
    pendingWraparoundRaw = { left: 'a', center: 'b', right: 'c' };
    const out = [];
    for (const name of Object.keys(FRAME_CATALOG)) {
      selectedFrame = name; windowSillChoice = null; frameStudioFadePct = null;
      await refreshFrameFitSliders();
      out.push({
        frame: name,
        isImage: FRAME_CATALOG[name].type === 'image',
        toolsButton: document.getElementById('frameFitSlidersWrap').style.display !== 'none',
        fitSliders: document.getElementById('frameFitOpeningControls').style.display !== 'none',
        explains: document.getElementById('frameFitNoOpeningNote').style.display === 'block',
        fadeStart: Number(document.getElementById('frameFitFade').value),
        fadeFloor: Number(document.getElementById('frameFitFade').min),
        fadeCeiling: Number(document.getElementById('frameFitFade').max),
        needsFade: frameRequiresFade(name),
      });
    }
    return out;
  });

  if (rows.length !== 27) return `FAIL: expected 27 frames, saw ${rows.length}`;
  const noButton = rows.filter((r) => !r.toolsButton).map((r) => r.frame);
  if (noButton.length) return 'FAIL: no tools button on: ' + noButton.join(', ');

  // Fit sliders exactly where there is an opening to fit.
  const wrongSliders = rows.filter((r) => r.fitSliders !== r.isImage).map((r) => r.frame);
  if (wrongSliders.length) return 'FAIL: fit sliders shown/hidden wrongly on: ' + wrongSliders.join(', ');
  // And a reason given wherever they are absent.
  const unexplained = rows.filter((r) => !r.fitSliders && !r.explains).map((r) => r.frame);
  if (unexplained.length) return 'FAIL: sliders missing with no explanation on: ' + unexplained.join(', ');

  // Edge Fade is on all 27, and the twelve keep their default and their floor.
  const listed = rows.filter((r) => r.needsFade);
  if (listed.length !== 12) return `FAIL: ${listed.length} frames flagged as needing a fade, expected 12`;
  const wrongDefault = listed.filter((r) => r.fadeStart !== 40).map((r) => r.frame);
  if (wrongDefault.length) return 'FAIL: listed frames not starting at 40%: ' + wrongDefault.join(', ');
  const wrongPlain = rows.filter((r) => !r.needsFade && r.fadeStart !== 0).map((r) => r.frame);
  if (wrongPlain.length) return 'FAIL: unlisted frames carrying a fade they should not: ' + wrongPlain.join(', ');
  // Every frame's slider runs the whole range. No frame gets to cap it.
  const capped = rows.filter((r) => r.fadeFloor !== 0 || r.fadeCeiling !== 100).map((r) => `${r.frame} ${r.fadeFloor}-${r.fadeCeiling}`);
  if (capped.length) return 'FAIL: these frames cap the fade slider: ' + capped.join(', ');

  return `PASS: the tools panel opens on all ${rows.length} frames — fit sliders on the ${rows.filter((r) => r.fitSliders).length} with an opening, Edge Fade on all of them`;
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
