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

Do not make a similar person.
Do not make a nicer person.
Do not make a younger person.
Do not make a generic handsome face.
Do not replace the uploaded person with a new identity.

Study the uploaded face first.

Capture the spark in the eyes.
Capture the personality behind the eyes.
Capture the same attitude, expression, mood, and presence.
The eyes are the center of the likeness.

A good result must feel like the same person is looking back at you.

Caricature the real person, not an imagined version.

Exaggerate only the features that are actually visible in the uploaded photo:
- the real eye shape
- the real eye spacing
- the real eyelids
- the real brow angle
- the real nose shape
- the real mouth shape
- the real smile or serious expression
- the real jawline
- the real cheeks
- the real ears
- the real facial hair
- the real head shape
- the real skin tone
- the real age

Do not invent new facial features.
Do not average the face.
Do not smooth away personality.
Do not change the emotional character of the person.

The face may be artistically caricatured, but every change must come from something already visible in the uploaded photo.

If the image stops feeling like the same person, the result has failed.

Preserve normal head-to-body proportions unless the customer asks for wild exaggeration.
`;

    const finalPrompt = `${identityLock}

CUSTOMER REQUEST:
${prompt}

STYLE:
Premium realistic Muggshotz caricature.
High-detail illustrated realism.
Natural skin texture.
Strong likeness.
Expressive eyes.
Personality-centered face.
Funny but respectful.
Polished gift-art quality.
Do not over-cartoon the face.
Do not make the head oversized.
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
