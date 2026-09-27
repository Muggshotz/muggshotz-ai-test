// MOCKUPS WE ALLOW (Alyx, 27 Sep 2026: "We can't be giving them images from
// printify of our placemats being used as desk pads"). The neoprene placemat
// is Printify's desk mat, whose mockups include two desk scenes (context-1,
// context-2: a laptop and mouse on the mat). What this pins: the mockup check
// hands the page only the cameras the catalog allows (mockupCameras), and a
// product that names none keeps every picture Printify sends.
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');

(async () => {
  process.env.PRINTIFY_API_TOKEN = 'test';
  const { default: handler } = await import(pathToFileURL(path.join(ROOT, 'api', 'start-mockup.js')).href);
  const { PRODUCTS_CATALOG } = await import(pathToFileURL(path.join(ROOT, 'lib', 'products-catalog.js')).href);
  const shot = (vid, cam) => ({ src: `https://images.printify.com/mockup/p/${vid}/1/x.jpg?camera_label=${cam}`, variant_ids: [vid], position: 'front', is_default: cam === 'front' });
  let fails = 0;
  const cases = [
    { name: 'neoprene placemat', p: PRODUCTS_CATALOG['placemat-neoprene'], vid: 65240, want: ['front', 'back'] },
    { name: 'cotton placemat (no list)', p: PRODUCTS_CATALOG['placemat-cotton'], vid: 63956, want: ['front', 'back', 'context-1', 'context-2'] }
  ];
  for (const c of cases) {
    const deleted = [];
    globalThis.fetch = async (url, opts = {}) => {
      if ((opts.method || 'GET') === 'DELETE') { deleted.push(url); return { ok: true, json: async () => ({}) }; }
      return { ok: true, json: async () => ({ blueprint_id: c.p.blueprintId, print_provider_id: c.p.printProviderId, variants: [], print_areas: [],
        images: ['front', 'back', 'context-1', 'context-2'].map((cam) => shot(c.vid, cam)) }) };
    };
    let out = null;
    const res = { status() { return this; }, json(b) { out = b; return this; } };
    await handler({ method: 'POST', body: { action: 'check', productId: 'p', variantId: c.vid } }, res);
    const cams = (out?.mockupUrls || []).map((u) => new URL(u).searchParams.get('camera_label'));
    const ok = JSON.stringify(cams) === JSON.stringify(c.want) && out.mockupUrl === out.mockupUrls[0];
    console.log(`[${c.name}] ${ok ? 'PASS' : 'FAIL'}: shown ${JSON.stringify(cams)}${ok ? '' : `, wanted ${JSON.stringify(c.want)}`}`);
    if (!ok) fails++;
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL MOCKUP-CAMERA VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
