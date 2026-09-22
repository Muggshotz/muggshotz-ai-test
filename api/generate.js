import fs from "fs";
import path from "path";
import sharp from "sharp";

// BUILD: 2026-09-18c — the extreme corner gets a MEDIUM, and its reference picture can no longer go missing in silence (Alyx: "I was kind of hoping to get it a whole different extreme style altogether", "I guess it didn't make a change in style any"). Caricature Assassination described a mood -- sculpted, confident brushwork, theatrical lighting -- where every other tile names a medium outright (pen-and-ink, flat cel-shaded), so it came back looking like the others. It now names one: hyperreal 3D-sculpted digital caricature, a collectible vinyl figurine, glossy rubbery skin and cinematic rim lighting, never drawn and never photographed. And the hidden reference PNG now loads by disk OR by HTTP from our own static assets, because a serverless function only carries the files the bundler chose and a readFileSync on a variable path is what it misses -- which failed silently, attaching nothing. 18b: two dials. 18a: the tiers stopped being drowned out. 17d: the style-reference mechanism. 17c: setting/pose/props. 17b: clothing. 17a: gpt-image-2.5-sunburst.

// RESTORED (July 2026): this file was found genuinely truncated — cut
// off mid-function with no closing brackets and no export default
// handler at all, meaning every generation request failed instantly.
// Restored from the last known-good commit (dc14c44, July 11) via
// GitHub's file history.
//
// Vercel kills a function once it exceeds this duration and returns its
// own plain-text error page instead of JSON — which is what caused the
// front end's "Unexpected token 'A'... is not valid JSON" crash. 300s is
// the maximum allowed on the Hobby plan (with Fluid Compute enabled),
// giving real caricature generations enough headroom to finish normally.
// This one setting was a genuine, valuable fix made in the commit that
// broke the rest of the file — kept here rather than lost.
export const config = {
  maxDuration: 300,
};

// Maps the theme name sent from the front end to its exact reference image
// filename in the repo root. Filenames include spaces exactly as uploaded.
// Hidden style-reference images. A style tile in the studio may name one of
// these; the PAGE SENDS ONLY THE NAME, never a picture, and only a name that
// appears in this table resolves to a file on disk. Style tiles that name
// nothing send nothing extra and generate exactly as they always did.
//
// The picture is a STYLE guide only -- never an identity reference. The
// instruction block built from it (styleReferenceInstruction, below) says so
// in as many words, because the collage is made of other people's faces and
// none of them may leak into the customer's result.
const STYLE_REFERENCE_FILES = {
  "caricature-assassination": "Caricatures.png"
};

// A SECOND REFERENCE FOR THE TOP CORNER (Alyx, Sep 2026: "it might not hurt to
// even throw in that separate collage for the Caricature Assassination + Wild
// category just to ensure that we potentially get a completely different look
// with that combination than all of the others").
//
// The corner that is meant to be unmistakable gets its own picture to aim at,
// so it does not rely on wording alone to separate itself from the seventeen
// other combinations. Gated on the DIAL, not the style: the collage's faces
// are pushed extremely hard, which is the right target at the top of a style's
// range and the wrong one anywhere below it.
const STYLE_REFERENCE_FILES_EXTREME = {
  "caricature-assassination": "Caricatures-extreme.png"
};
const EXTREME_PUSH_THRESHOLD = 100;

