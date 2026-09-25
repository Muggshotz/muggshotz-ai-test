// BUSINESS-CARD SPINS, the studio side (Alyx, 24 Sep 2026). The server rules
// are in verify-card-bonus.mjs; this holds the page to:
//   * arriving by the card's link (through the front door, as the QR code
//     does) opens the offer, naming the spins;
//   * sending posts the email with the card's code and this device;
//   * with no spins, Generate offers the card's spins rather than the price list;
//   * once the email is verified the offer is gone and the code forgotten;
//   * a code that is off shows nothing.
const { launch, uploadPhoto, dismissAlerts } = require('./harness');
const T = (p, ms) => p.waitForTimeout(ms);
const BASE = 'http://127.0.0.1:8788';

async function open(opts) {
  const { browser, page, log } = await launch({ viewport: opts.viewport });
  const sent = [];
  await page.route('**/api/get-balance**', (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get('card')) return route.fulfill({ json: opts.on ? { on: true, spins: 5 } : { on: false } });
    return route.fulfill({ json: { tokenBalance: opts.verified ? 5 : 0, isAdmin: false, hasPurchased: false, emailVerified: !!opts.verified } });
  });
  await page.route('**/api/send-verification', (route) => { sent.push(route.request().postDataJSON()); route.fulfill({ json: { success: true } }); });
  if (opts.preset) await page.addInitScript((c) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('muggshotz_card_code', c); } }, opts.preset);
  await page.goto(BASE + (opts.path || '/?card=MUGGSY'), { waitUntil: 'domcontentloaded' });
  await T(page, 2500);
  return { browser, page, log, sent };
}
const shown = (page) => page.evaluate(() => document.getElementById('cardBonusOverlay').classList.contains('visible'));

const scenarios = {

  async arrivesFromTheCard(viewport) {
    const { browser, page, log, sent } = await open({ viewport, on: true });
    try {
      const url = page.url();
      if (!/needles-studio\.html\?card=MUGGSY/.test(url)) return `FAIL: the card link landed on ${url}`;
      if (!(await shown(page))) return 'FAIL: arriving from the card shows no offer';
      const msg = await page.textContent('#cardBonusMsg');
      if (!/5 free spins/.test(msg)) return `FAIL: the offer says "${msg}"`;
      const box = await page.evaluate(() => { const r = document.querySelector('#cardBonusOverlay .guidance-alert-box').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, H: innerHeight }; });
      if (box.top < 0 || box.bottom > box.H) return `FAIL: the offer is not fully on screen ${JSON.stringify(box)}`;
      await page.fill('#cardBonusEmail', 'bob@example.com');
      await page.click('#cardBonusSendBtn'); await T(page, 800);
      const s = sent[0];
      if (!s || s.email !== 'bob@example.com' || s.cardCode !== 'MUGGSY' || !/^dev-/.test(s.deviceId || '')) return `FAIL: the claim sent ${JSON.stringify(s)}`;
      const st = await page.textContent('#cardBonusStatus');
      if (!/Check your email/.test(st)) return `FAIL: after sending it says "${st}"`;
      if (log.pageErrors.length) return `FAIL: page errors ${JSON.stringify(log.pageErrors)}`;
      return 'PASS: the card link lands on the studio with the offer of 5 spins; sending posts the email, card code and device';
    } finally { await browser.close(); }
  },
  async generateOffersTheSpins(viewport) {
    const { browser, page } = await open({ viewport, on: true });
    try {
      await page.evaluate(() => closeCardBonus());
      await uploadPhoto(page); await dismissAlerts(page);
      await page.evaluate(() => showTokenInfoPopup(document.getElementById('generateBtn')));
      await T(page, 400);
      if (!(await shown(page))) return 'FAIL: at 0 spins the card visitor is shown the price list, not the card offer';
      return 'PASS: at 0 spins, running out opens the card offer';
    } finally { await browser.close(); }
  },
  async verifiedSeesNothing(viewport) {
    const { browser, page } = await open({ viewport, on: true, verified: true, path: '/needles-studio.html', preset: 'MUGGSY' });
    try {
      if (await shown(page)) return 'FAIL: a verified visitor is still offered the spins';
      const kept = await page.evaluate(() => localStorage.getItem('muggshotz_card_code'));
      if (kept) return `FAIL: the card code is still kept after verifying (${kept})`;
      return 'PASS: once verified, no offer, and the card code is forgotten';
    } finally { await browser.close(); }
  },
  async offCodeShowsNothing(viewport) {
    const { browser, page } = await open({ viewport, on: false });
    try {
      if (await shown(page)) return 'FAIL: a switched-off code still shows the offer';
      return 'PASS: a switched-off code shows nothing';
    } finally { await browser.close(); }
  },
};

