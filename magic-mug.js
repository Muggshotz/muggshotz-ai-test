// magic-mug.js -- THE MAGIC MUG, shared by needles-studio.html and occasion.html
// (Alyx, 3 Oct 2026: the occasion site should "CERTAINLY use the Magic Mug
// demonstration pages with carousel"). Moved verbatim out of needles-studio.html:
// the holiday mugs and their prices, the shelf's turning mug, How the magic mug
// works, and the heat reveal. Classic-script globals, as they were; needs mug3d.js
// first. flow-tests/verify-surprise-sets.js reads the prices and SURPRISE_SETS here.

const SMART_MUG_PRICE=19.95; // Alyx's price, before shipping: wholesale 9.06 + $10, customer total under $30

// THE HOLIDAY MUGS (Alyx, 26-27 Sep 2026). A holiday is a shelf of single
// smart-mug designs, mixed and matched: "you decide the participants". Any
// four, repeats and all, are a set; more with a set are $17.95 each; fewer
// than four are $19.95 each (holidayPrice, the server's rule mirrored). The
// server's own list (lib/surprise-sets.js) names the print files and is what
// is printed; this copy is the Pre-mades panel's, and
// flow-tests/verify-surprise-sets.js holds the two together. A new mug is
// tools/surprise/holiday-mug.py on the artist's file and one line in each.
const SMART_MUG_SET_PRICE=59.95; // Alyx's price for any four (26 Sep 2026)
const SMART_MUG_EXTRA_PRICE=17.95; // each more with a set, $2 off the single (26 Sep 2026)
const SURPRISE_SETS={
  'thanksgiving':{label:'Thanksgiving',demo:'golden-brown',designs:[
    {key:'power-out',label:"Power's Out",file:'thanksgiving-power-out',frames:true},
    {key:'witness',label:'Witness Protection',file:'thanksgiving-witness',frames:true},
    {key:'pardon',label:'The Pardon',file:'thanksgiving-pardon',frames:true},
    {key:'chickens',label:'All These Chickens',file:'thanksgiving-chickens',frames:true},
    {key:'golden-brown',label:'Golden Brown',file:'golden-brown',frames:true},
    {key:'thankful',label:'Thankful',file:'thankful',frames:true},
    {key:'uncle-gerald',label:'Uncle Gerald',file:'uncle-gerald',frames:true},
    {key:'the-diet',label:'The Diet',file:'the-diet',frames:true},
    {key:'dark-meat',label:'Dark Meat',file:'dark-meat',frames:true}
  ]},
  // Raise the Dead (Bud, 28 Sep 2026): one continuous scene, a tree between
  // the setup and the punchline, its edges fading to white as the hot mug is.
  'halloween':{label:'Halloween',demo:'halloween-boo-ghost-one',designs:[
    // Boo first: it is the mug on the Halloween flyer (Alyx, 3 Oct 2026).
    {key:'boo',label:'Boo',file:'halloween-boo-ghost',frames:['one']},
    {key:'raise-the-dead',label:'Raise the Dead',file:'halloween-raise-the-dead',frames:['one']},
    // Sheet Happens (Bud, 26 Sep 2026; was Boo until 3 Oct, Alyx: the name went
    // to the new cartoon ghost): the ghost's face; turned round, the laundry tag.
    {key:'sheet-happens',label:'Sheet Happens',file:'halloween-boo',frames:['one']},
    // Goes Right Through Me (Bud, 5 Oct 2026; coffee cleaned off the bones with
    // Alyx): two scenes on black, Bud's own lettering; framed at 0.87 so the
    // frame covers none of it (frame-mug.py's scale).
    {key:'goes-right-through-me',label:'Goes Right Through Me',file:'halloween-goes-right-through-me',frames:['one']},
    // When Pumpkins Dream (Bud, 5 Oct 2026; Alyx's caption, set by Claude on the
    // plain pumpkin's side, clear of the frame on both hands): the jack-o'-lantern
    // it dreams of is the punchline, no words.
    {key:'when-pumpkins-dream',label:'When Pumpkins Dream',file:'halloween-when-pumpkins-dream',frames:['one']},
    // Sugar Skull (Bud, 5 Oct 2026): one picture, no joke, the skull opposite the
    // handle. The left-handed print is the same picture (rolled, the skull would
    // split behind the handle), and no frame: its middle ornaments would cross
    // the skull's brow and chin.
    {key:'sugar-skull',label:'Sugar Skull',file:'halloween-sugar-skull'}
  ]}
};
function holidayPrice(n){ return n>=4 ? Math.round((SMART_MUG_SET_PRICE+(n-4)*SMART_MUG_EXTRA_PRICE)*100)/100 : Math.round(n*SMART_MUG_PRICE*100)/100; }

