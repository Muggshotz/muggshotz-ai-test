export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: "Missing image or prompt." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY in Vercel." });
    }

    const identityLock = `
CRITICAL IDENTITY LOCK:
Use the uploaded photo as the exact identity reference.
Preserve the same person, same face, same age, same expression, same facial structure, same eye spacing, same nose, same mouth, same teeth, same jawline, same hairline, same facial hair, same wrinkles, same skin tone, and same natural personality.
Do not replace them with a generic attractive AI face.
Do not beautify, de-age, age-up, slim, widen, soften, or average the face.
Create a funny high-quality Muggshotz-style caricature while keeping the person unmistakably recognizable.
`;

    const finalPrompt = `${identityLock}

CUSTOMER REQUEST:
${prompt}

STYLE:
Funny personalized caricature artwork suitable for printing on a mug.
Bright, polished, highly detailed, clean composition, strong likeness, humorous but respectful.
`;

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        images: [
          {
            image_url: image
          }
        ],
        prompt: finalPrompt,
        size: "1024x1024",
        quality: "high",
        output_format: "png",
        input_fidelity: "high"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI image generation failed.",
        details: data
      });
    }

    const b64 = data.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(500).json({ error: "OpenAI returned no image." });
    }

    const imageUrl = `data:image/png;base64,${b64}`;

    return res.status(200).json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
