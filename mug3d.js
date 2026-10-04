// mug3d.js -- THE MUG THAT TURNS, shared by needles-studio.html and occasion.html
// (Alyx, 3 Oct 2026: the occasion site "should do the 3d carousel for coffee mugs").
// Moved verbatim out of needles-studio.html. A classic script: MUG3D, mug3dFailed and
// deviceHasWebGL are page globals, as they were. three.min.js loads lazily, relative
// to the page, so a page using this sits at the site root.

let mug3dFailed=false;
function deviceHasWebGL(){
  try{
    const c=document.createElement('canvas');
    return !!(c.getContext('webgl2')||c.getContext('webgl')||c.getContext('experimental-webgl'));
  }catch(e){ return false; }
}

// ================= THE MUG THAT TURNS =================
// Replaces the flat Printify photo for ceramic coffee mugs with a real 3D
// mug the customer can spin.
//
// WHY THIS EXISTS (Sep 2026, Alyx's direction). Two complaints met here:
// "I don't like these small filmstrip format of the mock up, I prefer a
// single large photo that you can click right or left on it to the next
// viewing angle", and, of the wait before that filmstrip appeared,
// "seems awfully slow". Printify's mockup is a set of fixed camera angles
// that takes up to sixty seconds of polling to arrive. This is one object,
// rendered locally, that turns to ANY angle and appears instantly.
//
// WHAT IS REAL HERE, and what is a model:
//   - The mug's proportions are a real 11oz/15oz mug.
//   - The handle's reach and vertical span were measured off the real
//     product photo (mug-classic-white-11oz.webp), not invented.
//   - The print wraps 8.25" of a 10.05" circumference -- Printify's actual
//     coverage -- so the bare strip either side of the handle is the real
//     one, and turning the mug past it shows bare mug, as it will in life.
//   - Every mug style is a WHITE exterior. Only the handle and interior
//     take the colour (Trimmed adds a coloured rim). That is not a guess:
//     see the GEN_MUG_STYLES note above citing Printify's own product page
//     for blueprint 1151 -- "a colored handle and interior".
//
// It does NOT replace Printify as the authority on what ships. The real
// mockup request still fires in the background, so a Printify-side failure
// still surfaces before checkout and the real photos are still available.
const MUG3D = (function(){
  'use strict';

  // Real mugs, in inches. wrapIn is how much of the circumference Printify
  // actually prints; the remainder is the bare strip at the handle.
  // A style's own band (22 Sep 2026). Color Burst prints a 4725 x 1725 area,
  // 2.74:1, on the same 11oz body; the wrap length is kept and the band is
  // shorter, so the strip's shape and the band's agree and paint() crops
  // nothing (see V323/V324 for why they must).
  const STYLE_BANDS = {
    'Color Burst': { wrapIn: 8.25, bandH: 3.01 }
  };
  function sizeForMug(opts){
    const base=SIZES[opts.sizeLabel]||SIZES['11oz'];
    const band=STYLE_BANDS[opts.styleName];
    return band ? Object.assign({},base,band) : base;
  }
  const SIZES = {
    // wrapIn 7.17, not Printify's 8.25 (V324): the strip is cut at
    // MUG_WRAP_RATIO (2.14) for both mugs, and the band must be that shape
    // or paint() crops it. 8.25 x 3.35 is 2.46, which trimmed the top and
    // bottom of every 11oz wrap and took the frame's rails with it. The
    // mug's height is measured and a 3.85in band will not fit under its
    // rim, so the band goes less far round instead: 71% of the way, a
    // wider bare strip at the handle. The 15oz already sits at 2.15.
    '11oz': { R:1.600, H:3.70, wrapIn:7.17, bandH:3.35 },
    '15oz': { R:1.675, H:4.36, wrapIn:8.50, bandH:3.95 },
    // The All-Nighter's 20oz jumbo (22 Sep 2026): 2700 x 1200 print, 2.25:1.
    // Not measured off a photo yet; proportions from the print area and the
    // listing's 20oz body.
    '20oz': { R:1.875, H:4.50, wrapIn:9.00, bandH:4.00 }   // height/width 1.30, measured off mug-cambridge-blue.jpg
  };

  let three=null, mounted=false, host=null;
  let renderer, scene, camera, mugGroup, printMesh, designTex, designCanvas;
  // The shared materials the current cup was built from. Kept so the body
  // colour can be changed later without rebuilding the scene: a white cup
  // has to go back to the SAME glazed white the mug uses, not a fresh
  // approximation of it.
  let baseMats=null;
  let bandStates=[];   // one {canvas, tex, aspect} per print band on a tumbler
  let spin=0, spinning=true, dragging=false, lookDown=false, rafId=0, visible=true;
  // THE SHELF'S MUG (Alyx, 27 Sep 2026: "a carousel that spins automatically"
  // ... "slightly faster for this display than it does for our mockups" ...
  // "a mug doesn't need to start spinning until you're looking at it ... that
  // way it always starts in the proper position"). Set per open: how far it
  // turns a frame, where it starts, and whether it goes back there each time
  // it comes into view. A mug counts as in view when most of it is on screen
  // (viewRatio), so it does not set off while the page is still scrolling to
  // it. The mockup's own opens pass none of these and keep 0.32, the first
  // sliver on screen, and no restart.
  let spinStep=0.32, startAngle=null, restartOnView=false, viewRatio=0.01, needsFrame=true;
  // ONE TURN AND STOP (Alyx, 27 Sep 2026: "only spin once and then stop ...
  // If you clicked on it again it could start spinning again. But once it
  // gets to the end nothing spins until something gets clicked on"). turns
  // is how many full turns a spin makes (0: for ever, the mockup's way);
  // travelled is how far this one has gone, and a finished spin waits for a
  // tap, which starts a new one.
  let turns=0, travelled=0, clickHandler=null;
  function spinDone(){ return turns>0 && travelled>=turns*360; }
  // HOW IT WORKS, STEP 4 (Alyx, 27 Sep 2026: "It starts off with the same
  // image as number three but then quickly swivels itself around to number 4
  // and stops"). holdMs: a beat on the start before the turn, so the setup is
  // seen first; easeOut: the turn slows into its stop; replayOnView: every
  // time it comes back into view it plays again from the start, finished or
  // not, and a click on a finished one does the same.
  let holdMs=0, holdUntil=0, easeOut=false, replayOnView=false;
  function replay(){ setSpin(startAngle); travelled=0; holdUntil=holdMs?performance.now()+holdMs:0; }
  // 1 = the framing every product photo here has used. Up to 4 for a close
  // look at the seam, done by narrowing the lens rather than moving in --
  // see placeCamera.
  let mug3dZoom=1;
  let onSpinChange=null;

  function reducedMotion(){
    try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  // three.js is 600KB. Nobody who never opens a mug mockup should pay for it,
  // so it is fetched the first time this is actually used and never again.
  let threePromise=null;
  function loadThree(){
    if(window.THREE) return Promise.resolve(window.THREE);
    if(threePromise) return threePromise;
    threePromise = new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='three.min.js';
      s.onload=()=>window.THREE?resolve(window.THREE):reject(new Error('three.js loaded but THREE is missing'));
      s.onerror=()=>reject(new Error('three.js could not be loaded'));
      document.head.appendChild(s);
    });
    return threePromise;
  }

  // A softbox studio, built on a canvas rather than downloaded.
  function studioEnv(THREE){
    const c=document.createElement('canvas'); c.width=1024; c.height=512;
    const g=c.getContext('2d');
    const sky=g.createLinearGradient(0,0,0,512);
    sky.addColorStop(0,'#f6f8fb'); sky.addColorStop(.48,'#ccd2dc');
    sky.addColorStop(.52,'#6f7681'); sky.addColorStop(1,'#2c313a');
    g.fillStyle=sky; g.fillRect(0,0,1024,512);
    const box=(cx,cy,w,h,a)=>{
      const gr=g.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h));
      gr.addColorStop(0,'rgba(255,255,255,'+a+')');
      gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr; g.save(); g.translate(cx,cy); g.scale(1,h/w); g.translate(-cx,-cy);
      g.fillRect(cx-w,cy-w,w*2,w*2); g.restore();
    };
    box(300,150,190,120,1); box(760,190,150,110,.62); box(520,60,300,90,.5);
    return c;
  }

  function outerProfile(THREE,S){
    const R=S.R, H=S.H, BASE=0.13, RIM=0.085;
    const p=[], V=THREE.Vector2;
    p.push(new V(0,0));
    p.push(new V(R-BASE,0));
    for(let i=0;i<=8;i++){ const t=i/8*Math.PI/2; p.push(new V(R-BASE+Math.sin(t)*BASE, BASE-Math.cos(t)*BASE)); }
    p.push(new V(R, H-RIM));           // the white stops at the top of the outer wall
    return p;
  }
  // THE RIM'S TOP FACE IS THE ACCENT (Sep 2026, Alyx, with the real photo
  // beside it: "the accent goes all the way around the top of the rim, not
  // just the edge of it"). The rim used to be a white arc with the colour
  // starting at the inner lip. Now this lathe begins where the white outer
  // wall ends, rolls over the whole top of the rim and carries on down the
  // inside, so the top face reads as one colour, as it does on the cup.
  function innerProfile(THREE,S){
    const R=S.R, H=S.H, RIM=0.085, WALL=0.17;
    const p=[], V=THREE.Vector2;
    const cx=R-WALL/2, r=WALL/2;       // a half-round rim, outer edge to inner edge
    for(let i=0;i<=12;i++){ const t=i/12*Math.PI; p.push(new V(cx+Math.cos(t)*r, H-RIM+Math.sin(t)*r)); }
    p.push(new V(R-WALL, WALL*1.5));
    p.push(new V(R-WALL-0.11, WALL*0.95));
    p.push(new V(0, WALL*0.95));
    return p;
  }
  // THE HANDLE IS THE PHOTO'S HANDLE (Sep 2026, Alyx: "our mugs don't have
  // triangular handles"). The first cut was six guessed points on a curve
  // and it came out angular. This is the real handle's centreline, traced
  // row by row off mug-classic-white-11oz.webp and expressed as fractions of
  // the mug's height (y) and radius (reach), so the same shape scales to the
  // 15oz. The top arm leaves the body nearly flat, sweeps out to 0.81R,
  // runs down the outside and curves back in low: a rounded D. Both ends
  // sit slightly INSIDE the body so the joins never show a gap.
  // AN EAR, NOT A LOOP (Alyx). The top arm leaves the body nearly flat and
  // stays high, the bulge sits in the upper half, and the bottom arm comes
  // back in steeper and lower. Reach 0.78R: the traced 0.815R pulled in 4%.
  // A SYMMETRICAL ARC (Sep 2026, Alyx: "take a horizontal cross section
  // through the centre of that arc and both hemispheres are identical").
  // Points every 15 degrees around a true ellipse: 0.366H tall (the top and bottom of
  // the ear pulled 3% up-and-out and down-and-out on Alyx's call, "a finger on the top of the ear and one on the
  // bottom, and pull"), centred at
  // 0.525H (the midpoint of the two attachments), the same above and below
  // the centre, with the apex pressed in to 0.77R so the arc runs flatter
  // either side of it (Alyx: "a metaphorical finger on the apex"). An inch
  // down from the top and an inch up from the bottom meet the handle at the
  // same distance from the wall.
  const HANDLE_PATH=[
    [0.895,-0.060],   // inside the body, just under the rim
    [0.879, 0.216],
    [0.842, 0.422],
    [0.784, 0.603],
    [0.708, 0.705],
    [0.620, 0.762],
    [0.525, 0.772],   // the apex, pressed in so the arc runs flat either side
    [0.430, 0.762],
    [0.342, 0.705],
    [0.266, 0.603],
    [0.208, 0.422],
    [0.171, 0.216],
    [0.155,-0.060]    // inside the body
  ];
  // A tube whose radius varies along its length, with material groups, so
  // the feet can flare AND be a different colour. three's TubeGeometry can do
  // neither, so this is the same construction with those two additions.
  function flaredTube(THREE,curve,segments,radial,radiusAt,whiteUntil){
    const frames=curve.computeFrenetFrames(segments,false);
    const pos=[],nrm=[],uv=[],idx=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments, P=curve.getPointAt(t), N=frames.normals[i], B=frames.binormals[i], r=radiusAt(t);
      for(let j=0;j<=radial;j++){
        const v=j/radial*Math.PI*2, sn=Math.sin(v), cs=-Math.cos(v);
        const nx=cs*N.x+sn*B.x, ny=cs*N.y+sn*B.y, nz=cs*N.z+sn*B.z;
        nrm.push(nx,ny,nz); pos.push(P.x+r*nx,P.y+r*ny,P.z+r*nz); uv.push(t,j/radial);
      }
    }
    for(let i=1;i<=segments;i++)for(let j=1;j<=radial;j++){
      const a=(radial+1)*(i-1)+(j-1), b=(radial+1)*i+(j-1), c=(radial+1)*i+j, d=(radial+1)*(i-1)+j;
      idx.push(a,b,d, b,c,d);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx);
    // feet white, middle the accent: three groups along the length
    const per=radial*6, nWhite=Math.round(whiteUntil*segments);
    g.addGroup(0, nWhite*per, 0);
    g.addGroup(nWhite*per, (segments-2*nWhite)*per, 1);
    g.addGroup((segments-nWhite)*per, nWhite*per, 0);
    return g;
  }
  // THE FEET FLARE, AND THEY ARE WHITE (Sep 2026, Alyx, with the real photo
  // beside it: "it should flare slightly towards the ends as it melds into
  // the cup ... the base of the flare is not painted, the accent begins
  // about halfway through the flare"). A constant-thickness tube looked
  // "extremely fragile and flimsy". Each foot swells to 1.7x the handle's
  // thickness over the last 18% of its length, and the colour starts
  // halfway up that swell.
  function handleGeo(THREE,S){
    const R=S.R, H=S.H;
    const pts=HANDLE_PATH.map(([yf,rf])=>new THREE.Vector3(0, yf*H, -(R+rf*R)));
    const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
    const rMid=R*0.092, FLARE=0.20, SWELL=0.65;   // the photo's 0.089R, feet swelling over the last 20%
    const ease=x=>x*x*(3-2*x);
    const radiusAt=t=>{
      const e=Math.min(t,1-t);
      const f=e<FLARE?ease(1-e/FLARE):0;
      return rMid*(1+SWELL*f);
    };
    return flaredTube(THREE,curve,140,24,radiusAt,FLARE*0.32);   // the colour reaches well into the flare
  }
  // Materials, per style. The body is white on every style; only the
  // handle, rim top and (except Trimmed) the inside take the colour.
  function makeMaterials(THREE,opts){
    const glaze={ roughness:0.16, metalness:0.0, clearcoat:0.85,
                  clearcoatRoughness:0.10, envMapIntensity:1.05 };
    const white=new THREE.MeshPhysicalMaterial(Object.assign({color:0xffffff, side:THREE.DoubleSide},glaze));
    const accentHex=opts.colorHex||'#ffffff';
    // The renderer lights in linear space and converts to sRGB on output,
    // so a hex passed straight in renders washed out -- Maroon #7A1F2B
    // came back pink. Convert it going in, and it is the colour it says.
    // Less clearcoat than the white: the broad sheen was washing a deep red
    // out to salmon against the real photo.
    const accent=new THREE.MeshPhysicalMaterial(Object.assign({},glaze,
      {color:new THREE.Color(accentHex).convertSRGBToLinear(), side:THREE.DoubleSide,
       clearcoat:0.35, roughness:0.30, envMapIntensity:0.55}));
    return {white,accent,glaze};
  }

  // The mug itself: outer wall, rim-top-and-inside, handle. One assembly
  // serves the spinning mockup and every still the picker draws.
  function assembleMug(THREE,S,opts,mats){
    const g=new THREE.Group();
    // COLOR BURST (22 Sep 2026): the first style whose colour is the body.
    const wholeBody=((opts.styleName||'')==='Color Burst');
    const outer=new THREE.Mesh(new THREE.LatheGeometry(outerProfile(THREE,S),160),wholeBody?mats.accent:mats.white);
    outer.castShadow=true; outer.receiveShadow=true; g.add(outer);
    // PER STYLE (Alyx, Sep 2026, definitive): "Trimmed -- think rimmed with a
    // T for tail: the entire rim is coloured and the tail is the handle.
    // Accented is only the inside, not the handle, not the rim, nothing on
    // the outside. Color Pop is all three."
    //   Classic White -- white throughout.
    //   Trimmed       -- whole rim + handle coloured; white inside.
    //   Accented      -- inside coloured; rim and handle white.
    //   Color Pop     -- inside, rim and handle coloured.
    // The rim and the inside are TWO lathes, not one with material groups:
    // a LatheGeometry lays its triangles out by angle, not by row, so a
    // group boundary meant for the lip landed around the circumference and
    // drew every Trimmed rim half white, half colour. Two surfaces, two
    // materials, no index arithmetic.
    const style=opts.styleName||'Classic White';
    const prof=innerProfile(THREE,S);
    const rimGeo=new THREE.LatheGeometry(prof.slice(0,13),160);      // the half-round rim
    const insideGeo=new THREE.LatheGeometry(prof.slice(12),160);     // inner wall and floor
    const rimMat   = (style==='Trimmed'||style==='Color Pop'||wholeBody) ? mats.accent : mats.white;
    const insideMat= (style==='Accented'||style==='Color Pop'||wholeBody) ? mats.accent : mats.white;
    const rim=new THREE.Mesh(rimGeo,rimMat); rim.receiveShadow=true; g.add(rim);
    const inside=new THREE.Mesh(insideGeo,insideMat); inside.receiveShadow=true; g.add(inside);
    const handleColoured=(style==='Trimmed'||style==='Color Pop'||wholeBody);
    const hand=new THREE.Mesh(handleGeo(THREE,S), wholeBody?[mats.accent,mats.accent]:(handleColoured?[mats.white,mats.accent]:[mats.white,mats.white]));
    hand.castShadow=true; hand.receiveShadow=true; g.add(hand);
    return g;
  }

  // ================= THE TUMBLERS (Sep 2026, Alyx: "Begin") =================
  // The three plain travel cups, traced off Printify's own product photos
  // (the Tundra's three-lid shot, the Gator bottle, the 20oz with its lid
  // off). Inches. What is measured: the print band, straight from each
  // blueprint's print area at 300 DPI. What is traced: the silhouette --
  // heights and radii read off the photo against the band's known height,
  // to be corrected by eye against a real cup, as the mug's handle was.
  //   Tundra 30oz  band 3634 x 1039 px = 12.11" x 3.46"
  //   Gator  32oz  band 3384 x 1937 px = 11.28" x 6.46"
  //   20oz         band 2795 x 2100 px =  9.32" x 7.00"
  // Each cup: a white body lathe, optional steel and lid parts, and a band
  // (rTop/rBot/h/y) the artwork wraps all the way round.
  const TUMBLERS = {
    'travel-mug-30oz-tundra': {
      totalH:7.55, maxR:1.86, bandR:1.80,
      band:{ rTop:1.80, rBot:1.80, h:3.46, y:4.80, wrapIn:12.11 },
      parts:[
        { mat:'body',  pts:()=>{
            const p=[[0,0],[1.20,0],[1.30,0.06],[1.30,0.30],[1.24,0.34]];
            // the ribbed lower section: five grooves cut into a 1.34 wall
            let y=0.40; p.push([1.34,y]);
            for(let i=0;i<5;i++){ p.push([1.34,y+0.16],[1.29,y+0.21],[1.29,y+0.31],[1.34,y+0.36]); y+=0.36; }
            p.push([1.34,2.30]);
            // the shoulder: an S from the narrow base to the wide upper wall
            for(let i=1;i<=8;i++){ const t=i/8, e=t*t*(3-2*t); p.push([1.34+(1.80-1.34)*e, 2.30+0.70*t]); }
            p.push([1.80,6.60]);
            return p; } },
        { mat:'steel', pts:()=>[[1.80,6.60],[1.80,7.05],[1.70,7.05],[1.70,6.62]] },
        { mat:'lid',   pts:()=>[[0,7.05],[1.86,7.05],[1.86,7.35],[1.78,7.46],[1.20,7.53],[0,7.55]] }
      ]
    },
    'travel-mug-32oz-gator': {
      totalH:9.40, maxR:1.72, bandR:1.70,
      band:{ rTop:1.70, rBot:1.70, h:6.46, y:3.62, wrapIn:11.28 },
      parts:[
        { mat:'body', pts:()=>{
            const p=[[0,0],[1.45,0]];
            for(let i=1;i<=6;i++){ const t=i/6*Math.PI/2; p.push([1.45+Math.sin(t)*0.25, 0.25-Math.cos(t)*0.25]); }
            p.push([1.70,6.90]);
            for(let i=1;i<=8;i++){ const t=i/8, e=t*t*(3-2*t); p.push([1.70-(1.70-1.22)*e, 6.90+0.80*t]); }
            p.push([1.22,7.75]);
            return p; } },
        { mat:'cap',  pts:()=>[[0,7.72],[1.30,7.72],[1.30,9.20],[1.22,9.34],[0.9,9.40],[0,9.40]] }
      ]
    },
    'travel-mug-20oz': {
      totalH:6.90, maxR:1.62, bandR:1.49,
      band:{ rTop:1.616, rBot:1.365, h:6.30, y:3.50, wrapIn:9.32 },
      parts:[
        { mat:'body',  pts:()=>[[0,0],[1.28,0],[1.36,0.08],[1.36,0.22],[1.62,6.75],[1.62,6.90]] },
        // the steel lip and the inside of an open cup
        { mat:'steel', pts:()=>[[1.62,6.75],[1.62,6.90],[1.50,6.90],[1.48,6.60],[1.30,0.45],[0,0.45]] }
      ]
    },
    // THE HANDLED CUPS (Alyx, Sep 2026: "let's just do the two remaining").
    // Traced off Printify's photos like the first three. A handle is a
    // rounded loop from y1 down to y0, standing `reach` off the wall, at
    // `angle` around the cup (0 faces the viewer, PI is the back).
    //   14oz handle   band 1995 x 930 px  = 6.65" x 3.10", ~64% of the way round
    //   40oz insulated (Brumate Era): two 3" x 4" panels, front and back
    //   40oz vacuum   band 3710 x 2817 px = 12.37" x 9.39", the whole body
    'travel-mug-14oz-handle': {
      totalH:7.02, maxR:1.66, bandR:1.65, snapAngle:-90,
      band:{ h:3.10, y:4.30, wrapIn:6.65 },
      handle:{ y0:3.00, y1:6.25, reach:1.15, r:0.16, angle:Math.PI, mat:'cap' },
      parts:[
        { mat:'steel', pts:()=>[[0,0],[1.26,0],[1.32,0.05],[1.32,0.50],[1.28,0.52]] },
        { mat:'body',  pts:()=>{
            const p=[[0,0.5],[1.30,0.5],[1.30,1.6]];
            for(let i=1;i<=8;i++){ const t=i/8, e=t*t*(3-2*t); p.push([1.30+(1.65-1.30)*e, 1.6+0.6*t]); }
            p.push([1.65,6.40]);
            return p; } },
        { mat:'steel', pts:()=>[[1.65,6.40],[1.66,6.56],[1.56,6.62],[0,6.62]] },
        { mat:'cap',   pts:()=>[[0,6.60],[1.58,6.60],[1.58,6.85],[1.45,6.98],[0.6,7.02],[0,7.02]] }
      ]
    },
    'travel-mug-40oz-insulated': {
      totalH:11.2, maxR:1.87, bandR:1.80, snapAngle:0,
      bands:[ { h:4.0, y:5.6, wrapIn:3.0, angle:0 }, { h:4.0, y:5.6, wrapIn:3.0, angle:Math.PI } ],
      handle:{ y0:5.0, y1:9.0, reach:1.35, r:0.18, angle:Math.PI/2, mat:'body' },
      straw:{ r:0.16, y0:9.85, y1:11.2, x:0.35, mat:'body' },
      parts:[
        { mat:'body', pts:()=>{
            const p=[[0,0],[1.30,0]];
            for(let i=1;i<=6;i++){ const t=i/6*Math.PI/2; p.push([1.30+Math.sin(t)*0.20, 0.20-Math.cos(t)*0.20]); }
            for(let i=1;i<=10;i++){ const t=i/10; p.push([1.50+(1.85-1.50)*Math.sin(t*Math.PI/2), 0.20+5.0*t]); }
            p.push([1.85,9.60]);
            return p; } },
        { mat:'body', pts:()=>[[0,9.60],[1.87,9.60],[1.87,9.85],[1.75,9.95],[0,9.95]] }
      ]
    },
    // THE HANDLE SITS OVER THE PRINT'S ENDS (4 Oct 2026). Printify's own
    // mockup of a numbered-stripe band puts this cup's handle on the line
    // where stripe 9 meets stripe 0: the band's two ends, which this model
    // closes at the back. It was drawn a quarter turn round, at the side,
    // so a picture turned to land the handle on screen landed it a quarter
    // turn away on the real cup (Alyx's sister's cup). Back at PI, opening
    // with the handle on the right, as the 14oz does.
    'travel-mug-40oz-vacuum': {
      totalH:12.0, maxR:1.96, bandR:1.85, snapAngle:-90,
      band:{ h:9.39, y:5.20, wrapIn:12.37 },
      handle:{ y0:5.30, y1:9.60, reach:1.50, r:0.19, angle:Math.PI, mat:'body' },
      straw:{ r:0.15, y0:10.5, y1:12.0, x:0, mat:'lid' },
      parts:[
        { mat:'body',  pts:()=>{
            const p=[[0,0],[1.35,0]];
            for(let i=1;i<=6;i++){ const t=i/6*Math.PI/2; p.push([1.35+Math.sin(t)*0.20, 0.20-Math.cos(t)*0.20]); }
            p.push([1.55,3.00]);
            for(let i=1;i<=8;i++){ const t=i/8, e=t*t*(3-2*t); p.push([1.55+(1.95-1.55)*e, 3.0+1.2*t]); }
            p.push([1.95,10.0]);
            return p; } },
        { mat:'steel',   pts:()=>[[1.95,10.0],[1.95,10.25],[1.86,10.28]] },
        { mat:'lidBlue', pts:()=>[[0,10.25],[1.92,10.25],[1.92,10.50],[1.80,10.60],[0.8,10.65],[0,10.65]] }
      ]
    },
    // THE BEER STEIN (22 Sep 2026, Alyx: "Why does a Stein not have the 3D
    // model?"). Blueprint 1088, not a travel cup, but the same engine: a
    // lathed white body, a band, a handle. Traced off Printify's straight-on
    // product photo (blueprint image 66d5b18e...): a plain wall between two
    // raised bead bands, a flared foot, gold lines on the rim and the foot
    // (Printify: "Gold-tone trim on rim and base"), a big D handle.
    // Scale: the photo gives proportions only. The band is sized from
    // Printify's own rendered mockup, where the print is ~1.12x the body's
    // diameter tall and runs round to the handle, and its length is the
    // print file's own 2175 x 863 (2.52:1), so paint() crops nothing. That
    // puts the print 90% of the way round, the gap at the handle.
    'beer-stein': {
      totalH:6.58, maxR:1.97, bandR:1.65,
      // fit:'contain' -- the stein prints through buildSingleImage in
      // api/create-printify-order.js, which fits the whole picture inside the
      // print area on white rather than cropping it. The band shows the same.
      band:{ h:3.70, y:2.95, wrapIn:9.325, fit:'contain' },
      // The bead rows on the two raised bands, as beads rather than a smooth
      // roll: [height, radius the beads sit at, bead size, beads round].
      beads:[[0.72,1.665,0.062,84],[0.88,1.665,0.062,84],[5.00,1.660,0.060,86],[5.14,1.660,0.060,86],
             [5.72,1.655,0.052,98],[5.85,1.655,0.052,98]],
      handle:{ angle:Math.PI, mat:'body', r:0.26,
        // [radius from the axis, height], the photo's handle centreline
        path:[[1.55,4.88],[2.47,4.83],[3.18,4.72],[3.49,3.58],[3.37,2.64],[2.90,1.84],[2.24,1.37],[1.55,1.20]] },
      parts:[
        { mat:'body', pts:()=>{
            const p=[[0,0],[1.88,0],[1.96,0.04],[1.97,0.12]];
            // the foot flares in to the lower bead band
            for(let i=1;i<=6;i++){ const t=i/6, e=t*t*(3-2*t); p.push([1.97-(1.97-1.75)*e, 0.12+0.21*t]); }
            // a bead band: a raised band, then a row of beads as a ridge
            const ridge=(r0,rTop,y0,y1)=>{ for(let i=0;i<=6;i++){ const t=i/6; p.push([r0+(rTop-r0)*Math.sin(t*Math.PI), y0+(y1-y0)*t]); } };
            p.push([1.75,0.61]); p.push([1.66,0.64]);
            ridge(1.66,1.675,0.66,0.94);
            p.push([1.65,0.99]);
            p.push([1.65,4.91]);                       // the plain wall the band prints on
            ridge(1.65,1.67,4.93,5.21);
            p.push([1.66,5.24]); p.push([1.76,5.28]); p.push([1.76,5.59]); p.push([1.66,5.63]);
            ridge(1.66,1.665,5.66,5.90);
            p.push([1.62,5.94]);
            p.push([1.57,6.50]);                       // the collar tapers a little to the rim
            p.push([1.555,6.56],[1.52,6.58],[1.47,6.565],[1.45,6.50]);   // over the rim
            p.push([1.43,0.50],[0,0.45]);              // the inside wall and floor
            return p; } },
        // The gold lines, laid a hair outside the glaze
        { mat:'gold', pts:()=>[[1.588,6.28],[1.590,6.31],[1.588,6.34]] },
        { mat:'gold', pts:()=>[[1.972,0.05],[1.976,0.08],[1.973,0.11]] }
      ]
    }
  };
  // The cup's outer radius at a height, read off its body profile, so a
  // band and a handle can follow a taper.
  function profileR(T,y){
    const body=T.parts.find(p=>p.mat==='body');
    const pts=body.pts();
    let best=pts[0][0];
    for(let i=0;i<pts.length-1;i++){
      const [r0,y0]=pts[i], [r1,y1]=pts[i+1];
      if(y1===y0)continue;
      if((y>=y0&&y<=y1)||(y>=y1&&y<=y0)){ const t=(y-y0)/(y1-y0); return r0+(r1-r0)*t; }
      if(y>y0&&y>y1)best=r1;
    }
    return best;
  }
  // A print band that follows the body: the profile sampled at even
  // heights, lathed just outside the wall, around the band's own share of
  // the circumference and centred on its angle. Even rows keep the texture's
  // v linear in height, so nothing stretches on a taper.
  function bandGeo(THREE,T,band){
    const rows=48, pts=[];
    const y0=band.y-band.h/2, y1=band.y+band.h/2;
    for(let i=0;i<=rows;i++){ const y=y0+(y1-y0)*i/rows; pts.push(new THREE.Vector2(profileR(T,y)+0.006, y)); }
    const R=profileR(T,band.y);
    const wrap=Math.min(1, band.wrapIn/(2*Math.PI*R));
    const start=(band.angle||0)-wrap*Math.PI;
    return new THREE.LatheGeometry(pts,200,start,wrap*2*Math.PI);
  }
  function tumblerBands(T){ return T.bands||[T.band]; }
  function hasTumbler(key){ return !!(key && TUMBLERS[key]); }
  // Which material a cup body wears, for one colour. White is the glazed
  // white the mug uses; Steel is bare metal; anything else is a powder coat
  // in that hex. Named because it is now used twice -- once when the cup is
  // built, and again whenever the colour changes under a cup already on
  // screen -- and the two must agree exactly or a recoloured white cup would
  // come back a slightly different white from a freshly built one.
  function bodyMaterialFor(THREE,mats,steel,hex,finish){
    if(finish==='steel')return steel;
    if(!hex||hex.toLowerCase()==='#ffffff')return mats.white;
    return new THREE.MeshPhysicalMaterial({color:new THREE.Color(hex).convertSRGBToLinear(), roughness:0.42, metalness:0.05, clearcoat:0.25, clearcoatRoughness:0.3, envMapIntensity:0.6, side:THREE.DoubleSide});
  }
  function tumblerMaterials(THREE,mats,opts){
    const steel=new THREE.MeshStandardMaterial({color:0xc9ced4, metalness:0.92, roughness:0.32, envMapIntensity:1.1, side:THREE.DoubleSide});
    const lid=new THREE.MeshPhysicalMaterial({color:0xdfe7f1, transparent:true, opacity:0.55, roughness:0.12, metalness:0.0, clearcoat:0.6, envMapIntensity:1.0, side:THREE.DoubleSide, depthWrite:false});
    const cap=new THREE.MeshPhysicalMaterial({color:0x0a0b0d, roughness:0.6, metalness:0.0, clearcoat:0.1, envMapIntensity:0.35, side:THREE.DoubleSide});
    const lidBlue=new THREE.MeshPhysicalMaterial({color:0x8fb4ff, transparent:true, opacity:0.6, roughness:0.15, metalness:0.0, clearcoat:0.5, envMapIntensity:0.9, side:THREE.DoubleSide, depthWrite:false});
    // The stein's gold lines.
    const gold=new THREE.MeshStandardMaterial({color:new THREE.Color('#d4a73c').convertSRGBToLinear(), metalness:1.0, roughness:0.28, envMapIntensity:1.2, side:THREE.DoubleSide});
    // THE CUP'S OWN COLOUR (Alyx, v101). White is the glazed white the mug
    // uses; Steel is bare metal; anything else is a powder coat in that hex.
    const body=bodyMaterialFor(THREE,mats,steel,(opts&&opts.colorHex)||'#ffffff',opts&&opts.finish);
    return { body, steel, lid, lidBlue, cap, gold };
  }
  function assembleTumbler(THREE,T,mats,opts){
    const g=new THREE.Group();
    const tm=tumblerMaterials(THREE,mats,opts);
    T.parts.forEach(part=>{
      const pts=part.pts().map(([r,y])=>new THREE.Vector2(r,y));
      const m=new THREE.Mesh(new THREE.LatheGeometry(pts,160),tm[part.mat]);
      const clear=(part.mat==='lid'||part.mat==='lidBlue');
      m.castShadow=!clear; m.receiveShadow=true;
      if(clear)m.renderOrder=2;
      g.add(m);
    });
    if(T.handle){
      // A rounded loop, drawn at the back and turned to its angle. The
      // ends sit just inside the wall so the joins never show.
      // A handle traced off a photo brings its own path (the stein's), and
      // swells at the feet the way the mug's does.
      const h=T.handle;
      let path, radiusAt=()=>h.r;
      if(h.path){
        path=h.path;
        const ease=x=>x*x*(3-2*x);
        radiusAt=t=>{ const e=Math.min(t,1-t); return h.r*(1+0.45*(e<0.15?ease(1-e/0.15):0)); };
      } else {
        const Rt=profileR(T,h.y1), Rb=profileR(T,h.y0), ym=(h.y0+h.y1)/2;
        path=[[Rt-0.08,h.y1],[Rt+h.reach*0.55,h.y1+0.02],[Rt+h.reach,h.y1-0.25],[Rt+h.reach,ym],[Rb+h.reach,h.y0+0.25],[Rb+h.reach*0.55,h.y0-0.02],[Rb-0.08,h.y0]];
      }
      const curve=new THREE.CatmullRomCurve3(path.map(([x,y])=>new THREE.Vector3(0,y,-x)),false,'centripetal');
      const mat=tm[h.mat]||tm.body;
      const hand=new THREE.Mesh(flaredTube(THREE,curve,120,20,radiusAt,0),[mat,mat]);
      hand.rotation.y=h.angle+Math.PI;
      hand.castShadow=true; hand.receiveShadow=true;
      g.add(hand);
    }
    if(T.beads){
      // One instanced mesh per row: a hundred-odd beads for the cost of one draw.
      const m4=new THREE.Matrix4();
      T.beads.forEach(([y,r,size,n])=>{
        const beads=new THREE.InstancedMesh(new THREE.SphereGeometry(size,10,8),tm.body,n);
        for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; m4.makeTranslation(Math.sin(a)*r,y,Math.cos(a)*r); beads.setMatrixAt(i,m4); }
        beads.receiveShadow=true;
        g.add(beads);
      });
    }
    if(T.straw){
      const st=T.straw;
      const straw=new THREE.Mesh(new THREE.CylinderGeometry(st.r,st.r,st.y1-st.y0,24),tm[st.mat]||tm.body);
      straw.position.set(st.x||0,(st.y0+st.y1)/2,0);
      straw.castShadow=true;
      g.add(straw);
    }
    g.userData.tumblerMats=tm;
    return g;
  }
  // The stand-in for SIZES on a tumbler: what the camera, the floor shadow
  // and the band need to know.
  function tumblerSize(T){
    const b0=tumblerBands(T)[0];
    return { R:T.maxR, H:T.totalH, wrapIn:b0.wrapIn, bandH:b0.h, band:b0, tumbler:true };
  }

  // THE SUITCASE (Alyx, 25 Sep 2026: "Where is my carousel? ... I want every
  // item that can go on a carousel eventually be on a carousel"). Not a body
  // of revolution, so not a lathe: a rounded hard shell traced off Printify's
  // straight-on photo of blueprint 624 -- a white spinner with black corner
  // guards at the front's top corners, a dark seam round the middle, two
  // latches on one side, four spinner wheels, a black telescoping handle and
  // a carry handle on top. Drawn at about 0.4 scale so the cups' key light and
  // shadow box, which are sized for a cup, light it the same way.
  // The print is the front face, full bleed inside the rim, as Printify
  // renders it: the design paints portrait (1024 x 1536) and paint() crops it
  // to the face's own proportion (2:3, near enough).
  const BOXES = {
    // THE REAL CASE'S SHAPE (Alyx, 30 Sep 2026: "You need to look at the
    // actual mockup images for the suitcases"). Printify's photos of blueprint
    // 624: a white polycarbonate FRONT that carries the print and a black ABS
    // BACK (their description: "polycarbonate front and ABS back hard-shell"),
    // with the telescoping handle's housing on the back. The front is as wide
    // as Printify's print area is -- 5433 x 7323 on the Small, about 0.74 wide
    // for 1 tall -- so the face is that shape and the design is not cropped
    // at its sides. It was 6.2 wide with a 0.65 face, which cut the edges off.
    'suitcase': {
      w:6.68, h:9.0, d:3.9, r:0.75,    // the shell: width, height, depth, corner radius
      bevel:0.42,                       // how far the shell's edges round off
      face:{ w:5.84, h:7.87, r:0.5 },   // the printed front: the flat of the face, inside the rounding, the print area's shape
      wheel:{ r:0.40, t:0.30, inset:0.55 },
      grip:{ w:3.0, h:0.42, d:0.5, rods:1.15, rodR:0.11, up:3.0 },
      latches:[0.30,0.66],              // the two side latches, as fractions of the height
      snapAngle:-30
    }
  };
  function hasBox(key){ return !!(key && BOXES[key]); }
  function boxSize(B){
    const lift=B.wheel.r*2;
    // H frames the shell with the handle up; tumbler:true takes the square
    // stage and the closer camera the cups use.
    return { R:B.w/2, H:lift+B.h+2.6, wrapIn:B.face.w, bandH:B.face.h, tumbler:true, box:true, lift };
  }
  function roundedRect(THREE,w,h,r){
    const sh=new THREE.Shape(); const x=-w/2, y=-h/2;
    sh.moveTo(x+r,y); sh.lineTo(x+w-r,y); sh.quadraticCurveTo(x+w,y,x+w,y+r);
    sh.lineTo(x+w,y+h-r); sh.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    sh.lineTo(x+r,y+h); sh.quadraticCurveTo(x,y+h,x,y+h-r);
    sh.lineTo(x,y+r); sh.quadraticCurveTo(x,y,x+r,y);
    return sh;
  }
  // A ShapeGeometry's UVs are the shape's own coordinates; the print wants 0..1.
  function normalizeUv(geo){
    geo.computeBoundingBox();
    const bb=geo.boundingBox, uv=geo.attributes.uv, pos=geo.attributes.position;
    for(let i=0;i<uv.count;i++)
      uv.setXY(i,(pos.getX(i)-bb.min.x)/(bb.max.x-bb.min.x),(pos.getY(i)-bb.min.y)/(bb.max.y-bb.min.y));
    uv.needsUpdate=true;
    return geo;
  }
  function assembleBox(THREE,B,mats,opts){
    const g=new THREE.Group();
    const black=new THREE.MeshPhysicalMaterial({color:0x101214, roughness:0.55, metalness:0.05, clearcoat:0.15, envMapIntensity:0.4, side:THREE.DoubleSide});
    const seam=new THREE.MeshPhysicalMaterial({color:0x2a2d31, roughness:0.7, metalness:0.0, envMapIntensity:0.3, side:THREE.DoubleSide});
    const lift=B.wheel.r*2, cy=lift+B.h/2, top=lift+B.h;
    const rounded=(w,h,r,depth,bevel)=>new THREE.ExtrudeGeometry(roundedRect(THREE,w,h,r),
      bevel?{depth, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:8, curveSegments:24}
           :{depth, bevelEnabled:false, curveSegments:24});
    // The shell, in its two halves: the white front that takes the print and
    // the black back. Each is a rounded rectangle extruded to half the depth,
    // its edges rounded off by the bevel (which adds the bevel back on every
    // side); where the two roundings meet in the middle, the zip band covers.
    const depth=B.d-2*B.bevel, half=depth/2;
    const halfGeo=()=>rounded(B.w-2*B.bevel,B.h-2*B.bevel,Math.max(0.05,B.r-B.bevel),half,B.bevel);
    const front=new THREE.Mesh(halfGeo(),mats.white);
    front.position.set(0,cy,0);
    const backShell=new THREE.Mesh(halfGeo(),black);
    backShell.position.set(0,cy,-half);
    [front,backShell].forEach(m=>{ m.castShadow=true; m.receiveShadow=true; g.add(m); });
    // The zip band where the two halves meet, wide enough to hide both roundings.
    const bandD=2*B.bevel+0.12;
    const ring=new THREE.Mesh(rounded(B.w+0.05,B.h+0.05,B.r+0.02,bandD,0),seam);
    ring.position.set(0,cy,-bandD/2);
    g.add(ring);
    // Four spinner wheels on their forks.
    const wheelGeo=new THREE.CylinderGeometry(B.wheel.r,B.wheel.r,B.wheel.t,28);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      const x=sx*(B.w/2-B.wheel.inset), z=sz*(B.d/2-0.35);
      const wh=new THREE.Mesh(wheelGeo,black);
      wh.rotation.z=Math.PI/2; wh.position.set(x,B.wheel.r,z); wh.castShadow=true; g.add(wh);
      const fork=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.45,0.6),black);
      fork.position.set(x,lift-0.12,z); g.add(fork);
    });
    // The telescoping handle at the back, and its grip.
    const G=B.grip, rz=-B.d/2+0.55;
    [-1,1].forEach(sx=>{
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(G.rodR,G.rodR,G.up,16),black);
      rod.position.set(sx*G.rods,top+G.up/2,rz); rod.castShadow=true; g.add(rod);
    });
    const grip=new THREE.Mesh(rounded(G.w-0.24,G.h-0.24,0.09,G.d-0.24,0.12),black);
    grip.position.set(0,top+G.up,rz-(G.d-0.24)/2); grip.castShadow=true; g.add(grip);
    // The carry handle on top, on two posts.
    const carry=new THREE.Mesh(rounded(1.6,0.26,0.1,0.34,0.06),black);
    carry.position.set(0,top+0.44,-0.17); carry.castShadow=true; g.add(carry);
    [-0.62,0.62].forEach(x=>{
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.4,12),black);
      post.position.set(x,top+0.2,0); g.add(post);
    });
    // Black guards on the front's top corners, set into the rounding.
    [-1,1].forEach(sx=>{
      const guard=new THREE.Mesh(rounded(1.0,1.0,0.3,0.5,0),black);
      guard.position.set(sx*(B.w/2-0.6),top-0.6,B.d/2-0.42);
      g.add(guard);
    });
    // Two latches on the left side.
    B.latches.forEach(f=>{
      const latch=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.85,0.55),black);
      latch.position.set(-B.w/2+0.02,lift+B.h*f,0.1); g.add(latch);
    });
    g.userData.tumblerMats=null;
    return g;
  }

  // The studio: environment light, a key light with shadows, a contact
  // shadow under the mug and a floor to catch the key's shadow. The
  // environment map is built once per renderer and reused.
  function dressScene(THREE,rend,scene,S){
    if(!rend.__studioEnv){
      const pmrem=new THREE.PMREMGenerator(rend);
      pmrem.compileEquirectangularShader();
      const envTex=new THREE.CanvasTexture(studioEnv(THREE));
      envTex.mapping=THREE.EquirectangularReflectionMapping;
      rend.__studioEnv=pmrem.fromEquirectangular(envTex).texture;
    }
    scene.environment=rend.__studioEnv;
    const key=new THREE.DirectionalLight(0xffffff,1.5);
    key.position.set(-3.2,5.4,4.2);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-4; key.shadow.camera.right=4;
    key.shadow.camera.top=4; key.shadow.camera.bottom=-4;
    key.shadow.bias=-0.0012;
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff,0.22));
    const sc=document.createElement('canvas'); sc.width=sc.height=256;
    const g2=sc.getContext('2d');
    const gr=g2.createRadialGradient(128,128,10,128,128,124);
    gr.addColorStop(0,'rgba(20,26,36,.40)');
    gr.addColorStop(.55,'rgba(20,26,36,.15)');
    gr.addColorStop(1,'rgba(20,26,36,0)');
    g2.fillStyle=gr; g2.fillRect(0,0,256,256);
    const contact=new THREE.Mesh(
      new THREE.PlaneGeometry(S.R*4.4,S.R*4.4),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));
    contact.rotation.x=-Math.PI/2; contact.position.y=0.003; scene.add(contact);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),
      new THREE.ShadowMaterial({opacity:0.17}));
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  }

  function build(THREE,opts){
    const B=hasBox(opts.boxKey)?BOXES[opts.boxKey]:null;
    const T=(!B&&hasTumbler(opts.tumblerKey))?TUMBLERS[opts.tumblerKey]:null;
    const S=B?boxSize(B):T?tumblerSize(T):sizeForMug(opts);
    // A tumbler's band goes all the way round; a mug's stops at the handle.
    const wrap=T?1:S.wrapIn/(2*Math.PI*S.R);

    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputEncoding=THREE.sRGBEncoding;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=0.92;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene=new THREE.Scene();
    scene.background=new THREE.Color('#f2f4f7');
    camera=new THREE.PerspectiveCamera(9,4/3,0.1,400);
    dressScene(THREE,renderer,scene,S);

    const mats=makeMaterials(THREE,opts);
    baseMats=mats;
    mugGroup=B?assembleBox(THREE,B,mats,opts):T?assembleTumbler(THREE,T,mats,opts):assembleMug(THREE,S,opts,mats); scene.add(mugGroup);

    // POWER OF TWO, ALWAYS (Alyx, v104: "little tiny white strings"). A
    // tumbler's texture used to be cut to the band's own proportions,
    // 2048 x 585 for the Tundra, and a texture that is not a power of two
    // loses its mipmaps on some graphics stacks: fine bright detail then
    // sparkles into dotted threads as it is shrunk onto the band. The
    // canvas is 2048 x 1024 for every band; the band's proportions are
    // applied by paint() when it crops, and the wrap's UVs stretch the
    // picture back to true on the cup.
    // 4096 ACROSS (Alyx, Sep 2026): "little black snowy fingers dancing around
    // the picture as it's spinning, fading in and out, sizzling vaguely."
    //
    // A trimming is a THIN VERTICAL STRIPE of high-contrast detail -- lace,
    // sprocket holes, stitching -- and horizontal texel density is the only
    // thing that resolves it. At 2048 across, a 186px trimming on a 3710px wrap
    // landed on about 103 texels, right at the sampling limit, so it shimmered
    // between mip levels as the cup turned. Doubling the width doubles exactly
    // the axis that was short. Height is untouched: the detail runs the other
    // way, and this keeps the texture at 16MB rather than 32.
    const makeTex=(aspect)=>{
      const canvas=document.createElement('canvas');
      canvas.width=4096; canvas.height=1024;
      const tex=new THREE.CanvasTexture(canvas);
      tex.encoding=THREE.sRGBEncoding;
      tex.generateMipmaps=true;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
      return {canvas,tex,aspect};
    };
    bandStates=[];
    if(B){
      // The printed face: a flat rounded rectangle a hair in front of the
      // shell's front, wearing the design cropped to its own proportion.
      const st=makeTex(B.face.w/B.face.h);
      st.fit='cover';
      const mesh=new THREE.Mesh(normalizeUv(new THREE.ShapeGeometry(roundedRect(THREE,B.face.w,B.face.h,B.face.r),24)),
        new THREE.MeshPhysicalMaterial(Object.assign({map:st.tex, side:THREE.FrontSide, transparent:true,
          polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4},mats.glaze)));
      mesh.position.set(0,S.lift+B.h/2,B.d/2+0.012);
      mesh.receiveShadow=true;
      mugGroup.add(mesh);
      bandStates.push(st);
      designCanvas=st.canvas; designTex=st.tex; printMesh=null;
    } else if(T){
      // Every band a tumbler has (one, or front and back), each following
      // the body's own taper.
      tumblerBands(T).forEach(band=>{
        const st=makeTex(band.wrapIn/band.h);
        st.fit=band.fit||'cover';
        const mesh=new THREE.Mesh(bandGeo(THREE,T,band),
          new THREE.MeshPhysicalMaterial(Object.assign({map:st.tex, side:THREE.FrontSide, transparent:true,
            // The other half of the fix, and the one that does not depend on
            // how many depth bits the device happens to give us: bias the band
            // toward the camera in depth space so it wins the test outright,
            // whatever the buffer's precision. Costs nothing and cannot be
            // defeated by a phone with a shallow depth buffer.
            polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4},mats.glaze)));
        mesh.receiveShadow=true;
        mugGroup.add(mesh);
        bandStates.push(st);
      });
      designCanvas=bandStates[0].canvas; designTex=bandStates[0].tex; printMesh=null;
    } else {
      // The band's own proportion, not a round number. The strip is cut at
      // MUG_WRAP_RATIO (2.14) and the 15oz band is 8.50/3.95 (2.15); a 2.0
      // texture made paint() cover-crop ~3.5% off each end, which is exactly
      // where the thin frame's verticals live. Print path is unaffected.
      const st=makeTex(S.wrapIn/S.bandH);
      designCanvas=st.canvas; designTex=st.tex; bandStates.push(st);
      printMesh=new THREE.Mesh(
        new THREE.CylinderGeometry(S.R+0.004,S.R+0.004,S.bandH,200,1,true,
          -wrap*Math.PI, wrap*2*Math.PI),
        new THREE.MeshPhysicalMaterial(Object.assign(
          {map:designTex, side:THREE.FrontSide, transparent:true,
           polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4},mats.glaze))
      );
      printMesh.position.y=S.H/2;   // a CylinderGeometry is centred on its position
      printMesh.receiveShadow=true;
      mugGroup.add(printMesh);
    }

    scene.userData.S=S;
    placeCamera();
    resize();
  }

  // A STILL OF ANY MUG, DRAWN ONCE AND KEPT (Sep 2026, Alyx: "take a stock,
  // standard image of one of each and use those exact same images to
  // generate all the different colour variants, in real time"). This is the
  // picker's supply of mug pictures now: size, style and colour in, one
  // PNG out, from the same model as the spinning mockup. One offscreen
  // renderer serves every still (WebGL contexts are scarce); the camera is
  // fixed at the same distance for both sizes so an 11oz and a 15oz side by
  // side are honestly different sizes, which the old photos never were.
  let snapRenderer=null;
  const snapCache=new Map();
  function snapshot(opts){
    const px=opts.px||560;
    const Bq=hasBox(opts.boxKey)?BOXES[opts.boxKey]:null;
    const Tq=(!Bq&&hasTumbler(opts.tumblerKey))?TUMBLERS[opts.tumblerKey]:null;
    const Q=Bq||Tq;
    const angle=(opts.angle==null)?((Q&&Q.snapAngle!=null)?Q.snapAngle:-90):opts.angle;      // handle to the right
    const el=(opts.el==null)?0.18:opts.el;               // a little above
    const key=[opts.boxKey||'',opts.tumblerKey||'',opts.finish||'',opts.sizeLabel,opts.styleName,opts.colorHex,angle,el,px,opts.background||'#ffffff'].join('|');
    if(snapCache.has(key))return snapCache.get(key);
    const pr=loadThree().then(THREE=>{
      if(!snapRenderer){
        snapRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
        snapRenderer.setPixelRatio(1);
        snapRenderer.outputEncoding=THREE.sRGBEncoding;
        snapRenderer.toneMapping=THREE.ACESFilmicToneMapping;
        snapRenderer.toneMappingExposure=0.92;
        snapRenderer.shadowMap.enabled=true;
        snapRenderer.shadowMap.type=THREE.PCFSoftShadowMap;
      }
      snapRenderer.setSize(px,px,false);
      const B=hasBox(opts.boxKey)?BOXES[opts.boxKey]:null;
      const T=(!B&&hasTumbler(opts.tumblerKey))?TUMBLERS[opts.tumblerKey]:null;
      const S=B?boxSize(B):T?tumblerSize(T):sizeForMug(opts);
      const sc=new THREE.Scene();
      sc.background=new THREE.Color(opts.background||'#ffffff');
      dressScene(THREE,snapRenderer,sc,S);
      const mats=makeMaterials(THREE,opts);
      const g=B?assembleBox(THREE,B,mats,opts):T?assembleTumbler(THREE,T,mats,opts):assembleMug(THREE,S,opts,mats);
      g.rotation.y=angle*Math.PI/180;
      sc.add(g);
      const cam=new THREE.PerspectiveCamera(9,1,0.1,400);
      // Fixed distance for both sizes: 43" back, which at 9 degrees frames
      // the 15oz with its handle and leaves the 11oz honestly smaller.
      // The tumblers share one distance too, 66" back, so the 9.4" Gator
      // fills its tile and the 20oz is honestly the small one.
      // The tumblers share one distance, 80" back, so the 12" Stanley fits
      // its tile and the 20oz is honestly the small one.
      const d=B?100:T?80:43, lookY=S.H*0.5, lookX=(T||B)?0:S.R*0.42;
      cam.position.set(lookX, lookY+Math.sin(el)*d, Math.cos(el)*d);
      cam.lookAt(lookX,lookY,0);
      snapRenderer.render(sc,cam);
      const url=snapRenderer.domElement.toDataURL('image/png');
      g.traverse(o=>{ if(o.geometry)o.geometry.dispose(); });
      mats.white.dispose(); mats.accent.dispose();
      if(g.userData.tumblerMats){ const tm=g.userData.tumblerMats; tm.steel.dispose(); tm.lid.dispose(); tm.cap.dispose(); }
      return url;
    });
    snapCache.set(key,pr);
    pr.catch(()=>snapCache.delete(key));
    return pr;
  }

  function placeCamera(){
    const S=scene.userData.S;
    // A long lens from well back (Alyx: "why does the image taper?"). The
    // first cut was a 28-degree lens from three mug-heights away -- a phone
    // snap. At that range the front of the mug is 1.6" nearer than its sides
    // on a 12" shot, so the artwork drew ~15% taller at the front: a
    // rectangle bulging into a barrel. Alyx, an artist, called the size of
    // it, and he was right. This is a 9-degree lens from ten mug-heights
    // back, which is roughly a studio shot from four feet: about 4%, which
    // is what a real product photo carries.
    // A tumbler has no handle to leave room for and sits in a square stage,
    // so it is framed closer: about 80% of the height (v103).
    const d=S.H*(S.tumbler?8.0:10.5);   // ~39" from an 11oz: a studio distance
    const el=lookDown?0.40:0.10;
    const lookY=S.H*0.47;
    camera.position.set(0, lookY+Math.sin(el)*d, Math.cos(el)*d);
    camera.lookAt(0,lookY,0);
    // ZOOM BY NARROWING THE LENS, NEVER BY MOVING IN (Alyx asked to be able to
    // get closer to the seam). Walking the camera forward would undo the whole
    // reason it is out at ten mug-heights: at close range the front of the cup
    // is enough nearer than its sides that the artwork draws ~15% taller in the
    // middle, and a rectangle bulges into a barrel -- the taper Alyx spotted
    // and this distance was chosen to cure. Narrowing the field of view is a
    // telephoto zoom: it magnifies and leaves the perspective exactly where it
    // was, so a seam inspected at 4x is the same shape as the one that prints.
    camera.fov=9/mug3dZoom;
    // NEAR AND FAR, WRAPPED TIGHT AROUND THE CUP (Alyx, on his phone: "the
    // sparks always come in the exact same color as the underlying mug... it's
    // like the color underneath is trying to show through and it's fighting
    // it"). That is a literal description of Z-FIGHTING, and it was the answer
    // all along -- not the texture, which is where three rounds of filtering
    // went.
    //
    // The printed band is a separate surface sitting 0.006 off the body. The
    // camera ran near 0.1 / far 400 from about fifty units back, and a depth
    // buffer spends nearly all its precision just in front of the near plane.
    // A desktop's 24-bit buffer still resolves 0.006 at that range; a phone
    // commonly gets SIXTEEN bits, where the smallest gap it can tell apart out
    // there is hundreds of times larger. So on a phone the band and the body
    // are in the same place as far as the depth test is concerned, and they
    // trade pixels as the cup turns -- speckles and short lines, in the body's
    // own colour, moving. Which is exactly what he described, and why nothing
    // done to the texture ever touched it.
    //
    // Pulling the planes in around the cup is the cheap half of the fix: the
    // same buffer now spends its whole range on the few units that matter.
    camera.near=Math.max(0.1,d*0.4);
    camera.far=d*3;
    camera.updateProjectionMatrix();
  }

  function setZoom(z){
    mug3dZoom=Math.max(1,Math.min(4,z));
    placeCamera();
  }

  function resize(){
    if(!renderer||!host)return;
    const w=host.clientWidth||640;
    const h=host.clientHeight||Math.round(w*0.75);
    // SAMPLE A SMALL CUP HARDER (Alyx, on his phone). The cap was a flat 2,
    // which is right for a 640px stage on a desktop and wrong for a 300px one
    // on a phone: a phone screen is usually 3x, so the cup was being drawn at
    // two thirds of the resolution the screen can actually show -- fewer
    // samples across the very stripe that shimmers. Below roughly 420px the
    // whole canvas is small enough that 3x costs a modern phone nothing, and
    // more samples is the most direct answer there is to aliasing.
    const cap=(w*h<=420*420)?3:2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,cap));
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }

  // The artwork, laid into the printable band exactly as Printify lays it:
  // the file fills the print area, and whatever does not fit is cropped
  // rather than letterboxed, so the customer never sees a white bar that
  // will not be on the mug.
  function paint(img,idx){
    const st=bandStates[idx||0];
    if(!st)return;
    const W=st.canvas.width, Hc=st.canvas.height;
    const g=st.canvas.getContext('2d');
    g.clearRect(0,0,W,Hc);
    if(img && st.fit==='contain'){
      // The whole picture, fitted inside the band on white, as it prints.
      // The canvas is stretched back to the band's shape by the UVs, so the
      // fit is worked in band units and then scaled to the canvas.
      const want=st.aspect||(W/Hc), have=img.width/img.height;
      const fw=have>want?1:have/want, fh=have>want?want/have:1;
      const dw=Math.round(W*fw), dh=Math.round(Hc*fh);
      g.fillStyle='#ffffff'; g.fillRect(0,0,W,Hc);
      g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
      g.drawImage(img,Math.round((W-dw)/2),Math.round((Hc-dh)/2),dw,dh);
    } else if(img){
      // The crop follows the BAND's proportions, not the canvas's.
      const want=st.aspect||(W/Hc), have=img.width/img.height;
      let sw,sh,sx,sy;
      if(have>want){ sh=img.height; sw=sh*want; sx=(img.width-sw)/2; sy=0; }
      else { sw=img.width; sh=sw/want; sx=0; sy=(img.height-sh)/2; }
      // HALVED DOWN, NOT DROPPED DOWN (Alyx, Sep 2026): "little tiny fingers...
      // it only happens when it's spinning."
      //
      // One drawImage from 2817 rows to 1024 samples roughly every third row and
      // throws the rest away, so fine horizontal detail -- a lace scallop, a
      // sprocket hole -- lands or misses depending on where it happens to fall.
      // That is decided before the GPU ever sees the texture, so no amount of
      // mipmapping or anisotropy can undo it, and as the cup turns the aliased
      // detail crawls. Halving repeatedly averages every source pixel in
      // instead, which is what a mipmap chain does and what this was missing.
      let srcImg=img, sx0=sx, sy0=sy, sw0=sw, sh0=sh;
      while(sw0>W*2 || sh0>Hc*2){
        const nw=Math.max(W,Math.round(sw0/2)), nh=Math.max(Hc,Math.round(sh0/2));
        const tmp=document.createElement('canvas');
        tmp.width=nw; tmp.height=nh;
        const tg=tmp.getContext('2d');
        tg.imageSmoothingEnabled=true; tg.imageSmoothingQuality='high';
        tg.drawImage(srcImg,sx0,sy0,sw0,sh0,0,0,nw,nh);
        srcImg=tmp; sx0=0; sy0=0; sw0=nw; sh0=nh;
      }
      g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
      g.drawImage(srcImg,sx0,sy0,sw0,sh0,0,0,W,Hc);
    }
    st.tex.needsUpdate=true; needsFrame=true;
  }

  // Three-panel mugs arrive as three separate images. Printify joins them
  // left -> centre -> right around the wrap; so do we, on one canvas, before
  // anything is wrapped.
  function joinPanels(urls){
    const live=urls.filter(Boolean);
    if(!live.length)return Promise.resolve(null);
    return Promise.all(live.map(u=>new Promise(res=>{
      const im=new Image(); im.crossOrigin='anonymous';
      im.onload=()=>res(im); im.onerror=()=>res(null); im.src=u;
    }))).then(imgs=>{
      const ok=imgs.filter(Boolean);
      if(!ok.length)return null;
      if(ok.length===1)return ok[0];
      const h=1024, c=document.createElement('canvas');
      c.width=Math.round(ok.reduce((s,i)=>s+h*(i.width/i.height),0));
      c.height=h;
      const g=c.getContext('2d');
      let x=0;
      ok.forEach(i=>{ const w=h*(i.width/i.height); g.drawImage(i,x,0,w,h); x+=w; });
      // A PROMISE THAT CANNOT FAIL TO SETTLE (Sep 2026, Alyx: "the generator
      // will not send me the final mock-up. It seems to be stuck spinning").
      //
      // This read: out.src = ...; return new Promise(res => out.onload = ...).
      // Two ways to hang forever, either one enough:
      //   - no onerror, so an image that fails to decode never resolves;
      //   - the handler attached AFTER src, so a load that completes first is
      //     never heard.
      // Nothing above catches it, because nothing throws and nothing times
      // out. openMug3DMockup awaits MUG3D.open, runReallyBeginFinalMockupFetch
      // awaits that, and the spinner simply spins.
      // The loader twelve lines up already does this correctly. This one was
      // missed. Handlers first, src last, and a failure resolves with the
      // joined canvas ungeared rather than stranding the caller.
      const out=new Image();
      return new Promise(res=>{
        out.onload=()=>res(out);
        out.onerror=()=>res(ok[0]||null);
        try{ out.src=c.toDataURL('image/png'); }
        catch(err){ console.error('Could not join the panels:',err); res(ok[0]||null); }
      });
    });
  }

  function loop(){
    rafId=requestAnimationFrame(loop);
    if(!renderer)return;
    // Off screen or tab hidden: don't burn a battery. One frame is still drawn
    // after anything changes, so a cup waiting out of view to be looked at is
    // already painted, and at its starting angle, when it arrives.
    if(!visible){ if(needsFrame){ needsFrame=false; renderer.render(scene,camera); } return; }
    if(spinning && !dragging && !(holdUntil && performance.now()<holdUntil)){
      if(!turns){ setSpin(spin+spinStep); }
      else {
        const left=turns*360-travelled;
        const step=easeOut?Math.min(spinStep,Math.max(0.4,left*0.1)):spinStep;
        if(step>=left){ setSpin(spin+left); travelled=turns*360; setSpinning(false); }
        else { setSpin(spin+step); travelled+=step; }
      }
    }
    renderer.render(scene,camera);
  }

  function setSpin(deg){
    spin=deg; needsFrame=true;
    if(mugGroup)mugGroup.rotation.y=spin*Math.PI/180;
    if(onSpinChange){
      let s=((deg+180)%360+360)%360-180;
      onSpinChange(Math.round(s));
    }
  }

  function wire(){
    host.addEventListener('pointerdown',e=>{
      dragging=true; host._lastX=e.clientX;
      try{ host.setPointerCapture(e.pointerId); }catch(err){}
    });
    host.addEventListener('pointermove',e=>{
      if(!dragging)return;
      setSpin(spin+(e.clientX-host._lastX)*0.42);
      host._lastX=e.clientX;
    });
    const up=()=>{ dragging=false; };
    host.addEventListener('pointerup',up);
    host.addEventListener('pointercancel',up);
    // A click that did not drag is the stop/start toggle, unless whoever
    // opened the cup gave it its own click (the Smart Mug's heat reveal
    // replays on a click instead).
    host.addEventListener('click',()=>{ if(clickHandler)clickHandler(); else setSpinning(!spinning); });

    document.addEventListener('visibilitychange',onVis);
    if(window.IntersectionObserver){
      const io=new IntersectionObserver(es=>{
        const was=visible;
        visible = !document.hidden && es.some(e=>e.isIntersecting&&e.intersectionRatio>=viewRatio);
        // Back in view part-way through a turn: that turn starts again from
        // the start. A finished one stays finished until it is tapped.
        if(visible&&!was&&restartOnView&&startAngle!=null&&(replayOnView||!spinDone())){ replay(); if(!spinning&&!reducedMotion())setSpinning(true); }
      },{threshold:[0.01,0.6]});
      io.observe(host);
      host._io=io;
    }
    window.addEventListener('resize',resize);
  }
  function onVis(){ visible = !document.hidden; }

  function setSpinning(on){
    if(on&&spinDone()){ if(replayOnView&&startAngle!=null)replay(); else travelled=0; }   // a tap after the last turn: one more
    spinning=!!on;
    // Said out loud, for whatever sits round the stage (the shelf's "Click to
    // spin" shows only while the mug is still).
    if(host)try{ host.dispatchEvent(new CustomEvent('mug3dspin',{detail:spinning,bubbles:true})); }catch(e){}
    const btn=document.getElementById('mug3dSpinBtn');
    if(btn){
      btn.setAttribute('aria-pressed',String(spinning));
      btn.textContent=spinning?'⏸ Pause':'▶ Spin';
    }
  }

  return {
    isCeramicMug(){ return typeof product!=='undefined' && product==='mug'; },
    hasTumbler,
    hasBox,
    // Fetch three.js ahead of the first still so the picker never waits on
    // the download itself.
    warm(){ return loadThree().catch(()=>null); },
    snapshot,
    setLookDown(v){ lookDown=!!v; if(scene)placeCamera(); },
    setZoom(z){ if(scene)setZoom(z); else mug3dZoom=Math.max(1,Math.min(4,z)); },
    zoom(){ return mug3dZoom; },
    setSpinning,
    spinning(){ return spinning; },
    setAngle(deg){ setSpin(deg); },
    onSpin(fn){ onSpinChange=fn; },
    resize,
    mounted(){ return mounted; },
    host(){ return host; },
    // THE MAGIC MUG'S HEAT (Alyx, 28 Sep 2026): 0 is cold -- the whole cup
    // black, the picture hidden under the coating; 1 is hot -- the bare wall
    // white and the picture full. Everything that is not the body's white or
    // a picture is left as it is (the Smart Mug's rim, inside and handle stay
    // black either way).
    setHeat(t){
      if(!mounted||!mugGroup||!baseMats)return false;
      // Even to the eye: the renderer works in linear light, where half is
      // already most of the way to full.
      const k=Math.pow(Math.max(0,Math.min(1,t)),2.2);
      baseMats.white.color.setRGB(k,k,k);
      mugGroup.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
        ms.forEach(m=>{ if(m&&m.map&&m.color)m.color.setRGB(k,k,k); }); });
      needsFrame=true;
      return true;
    },
    // Read-only, for the suite. The z-fighting that made the band trade pixels
    // with the body on a phone is invisible to a headless renderer -- it is a
    // depth-precision artifact of the device -- so what can be guarded is the
    // CONFIGURATION that prevents it: planes wrapped tight around the cup, and
    // a band biased forward in depth space.
    depthSettings(){
      if(!camera)return null;
      const band=bandStates.length&&mugGroup?mugGroup.children.find(o=>o.material&&o.material.map&&o.material.polygonOffset!==undefined):null;
      return { near:camera.near, far:camera.far, ratio:camera.far/camera.near,
               polygonOffset:!!(band&&band.material.polygonOffset),
               offsetFactor:band?band.material.polygonOffsetFactor:null };
    },

    // REPAINT IN PLACE (Alyx, Sep 2026): "why can't we apply the trimmings
    // directly to the spinning mockup? By clicking on the trimming we want it
    // gets applied directly to the mockup that we're watching in real time."
    // The band is already a canvas texture that paint() rewrites and flags
    // dirty, so a new wrap costs one draw and one upload to the GPU -- no
    // rebuild, no reload, and the cup does not so much as pause its spin. This
    // was always possible; it just had no way in from outside.
    // Takes one picture or a list of panels -- the same two shapes open()
    // takes, joined the same way, so a three-panel mug can be repainted from
    // its three faded panels exactly as it was first built from its three.
    setArtwork(art){
      if(!mounted)return Promise.resolve(false);
      const list=Array.isArray(art)?art.filter(Boolean):(art?[art]:[]);
      return joinPanels(list).then(img=>{ paint(img,0); return true; });
    },

    // RECOLOUR IN PLACE. Same idea as setArtwork above, for the cup's own
    // colour instead of the picture on it: swap the body material on every
    // mesh wearing it and let the next frame draw. No rebuild, so the spin,
    // the angle and the zoom all survive -- which matters, because the only
    // reason to change a colour is to compare it against the one you were
    // just looking at, and a rebuild would throw the cup back to its start
    // position every tap.
    // Returns false if there is no cup mounted, so callers can fall back to
    // opening one.
    setBodyColor(hex,finish){
      const THREE=window.THREE;
      if(!mounted||!mugGroup||!baseMats||!THREE)return false;
      const tm=mugGroup.userData.tumblerMats;
      if(!tm)return false;
      const old=tm.body;
      const next=bodyMaterialFor(THREE,baseMats,tm.steel,hex,finish);
      if(next===old)return true;
      mugGroup.traverse(o=>{
        if(!o.material)return;
        if(Array.isArray(o.material))o.material=o.material.map(m=>m===old?next:m);
        else if(o.material===old)o.material=next;
      });
      tm.body=next;
      // Only ever dispose a coat this function or the build made. white and
      // steel are shared -- white is also the mug's glaze and the cup's rim
      // in some styles -- and disposing either would blank other meshes.
      if(old!==baseMats.white&&old!==tm.steel&&old.dispose)old.dispose();
      return true;
    },

    // opts: { sizeLabel, styleName, colorHex, panelUrls[], panoramaUrl }
    //   or, for a travel cup: { tumblerKey, colorHex, panoramaUrl }
    //   or, for a suitcase: { boxKey, panoramaUrl } (the front's design)
    open(hostEl, opts){
      // A new stage takes the cup over. The shelf's mug lives in a view that
      // is redrawn on every step, and nothing that opens the cup elsewhere
      // should find it still wired to a stage that has left the page.
      if(mounted&&host!==hostEl)this.close();
      host=hostEl;
      spinStep=(opts&&opts.spinStep)||0.32;
      startAngle=(opts&&opts.startAngle!=null)?opts.startAngle:null;
      restartOnView=!!(opts&&opts.restartOnView);
      turns=(opts&&opts.turns)||0; travelled=0;
      clickHandler=(opts&&typeof opts.onClick==='function')?opts.onClick:null;
      holdMs=(opts&&opts.holdMs)||0; holdUntil=0; easeOut=!!(opts&&opts.easeOut); replayOnView=!!(opts&&opts.replayOnView);
      viewRatio=restartOnView?0.6:0.01;
      return loadThree().then(THREE=>{
        if(!mounted){
          host.innerHTML='';
          build(THREE,opts);
          wire();
          mounted=true;
          loop();
        }
        spinning = (opts&&opts.still)?false:!reducedMotion();      // queasy customers get it still
        setSpinning(spinning);
        if(opts&&opts.heat!=null)this.setHeat(opts.heat);
        // The shelf's mug waits for the observer to say it is in view; the
        // mockup's is on screen the moment it opens.
        visible=restartOnView?false:!document.hidden;
        resize();
        if(startAngle!=null)setSpin(startAngle);
        if(bandStates.length>1){
          // Front and back: one picture per band, nothing joined.
          const urls=opts.panelUrls||[];
          return Promise.all(bandStates.map((_,i)=>joinPanels(urls[i]?[urls[i]]:[])))
            .then(imgs=>{ imgs.forEach((im,i)=>paint(im,i)); return true; });
        }
        const source = opts.panoramaUrl ? [opts.panoramaUrl] : (opts.panelUrls||[]);
        return joinPanels(source).then(img=>{ paint(img,0); return true; });
      });
    },

    close(){
      if(rafId)cancelAnimationFrame(rafId);
      rafId=0;
      document.removeEventListener('visibilitychange',onVis);
      if(host&&host._io){ host._io.disconnect(); host._io=null; }
      window.removeEventListener('resize',resize);
      if(renderer){ renderer.dispose(); if(renderer.domElement&&renderer.domElement.parentNode)
        renderer.domElement.parentNode.removeChild(renderer.domElement); }
      renderer=null; scene=null; camera=null; mugGroup=null; printMesh=null;
      designTex=null; designCanvas=null; bandStates=[]; mounted=false; host=null; baseMats=null;
    }
  };
})();
// ================= END THE MUG THAT TURNS =================
