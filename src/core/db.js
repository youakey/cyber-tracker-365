/* =========================================================================
   DATA ACCESS LAYER
   Every function works in both LIVE (Supabase) and GHOST (localStorage) mode
   with an identical return shape, so the UI never branches on backend state.
   ========================================================================= */
import { sb, isGhost, withDb } from './supabase.js';
import { state as auth } from './auth.js';
import { LS, iso, today } from './util.js';
import { GEAR_FALLBACK, TRACKS } from './presets.js';

const uid = () => auth.user?.id ?? 'anon';
const K = {
  profile: () => `ct365.${uid()}.profile`,
  logs:    () => `ct365.${uid()}.logs`,
  gear:    () => `ct365.${uid()}.gear`,
  ach:     () => `ct365.${uid()}.ach`,
  boss:    () => `ct365.${uid()}.boss`,
  sleep:   () => `ct365.${uid()}.sleep`,
};

const blankProfile = () => ({
  id: uid(),
  handle: auth.user?.user_metadata?.handle || 'OPERATOR_' + uid().slice(0, 6).toUpperCase(),
  avatar_seed: 'v-0', experience: 0, level: 1, nano_credits: 250,
  weekly_streak: 0, best_weekly_streak: 0, energy: 100, weekly_quota: 3,
  bodyweight_kg: null, god_mode: false,
  target_bench_kg: 100, target_squat_kg: 140, target_deadlift_kg: 180,
  target_split_deg: 180, target_planche_sec: 15, target_handstand_sec: 60,
  target_wake: '05:00', target_sleep_min: 450, wake_tolerance_min: 15,
  created_at: new Date().toISOString(),
});

/* ------------------------------- PROFILE -------------------------------- */
export async function getProfile() {
  if (isGhost()) {
    let p = LS.get(K.profile());
    if (!p) { p = blankProfile(); LS.set(K.profile(), p); }
    return p;
  }
  const row = await withDb(async c => {
    const { data, error } = await c.from('profiles').select('*').eq('id', uid()).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // trigger should have made it; self-heal if not
    const { data: made, error: e2 } = await c.from('profiles')
      .insert({ id: uid(), handle: blankProfile().handle }).select().single();
    if (e2) throw e2;
    return made;
  }, null);
  return row ?? blankProfile();
}

export async function saveProfile(patch) {
  if (isGhost()) {
    const p = { ...(LS.get(K.profile()) ?? blankProfile()), ...patch };
    p.level = Math.max(1, Math.floor(Math.sqrt(p.experience / 120)) + 1);
    p.best_weekly_streak = Math.max(p.best_weekly_streak ?? 0, p.weekly_streak ?? 0);
    LS.set(K.profile(), p);
    return p;
  }
  return withDb(async c => {
    const { data, error } = await c.from('profiles').update(patch).eq('id', uid()).select().single();
    if (error) throw error;
    return data;
  }, null);
}

/* -------------------------------- LOGS ---------------------------------- */
export async function listLogs({ from = null, limit = 1000 } = {}) {
  if (isGhost()) {
    let rows = LS.get(K.logs(), []);
    if (from) rows = rows.filter(r => r.performed_on >= from);
    return rows.sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1)).slice(0, limit);
  }
  return withDb(async c => {
    let q = c.from('workout_logs').select('*').eq('user_id', uid())
      .order('performed_on', { ascending: false }).limit(limit);
    if (from) q = q.gte('performed_on', from);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, []);
}

export async function addLog(entry) {
  const row = {
    user_id: uid(),
    performed_on: entry.performed_on || today(),
    kind: entry.kind || 'gym',
    track: entry.track ?? null,
    exercise: entry.exercise || 'UNSPECIFIED',
    weight_kg: num(entry.weight_kg), reps: num(entry.reps), sets: num(entry.sets),
    est_1rm: num(entry.est_1rm),
    hold_seconds: num(entry.hold_seconds), angle_degrees: num(entry.angle_degrees),
    stretch_minutes: num(entry.stretch_minutes),
    progression: entry.progression ?? null,
    duration_min: num(entry.duration_min),
    muscles: entry.muscles ?? [],
    rpe: num(entry.rpe),
    is_pr: !!entry.is_pr,
    notes: entry.notes ?? null,
  };
  if (isGhost()) {
    const rows = LS.get(K.logs(), []);
    row.id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    row.created_at = new Date().toISOString();
    rows.unshift(row); LS.set(K.logs(), rows);
    return row;
  }
  return withDb(async c => {
    const { data, error } = await c.from('workout_logs').insert(row).select().single();
    if (error) throw error;
    return data;
  }, { ...row, id: 'tmp' });
}

