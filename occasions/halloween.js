// occasions/halloween.js -- THE HALLOWEEN PAGE (muggshotz-ai-test.vercel.app/halloween)
//
// Everything that changes from one occasion to the next lives here; occasion.html
// itself never changes (Alyx, 3 Oct 2026: "build in a 'plug and play' way which
// allows us to quickly re-tool it for whatever special occasion"). A new occasion
// is a copy of this file under its own name, its pictures, and one line in
// vercel.json for its short address.
//
//   featured   the occasion's main product: its designs' print files sit in
//              <dir>/print/<key>.jpg and their pictures in <dir>/show/<key>.jpg
//              (tools/premade-fit.py makes both).
//   magicMugs  a holiday in SURPRISE_SETS (magic-mug.js): its mugs, demonstrated
//              and turning; demo is the design the heat-up shows.
//   more       "a few more of our favorites", 3 or 4 at most. A product with no
//              designs yet stays off the page. Each design: { key, label, file }
//              where file is its print (a coffee mug's full wrap, 2475 x 1155;
//              a coaster's or placemat's own print shape) and pic its picture.
//
// Prices are never written here: the page reads them from lib/products-catalog.js.
window.OCCASION = {
  key: "halloween",
  title: "Halloween at Muggshotz",
  // Two lines, the last the big one (Alyx, 3 Oct 2026: "The Floor at Your Door is
  // a Bore" -- the floor takes the blame, not the reader).
  headline: "The Floor at Your Door",
  headlineBig: "Is a Bore.",
  subline: "Fix that this Halloween!",
  orderBy: "Order now so it arrives before Halloween.",
  colors: { bg: "#0d0a12", panel: "#17121f", accent: "#ff7a1a", accent2: "#8bd34a", text: "#f3ead8", muted: "#b9a98f" },

  featured: {
    title: "Halloween Welcome Mats",
    line: "18 x 30 in doormat",
    catalog: "doormat", size: "18 x 30",
    order: { productIcon: "doormat" },
    dir: "art/unwelcome", show: [900, 552],
    designs: [
      { key: "six-feet-under", label: "Six Feet Under" },
      { key: "vampires-welcome", label: "Consider Yourself Inbited" },
      { key: "care-for-a-bite", label: "Care for a Bite?" },
      { key: "treat-or-trick", label: "Treat or Trick" },
      { key: "my-parlor", label: "Welcome to My Parlor" },
      { key: "ouija", label: "Ouija" },
      { key: "witch-parking", label: "Witch Parking Only" },
      { key: "dying-to-meet-you", label: "We're Dying to Meet You" },
      { key: "beware-of-ghost", label: "Beware of Ghost" },
      { key: "go-away", label: "Go Away" },
      { key: "no-soliciting", label: "No Soliciting" },
      { key: "no-body-here", label: "No Body Here" },
      { key: "rising-skeleton", label: "Rising Skeleton" },
      { key: "under-the-boards", label: "Under the Boards" },
      { key: "witch-puddle", label: "Witch Puddle" },
      { key: "three-black-cats", label: "Three Black Cats" },
      { key: "skeleton-gate", label: "Skeleton Gate" },
      { key: "pumpkin-cats", label: "Pumpkin Cats" },
      { key: "ghost-letters", label: "Ghost Letters" },
      { key: "zombie-sign", label: "Zombie Sign" },
      { key: "spider-web", label: "Spider Web" },
      { key: "bat-sign", label: "Bat Sign" },
      { key: "coffin-sign", label: "Coffin Sign" },
      { key: "halloween-silhouettes", label: "Witch Silhouette" }
    ]
  },

  magicMugs: {
    title: "Halloween Magic Mugs",
    line: "The picture appears when you pour in something hot.",
    set: "halloween",
    demo: "halloween-raise-the-dead"
  },

  moreTitle: "While you're here, take a look at a few more of our favorites",
  more: [
    { key: "coffee-mugs", title: "Coffee Mugs", line: "11oz ceramic mug, the picture all the way round",
      catalog: "classic-white-mug", size: "11oz", kind: "mug", pic: "mug-classic-white-11oz.webp", designs: [] },
    { key: "coasters", title: "Coasters", line: "Set of four, 4 x 4 in",
      catalog: "coaster-set", size: "4\" x 4\"", kind: "coaster", pic: "art/options/coaster-square.jpg", designs: [] },
    { key: "placemats", title: "Placemats", line: "Neoprene placemat, 18 x 12 in",
      catalog: "placemat-neoprene", size: "12 x 18 in", kind: "placemat", placemat: "Neoprene", pic: "art/options/placemat-neoprene.jpg", designs: [] }
  ]
};
