// lib/flyer-products.js
//
// WHAT A FLYER SAYS ABOUT ONE PRODUCT (Alyx, 24 Sep 2026: "beautifully
// imagined flyers that show one product's flow and the model simply; the
// smart mug first -- its COLD -> HOT pictures already tell the story").
//
// A beta's flyers lead with the product they chose at onboarding
// (flyer_betas.featured_product, a catalog key). Everything a flyer or the
// landing page prints about that product -- the headline, the one-line
// pitch, the three steps, the picture -- comes from here, and the price
// comes from lib/products-catalog.js so a flyer can never quote a price
// the order page would not charge.
//
// Read by api/admin.js (the Foxhole's product dropdowns and the flyer sheet
// fetch the list as action=flyer-products) and by api/get-balance.js (a
// scanned code answers with its beta's product so start.html can pitch it).
//
// A product with no story here still gets a flyer: its catalog name, its
// lowest price, the studio's generic steps, and no picture. Add a story to
// give it one.

import { PRODUCTS_CATALOG } from "./products-catalog.js";

const GENERIC_STEPS = [
  "Scan the code and snap a photo: you, a friend, the dog.",
  "Pick a style and watch the studio draw the caricature onto it, in 3D.",
  "Order. It ships to your door, and the flyer code is applied for you."
];

const STORIES = {
  // The smart mug: a black mug that shows nothing until something hot goes
  // in. The COLD / HOT / OTHER SIDE strip is the whole pitch, so it is the
  // picture, full width ("wide"), and the words stay out of its way.
  "smart-mug": {
    label: "SURPRISE!!! Smart Mug",
    headline: "Heat reveals what matters.",
    pitch: "It arrives plain black. Pour something hot and the message appears. A proposal, an apology, a baby reveal, a thank-you: you pick the message, they pick the moment.",
    picture: "art/surprise/proposal-coldhot.jpg",
    wide: true,
    cta: "🎁 Pick my message",
    steps: [
      "Scan the code and pick the message: a proposal, an apology, a reveal, a thank-you.",
      "Order it. It ships to your door, plain black, nothing showing.",
      "Hand it over. Pour something hot. Watch their face."
    ]
  },
  "classic-white-mug": {
    label: "Caricature Coffee Mug",
    headline: "Your face. Your mug.\nMade from one photo.",
    pitch: "Snap a picture, pick a style, and the studio turns it into a caricature that wraps right around a real ceramic coffee mug. Designed on your phone in about two minutes.",
    picture: "mug-classic-white-11oz.png",
    priceNote: "11 oz and 15 oz, dishwasher safe"
  },
  "travel-mug-40oz-insulated": {
    label: "Insulated Travel Mug, 40oz",
    headline: "Your face, on the cup that goes everywhere.",
    pitch: "A 40oz insulated travel mug with your caricature wrapped around it. Designed on your phone from one photo.",
    picture: null
  },
  "coaster-set": {
    label: "Coasters, Set of 4",
    headline: "Four coasters. One face. Every table.",
    pitch: "A set of four coasters with your caricature on every one. Designed on your phone from one photo.",
    picture: "art/options/coaster-square.jpg",
    priceNote: "set of four"
  },
  "coaster-set-round": {
    label: "Round Coasters, Set of 4",
    headline: "Four coasters. One face. Every table.",
    pitch: "A set of four round coasters with your caricature on every one. Designed on your phone from one photo.",
    picture: "art/options/coaster-round.jpg",
    priceNote: "set of four"
  },
  "phone-case-card-holder": {
    label: "Phone Case With Card Holder",
    headline: "Your face on your phone. Your cards in the back.",
    pitch: "A slim case with a card slot on the back and your caricature on the front, for 28 phone models. Designed on your phone from one photo.",
    picture: "art/options/phone-case-card-holder.jpg"
  },
  "phone-case-tough": {
    label: "Tough Phone Case",
    headline: "Your face on your phone.",
    pitch: "A tough case with your caricature on the back. Designed on your phone from one photo.",
    picture: "art/options/phone-case.jpg"
  },
  "tote-bag": {
    label: "Tote Bag",
    headline: "Carry your face around.",
    pitch: "A canvas tote with your caricature on it. Designed on your phone from one photo.",
    picture: "art/options/tote.jpg"
  },
  "unisex-tshirt": {
    label: "T-Shirt",
    headline: "Wear your face.",
    pitch: "Your caricature on a Gildan heavy cotton tee, twelve colours. Designed on your phone from one photo.",
    picture: "art/options/tshirt.jpg"
  },
  "photo-puzzle": {
    label: "Photo Puzzle",
    headline: "Put your face together.",
    pitch: "A jigsaw puzzle of your caricature. Designed on your phone from one photo.",
    picture: "art/options/puzzle.jpg"
  },
  "ceramic-ornament": {
    label: "Ceramic Ornament",
    headline: "Your face, on the tree.",
    pitch: "A ceramic ornament with your caricature on it, four shapes. Designed on your phone from one photo.",
    picture: "art/options/ornament-star.jpg"
  },
  "car-magnet": {
    label: "Car Magnet",
    headline: "Your face, on the bumper.",
    pitch: "A weatherproof magnet with your caricature on it, three sizes. Designed on your phone from one photo.",
    picture: "art/options/magnet-7x4.jpg"
  },
  "sticker-sheet": {
    label: "Sticker Sheet",
    headline: "Stick your face anywhere.",
    pitch: "Four die-cut vinyl stickers of your caricature. Designed on your phone from one photo.",
    picture: "art/options/stickers-large.jpg"
  },
  "wrapping-paper": {
    label: "It's a Wrap",
    headline: "Wrap the present in your face.",
    pitch: "Your own wrapping paper, by the sheet or the roll. Designed on your phone from one photo.",
    picture: "art/options/wrap-roll.jpg"
  },
  "business-cards": {
    label: "Business Cards",
    headline: "The card they keep.",
    pitch: "Business cards with your caricature on them. Designed on your phone from one photo.",
    picture: "art/options/cards-100.jpg"
  },
  "playing-cards": {
    label: "Just Playin'",
    headline: "Deal your face.",
    pitch: "A poker deck with your caricature on the back of every card. Designed on your phone from one photo.",
    picture: "art/playing-cards-tile-preview.png"
  },
  "car-air-freshener": {
    label: "Car Air Freshener",
    headline: "Your face, from the mirror.",
    pitch: "An air freshener with your caricature on it, four scents. Designed on your phone from one photo.",
    picture: "art/options/airfreshener.jpg"
  },
  "suitcase": {
    label: "Suitcase",
    headline: "Nobody grabs the wrong bag.",
    pitch: "A hard-shell suitcase with your caricature on it, three sizes. Designed on your phone from one photo.",
    picture: "art/options/suitcase-medium.jpg"
  }
};

