// occasions/thanksgiving.js -- THE THANKSGIVING PAGE (muggshotz.com/thanksgiving)
//
// A copy of occasions/halloween.js (read that file's notes: what each field
// is, and that prices come from lib/products-catalog.js, never from here).
// Built 31 Oct 2026 from Bud's flyer "Amuse Your Guests From Greet to Eat!"
// (art/occasions/thanksgiving/README.md): three products, in the flyer's
// order -- doormats at the door, placemats at the table, magic mugs in the
// hand (Alyx, 29 Oct: "three places a guest looks").
//
// ON THE FLYER, FIRST (standard practice): Gary, the Flock and the Itinerary
// lead the mats; the Eating Itinerary, the verse and Customs lead the
// placemats; The Pardon is the demonstration mug and leads the set.
window.OCCASION = {
  key: "thanksgiving",
  title: "Thanksgiving at Muggshotz",
  headline: "Amuse Your Guests",
  headlineBig: "From Greet to Eat!",
  // The flyer's own hero, cropped from Bud's flyer (31 Oct 2026); replaced by
  // his banner of it if one comes.
  banner: "art/occasions/thanksgiving/banner.jpg",
  subline: "Doormats, placemats and magic mugs for the table this Thanksgiving.",
  orderBy: "Order now so it arrives before Thanksgiving.",
  colors: { bg: "#1c1109", panel: "#2b1a0d", accent: "#e9a93a", accent2: "#c7442a", text: "#f6ecd9", muted: "#c7b08f" },

  // Consignment: a year after the day after Thanksgiving 2026 (26 Nov).
  consign: { event: "Thanksgiving", until: "27 November 2027" },

  featured: {
    title: "Thanksgiving Welcome Mats",
    line: "18 x 30 in doormat",
    catalog: "doormat", size: "18 x 30",
    order: { productIcon: "doormat" },
    dir: "art/thanksgiving-mats", show: [900, 552],
    idea: {
      code: "THANKSGIVING", page: "/thanksgiving", size: "1536x1024",
      rule: "doormat artwork: a wide landscape composition, 18 by 30 inches, bold shapes and large lettering readable from standing height, no fine detail, the subject and any words kept well inside the edges",
      placeholder: "A turkey in sunglasses at the door, saying \"Nobody here but us chickens\"",
    },
    designs: [
      // On the flyer, first, in the flyer's order.
      { key: "have-you-seen-gary", label: "Have You Seen Gary?" },
      { key: "get-the-flock-in-here", label: "Get the Flock in Here" },
      { key: "itinerary", label: "Thanksgiving Itinerary" },
      // Then the rest, in the order they were agreed (art/thanksgiving-mats/README.md).
      { key: "witness-protection", label: "Witness Protection" },
      { key: "welcome-to-our-flock", label: "Welcome to Our Flock" },
      { key: "at-last-the-turkeys-here", label: "At Last, the Turkey's Here" },
      { key: "pardoned", label: "Pardoned" },
      { key: "youre-late-we-ate", label: "You're Late. We Ate." },
      { key: "stretchy-pants", label: "Stretchy Pants" },
      { key: "give-thanks-eat-pie", label: "Come In, Give Thanks, Eat Pie" },
      { key: "food-coma", label: "Food Coma" },           // name is Claude's; Alyx to rename
      { key: "pilgrim-toast", label: "Pilgrim's Toast" }, // name is Claude's; Alyx to rename
      { key: "customs", label: "Thanksgiving Customs" },
      { key: "shoes-and-politics", label: "Shoes and Politics at the Door" },
      { key: "come-in-no-you-cant-help", label: "No, You Can't Help" },
      { key: "gobble-till-you-wobble", label: "Gobble Till You Wobble" },
      { key: "howdy-pilgrim", label: "Howdy Pilgrim" },
      { key: "are-you-our-leader", label: "Are You Our Leader?" },
      { key: "send-fred-out", label: "Just Send Fred Out" }
    ]
  },

  magicMugs: {
    title: "Thanksgiving Magic Mugs",
    line: "The picture appears when you pour in something hot.",
    set: "thanksgiving",
    demo: "thanksgiving-pardon-one",   // The Pardon, framed, as on the flyer
    idea: {
      code: "THANKSGIVING", page: "/thanksgiving", size: "1536x1024", ratio: 2475 / 1155,
      rule: "a Magic Mug's wrap, printed all the way round an 11oz mug: two separate sticker-style scenes side by side on pure white, the punchline on the left half and the setup on the right half, each kept well inside its own half with white around it; any words in quotation marks lettered big and readable inside the scene they belong to; bold shapes, no fine detail",
      placeholder: { first: "A turkey on a therapist's couch, wings folded", then: "The therapist, notepad out: \"And how does November make you feel?\"" }
    }
  },

  moreTitle: "And for the table",
  more: [
    // The placemats are on the flyer, so they show (a product with designs
    // shows; one without stays off the page). The neoprene placemat, as the
    // Halloween page offers; its designs' prints at its own 5610 x 3839.
    { key: "placemats", title: "Thanksgiving Placemats", line: "Neoprene placemat, 18 x 12 in, the middle left clear for the plate",
      catalog: "placemat-neoprene", size: "12 x 18 in", kind: "placemat", placemat: "Neoprene", pic: "art/thanksgiving-placemats/show/eating-itinerary.jpg",
      designs: [
        // On the flyer, first, in the flyer's order.
        { key: "eating-itinerary", label: "The Eating Itinerary", file: "art/thanksgiving-placemats/print/eating-itinerary.jpg", pic: "art/thanksgiving-placemats/show/eating-itinerary.jpg" },
        { key: "two-or-three", label: "Where Two or Three Are Gathered", file: "art/thanksgiving-placemats/print/two-or-three.jpg", pic: "art/thanksgiving-placemats/show/two-or-three.jpg" },
        { key: "customs-black", label: "Thanksgiving Customs", file: "art/thanksgiving-placemats/print/customs-black.jpg", pic: "art/thanksgiving-placemats/show/customs-black.jpg" },
        { key: "pardoned", label: "Pardoned", file: "art/thanksgiving-placemats/print/pardoned.jpg", pic: "art/thanksgiving-placemats/show/pardoned.jpg" },
        { key: "reserved-for-turkey", label: "Reserved for Turkey", file: "art/thanksgiving-placemats/print/reserved-for-turkey.jpg", pic: "art/thanksgiving-placemats/show/reserved-for-turkey.jpg" },
        { key: "clean-plate-club", label: "The Clean Plate Club", file: "art/thanksgiving-placemats/print/clean-plate-club.jpg", pic: "art/thanksgiving-placemats/show/clean-plate-club.jpg" },
        { key: "save-room-for-pie", label: "Save Room for Pie", file: "art/thanksgiving-placemats/print/save-room-for-pie.jpg", pic: "art/thanksgiving-placemats/show/save-room-for-pie.jpg" },
        { key: "lucky-seat", label: "The Lucky Seat", file: "art/thanksgiving-placemats/print/lucky-seat.jpg", pic: "art/thanksgiving-placemats/show/lucky-seat.jpg" },
        { key: "kids-table", label: "The Kids' Table", file: "art/thanksgiving-placemats/print/kids-table.jpg", pic: "art/thanksgiving-placemats/show/kids-table.jpg" }
      ] },
    { key: "coffee-mugs", title: "Coffee Mugs", line: "11oz ceramic mug, the picture all the way round",
      catalog: "classic-white-mug", size: "11oz", kind: "mug", pic: "mug-classic-white-11oz.webp", designs: [] },
    { key: "coasters", title: "Coasters", line: "Set of four, 4 x 4 in",
      catalog: "coaster-set", size: "4\" x 4\"", kind: "coaster", pic: "art/options/coaster-square.jpg", designs: [] }
  ]
};