const TEMPLATE_FILES = {
  "Marbling": "laced marble.webp",
  "Cloud Mist": "clouds.webp",
  "Pastel Leaf": "pastel leaf.webp",
  "Satin Sheets": "satin sheets.webp",
  "Frosted Glass": "frosted mirror.webp",
  "Bubble Drift": "bubble drift.webp",
  "Rose Crepe": "rose crepe.webp",
  "Fade to White": "fade to white.webp"
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Looks up a customer row by device ID. Returns null if no row exists yet.
async function findCustomerByDeviceId(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance,role`;
  const resp = await fetch(url, {
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

// Creates a brand-new customer row for a first-time device, starting with
// 1 free token (their first free generation).
async function createCustomerForDevice(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ device_id: deviceId, token_balance: 1 })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase insert failed: " + JSON.stringify(rows));
  return rows[0];
}

// Deducts exactly 1 token from a customer's balance after a successful
// generation. Now runs for admin accounts too, so the meter shows a real,
// moving countdown instead of a static infinity symbol. Admin accounts
// are still never blocked from generating regardless of how low (or
// negative) this number goes — that's enforced separately below, not here.
async function deductOneToken(customerId, currentBalance) {
  const url = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ token_balance: currentBalance - 1 })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase token deduction failed: " + JSON.stringify(rows));
  return rows[0];
}

// Uploads the generated image bytes to Supabase Storage and returns a
// permanent public URL, so we never store giant base64 blobs in the
// database or send them back over the wire more than once.
// THE STYLE BLOCK THAT WAS OVERRIDING THE STYLE PANEL (rewritten 2026-08-27).
//
// Two separate defects lived in the block this replaces, and they had been
// hiding each other.
//
// 1. IT CAME LAST, SO IT WON. The customer's choice reaches us as
//    "Selected style: <directive>." embedded in the MIDDLE of the request,
//    and this block was then appended at the END. Image models weight later
//    instructions far more heavily than earlier ones, so a customer who
//    picked Comic Strip got "flat cel-shaded comic strip illustration" in
//    the middle and a flat contradiction -- "not cartoon, not vector" -- at
//    the end. The end won, every time, on every product. Line Art was the
//    only style that visibly survived, because "black and white pen-and-ink,
//    no colour" is concrete enough to punch through. Alyx read this,
//    reasonably, as the Style panel simply not doing much: "for the most
//    part the effect is mostly minor." The panel was never weak. It was
//    being talked over.
//
// 2. IT CONTRADICTED ITSELF. "Photorealistic rendering" AND "painted,
//    airbrushed illustration finish" AND "caricature-level exaggeration" are
//    three different rendering targets stated as three absolutes. Handed
//    that, a model splits the difference and returns the safest thing in the
//    middle: a clean digital cartoon. That is the "why is the artwork so
//    cartoonish" Alyx asked about -- our prompt, not Gemini's ceiling.
//
// The fix for (1) is to let the CHOSEN style be the last word whenever the
// customer picked something other than the house default. The fix for (2) is
// to stop using "photorealistic" as a medium and let it describe the
// rendering QUALITY -- lighting, materials, depth -- which is what it was
// always meant to say next to "painted airbrushed finish".
//
// Only the lines that genuinely apply to every style survive into the
// non-default block: likeness and finish quality. The medium-defining lines
// are exactly what a chosen style is entitled to replace.
//
// ORIGINAL BLOCK, verbatim, for a one-line revert (git: 2d63bf4):
//   STYLE:
//   Photorealistic rendering with caricature-level exaggeration of real features.
//   Painted, airbrushed illustration finish - not cartoon, not vector, not anime style.
//   Natural skin texture and lighting.
//   Strong, unmistakable likeness to the uploaded photo.
//   Expressive eyes, personality-centered face.
//   Funny but respectful exaggeration, not a flattened cartoon mascot.
//   Head proportions stay natural unless the customer specifically requests exaggeration.
//   Polished gift-art quality.
//
// Back-compatible on purpose: a cached browser that sends neither
// styleDirective nor styleIsDefault gets the house default, which is what it
// would have got before.
function buildStyleBlock(styleDirective, styleIsDefault) {
  const chose = styleDirective && styleIsDefault === false;
  if (!chose) {
    return `STYLE:
A premium painted caricature: rich airbrushed illustration, with photographic realism in the lighting, materials, textures and depth.
Not flat cartoon, not vector, not anime, not children's-book illustration.
Real skin texture, believable light and shadow across the face.
Caricature-level exaggeration of this person's OWN real features — never a generic cartoon face.
Strong, unmistakable likeness to the uploaded photo.
Expressive eyes, personality-centered face.
Funny but respectful exaggeration, not a flattened cartoon mascot.
Head proportions stay natural unless the customer specifically requests exaggeration.
Polished gift-art quality.
`;
  }
  return `STYLE — THE CUSTOMER CHOSE THIS, AND IT IS THE FINAL WORD ON HOW THIS IS RENDERED:
${styleDirective}
Render the ENTIRE image in that style — the subject, the background, and every element in the scene, consistently.
Where anything above conflicts with the style just named, the style just named wins ON RENDERING: medium, linework, shading, palette, finish.
It does NOT win on FACIAL OR HEAD PROPORTIONS either -- how far the face is exaggerated is set by the caricature dial above and by nothing else, so that two customers on the same dial get the same amount of exaggeration whichever style they picked.
It does NOT win on canvas, layout or composition. Any requirement about filling the canvas edge to edge, or about not drawing borders, frames, margins, panels, gutters or captions, is a technical printing requirement and overrides the style absolutely. Render the chosen style as a full-bleed image with no frame of any kind, however that style would normally be presented.
Keep a strong, unmistakable likeness to the uploaded photo: the person must stay immediately recognizable within this style.
Polished gift-art quality.
`;
}

async function uploadGenerationToStorage(imageBuffer, deviceId) {
  const fileName = `${deviceId}-${Date.now()}.png`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/generations/${fileName}`;
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "image/png"
    },
    body: imageBuffer
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error("Supabase storage upload failed: " + errText);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/generations/${fileName}`;
}

// gpt-image-2 does not support a native transparent background — the
// "background: transparent" API parameter is rejected outright for this
// model. For template-merge generations (Cover Me, and any future
// design method that melds a photo onto a fixed template), we work
// around this by having the model fill everything outside the template
// with a single flat, unmistakable color (pure magenta, #FF00FF) per an
// explicit prompt instruction, then strip that exact color to real
// alpha transparency ourselves here — the same principle as a film
// green screen, just done in code. Tolerance is kept tight (close to
// true magenta only) specifically so real magenta/pink tones that might
// legitimately appear in a photo or magazine design are not mistaken
// for the placeholder fill.
async function chromaKeyMagentaToTransparent(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 200 && g < 70 && b > 200) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

// Saves a record of this generation so it can later be shown in the
// "pick from your recent generations" picker for multi-placement orders.
async function saveGenerationRecord(customerId, promptText, theme, imageUrl) {
  const url = `${SUPABASE_URL}/rest/v1/generations`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      customer_id: customerId,
      prompt_text: promptText,
      background_theme: theme || null,
      image_url: imageUrl
    })
  });
  const rows = await resp.json();
  if (!resp.ok) {
    // Don't fail the whole request if this record-keeping step fails —
    // the customer already has their image either way.
    console.error("Could not save generation record:", JSON.stringify(rows));
    return null;
  }
  return rows[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { image, prompt, theme, deviceId, refImageA, refImageB, currentDesign, size, panelRole, action, templateMerge, idealise, styleDirective, styleIsDefault, styleRef, styleExaggerate, likeness, shapingRule, bandRatio } = req.body;

    // TWO DIALS, ARRIVING AS NUMBERS (Alyx, Sep 2026: "what possible good does
    // it do us to have two different combinations render the exact same
    // image"). The style tile declares its own exaggeration range -- a comic
    // book is born more exaggerated than a photograph -- and the Degree card
    // picks a position inside it. The page sends the result as three plain
    // numbers, so this file has nothing left to interpret and cannot disagree
    // with the page about the same face.
    const faceHead = Number(req.body.faceHead) > 0 ? Number(req.body.faceHead) : 1;
    const facePush = Number(req.body.facePush) > 0 ? Number(req.body.facePush) : 0;
    const faceFeat = Number(req.body.faceFeat) > 0 ? Number(req.body.faceFeat) : 0;
    const wildFace = facePush > 0;
    const balancedFace = facePush > 0 && facePush < 60;

    // Identical copy of buildFaceBlock() in needles-studio.html, kept in step
    // by hand: the two files share no code, and a request carrying two
    // different sets of instructions about one face is exactly how "same
    // facial proportions" used to travel alongside "enlarge the head".
    const buildFaceBlock = (head, push, feat) => {
      const never = "Eye colour, skin tone, apparent age, hairline position, and whether the head is bald or has hair NEVER change, at any setting.";
      const features = "the head and skull, the forehead and brow, the eye shape and spacing, the nose, the mouth and smile, the teeth, the cheeks, the jawline, the chin and the ears";
      if (push <= 0) {
        return `Preserve the exact recognizable identity, with no exaggeration at all:
same bald head or hairstyle, same hairline, same forehead, same eyebrow shape,
same eye shape, eye spacing and eye colour (do not lighten, darken or shift the iris colour),
same nose shape, same mouth and smile shape, same teeth characteristics, same cheeks,
same jawline, same chin, same skin tone, same age impression, same facial proportions,
same natural personality.
Keep normal, true head-to-body proportions. This is the gentlest setting offered and it should look it.`;
      }
      const grotesque = push >= 100
        ? " Push the strongest of them to the edge of the grotesque. This must not look like a photograph of a person -- it should look drawn, sculpted and deliberately absurd."
        : push >= 60
        ? " The result should read as an artist's caricature at a glance, never as a straight photograph."
        : "";
      return `Exaggerate this face. The features below are material to be reshaped, not things to hold still:
${features}.
Enlarge the head to roughly ${head}x its natural head-to-body ratio, and scale the body against it.
Pick the ${feat >= 4 ? "FOUR" : feat >= 3 ? "THREE" : "TWO"} most distinctive features in this particular face and push each one about ${push}% beyond life. When choosing which ${feat >= 4 ? "four" : feat >= 3 ? "three" : "two"}, give slight preference to small identifying quirks over sheer bulk -- a gap between the front teeth, dimples, bushy or uneven eyebrows, a cleft chin, prominent ears, a crooked smile, a widow's peak, deep laugh lines, heavy-lidded eyes -- but only where this face genuinely has them; a face whose defining feature really is a heavy jaw still gets the heavy jaw.${grotesque}
Identity is carried by the SHAPE of the real features, never by their real measurements. A stranger who knows this person must still recognise them instantly.
${never}
Do not invent features the photo does not show -- no added facial hair, no added glasses, no added scars, no borrowed features from anyone else.`;
    };

    // HIDDEN STYLE REFERENCE. The page sends a NAME (styleRef); only a name in
    // STYLE_REFERENCE_FILES resolves to a file, so nothing the browser sends can
    // reach an arbitrary path. Read once here and used by whichever generation
    // path runs below. An unknown name, or a file that cannot be read, yields no
    // reference and no instruction -- the style still works on its wording alone.
    const styleRefFile = (facePush >= EXTREME_PUSH_THRESHOLD && STYLE_REFERENCE_FILES_EXTREME[styleRef])
      || STYLE_REFERENCE_FILES[styleRef]
      || null;
    let styleRefBuffer = null;
    if (styleRefFile) {
      // TWO WAYS IN, BECAUSE THE FIRST ONE CAN SILENTLY NOT EXIST (Alyx, Sep
      // 2026: "I guess it didn't make a change in style any").
      //
      // A serverless function only carries the files Vercel's tracer chose to
      // bundle, and a readFileSync built from a VARIABLE path is exactly the
      // shape that tracer misses. When it does, this throws, the catch eats it,
      // and the generation goes out with no reference picture attached at all --
      // no error, no warning, nothing on screen to say the style reference the
      // tile promises was never there.
      //
      // The same PNGs are served as ordinary static assets from the site (both
      // verified 200 with the right byte counts), so if the local read comes up
      // empty we fetch our own file over HTTP. Config-free, and it cannot be
      // defeated by a bundling decision.
      const t0 = Date.now();
      try {
        styleRefBuffer = fs.readFileSync(path.join(process.cwd(), styleRefFile));
        console.log("Style reference read from disk:", styleRefFile, styleRefBuffer.length + " bytes");
      } catch (styleRefErr) {
        console.error("Style reference not on disk:", styleRefFile, styleRefErr.message, "-- falling back to HTTP");
        try {
          const host = req.headers["x-forwarded-host"] || req.headers.host;
          const proto = req.headers["x-forwarded-proto"] || "https";
          const resp = await fetch(`${proto}://${host}/${styleRefFile}`);
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          styleRefBuffer = Buffer.from(await resp.arrayBuffer());
          console.log("Style reference fetched over HTTP:", styleRefFile, styleRefBuffer.length + " bytes", (Date.now() - t0) + "ms");
        } catch (httpErr) {
          console.error("Style reference unavailable by BOTH routes:", styleRefFile, httpErr.message);
        }
      }
    }
    // Only ever claim the picture is attached when it actually is.
    const styleReferenceInstruction = styleRefBuffer ? `
STYLE REFERENCE IMAGE (attached, labelled "style reference"):
One extra image is attached purely as an ARTISTIC STYLE guide. Copy ONLY its rendering approach: brushwork, sculpted three-dimensional form, degree and manner of exaggeration, lighting, finish and palette handling.
Do NOT copy any face, head, likeness, hairstyle, expression, pose, clothing, background or composition from it. The people shown in it are NOT the customer and must never appear anywhere in the result.
The uploaded customer photo remains the ONLY source of identity.
` : "";


    // Lightweight path: upload an already-composited image (a Frame or
    // caption baked onto the finished art in the browser via canvas) to
    // storage and hand back a small real URL. No OpenAI call, no token
    // cost — reuses uploadGenerationToStorage below instead of needing a
    // whole separate serverless function, since this project is already
    // right at Vercel's 12-function Hobby-plan cap.
    if (action === "uploadComposite") {
      if (!image) {
        return res.status(400).json({ error: "Missing image." });
      }
      const compositeMatch = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!compositeMatch) {
        return res.status(400).json({ error: "Image must be a base64 data URL." });
      }
      const compositeBuffer = Buffer.from(compositeMatch[2], "base64");
      const compositeUrl = await uploadGenerationToStorage(compositeBuffer, deviceId);
      return res.status(200).json({ imageUrl: compositeUrl });
    }

    // Gemini-based single-shot panorama generation (Aug 2026): an
    // alternative to the sequential Center -> Left -> Right OpenAI edit
    // calls below. Those three calls are genuinely independent
    // generations, which is why a "Fix the Seams" screen exists downstream
    // to manually patch up scale/alignment drift between them. This path
    // asks Gemini for ONE single wide image already containing all three
    // panels side by side, then slices it into three equal thirds here in
    // code — since it's one continuous image, the three pieces are
    // pixel-perfectly aligned by construction, with no seam-matching
    // needed. Additive only: the existing OpenAI wraparound flow is
    // untouched — this is a separate opt-in path the front end calls
    // instead of the normal 3-call sequence.
    if (action === "wraparoundPanorama") {
      if (!image || !prompt) {
        return res.status(400).json({ error: "Missing image or prompt." });
      }
      if (!deviceId) {
        return res.status(400).json({ error: "Missing device ID." });
      }

      let panoramaCustomer = await findCustomerByDeviceId(deviceId);
      if (!panoramaCustomer) {
        panoramaCustomer = await createCustomerForDevice(deviceId);
      }
      const panoramaIsAdmin = panoramaCustomer.role === "admin";
      if (!panoramaIsAdmin && panoramaCustomer.token_balance <= 0) {
        return res.status(403).json({
          error: "You're out of free tokens. Verify your email to unlock another, or grab the $5 Preview Reservation for 4 more."
        });
      }

      const panoramaMatch = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!panoramaMatch) {
        return res.status(400).json({ error: "Image must be a base64 data URL." });
      }

      const referenceLine = (refImageA || refImageB)
        ? `
An additional reference image is attached. ${refImageA ? 'One is "Photo 2" — when the customer idea below mentions "Photo 2," use that exact image for the element described (e.g. a face, an object, a scene, a setting).' : ""} ${refImageB ? 'Another is "Photo 3" — use it the same way if the customer idea mentions "Photo 3."' : ""}`
        : "";

      // REWRITTEN 2026-08-27 — this is what was making Wraparound unusable.
      //
      // The previous wording told the model, in its own words, that the image
      // was "mentally divided into three EQUAL vertical thirds" and that it
      // "will be cut into three separate pieces along those exact lines
      // afterward". Gemini obeyed literally and drew a TRIPTYCH: three framed
      // pictures, white borders, mauve background showing through the gutters
      // between them. The scene underneath was genuinely continuous, so the
      // model was never the problem — but every slice came back carrying a
      // painted border and a slab of background, and the Fix the Seams
      // sliders cannot help with that, because the defect is drawn INTO the
      // panels rather than being a misalignment between them.
      //
      // Reproduced twice, independently (Alyx's live run and a probe here),
      // with the identical signature. Alyx's report named BOTH defects in
      // this one screenshot: "the artist is not even that good" (the separate
      // STYLE-block override, fixed alongside) and the panels not lining up
      // (this). The fix is to stop telling the model about the thirds at all
      // — it never needed to know. The backend does
      // the slicing; the model just paints one unbroken scene. The negative
      // constraints below are deliberately blunt and redundant, because
      // "triptych" is the exact failure mode being designed out.
      //
      // ORIGINAL WORDING, kept verbatim for a one-line revert:
      //   PANORAMA LAYOUT — ONE SINGLE WIDE IMAGE, THREE EQUAL VERTICAL THIRDS:
      //   Generate exactly ONE wide image, mentally divided into three EQUAL
      //   vertical thirds: LEFT, CENTER, RIGHT. Place the caricature ...
      //   centered inside the CENTER third only. ... this single image will be
      //   cut into three separate pieces along those exact lines afterward and
      //   displayed side by side on a wraparound mug ...
      // (full text in git: api/generate.js @ 919b18a)
      // IDENTITY PROTECTION, RESTORED (Sep 2026, Alyx). Sequestering this
      // action's prompt down to the customer's raw idea fixed the seams --
      // the shared client template was carrying per-panel "this panel joins
      // the next one" language into a prompt whose whole job is to convince
      // the model there are no panels. But that template was also the only
      // place these NEGATIVE identity constraints lived, and the block below
      // has none of them: it says what to capture, never what not to do. The
      // faces started coming back beautified, smoothed and generically
      // handsome from the same afternoon the sequestering shipped, and Alyx
      // called it on the first generation. A caricature that isn't
      // recognisably the customer has no reason to exist, so the identity
      // half comes back here -- server-side, where it can never drag panel
      // wording along with it -- while the prompt field stays the raw idea.
      // WILD WAS DEAF HERE (Alyx's find, Sep 2026). The tile sends 0.35 and
      // this compared against "0.4", so Wild matched nothing and fell through
      // to the empty string -- the one setting that promised the most was the
      // only one sending no caricature instruction at all. The page never had
      // the bug because it uses a final else. Same shape here now, so the two
      // cannot drift apart again: a value this does not recognise lands on
      // WILD rather than on silence.
      const identityDemand = buildFaceBlock(faceHead, facePush, faceFeat);
      const strengthLine = `Caricature dial: head ${faceHead}x, features +${facePush}%.`;

      const identityGuard = `
IDENTITY PRESERVATION IS THE TOP PRIORITY, ABOVE THE SCENE AND ABOVE THE STYLE.
Use the uploaded face as the source of truth. Do not invent a new person.
Do NOT beautify, idealise, slim, smooth, youthen, age-shift, race-shift or gender-shift the face.${wildFace ? "" : " Do not change the person's underlying facial structure in any way."}
Do NOT replace the face with a generic cartoon face, a stock caricature face, a model's face, or any actor, celebrity, mascot or invented character.
${identityDemand}
A stranger who knows this person must recognise them instantly.${wildFace ? " At this strength, recognisable means recognisable THROUGH the exaggeration -- do not retreat to a realistic face to achieve it." : " If a choice must be made between a more attractive face and a more accurate one, choose the accurate one every time."}
${strengthLine}
`;

      const panoramaPrompt = `${identityGuard}
CRITICAL MUGGSHOTZ LIKENESS RULE:
This is a caricature of the exact person in the uploaded photo.
Study the uploaded face first. Capture the spark and personality behind the eyes.
Keep the same attitude, expression, mood, and presence as the real photo.
The eyes are the center of the likeness — a good result must feel like the same person is looking back at you.
Base every exaggeration on features that are actually visible in the uploaded photo, including:
the real eye shape, eye spacing, and eyelids; the real EYE COLOR (match the iris shade exactly -- do not lighten, darken, or shift it toward a different color); the real brow angle; the real nose shape;
the real mouth shape and expression; the real jawline, cheeks, and ears;
the real facial hair, head shape, skin tone, and age.
If the uploaded photo shows the person smiling, study exactly how THIS person's eyes look when they smile -- most real smiles narrow and crinkle the eyes at the outer corners to some degree, and the exact amount varies person to person. Match that specific person's real smiling eye shape rather than defaulting to a generic wide-open smiling-eyes look.
${wildFace ? `This is a HEAVY caricature: deliberately exaggerate, enlarge and reshape the head and the facial proportions as directed above. Identity must survive through the SHAPE of the real features listed above -- eye shape, nose shape, mouth shape, jaw, ears, hairline, skin tone, age -- and NOT through realistic geometry. A stranger who knows this person must still recognise them instantly.` : balancedFace ? `Push the head and facial proportions moderately beyond life as directed above, keeping every feature's own character intact.` : `Preserve normal head-to-body proportions.`}
Keep the person's actual clothing and outfit from the uploaded photo (garment type, color, and style) unless a costume change is requested or strongly implied by the set and setting. Keep the photo's own setting, background, and pose unless a different scene or pose is requested or strongly implied by the customer's idea. Do not add props unless they are requested or strongly implied by the set and setting.

