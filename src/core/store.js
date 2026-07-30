/* =========================================================================
   REACTIVE STATE STORE
   Single source of truth. Recomputes derived telemetry (PRs, streaks, energy,
   radar axes, muscle heat) whenever raw data changes, then emits 'store'.
   ========================================================================= */
import * as db from './db.js';
import { bus, LS, iso, today, weekKey, clamp, estimate1RM, round1, sum } from './util.js';
import { TRACKS, TRACK_BY_CODE, ACHIEVEMENTS, BOSSES } from './presets.js';
import { WEEKLY_SESSION_QUOTA } from '../config.js';

export const S = {
  loading: true,
  profile: null,
  logs: [],
  catalog: [],
  gear: [],
  achievements: [],
  bossDefeats: [],
  sleep: [],
  /* derived */
  pr: {}, targets: {}, weekSessions: 0, quota: WEEKLY_SESSION_QUOTA,
  streak: 0, energy: 100, expMultiplier: 1, radar: {}, muscleHeat: {},
  weekHistory: [], byDate: new Map(), selectedDate: today(),
  sleepStats: null,
};

export async function hydrate() {
  S.loading = true; emit();
  const [profile, logs, catalog, gear, achievements, bossDefeats, sleep] = await Promise.all([
    db.getProfile(), db.listLogs({ limit: 2000 }), db.listCatalog(),
    db.listGear(), db.listAchievements(), db.listBossDefeats(), db.listSleep(),
  ]);
  Object.assign(S, { profile, logs, catalog, gear, achievements, bossDefeats, sleep, loading: false });
  recompute();
  emit();
  return S;
}

export const emit = () => bus.emit('store', S);

/* ========================= DERIVED TELEMETRY ============================= */
export function recompute() {
  const p = S.profile ?? {};
  S.quota = p.weekly_quota ?? WEEKLY_SESSION_QUOTA;

  /* --- targets from profile --- */
  S.targets = Object.fromEntries(TRACKS.map(t => [t.code, Number(p[t.targetKey] ?? t.defaultTarget)]));

  /* --- index logs by date --- */
  S.byDate = new Map();
  for (const l of S.logs) {
    if (!S.byDate.has(l.performed_on)) S.byDate.set(l.performed_on, []);
    S.byDate.get(l.performed_on).push(l);
  }

  /* --- personal records per track --- */
  S.pr = {};
  for (const t of TRACKS) {
    const rows = S.logs.filter(l => l.track === t.code);
    let best = 0;
    if (t.metric === 'load')  best = Math.max(0, ...rows.map(r => Number(r.est_1rm) || estimate1RM(r.weight_kg, r.reps)));
    if (t.metric === 'hold')  best = Math.max(0, ...rows.map(r => Number(r.hold_seconds) || 0));
    if (t.metric === 'angle') best = Math.max(0, ...rows.map(r => Number(r.angle_degrees) || 0));
    S.pr[t.code] = round1(best);
  }

  /* --- weekly compliance + streak --- */
  const weeks = new Map();
  for (const l of S.logs) {
    if (!['gym', 'calisthenics'].includes(l.kind)) continue;
    const wk = weekKey(l.performed_on);
    if (!weeks.has(wk)) weeks.set(wk, new Set());
    weeks.get(wk).add(l.performed_on);
  }
  const thisWk = weekKey();
  S.weekSessions = weeks.get(thisWk)?.size ?? 0;

  const ordered = [...weeks.entries()].map(([wk, set]) => ({ wk, n: set.size })).sort((a, b) => a.wk < b.wk ? 1 : -1);
  S.weekHistory = ordered.slice(0, 14).reverse();
  let streak = 0;
  for (const { wk, n } of ordered) {
    if (wk === thisWk && n < S.quota) continue;       // current week still in progress
    if (n >= S.quota) streak++; else break;
  }
  S.streak = streak;

  /* --- energy cells: decay from days since last session + weekly shortfall - */
  const lastDay = S.logs[0]?.performed_on;
  const idle = lastDay ? Math.floor((Date.parse(today()) - Date.parse(lastDay)) / 864e5) : 9;
  const shortfall = Math.max(0, S.quota - S.weekSessions);
  S.energy = clamp(100 - idle * 11 - shortfall * 9, 0, 100);
  S.depleted = S.energy < 35;

  /* --- EXP multiplier from equipped cyberware --- */
  const equipped = S.gear.filter(g => g.equipped).map(g => g.gear_code);
  S.expMultiplier = round1(equipped.reduce((m, code) => {
    const item = S.catalog.find(c => c.code === code);
    return m * (item ? Number(item.exp_multiplier) : 1);
  }, 1) * 100) / 100;

  /* --- radar axes 0..100 --- */
  /* Доля от собственной цели, обрезанная на 100. Верхнюю границу держим
     ровно на 100, потому что многоугольник радара всё равно не выходит
     за внешнее кольцо: иначе подпись «107» спорила бы с фигурой.
     Перевыполненная цель — повод поднять её в профиле, а не растянуть ось. */
  const rel = code => clamp((S.pr[code] / (S.targets[code] || 1)) * 100, 0, 100);
  const vol30 = sum(S.logs.filter(l => l.performed_on >= isoAgo(30)).map(l =>
    (Number(l.weight_kg) || 0) * (Number(l.reps) || 0) * (Number(l.sets) || 1)));
  S.radar = {
    POWER:       Math.round((rel('bench') + rel('squat') + rel('deadlift')) / 3),
    BALANCE:     Math.round(rel('handstand')),
    FLEXIBILITY: Math.round(rel('split')),
    HYPERTROPHY: Math.round(clamp(vol30 / 400, 0, 100)),
    CONTROL:     Math.round(rel('planche')),
    ENDURANCE:   Math.round(clamp(sum(S.logs.filter(l => l.performed_on >= isoAgo(30))
                    .map(l => Number(l.duration_min) || 0)) / 12, 0, 100)),
  };

  /* --- muscle heat over the last 14 days (0..1) --- */
  const heat = {};
  const since = isoAgo(14);
  for (const l of S.logs) {
    if (l.performed_on < since) continue;
    const age = Math.floor((Date.parse(today()) - Date.parse(l.performed_on)) / 864e5);
    const w = Math.max(0.15, 1 - age / 14);
    for (const m of (l.muscles ?? [])) heat[m] = (heat[m] ?? 0) + w;
  }
  const peak = Math.max(1, ...Object.values(heat));
  S.muscleHeat = Object.fromEntries(Object.entries(heat).map(([k, v]) => [k, v / peak]));

  /* --- сон --- */
  S.sleepStats = computeSleep();

  document.body.classList.toggle('low-power', !!S.depleted);
}