// The print files of the mugs chosen (keys), for the order page's pictures.
function setPrintUrls(key,hand,mugs){
  const set=SURPRISE_SETS[key]; if(!set)return null;
  return mugs.map(k=>{ const [b,f]=String(k).split('~'), d=set.designs.find(x=>x.key===b); return d&&{file:d.file+(f?'-'+f:'')}; }).filter(Boolean)
    .map(d=>location.origin+'/art/surprise/'+d.file+'-print'+(hand==='left'?'-left':'')+'.png');
}
// A holiday mug's frame, picked on the shelf like a prop (Alyx, 29 Sep 2026),
// travels with it as "key~frame" (lib/surprise-sets.js SET_FRAMES): one
// frame round everything, or a frame round each side; no frame is the key.
const SET_FRAMES={none:'No frame',one:'One frame',two:'A frame each side'};
// The frames a design comes in: frames:true is both (the Thanksgiving decals),
// a list names its own -- the Halloween mugs come in the one Halloween frame
// (Alyx, 3 Oct 2026; tools/surprise/frame-mug.py builds its files).
function designFrames(d){ return !d||!d.frames?[]:d.frames===true?['one','two']:d.frames.filter(f=>SET_FRAMES[f]); }

// THE MUG ON THE SHELF TURNS (Alyx, 27 Sep 2026: "the exact same carousel
// layout that we have for our mockups at the end ... a carousel that spins
// automatically", "slightly faster for this display", and "a mug doesn't need
// to start spinning until you're looking at it ... that way it always starts
// in the proper position"). One full turn, then it stops on the setup again
// until it is tapped ("only spin once and then stop"). The mockup's own 3D mug, hot, wearing the
// right-handed print: handle on the right, the setup facing (-90, measured),
// turning on to the punchline. All at once: "still pictures of the first
// frames. The setup ... the very first one is already the carousel", and a
// tap turns another into it. The still under every stage is the same cup at
// the same angle (art/surprise/mug/, tools/surprise/mug-stills.cjs), so it is
// what shows until the cup is drawn, and all there is on a device that
// cannot draw one.
// THE MUG HOT (Alyx, 28 Sep 2026): "The mug is always white but is painted
// with" a black coating that clears when it is hot -- so the hot mug is white
// wherever nothing is printed, the strip either side of the handle included;
// "Handle remains black". The inside and rim are kept black too. That is
// Color Pop's colouring (inside, rim and handle coloured, a white wall), in
// black.
const SHELF_MUG_3D={sizeLabel:'11oz',styleName:'Color Pop',colorHex:'#1c1c1c',startAngle:-90,spinStep:0.6,restartOnView:true,turns:1};

