// Regression for Alyx's suitcase report (Aug 2026): after approving a
// single-image design the customer landed on "Design Your Product" with no
// visible next step. Continue to Order WAS rendered, but it sits at the
// bottom of a text-heavy card and ships styled cta-muted (45% opacity), and
// the approve tail scrolled to the card's TOP -- so the only actionable
// control was both below the fold and greyed out.
//
// These checks pin all three properties that failure needed: the button is
// shown, it is NOT muted, and it is actually within the viewport.
const { launch, openStudio, uploadPhoto, dismissAlerts } = require('./harness');

const waitApprove = (page, t = 90000) =>
  page.waitForFunction(() => document.getElementById('approveRow')?.style.display !== 'none', null, { timeout: t });

async function approveOne(page, productVal, prep) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${productVal}"]`).click({ force: true });
  await page.waitForTimeout(900);
  if (prep) await prep(page);
  // Product is finished; the description is the last thing before Generate.
  const needsIdea = await page.evaluate((v) => PRODUCTS_NEEDING_IDEA.includes(v), productVal);
  if (needsIdea) {
    await page.fill('#ideaDesc', 'riding a dragon over a volcano');
    await page.waitForTimeout(600);
    // page.fill() focuses the textarea, which fires the once-per-session
    // showIdeaBoxIntroIfNeeded() MODAL. A real customer clicks Got It; the
    // test has to as well or the overlay swallows the next click.
    await dismissAlerts(page);
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await waitApprove(page);
  await page.locator('#approveRow button:has-text("Yes")').first().click();
  await page.waitForTimeout(2500); // let the handoff scroll settle
}

async function orderBtnState(page) {
  return page.evaluate(() => {
    const b = document.getElementById('orderMugBtn');
    if (!b) return { exists: false };
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return {
      exists: true,
      shown: cs.display !== 'none',
      muted: b.classList.contains('cta-muted'),
      flashing: b.classList.contains('cta-flash'),
      opacity: Number(cs.opacity),
      inViewport: r.top < innerHeight && r.bottom > 0,
      top: Math.round(r.top),
      viewportH: innerHeight,
    };
  });
}

function judge(label, st) {
  if (!st.exists) return `FAIL: ${label}: orderMugBtn missing entirely`;
  if (!st.shown) return `FAIL: ${label}: Continue to Order is display:none — customer has NO next step`;
  if (st.muted || st.opacity < 0.9) return `FAIL: ${label}: still cta-muted (opacity ${st.opacity}) — the one action is greyed out`;
  if (!st.inViewport) return `FAIL: ${label}: off-screen after approve (top=${st.top}, viewport=${st.viewportH})`;
  if (!st.flashing) return `FAIL: ${label}: not flashing — no lit point of engagement`;
  return `PASS: ${label}: Continue to Order shown, un-muted, flashing, in viewport (top=${st.top}/${st.viewportH})`;
}

const scenarios = {

  async suitcaseApproveHandoff(page) {
    await approveOne(page, 'suitcase', async (p) => {
      await p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]');
      await p.waitForTimeout(500);
    });
    return judge('suitcase', await orderBtnState(page));
  },

  async puzzleApproveHandoff(page) {
    await approveOne(page, 'puzzle', async (p) => {
      await p.click('#puzzleSizeGrid .btn-select[data-puzzle-size="500 pcs"]');
      await p.waitForTimeout(500);
    });
    return judge('puzzle', await orderBtnState(page));
  },

  async toteApproveHandoff(page) {
    await approveOne(page, 'tote bag', async (p) => {
      await p.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
      await p.waitForTimeout(400);
      await p.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
      await p.waitForTimeout(400);
    });
    return judge('tote', await orderBtnState(page));
  },

  // Mugs must NOT get this button -- they have their own advance path, and
  // showing it would let a mug skip the real Printify mockup entirely.
  async mugStillExcluded(page) {
    await page.click('#postUploadForkRow button:has-text("Select Your Product")');
    await page.waitForTimeout(700);
    await page.locator('#productCard .btn-select[data-val="mug"]').click({ force: true });
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => {
      const b = document.getElementById('orderMugBtn');
      return { shown: b ? getComputedStyle(b).display !== 'none' : false };
    });
    if (st.shown) return 'FAIL: mug is showing Continue to Order — it could skip the real mockup';
    return 'PASS: mug correctly excluded from Continue to Order';
  },

  // A fresh start must put the button back to muted, or it flashes at a
  // customer who has nothing to order.
  async resetRemutesOrderButton(page) {
    await approveOne(page, 'suitcase', async (p) => {
      await p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Small"]');
      await p.waitForTimeout(500);
    });
    const before = await orderBtnState(page);
    if (before.muted) return 'FAIL: button was still muted straight after approve';
    page.once('dialog', d => d.accept());
    await page.evaluate(() => resetEverythingFreshStart());
    await page.waitForTimeout(900);
    const after = await orderBtnState(page);
    if (!after.muted || after.flashing) {
      return `FAIL: reset left it un-muted/flashing: ${JSON.stringify({ muted: after.muted, flashing: after.flashing })}`;
    }
    return 'PASS: reset re-mutes and stops the flash';
  },
};