/* ─────────────────────────── СОН ───────────────────────────
   Цель — подъём в 05:00. Всё считаем в минутах от полуночи;
   для подъёмов после полуночи, но до 12:00, это работает линейно.
   Подъём в 23:50 (крайне поздний отбой) даёт 1430 — такие записи
   в дрейф не берём, иначе одна ошибка ввода перекосит среднее. */
function computeSleep() {
  const p = S.profile ?? {};
  const targetMin = hm(p.target_wake ?? '05:00');
  const tol = Number(p.wake_tolerance_min ?? 15);
  const need = Number(p.target_sleep_min ?? 450);
  const rows = (S.sleep ?? []).filter(r => r.wake_time);

  const withDrift = rows.map(r => {
    const w = hm(r.wake_time);
    const drift = w > 900 ? w - 1440 - targetMin : w - targetMin;  // 23:50 → −310
    return { ...r, wakeMin: w, drift, onTarget: Math.abs(drift) <= tol };
  });

  const last14 = withDrift.slice(0, 14);
  const last7  = withDrift.slice(0, 7);

  /* серия: подряд идущие календарные дни, где подъём в допуске */
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const key = iso(cur);
    const rec = withDrift.find(r => r.slept_on === key);
    if (!rec) { if (i === 0) { cur.setDate(cur.getDate() - 1); continue; } break; }
    if (!rec.onTarget) break;
    streak++; cur.setDate(cur.getDate() - 1);
  }

  const avg = arr => arr.length ? Math.round(sum(arr) / arr.length) : null;
  const avgWake  = avg(last14.map(r => r.wakeMin));
  const avgDrift = avg(last14.map(r => r.drift));
  const avgDur   = avg(last14.filter(r => r.duration_min).map(r => r.duration_min));
  const hit14 = last14.filter(r => r.onTarget).length;

  /* долг сна за 7 дней — сколько недобрали против нормы */
  const debt = last7.reduce((a, r) => a + Math.max(0, need - (r.duration_min ?? need)), 0);

  return {
    rows: withDrift,
    today: withDrift.find(r => r.slept_on === today()) ?? null,
    targetMin, tol, need,
    bedtimeAdvice: mmss(((targetMin - need) % 1440 + 1440) % 1440),
    streak, avgWake, avgDrift, avgDur,
    hit14, rate14: last14.length ? Math.round((hit14 / last14.length) * 100) : 0,
    debtMin: debt,
    logged: rows.length,
  };
}

