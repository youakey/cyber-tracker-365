/* РАЗДЕЛ «ОБЗОР» — состояние на сегодня одним экраном. */
import { el, bus } from '../../core/util.js';
import { S, progressPct, availableBosses, mmss, dur } from '../../core/store.js';
import { TRACKS } from '../../core/presets.js';
import { card, sectionH, stat, empty } from './_shared.js';
import { Feed } from '../components/ticker.js';
import { ComplianceStrip } from '../components/calendar.js';
import { icon } from '../components/icons.js';
import { openProtocol, openQuickLog } from '../screens/exercise.js';
import { openSleepLog } from '../screens/sleep-log.js';
import { levelProgress } from '../screens/profile.js';
import { goTo } from '../shell.js';

export function OverviewSection() {
  const p = S.profile ?? {};
  const lp = levelProgress(p);
  const sl = S.sleepStats;
  const gap = Math.max(0, S.quota - S.weekSessions);

  /* ── оператор ── */
  const operator = card('Оператор',
    el('div', { class: 'col gap-3' },
      el('div', { class: 'row between' },
        stat('Уровень', String(lp.lv)),
        stat('Опыт', String(p.experience ?? 0), { sm: true }),
        stat('Очки', String(p.nano_credits ?? 0), { sm: true, cls: 'c-amber' }),
        stat('Множитель', '×' + S.expMultiplier, { sm: true, cls: 'c-cyan' })),
      el('div', { class: 'bar' }, el('i', { style: { width: lp.pct + '%' } })),
      el('div', { class: 'row between tiny dim' },
        el('span', {}, `${p.experience ?? 0} опыта`),
        el('span', {}, `до ${lp.lv + 1} уровня: ${Math.max(0, lp.next - (p.experience ?? 0))}`))),
    { right: el('span', { class: 'pill accent' }, p.handle ?? 'ОПЕРАТОР') });

  /* ── норма недели ── */
  const cells = Array.from({ length: S.quota }, (_, i) =>
    el('i', { class: 'cell ' + (i < S.weekSessions ? 'on' : (S.depleted ? 'dead' : 'warn')) }));

  const mandate = card('Норма недели',
    el('div', { class: 'col gap-3' },
      el('div', { class: 'cells' }, ...cells),
      el('div', { class: 'row between' },
        el('span', { class: 'sm muted' },
          gap > 0 ? `Осталось ${gap} ${gap === 1 ? 'цикл' : 'цикла'}` : 'Норма выполнена'),
        el('span', { class: 'pill ' + (gap > 0 ? 'warn' : 'ok') }, `${S.weekSessions} / ${S.quota}`)),
      el('div', { class: 'col gap-1' },
        el('div', { class: 'row between tiny dim' },
          el('span', {}, 'Батарея'), el('span', {}, S.energy + '%')),
        el('div', { class: `bar ${S.depleted ? 'dan' : 'ok'}` },
          el('i', { style: { width: S.energy + '%' } }))),
      S.depleted
        ? el('div', { class: 'row gap-2 tiny c-red' }, icon('warn'),
            el('span', {}, 'Батарея разряжена — норма не выполнена'))
        : el('div', { class: 'tiny dim' }, '12 недель соблюдения ниже'),
      ComplianceStrip()),
    { cls: S.depleted ? 'danger' : '' });

  /* ── сон ── */
  const sleepBody = sl && sl.logged
    ? el('div', { class: 'col gap-3' },
        el('div', { class: 'row between wrap gap-3' },
          stat('Сегодня', sl.today ? String(sl.today.wake_time).slice(0, 5) : '—',
            { cls: sl.today?.onTarget ? 'c-green' : sl.today ? 'c-amber' : '' }),
          stat('Средний за 14 дн', sl.avgWake !== null ? mmss(sl.avgWake) : '—', { sm: true }),
          stat('Серия', sl.streak + ' дн', { sm: true, cls: sl.streak > 0 ? 'c-green' : '' })),
        el('div', { class: 'col gap-1' },
          el('div', { class: 'row between tiny dim' },
            el('span', {}, 'Попаданий в цель за 14 дней'),
            el('span', {}, sl.hit14 + ' из ' + Math.min(14, sl.rows.length))),
          el('div', { class: 'bar ok' }, el('i', { style: { width: sl.rate14 + '%' } }))),
        el('div', { class: 'tiny dim' },
          `Цель — ${mmss(sl.targetMin)} ±${sl.tol} мин. Отбой около ${sl.bedtimeAdvice}.`))
    : empty('Сон ещё не записан', 'Отметьте время подъёма, чтобы начать отсчёт серии');

  const sleep = card('Режим сна', sleepBody, {
    right: el('button', { class: 'btn sm', onclick: () => openSleepLog() },
      icon('plus'), el('span', {}, 'Ночь')),
  });

  /* ── ближайшие цели ── */
  const near = TRACKS.map(t => ({ t, p: progressPct(t.code) }))
    .sort((a, b) => b.p - a.p).filter(x => x.p < 100).slice(0, 3);
  const boss = availableBosses().find(b => b.unlocked && !b.beaten);

  const tasks = card('Что дальше',
    el('div', { class: 'col gap-2' },
      el('div', { class: `line ${gap > 0 ? 'warn' : 'ok'}` },
        gap > 0 ? `Закрыть ${gap} ${gap === 1 ? 'тренировку' : 'тренировки'} до конца недели` : 'Норма недели закрыта'),
      sl && !sl.today ? el('div', { class: 'line' }, 'Записать сегодняшний подъём') : null,
      ...near.map(({ t, p }) =>
        el('button', { class: 'line', style: { textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', padding: '0 0 0 11px' },
          onclick: () => openProtocol(t.code) },
          `${t.name}: ${S.pr[t.code] ?? 0} из ${S.targets[t.code]} ${t.unit} (${Math.round(p)}%)`)),
      boss ? el('div', { class: 'line crit' }, `Доступен челлендж: ${boss.name}`) : null));

  /* ── прогресс протоколов ── */
  const progress = card('Протоколы',
    el('div', { class: 'col gap-3' }, ...TRACKS.map(t =>
      el('button', {
        class: 'col gap-1', style: { textAlign: 'left', width: '100%', background: 'none', border: 0, cursor: 'pointer', padding: 0 },
        onclick: () => openProtocol(t.code),
      },
        el('div', { class: 'row between' },
          el('span', { class: 'sm', style: { color: t.color } }, t.name),
          el('span', { class: 'tiny dim mono' }, `${S.pr[t.code] ?? 0} / ${S.targets[t.code]} ${t.unit}`)),
        el('div', { class: 'bar' },
          el('i', { style: { width: progressPct(t.code) + '%', background: t.color } }))))),
    { right: el('button', { class: 'btn sm ghost', onclick: () => goTo('analytics') }, 'Аналитика') });

  const coach = card('Коуч', el('div', { style: { minHeight: '150px' } }, Feed()),
    { right: el('span', { class: 'pill' }, 'live') });

  return el('div', {},
    sectionH('Обзор', new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })),
    el('div', { class: 'dual' },
      el('div', {}, operator, mandate, sleep),
      el('div', {}, tasks, progress, coach)));
}
