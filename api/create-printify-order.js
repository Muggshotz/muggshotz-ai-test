const SHOP_ID = "27439202";

const MUG_SETTINGS = {
  "Classic White": {
    blueprint_id: 478,
    print_provider_id: 99,
    variants: { "11oz": 65216, "15oz": 104692 }
  }
};

async function uploadImageToPrintify(imageDataUrl, fileName) {
  const match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error("Image must be a base64 data URL.");
  const base64Data = match[1];

  const response = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file_name: fileName,
      contents: base64Data
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify image upload failed: " + JSON.stringify(data));
  return data.id;
}

async function createPrintifyProduct(imageId, mugType, sizeLabel, title) {
  const settings = MUG_SETTINGS[mugType];
  if (!settings) throw new Error(`Unknown mug type: ${mugType}`);
  const variantId = settings.variants[sizeLabel];
  if (!variantId) throw new Error(`Unknown size "${sizeLabel}" for mug type "${mugType}".`);

  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: title,
      description: "Custom Muggshotz caricature mug.",
      blueprint_id: settings.blueprint_id,
      print_provider_id: settings.print_provider_id,
      variants: [
        { id: variantId, price: 1, is_enabled: true }
      ],
      print_areas: [
        {
          variant_ids: [variantId],
          placeholders: [
            {
              position: "front",
              images: [
                { id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }
              ]
            }
          ]
        }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify product creation failed: " + JSON.stringify(data));
  return { productId: data.id, variantId };
}

async function submitPrintifyOrder(productId, variantId, shippingAddress, externalOrderId) {
  const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      external_id: externalOrderId,
      line_items: [
        { product_id: productId, variant_id: variantId, quantity: 1 }
      ],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: shippingAddress
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error("Printify order submission failed: " + JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { imageDataUrl, mugType, sizeLabel, shippingAddress, customerName, orderId } = req.body;

    if (!imageDataUrl || !mugType || !sizeLabel || !shippingAddress) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const fileName = `muggshotz-${Date.now()}.png`;
    const imageId = await uploadImageToPrintify(imageDataUrl, fileName);

    const productTitle = `Muggshotz Caricature Mug${customerName ? " - " + customerName : ""}`;
    const { productId, variantId } = await createPrintifyProduct(imageId, mugType, sizeLabel, productTitle);

    const orderResult = await submitPrintifyOrder(
      productId,
      variantId,
      shippingAddress,
      orderId || `muggshotz-${Date.now()}`
    );

    return res.status(200).json({
      success: true,
      printifyOrderId: orderResult.id,
      productId
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