// The Smart Mug's demonstration (How the magic mug works): a decal mug
// (Alyx, 29 Sep 2026: "swap this out for one of the new Decal designs").
const SMART_HOW_FILE='proposal';
let shelfMugLive=null;
function shelfMugHtml(x,id,i,frame){
  return '<div class="pm-mug3d" data-mug3d="'+x.file+(frame&&frame!=='none'?'-'+frame:'')+'"'+(i==null?'':' onclick="spinShelfMug(this)"')+'>'
    +'<img'+(id?' id="'+id+'"':'')+' src="art/surprise/mug/'+x.file+'.jpg" width="960" height="720" alt="'+x.label+'"'+(i?' loading="lazy"':'')+'/>'
    +'<div class="pm-mug3d-stage"></div><div class="pm-spin-cue">↻ Click to spin</div></div>';
}
function spinShelfMug(el,opts){
  if(!el||el===shelfMugLive||typeof MUG3D==='undefined'||(typeof mug3dFailed!=='undefined'&&mug3dFailed))return;
  if(shelfMugLive)shelfMugLive.classList.remove('live','spinning');
  shelfMugLive=el;
  if(!el._spinCue){ el._spinCue=true; el.addEventListener('mug3dspin',e=>el.classList.toggle('spinning',!!e.detail)); }
  const stage=el.querySelector('.pm-mug3d-stage');
  MUG3D.open(stage,Object.assign({panoramaUrl:'art/surprise/wrap/'+el.dataset.mug3d+'.jpg',panelUrls:[]},opts||SHELF_MUG_3D))
    // A Back that came while the cup was still being built: it was let go
    // before it existed, so let it go now.
    .then(()=>{ if(shelfMugLive===el)el.classList.add('live'); else if(MUG3D.host()===stage)MUG3D.close(); })
    .catch(err=>{ console.error('The shelf mug could not turn; its still stands in:',err); if(shelfMugLive===el)shelfMugLive=null;
      // No cup can be drawn here, so no mug on this page will spin: say nothing about clicking.
      const v=document.getElementById('premadesView'); if(v)v.classList.add('no3d'); });
}
// Any other view, or the card leaving: the cup is let go, so whatever opens it
// next (the mockup, the fade slider, Trimmings) builds it fresh.
function releaseShelfMug(){
  if(!shelfMugLive)return;
  shelfMugLive=null;
  try{ if(MUG3D.mounted())MUG3D.close(); }catch(e){}
}
// HOW THE MAGIC MUG WORKS: steps 1 to 6, the same wherever they are told --
// the holiday shelf's How it works, and the (i) on the 11oz Smart Mug button
// (Alyx, 28 Sep 2026). step4img: the picture for step 4, or '' where the page
// sets its own turning 3D mug into it.
function magicMugStep(n,head,line,img,wide){
  return '<div class="pm-step"><div class="pm-sn">'+n+'</div><div class="pm-sh">'+head+'</div><div class="pm-sl">'+line+'</div>'
    +(img?'<img class="pm-simg'+(wide?' pm-wide':'')+'" src="art/premades/how/'+img+'.jpg" width="'+(wide?924:455)+'" height="'+(wide?674:330)+'" alt=""/>':'')+'</div>';
}
function magicMugStepsHtml(step4img,noPics){
  const step=magicMugStep, pic=x=>noPics?'':x;
  return step(1,"Cold, it's a plain black mug.","Nothing to see. Nobody knows what's coming.",pic('black'))
    +step(2,'Pour in something hot.',"Coffee, tea, cocoa. It doesn't switch on all at once: as the mug warms, the picture slowly rises up through the black.",pic('emerge'),true)
    +step(3,'The setup image appears.',"Once it's hot, the setup image is there in full, facing them.",pic('hot'))
    +step(4,'They turn it round.','Nobody can stop at the setup. Curious, they turn the mug, and the punchline is waiting on the other side.',pic(step4img))
    +step(5,'Let it cool, and it hides again.','As the mug cools it goes back to plain black, ready to surprise the next unsuspecting victim.',pic('black'))
    +step(6,'Left hand or right.','When you order, tell us which hand they hold a mug in, and we print it so the setup image starts on the side facing them.','');
}

