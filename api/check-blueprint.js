export default async function handler(req, res) {
  try {
    const response = await fetch(
"https://api.printify.com/v1/catalog/blueprints/1151/print_providers/59/variants.json",
      {
        headers: {
          "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`
        }
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Just show the placeholder position names for the first variant,
    // since every variant on this blueprint/provider shares the same
    // print area layout.
    const firstVariant = data.variants && data.variants[0];
    return res.status(200).json({
      variantTitle: firstVariant ? firstVariant.title : null,
      placeholders: firstVariant ? firstVariant.placeholders : null,
      fullFirstVariant: firstVariant
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
