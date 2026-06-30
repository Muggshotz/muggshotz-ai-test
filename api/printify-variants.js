export default async function handler(req, res) {
  try {
    const blueprintId = 478;
    const printProviderId = 99;
    const response = await fetch(
      `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`
        }
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    const simplified = (data.variants || []).map(v => ({
      id: v.id,
      title: v.title
    }));
    return res.status(200).json(simplified);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