PANORAMA LAYOUT — ONE SINGLE UNINTERRUPTED ULTRA-WIDE SCENE:
Generate exactly ONE continuous ultra-wide image, composed as a single sweeping panoramic photograph taken in one shot.
Place the caricature of the customer, based on the uploaded photo, centred horizontally in the middle of the frame.
To the left and to the right of the subject, continue the SAME environment outward without interruption — the same room, the same landscape, the same crowd, the same lighting — exactly as if the camera had simply panned further in that direction. Do NOT repeat the subject's face or body anywhere else in the scene unless the environment naturally calls for it (a shadow, a reflection, a distant object they would plausibly be near).
Lighting direction, colour grading, horizon line, perspective and visual style must stay perfectly consistent all the way across the full width.
The scene must fill the ENTIRE height of the canvas everywhere, including directly above and below the subject. Do NOT shrink, inset, or pad the subject inside a smaller box of their own — the same environment that fills the left and right edges top-to-bottom must also fill the space immediately above and below the subject, with no gap, band, or empty area of any colour separating the subject from the rest of the scene.
Any continuous physical structure that appears in the scene — a fence, wall, tree line, mountain range, roofline, or similar — must behave as ONE real object running the full width of the image: same height, same spacing, same angle, same material, with no jump, reset, or restart at any point, as if it were photographed in a single unbroken panoramic shot rather than painted separately in different regions.
If the attached reference image already shows a background environment (not just a plain backdrop behind the person), any large environmental feature visible in it — a mountain range, tree line, skyline, or similar — must appear at that EXACT SAME apparent scale and distance everywhere across the width. Do not draw a larger, closer, or more dramatic version of it near the subject and a smaller, more distant version elsewhere, or the reverse. Match the reference image's own scale first, then continue outward from it at that same scale.
The sky is a single sky: its color, gradient, and cloud shapes must blend smoothly across the entire width with no abrupt shift in hue, brightness, or cloud pattern anywhere.
The far left edge and the far right edge of the image must continue into each other, so the picture joins seamlessly when wrapped around a cylinder.

