// Executes the real /api/admin onboarding + lookup actions with Supabase
// faked at the wire, and checks that the pack they mint is exactly what
// the webhook would mint for the same beta at the same tier (they share
// lib/flyer-tiers.js, and this is what proves it). Browser-free.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
process.env.ADMIN_PASSWORD = 'pw';

const db = { flyer_betas: [], flyer_codes: [] };
let nextId = 100;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); const m = opts.method || 'GET';
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  const table = (u.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
  if (/\/rpc\/fn_beta_available_balance/.test(u)) return json(24.5);
  if (table && !db[table] && /^(flyer_payouts|campaigns)$/.test(table)) return json({ code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }, 404);
  if (!table || !db[table]) return json({ message: `unstubbed ${m} ${u}` }, 500);
  if (m === 'POST') {
    const rows = [].concat(JSON.parse(opts.body)).map((r) => ({ id: nextId++, created_at: new Date().toISOString(), ...r }));
    for (const r of rows) if (table === 'flyer_codes' && db.flyer_codes.some((x) => x.code === r.code)) return json({ message: `duplicate key value violates unique constraint "flyer_codes_pkey" (${r.code})` }, 409);
    db[table].push(...rows); return json(rows);
  }
  // GET with PostgREST filters: base_code=eq.X, beta_id=in.(1,2)
  const q = new URL(u).searchParams; let rows = db[table];
  for (const [k, v] of q) {
    if (k === 'select' || k === 'order') continue;
    if (v.startsWith('eq.')) rows = rows.filter((r) => String(r[k]) === v.slice(3));
    else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(','); rows = rows.filter((r) => set.includes(String(r[k]))); }
  }
  return json(rows);
};

const { default: admin } = await import(pathToFileURL(path.join(ROOT, 'api', 'admin.js')).href);
const { buildTierCodes } = await import(pathToFileURL(path.join(ROOT, 'lib', 'flyer-tiers.js')).href);
const call = async (body) => { const r = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; await admin({ method: 'POST', body }, r); return r; };
const quiet = () => {}; const origErr = console.error; const origLog = console.log; console.error = quiet; console.log = quiet;

let fails = 0;
const check = (label, fn) => Promise.resolve().then(fn).then((msg) => origLog(`[${label}] PASS: ${msg}`)).catch((e) => { fails++; origLog(`[${label}] FAIL: ${e.message}`); });

