-- THE VISITOR COUNT (Alyx, 5 Oct 2026: "monitor how many times a website has
-- been visited by someone outside, and maintain a running count ... in my
-- command center, the admin page").
--
-- One row per day, page and source (the flyer's ?from= tag, '' for none),
-- holding two numbers: visits (a browser counts once per page per day) and
-- new_visitors (of those, browsers the site had never seen before). No names,
-- no IP addresses, nothing about who: only counts.
--
-- Only the site's own server (the service role) reads or writes it: row level
-- security is on with no policies, and the counting function is not callable
-- by the public keys.
--
-- Safe to re-run: creates nothing that already exists and never touches an
-- existing count.
--
-- Paste the whole file into Supabase -> SQL Editor -> New query -> Run.

create table if not exists page_visits (
  day          date    not null,
  page         text    not null,
  source       text    not null default '',
  visits       integer not null default 0,
  new_visitors integer not null default 0,
  primary key (day, page, source)
);

alter table page_visits enable row level security;

-- Adds one visit (and one new visitor, when p_new) to the day's row, making
-- the row on the day's first visit. One statement, so two visits arriving
-- together both count.
create or replace function count_visit(p_day date, p_page text, p_source text, p_new boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into page_visits (day, page, source, visits, new_visitors)
  values (p_day, p_page, p_source, 1, case when p_new then 1 else 0 end)
  on conflict (day, page, source) do update
    set visits       = page_visits.visits + 1,
        new_visitors = page_visits.new_visitors + excluded.new_visitors;
$$;

revoke execute on function count_visit(date, text, text, boolean) from public, anon, authenticated;
grant execute on function count_visit(date, text, text, boolean) to service_role;