${referenceLine}

CUSTOMER REQUEST:
${prompt}

${styleReferenceInstruction}
${buildStyleBlock(styleDirective, styleIsDefault)}
COLOR: Render with vivid, saturated, punchy color throughout the scene — rich blue skies, strong contrast in the mountains, clouds, and landscape. Avoid a muted, hazy, washed-out, sepia-tinted, or pastel palette.
CRITICAL COMPOSITION RULES — THE ARTWORK MUST FILL THE ENTIRE CANVAS, EDGE TO EDGE:
Do NOT draw any border, frame, matte, margin, background surround, vignette, or coloured surface behind or around the artwork.
Do NOT divide the image into panels, sections, columns, tiles, or separate pictures. This is NOT a triptych, NOT a diptych, NOT a collage, NOT a storyboard, and NOT a set of framed prints hanging on a wall.
There must be no vertical lines, gutters, gaps, seams, or visual breaks anywhere in the composition.
Do NOT letterbox or pillarbox the subject — no black bars, coloured bars, or blank padding above, below, or beside the subject. The subject stands directly inside the same continuous environment as the rest of the image, at the same scale as everything around them, touched on every side by that environment.
Every pixel, from the far left edge to the far right edge and from the top edge to the bottom edge, is part of one single continuous scene.
These composition rules are technical printing requirements. They override the STYLE above, and every other instruction here, without exception.

