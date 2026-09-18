// DRIVE IT MYSELF INSTEAD OF ASKING ALYX TO (Sep 2026, and he was right to
// object: "YOU CAN ACTUALLY PERFORM THEM YOURSELF, AND MUCH MUCH MUCH FASTER
// THAN I CAN").
//
// Generates once against the live API, walks to the screen with the spinning
// cup, and photographs that cup BEFORE and AFTER a frame is picked. The pair is
// the whole answer: the frame either arrives on the cup or it does not.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PAGE='http://127.0.0.1:8788';
const API='https://muggshotz-ai-test.vercel.app';
const DEVICE='mz-claude-test';
const OUT=process.argv[2]||'/tmp/frameshot';
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await browser.newContext({viewport:{width:430,height:880}});
  await ctx.addInitScript(id=>{try{localStorage.setItem('muggshotz_device_id',id)}catch(e){}},DEVICE);
  const page=await ctx.newPage();
  let imageUrl=null;
  const relay=async route=>{
    const req=route.request();
    const raw=new URL(req.url());
    const url=raw.pathname.startsWith('/api/')?API+raw.pathname+raw.search:req.url();
    try{
      const body=['GET','HEAD'].includes(req.method())?undefined:req.postDataBuffer();
      const h={...req.headers()};delete h.host;delete h.origin;delete h.referer;delete h['content-length'];
      const r=await fetch(url,{method:req.method(),headers:h,body,signal:AbortSignal.timeout(180000)});
      const buf=Buffer.from(await r.arrayBuffer());
      if(raw.pathname==='/api/generate'){try{imageUrl=JSON.parse(buf.toString('utf8')).imageUrl}catch(e){}}
      await route.fulfill({status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/octet-stream'},body:buf});
    }catch(e){await route.fulfill({status:502,body:'{}'})}
  };
  await page.route('**/api/**',relay);
  await page.route('https://**',relay);
  const clear=async()=>{for(let i=0;i<6;i++){const n=await page.evaluate(()=>{let n=0;document.querySelectorAll('.big-alert-overlay.visible').forEach(o=>{o.classList.remove('visible');o.style.display='none';n++});return n});if(!n)break;await page.waitForTimeout(200)}};

  await page.goto(PAGE+'/needles-studio.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  await page.setInputFiles('#fileInput',path.join(__dirname,'..','alyx-face.jpg'));
  await page.waitForTimeout(2500); await clear();
  await page.evaluate(()=>{if(typeof chooseIntentAI==='function')chooseIntentAI()});
  await page.waitForTimeout(1200); await clear();
  await page.evaluate(()=>pickTrackDescribe());
  await page.waitForTimeout(1000); await clear();
  await page.evaluate(()=>{const t=[...document.querySelectorAll('#styleSectionCard .btn-select')].find(b=>b.textContent.includes('Muggshotz Classic'));pick(t,'style')});
  await page.waitForTimeout(500);
  await page.evaluate(()=>confirmStyleAndContinue());
  await page.waitForTimeout(1000); await clear();
  await page.evaluate(()=>{const b=document.getElementById('ideaDesc');b.value='Holding a giant coffee mug, big grin.';b.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForTimeout(700); await clear();
  await page.evaluate(()=>{const t=document.querySelector('#productCard .btn-select[data-val="mug"]');pick(t,'product')});
  await page.waitForTimeout(1500); await clear();
  // mug needs size / style / colour before it will generate
  await page.evaluate(()=>{try{pickPreGenMugSize('11oz')}catch(e){}});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{try{pickPreGenMugStyle(Object.keys(GEN_MUG_STYLES)[0])}catch(e){}});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{const b=document.querySelector('#preGenMugColorGrid .color-btn');if(b)b.click()});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{try{finishPreGenMugColorPick()}catch(e){}});
  await page.waitForTimeout(1200); await clear();
  await page.evaluate(()=>{const t=[...document.querySelectorAll('#likenessSectionCard .btn-select')].find(b=>b.dataset.val==='0.25');if(t)pick(t,'likeness')});
  await page.waitForTimeout(600); await clear();

  log('generating...');
  await page.evaluate(()=>document.getElementById('generateBtn').click());
  for(let i=0;i<120&&!imageUrl;i++)await page.waitForTimeout(2000);
  if(!imageUrl){log('NO IMAGE');await browser.close();process.exit(1)}
  log('image back');
  await page.waitForTimeout(6000); await clear();

  // Wait for the reveal to actually be on screen before approving -- the last
  // attempt approved into thin air and never left the generation screen.
  for(let i=0;i<40;i++){
    const up=await page.evaluate(()=>{const r=document.getElementById('approveRow');return !!r&&getComputedStyle(r).display!=='none'});
    if(up)break;
    await page.waitForTimeout(1000);
  }
  log('approve row up: '+await page.evaluate(()=>{const r=document.getElementById('approveRow');return !!r&&getComputedStyle(r).display!=='none'}));
  await page.evaluate(()=>{try{approveDesign(false)}catch(e){}});
  await page.waitForTimeout(6000); await clear();

  // The cup with the fade slider lives behind the edge question. Open it.
  for(let i=0;i<40;i++){
    const ready=await page.evaluate(()=>typeof chooseFadeEdges==='function'&&!!document.getElementById('revealEdgeButtonsRow'));
    if(ready)break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(()=>{try{chooseFadeEdges()}catch(e){console.error(e)}});
  await page.waitForTimeout(4000); await clear();
  for(let i=0;i<20;i++){
    const m=await page.evaluate(()=>typeof revealFade3DMounted!=='undefined'&&revealFade3DMounted);
    if(m)break;
    await page.waitForTimeout(1000);
  }

  const state=await page.evaluate(()=>({
    fadePanelOpen: typeof revealFadePanelOpen==='function'?revealFadePanelOpen():null,
    cupMounted: typeof revealFade3DMounted!=='undefined'?revealFade3DMounted:null,
    frames: [...document.querySelectorAll('.frame-btn')].slice(0,6).map(b=>b.textContent.trim()).filter(Boolean)
  }));
  log('state: '+JSON.stringify(state));

  const stage=await page.$('#revealFade3DStage');
  const shoot=async name=>{
    const el=await page.$('#revealFade3DStage');
    if(el&&await el.isVisible())await el.screenshot({path:path.join(OUT,name)});
    else await page.screenshot({path:path.join(OUT,name),fullPage:true});
  };
  await shoot('1-before-frame.png');
  const picked=await page.evaluate(()=>{
    const b=[...document.querySelectorAll('.frame-btn')].find(x=>!x.classList.contains('coming-soon'));
    if(!b)return null;
    const name=b.textContent.trim();
    b.click();
    return name;
  });
  log('picked frame: '+picked);
  await page.waitForTimeout(7000); await clear();
  await shoot('2-after-frame.png');
  log('shots written to '+OUT);
  await browser.close();
})();
