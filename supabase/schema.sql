-- MOSAIC — database schema.
--
-- Run this once in the Supabase SQL editor. It is safe to re-run.
--
-- Two tables. Identifying data about minors lives in `sessions` and nowhere
-- else; `events` carries only region indices, colour indices and timings, so
-- the behavioural data can be shared or analysed without carrying names.

create table if not exists sessions (
  id uuid primary key,
  first_name text not null,
  last_initial text not null,
  grade text not null,
  user_agent text,
  screen_w int,
  screen_h int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed boolean not null default false
);

-- One append-only table with a JSONB payload rather than a table per event
-- type. You will think of an analysis in March that you did not plan for in
-- September, and JSONB can answer it.
create table if not exists events (
  id bigserial primary key,
  session_id uuid not null references sessions(id),
  seq int not null,
  type text not null,
  payload jsonb not null default '{}',
  client_ts timestamptz not null,
  server_ts timestamptz not null default now(),
  unique (session_id, seq)
);

create index if not exists events_session_seq_idx on events (session_id, seq);
create index if not exists events_type_idx on events (type);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- The anon key ships inside the client bundle and anyone can read it out of
-- devtools. RLS is the only thing stopping one student reading every other
-- student's session. Insert is granted; select, update and delete are not.
-- You read the data with the service_role key, from your own machine only.
-- ---------------------------------------------------------------------------

alter table sessions enable row level security;
alter table events enable row level security;

drop policy if exists anon_insert_sessions on sessions;
drop policy if exists anon_insert_events on events;

create policy anon_insert_sessions on sessions for insert to anon with check (true);
create policy anon_insert_events on events for insert to anon with check (true);

-- Verify by hand after running this. Both rows must show rowsecurity = true.
--
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('sessions', 'events');

-- ---------------------------------------------------------------------------
-- Analysis starters
--
-- `sessions.ended_at` and `completed` stay null by design: the client is not
-- granted UPDATE, so completion is derived from the session_end event rather
-- than written back.
-- ---------------------------------------------------------------------------

-- One row per participant, with derived timing.
--
--   select s.id, s.first_name, s.last_initial, s.grade,
--          min(e.server_ts) filter (where e.type = 'session_start') as started,
--          max(e.server_ts) filter (where e.type = 'session_end')   as ended,
--          bool_or(e.type = 'session_end')                          as completed
--   from sessions s left join events e on e.session_id = s.id
--   group by s.id order by started;

-- How often students carried on without a forced move available — the moment
-- the most-constrained-first heuristic is actually required.
--
--   select payload->>'level' as level, count(*) as stalls
--   from events where type = 'no_forced_moves'
--   group by 1 order by 1;

-- Attempted illegal colours per level: did they test the rule, or read it?
--
--   select payload->>'level' as level, count(*) as blocked_attempts
--   from events where type = 'colour_blocked'
--   group by 1 order by 1;

-- Helper usage per level.
--
--   select payload->>'level' as level, type, count(*)
--   from events
--   where type in ('hint_most_constrained', 'hint_suggest', 'hint_walkthrough_start')
--   group by 1, 2 order by 1, 2;