FINAL REMINDER ON LIKENESS: Do not add facial hair, tattoos, piercings, scars, jewelry, or any other feature to the subject's face or head that is not clearly visible in the uploaded photo, unless the customer's request above explicitly asks for it. The subject's face must remain a faithful likeness of the real uploaded photo at all times, even while everything else in the scene is invented. Keep the subject's actual clothing from the uploaded photo (garment type, color, style) unless a costume change is requested or strongly implied by the set and setting. Keep the photo's own setting, background, and pose unless a different scene or pose is requested or strongly implied by the customer's idea. Do not add props unless they are requested or strongly implied by the set and setting.
`;

      const geminiParts = [
        { text: panoramaPrompt },
        { inlineData: { mimeType: panoramaMatch[1], data: panoramaMatch[2] } }
      ];
      function addGeminiRefPart(dataUrl) {
        const m = dataUrl && dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!m) return;
        geminiParts.push({ inlineData: { mimeType: m[1], data: m[2] } });
      }
      addGeminiRefPart(refImageA);
      addGeminiRefPart(refImageB);
      // The hidden style reference goes last, after the customer's own photos.
      if (styleRefBuffer) addGeminiRefPart(`data:image/png;base64,${styleRefBuffer.toString("base64")}`);

      const geminiResp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: geminiParts }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio: "21:9" }
            }
          })
        }
      );

      const geminiData = await geminiResp.json();
      if (!geminiResp.ok) {
        const readableError =
          geminiData?.error?.message || JSON.stringify(geminiData?.error) || "Unknown error from Gemini.";
        return res.status(geminiResp.status).json({ error: readableError });
      }

      const geminiImagePart = geminiData?.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
      if (!geminiImagePart) {
        return res.status(502).json({ error: "No image returned from Gemini.", raw: geminiData });
      }

      const panoramaBuffer = Buffer.from(geminiImagePart.inlineData.data, "base64");
      const panoramaMeta = await sharp(panoramaBuffer).metadata();
      const fullWidth = panoramaMeta.width;
      const fullHeight = panoramaMeta.height;
      const thirdWidth = Math.floor(fullWidth / 3);

      const [leftBuffer, centerBuffer, rightBuffer] = await Promise.all([
        sharp(panoramaBuffer).extract({ left: 0, top: 0, width: thirdWidth, height: fullHeight }).png().toBuffer(),
        sharp(panoramaBuffer).extract({ left: thirdWidth, top: 0, width: thirdWidth, height: fullHeight }).png().toBuffer(),
        sharp(panoramaBuffer)
          .extract({ left: thirdWidth * 2, top: 0, width: fullWidth - thirdWidth * 2, height: fullHeight })
          .png()
          .toBuffer()
      ]);

      // The whole, un-sliced panorama is uploaded alongside the three
      // thirds. Coffee mugs print as three separate panels and want the
      // slices; travel cups wrap as ONE continuous surface and want the
      // original, uncut. Same single generation either way -- one extra
      // upload is cheaper than a second Gemini call, and it means the
      // caller picks its own shape instead of the backend guessing.
      // Re-encoded through sharp rather than shipped as Gemini returned it:
      // uploadGenerationToStorage() names every file .png and sends
      // Content-Type: image/png unconditionally. The three slices already
      // come out of sharp as real PNGs; handing it the raw model bytes
      // would be the one upload whose declared type is a guess.
      const panoramaPngBuffer = await sharp(panoramaBuffer).png().toBuffer();

      const [leftUrl, centerUrl, rightUrl, panoramaUrl] = await Promise.all([
        uploadGenerationToStorage(leftBuffer, deviceId + "-left"),
        uploadGenerationToStorage(centerBuffer, deviceId + "-center"),
        uploadGenerationToStorage(rightBuffer, deviceId + "-right"),
        uploadGenerationToStorage(panoramaPngBuffer, deviceId + "-panorama")
      ]);

      await saveGenerationRecord(panoramaCustomer.id, prompt, null, centerUrl);
      await deductOneToken(panoramaCustomer.id, panoramaCustomer.token_balance);

      return res.status(200).json({ leftUrl, centerUrl, rightUrl, panoramaUrl });
    }

    // EXPERIMENTAL (Sep 2026, comparison-tool test only): masked outpainting
    // for the sequential method. The existing panelRole ("continue this
    // scene") calls hand the model a whole reference image and ask for a
    // brand-new image inspired by it -- the model re-imagines the entire
    // frame, including the boundary, which is the likely root cause of the
    // scale/style/perspective drift seen at the seams. True outpainting is
    // different: the input image itself has a transparent region, and only
    // that transparent region gets filled in -- the existing (opaque)
    // pixels are meant to survive untouched, so the boundary is never
    // re-guessed. UNPROVEN: this codebase has never sent a
    // transparent-region edit to this model before, so whether it actually
    // honors the alpha channel as an implicit mask (rather than ignoring
    // it, erroring, or repainting everything) is exactly what this test
    // exists to find out. Also resolution-limited on purpose: the model
    // only accepts a fixed menu of canvas sizes, and none of them are
    // "double the width of another one," so this first pass tests at
    // 768px-wide half-canvases rather than full panel resolution -- proving
    // the alignment concept, not shipping final quality.
    if (action === "wraparoundOutpaintTest") {
      if (!image || !prompt) {
        return res.status(400).json({ error: "Missing image or prompt." });
      }
      if (!deviceId) {
        return res.status(400).json({ error: "Missing device ID." });
      }

      const outpaintMatch = image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!outpaintMatch) {
        return res.status(400).json({ error: "Image must be a base64 data URL." });
      }
      if (outpaintMatch[1] !== "image/png") {
        return res.status(400).json({ error: "Outpaint composite must be a PNG with real alpha transparency." });
      }

      const outpaintBuffer = Buffer.from(outpaintMatch[2], "base64");

      const outpaintFormData = new FormData();
      outpaintFormData.append("model", "gpt-image-2.5-sunburst");
      outpaintFormData.append(
        "prompt",
        `OUTPAINTING TASK -- READ CAREFULLY:\nThis image is 1536x1024. Roughly half of it is real, existing content from an already-approved design. The other half is empty/transparent.\nDo NOT alter, redraw, recolor, rescale, or shift any of the existing (opaque) pixels in any way -- they must survive completely untouched.\nFill ONLY the empty/transparent area by continuing the exact same scene outward, believably, as if the camera had simply panned further in that direction: same environment, same lighting direction, same color grading, same art style.\nSCALE LOCK: any large environmental feature that touches the boundary between the existing content and the empty area -- a mountain range, tree line, building, fence, or similar -- must continue at the EXACT SAME apparent size and distance it has right at that boundary. Do not shrink it, recede it further away, or enlarge it as you move away from the boundary.\nThe join between the existing content and the new content must be seamless -- no visible seam, no gap, no shift in perspective, scale, or style at the boundary.\n\n${prompt}`
      );
      outpaintFormData.append("size", "1536x1024");
      outpaintFormData.append(
        "image[]",
        new Blob([outpaintBuffer], { type: "image/png" }),
        "outpaint-composite.png"
      );

      const outpaintResp = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: outpaintFormData
      });

      const outpaintData = await outpaintResp.json();
      if (!outpaintResp.ok) {
        const rawError = outpaintData?.error;
        const readableError =
          typeof rawError === "string"
            ? rawError
            : rawError?.message || JSON.stringify(rawError) || "Unknown error from image service.";
        return res.status(outpaintResp.status).json({ error: readableError });
      }

      const outpaintB64 = outpaintData?.data?.[0]?.b64_json;
      if (!outpaintB64) {
        return res.status(502).json({ error: "No image returned from OpenAI.", raw: outpaintData });
      }

      const outpaintResultBuffer = Buffer.from(outpaintB64, "base64");
      const outpaintResultUrl = await uploadGenerationToStorage(outpaintResultBuffer, deviceId + "-outpaint-test");

      // No token charge -- this is a free experimental test action, same
      // policy as the existing panelRole continuations it's being compared
      // against.
      return res.status(200).json({ imageUrl: outpaintResultUrl });
    }

    // ---------------------------------------------------------------------
    // NO PHOTO AT ALL (Alyx, Sep 2026): "what if they just want the AI to make
    // a design for them? Right now everything requires photo first."
    //
    // He was right and the lock was in two places, not one. The studio refused
    // at its Generate button, and every lane in THIS file refused too -- four
    // separate `if (!image)` guards -- so lifting the front-end gate alone
    // would only have turned a polite message into a 400.
    //
    // This is the lane that has no subject. It is deliberately NOT the main
    // path with the photo bits removed: that path runs on /images/edits, which
    // exists to modify a picture and must be given one, and its prompt is built
    // almost entirely around a face -- identity preservation, the exaggeration
    // dials, likeness, the delusion pact. None of that has anything to hold on
    // to when nobody is in the picture, and feeding a face prompt to a request
    // with no face is how you get a model inventing one.
    //
    // So: /images/generations, the customer's own words, the product's shaping
    // rule, and nothing else. Same token check, same deduction, same Supabase
    // upload and hosted URL as every other lane, because it is worth exactly
    // what they are: one token.
    if (action === "textOnly") {
      if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({ error: "Tell Needles what to draw." });
      }
      if (!deviceId) {
        return res.status(400).json({ error: "Missing device ID." });
      }

      const TEXT_ONLY_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
      const textOnlySize = TEXT_ONLY_SIZES.includes(size) ? size : "1024x1024";

      // The same token gate the main path uses, in the same order: look the
      // device up, refuse at zero unless admin, and deduct only after a
      // picture actually comes back.
      let textCustomer = await findCustomerByDeviceId(deviceId);
      if (!textCustomer) {
        textCustomer = await createCustomerForDevice(deviceId);
      }
      if (textCustomer.role !== "admin" && textCustomer.token_balance <= 0) {
        return res.status(403).json({
          error: "You're out of free tokens. Verify your email to unlock another, or grab the $5 Preview Reservation for 4 more."
        });
      }

      // The ONE thing carried over, because it is not about faces: what the
      // picture has to fit. A mug wrap and a standalone download want
      // different compositions and the model cannot know which unless it is
      // told. The studio already computes that sentence (productShapingRule in
      // needles-studio.html) and sends it as `shapingRule`; there is
      // deliberately no second copy of that rule on this side to drift out of
      // step with the first. Everything else -- style tiles, likeness, the
      // face block -- stays out.
      const shaping = typeof shapingRule === "string" ? shapingRule.trim() : "";
      // A WRAPAROUND BAND IS A STRIP, NOT A CANVAS (Alyx, V326). The widest
      // canvas this endpoint draws is 3:2, and a Tundra band is 3.5:1. Told to
      // fill the canvas, the model paints a centred 3:2 scene and the studio
      // has to mirror the other 57% of the cup. When the studio sends the
      // band's ratio, the fill line is swapped for a letterbox: paint the
      // strip at its true proportion across the middle, leave pure white
      // above and below, and the studio trims the white rows off. One token,
      // real horizon end to end, at the resolution the strip's height allows.
      const strip = Number(bandRatio) > 1.6 ? Number(bandRatio) : 0;
      const fillLine = strip
        ? `Compose the picture as ONE continuous panoramic strip exactly ${strip} times wider than it is tall, centred vertically on the canvas and running the full width from the left edge to the right edge. The canvas above and below the strip must be left completely empty: flat, pure, solid white (#FFFFFF) with no gradient, texture, shadow, border line or anything drawn in it. Inside the strip, draw no border, frame, margin, panel, gutter, caption, watermark or signature of any kind.`
        : "Fill the whole canvas edge to edge. Do not draw a border, frame, margin, panel, gutter, caption, watermark or signature of any kind.";
      const textOnlyPrompt = [
        String(prompt).trim(),
        "",
        "Draw this as an original illustration. Do not include any real person's likeness unless the description itself asks for a specific public figure.",
        fillLine,
        shaping ? `This artwork is for ${shaping}` : ""
      ].filter(Boolean).join("\n");

      const textOnlyResp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-2.5-sunburst",
          prompt: textOnlyPrompt,
          size: textOnlySize,
          n: 1
        })
      });

      const textOnlyData = await textOnlyResp.json();
      if (!textOnlyResp.ok) {
        const rawErr = textOnlyData?.error;
        const readable =
          typeof rawErr === "string"
            ? rawErr
            : rawErr?.message || JSON.stringify(rawErr) || "Unknown error from image service.";
        return res.status(textOnlyResp.status).json({ error: readable });
      }

      const textOnlyB64 = textOnlyData?.data?.[0]?.b64_json;
      if (!textOnlyB64) {
        return res.status(502).json({ error: "No image returned from OpenAI.", raw: textOnlyData });
      }

      const textOnlyBuffer = Buffer.from(textOnlyB64, "base64");
      const textOnlyUrl = await uploadGenerationToStorage(textOnlyBuffer, deviceId);

      await saveGenerationRecord(textCustomer.id, prompt, theme, textOnlyUrl);
      await deductOneToken(textCustomer.id, textCustomer.token_balance);

      return res.status(200).json({ imageUrl: textOnlyUrl });
    }

    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt." });
    }
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }

    // gpt-image-2 needs an explicit size, or it infers a default shape
    // (typically matching the uploaded photo's own orientation) —
    // composition instructions in the prompt text alone were NOT
    // reliably controlling actual output dimensions. Only these three
    // values are valid for this endpoint; anything else from the front
    // end falls back to square.
    const VALID_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
    const imageSize = VALID_SIZES.includes(size) ? size : "1024x1024";

    // Left/Right panel calls are scene-continuations of an already-paid
    // Center generation (see index.html's wraparound orchestration) —
    // they ride free as part of the same set, so they skip the token
    // gate/deduction entirely rather than costing 3 tokens for one
    // wraparound design.
    const isPanelContinuation = panelRole === "left" || panelRole === "right";

    let customer = null;
    if (!isPanelContinuation) {
      // --- TOKEN CHECK: look up or create this device's customer record ---
      customer = await findCustomerByDeviceId(deviceId);
      if (!customer) {
        customer = await createCustomerForDevice(deviceId);
      }
      const isAdmin = customer.role === "admin";
      if (!isAdmin && customer.token_balance <= 0) {
        return res.status(403).json({
          error: "You're out of free tokens. Verify your email to unlock another, or grab the $5 Preview Reservation for 4 more."
        });
      }
      // --- END TOKEN CHECK ---
    }

    // THE DELUSION PACT (Sep 2026, Alyx). Flattery is off by default -- see the
    // note below -- and exactly one thing can switch it on: a template that
    // declares `idealise` in the catalog, because its whole joke IS the
    // flattery. Mirror Mirror and the court painter are those templates. A
    // customer who picks one has asked to be lied to, which is the difference
    // between a gag and a defect, and it is why this is a template property
    // rather than anything a prompt can talk its way into.
    //
    // WHAT NOT TO DO, WHICH THIS BLOCK NEVER SAID (Sep 2026, Alyx, on a Face It
    // portrait of his niece: "I fear that he made my niece look prettier than
    // she actually is to the point where it's almost unusable").
    //
    // The identical failure was found and fixed on the wraparound panorama
    // earlier -- read the note on identityGuard below, which says it outright:
    // "that template was also the only place these NEGATIVE identity
    // constraints lived, and the block below has none of them: it says what to
    // capture, never what not to do. The faces started coming back beautified,
    // smoothed and generically handsome."
    //
    // That was true of THIS block too and nobody noticed, because the panorama
    // got the guard and the merge path did not. Everything below is a
    // beautifully detailed instruction on what to capture -- the eye shape, the
    // brow angle, the real jawline -- and not one line telling the model to
    // leave a face it would rather improve. A model asked only to "capture the
    // likeness" will happily capture a slimmer, smoother, younger likeness and
    // consider the job done.
    //
    // Worse here than anywhere, because the watercolour templates ask in the
    // same breath for a "delicate, translucent treatment", which reads as
    // permission to smooth. Same constraints as identityGuard, same wildFace
    // carve-out: a heavy caricature is SUPPOSED to reshape the face, and this
    // must not argue with the dial.
    //
    // Flattering somebody on purpose is a fine feature. It is not this one, and
    // it is not a thing that should happen to a customer without them asking.
    const identityLock = `
CRITICAL MUGGSHOTZ LIKENESS RULE:
This is a caricature of the exact person in the uploaded photo.
${idealise ? `THIS TEMPLATE IS ALLOWED TO FLATTER, AND IS THE ONLY KIND THAT IS.
The customer chose a scene whose entire joke is that it depicts them more grandly than life, and they chose it knowing that. So idealise deliberately: render them more radiant, more poised, more powerful, more stately and wiser than the photograph shows. Light them the way a painter lights someone they admire.
This permission is narrow and it stops at the bone. The likeness must survive it completely: same bone structure, same nose, same eye shape and colour, same mouth, same jaw width, same hairline, same age, same skin tone, same distinctive marks. Do NOT substitute a model, a stock beauty, a celebrity or an invented face, and do NOT slim or reshape the head.
The lie only lands if the person is unmistakable inside it. A stranger who knows them must recognise them instantly and think only that they have never looked better.` : `Do NOT beautify, idealise, slim, smooth, youthen, age-shift, race-shift or gender-shift the face.${wildFace ? "" : " Do not narrow the jaw, sculpt the cheekbones, reduce the chin, or otherwise change the person's underlying facial structure in any way."}
Do NOT replace the face with a generic cartoon face, a stock caricature face, a model's face, or any actor, celebrity, mascot or invented character.
A fuller face stays full, a softer jaw stays soft, and every line, mark and asymmetry the photo shows belongs to this person and stays where it is. The result must read as this person on an ordinary day, not as a flattering version of them.`}
Study the uploaded face first. Capture the spark and personality behind the eyes.
Keep the same attitude, expression, mood, and presence as the real photo.
The eyes are the center of the likeness — a good result must feel like the same person is looking back at you.
Base every exaggeration on features that are actually visible in the uploaded photo, including:
the real eye shape, eye spacing, and eyelids; the real EYE COLOR (match the iris shade exactly -- do not lighten, darken, or shift it toward a different color); the real brow angle; the real nose shape;
the real mouth shape and expression; the real jawline, cheeks, and ears;
the real facial hair, head shape, skin tone, and age.
If the uploaded photo shows the person smiling, study exactly how THIS person's eyes look when they smile -- most real smiles narrow and crinkle the eyes at the outer corners to some degree, and the exact amount varies person to person. Match that specific person's real smiling eye shape rather than defaulting to a generic wide-open smiling-eyes look.
${wildFace ? `This is a HEAVY caricature: deliberately exaggerate, enlarge and reshape the head and the facial proportions as directed above. Identity must survive through the SHAPE of the real features listed above -- eye shape, nose shape, mouth shape, jaw, ears, hairline, skin tone, age -- and NOT through realistic geometry. A stranger who knows this person must still recognise them instantly.` : balancedFace ? `Push the head and facial proportions moderately beyond life as directed above, keeping every feature's own character intact.` : `Preserve normal head-to-body proportions.`}
Keep the person's actual clothing and outfit from the uploaded photo (garment type, color, and style) unless a costume change is requested or strongly implied by the set and setting. Keep the photo's own setting, background, and pose unless a different scene or pose is requested or strongly implied by the customer's idea. Do not add props unless they are requested or strongly implied by the set and setting.
`;

    // Left/Right panel calls are NOT edits of the customer's photo — the
    // "image" field for these is the already-generated CENTER panel
    // itself, and the goal is a plausible continuation of that same
    // scene to one side, not a fresh caricature. Using a completely
    // different, simpler prompt here (no identity-lock language) avoids
    // confusing the model with face-preservation instructions that
    // don't apply to a background-continuation panel.
    const panelContinuationPrompt = isPanelContinuation ? `
