// Shared Playwright harness for the Needles' Studio flow audit.
// Serves nothing itself — expects the repo on http://127.0.0.1:8788.
// Stubs EVERY /api/* endpoint so no real generation, Printify, Stripe,
// or Supabase call can ever fire. Zero real spend by construction.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8788';
const SCRATCH = __dirname;
const FAKE_GENERATED = fs.readFileSync(path.join(SCRATCH, 'fake-generated.jpg'));
const FAKE_MOCKUP = fs.readFileSync(path.join(SCRATCH, 'fake-mockup.jpg'));

async function launch(opts = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  // Viewport is overridable because height is not cosmetic here: cards with
  // max-height:90vh clip their own content, so a bug that is invisible on a
  // 900px-tall desktop window is a dead end on a 760px phone. Tests that care
  // about reachability pass their own.
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const log = { consoleErrors: [], pageErrors: [], apiCalls: [], notFound: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') log.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => log.pageErrors.push(String(e)));
  page.on('response', (r) => { if (r.status() === 404) log.notFound.push(r.url()); });

  // ---- API stubs ----
  const genDelayMs = opts.genDelayMs ?? 300; // fast by default; tests can slow it
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    let body = {};
    try { body = req.postDataJSON() || {}; } catch (_) {}
    log.apiCalls.push({ path: p, action: body.action || null });

    if (p === '/api/get-balance') {
      return route.fulfill({ json: { tokenBalance: 25, hasPurchased: true, isAdmin: false } });
    }
    if (p === '/api/generate') {
      await new Promise((r) => setTimeout(r, genDelayMs));
      if (body.action === 'wraparoundPanorama') {
        // panoramaUrl is the whole uncut wide image -- travel cups take
        // that one, coffee mugs take the three thirds. Both shapes come
        // back from the same call, so both must be stubbed here or the
        // travel-cup wraparound path throws "No panorama image returned."
        if (opts.panoramaFails) {
          return route.fulfill({ status: 502, json: { error: 'stubbed panorama outage' } });
        }
        // 403 is NOT an outage: it means the customer is out of credits, and
        // it must stop the flow rather than fall through to the per-panel
        // path, which would generate (and charge) a second time.
        if (opts.panoramaOutOfCredits) {
          return route.fulfill({ status: 403, json: { error: "You're out of free tokens." } });
        }
        return route.fulfill({ json: {
          leftUrl: `${BASE}/__fake/generated.jpg`,
          centerUrl: `${BASE}/__fake/generated.jpg`,
          rightUrl: `${BASE}/__fake/generated.jpg`,
          panoramaUrl: `${BASE}/__fake/generated.jpg`,
        }});
      }
      return route.fulfill({ json: { imageUrl: `${BASE}/__fake/generated.jpg` } });
    }
    if (p === '/api/start-mockup') {
      if (body.action === 'start') {
        return route.fulfill({ json: { productId: 'fake-prod-1', variantId: 99999 } });
      }
      return route.fulfill({ json: { ready: true, mockupUrl: `${BASE}/__fake/mockup.jpg`,
        mockupUrls: [`${BASE}/__fake/mockup.jpg`, `${BASE}/__fake/mockup.jpg`] } });
    }
    if (p === '/api/create-checkout-session') {
      return route.fulfill({ json: { url: `${BASE}/__fake/checkout-redirect` } });
    }
    if (p === '/api/send-verification') {
      return route.fulfill({ json: { ok: true, sent: true } });
    }
    if (p === '/api/phone-case-catalog' || p === '/api/phone-compatibility-check') {
      return route.fulfill({ json: {
        matches: [{ model: 'iPhone 15 Pro', blueprintId: 1, printProviderId: 1, variantId: 111 }],
        compatible: true, model: 'iPhone 15 Pro',
      }});
    }
    // Unknown API endpoint — record and return a soft error so it surfaces.
    log.apiCalls.push({ path: p, action: 'UNSTUBBED' });
    return route.fulfill({ status: 500, json: { error: `unstubbed endpoint ${p}` } });
  });

  // Google Fonts is unreachable from this sandbox — stub with empty CSS
  // so environmental noise doesn't pollute the zero-console-errors check.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  // Printify thumbnail CDN is unreachable from this sandbox exactly like
  // Google Fonts is, and the travel-cup variant grid renders one <img> per
  // variant from it -- left unstubbed that is four ERR_CONNECTION_RESET
  // console errors per run, which looks like a product fault and isn't one.
  await page.route('https://images.printify.com/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: FAKE_MOCKUP }));

  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ contentType: 'font/woff2', body: Buffer.alloc(0) }));

  // Fake image assets referenced by the stubs above.
  await page.route('**/__fake/generated.jpg', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: FAKE_GENERATED }));
  await page.route('**/__fake/mockup.jpg', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: FAKE_MOCKUP }));
  await page.route('**/__fake/checkout-redirect', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>FAKE CHECKOUT</title>OK' }));

  return { browser, context, page, log };
}

