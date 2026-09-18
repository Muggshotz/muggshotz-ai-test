// A FRAME IS DRAWN ONCE (Alyx, Sep 2026: "what he inadvertently did was
// applied the frames twice. Please fix this.")
//
// The rule, from the comment in updateAccessorizePreview: the frame goes on
// the PANEL as it will print. renderPanelPrintDataUrl produces that panel --
// surface, fit, fade, caption, accent border -- and the catalogue frame is
// composited on top by the caller. So the panel render must never draw a
// frame itself, or every caller stacks a second one inside the first. And
// once a frame IS applied, the saved file carries the accent border, so the
// design must stop asking the printer for one.
const { chromium } = require('playwright');
const PAGE='http://127.0.0.1:8788/needles-studio.html';
let pass=0,fail=0;
const ok=(n,d)=>{pass++;console.log(`PASS: ${n}`,d===undefined?'':JSON.stringify(d));};
const no=(n,d)=>{fail++;console.log(`FAIL: ${n}`,d===undefined?'':JSON.stringify(d));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await (await b.newContext({viewport:{width:430,height:880}})).newPage();
  await p.goto(PAGE,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2000);
  const r=await p.evaluate(()=>{
    // Comments are part of toString(); strip them so a comment that NAMES the
    // frame helpers (to say they must not be called here) cannot fail the test.
    const code=fn=>fn.toString().replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
    const panel=code(renderPanelPrintDataUrl);
    const apply=code(applyAccessorizeFrame);
    const preview=code(updateAccessorizePreview);
    return {
      panelDrawsNoFrame: !/drawFrameOnCanvas|compositeFrame|drawWindowSillOnCanvas|drawPhotoInsetForFrame/.test(panel),
      panelStillDrawsBorder: /strokeRect/.test(panel) && /getMugAccentHex/.test(panel),
      callersFrameAfterwards: /renderPanelPrintDataUrl/.test(apply) && /compositeFrameOntoImageUrl/.test(apply) && /compositeFrameOntoImageUrl/.test(preview),
      appliedFrameStopsSecondBorder: /border:false/.test(apply.match(/setDesignAdjust\(id,\{[^}]*\}\)/)?.[0]||''),
      cupPreviewFramesItsOwnCopyOnly: /compositeFrameOntoImageUrl/.test(code(ensureRevealFadePreviewUrls))
    };
  });
  r.panelDrawsNoFrame ? ok('the panel render draws no catalogue frame') : no('the panel render draws a frame -- callers will stack a second one', r);
  r.panelStillDrawsBorder ? ok('the panel render still draws the thin accent border') : no('the accent border came out with the frame', r);
  r.callersFrameAfterwards ? ok('the frame is composited by the callers, after the panel render') : no('a caller no longer frames the panel', r);
  r.appliedFrameStopsSecondBorder ? ok('applying a frame sets border:false so the printer adds no second border') : no('the saved framed design still asks the printer for a border', r);
  r.cupPreviewFramesItsOwnCopyOnly ? ok('the reveal cup previews the frame on its own scaled copy, never on a saved file') : no('the reveal cup preview path lost its frame', r);
  console.log(fail?`\n${fail} FAILURE(S)`:'\nALL FRAME-ONCE VERIFICATIONS PASSED');
  await b.close(); process.exit(fail?1:0);
})();
