import fs from "fs";
import path from "path";
import sharp from "sharp";

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
const TEMPLATE_FILES = {
  "Marbling": "laced marble.png",
  "Cloud Mist": "clouds.png",
  "Pastel Leaf": "pastel leaf.png",
  "Satin Sheets": "satin sheets.png",
  "Frosted Glass": "frosted mirror.png",
  "Bubble Drift": "bubble drift.png",
  "Rose Crepe": "rose crepe.png",
  "Fade to White": "fade to white.png"
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
    const { image, prompt, theme, deviceId, refImageA, refImageB, currentDesign, size, panelRole, action, templateMerge } = req.body;

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
      // with the identical signature. The fix is to stop telling the model
      // about the thirds at all — it never needed to know. The backend does
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
      const panoramaPrompt = `
CRITICAL MUGGSHOTZ LIKENESS RULE:
This is a caricature of the exact person in the uploaded photo.
Study the uploaded face first. Capture the spark and personality behind the eyes.
Keep the same attitude, expression, mood, and presence as the real photo.
The eyes are the center of the likeness — a good result must feel like the same person is looking back at you.
Base every exaggeration on features that are actually visible in the uploaded photo, including:
the real eye shape, eye spacing, and eyelids; the real brow angle; the real nose shape;
the real mouth shape and expression; the real jawline, cheeks, and ears;
the real facial hair, head shape, skin tone, and age.
Preserve normal head-to-body proportions unless the customer asks for wild exaggeration.

PANORAMA LAYOUT — ONE SINGLE UNINTERRUPTED ULTRA-WIDE SCENE:
Generate exactly ONE continuous ultra-wide image, composed as a single sweeping panoramic photograph taken in one shot.
Place the caricature of the customer, based on the uploaded photo, centred horizontally in the middle of the frame.
To the left and to the right of the subject, continue the SAME environment outward without interruption — the same room, the same landscape, the same crowd, the same lighting — exactly as if the camera had simply panned further in that direction. Do NOT repeat the subject's face or body anywhere else in the scene unless the environment naturally calls for it (a shadow, a reflection, a distant object they would plausibly be near).
Lighting direction, colour grading, horizon line, perspective and visual style must stay perfectly consistent all the way across the full width.

CRITICAL COMPOSITION RULES — THE ARTWORK MUST FILL THE ENTIRE CANVAS, EDGE TO EDGE:
Do NOT draw any border, frame, matte, margin, background surround, vignette, or coloured surface behind or around the artwork.
Do NOT divide the image into panels, sections, columns, tiles, or separate pictures. This is NOT a triptych, NOT a diptych, NOT a collage, NOT a storyboard, and NOT a set of framed prints hanging on a wall.
There must be no vertical lines, gutters, gaps, seams, or visual breaks anywhere in the composition.
Every pixel, from the far left edge to the far right edge, is part of one single continuous scene.
${referenceLine}

CUSTOMER REQUEST:
${prompt}

STYLE:
Photorealistic rendering with caricature-level exaggeration of real features.
Painted, airbrushed illustration finish — not cartoon, not vector, not anime style.
Natural skin texture and lighting.
Strong, unmistakable likeness to the uploaded photo.
Expressive eyes, personality-centered face.
Funny but respectful exaggeration, not a flattened cartoon mascot.
Head proportions stay natural unless the customer specifically requests exaggeration.
Polished gift-art quality.
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

    const identityLock = `
CRITICAL MUGGSHOTZ LIKENESS RULE:
This is a caricature of the exact person in the uploaded photo.
Study the uploaded face first. Capture the spark and personality behind the eyes.
Keep the same attitude, expression, mood, and presence as the real photo.
The eyes are the center of the likeness — a good result must feel like the same person is looking back at you.
Base every exaggeration on features that are actually visible in the uploaded photo, including:
the real eye shape, eye spacing, and eyelids; the real brow angle; the real nose shape;
the real mouth shape and expression; the real jawline, cheeks, and ears;
the real facial hair, head shape, skin tone, and age.
Preserve normal head-to-body proportions unless the customer asks for wild exaggeration.
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
STYLE:
Photorealistic rendering with caricature-level exaggeration of real features.
Painted, airbrushed illustration finish — not cartoon, not vector, not anime style.
Natural skin texture and lighting.
Polished gift-art quality.
`
      : `${identityLock}
CUSTOMER REQUEST:
${prompt}
${backgroundInstruction}
${currentDesignInstruction}
${chromaKeyInstruction}
STYLE:
Photorealistic rendering with caricature-level exaggeration of real features.
Painted, airbrushed illustration finish — not cartoon, not vector, not anime style.
Natural skin texture and lighting.
Strong, unmistakable likeness to the uploaded photo.
Expressive eyes, personality-centered face.
Funny but respectful exaggeration, not a flattened cartoon mascot.
Head proportions stay natural unless the customer specifically requests exaggeration.
Polished gift-art quality.
`;

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
    formData.append("model", "gpt-image-2");
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
