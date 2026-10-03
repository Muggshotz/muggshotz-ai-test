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
  'thanksgiving':{label:'Thanksgiving',designs:[
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
  'halloween':{label:'Halloween',designs:[
    {key:'raise-the-dead',label:'Raise the Dead',file:'halloween-raise-the-dead'},
    // Boo (Bud, 26 Sep 2026): the ghost's face; turned round, the laundry tag.
    {key:'boo',label:'Boo',file:'halloween-boo'}
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

// How it works, step 4: the pictures there are Golden Brown, so the mug is;
// it holds on step 3's side, swivels half round in about a second, stops on
// the punchline, and plays again whenever it comes back into view.
const HOW_MUG_FILE='golden-brown';
// The Smart Mug's demonstration (How the magic mug works): a decal mug
// (Alyx, 29 Sep 2026: "swap this out for one of the new Decal designs").
const SMART_HOW_FILE='proposal';
const HOW_MUG_3D=Object.assign({},SHELF_MUG_3D,{spinStep:4,turns:0.5,easeOut:true,holdMs:900,replayOnView:true});
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
//    8s    it turns, slowly, half round
//   14s    it stops on the punchline; time to read it
//   18s    "then, as it cools down again" blinks; it fades back to black
//   21s    all black; the words stop blinking
//   22s    frozen
// A click on the mug plays it again; picking another design plays that one.
// The mug is the right-handed print on the Smart Mug's hot body (a white
// wall, black rim, inside and handle), cold at heat 0.
const SURPRISE_REVEAL_T={words1:1000,heat:1500,full:4500,spin:8000,stop:14000,cool:18000,black:21000,frozen:22000};
let surpriseRevealRun=0, surpriseRevealFile=null;
// Where it plays (Alyx, 28 Sep 2026: "this How it Works panel is the absolute
// best panel to do the three D carousel"): on the designs, the design picked;
// on How the magic mug works, SMART_HOW_FILE. One 3D mug at a time, so the two
// share the run count; only the designs' play is surpriseRevealFile.
const REVEAL_SPOTS={design:{stage:'surpriseRevealStage',words:'surpriseRevealWords',box:'surpriseReveal'},
  how:{stage:'smartHowRevealStage',words:'smartHowRevealWords',box:'smartHowReveal'}};
function surpriseRevealWords(text,blink,spot){
  const w=document.getElementById(REVEAL_SPOTS[spot||'design'].words); if(!w)return;
  w.textContent=text||''; w.classList.toggle('smart-blink',!!blink);
}
function releaseSurpriseReveal(){
  surpriseRevealRun++; surpriseRevealFile=null;
  surpriseRevealWords('',false);
  const st=document.getElementById('surpriseRevealStage');
  try{ if(st&&typeof MUG3D!=='undefined'&&MUG3D.mounted()&&MUG3D.host()===st)MUG3D.close(); }catch(e){}
}
function releaseHowReveal(){
  surpriseRevealWords('',false,'how');
  const st=document.getElementById('smartHowRevealStage');
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
