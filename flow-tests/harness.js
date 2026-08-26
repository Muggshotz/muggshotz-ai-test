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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
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
        return route.fulfill({ json: {
          leftUrl: `${BASE}/__fake/generated.jpg`,
          centerUrl: `${BASE}/__fake/generated.jpg`,
          rightUrl: `${BASE}/__fake/generated.jpg`,
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

async function uploadPhoto(page) {
  const input = page.locator('#fileInput');
  await input.setInputFiles(path.join(SCRATCH, 'test-photo.jpg'));
  await page.waitForTimeout(1200); // resize + fork reveal
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

module.exports = { launch, openStudio, uploadPhoto, interactable, bodyFocusClasses, dismissAlerts, BASE };
