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
