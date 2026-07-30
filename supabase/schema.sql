-- ═══════════════════════════════════════════════════════════════
-- CYBER-TRACKER 365 — полная схема одним файлом
-- Supabase → SQL Editor → New query → вставить всё → Run
-- Идемпотентно: можно запускать повторно.
-- ═══════════════════════════════════════════════════════════════

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


-- ============================================================================
-- CYBER-TRACKER 365 :: MIGRATION 0002 :: ROW LEVEL SECURITY
-- Every table is locked to auth.uid(). The anon key alone grants nothing.
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.workout_logs  enable row level security;
alter table public.unlocked_gear enable row level security;
alter table public.achievements  enable row level security;
alter table public.boss_defeats  enable row level security;
alter table public.gear_catalog  enable row level security;

-- ---- PROFILES -------------------------------------------------------------
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---- WORKOUT LOGS ---------------------------------------------------------
drop policy if exists "logs owner all" on public.workout_logs;
create policy "logs owner all" on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- UNLOCKED GEAR --------------------------------------------------------
drop policy if exists "gear owner all" on public.unlocked_gear;
create policy "gear owner all" on public.unlocked_gear
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- ACHIEVEMENTS ---------------------------------------------------------
drop policy if exists "ach owner all" on public.achievements;
create policy "ach owner all" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- BOSS DEFEATS ---------------------------------------------------------
drop policy if exists "boss owner all" on public.boss_defeats;
create policy "boss owner all" on public.boss_defeats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- GEAR CATALOG (public read-only reference data) ------------------------
drop policy if exists "catalog readable" on public.gear_catalog;
create policy "catalog readable" on public.gear_catalog
  for select to authenticated using (true);


-- ============================================================================
-- CYBER-TRACKER 365 :: MIGRATION 0003 :: CYBERWARE CATALOG SEED
-- ============================================================================

insert into public.gear_catalog (code, name, slot, cost, exp_multiplier, rarity, glyph, description) values
  ('titanium_belt',   'Titanium Lifting Belt',   'waist',  1200, 1.15, 'rare',      'BELT', 'Servo-tensioned lumbar brace. +15% EXP on squat & deadlift protocols.'),
  ('magnetic_wraps',  'Magnetic Wrist Traps',    'wrist',   850, 1.10, 'uncommon',  'WRST', 'Electro-magnetic stabilisers. +10% EXP on all pressing protocols.'),
  ('carbon_grips',    'Carbon Nano-Grips',       'hands',   600, 1.08, 'common',    'GRIP', 'Graphene palm lattice. +8% EXP, immunity to grip failure logs.'),
  ('spinal_rig',      'Spinal Exo-Rig MK-II',    'spine',  2400, 1.25, 'epic',      'SPNE', 'Full posterior chain exoskeleton. +25% EXP on all gym sessions.'),
  ('neural_link',     'Neural Focus Link',       'neural', 3600, 1.35, 'legendary', 'NRL',  'Direct cortex overclock. +35% EXP. Boss damage x2.'),
  ('grav_boots',      'Gravity Inversion Boots', 'boots',  1500, 1.18, 'rare',      'BOOT', 'Field-inverting soles. +18% EXP on handstand & planche protocols.'),
  ('hydraulic_hips',  'Hydraulic Hip Actuators', 'waist',  1800, 1.20, 'epic',      'HIPS', 'Micro-actuated hip capsule. +20% EXP on split & mobility work.'),
  ('coolant_sleeve',  'Coolant Sleeve Array',    'wrist',   400, 1.05, 'common',    'COOL', 'Thermal regulation weave. +5% EXP, reduces energy decay rate.')
on conflict (code) do update set
  name = excluded.name, cost = excluded.cost,
  exp_multiplier = excluded.exp_multiplier, description = excluded.description;


-- ═══════════════════════════════════════════════════════════════
-- МИГРАЦИЯ 0004 :: ТРЕКЕР СНА
-- Цель по умолчанию — подъём в 05:00 при 7.5 часах сна.
-- ═══════════════════════════════════════════════════════════════

-- ─────────── цели сна в профиле ───────────
alter table public.profiles
  add column if not exists target_wake      time not null default '05:00',
  add column if not exists target_sleep_min int  not null default 450,   -- 7ч30м
  add column if not exists wake_tolerance_min int not null default 15;   -- допуск к цели

-- ─────────── журнал сна ───────────
-- slept_on — ДАТА ПРОБУЖДЕНИЯ. Так строка «лёг 23:40, встал 05:10»
-- принадлежит одному дню без арифметики над полуночью на клиенте.
create table if not exists public.sleep_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  slept_on     date not null default (now() at time zone 'utc')::date,
  bedtime      time,
  wake_time    time not null,
  duration_min int check (duration_min between 0 and 1200),
  quality      int check (quality between 1 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, slept_on)
);

create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs (user_id, slept_on desc);

-- Длительность считаем на сервере, если клиент её не прислал.
-- Переход через полночь: 23:40 → 05:10 это +330 минут, а не −1110.
create or replace function public.fill_sleep_duration()
returns trigger language plpgsql as $$
declare b int; w int;
begin
  if new.duration_min is null and new.bedtime is not null then
    b := extract(hour from new.bedtime) * 60 + extract(minute from new.bedtime);
    w := extract(hour from new.wake_time) * 60 + extract(minute from new.wake_time);
    new.duration_min := case when w >= b then w - b else w + 1440 - b end;
  end if;
  return new;
end $$;

drop trigger if exists sleep_logs_duration on public.sleep_logs;
create trigger sleep_logs_duration before insert or update on public.sleep_logs
for each row execute function public.fill_sleep_duration();

alter table public.sleep_logs enable row level security;

drop policy if exists "sleep owner all" on public.sleep_logs;
create policy "sleep owner all" on public.sleep_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────── сводка по сну ───────────
-- Отклонение от цели в минутах: положительное — проспал.
create or replace function public.sleep_summary(p_days int default 30)
returns table (
  slept_on      date,
  wake_time     time,
  duration_min  int,
  drift_min     int,
  on_target     boolean
)
language sql stable security invoker as $$
  select
    s.slept_on,
    s.wake_time,
    s.duration_min,
    (extract(hour from s.wake_time) * 60 + extract(minute from s.wake_time))
      - (extract(hour from p.target_wake) * 60 + extract(minute from p.target_wake)) as drift_min,
    abs((extract(hour from s.wake_time) * 60 + extract(minute from s.wake_time))
      - (extract(hour from p.target_wake) * 60 + extract(minute from p.target_wake)))
      <= p.wake_tolerance_min as on_target
  from public.sleep_logs s
  join public.profiles p on p.id = s.user_id
  where s.user_id = auth.uid()
    and s.slept_on >= (current_date - p_days)
  order by s.slept_on desc;
$$;


