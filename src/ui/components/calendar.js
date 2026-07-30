/* MATRIX CALENDAR :: monthly activity grid, workout days burn with neon. */
import { el, monthMatrix, iso, today, bus } from '../../core/util.js';
import { S, logsOn, intensityOn } from '../../core/store.js';
import { buzz } from '../../fx/haptics.js';

const DOW = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MON = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль',
             'Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export function MatrixCalendar({ onPick } = {}) {
  const cursor = { y: new Date().getFullYear(), m: new Date().getMonth() };
  const root = el('div', { class: 'col gap-2' });

  function render() {
    const cells = monthMatrix(cursor.y, cursor.m);
    const grid = el('div', { class: 'cal' },
      ...DOW.map(d => el('div', { class: 'dow' }, d)),
      ...cells.map(date => {
        if (!date) return el('div', { class: 'cal-day void' });
        const rows = logsOn(date);
        const burn = intensityOn(date);
        const isPR = rows.some(r => r.is_pr);
        const cls = ['cal-day'];
        if (burn) cls.push('lv' + burn);
        if (date === today()) cls.push('today');
        if (date === S.selectedDate) cls.push('sel');
        if (isPR) cls.push('pr');
        return el('button', {
          class: cls.join(' '),
          title: rows.length ? `${date} — ${rows.map(r => r.exercise).join(', ')}` : date,
          onclick: () => {
            S.selectedDate = date; buzz('select');
            bus.emit('calendar:pick', { date, rows });
            onPick?.(date, rows); render();
          },
        }, String(Number(date.slice(-2))));
      }),
    );

    const monthLogs = S.logs.filter(l => l.performed_on.startsWith(
      `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`));
    const activeDays = new Set(monthLogs.map(l => l.performed_on)).size;

    root.replaceChildren(
      el('div', { class: 'row between gap-2' },
        el('button', { class: 'btn ghost sm', onclick: () => shift(-1), 'aria-label': 'Предыдущий месяц' }, '◀'),
        el('div', { class: 'mono', style: { fontSize: '13px', fontWeight: '700', letterSpacing: '.04em' } },
          `${MON[cursor.m]} ${cursor.y}`),
        el('button', { class: 'btn ghost sm', onclick: () => shift(1), 'aria-label': 'Следующий месяц' }, '▶')),
      grid,
      el('div', { class: 'row between tiny dim' },
        el('span', {}, `Активных дней: ${activeDays} из ${new Date(cursor.y, cursor.m + 1, 0).getDate()}`),
        el('span', {}, `Рекордов: ${monthLogs.filter(l => l.is_pr).length}`)),
    );
  }

  function shift(d) {
    cursor.m += d;
    if (cursor.m < 0) { cursor.m = 11; cursor.y--; }
    if (cursor.m > 11) { cursor.m = 0; cursor.y++; }
    buzz('tap'); render();
  }

  render();
  bus.on('store', render);
  return root;
}

/** Compact 12-week compliance strip for the status rail. */
export function ComplianceStrip() {
  const root = el('div', { class: 'row gap-1' });
  const render = () => {
    root.replaceChildren(...S.weekHistory.map(({ wk, n }) =>
      el('i', {
        title: `Неделя ${wk}: ${n} из ${S.quota}`,
        style: {
          width: '8px', height: '18px', display: 'block', borderRadius: '3px',
          background: n >= S.quota ? 'var(--green)' : n > 0 ? 'var(--amber)' : 'var(--surface-2)',
          border: '1px solid ' + (n >= S.quota ? 'var(--green)' : n > 0 ? 'var(--amber)' : 'var(--line)'),
        },
      })));
  };
  render(); bus.on('store', render);
  return root;
}
