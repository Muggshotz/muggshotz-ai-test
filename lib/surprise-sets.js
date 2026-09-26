// lib/surprise-sets.js
//
// THE SURPRISE!!! HOLIDAY SETS (Alyx, 26 Sep 2026: "a set of four different
// themes. Each one is a different scene but they're all a part of the same
// set"; $59.95 the set, "true for the Christmas set, the Halloween set ...
// the Thanksgiving set, and the Valentine's Day set").
//
// A set is four finished smart-mug designs sold as one thing: one line at
// checkout at the catalog's "smart-mug-set" price, four mugs in the parcel,
// one Printify order. The page sends only which set and which hand; the four
// print files are named here, on the server, so a set can never be bought
// with any other artwork on it.
//
// A design's files live in art/surprise/, as the single SURPRISE!!! mugs'
// do: <file>-print.png (right-handed: the punchline on the LEFT half, the
// side that turns to face the drinker last) and <file>-print-left.png (the
// left-handed layout), both 2475 x 1155; <file>-coldhot.jpg; and the tile
// art/options/surprise-<file>.jpg.
//
// A set stays off the page (live: false) until all four designs have every
// file. needles-studio.html keeps its own copy of this list for the panel;
// flow-tests/verify-surprise-sets.js holds the two to each other.

export const SURPRISE_SETS = {
  thanksgiving: {
    label: "Thanksgiving",
    live: true,
    designs: [
      { key: "power-out", label: "Power's Out", file: "thanksgiving-power-out" },
      { key: "witness", label: "Witness Protection", file: "thanksgiving-witness" },
      { key: "pardon", label: "The Pardon", file: "thanksgiving-pardon" },
      { key: "chickens", label: "All These Chickens", file: "thanksgiving-chickens" }
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

export function setPrintUrls(set, hand) {
  const suffix = hand === "left" ? "-print-left.png" : "-print.png";
  return set.designs.map((d) => `${siteBaseUrl()}/art/surprise/${d.file}${suffix}`);
}
