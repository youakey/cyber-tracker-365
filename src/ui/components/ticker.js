/* ══════════════════════════════════════════════════════════════
   ЦИФРОВОЙ КОУЧ
   Лента реагирует на состояние: пропуски, недобор нормы, близкие
   цели, режим сна. Случайные фразы — только когда сказать нечего.
   ══════════════════════════════════════════════════════════════ */
import { el, bus, stamp, pick, round1 } from '../../core/util.js';
import { S, mmss, dur } from '../../core/store.js';
import { TRACK_BY_CODE } from '../../core/presets.js';
import { FLAGS } from '../../config.js';

const MAX = 40;
let feed = [];
let host = null;

export function pushLog(text, kind = '') {
  if (feed[0]?.text === text) return;      // не дублируем строку подряд
  feed.unshift({ text, kind, ts: stamp() });
  if (feed.length > MAX) feed.length = MAX;
  paint();
}

function paint() {
  if (!host) return;
  host.replaceChildren(...feed.slice(0, 14).reverse().map(l =>
    el('div', { class: `line ${l.kind}` },
      el('span', { class: 'ts' }, l.ts), l.text)));
  host.scrollTop = host.scrollHeight;
}

const POOL = {
  idle: [
    'Считываю телеметрию…',
    'Сверяю показатели с моделью гипертрофии…',
    'Буфер данных пуст. Жду ввода.',
    'Все датчики в норме.',
  ],
  atrophy: [
    'Простой затянулся. Мышечная ткань начинает откатываться.',
    'Долгий перерыв. Рекомендую вернуться к нагрузке в ближайший цикл.',
  ],
  depleted: [
    'Батарея разряжена: недельная норма не выполнена.',
    'Выработка энергии ниже нормы. Нужен цикл в зале.',
  ],
  onTrack: [
    'Норма недели выполнена. Показатели стабильны.',
    'Протокол соблюдается. Продолжайте в том же темпе.',
  ],
  empty: [
    'Журнал пуст. Первая запись задаст точку отсчёта.',
    'Замерьте текущие показатели — без них не с чем сравнивать прогресс.',
    'Начните с любого протокола: цифры важнее идеального старта.',
  ],
};

function synth() {
  const s = S;
  if (!s.profile) return { text: pick(POOL.idle), kind: '' };

  /* Пустому профилю не говорим про откат: человек ещё ничего не начинал,
     а лента иначе повторяет «долгий перерыв» каждые 14 секунд. */
  const last = s.logs[0]?.performed_on;
  if (!last) {
    return { text: pick(POOL.empty), kind: '' };
  }
  const idle = Math.floor((Date.now() - Date.parse(last)) / 864e5);
  if (idle >= 5) return { text: pick(POOL.atrophy), kind: 'crit' };
  if (s.depleted) return { text: pick(POOL.depleted), kind: 'crit' };

  /* сон */
  const sl = s.sleepStats;
  if (sl && sl.logged) {
    if (sl.avgDrift !== null && sl.avgDrift > 45 && Math.random() < .5)
      return { text: `Средний подъём за 2 недели — ${mmss(sl.avgWake)}, это на ${sl.avgDrift} мин позже цели. Сдвиньте отбой к ${sl.bedtimeAdvice}.`, kind: 'warn' };
    if (sl.debtMin > 240 && Math.random() < .4)
      return { text: `Долг сна за неделю — ${dur(sl.debtMin)}. Силовые показатели просядут раньше, чем самочувствие.`, kind: 'warn' };
    if (sl.streak >= 3 && Math.random() < .4)
      return { text: `Серия подъёмов в цель: ${sl.streak} дн. Режим закрепляется.`, kind: 'ok' };
    if (!sl.today && new Date().getHours() < 12 && Math.random() < .5)
      return { text: 'Ночь не записана. Отметьте время подъёма, пока помните.', kind: '' };
  }

  const gap = s.quota - s.weekSessions;
  if (gap > 0 && new Date().getDay() >= 4)
    return { text: `До нормы недели осталось ${gap} ${gap === 1 ? 'цикл' : 'цикла'}. Окно закрывается.`, kind: 'warn' };

  const near = Object.entries(s.pr)
    .map(([code, v]) => ({ code, v, tgt: s.targets[code] ?? 1 }))
    .filter(x => x.v > 0 && x.v < x.tgt)
    .sort((a, b) => (b.v / b.tgt) - (a.v / a.tgt))[0];
  if (near && Math.random() < .5) {
    const t = TRACK_BY_CODE[near.code];
    const left = round1(near.tgt - near.v);
    return { text: `${t.name}: до цели ${left} ${t.unit}. При текущем темпе — примерно ${Math.max(1, Math.ceil(left / Math.max(.5, near.v * .04)))} циклов.`, kind: '' };
  }

  if (s.weekSessions >= s.quota) return { text: pick(POOL.onTrack), kind: 'ok' };
  return { text: pick(POOL.idle), kind: '' };
}

export function Feed() {
  host = el('div', { class: 'feed' });
  paint();
  return host;
}

let timer = null;
export function startCoach() {
  if (timer) return;
  pushLog('Коуч на связи. Профиль загружен.', 'ok');
  timer = setInterval(() => { const l = synth(); pushLog(l.text, l.kind); }, FLAGS.coachIntervalMs);

  bus.on('session:logged', ({ row, isPR, delta, exp, track }) => {
    if (isPR) pushLog(`Новый рекорд: ${track?.name ?? row.exercise} +${delta} ${track?.unit ?? ''}. Показатели пересчитаны.`, 'ok');
    else pushLog(`Записано: ${row.exercise}, ${row.performed_on}. +${exp} опыта.`, '');
  });
  bus.on('sleep:logged', ({ row, onTarget, drift }) => {
    if (onTarget) pushLog(`Подъём в ${String(row.wake_time).slice(0, 5)} — в цель. Серия продолжается.`, 'ok');
    else pushLog(`Подъём в ${String(row.wake_time).slice(0, 5)}, отклонение ${drift > 0 ? '+' : ''}${drift} мин от цели.`, drift > 45 ? 'warn' : '');
  });
  bus.on('achievement:unlocked', a => pushLog(`Достижение: ${a.title}.`, 'ok'));
  bus.on('gear:installed', g => pushLog(`Установлено: ${g.name}. Множитель опыта ×${S.expMultiplier}.`, 'ok'));
  bus.on('boss:defeated', b => pushLog(`Челлендж пройден: ${b.name}.`, 'ok'));
  bus.on('cheat:used', c => pushLog(c.msg, 'hack'));
  bus.on('backend:ghost', () => pushLog('Сервер недоступен — работаю локально, данные в браузере.', 'warn'));
}

export function stopCoach() { clearInterval(timer); timer = null; }
