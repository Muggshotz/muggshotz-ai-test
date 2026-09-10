-- Flyer commissions ledger + campaigns (Sep 2026).
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Everything here is additive: no existing table, column, or function is
-- changed, so the running shop keeps working before AND after.

-- 1. Payouts: one row each time Alyx pays a beta. The balance page and the
--    admin ledger subtract these from what the codes have earned.
--    beta_id is stored as text so this works whatever type flyer_betas.id
--    is (the API compares as text).
create table if not exists flyer_payouts (
  id         bigserial primary key,
  beta_id    text not null,
  amount     numeric(10,2) not null check (amount > 0),
  note       text,
  paid_at    timestamptz not null default now()
);
create index if not exists flyer_payouts_beta_idx on flyer_payouts (beta_id);

-- 2. Campaigns: "this product, this audience, this many packs". A beta may
--    belong to one; when a campaign's packs are all handed out it is full
--    and onboarding into it is refused.
create table if not exists campaigns (
  id               bigserial primary key,
  name             text not null,
  product_key      text not null,
  packs_available  integer not null default 20 check (packs_available >= 0),
  notes            text,
  created_at       timestamptz not null default now()
);

-- 3. Three optional columns on the beta. All nullable; nothing existing
--    needs them.
alter table flyer_betas add column if not exists contact_phone    text;
alter table flyer_betas add column if not exists featured_product text;
alter table flyer_betas add column if not exists campaign_id      bigint references campaigns(id);

-- 4. The service role (what the API uses) already bypasses row-level
--    security. If RLS is enabled on new tables by default in this project,
--    these keep the anon key OUT of them -- the API is the only reader.
alter table flyer_payouts enable row level security;
alter table campaigns     enable row level security;
