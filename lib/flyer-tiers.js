// The flyer tier ladder, in one place. The webhook (tier upgrades paid
// through Stripe) and the admin panel (onboarding a brand-new beta at the
// entry tier) both mint codes, and they must mint them identically or a
// beta's second tier would not line up with their first.
export const TIER_SEQUENCE = ["PotShotz", "HotShotz", "BiggsHotz", "Muggshotz"];

// Rate, per-flyer cap, and flyer count for each tier.
export const TIER_RULES = {
  PotShotz:  { rate: 0.03, cap: 20.00,  flyerCount: 20 },
  HotShotz:  { rate: 0.04, cap: 30.00,  flyerCount: 20 },
  BiggsHotz: { rate: 0.05, cap: 50.00,  flyerCount: 20 },
  Muggshotz: { rate: 0.05, cap: 100.00, flyerCount: 40 }
};

// A code's printed suffix needs a tier-specific prefix, because
// flyer_codes.code is a globally unique primary key — without this, a
// beta upgrading tiers would try to create CHIPPER-01 a second time
// (their PotShotz tier already used it) and the insert would fail.
// PotShotz keeps a bare number (matches flyers already onboarded/
// printed by the admin tool before this prefix scheme existed).
export const TIER_CODE_PREFIX = {
  PotShotz: "",
  HotShotz: "H",
  BiggsHotz: "B",
  Muggshotz: "M"
};

export const TIER_UPGRADE_LABEL = {
  PotShotz: { next: "HotShotz", buyIn: "$20" },
  HotShotz: { next: "BiggsHotz", buyIn: "$50" },
  BiggsHotz: { next: "Muggshotz", buyIn: "$200" },
  Muggshotz: { next: null, buyIn: null }
};

// The full set of flyer_codes rows for one beta at one tier, ready to
// POST to Supabase. CHIPPER at PotShotz -> CHIPPER-01 .. CHIPPER-20.
export function buildTierCodes(betaId, baseCode, tier) {
  const rules = TIER_RULES[tier];
  if (!rules) throw new Error(`No TIER_RULES entry for "${tier}".`);
  const prefix = TIER_CODE_PREFIX[tier] ?? "";
  const rows = [];
  for (let i = 1; i <= rules.flyerCount; i++) {
    rows.push({
      beta_id: betaId,
      tier,
      code: `${baseCode}-${prefix}${String(i).padStart(2, "0")}`,
      flyer_number: i,
      commission_rate: rules.rate,
      cap_amount: rules.cap,
      commission_total: 0,
      matured: false
    });
  }
  return rows;
}