SCENE CONTINUATION — ${panelRole.toUpperCase()} PANEL:
The attached image is the CENTER panel of a three-panel wraparound design that has already been generated and approved.
Generate a NEW image that continues this exact same scene as if the camera panned to the ${panelRole === "left" ? "LEFT" : "RIGHT"} of the center panel — same environment, same lighting direction, same color palette, same art style, continuing background and environmental elements naturally from the ${panelRole === "left" ? "left" : "right"} edge of the reference image.
This is a BACKGROUND/ENVIRONMENT continuation panel. Do NOT repeat the main subject's face or body in this panel, unless the scene naturally calls for a background element related to them (e.g. a shadow, a reflection, a distant object they'd plausibly be near). The goal is extending the WORLD of the scene outward, not duplicating the subject.
Match the lighting direction, color grading, and visual style of the reference image exactly, so all three panels feel like one single continuous photograph or illustration when placed side by side.
SCALE LOCK: Any landmark already visible in the reference image at its edge — a mountain range, a tree line, a building, a fence, any large environmental feature — must continue at the EXACT SAME apparent size and distance as it appears in the reference image, measured right at that edge. Do not shrink it, recede it further away, enlarge it, or otherwise change how close or far it looks. Match its scale at the seam first, then continue it outward from there at that same scale.
` : "";

    // If a background theme was chosen and we have a matching reference
    // image, tell the model explicitly how to use the two images together.
    const templateFile = theme ? TEMPLATE_FILES[theme] : null;
    const backgroundInstruction = templateFile
      ? `