export const DEFAULT_FLYER_PRODUCT = "classic-white-mug";

function lowestPrice(product) {
  // A size's price, or its own colours' prices where a colour carries one
  // (the gift-boxed phone case), the way create-checkout-session resolves it.
  const prices = [];
  for (const size of Object.values(product.sizes || {})) {
    if (!size) continue;
    if (typeof size.price === "number" && Number.isFinite(size.price)) prices.push(size.price);
    for (const c of size.colors || []) if (typeof c?.price === "number" && Number.isFinite(c.price)) prices.push(c.price);
  }
  if (!prices.length) return null;
  return { min: Math.min(...prices), ladder: Math.max(...prices) > Math.min(...prices) };
}

function build(key) {
  const product = PRODUCTS_CATALOG[key];
  if (!product) return null;
  const priced = lowestPrice(product);
  if (!priced) return null; // a price ladder the studio keeps itself (the poster)
  const price = priced.min;
  const story = STORIES[key] || {};
  const label = story.label || product.displayName || key;
  return {
    key,
    label,
    headline: story.headline || `Your face. Your ${label.toLowerCase()}.`,
    pitch: story.pitch || `Your caricature on a real ${label.toLowerCase()}. Designed on your phone from one photo, shipped to your door.`,
    steps: story.steps || GENERIC_STEPS,
    picture: story.picture || null,
    wide: !!story.wide,
    cta: story.cta || "🎨 Start designing",
    price,
    // "from" only when the sizes really differ in price, as the studio's tiles do.
    priceText: (priced.ladder ? "from $" : "$") + price.toFixed(2),
    priceNote: story.priceNote || null
    // Not the catalog's estimatedProfit: this list is served without a
    // password, and the margin is nobody's business but Alyx's.
  };
}

// Every product a flyer can feature: the ones with a story first, in the
// order above (the smart mug leads), then the rest of the catalog by name.
export function flyerProducts() {
  const storied = Object.keys(STORIES).map(build).filter(Boolean);
  const rest = Object.keys(PRODUCTS_CATALOG)
    .filter(k => !STORIES[k])
    .map(build).filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...storied, ...rest];
}

export function flyerProduct(key) {
  return key ? build(String(key)) : null;
}
