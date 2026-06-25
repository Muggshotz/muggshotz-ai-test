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
THIS IS AN IMAGE EDIT, NOT A NEW CREATION.

The uploaded photograph is the master identity reference.

Do NOT create a similar-looking person.
Do NOT redesign the face.
Do NOT replace the face.
Do NOT average facial features.
Do NOT beautify.
Do NOT make the person younger or older.
Do NOT change ethnicity.
Do NOT change facial proportions.

Treat the uploaded face exactly like a professional artist tracing the person's identity before adding humor.

The finished image must instantly be recognized as the exact same individual.

Only exaggerate features that already exist.

Keep:
- same head shape
- same skull shape
- same forehead
- same ears
- same eyes
- same eye spacing
- same eyelids
- same eyebrows
- same nose
- same mouth
- same lips
- same teeth
- same chin
- same jaw
- same facial hair
- same expression
- same age
- same skin tone

Preserve the original head-to-body proportions.

The costume, setting, props and joke may change.

The person's identity may NOT.
`;

    const finalPrompt = `${identityLock}

CUSTOMER REQUEST:
${prompt}

STYLE:
Edit the uploaded image into a premium professional Muggshotz caricature.
Keep the exact person from the uploaded photo.
Realistic illustrated finish.
Natural skin texture.
Detailed lighting.
Clean polished artwork.
Funny but respectful.
Do not over-cartoon the face.
Do not make the head oversized.
Do not invent new facial anatomy.
Do not change the person's expression unless the customer specifically asks.
Preserve the uploaded person's likeness above everything else.
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
