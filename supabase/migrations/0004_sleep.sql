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
