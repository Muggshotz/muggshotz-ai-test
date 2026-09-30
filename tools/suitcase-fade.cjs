// SUITCASE PREMADES, FADED TO THE SUITCASE (Alyx, 30 Sep 2026: "fade to suitcase color ... anchor it to the hex number").
// The colour comes from getSelectedProductColorHex() with product=suitcase -- the studio's one rule for
// fade colour -- so a colour added to the suitcase there is picked up here. 30% is the studio default.
//   (serve the repo on 127.0.0.1:8788, then) node tools/suitcase-fade.cjs <name> ...  (art/suitcases/flat/<name>.webp -> art/suitcases/faded/<name>.jpg)
const path=require('path'),fs=require('fs');
const { chromium } = require('/home/user/muggshotz-ai-test/node_modules/playwright');
const names=process.argv.slice(2);
(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8788/needles-studio.html');
  await page.waitForFunction(()=>typeof renderFadedArtwork==='function'&&typeof getSelectedProductColorHex==='function');
  const hex=await page.evaluate(()=>{ product='suitcase'; return getSelectedProductColorHex(); });
  console.log('suitcase hex:',hex);
  for(const n of names){
    const url=await page.evaluate(async(n)=>renderFadedArtwork('art/suitcases/flat/'+n+'.webp',getSelectedProductColorHex(),30,100),n);
    fs.writeFileSync('/home/user/muggshotz-ai-test/art/suitcases/faded/'+n+'.jpg',Buffer.from(url.split(',')[1],'base64'));
    console.log(n);
  }
  await browser.close();
})();
