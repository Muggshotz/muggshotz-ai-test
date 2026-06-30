export default async function handler(req, res) {
  try {
    const shopId = "27439202";
    const response = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
      headers: {
        "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    const simplified = (data.data || []).map(p => ({
      id: p.id,
      title: p.title,
      blueprint_id: p.blueprint_id,
      print_provider_id: p.print_provider_id,
      variant_count: p.variants ? p.variants.length : 0
    }));
    return res.status(200).json(simplified);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