// THE HEAT REVEAL (Alyx, 28 Sep 2026; retimed 29 Sep: "It fades in to the
// picture and then give you time to read the picture. Then begin to swivel
// ... slowly ... stops on the punchline and give you time to read the
// punchline then it begins to fade to black"). Picking a design plays it on
// the 3D mug, about 22 seconds, then freezes until the next click:
//    0s    the mug, all black (cold), setup side facing, standing still
//    1s    "as the mug absorbs the liquid's heat" blinks under it
//    1.5s  the setup rises out of the black, the mug still
//    4.5s  the setup is full; the words go; time to read it
//    6s    it turns, slowly, half round
//   12.7s  it stops on the punchline; time to read it
//   16.7s  "then, as it cools down again" blinks; it fades back to black
//   19.7s  all black; the words stop blinking
//   20.7s  frozen
// A click on the mug plays it again; picking another design plays that one.
// The mug is the right-handed print on the Smart Mug's hot body (a white
// wall, black rim, inside and handle), cold at heat 0.
// THE POUR (Alyx, 3 Oct 2026): "We start off with still image of black mug.
// At 2 seconds in we superimpose the stream of coffee image over the plain
// black mug. The image begins to fade in ... stream withdraws simultaneous to
// mug beginning its spin. Takes 2 seconds to spin to other side. Stops. Image
// fully illustrated. Mug fades back to black." Timing his to tweak:
//   0s     the black mug, still
//   1.5s   the coffee pours in (art/surprise/pour.png, Bud's, over the mouth)
//   1.8s   the picture fades in, "as the mug absorbs the liquid's heat"
//   4.3s   the setup in full: the pour lifts away as the mug turns, 2s
//          (Alyx: no trace of the stream once the turn begins)
//   6.3s   stopped on the punchline; four seconds to read it
//  10.3s   "then, as it cools down again", back to black by 13.3s
const SURPRISE_REVEAL_T={pourIn:1500,words1:1800,heat:1800,full:4300,pourOut:4300,spin:4300,stop:6300,cool:10300,black:13300,frozen:14300};
// Where Bud's pour sits over the stage (a 4:3 box): its coffee surface on the
// cold mug's mouth, the stream coming in from above the top edge. Measured
// off the 960 x 720 stills: the mouth's centre (481, 136), 370 across.
// Each spot's own placement (Alyx, 3 Oct 2026: "Make that the demo for all"):
// the demonstrations' 4:3 boxes share one; a design's large mug is zoomed in a
// 16:10 box and has its own, measured off that mug.
const REVEAL_POUR_SRC='art/surprise/pour.png';
// The design's mug (zoom 1.4, a 960 x 600 box): the mouth's centre (480, 39),
// 435 across, its rim 21px under the top edge, so the stream shows short.
const REVEAL_POURS={how:{left:'5.9%',top:'-12.9%',width:'89.5%'},shelf:{left:'5.9%',top:'-12.9%',width:'89.5%'},
  design:{left:'-1.95%',top:'-38.4%',width:'105.2%'}};
function revealPour(spot,opacity){
  const S=REVEAL_SPOTS[spot]; const box=S&&document.getElementById(S.box); if(!box)return;
  const P=REVEAL_POURS[spot]||REVEAL_POURS.how;
  let im=box.querySelector('img.reveal-pour');
  if(!im){ if(!opacity)return;
    im=document.createElement('img'); im.className='reveal-pour'; im.alt=''; im.src=REVEAL_POUR_SRC;
    im.style.cssText='position:absolute;left:'+P.left+';top:'+P.top+';width:'+P.width+';height:auto;right:auto;bottom:auto;max-width:none;object-fit:fill;pointer-events:none;z-index:3;opacity:0;transition:none';
    box.appendChild(im); }
  im.style.opacity=String(opacity);
}
let surpriseRevealRun=0, surpriseRevealFile=null;
// Where it plays (Alyx, 28 Sep 2026: "this How it Works panel is the absolute
// best panel to do the three D carousel"): on the designs, the design picked;
// on How the magic mug works, SMART_HOW_FILE. One 3D mug at a time, so the two
// share the run count; only the designs' play is surpriseRevealFile.
const REVEAL_SPOTS={design:{stage:'surpriseRevealStage',words:'surpriseRevealWords',box:'surpriseReveal'},
  how:{stage:'smartHowRevealStage',words:'smartHowRevealWords',box:'smartHowReveal'},
  // The holiday shelf's How it works (Alyx, 3 Oct 2026: "all versions of the
  // tutorial to use the carousel"), playing the holiday's own demonstration mug.
  shelf:{stage:'premadesHowRevealStage',words:'premadesHowRevealWords',box:'premadesHowReveal'}};