BACKGROUND REFERENCE:
Image 1 is the customer's photo — use it only for the person's face and likeness.
Image 2 is a background style reference — match its texture, pattern, and soft-edged blending style for the background only.
Do not copy any people, objects, or text from Image 2. Only use it as a background style guide.
`
      : "";

    // If a current-design image was provided, this is a refinement of an
    // existing result rather than a fresh generation. The ORIGINAL
    // uploaded photo remains the identity anchor — it stays attached and
    // stays the source of truth for the real face — but the current
    // design is what the customer is actually looking at and wants
    // modified, so treat it as the visual starting point to build on.
    const currentDesignInstruction = currentDesign
      ? `
CURRENT DESIGN REFERENCE:
An additional image labeled "current design" is attached. This is the customer's most recent generated result from this session — the actual image they are looking at right now.
Use the current design as the visual starting point: keep its existing composition, background, costume, and styling unless the customer's new request below specifically asks to change something.
The ORIGINAL uploaded customer photo remains the source of truth for facial identity and likeness at all times — the current design is a stylized rendering, not a real photo, so do not let it override or drift the real facial identity captured from the original photo.
Apply the customer's new instruction as an edit on top of the current design, not as a brand-new unrelated generation.
`
      : "";

    // gpt-image-2 can't output true transparency (see
    // chromaKeyMagentaToTransparent above for why). For template-merge
    // generations, tell the model to fill any canvas area outside the
    // actual template artwork with a single flat placeholder color
    // instead of inventing a background — we strip this color to real
    // transparency after generation, before the customer ever sees it.
    const chromaKeyInstruction = templateMerge
      ? `
