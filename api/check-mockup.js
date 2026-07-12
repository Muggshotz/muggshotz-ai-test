const SHOP_ID = "27439202";

// Called repeatedly by the frontend after start-mockup.js kicks off a job.
// Each call is quick — just one check against Printify — so it stays
// well under Vercel's Hobby-plan 10 second limit no matter how long
// Printify itself takes to finish rendering the photo.
async function deletePrintifyProduct(productId) {
  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error(`Failed to delete temporary mockup product ${productId}:`, data);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { productId } = req.body;
    if (!productId) throw new Error("productId is required.");

    const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`, {
      headers: { "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}` }
    });
    const data = await response.json();

    const mockupUrl = (response.ok && Array.isArray(data.images) && data.images.length > 0)
      ? data.images[0].src
      : null;

    if (mockupUrl) {
      // Photo's ready — clean up the temporary draft product now that
      // we've got what we need from it.
      deletePrintifyProduct(productId).catch(() => {});
      return res.status(200).json({ ready: true, mockupUrl });
    }

    return res.status(200).json({ ready: false });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