// --- Alyx's second report: no description box was ever offered ---------------
// Every product with a mandatory pre-gen pick used to hand off to
// finalGenerateGuidance, which sits BELOW the idea card, leaving the idea
// card collapsed at zero height and never seen. These pin that the idea card
// is expanded, on screen, and reachable after the mandatory pick.
async function ideaCardState(page) {
  return page.evaluate(() => {
    const card = document.getElementById('ideaCard');
    const ta = document.getElementById('ideaDesc');
    const sec = card ? card.closest('.snap-section') : null;
    const r = card ? card.getBoundingClientRect() : null;
    return {
      collapsed: sec ? sec.classList.contains('snap-collapsed') : null,
      height: r ? Math.round(r.height) : 0,
      inViewport: r ? (r.top < innerHeight && r.bottom > 0) : false,
      typable: !!ta && !ta.disabled,
    };
  });
}

function judgeIdea(label, st) {
  if (st.collapsed) return `FAIL: ${label}: idea card still snap-collapsed — customer never offered a description`;
  if (st.height === 0) return `FAIL: ${label}: idea card has zero height — invisible`;
  if (!st.inViewport) return `FAIL: ${label}: idea card off-screen after the mandatory pick`;
  if (!st.typable) return `FAIL: ${label}: idea textarea not typable`;
  return `PASS: ${label}: idea card expanded, on screen (${st.height}px) and typable`;
}

async function afterMandatoryPick(page, val, prep) {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator(`#productCard .btn-select[data-val="${val}"]`).click({ force: true });
  await page.waitForTimeout(1000);
  await prep(page);
  await page.waitForTimeout(1600);
}

scenarios.ideaOfferedSuitcase = async (page) => {
  await afterMandatoryPick(page, 'suitcase', async (p) => {
    await p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]');
  });
  return judgeIdea('suitcase', await ideaCardState(page));
};

scenarios.ideaOfferedPuzzle = async (page) => {
  await afterMandatoryPick(page, 'puzzle', async (p) => {
    await p.click('#puzzleSizeGrid .btn-select[data-puzzle-size="500 pcs"]');
  });
  return judgeIdea('puzzle', await ideaCardState(page));
};

scenarios.ideaOfferedPhoneCase = async (page) => {
  await afterMandatoryPick(page, 'phone case', async (p) => {
    await p.fill('#phoneModelSearchInputGen', 'iPhone 15 Pro Max');
    await p.waitForTimeout(1200);
    const hit = p.locator('#phoneModelResultsGen >> text=iPhone 15 Pro Max').first();
    if (await hit.count()) { await hit.click(); await p.waitForTimeout(700); }
    const yes = p.locator('#phoneModelConfirmGen button:has-text("Yes")');
    if (await yes.count()) await yes.click();
  });
  return judgeIdea('phone case', await ideaCardState(page));
};


// --- description required, and required LAST -------------------------------
const modalOf = (page) => page.evaluate(() => {
  const b = document.getElementById('bigAlertOverlay');
  return b && getComputedStyle(b).display !== 'none' ? document.getElementById('bigAlertMsg')?.textContent : null;
});

