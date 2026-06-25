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
CRITICAL IDENTITY LOCK:
Preserve the exact facial identity of the person in the reference image.
Do not create a similar-looking person.
Do not reinterpret, beautify, average, de-age, age-up, slim, widen, soften, or genericize the face.
Preserve exact head shape, skull shape, eye shape, eye spacing, brow angle, nose bridge, nose width, nostril shape, mouth shape, smile asymmetry, teeth, jawline, cheek structure, ears, skin texture, facial hair, wrinkles, age lines, expression, head tilt, and natural personality.
Caricature only the person's real existing features.
Do not invent new facial features.
Do not replace the face with a generic attractive AI face.
The output must remain unmistakably the same individual from the uploaded photo.
`;

    const finalPrompt = `${identityLock}

${prompt}`;

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