/** «05:30» → 330 */
export const hm = t => {
  const [h, m] = String(t ?? '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** 330 → «05:30» */
export const mmss = min => {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
/** 452 → «7 ч 32 мин» */
export const dur = min => {
  if (min === null || min === undefined) return '—';
  const v = Math.max(0, Math.round(min));
  return `${Math.floor(v / 60)} ч ${String(v % 60).padStart(2, '0')} мин`;
};

const isoAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

/* ============================== MUTATIONS =============================== */

/** Log a session. Returns { row, pr, exp, credits, achievements[] }. */
export async function logSession(entry) {
  const t = TRACK_BY_CODE[entry.track];
  if (t) {
    entry.kind ??= t.kind;
    entry.exercise ??= t.name;
    entry.muscles ??= t.muscles;
    if (t.metric === 'load' && entry.weight_kg && entry.reps)
      entry.est_1rm = estimate1RM(entry.weight_kg, entry.reps);
  }

  /* PR detection against the pre-write record */
  const before = t ? (S.pr[t.code] ?? 0) : 0;
  let value = 0;
  if (t?.metric === 'load')  value = Number(entry.est_1rm) || 0;
  if (t?.metric === 'hold')  value = Number(entry.hold_seconds) || 0;
  if (t?.metric === 'angle') value = Number(entry.angle_degrees) || 0;
  const isPR = !!t && value > before && value > 0;
  entry.is_pr = isPR;

  const row = await db.addLog(entry);
  S.logs.unshift(row);

  /* rewards */
  const baseExp = { gym: 90, calisthenics: 70, mobility: 45, cardio: 40, rest: 5 }[row.kind] ?? 50;
  const exp = Math.round((baseExp + (isPR ? 220 : 0)) * S.expMultiplier);
  const credits = Math.round((28 + (isPR ? 180 : 0)) * (S.profile?.god_mode ? 3 : 1));

  await grant({ exp, credits });
  recompute();
  const unlocked = await checkAchievements();
  emit();

  const delta = isPR ? round1(value - before) : 0;
  bus.emit('session:logged', { row, isPR, delta, exp, credits, track: t });
  if (isPR) bus.emit('pr:beaten', { track: t, value, before, delta });
  return { row, isPR, delta, exp, credits, achievements: unlocked };
}

export async function grant({ exp = 0, credits = 0 }) {
  const p = S.profile; if (!p) return;
  const patch = {
    experience: Math.max(0, (p.experience ?? 0) + exp),
    nano_credits: Math.max(0, (p.nano_credits ?? 0) + credits),
    weekly_streak: S.streak,
  };
  const next = await db.saveProfile(patch);
  S.profile = next ?? { ...p, ...patch };
  emit();
  if (exp) bus.emit('exp:gain', exp);
  if (credits) bus.emit('credits:gain', credits);
}

export async function spend(credits) {
  const p = S.profile;
  if (!p || (p.nano_credits ?? 0) < credits) return false;
  const next = await db.saveProfile({ nano_credits: p.nano_credits - credits });
  S.profile = next ?? { ...p, nano_credits: p.nano_credits - credits };
  emit(); return true;
}

export async function purchase(code) {
  const item = S.catalog.find(c => c.code === code);
  if (!item) return { ok: false, reason: 'UNKNOWN MODULE' };
  if (S.gear.some(g => g.gear_code === code)) return { ok: false, reason: 'ALREADY INSTALLED' };
  if (!await spend(item.cost)) return { ok: false, reason: 'INSUFFICIENT NANO-CREDITS' };
  S.gear = await db.buyGear(code);
  recompute(); emit();
  bus.emit('gear:installed', item);
  return { ok: true, item };
}

export async function equip(code, on) {
  S.gear = await db.toggleEquip(code, on);
  recompute(); emit();
}

export async function setProfile(patch) {
  const next = await db.saveProfile(patch);
  S.profile = next ?? { ...S.profile, ...patch };
  recompute(); emit();
  return S.profile;
}

export async function removeLog(id) {
  await db.deleteLog(id);
  S.logs = S.logs.filter(l => l.id !== id);
  recompute(); emit();
}

/** Записать сон за ночь. Возвращает { row, onTarget, drift, exp }. */
export async function logSleep(entry) {
  const row = await db.upsertSleep(entry);
  S.sleep = [row, ...S.sleep.filter(r => r.slept_on !== row.slept_on)];
  recompute();

  const rec = S.sleepStats?.rows.find(r => r.slept_on === row.slept_on);
  const onTarget = !!rec?.onTarget;
  const exp = Math.round((onTarget ? 60 : 20) * S.expMultiplier);
  await grant({ exp, credits: onTarget ? 25 : 8 });

  recompute();
  const unlocked = await checkAchievements();
  emit();
  bus.emit('sleep:logged', { row, onTarget, drift: rec?.drift ?? 0, exp });
  return { row, onTarget, drift: rec?.drift ?? 0, exp, achievements: unlocked };
}

export async function removeSleep(id) {
  await db.deleteSleep(id);
  S.sleep = S.sleep.filter(r => r.id !== id);
  recompute(); emit();
}

/* --------------------------- ACHIEVEMENT SWEEP -------------------------- */
export async function checkAchievements() {
  const have = new Set(S.achievements.map(a => a.code));
  const snapshot = {
    logs: S.logs, pr: S.pr, streak: S.streak, quota: S.quota,
    weekSessions: S.weekSessions, bw: Number(S.profile?.bodyweight_kg) || 0,
    sleep: S.sleepStats ?? { streak: 0, rate14: 0, logged: 0 },
  };
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.code)) continue;
    let ok = false; try { ok = a.test(snapshot); } catch {}
    if (!ok) continue;
    const row = await db.unlockAchievement(a);
    if (row) { S.achievements.unshift(row); fresh.push(a); await grant({ exp: a.exp, credits: Math.round(a.exp / 2) }); }
  }
  if (fresh.length) { emit(); fresh.forEach(a => bus.emit('achievement:unlocked', a)); }
  return fresh;
}

