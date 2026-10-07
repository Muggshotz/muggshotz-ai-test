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
// (the shelf's picture: the design flat, setup then punchline); and the tile
// art/options/surprise-<file>.jpg.
// tools/surprise/holiday-mug.py makes all of them from the artist's file;
// then one line here and the same line in needles-studio.html's copy
// (flow-tests/verify-surprise-sets.js holds the two together).
//
// FRAMES (Alyx, 29 Sep 2026): a decal mug with frames: true also comes in
// two frames the customer picks on the shelf, like a prop: <file>-one-print.png
// (one frame round everything) and <file>-two-print.png (a frame round each
// side), built by tools/surprise/decal-mug.py <file> autumn. The page names a
// framed mug as its key and the frame, "pardon~one"; no frame is the key alone.
export const SET_FRAMES = { one: "One frame", two: "A frame each side" };

// The first four designs are the holiday's own set, the four an order that
// names no mugs (a basket saved before the mugs could be chosen) is made of.

export const SURPRISE_SETS = {
  thanksgiving: {
    label: "Thanksgiving",
    live: true,
    designs: [
      { key: "power-out", label: "Power's Out", file: "thanksgiving-power-out", frames: true },
      { key: "witness", label: "Witness Protection", file: "thanksgiving-witness", frames: true },
      { key: "pardon", label: "The Pardon", file: "thanksgiving-pardon", frames: true },
      { key: "chickens", label: "All These Chickens", file: "thanksgiving-chickens", frames: true },
      { key: "golden-brown", label: "Golden Brown", file: "golden-brown", frames: true },
      { key: "thankful", label: "Thankful", file: "thankful", frames: true },
      { key: "uncle-gerald", label: "Uncle Gerald", file: "uncle-gerald", frames: true },
      { key: "the-diet", label: "The Diet", file: "the-diet", frames: true },
      { key: "dark-meat", label: "Dark Meat", file: "dark-meat", frames: true }
    ]
  },
  halloween: {
    label: "Halloween",
    live: true,
    designs: [
      { key: "boo", label: "Boo", file: "halloween-boo-ghost-one" },   // first: it is on the flyer
      { key: "raise-the-dead", label: "Raise the Dead", file: "halloween-raise-the-dead-one" },
      { key: "sheet-happens", label: "Sheet Happens", file: "halloween-boo-one" },
      { key: "goes-right-through-me", label: "Goes Right Through Me", file: "halloween-goes-right-through-me-one" },
      { key: "when-pumpkins-dream", label: "When Pumpkins Dream", file: "halloween-when-pumpkins-dream-one" },
      { key: "sugar-skull", label: "Sugar Skull", file: "halloween-sugar-skull" },
      { key: "witching-hour", label: "The Witching Hour", file: "halloween-witching-hour-one" },
      { key: "whats-your-type", label: "What's Your Type?", file: "halloween-whats-your-type-one" },
      { key: "deadlines", label: "Deadlines", file: "halloween-deadlines-one" },
      { key: "skeleton-crew", label: "Skeleton Crew", file: "halloween-skeleton-crew-one" },
      { key: "ghosted", label: "Ghosted", file: "halloween-ghosted-one" },
      { key: "the-email", label: "Could've Been an Email", file: "halloween-the-email-one" },
      { key: "dentist", label: "Well, There's Your Problem", file: "halloween-dentist-one" },   // in I'll Sleep When I'm Dead's place (Alyx, 7 Oct 2026)
      { key: "marigold-raven", label: "Ornate Raven", file: "halloween-marigold-raven" },
      { key: "marigold-cat", label: "Ornate Cat", file: "halloween-marigold-cat" },
      { key: "marigold-jack-o-lantern", label: "Ornate Jack-o’-Lantern", file: "halloween-marigold-jack-o-lantern" },
      { key: "marigold-moon-bats", label: "Ornate Moon & Bats", file: "halloween-marigold-moon-bats" },
      { key: "marigold-owl", label: "Ornate Owl", file: "halloween-marigold-owl" },
      { key: "marigold-hand", label: "Ornate Hand", file: "halloween-marigold-hand" },
      { key: "marigold-cauldron", label: "Ornate Cauldron", file: "halloween-marigold-cauldron" },
      { key: "marigold-spider", label: "Ornate Spider", file: "halloween-marigold-spider" },
      { key: "marigold-haunted-house", label: "Ornate Haunted House", file: "halloween-marigold-haunted-house" },
      { key: "marigold-bat", label: "Ornate Bat", file: "halloween-marigold-bat" },
      { key: "marigold-ghost", label: "Ornate Ghost", file: "halloween-marigold-ghost" },
      { key: "silhouette-pumpkin", label: "Silhouette Pumpkin", file: "halloween-silhouette-pumpkin" },
      { key: "silhouette-spider", label: "Silhouette Spider", file: "halloween-silhouette-spider" },
      { key: "silhouette-cat", label: "Silhouette Cat", file: "halloween-silhouette-cat" },
      { key: "silhouette-witch", label: "Silhouette Witch", file: "halloween-silhouette-witch" },
      { key: "silhouette-tree", label: "Silhouette Tree", file: "halloween-silhouette-tree" },
      { key: "silhouette-skull", label: "Silhouette Skull", file: "halloween-silhouette-skull" },
      { key: "silhouette-cauldron", label: "Silhouette Cauldron", file: "halloween-silhouette-cauldron" },
      { key: "silhouette-hand", label: "Silhouette Hand", file: "halloween-silhouette-hand" },
      { key: "silhouette-raven", label: "Silhouette Raven", file: "halloween-silhouette-raven" },
      { key: "silhouette-haunted-house", label: "Silhouette Haunted House", file: "halloween-silhouette-haunted-house" },
      { key: "silhouette-bat", label: "Silhouette Bat", file: "halloween-silhouette-bat" },
      { key: "silhouette-ghost", label: "Silhouette Ghost", file: "halloween-silhouette-ghost" }
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
    const [key, frame] = String(k).split("~");
    const d = set.designs.find((x) => x.key === key);
    if (!d) throw new Error("One of those mugs isn't available.");
    if (frame == null) return d;
    // A design that is always framed already prints its framed file (the
    // Halloween story mugs, 6 Oct 2026); an older basket naming the frame still orders it.
    if (d.file.endsWith(`-${frame}`)) return d;
    // frames: true is every frame; a list names the design's own (Halloween: ["one"]).
    const allowed = d.frames === true ? Object.keys(SET_FRAMES) : Array.isArray(d.frames) ? d.frames : [];
    if (!SET_FRAMES[frame] || !allowed.includes(frame)) throw new Error("One of those frames isn't available.");
    return { ...d, key: k, file: `${d.file}-${frame}`, label: `${d.label} (${SET_FRAMES[frame].toLowerCase()})` };
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
