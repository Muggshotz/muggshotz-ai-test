export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.printify.com/v1/shops.json", {
      headers: {
        "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