/* ------------------------------ SELECTORS ------------------------------- */
export const logsOn = date => S.byDate.get(date) ?? [];
export const intensityOn = date => {
  const rows = logsOn(date); if (!rows.length) return 0;
  const mins = sum(rows.map(r => Number(r.duration_min) || 25));
  if (rows.some(r => r.is_pr) || mins >= 90) return 3;
  return mins >= 50 ? 2 : 1;
};
export const trackLogs = code => S.logs.filter(l => l.track === code);
export const trackSeries = (code, n = 20) => {
  const t = TRACK_BY_CODE[code]; if (!t) return [];
  const key = t.metric === 'load' ? 'est_1rm' : t.metric === 'hold' ? 'hold_seconds' : 'angle_degrees';
  return trackLogs(code).slice(0, n).reverse()
    .map(l => ({ x: l.performed_on, y: Number(l[key]) || 0 })).filter(p => p.y > 0);
};
export const progressPct = code =>
  clamp(((S.pr[code] ?? 0) / (S.targets[code] || 1)) * 100, 0, 100);

export const availableBosses = () => {
  const beaten = new Set(S.bossDefeats.map(b => b.boss_code));
  return BOSSES.map(b => {
    const t = TRACK_BY_CODE[b.track];
    const ratio = (S.pr[b.track] ?? 0) / (S.targets[b.track] || 1);
    return { ...b, beaten: beaten.has(b.code), unlocked: ratio >= b.unlock.at, ratio, trackMeta: t };
  });
};

export const equippedGear = () =>
  S.gear.filter(g => g.equipped).map(g => S.catalog.find(c => c.code === g.gear_code)).filter(Boolean);
