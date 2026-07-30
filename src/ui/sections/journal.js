/* РАЗДЕЛ «ЖУРНАЛ» — календарь и последние записи. */
import { el, round1 } from '../../core/util.js';
import { S, removeLog } from '../../core/store.js';
import { TRACK_BY_CODE, MUSCLES, PROGRESSION_RU } from '../../core/presets.js';
import { MatrixCalendar, ComplianceStrip } from '../components/calendar.js';
import { card, sectionH, empty } from './_shared.js';
import { icon } from '../components/icons.js';
import { openQuickLog } from '../screens/exercise.js';
import { confirmDialog } from '../components/modal.js';

export function JournalSection() {
  const cal = card('Календарь',
    el('div', { class: 'col gap-3' },
      MatrixCalendar(),
      el('div', { class: 'row between' },
        el('span', { class: 'tiny dim' }, 'Соблюдение, 12 недель'),
        ComplianceStrip())),
    { right: el('button', { class: 'btn sm primary', onclick: openQuickLog },
        icon('plus'), el('span', {}, 'Запись')) });

  const rows = S.logs.slice(0, 40);
  const list = card('Последние записи',
    rows.length
      ? el('div', { class: 'col gap-2' }, ...rows.map(r => {
          const t = TRACK_BY_CODE[r.track];
          const metrics = [
            r.weight_kg ? `${r.weight_kg} кг × ${r.reps ?? '—'}${r.sets ? ' × ' + r.sets : ''}` : null,
            r.est_1rm ? `1ПМ ${round1(r.est_1rm)} кг` : null,
            r.hold_seconds ? `удержание ${r.hold_seconds} с` : null,
            r.angle_degrees ? `угол ${r.angle_degrees}°` : null,
            r.stretch_minutes ? `растяжка ${r.stretch_minutes} мин` : null,
            r.progression ? PROGRESSION_RU[r.progression] ?? r.progression : null,
            r.duration_min ? `${r.duration_min} мин` : null,
          ].filter(Boolean).join(' · ');
          return el('div', { class: 'item' },
            el('span', { class: 'ic', style: { color: t?.color ?? 'var(--cyan)' } }, t?.glyph ?? '—'),
            el('span', { class: 'col grow gap-1' },
              el('span', { class: 'sm row gap-2' },
                el('span', {}, r.exercise),
                r.is_pr ? el('span', { class: 'pill ok' }, 'рекорд') : null),
              el('span', { class: 'tiny dim' }, metrics || '—'),
              el('span', { class: 'tiny dim' }, (r.muscles ?? []).map(m => MUSCLES[m] ?? m).join(', '))),
            el('span', { class: 'col gap-1', style: { alignItems: 'flex-end' } },
              el('span', { class: 'tiny dim mono' }, r.performed_on),
              el('button', { class: 'linkbtn tiny', onclick: async () => {
                if (await confirmDialog('Удалить запись', `${r.exercise} от ${r.performed_on}?`, 'Удалить')) removeLog(r.id);
              } }, 'удалить')));
        }))
      : empty('Журнал пуст', 'Нажмите «Запись», чтобы добавить первую тренировку'));

  return el('div', {},
    sectionH('Журнал', `${S.logs.length} записей`),
    el('div', { class: 'dual-wide' }, el('div', {}, cal), el('div', {}, list)));
}
