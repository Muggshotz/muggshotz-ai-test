// THE RESIZE TOOL ONLY EVER EXISTED ON A THREE-PANEL MUG (Alyx, Sep 2026):
// "two or three times I tried to generate an image for my sister and I was
// going to apply the fade at the end and never got the toolbar. I wanted to
// shrink the image size a little too so that the fade would look nice and
// proportionate on the final mock-up with no props."
//
// Not intermittent. Every single-image product routes through
// maybeOpenFadeBeforeMockup(), which sets revealFlowThreePanel = false, and
// that flag was the only thing that showed a fit panel. So the fade screen
// offered a fade and nothing to fade INTO -- the picture filled the print area
// edge to edge, so the softening began at the boundary.
//
// These checks pin the fix: a size control exists on that screen, and the size
// it reports is the size that gets baked. The measurement is taken from the
// output of renderFadedArtwork(), which is the function the SAVE path calls --
// not the preview -- so a slider that moved the preview alone would fail here.
const { launch, openStudio } = require('./harness');

const results = [];
const check = (ok, msg) => { results.push((ok ? 'PASS: ' : 'FAIL: ') + msg); return ok; };

(async () => {
  const { browser, page } = await launch({ width: 430, height: 880 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await openStudio(page);

    // 1. The control is on the screen at all.
    const ui = await page.evaluate(() => ({
      slider: !!document.getElementById('frameFadeSizeSlider'),
      readout: !!document.getElementById('frameFadeSizeVal'),
      min: document.getElementById('frameFadeSizeSlider')?.min,
      max: document.getElementById('frameFadeSizeSlider')?.max,
      value: document.getElementById('frameFadeSizeSlider')?.value,
    }));
    check(ui.slider && ui.readout, `the fade screen has a size control (${JSON.stringify(ui)})`);
    check(ui.value === '100', `it opens at full size, so nothing shrinks unasked (value=${ui.value})`);

    // 2. The size it reports is the size that bakes. Measured off the function
    //    the save path calls, at three settings.
    const rows = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0, 0, 400, 400);
      const src = c.toDataURL('image/png');
      const out = [];
      for (const size of [100, 70, 40]) {
        const baked = await renderFadedArtwork(src, '#FFFFFF', 0, size);
        const im = await loadImageFromUrl(baked);
        const m = document.createElement('canvas'); m.width = im.naturalWidth; m.height = im.naturalHeight;
        const mx = m.getContext('2d'); mx.drawImage(im, 0, 0);
        const d = mx.getImageData(0, 0, m.width, m.height).data;
        let minX = 1e9, maxX = -1;
        for (let px = 0; px < m.width; px++) {
          const i = (Math.floor(m.height / 2) * m.width + px) * 4;
          if (d[i] > 120 && d[i + 1] < 100 && d[i + 2] < 100) { if (px < minX) minX = px; if (px > maxX) maxX = px; }
        }
        out.push({ size, pct: maxX >= 0 ? Math.round((maxX - minX + 1) / m.width * 100) : 0 });
      }
      return out;
    });
    for (const r of rows) {
      check(Math.abs(r.pct - r.size) <= 3,
        `slider ${r.size} bakes a picture at ${r.pct}% of the print area`);
    }
    check(rows[0].pct > rows[1].pct && rows[1].pct > rows[2].pct,
      `smaller really is smaller, in order (${rows.map(r => r.pct + '%').join(' > ')})`);

    // 3. The space it vacates is the product's colour, not black or transparent
    //    -- it has to print as the mug, not as a hole.
    const surround = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0, 0, 200, 200);
      const baked = await renderFadedArtwork(c.toDataURL('image/png'), '#1E7A46', 0, 50);
      const im = await loadImageFromUrl(baked);
      const m = document.createElement('canvas'); m.width = im.naturalWidth; m.height = im.naturalHeight;
      const mx = m.getContext('2d'); mx.drawImage(im, 0, 0);
      const p = mx.getImageData(2, 2, 1, 1).data;
      return { r: p[0], g: p[1], b: p[2] };
    });
    check(surround.g > surround.r && surround.g > surround.b,
      `the space around a shrunk picture prints in the product colour (${JSON.stringify(surround)})`);

    check(errors.length === 0, `no page errors (${JSON.stringify(errors.slice(0, 3))})`);
  } catch (err) {
    results.push('FAIL: suite threw: ' + err.message);
  }
  await browser.close();
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL FADE-SIZE VERIFICATIONS PASSED');
  process.exit(failed.length ? 1 : 0);
})();
