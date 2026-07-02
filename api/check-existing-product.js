export default async function handler(req, res) {
  const SHOP_ID = "27439202";
  const PRODUCT_ID = "6a38968893a2ad63ed041050";

  try {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${SHOP_ID}/products/${PRODUCT_ID}.json`,
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

    return res.status(200).json({
      title: data.title,
      blueprint_id: data.blueprint_id,
      print_provider_id: data.print_provider_id,
      variants: data.variants,
      print_areas: data.print_areas
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