export async function deleteLog(id) {
  if (isGhost()) { LS.set(K.logs(), LS.get(K.logs(), []).filter(r => r.id !== id)); return true; }
  return withDb(async c => {
    const { error } = await c.from('workout_logs').delete().eq('id', id).eq('user_id', uid());
    if (error) throw error;
    return true;
  }, false);
}

/* -------------------------------- GEAR ---------------------------------- */
export async function listCatalog() {
  if (isGhost()) return GEAR_FALLBACK;
  const rows = await withDb(async c => {
    const { data, error } = await c.from('gear_catalog').select('*').order('cost');
    if (error) throw error;
    return data;
  }, null);
  return rows?.length ? rows : GEAR_FALLBACK;
}

export async function listGear() {
  if (isGhost()) return LS.get(K.gear(), []);
  return withDb(async c => {
    const { data, error } = await c.from('unlocked_gear').select('*').eq('user_id', uid());
    if (error) throw error;
    return data ?? [];
  }, []);
}

export async function buyGear(code) {
  if (isGhost()) {
    const rows = LS.get(K.gear(), []);
    if (rows.some(r => r.gear_code === code)) return rows;
    rows.push({ id: 'g' + Date.now().toString(36), user_id: uid(), gear_code: code, equipped: true, acquired_at: new Date().toISOString() });
    LS.set(K.gear(), rows); return rows;
  }
  return withDb(async c => {
    const { error } = await c.from('unlocked_gear')
      .insert({ user_id: uid(), gear_code: code, equipped: true });
    if (error && error.code !== '23505') throw error;
    return listGear();
  }, []);
}

export async function toggleEquip(code, equipped) {
  if (isGhost()) {
    const rows = LS.get(K.gear(), []).map(r => r.gear_code === code ? { ...r, equipped } : r);
    LS.set(K.gear(), rows); return rows;
  }
  return withDb(async c => {
    const { error } = await c.from('unlocked_gear').update({ equipped })
      .eq('user_id', uid()).eq('gear_code', code);
    if (error) throw error;
    return listGear();
  }, []);
}