// Product fully chosen, description blank -> blocked, and told which product.
scenarios.blankIdeaBlocked = async (page) => {
  await afterMandatoryPick(page, 'suitcase', async (p) => {
    await p.click('#suitcaseSizeGrid .btn-select[data-suitcase-size="Medium"]');
  });
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForTimeout(1200);
  const m = await modalOf(page);
  if (!m || !/tell us what/i.test(m)) return `FAIL: blank description NOT blocked (modal=${JSON.stringify(m)})`;
  if (!/suitcase/i.test(m)) return `FAIL: message does not name the product: ${m}`;
  return `PASS: blank description blocked, names the product`;
};

// Nothing chosen at all -> the PRODUCT guard must fire first. Asking for the
// description first would drag them out of a product they were mid-way through.
scenarios.productGuardFiresBeforeIdea = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="suitcase"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.getElementById('generateBtn')?.scrollIntoView({ block: 'center' }));
  await page.click('#generateBtn');
  await page.waitForTimeout(1200);
  const m = await modalOf(page);
  if (!m) return 'FAIL: nothing blocked with neither size nor description';
  if (/tell us what/i.test(m)) return 'FAIL: asked for the description before the size — drags them out of the product';
  if (!/suitcase size/i.test(m)) return `FAIL: unexpected guard fired first: ${m.slice(0, 70)}`;
  return 'PASS: product guard fires first, description second (finish the product, then the image)';
};

// Tote is the only two-option product: size -> colour -> THEN the idea card.
scenarios.toteFinishesProductBeforeIdea = async (page) => {
  await page.click('#postUploadForkRow button:has-text("Select Your Product")');
  await page.waitForTimeout(700);
  await page.locator('#productCard .btn-select[data-val="tote bag"]').click({ force: true });
  await page.waitForTimeout(1000);
  await page.click('#toteSizeGrid .btn-select[data-tote-size=\'16" x 16"\']');
  await page.waitForTimeout(1200);
  const afterSize = await page.evaluate(() => {
    const c = document.getElementById('toteBagColorCard');
    const r = c.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  });
  if (!afterSize) return 'FAIL: size did not hand off to the colour card';
  await page.click('#toteBagColorGridGen .color-btn[data-color="Black"]');
  await page.waitForTimeout(1600);
  const st = await ideaCardState(page);
  if (st.collapsed || !st.inViewport) return `FAIL: colour did not hand off to the idea card: ${JSON.stringify(st)}`;
  return 'PASS: tote runs size -> colour -> idea card (product finished first)';
};

// Mugs keep their own path and are never forced to type.
scenarios.mugExemptFromTyping = async (page) => {
  const inList = await page.evaluate(() => PRODUCTS_NEEDING_IDEA.includes('mug'));
  const cupInList = await page.evaluate(() => PRODUCTS_NEEDING_IDEA.includes('water bottle'));
  if (inList) return 'FAIL: mug is in PRODUCTS_NEEDING_IDEA — it has Cover Me / Face It / Home Sweet Home';
  if (cupInList) return 'FAIL: travel cup is in PRODUCTS_NEEDING_IDEA — same gimmicks apply';
  return 'PASS: mug and travel cup exempt from the description requirement';
};

(async () => {
  let fails = 0;
  for (const [name, fn] of Object.entries(scenarios)) {
    const { browser, page, log } = await launch();
    try {
      await openStudio(page);
      await uploadPhoto(page);
      await dismissAlerts(page);
      const result = await fn(page, log);
      console.log(`[${name}] ${result}`);
      if (/^FAIL/.test(result)) fails++;
    } catch (e) {
      console.log(`[${name}] ERROR: ${String(e).split('\n')[0]}`);
      fails++;
      await page.screenshot({ path: `shot-handoff-fail-${name}.png` }).catch(() => {});
    }
    const errs = log.consoleErrors.filter(e => !/ERR_TUNNEL/.test(e));
    if (errs.length) { console.log(`  CONSOLE: ${JSON.stringify(errs)}`); fails++; }
    if (log.pageErrors.length) { console.log(`  PAGE ERRORS: ${JSON.stringify(log.pageErrors)}`); fails++; }
    await browser.close();
  }
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL APPROVE-HANDOFF VERIFICATIONS PASSED');
  process.exit(fails ? 1 : 0);
})();
