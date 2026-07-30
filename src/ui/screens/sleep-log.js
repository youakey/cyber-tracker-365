/* Запись ночи: отбой, подъём, качество. Длительность считается сама. */
import { el, today, iso, clamp } from '../../core/util.js';
import { S, logSleep, mmss, hm, dur } from '../../core/store.js';
import { sleepDuration } from '../../core/db.js';
import { modal } from '../components/modal.js';
import { ok, err } from '../components/toast.js';
import { celebrate } from '../../fx/canvas-fx.js';
import { buzz } from '../../fx/haptics.js';

export function openSleepLog(date = today()) {
  const prev = S.sleep.find(r => r.slept_on === date);
  const sl = S.sleepStats;

  const dateI = el('input', { type: 'date', value: date, max: today() });
  const bedI  = el('input', { type: 'time', value: prev?.bedtime?.slice(0, 5) ?? sl?.bedtimeAdvice ?? '21:30' });
  const wakeI = el('input', { type: 'time', value: prev?.wake_time?.slice(0, 5) ?? (S.profile?.target_wake ?? '05:00').slice(0, 5) });
  const noteI = el('input', { type: 'text', placeholder: 'необязательно', value: prev?.note ?? '' });

  let quality = prev?.quality ?? 3;
  const qual = el('div', { class: 'seg' });
  const paintQual = () => qual.replaceChildren(...[1, 2, 3, 4, 5].map(q =>
    el('button', { class: q === quality ? 'on' : '', onclick: () => { quality = q; buzz('tap'); paintQual(); } },
      String(q))));
  paintQual();

  const readout = el('div', { class: 'card flat tight col gap-2' });
  const paintReadout = () => {
    const d = sleepDuration(bedI.value, wakeI.value);
    const target = hm(S.profile?.target_wake ?? '05:00');
    const tol = Number(S.profile?.wake_tolerance_min ?? 15);
    const w = hm(wakeI.value);
    const drift = w > 900 ? w - 1440 - target : w - target;
    const hit = Math.abs(drift) <= tol;
    const need = Number(S.profile?.target_sleep_min ?? 450);

    readout.replaceChildren(
      el('div', { class: 'row between' },
        el('span', { class: 'tiny dim' }, 'Длительность'),
        el('span', { class: 'mono sm' }, dur(d))),
      el('div', { class: 'row between' },
        el('span', { class: 'tiny dim' }, 'Отклонение от цели'),
        el('span', { class: 'mono sm ' + (hit ? 'c-green' : Math.abs(drift) > 45 ? 'c-red' : 'c-amber') },
          `${drift > 0 ? '+' : ''}${drift} мин`)),
      d !== null && d < need
        ? el('div', { class: 'tiny c-amber' }, `Недобор ${dur(need - d)} до нормы`)
        : el('div', { class: 'tiny dim' }, hit ? 'Подъём в целевом окне' : `Цель — ${mmss(target)} ±${tol} мин`),
    );
  };
  [bedI, wakeI].forEach(i => i.addEventListener('input', paintReadout));
  paintReadout();

  const dlg = modal({
    title: prev ? 'Изменить ночь' : 'Записать ночь',
    body: el('div', { class: 'col gap-3' },
      el('div', { class: 'grid g2' },
        el('div', { class: 'field' }, el('label', {}, 'Дата пробуждения'), dateI),
        el('div', { class: 'field' }, el('label', {}, 'Качество 1–5'), qual)),
      el('div', { class: 'grid g2' },
        el('div', { class: 'field' }, el('label', {}, 'Отбой'), bedI),
        el('div', { class: 'field' }, el('label', {}, 'Подъём'), wakeI)),
      readout,
      el('div', { class: 'field' }, el('label', {}, 'Заметка'), noteI),
      el('div', { class: 'tiny dim' },
        'Дата — это день пробуждения. Отбой в 23:40 и подъём в 05:10 считаются одной ночью.')),
    actions: [
      { label: 'Отмена', class: 'ghost' },
      { label: 'Сохранить', class: 'primary', dismiss: false, onClick: async close => {
        if (!wakeI.value) { err('Нужно время подъёма'); buzz('error'); return false; }
        const res = await logSleep({
          slept_on: dateI.value || today(),
          bedtime: bedI.value || null,
          wake_time: wakeI.value,
          quality,
          note: noteI.value.trim() || null,
        });
        close();
        if (res.onTarget) {
          celebrate({ label: 'В цель', sub: `Подъём ${wakeI.value} · серия ${S.sleepStats.streak} дн` });
          ok('Подъём в цель', `Серия: ${S.sleepStats.streak} дн. +${res.exp} опыта.`);
        } else {
          ok('Ночь записана', `Отклонение ${res.drift > 0 ? '+' : ''}${res.drift} мин. +${res.exp} опыта.`);
        }
        return false;
      } },
    ],
  });
  return dlg;
}
