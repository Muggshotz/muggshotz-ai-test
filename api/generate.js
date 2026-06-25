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
    const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          input_image: image,
          prompt: finalPrompt
        }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    return res.status(200).json({ imageUrl: output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