// WHICH MUG DEMONSTRATES (Alyx, 3 Oct 2026: "so long as we can simply swap out
// mugs depending upon occasion"). A holiday names its own (SURPRISE_SETS[k].demo,
// else its first mug). The Smart Mug's demonstration follows the calendar:
// each line is a season, month-day to month-day, and its mug; outside them all,
// SMART_HOW_FILE. Swapping a season's mug is changing its line here.
const DEMO_SEASONS=[
  {from:'09-25',to:'10-31',file:'halloween-boo-ghost-one'},
  {from:'11-01',to:'11-30',file:'golden-brown'}
];
function smartHowFile(now){
  const d=now||new Date(), md=String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const s=DEMO_SEASONS.find(x=>md>=x.from&&md<=x.to);
  return s?s.file:SMART_HOW_FILE;
}
function holidayDemoFile(key){ const s=SURPRISE_SETS[key]; return s?(s.demo||(s.designs[0]&&s.designs[0].file)):null; }
function surpriseRevealWords(text,blink,spot){
  const w=document.getElementById(REVEAL_SPOTS[spot||'design'].words); if(!w)return;
  w.textContent=text||''; w.classList.toggle('smart-blink',!!blink);
}
function releaseSurpriseReveal(){
  surpriseRevealRun++; surpriseRevealFile=null; revealPour('design',0);
  surpriseRevealWords('',false);
  const st=document.getElementById('surpriseRevealStage');
  try{ if(st&&typeof MUG3D!=='undefined'&&MUG3D.mounted()&&MUG3D.host()===st)MUG3D.close(); }catch(e){}
}
function releaseHowReveal(spot){
  spot=spot||'how';
  revealPour(spot,0);
  surpriseRevealWords('',false,spot);
  const st=document.getElementById(REVEAL_SPOTS[spot].stage);
  try{ if(st&&typeof MUG3D!=='undefined'&&MUG3D.mounted()&&MUG3D.host()===st){ surpriseRevealRun++; MUG3D.close(); } }catch(e){}
}
// What each stage has painted, so a replay only restarts the clock: it
// used to open the cup again, reloading and repainting the picture first
// (Alyx, 29 Sep 2026: "it takes about 7 seconds before it even starts").
const revealPainted={};
function playSurpriseReveal(file,spot,url){
  spot=spot||'design'; const S=REVEAL_SPOTS[spot]; url=url||'art/surprise/reveal/'+file+'.jpg';
  const st=document.getElementById(S.stage);
  if(!st||!file||typeof MUG3D==='undefined'||(typeof mug3dFailed!=='undefined'&&mug3dFailed))return;
  const run=++surpriseRevealRun; if(spot==='design')surpriseRevealFile=file;
  const words=(text,blink)=>surpriseRevealWords(text,blink,spot);
  words('',false);
  const T=SURPRISE_REVEAL_T, ease=x=>{ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); };
  const clock=()=>{
    if(run!==surpriseRevealRun)return;
    MUG3D.setSpinning(false); MUG3D.setAngle(-90); MUG3D.setHeat(0);
    revealPour(spot,0);
    const t0=performance.now();
    const tick=()=>{
      if(run!==surpriseRevealRun)return;
      const t=performance.now()-t0;
      if(t<T.words1)words('',false);
      else if(t<T.full)words("as the mug absorbs the liquid's heat",true);
      else if(t<T.cool)words('',false);
      else if(t<T.black)words('then, as it cools down again',true);
      else words('then, as it cools down again',false);
      MUG3D.setAngle(-90+180*ease((t-T.spin)/(T.stop-T.spin)));
      const heat=t<T.cool?ease((t-T.heat)/(T.full-T.heat)):1-ease((t-T.cool)/(T.black-T.cool));
      MUG3D.setHeat(heat);
      revealPour(spot,Math.min(Math.max(0,Math.min(1,(t-T.pourIn)/300)),1-Math.max(0,Math.min(1,(t-T.pourOut)/400))));
      if(t<T.frozen)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if(MUG3D.mounted()&&MUG3D.host()===st&&revealPainted[S.stage]===url){ clock(); return; }
  revealPainted[S.stage]=null;
  // The picture is reveal/<file>.jpg, the print at two thirds size (about a
  // quarter of a megabyte) rather than the 2475 x 1155 print itself (two to
  // three and a half): the first play waited on that download, sometimes for
  // most of half a minute (Alyx, 29 Sep 2026). Made by tools/surprise/reveal-jpgs.py.
  MUG3D.open(st,Object.assign({},SHELF_MUG_3D,{panoramaUrl:url,panelUrls:[],
    startAngle:-90,restartOnView:false,turns:0,still:true,heat:0,onClick:()=>playSurpriseReveal(file,spot,url)}))
  .then(()=>{ if(run!==surpriseRevealRun)return; revealPainted[S.stage]=url; MUG3D.setZoom(spot==='design'&&typeof SURPRISE_MUG_ZOOM==='number'?SURPRISE_MUG_ZOOM:1); clock(); })
  .catch(err=>{ console.error('The heat reveal could not start:',err); const r=document.getElementById(S.box); if(r)r.style.display='none'; });
}
