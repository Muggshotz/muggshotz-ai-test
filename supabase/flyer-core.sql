-- The flyer system's core: the two tables every flyer code lives in, the
-- table that stops a notification email sending twice, the events table
-- that stops an order crediting twice, and the two Postgres functions the
-- API calls (fn_credit_commission from api/stripe-webhook.js on every
-- settled sale with a flyer code; fn_beta_available_balance from
-- api/get-balance.js and the webhook's $100 milestone).
--
-- WHY THIS FILE EXISTS (25 Sep 2026): the code has called these since July,
-- but no SQL in the repo defined them -- they were made by hand in the
-- Supabase dashboard, so a fresh project could not be rebuilt from files.
-- This is that definition, as the code expects it.
--
-- SAFE TO RUN ON THE LIVE PROJECT: every table is `if not exists`, and each
-- function is created only if no function of that name exists yet, so a
-- hand-made one is never replaced. Run this BEFORE supabase/flyer-ledger.sql
-- on a new project (the ledger adds columns to flyer_betas).
--
-- Check first, on the live project: Database -> Functions should list
-- fn_credit_commission and fn_beta_available_balance. If it does, this file
-- changes nothing there.

-- 1. Betas: one row per person handing out flyers. base_code is the printed
--    prefix (CHIPPER in CHIPPER-07). id is a uuid, as on the live project
--    (its fn_beta_available_balance takes p_beta_id uuid; seen 25 Sep 2026).
create table if not exists flyer_betas (
  id                          uuid primary key default gen_random_uuid(),
  full_name                   text not null,
  base_code                   text not null unique,
  contact_email               text,
  current_tier                text not null default 'PotShotz',
  total_balance_notified_100  boolean not null default false,
  created_at                  timestamptz not null default now()
);

-- 2. Codes: one row per printed flyer. code is globally unique (a tier
--    upgrade mints CHIPPER-H01, never CHIPPER-01 twice; lib/flyer-tiers.js).
create table if not exists flyer_codes (
  id                bigserial unique,
  code              text primary key,
  beta_id           uuid not null references flyer_betas(id),
  tier              text not null,
  flyer_number      integer not null,
  commission_rate   numeric(5,4) not null,
  cap_amount        numeric(10,2) not null,
  commission_total  numeric(10,2) not null default 0,
  matured           boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists flyer_codes_beta_idx on flyer_codes (beta_id);

-- 3. Every credit, once per order: a webhook delivered twice credits once.
create table if not exists flyer_commission_events (
  id          bigserial primary key,
  code        text not null references flyer_codes(code),
  beta_id     uuid not null,
  order_id    text not null unique,
  net_profit  numeric(10,2) not null,
  credited    numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

-- 4. One-time emails (tier matured, $100 crossed): the webhook inserts here
--    first and only sends when the insert succeeds. tier is null for the
--    $100 email, so the uniqueness is on coalesce(tier, '').
create table if not exists flyer_notifications_sent (
  id                 bigserial primary key,
  beta_id            uuid not null,
  notification_type  text not null,
  tier               text,
  sent_at            timestamptz not null default now()
);
create unique index if not exists flyer_notifications_once
  on flyer_notifications_sent (beta_id, notification_type, coalesce(tier, ''));

-- 5. fn_credit_commission(p_code, p_order_id, p_net_profit)
--    -> credited_amount, new_total, newly_matured
--    Credits rate x net profit to the code, never past its cap, marks it
--    matured when the cap is reached, and records the order so a repeat
--    credits nothing. Raises on an unknown code (the webhook logs it as a
--    CRITICAL and the order is still fulfilled).
do $do$
begin
  if not exists (select 1 from pg_proc where proname = 'fn_credit_commission') then
    execute $fn$
      create function fn_credit_commission(p_code text, p_order_id text, p_net_profit numeric)
      returns table(credited_amount numeric, new_total numeric, newly_matured boolean)
      language plpgsql as $body$
      declare
        c        flyer_codes%rowtype;
        v_credit numeric(10,2);
        v_total  numeric(10,2);
        v_mature boolean;
      begin
        select * into c from flyer_codes where code = upper(p_code) for update;
        if not found then
          raise exception 'Unknown flyer code %', p_code;
        end if;
        if exists (select 1 from flyer_commission_events e where e.order_id = p_order_id) then
          return query select 0::numeric, c.commission_total::numeric, false;
          return;
        end if;
        v_credit := least(round(c.commission_rate * p_net_profit, 2), greatest(c.cap_amount - c.commission_total, 0));
        v_total  := c.commission_total + v_credit;
        v_mature := v_total >= c.cap_amount;
        update flyer_codes set commission_total = v_total, matured = v_mature where code = c.code;
        insert into flyer_commission_events (code, beta_id, order_id, net_profit, credited)
          values (c.code, c.beta_id, p_order_id, p_net_profit, v_credit);
        return query select v_credit::numeric, v_total::numeric, (v_mature and not c.matured);
      end
      $body$;
    $fn$;
  end if;
end
$do$;

-- 6. fn_beta_available_balance(p_beta_id) -> numeric
--    What all of a beta's codes have earned. Payouts come off in the API
--    (flyer_payouts, supabase/flyer-ledger.sql), not here.
do $do$
begin
  if not exists (select 1 from pg_proc where proname = 'fn_beta_available_balance') then
    execute $fn$
      create function fn_beta_available_balance(p_beta_id uuid)
      returns numeric
      language sql stable as $body$
        select coalesce(sum(commission_total), 0)::numeric from flyer_codes where beta_id = p_beta_id;
      $body$;
    $fn$;
  end if;
end
$do$;

-- 7. The service role (the API) bypasses row-level security; this keeps the
--    anon key out.
alter table flyer_betas               enable row level security;
alter table flyer_codes               enable row level security;
alter table flyer_commission_events   enable row level security;
alter table flyer_notifications_sent  enable row level security;
