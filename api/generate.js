export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { image, prompt } = req.body;
    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt." });
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
    const finalPrompt = `${identityLock}
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
      "image",
      new Blob([imageBuffer], { type: mimeType }),
      `upload.${extension}`
    );

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image returned from OpenAI.", raw: data });
    }

    // Package the result the same way the old code did: a single imageUrl
    // the front end can drop straight into an <img src="..."> tag.
    const outputDataUrl = `data:image/png;base64,${b64}`;
    return res.status(200).json({ imageUrl: outputDataUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