CANVAS FILL REQUIREMENT (technical instruction, not visible to the customer):
The reference template image may not fill the entire canvas exactly. Any area of the canvas that falls OUTSIDE the actual template artwork (i.e. not part of the template itself) must be filled with a single, perfectly flat, solid color: pure magenta, hex #FF00FF, RGB(255,0,255).
Do not use white, black, gray, gradients, vignettes, shadows, textures, or any scene/background/environment in that outside area — it must be one uniform flat magenta fill only, with a clean hard edge exactly at the boundary of the template artwork.
This magenta fill is a placeholder that will be programmatically removed after generation — it is never seen by the customer, so it must not be styled, softened, or blended in any way.
`
      : "";


    const finalPrompt = isPanelContinuation
      ? `${panelContinuationPrompt}
${buildStyleBlock(styleDirective, styleIsDefault)}`
      : `${identityLock}
${styleReferenceInstruction}
CUSTOMER REQUEST:
${prompt}
${backgroundInstruction}
${currentDesignInstruction}
${chromaKeyInstruction}
${buildStyleBlock(styleDirective, styleIsDefault)}`;

    // image comes in as a data URL like "data:image/png;base64,AAAA..."
    // OpenAI's edit endpoint needs the raw file bytes, not the data URL prefix.
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Image must be a base64 data URL." });
    }
    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, "base64");
    const extension = mimeType === "image/png" ? "png" : "jpg";

    const formData = new FormData();
    formData.append("model", "gpt-image-2.5-sunburst");
    formData.append("prompt", finalPrompt);
    formData.append("size", imageSize);
    formData.append(
      "image[]",
      new Blob([imageBuffer], { type: mimeType }),
      `upload.${extension}`
    );

    // If a matching template file exists on disk, attach it as a second
    // reference image so the model can copy its background style.
    if (templateFile) {
      try {
        const templatePath = path.join(process.cwd(), templateFile);
        const templateBuffer = fs.readFileSync(templatePath);
        formData.append(
          "image[]",
          new Blob([templateBuffer], { type: "image/png" }),
          "background-reference.png"
        );
      } catch (fileErr) {
        // If the template file can't be read for any reason, continue
        // without it rather than failing the whole request.
        console.error("Could not load template file:", templateFile, fileErr.message);
      }
    }

    // If reference images were provided, attach them as additional images
    // so the model can pull specific elements (a face, an object, a
    // setting) from them as instructed in the prompt text above.
    // FIXED: the filename's extension now matches the image's real
    // detected format (same logic the primary image already used above)
    // instead of always claiming .png regardless of actual content --
    // that mismatch could cause the upload to be rejected or mishandled.
    function attachDataUrlImage(dataUrl, baseName){
      const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return;
      const buf = Buffer.from(m[2], "base64");
      const refExtension = m[1] === "image/png" ? "png" : (m[1] === "image/webp" ? "webp" : "jpg");
      formData.append("image[]", new Blob([buf], { type: m[1] }), `${baseName}.${refExtension}`);
    }
    if (refImageA) attachDataUrlImage(refImageA, "reference-a");
    if (refImageB) attachDataUrlImage(refImageB, "reference-b");
    if (currentDesign) attachDataUrlImage(currentDesign, "current-design");

    // The hidden style reference, attached LAST so the customer's own photo and
    // their Photo 2 / Photo 3 keep the positions the prompt text refers to.
    if (styleRefBuffer) {
      formData.append(
        "image[]",
        new Blob([styleRefBuffer], { type: "image/png" }),
        "style-reference.png"
      );
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      // OpenAI sometimes returns error as a nested object rather than a
      // plain string. Flatten it here so the front end always has a
      // readable message instead of "[object Object]".
      const rawError = data?.error;
      const readableError =
        typeof rawError === "string"
          ? rawError
          : rawError?.message || JSON.stringify(rawError) || "Unknown error from image service.";
      return res.status(response.status).json({ error: readableError });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image returned from OpenAI.", raw: data });
    }

    // For template-merge generations, strip the magenta placeholder fill
    // to real alpha transparency now, once, right here — so every
    // downstream consumer (mug panel compositing, easel preview, other
    // products) inherits a genuinely transparent PNG automatically and
    // never has to know the magenta trick happened at all.
    let generatedBuffer = Buffer.from(b64, "base64");
    if (templateMerge) {
      try {
        generatedBuffer = await chromaKeyMagentaToTransparent(generatedBuffer);
      } catch (keyErr) {
        // If the chroma-key pass itself fails for any reason, fall back
        // to the raw generated image rather than losing the customer's
        // result entirely.
        console.error("Chroma-key transparency pass failed:", keyErr.message);
      }
    }

    // Upload the finished image to Supabase Storage and get a real,
    // permanent URL back instead of shipping raw base64 around.
    const publicImageUrl = await uploadGenerationToStorage(generatedBuffer, deviceId);

    // Record this generation so it can be picked later for multi-placement
    // mug orders. Never lets a record-keeping failure block the customer's
    // actual image from coming back. Skipped for left/right panel
    // continuations since there's no separate customer/token event for
    // those — they're logged implicitly as part of the center panel.
    if (!isPanelContinuation) {
      await saveGenerationRecord(customer.id, prompt, theme, publicImageUrl);
    }

    // Only deduct the token AFTER a successful generation, so a failed
    // OpenAI call never costs anyone a token. Admin accounts are deducted
    // the same as everyone else now (for a real, visible countdown on the
    // token meter) — they just can never be BLOCKED by the zero-token
    // check above, no matter how low this number goes. Left/right panel
    // continuations never reach this — only the Center call in a
    // wraparound set is gated/charged at all.
    if (!isPanelContinuation) {
      await deductOneToken(customer.id, customer.token_balance);
    }

    return res.status(200).json({ imageUrl: publicImageUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