// THE CREDITS POPUP SHOWS BEFORE THE PHOTO (Alyx, 25 Sep 2026: "all I get is
// a completely subdued page"). Before a photo is chosen the page hides every
// card but the upload card, and the popup's box is a card: the page dimmed
// and nothing appeared. A popup is never part of the rail; it must show.
scenarios.creditsPopupShowsBeforeThePhoto = async (viewport) => {
  const { browser, page } = await open({ viewport, on: false, path: '/needles-studio.html' });
  try {
    await page.evaluate(() => openCreditsPanel());
    await T(page, 600);
    const st = await page.evaluate(() => {
      const c = document.querySelector('#creditsModalOverlay .card'); const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
      return { focus: [...document.body.classList].filter((x) => /focus/.test(x)), opacity: Number(cs.opacity), clickable: cs.pointerEvents !== 'none', onScreen: r.width > 200 && r.height > 200 && r.top >= 0 };
    });
    if (!st.focus.includes('initial-upload-focus')) return `FAIL: the page is not in its pre-photo focus (${st.focus.join(' ')}) -- not the reported case`;
    if (st.opacity < 0.99 || !st.clickable || !st.onScreen) return `FAIL: the Credits box is hidden before the photo: ${JSON.stringify(st)}`;
    return 'PASS: the Credits & Extras popup shows, fully lit and clickable, before a photo is chosen';
  } finally { await browser.close(); }
};


// MAYBE LATER IS REMEMBERED (Alyx, 25 Sep 2026). Declining closes the offer
// and it does not open by itself on the next visit; the chips pill still
// offers it on a tap.
scenarios.maybeLaterIsRemembered = async (viewport) => {
  const { browser, page } = await open({ viewport, on: true });
  try {
    if (!(await shown(page))) return 'FAIL: the offer did not open on arrival';
    await page.evaluate(() => declineCardBonus());
    await T(page, 300);
    if (await shown(page)) return 'FAIL: Maybe later did not close the offer';
    await page.goto(BASE + '/needles-studio.html', { waitUntil: 'domcontentloaded' });
    await T(page, 2500);
    if (await shown(page)) return 'FAIL: the offer came back by itself after Maybe later';
    const offeredOnTap = await page.evaluate(() => { showTokenInfoPopup(document.getElementById('hudPill')); return document.getElementById('cardBonusOverlay').classList.contains('visible'); });
    if (!offeredOnTap) return 'FAIL: after Maybe later the chips pill no longer offers the spins';
    return 'PASS: Maybe later closes the offer for good; the chips pill still offers it on a tap';
  } finally { await browser.close(); }
};

(async () => {
  let fails = 0;
  for (const [screen, viewport] of Object.entries({ laptop: { width: 1880, height: 770 }, phone: { width: 390, height: 844 } })) {
    for (const [name, fn] of Object.entries(scenarios)) {
      let r; try { r = await fn(viewport); } catch (e) { r = 'ERROR: ' + String(e).split('\n')[0]; }
      console.log(`[${screen}] [${name}] ${r}`); if (!/^PASS/.test(r)) fails++;
    }
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CARD-BONUS STUDIO CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})();
