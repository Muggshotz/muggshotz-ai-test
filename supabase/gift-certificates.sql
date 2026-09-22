-- Gift certificates: store credit on a ledger (see GIFT-CERTIFICATES.md).
-- Safe to re-run: creates nothing that already exists.
--
-- Paste the whole file into Supabase -> SQL Editor -> New query -> Run.

create table if not exists gift_certificates (
  code              text primary key,
  amount_cents      integer     not null check (amount_cents > 0),
  balance_cents     integer     not null check (balance_cents >= 0),
  buyer_email       text        not null default '',
  recipient_email   text        not null default '',
  recipient_name    text        not null default '',
  message           text        not null default '',
  stripe_session_id text        unique,
  issued_at         timestamptz not null default now(),
  voided_at         timestamptz
);

create table if not exists gift_certificate_uses (
  id                bigserial primary key,
  code              text        not null references gift_certificates(code),
  order_session_id  text        not null unique,
  cents_used        integer     not null check (cents_used > 0),
  used_at           timestamptz not null default now()
);

-- Only the server (service role) reads or writes these. No public access.
alter table gift_certificates enable row level security;
alter table gift_certificate_uses enable row level security;
