-- ============================================================================
-- CYBER-TRACKER 365 :: MIGRATION 0001 :: CORE SCHEMA
-- Run in Supabase Dashboard -> SQL Editor, in order (0001 -> 0002 -> 0003).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type track_code as enum ('split','planche','handstand','bench','squat','deadlift');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_kind as enum ('gym','calisthenics','mobility','rest','cardio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gear_slot as enum ('wrist','waist','hands','spine','neural','boots');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- PROFILES  :: operator identity, experience, streaks, economy
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  handle            text unique check (char_length(handle) between 2 and 24),
  avatar_seed       text        not null default 'v-0',
  experience        bigint      not null default 0    check (experience >= 0),
  level             int         not null default 1    check (level >= 1),
  nano_credits      bigint      not null default 250  check (nano_credits >= 0),
  weekly_streak     int         not null default 0    check (weekly_streak >= 0),
  best_weekly_streak int        not null default 0,
  energy            int         not null default 100  check (energy between 0 and 100),
  weekly_quota      int         not null default 3    check (weekly_quota between 1 and 14),
  bodyweight_kg     numeric(5,2),
  god_mode          boolean     not null default false,
  -- hardcoded personal protocol targets
  target_bench_kg    numeric(6,2) not null default 100,
  target_squat_kg    numeric(6,2) not null default 140,
  target_deadlift_kg numeric(6,2) not null default 180,
  target_split_deg   int          not null default 180,
  target_planche_sec int          not null default 15,
  target_handstand_sec int        not null default 60,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'One row per operator. Mirrors auth.users, auto-created on signup.';

-- ---------------------------------------------------------------------------
-- WORKOUT LOGS :: every training event, per track
-- ---------------------------------------------------------------------------
create table if not exists public.workout_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  performed_on   date not null default (now() at time zone 'utc')::date,
  kind           session_kind not null default 'gym',
  track          track_code,
  exercise       text not null,
  -- powerlifting metrics
  weight_kg      numeric(6,2) check (weight_kg >= 0),
  reps           int          check (reps  >= 0),
  sets           int          check (sets  >= 0),
  est_1rm        numeric(6,2) check (est_1rm >= 0),
  -- calisthenics / mobility metrics
  hold_seconds   int  check (hold_seconds >= 0),
  angle_degrees  int  check (angle_degrees between 0 and 200),
  stretch_minutes int check (stretch_minutes >= 0),
  progression    text,                       -- 'tuck' | 'adv_tuck' | 'straddle' | 'full'
  -- shared
  duration_min   int  check (duration_min >= 0),
  muscles        text[] not null default '{}',   -- e.g. {chest,triceps,front_delt}
  rpe            numeric(3,1) check (rpe between 1 and 10),
  is_pr          boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists workout_logs_user_date_idx on public.workout_logs (user_id, performed_on desc);
create index if not exists workout_logs_track_idx     on public.workout_logs (user_id, track, performed_on desc);
create index if not exists workout_logs_muscles_idx   on public.workout_logs using gin (muscles);

-- ---------------------------------------------------------------------------
-- GEAR CATALOG :: purchasable cyberware (public read)
-- ---------------------------------------------------------------------------
create table if not exists public.gear_catalog (
  code         text primary key,
  name         text not null,
  slot         gear_slot not null,
  cost         int  not null check (cost >= 0),
  exp_multiplier numeric(4,2) not null default 1.00,
  rarity       text not null default 'common',
  glyph        text not null default 'x',
  description  text not null default ''
);

-- ---------------------------------------------------------------------------
-- UNLOCKED GEAR :: user inventory
-- ---------------------------------------------------------------------------
create table if not exists public.unlocked_gear (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  gear_code   text not null references public.gear_catalog(code) on delete cascade,
  equipped    boolean not null default false,
  acquired_at timestamptz not null default now(),
  unique (user_id, gear_code)
);

create index if not exists unlocked_gear_user_idx on public.unlocked_gear (user_id);

-- ---------------------------------------------------------------------------
-- ACHIEVEMENTS :: unlocked milestones
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  code         text not null,
  title        text not null,
  tier         text not null default 'bronze',
  payload      jsonb not null default '{}'::jsonb,
  unlocked_at  timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists achievements_user_idx on public.achievements (user_id, unlocked_at desc);

-- ---------------------------------------------------------------------------
-- BOSS DEFEATS :: RPG encounter records
-- ---------------------------------------------------------------------------
create table if not exists public.boss_defeats (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  boss_code   text not null,
  damage_dealt int not null default 0,
  credits_won  int not null default 0,
  defeated_at timestamptz not null default now()
);

create index if not exists boss_defeats_user_idx on public.boss_defeats (user_id, defeated_at desc);

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- auto-provision a profile whenever a user confirms signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'handle',''),
      'OPERATOR_' || substr(replace(new.id::text,'-',''), 1, 6)
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- derive level from experience (250 EXP per level, soft curve)
create or replace function public.sync_level()
returns trigger language plpgsql as $$
begin
  new.level := greatest(1, floor(sqrt(new.experience::numeric / 120.0))::int + 1);
  if new.weekly_streak > new.best_weekly_streak then
    new.best_weekly_streak := new.weekly_streak;
  end if;
  return new;
end $$;

drop trigger if exists profiles_sync_level on public.profiles;
create trigger profiles_sync_level before insert or update of experience, weekly_streak
on public.profiles for each row execute function public.sync_level();

-- ---------------------------------------------------------------------------
-- VIEWS / RPC :: weekly compliance against the 3-session mandate
-- ---------------------------------------------------------------------------
create or replace function public.weekly_compliance(p_weeks int default 12)
returns table (week_start date, sessions bigint, quota int, compliant boolean)
language sql stable security invoker as $$
  select
    date_trunc('week', l.performed_on)::date as week_start,
    count(distinct l.performed_on)           as sessions,
    p.weekly_quota                           as quota,
    count(distinct l.performed_on) >= p.weekly_quota as compliant
  from public.workout_logs l
  join public.profiles p on p.id = l.user_id
  where l.user_id = auth.uid()
    and l.kind in ('gym','calisthenics')
    and l.performed_on >= (current_date - (p_weeks * 7))
  group by 1, 3
  order by 1 desc;
$$;

-- personal records per track
create or replace view public.personal_records as
select
  user_id,
  track,
  max(est_1rm)      as best_1rm,
  max(hold_seconds) as best_hold,
  max(angle_degrees) as best_angle,
  max(performed_on) as last_seen
from public.workout_logs
where user_id = auth.uid()
group by user_id, track;
