/* РАЗДЕЛ «АНАЛИТИКА» — радар, динамика протоколов, достижения. */
import { el } from '../../core/util.js';
import { S, progressPct, trackSeries } from '../../core/store.js';
import { TRACKS, ACHIEVEMENTS } from '../../core/presets.js';
import { RadarChart, Sparkline, TargetBar } from '../components/radar.js';
import { card, sectionH, stat } from './_shared.js';
import { openProtocol } from '../screens/exercise.js';

export function AnalyticsSection() {
  const radar = card('Профиль подготовки',
    el('div', { class: 'col gap-2' },
      RadarChart(S.radar),
      el('div', { class: 'tiny dim center' },
        'Каждая ось — процент от вашей цели, а не абсолютная норма')));

  const series = card('Динамика протоколов',
    el('div', { class: 'col gap-4' }, ...TRACKS.map(t => {
      const pts = trackSeries(t.code, 24);
      return el('button', {
        class: 'col gap-2', style: { width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', padding: 0 },
        onclick: () => openProtocol(t.code),
      },
        el('div', { class: 'row between' },
          el('span', { class: 'sm', style: { color: t.color } }, t.name),
          el('span', { class: 'pill' }, Math.round(progressPct(t.code)) + '%')),
        Sparkline(pts, { color: t.color, unit: t.unit, height: 62 }),
        TargetBar(S.pr[t.code] ?? 0, S.targets[t.code] ?? t.defaultTarget, { unit: ' ' + t.unit, color: t.color }));
    })));

  /* сводка объёма */
  const days30 = S.logs.filter(l => Date.parse(l.performed_on) > Date.now() - 30 * 864e5);
  const tonnage = days30.reduce((a, l) =>
    a + (Number(l.weight_kg) || 0) * (Number(l.reps) || 0) * (Number(l.sets) || 1), 0);
  const minutes = days30.reduce((a, l) => a + (Number(l.duration_min) || 0), 0);

  const volume = card('Объём за 30 дней',
    el('div', { class: 'grid g2' },
      stat('Тренировок', String(new Set(days30.map(l => l.performed_on)).size), { sm: true }),
      stat('Записей', String(days30.length), { sm: true }),
      stat('Тоннаж', Math.round(tonnage / 1000) + ' т', { sm: true, cls: 'c-cyan' }),
      stat('Время под нагрузкой', Math.round(minutes / 60) + ' ч', { sm: true })));

  const have = new Map(S.achievements.map(a => [a.code, a]));
  const wall = card('Достижения',
    el('div', { class: 'col gap-1' }, ...ACHIEVEMENTS.map(a => {
      const got = have.get(a.code);
      return el('div', { class: 'row between gap-2', style: { padding: '4px 0', opacity: got ? 1 : .45 } },
        el('span', { class: 'row gap-2 sm' },
          el('span', { style: { color: got ? 'var(--amber)' : 'var(--txt-3)' } }, got ? '★' : '☆'),
          el('span', {}, a.title)),
        el('span', { class: 'tiny dim mono nowrap' },
          got ? String(got.unlocked_at ?? '').slice(0, 10) : `+${a.exp}`));
    })),
    { right: el('span', { class: 'pill accent' }, `${S.achievements.length} / ${ACHIEVEMENTS.length}`) });

  return el('div', {},
    sectionH('Аналитика', `${S.logs.length} записей`),
    el('div', { class: 'dual' },
      el('div', {}, radar, volume, wall),
      el('div', {}, series)));
}