await check('wrongPasswordIsRefused', async () => {
  const r = await call({ action: 'onboard', password: 'nope', fullName: 'Jane Smith', baseCode: 'chipper' });
  if (r.code !== 403) throw new Error(`answered ${r.code}`);
  if (db.flyer_betas.length) throw new Error('a beta was created anyway');
  return '403, nothing written';
});
await check('badBaseCodeIsRefused', async () => {
  const r = await call({ action: 'onboard', password: 'pw', fullName: 'Jane Smith', baseCode: 'CHIP-PER' });
  if (r.code !== 400) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  return 'a hyphenated base code is rejected before anything is written';
});
let onboarded;
await check('onboardMintsTheEntryPack', async () => {
  const r = await call({ action: 'onboard', password: 'pw', fullName: 'Jane Smith', baseCode: 'chipper', contactEmail: 'jane@x.test', contactPhone: '555', featuredProduct: 'classic-white-mug' });
  if (r.code !== 200) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  onboarded = r.body;
  const beta = db.flyer_betas[0];
  if (beta.base_code !== 'CHIPPER' || beta.current_tier !== 'PotShotz') throw new Error(`beta row ${JSON.stringify(beta)}`);
  if (beta.featured_product !== 'classic-white-mug' || beta.contact_phone !== '555') throw new Error('phone/featured product not saved');
  const want = buildTierCodes(beta.id, 'CHIPPER', 'PotShotz');
  const got = db.flyer_codes.filter((c) => c.beta_id === beta.id);
  if (got.length !== 20) throw new Error(`${got.length} codes minted`);
  for (let i = 0; i < 20; i++) for (const k of Object.keys(want[i])) if (String(got[i][k]) !== String(want[i][k])) throw new Error(`code ${i + 1}: ${k}=${got[i][k]}, the webhook would mint ${want[i][k]}`);
  if (r.body.codes[0] !== 'CHIPPER-01' || r.body.codes[19] !== 'CHIPPER-20') throw new Error(`answered codes ${r.body.codes[0]}..${r.body.codes[19]}`);
  if (!got.every((c) => c.commission_rate === 0.03 && c.cap_amount === 20 && c.commission_total === 0 && c.matured === false)) throw new Error('a code has the wrong rate/cap/starting state');
  return 'CHIPPER-01..20 at 3% / $20 cap, identical to the webhook\'s minting, phone + featured product saved';
});
await check('duplicateBaseCodeIsRefused', async () => {
  const r = await call({ action: 'onboard', password: 'pw', fullName: 'Someone Else', baseCode: 'CHIPPER' });
  if (r.code !== 409) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  if (db.flyer_betas.length !== 1 || db.flyer_codes.length !== 20) throw new Error('something was written');
  return `409 names the owner: "${r.body.error}"`;
});
await check('missingOptionalColumnsDoNotBlockOnboarding', async () => {
  const realFetch = globalThis.fetch; let attempts = 0;
  globalThis.fetch = async (url, opts) => {
    if (/flyer_betas$/.test(String(url)) && opts?.method === 'POST' && /featured_product/.test(opts.body)) { attempts++; return new Response(JSON.stringify({ message: "Could not find the 'featured_product' column of 'flyer_betas' in the schema cache" }), { status: 400 }); }
    return realFetch(url, opts);
  };
  try {
    const r = await call({ action: 'onboard', password: 'pw', fullName: 'Bud Tester', baseCode: 'BUD', featuredProduct: 'coaster-set', contactPhone: '777' });
    if (r.code !== 200) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
    if (!r.body.warning) throw new Error('no warning was surfaced');
    if (attempts !== 1) throw new Error(`${attempts} attempts with the optional columns`);
    const beta = db.flyer_betas.find((b) => b.base_code === 'BUD');
    if (!beta || 'featured_product' in beta) throw new Error('retry still carried the missing column');
    if (db.flyer_codes.filter((c) => c.beta_id === beta.id).length !== 20) throw new Error('codes not minted on the retry');
    return `beta created on retry, warning: "${r.body.warning}"`;
  } finally { globalThis.fetch = realFetch; }
});
await check('betasLookupReturnsThePackWithEarnings', async () => {
  db.flyer_codes.find((c) => c.code === 'CHIPPER-07').commission_total = 4.5;
  db.flyer_codes.find((c) => c.code === 'CHIPPER-02').commission_total = 20; db.flyer_codes.find((c) => c.code === 'CHIPPER-02').matured = true;
  const r = await call({ action: 'betas', password: 'pw', baseCode: 'chipper' });
  if (r.code !== 200) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  const b = r.body.betas[0];
  if (!b || b.baseCode !== 'CHIPPER' || b.codes.length !== 20) throw new Error(JSON.stringify(r.body).slice(0, 200));
  if (b.totalEarned !== 24.5) throw new Error(`totalEarned=${b.totalEarned}`);
  const c2 = b.codes.find((c) => c.code === 'CHIPPER-02');
  if (!c2.matured || c2.earned !== 20 || c2.cap !== 20) throw new Error(`CHIPPER-02 ${JSON.stringify(c2)}`);
  const all = await call({ action: 'betas', password: 'pw' });
  if (all.body.betas.length !== 2) throw new Error(`all-betas listed ${all.body.betas.length}`);
  return 'one beta by base code with $24.50 earned across 20 codes; all-betas lists both';
});
await check('unknownBaseCodeIs404', async () => {
  const r = await call({ action: 'betas', password: 'pw', baseCode: 'NOBODY' });
  if (r.code !== 404) throw new Error(`answered ${r.code}`);
  return '404';
});

