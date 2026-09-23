-- SF Leisure Discovery — initial schema.
--
-- Two concerns, kept separate: who runs things (businesses) and what is
-- actually happening at a given day and time (sessions).
--
-- The one property worth guarding: maxed_out is DERIVED, never stored. In the
-- source data it is always people_attending >= capacity, and a stored copy
-- would silently go stale the moment someone signs up. A browse UI that shows
-- a "Full" badge next to 11/16 seats is worse than no badge at all, so the
-- database computes it and no writer can disagree.
--
-- This is public reference data — anyone may read it, nobody may write it
-- through the anon key. See the RLS block at the bottom.

-- ---------------------------------------------------------------------------
-- businesses — the venues, one row each
-- ---------------------------------------------------------------------------

create table public.businesses (
  id           uuid primary key default gen_random_uuid(),

  name         text not null unique check (length(btrim(name)) > 0),
  neighborhood text not null check (length(btrim(neighborhood)) > 0),
  address      text not null check (length(btrim(address)) > 0),

  created_at   timestamptz not null default now()
);

comment on table public.businesses is
  'SF small businesses hosting leisure sessions. Name is the natural key.';

-- ---------------------------------------------------------------------------
-- sessions — a recurring weekly slot at a business
-- ---------------------------------------------------------------------------

create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,

  day_of_week      text not null check (day_of_week in (
                     'Monday','Tuesday','Wednesday','Thursday',
                     'Friday','Saturday','Sunday')),
  start_time       time not null,

  activity_label   text not null check (activity_label in (
                     'cafe_hangout','class_workshop','park_event','food_tasting',
                     'arts_craft','community_meetup','fitness_casual','family_playtime')),
  audience_age     text not null check (audience_age in (
                     'kids','teens','adults','seniors','all_ages')),

  capacity         integer not null check (capacity > 0),
  people_attending integer not null default 0 check (people_attending >= 0),

  -- Derived, not stored input. Writers set capacity and people_attending;
  -- Postgres decides whether the session is full.
  maxed_out        boolean generated always as (people_attending >= capacity) stored,

  -- Lets PostgREST sort chronologically. Ordering by the day NAME gives
  -- Friday, Monday, Saturday... which is never what a weekly view wants.
  day_index        smallint generated always as (
                     case day_of_week
                       when 'Monday'    then 1
                       when 'Tuesday'   then 2
                       when 'Wednesday' then 3
                       when 'Thursday'  then 4
                       when 'Friday'    then 5
                       when 'Saturday'  then 6
                       when 'Sunday'    then 7
                     end) stored,

  created_at       timestamptz not null default now(),

  -- A venue cannot hold two sessions in the same slot. Also makes the seed
  -- in 0002 safely re-runnable.
  unique (business_id, day_of_week, start_time)
);

comment on column public.sessions.maxed_out is
  'Generated: people_attending >= capacity. Never write this directly.';

create index sessions_activity_idx  on public.sessions (activity_label);
create index sessions_audience_idx  on public.sessions (audience_age);
create index sessions_day_idx       on public.sessions (day_index, start_time);
create index businesses_hood_idx    on public.businesses (neighborhood);

-- ---------------------------------------------------------------------------
-- sessions_public — the flat shape the app actually consumes
-- ---------------------------------------------------------------------------
--
-- Column names here intentionally match the original dataset, so the Worker
-- can hand PostgREST rows straight to the frontend with no mapping layer.
-- security_invoker makes the view respect the caller's RLS rather than the
-- view owner's — without it the policies below would be bypassed.

create view public.sessions_public
with (security_invoker = true) as
select
  s.id,
  b.name         as business_name,
  b.neighborhood,
  b.address      as location,
  s.day_of_week  as day,
  s.start_time   as time,
  s.activity_label,
  s.audience_age,
  s.capacity,
  s.people_attending,
  s.maxed_out,
  s.day_index
from public.sessions s
join public.businesses b on b.id = s.business_id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- Supabase returns an empty result set rather than an error when RLS is on and
-- no policy matches, so a missing read policy looks exactly like an empty
-- table. Read is open; writes are deliberately absent, which leaves them to
-- service_role (it bypasses RLS entirely).

alter table public.businesses enable row level security;
alter table public.sessions   enable row level security;

create policy "businesses are publicly readable"
  on public.businesses for select
  to anon, authenticated
  using (true);

create policy "sessions are publicly readable"
  on public.sessions for select
  to anon, authenticated
  using (true);

grant select on public.businesses     to anon, authenticated;
grant select on public.sessions       to anon, authenticated;
grant select on public.sessions_public to anon, authenticated;
