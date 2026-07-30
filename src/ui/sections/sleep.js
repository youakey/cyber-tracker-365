/* РАЗДЕЛ «СОН» — режим подъёма и его динамика. */
import { el } from '../../core/util.js';
import { S, mmss, dur, removeSleep } from '../../core/store.js';
import { card, sectionH, stat, empty } from './_shared.js';
import { WakePlot, Sparkline } from '../components/radar.js';
import { icon } from '../components/icons.js';
import { openSleepLog } from '../screens/sleep-log.js';
import { openProfile } from '../screens/profile.js';
import { confirmDialog } from '../components/modal.js';

export function SleepSection() {
  const sl = S.sleepStats;
  const target = (S.profile?.target_wake ?? '05:00').slice(0, 5);

  if (!sl || !sl.logged) {
    return el('div', {},
      sectionH('Сон', 'цель ' + target),
      card('Журнал сна',
        el('div', { class: 'col gap-3' },
          empty('Записей пока нет', `Цель — подъём в ${target}. Отметьте первую ночь, и появится график.`),
          el('button', { class: 'btn primary wide', onclick: () => openSleepLog() },
            icon('plus'), el('span', {}, 'Записать ночь')))));
  }

  const plotPoints = sl.rows.slice(0, 30).reverse()
    .map(r => ({ x: r.slept_on, wake: r.wakeMin, onTarget: r.onTarget }));
  const durPoints = sl.rows.slice(0, 30).reverse()
    .filter(r => r.duration_min).map(r => ({ x: r.slept_on, y: Math.round(r.duration_min / 6) / 10 }));

  const head = card('Сегодня',
    el('div', { class: 'col gap-3' },
      el('div', { class: 'row between wrap gap-3' },
        stat('Подъём', sl.today ? String(sl.today.wake_time).slice(0, 5) : 'не записан',
          { cls: sl.today?.onTarget ? 'c-green' : sl.today ? 'c-amber' : 'dim' }),
        stat('Длительность', sl.today?.duration_min ? dur(sl.today.duration_min) : '—', { sm: true }),
        stat('Серия', sl.streak + ' дн', { sm: true, cls: sl.streak > 0 ? 'c-green' : '' })),
      el('button', { class: 'btn primary wide', onclick: () => openSleepLog() },
        icon(sl.today ? 'refresh' : 'plus'),
        el('span', {}, sl.today ? 'Изменить запись' : 'Записать ночь'))),
    { right: el('span', { class: 'pill accent' }, 'цель ' + target) });

  const metrics = card('Показатели за 14 дней',
    el('div', { class: 'grid g2' },
      stat('Средний подъём', sl.avgWake !== null ? mmss(sl.avgWake) : '—', { sm: true }),
      stat('Среднее отклонение', sl.avgDrift !== null ? `${sl.avgDrift > 0 ? '+' : ''}${sl.avgDrift} мин` : '—',
        { sm: true, cls: sl.avgDrift === null ? '' : Math.abs(sl.avgDrift) <= sl.tol ? 'c-green' : 'c-amber' }),
      stat('Средний сон', sl.avgDur !== null ? dur(sl.avgDur) : '—', { sm: true }),
      stat('Долг сна за 7 дн', sl.debtMin ? dur(sl.debtMin) : 'нет',
        { sm: true, cls: sl.debtMin > 240 ? 'c-red' : sl.debtMin ? 'c-amber' : 'c-green' })),
    { right: el('span', { class: 'pill ' + (sl.rate14 >= 70 ? 'ok' : 'warn') }, sl.rate14 + '%') });

  const chart = card('Время подъёма',
    el('div', { class: 'col gap-2' },
      WakePlot(plotPoints, { targetMin: sl.targetMin, tol: sl.tol }),
      el('div', { class: 'row gap-3 tiny dim wrap' },
        el('span', { class: 'row gap-1' },
          el('i', { style: { width: '9px', height: '2px', background: 'var(--green)', display: 'block' } }),
          el('span', {}, `цель ${mmss(sl.targetMin)} ±${sl.tol} мин`)),
        el('span', {}, 'точка выше линии — проспал'))),
    { right: el('span', { class: 'pill' }, 'последние 30') });

  const durChart = durPoints.length > 1
    ? card('Длительность сна, часов',
        el('div', { class: 'col gap-2' },
          Sparkline(durPoints, { color: '--violet', unit: 'ч', height: 76 }),
          el('div', { class: 'tiny dim' }, `Норма — ${dur(sl.need)}`)))
    : null;

  const rows = sl.rows.slice(0, 21);
  const journal = card('Журнал ночей',
    el('div', { class: 'col gap-2' }, ...rows.map(r =>
      el('div', { class: 'item' },
        el('span', { class: 'ic', style: {
          color: r.onTarget ? 'var(--green)' : 'var(--amber)',
          borderColor: r.onTarget ? 'color-mix(in srgb,var(--green) 45%,transparent)' : 'var(--line)',
        } }, String(r.wake_time).slice(0, 5)),
        el('span', { class: 'col grow gap-1' },
          el('span', { class: 'sm' }, new Date(r.slept_on).toLocaleDateString('ru-RU',
            { weekday: 'short', day: 'numeric', month: 'short' })),
          el('span', { class: 'tiny dim' },
            [r.bedtime ? 'отбой ' + String(r.bedtime).slice(0, 5) : null,
             r.duration_min ? dur(r.duration_min) : null,
             r.quality ? 'качество ' + r.quality + '/5' : null].filter(Boolean).join(' · '))),
        el('span', { class: 'col gap-1', style: { alignItems: 'flex-end' } },
          el('span', { class: 'pill ' + (r.onTarget ? 'ok' : 'warn') },
            `${r.drift > 0 ? '+' : ''}${r.drift}`),
          el('button', { class: 'linkbtn tiny', onclick: async () => {
            if (await confirmDialog('Удалить запись', `Удалить ночь ${r.slept_on}?`, 'Удалить')) removeSleep(r.id);
          } }, 'удалить')))),
    ), { right: el('button', { class: 'btn sm ghost', onclick: openProfile }, icon('gear'), el('span', {}, 'Цель')) });

  return el('div', {},
    sectionH('Сон', `цель ${target} · отбой ${sl.bedtimeAdvice}`),
    el('div', { class: 'dual' },
      el('div', {}, head, metrics, durChart),
      el('div', {}, chart, journal)));
}
