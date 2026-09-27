// lib/surprise-sets.js
//
// THE SURPRISE!!! HOLIDAY MUGS (Alyx, 26-27 Sep 2026). A holiday is a shelf
// of single smart-mug designs, and the customer mixes and matches them: "you
// decide the participants". Any four, repeats and all, are a set at the
// catalog's "smart-mug-set" price ($59.95); more mugs with a set are $17.95
// each (extraPrice); fewer than four are $19.95 each, the single smart mug's
// price. holidayPrice() is that rule, and the only place it lives.
//
// The page sends which holiday, which hand and which mugs, by key; the print
// files are named here, on the server, so nothing can be printed but a
// design on this list. However many mugs, it is one line at checkout, one
// parcel, one Printify order of that many mugs.
//
// A design's files live in art/surprise/, as the single SURPRISE!!! mugs'
// do: <file>-print.png (right-handed: the punchline on the LEFT half, the
// side that turns to face the drinker last) and <file>-print-left.png (the
// left-handed layout), both 2475 x 1155; <file>-coldhot.jpg; show/<file>.jpg
// (the shelf's picture); and the tile art/options/surprise-<file>.jpg.
// tools/surprise/holiday-mug.py makes all of them from the artist's file;
// then one line here and the same line in needles-studio.html's copy
// (flow-tests/verify-surprise-sets.js holds the two together).
//
// The first four designs are the holiday's own set, the four an order that
// names no mugs (a basket saved before the mugs could be chosen) is made of.

export const SURPRISE_SETS = {
  thanksgiving: {
    label: "Thanksgiving",
    live: true,
    designs: [
      { key: "power-out", label: "Power's Out", file: "thanksgiving-power-out" },
      { key: "witness", label: "Witness Protection", file: "thanksgiving-witness" },
      { key: "pardon", label: "The Pardon", file: "thanksgiving-pardon" },
      { key: "chickens", label: "All These Chickens", file: "thanksgiving-chickens" },
      { key: "golden-brown", label: "Golden Brown", file: "golden-brown" },
      { key: "thankful", label: "Thankful", file: "thankful" },
      { key: "uncle-gerald", label: "Uncle Gerald", file: "uncle-gerald" },
      { key: "the-diet", label: "The Diet", file: "the-diet" },
      { key: "dark-meat", label: "Dark Meat", file: "dark-meat" }
    ]
  }
};

export function surpriseSet(key) {
  const s = SURPRISE_SETS[String(key || "")];
  return s && s.live ? s : null;
}

// The site's own address, the way api/create-printify-order.js finds it: the
// print files are fetched from here by the order code.
function siteBaseUrl() {
  const h = process.env.SITE_BASE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "muggshotz-ai-test.vercel.app";
  return (/^https?:\/\//.test(h) ? h : "https://" + h).replace(/\/$/, "");
}

// The most mugs one order line may hold.
export const MAX_HOLIDAY_MUGS = 24;

// The mugs an order names, each checked against the holiday's list. Throws
// on anything not on it. No list at all is the holiday's own four.
export function holidayMugs(set, keys) {
  if (keys == null) return set.designs.slice(0, 4);
  if (!Array.isArray(keys) || !keys.length) throw new Error("Please pick at least one mug.");
  if (keys.length > MAX_HOLIDAY_MUGS) throw new Error(`One order holds up to ${MAX_HOLIDAY_MUGS} mugs.`);
  return keys.map((k) => {
    const d = set.designs.find((x) => x.key === k);
    if (!d) throw new Error("One of those mugs isn't available.");
    return d;
  });
}

// Alyx's prices: fewer than four, each at the single's price; four, the set;
// more, the set and each extra at the set's extra price. In dollars.
export function holidayPrice(n, { setPrice, extraPrice, singlePrice }) {
  const cents = n >= 4
    ? Math.round(setPrice * 100) + (n - 4) * Math.round(extraPrice * 100)
    : n * Math.round(singlePrice * 100);
  return cents / 100;
}

export function setPrintUrls(mugs, hand) {
  const suffix = hand === "left" ? "-print-left.png" : "-print.png";
  return mugs.map((d) => `${siteBaseUrl()}/art/surprise/${d.file}${suffix}`);
}