// ===== Ledger, payouts, campaigns =====
await check('ledgerWorksBeforeTheSqlIsRun', async () => {
  const r = await call({ action: 'ledger', password: 'pw' });
  if (r.code !== 200) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  const miss = r.body.missingTables;
  if (!miss.includes('flyer_payouts') || !miss.includes('campaigns')) throw new Error(`missingTables=${JSON.stringify(miss)}`);
  if (r.body.totals.earned !== 24.5 || r.body.totals.owed !== 24.5) throw new Error(`totals ${JSON.stringify(r.body.totals)}`);
  const p = await call({ action: 'payout', password: 'pw', betaId: db.flyer_betas[0].id, amount: 5 });
  if (p.code !== 409 || !/flyer-ledger\.sql/.test(p.body.error)) throw new Error(`payout answered ${p.code}: ${JSON.stringify(p.body)}`);
  const c = await call({ action: 'campaign-create', password: 'pw', name: 'X', productKey: 'coaster-set', packsAvailable: 5 });
  if (c.code !== 409 || !/flyer-ledger\.sql/.test(c.body.error)) throw new Error(`campaign answered ${c.code}: ${JSON.stringify(c.body)}`);
  return 'ledger answers with earned/owed and names both missing tables; payout and campaign point at the SQL file';
});
db.flyer_payouts = []; db.campaigns = [];
let campaignId;
await check('campaignFillsAndCloses', async () => {
  const c = await call({ action: 'campaign-create', password: 'pw', name: 'Lincoln Band', productKey: 'coaster-set', packsAvailable: 1 });
  if (c.code !== 200) throw new Error(`create answered ${c.code}: ${JSON.stringify(c.body)}`);
  campaignId = c.body.campaign.id;
  const a = await call({ action: 'onboard', password: 'pw', fullName: 'Drum Major', baseCode: 'DRUM', campaignId });
  if (a.code !== 200) throw new Error(`first onboard answered ${a.code}: ${JSON.stringify(a.body)}`);
  const beta = db.flyer_betas.find((b) => b.base_code === 'DRUM');
  if (String(beta.campaign_id) !== String(campaignId)) throw new Error('campaign_id not saved');
  if (beta.featured_product !== 'coaster-set') throw new Error(`featured_product=${beta.featured_product}, expected the campaign's product`);
  const b = await call({ action: 'onboard', password: 'pw', fullName: 'Second Chair', baseCode: 'FLUTE', campaignId });
  if (b.code !== 409 || !/full/.test(b.body.error)) throw new Error(`second onboard answered ${b.code}: ${JSON.stringify(b.body)}`);
  if (db.flyer_betas.some((x) => x.base_code === 'FLUTE')) throw new Error('the refused beta was written anyway');
  const l = await call({ action: 'ledger', password: 'pw' });
  const camp = l.body.campaigns.find((x) => String(x.id) === String(campaignId));
  if (!camp || camp.packsUsed !== 1 || !camp.full) throw new Error(`ledger campaign ${JSON.stringify(camp)}`);
  return 'one pack: the first beta takes it (inheriting the campaign product), the second is refused as full, the ledger shows 1/1 FULL';
});
await check('payoutReducesWhatIsOwed', async () => {
  const chipper = db.flyer_betas.find((b) => b.base_code === 'CHIPPER');
  const over = await call({ action: 'payout', password: 'pw', betaId: chipper.id, amount: 30, note: 'oops' });
  if (over.code !== 409) throw new Error(`overpay answered ${over.code}: ${JSON.stringify(over.body)}`);
  const p = await call({ action: 'payout', password: 'pw', betaId: chipper.id, amount: 10, note: 'Venmo' });
  if (p.code !== 200 || p.body.available !== 14.5) throw new Error(`payout answered ${p.code}: ${JSON.stringify(p.body)}`);
  const l = await call({ action: 'ledger', password: 'pw' });
  const b = l.body.betas.find((x) => x.baseCode === 'CHIPPER');
  if (b.earned !== 24.5 || b.paid !== 10 || b.available !== 14.5) throw new Error(`ledger row ${JSON.stringify({ e: b.earned, p: b.paid, a: b.available })}`);
  if (b.payouts.length !== 1 || b.payouts[0].note !== 'Venmo') throw new Error('payout not listed on the beta');
  if (l.body.totals.paid !== 10 || l.body.totals.owed !== 14.5) throw new Error(`totals ${JSON.stringify(l.body.totals)}`);
  const zero = await call({ action: 'payout', password: 'pw', betaId: chipper.id, amount: 0 });
  if (zero.code !== 400) throw new Error(`zero payout answered ${zero.code}`);
  return '$30 refused against $24.50 owed; $10 Venmo recorded -> owed $14.50, totals follow, $0 refused';
});
await check('theBetaBalancePageSubtractsPayouts', async () => {
  const { default: getBalance } = await import(pathToFileURL(path.join(ROOT, 'api', 'get-balance.js')).href);
  const r = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await getBalance({ method: 'GET', query: { referralCode: 'CHIPPER-07' } }, r);
  if (r.code !== 200) throw new Error(`answered ${r.code}: ${JSON.stringify(r.body)}`);
  if (r.body.totalBalance !== 14.5) throw new Error(`totalBalance=${r.body.totalBalance}, expected 24.50 earned - 10 paid`);
  if (r.body.fullName !== 'Jane Smith') throw new Error('name missing (the landing page reads it)');
  return `flyer-balance shows ${r.body.totalBalance} after the $10 payout, name "${r.body.fullName}" for the landing page`;
});

console.error = origErr; console.log = origLog;
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL FLYER-ONBOARDING VERIFICATIONS PASSED');
process.exit(fails ? 1 : 0);