/* ---------------------------- ACHIEVEMENTS ------------------------------ */
export async function listAchievements() {
  if (isGhost()) return LS.get(K.ach(), []);
  return withDb(async c => {
    const { data, error } = await c.from('achievements').select('*')
      .eq('user_id', uid()).order('unlocked_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, []);
}

export async function unlockAchievement(a) {
  const row = { user_id: uid(), code: a.code, title: a.title, tier: a.tier, payload: a.payload ?? {} };
  if (isGhost()) {
    const rows = LS.get(K.ach(), []);
    if (rows.some(r => r.code === a.code)) return null;
    row.id = 'a' + Date.now().toString(36); row.unlocked_at = new Date().toISOString();
    rows.unshift(row); LS.set(K.ach(), rows); return row;
  }
  return withDb(async c => {
    const { data, error } = await c.from('achievements').insert(row).select().single();
    if (error) { if (error.code === '23505') return null; throw error; }
    return data;
  }, null);
}

/* ------------------------------- BOSSES --------------------------------- */
export async function listBossDefeats() {
  if (isGhost()) return LS.get(K.boss(), []);
  return withDb(async c => {
    const { data, error } = await c.from('boss_defeats').select('*').eq('user_id', uid());
    if (error) throw error;
    return data ?? [];
  }, []);
}

export async function recordBossDefeat(boss_code, damage_dealt, credits_won) {
  const row = { user_id: uid(), boss_code, damage_dealt, credits_won };
  if (isGhost()) {
    const rows = LS.get(K.boss(), []);
    row.id = 'b' + Date.now().toString(36); row.defeated_at = new Date().toISOString();
    rows.unshift(row); LS.set(K.boss(), rows); return row;
  }
  return withDb(async c => {
    const { data, error } = await c.from('boss_defeats').insert(row).select().single();
    if (error) throw error;
    return data;
  }, row);
}

/* -------------------------------- СОН ----------------------------------- */
export async function listSleep({ limit = 400 } = {}) {
  if (isGhost()) {
    return LS.get(K.sleep(), []).sort((a, b) => (a.slept_on < b.slept_on ? 1 : -1)).slice(0, limit);
  }
  return withDb(async c => {
    const { data, error } = await c.from('sleep_logs').select('*').eq('user_id', uid())
      .order('slept_on', { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }, []);
}

/** Длительность с переходом через полночь: 23:40 → 05:10 это +330 мин. */
export function sleepDuration(bedtime, wake) {
  if (!bedtime || !wake) return null;
  const m = t => { const [h, mi] = String(t).split(':').map(Number); return h * 60 + mi; };
  const b = m(bedtime), w = m(wake);
  return w >= b ? w - b : w + 1440 - b;
}

export async function upsertSleep(entry) {
  const row = {
    user_id: uid(),
    slept_on: entry.slept_on || today(),
    bedtime: entry.bedtime || null,
    wake_time: entry.wake_time,
    duration_min: num(entry.duration_min) ?? sleepDuration(entry.bedtime, entry.wake_time),
    quality: num(entry.quality),
    note: entry.note ?? null,
  };
  if (isGhost()) {
    const rows = LS.get(K.sleep(), []).filter(r => r.slept_on !== row.slept_on);
    row.id = 's' + Date.now().toString(36);
    row.created_at = new Date().toISOString();
    rows.unshift(row); LS.set(K.sleep(), rows);
    return row;
  }
  return withDb(async c => {
    const { data, error } = await c.from('sleep_logs')
      .upsert(row, { onConflict: 'user_id,slept_on' }).select().single();
    if (error) throw error;
    return data;
  }, row);
}

export async function deleteSleep(id) {
  if (isGhost()) { LS.set(K.sleep(), LS.get(K.sleep(), []).filter(r => r.id !== id)); return true; }
  return withDb(async c => {
    const { error } = await c.from('sleep_logs').delete().eq('id', id).eq('user_id', uid());
    if (error) throw error;
    return true;
  }, false);
}

/* ------------------------------ DEMO SEED ------------------------------- */
/** Generates 10 weeks of plausible telemetry (dev console: `seed`). */
export async function seedDemoData() {
  const out = [];
  const start = new Date(); start.setDate(start.getDate() - 70);
  for (let d = 0; d < 70; d++) {
    const day = new Date(start); day.setDate(start.getDate() + d);
    const dow = day.getDay();
    if (![1, 3, 5].includes(dow) && Math.random() > 0.25) continue;
    const t = TRACKS[[1, 3, 5].includes(dow) ? (dow === 1 ? 3 : dow === 3 ? 4 : 5) : Math.floor(Math.random() * 3)];
    const prog = d / 70;
    const base = { bench: 62, squat: 88, deadlift: 108 }[t.code];
    const e = { performed_on: iso(day), kind: t.kind, track: t.code, exercise: t.name, muscles: t.muscles, duration_min: 45 + Math.floor(Math.random() * 40) };
    if (t.metric === 'load') {
      e.weight_kg = Math.round(base + prog * 28 + Math.random() * 6);
      e.reps = 3 + Math.floor(Math.random() * 5); e.sets = 4;
      e.est_1rm = Math.round(e.weight_kg * (1 + e.reps / 30) * 10) / 10;
    } else if (t.metric === 'hold') {
      e.hold_seconds = Math.round(3 + prog * (t.code === 'handstand' ? 42 : 9) + Math.random() * 3);
      e.progression = t.code === 'planche' ? ['tuck', 'adv_tuck', 'straddle'][Math.min(2, Math.floor(prog * 3))] : 'freestanding';
    } else {
      e.angle_degrees = Math.round(112 + prog * 52 + Math.random() * 5);
      e.stretch_minutes = 12 + Math.floor(Math.random() * 18);
    }
    out.push(await addLog(e));
  }
  /* сон: 8 недель, подъём дрейфует к цели */
  for (let d = 0; d < 56; d++) {
    const day = new Date(); day.setDate(day.getDate() - d);
    if (Math.random() < 0.12) continue;                 // пропущенные записи
    const prog = 1 - d / 56;                            // ближе к сегодня — точнее
    const drift = Math.round((1 - prog) * 70 + (Math.random() * 34 - 17));
    const wakeMin = Math.max(255, 300 + drift);         // цель 05:00 = 300 мин
    const dur = 415 + Math.round(Math.random() * 70);
    const bedMin = (wakeMin - dur + 1440) % 1440;
    await upsertSleep({
      slept_on: iso(day),
      bedtime: hhmm(bedMin),
      wake_time: hhmm(wakeMin),
      duration_min: dur,
      quality: 2 + Math.round(Math.random() * 3),
    });
  }
  return out.length;
}

export async function wipeLocal() {
  [K.profile(), K.logs(), K.gear(), K.ach(), K.boss(), K.sleep()].forEach(LS.del);
}

const hhmm = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}`;

const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v);