async function openStudio(page) {
  await page.goto(`${BASE}/needles-studio.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800); // initial scripts, balance fetch
}

// THE INTENT GATE (2026-08-28): every upload now stops on a hard "AI or
// your own art?" choice before Art Style/the Track fork ever show. Wait for
// the gate to actually OPEN before choosing -- it opens from the photo
// handler's .then chain, so its appearance proves the resize finished and
// layout is settled. Choosing at a fixed delay raced that chain: under
// sweep load the choice could fire BEFORE the gate opened, showPostUploadFork
// then scrolled against a still-resizing photo (the stale-scroll landing
// short), and the late-opening gate was left covering the page.
async function waitForIntentGate(page) {
  // No catch: the gate is mandatory now, so an upload that never produces
  // it IS the failure -- swallowing it here would let uploadPhoto()
  // fabricate the post-upload state and keep every suite green through a
  // broken gate (the adversarial review's harness-masking finding).
  await page.waitForFunction(() => {
    const o = document.getElementById('intentGateOverlay');
    return o && getComputedStyle(o).display !== 'none';
  }, null, { timeout: 15000 });
}

async function uploadPhoto(page) {
  const input = page.locator('#fileInput');
  await input.setInputFiles(path.join(SCRATCH, 'test-photo.jpg'));
  await waitForIntentGate(page);
  // Every suite except verify-exact-transfer.js's BYO-gate scenarios is
  // about the AI rail, so this reproduces the exact prior default by
  // choosing AI here -- one suite-wide seam instead of touching dozens of
  // scenario files.
  await page.evaluate(() => { if (typeof chooseIntentAI === 'function') chooseIntentAI(); });
  await page.waitForTimeout(600); // fork reveal
}

// For scenarios that specifically test the "supply your own art" declaration.
async function uploadPhotoAndChooseBYO(page) {
  const input = page.locator('#fileInput');
  await input.setInputFiles(path.join(SCRATCH, 'test-photo.jpg'));
  await waitForIntentGate(page);
  await page.evaluate(() => { if (typeof chooseIntentBYO === 'function') chooseIntentBYO(); });
  await page.waitForTimeout(600);
}

// Utility: is an element genuinely visible AND not consumed by a dimming
// overlay (pointer-events:none via a *-focus class on body)?
async function interactable(page, selector, { scroll = true } = {}) {
  return page.evaluate(({ sel, scroll }) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false };
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    let clickable = false, coveredBy = null;
    if (visible) {
      const mid = document.elementFromPoint(
        Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1),
        Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
      clickable = !!mid && (el === mid || el.contains(mid) || mid.contains(el));
      if (!clickable && mid) coveredBy = mid.id ? `#${mid.id}` : mid.className ? `.${String(mid.className).split(' ')[0]}` : mid.tagName;
    }
    return { exists: true, visible, clickable, coveredBy,
      pointerEvents: cs.pointerEvents, opacity: cs.opacity, rect: { top: Math.round(r.top), h: Math.round(r.height) } };
  }, { sel: selector, scroll });
}

// Dismiss any open guidance/big alert modals (the "Got It" popups).
async function dismissAlerts(page) {
  return page.evaluate(() => {
    let n = 0;
    const g = document.getElementById('guidanceAlertOverlay');
    const b = document.getElementById('bigAlertOverlay');
    if (g && getComputedStyle(g).display !== 'none') { try { closeGuidanceAlert(); n++; } catch (e) {} }
    if (b && getComputedStyle(b).display !== 'none') { try { closeBigAlert(); n++; } catch (e) {} }
    return n;
  });
}

async function bodyFocusClasses(page) {
  return page.evaluate(() =>
    Array.from(document.body.classList).filter((c) => c.endsWith('-focus') || c === 'generation-active'));
}

// Single-image products now stop at the real Edge Fade page between approve
// and the mockup -- the finished picture on screen with a live slider, which
// is where the fade decision belongs (the pre-generation card was retired for
// asking about an image that did not exist yet). Suites that drive a product
// from approve to its mockup have to pass through it.
//
// Deliberately tolerant: mugs on the three-panel path reach this page by
// their own route, and products that skip it are not an error here.
async function passFadePage(page, { timeout = 20000 } = {}) {
  const opened = await page.waitForFunction(() => {
    const o = document.getElementById('frameFadeOverlay');
    return !!(o && getComputedStyle(o).display !== 'none');
  }, null, { timeout }).then(() => true).catch(() => false);
  if (!opened) return false;
  await page.click('#frameFadeOverlay button:has-text("Continue")');
  await page.waitForTimeout(1200);
  return true;
}

module.exports = { launch, openStudio, uploadPhoto, uploadPhotoAndChooseBYO, waitForIntentGate, interactable, bodyFocusClasses, dismissAlerts, passFadePage, BASE };
