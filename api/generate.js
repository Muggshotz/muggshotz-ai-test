import fs from "fs";
import path from "path";

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
// generation.
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { image, prompt, theme, deviceId, refImageA, refImageB } = req.body;
    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt." });
    }
    if (!deviceId) {
      return res.status(400).json({ error: "Missing device ID." });
    }

    // --- TOKEN CHECK: look up or create this device's customer record ---
    let customer = await findCustomerByDeviceId(deviceId);
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

    const finalPrompt = `${identityLock}
CUSTOMER REQUEST:
${prompt}
${backgroundInstruction}
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
    function attachDataUrlImage(dataUrl, filename) {
      const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return;
      const buf = Buffer.from(m[2], "base64");
      formData.append("image[]", new Blob([buf], { type: m[1] }), filename);
    }
    if (refImageA) attachDataUrlImage(refImageA, "reference-a.png");
    if (refImageB) attachDataUrlImage(refImageB, "reference-b.png");

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

    // Only deduct the token AFTER a successful generation, so a failed
    // OpenAI call never costs the customer a token. Admin accounts have
    // unlimited tokens and are never deducted.
    if (!isAdmin) {
      await deductOneToken(customer.id, customer.token_balance);
    }

    // Package the result the same way the old code did: a single imageUrl
    // the front end can drop straight into an <img src="..."> tag.
    const outputDataUrl = `data:image/png;base64,${b64}`;
    return res.status(200).json({ imageUrl: outputDataUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
