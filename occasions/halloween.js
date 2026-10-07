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
// ON THE FLYER, FIRST (Alyx, 3 Oct 2026, standard practice): whatever the
// occasion's flyer shows -- its mats, its mug -- goes first in these lists, in
// the flyer's order, and the flyer's mug is the demonstration.
//
// Prices are never written here: the page reads them from lib/products-catalog.js.
window.OCCASION = {
  key: "halloween",
  title: "Halloween at Muggshotz",
  // Two lines, the last the big one (Alyx, 3 Oct 2026: "The Floor at Your Door is
  // a Bore" -- the floor takes the blame, not the reader).
  headline: "The Floor at Your Door",
  headlineBig: "Is a Bit of a Bore.",   // anapests: the FLOOR at your DOOR is a BIT of a BORE
  // Bud's banner of the headline and the raccoon (3 Oct 2026), shown in place of
  // the plain words; 2000 x 750.
  banner: "art/occasions/halloween/banner.jpg",
  subline: "Fix that this Halloween!",
  orderBy: "Order now so it arrives before Halloween.",
  colors: { bg: "#0d0a12", panel: "#17121f", accent: "#ff7a1a", accent2: "#8bd34a", text: "#f3ead8", muted: "#b9a98f" },

  // CONSIGNMENT (Alyx, 6-7 Oct 2026): a design submitted from this page's
  // boxes earns 25% of its net profit from the day it goes on sale until one
  // year after the day after the event (TO-DO.md, Consignment): every
  // Halloween 2026 design stops on 1 Nov 2027, however late it came in. The
  // (i) panel reads this; a page without it states the one-year-from-
  // commission rule instead.
  consign: { event: "Halloween", until: "1 November 2027" },

  featured: {
    title: "Halloween Welcome Mats",
    line: "18 x 30 in doormat",
    catalog: "doormat", size: "18 x 30",
    order: { productIcon: "doormat" },
    dir: "art/unwelcome", show: [900, 552],
    // "GOT A BETTER IDEA?" (Alyx, 6-7 Oct 2026): the grid's last tile, where a
    // visitor describes their own mat. It paints a mat and only a mat, in the
    // mat's print shape, exactly as the studio's described doormat does
    // (needles-studio.html getProductRules('doormat') and DOORMAT_RATIO). code
    // is the flyer's free-try code in lib/card-bonus.js: two free tries for a
    // confirmed email, from the flyers' pool of 300 (lib/free-pool.js).
    // THE CANVAS, NOT A STRIP (Alyx's first live mat, 7 Oct 2026, painted as a
    // thin strip with white above and below): told a 1.63 band, the painter
    // letterboxes a narrow panorama in its 1.5 canvas. A mat is nearly the
    // canvas's own shape, so it fills the canvas edge to edge, and the tile
    // and the print both cut it to the mat's 1.63 from the centre (4% off
    // the top and bottom), so what they see is what prints.
    idea: {
      code: "HALLOWEEN", page: "/halloween", size: "1536x1024",
      rule: "doormat artwork: a wide landscape composition, 18 by 30 inches, bold shapes and large lettering readable from standing height, no fine detail, the subject and any words kept well inside the edges",
      placeholder: "A black cat in a witch's hat, saying \"Go away, we're napping\"",
    },
    designs: [
      // On the flyer, first, in the flyer's order (Alyx, 3 Oct 2026: standard practice).
      { key: "halloween-silhouettes", label: "Witch Silhouette" },
      { key: "vampires-welcome", label: "Consider Yourself Inbited" },
      { key: "treat-or-trick", label: "Treat or Trick" },
      { key: "six-feet-under", label: "Six Feet Under" },
      { key: "care-for-a-bite", label: "Care for a Bite?" },
      { key: "my-parlor", label: "Welcome to My Parlor" },
      { key: "ouija", label: "The Ouija Says Goodbye" },
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
      { key: "take-one", label: "Take One" },  // in Pumpkin Cats' place (Alyx, 6 Oct 2026)
      { key: "ghost-letters", label: "Ghost Letters" },
      { key: "zombie-sign", label: "Zombie Sign" },
      { key: "spider-web", label: "Spider Web" },
      { key: "bat-sign", label: "Bat Sign" },
      { key: "coffin-sign", label: "Coffin Sign" }
    ]
  },

  magicMugs: {
    title: "Halloween Magic Mugs",
    line: "The picture appears when you pour in something hot.",
    set: "halloween",
    demo: "halloween-boo-ghost-one",   // Boo, in the Trick or Treat frame (Alyx, 3 Oct 2026)
    frameLabel: "Trick or Treat frame",
    // "GOT A BETTER IDEA?" on the Magic Mugs too (Alyx, 7 Oct 2026: "the same
    // box at the end of the magic mugs ... comprehensively across all product
    // lines"). Two halves to describe, painted as one wrap in the decal mugs'
    // own manner (tools/surprise/decal-mug.py): two sticker scenes on white,
    // the punchline left and the setup right. The print's 2475 x 1155 shape
    // is told to the painter as ratio (a strip across its 3:2 canvas) and cut
    // out of the painting by the page (occasion.html ideaMugBand).
    idea: {
      code: "HALLOWEEN", page: "/halloween", size: "1536x1024", ratio: 2475 / 1155,
      rule: "a Magic Mug's wrap, printed all the way round an 11oz mug: two separate sticker-style scenes side by side on pure white, the punchline on the left half and the setup on the right half, each kept well inside its own half with white around it; any words in quotation marks lettered big and readable inside the scene they belong to; bold shapes, no fine detail",
      placeholder: { first: "A vampire in the dentist's chair, mouth wide open", then: "The dentist, holding a mirror: \"Well, there's your problem\"" }
    }
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
