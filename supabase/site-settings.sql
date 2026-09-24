-- The kill switch. One row, flipped from admin.html when the generator
-- has to come down in a hurry.
--
-- Safe to re-run: creates nothing that already exists and never touches
-- an existing value.
--
-- Paste the whole file into Supabase -> SQL Editor -> New query -> Run.

create table if not exists site_settings (
  id                  int primary key,
  maintenance_mode    boolean     not null default false,
  maintenance_message text        not null default '',
  maintenance_eta     text        not null default '',
  updated_at          timestamptz not null default now(),
  constraint site_settings_single_row check (id = 1)
);

-- Exactly one row, id 1. Re-running leaves an existing row untouched.
insert into site_settings (id, maintenance_mode, maintenance_message, maintenance_eta)
values (1, false, '', '')
on conflict (id) do nothing;

-- THE PAYMENT TRACK (24 Sep 2026): which payment company carries a sale,
-- 'stripe' (the default) or 'square'. Flipped from admin.html. An order paid
-- with a Square gift card goes to Square whatever this says. Safe to re-run.
alter table site_settings add column if not exists payment_rail text not null default 'stripe';
