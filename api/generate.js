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

The uploaded photo is the master identity reference.

The output must show the EXACT SAME PERSON from the uploaded photo.

Do not create a similar person.
Do not create a better-looking version.
Do not create a younger version.
Do not create an older version.
Do not create a generic caricature face.
Do not change the facial identity.

Before applying any style, costume, background, joke, or caricature effect, preserve the person's real face.

Preserve:
- same head shape
- same forehead
- same eye shape
- same eye spacing
- same eyelids
- same eyebrow shape
- same nose bridge
- same nose width
- same nostrils
- same mouth shape
- same lip shape
- same smile or serious expression
- same teeth if visible
- same jawline
- same chin
- same cheek structure
- same ears
- same facial hair
- same wrinkles and age lines
- same skin tone
- same age
- same expression
- same personality

Only exaggerate features that already exist in the uploaded photo.

Keep the face realistic first, caricature second.

If likeness and comedy conflict, preserve likeness.

If likeness and style conflict, preserve likeness.

The finished image must be immediately recognizable to close friends and family as the exact person in the uploaded photo.
`;

    const finalPrompt = `${identityLock}

CUSTOMER REQUEST:
${prompt}

STYLE:
Premium professional Muggshotz caricature.
Realistic illustrated finish.
Natural skin texture.
Detailed lighting.
Clean polished artwork.
Funny but respectful.
Do not over-cartoon the face.
Do not invent new facial anatomy.
Do not change the person's expression unless the customer specifically asks.
Keep the person unmistakably recognizable.
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
