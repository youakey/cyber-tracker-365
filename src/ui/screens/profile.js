/* Профиль оператора: личные данные, цели протоколов, цель по сну, выход. */
import { el, clamp } from '../../core/util.js';
import { S, setProfile, equippedGear, mmss, hm, dur } from '../../core/store.js';
import { TRACKS } from '../../core/presets.js';
import { modal, confirmDialog } from '../components/modal.js';
import { ok } from '../components/toast.js';
import { signOut } from '../../core/auth.js';
import { isGhost } from '../../core/supabase.js';
import { icon } from '../components/icons.js';
import { buzz } from '../../fx/haptics.js';

export const expForLevel = lv => Math.round(Math.pow(lv - 1, 2) * 120);
export function levelProgress(p) {
  const lv = p?.level ?? 1;
  const cur = expForLevel(lv), next = expForLevel(lv + 1);
  return { lv, cur, next, pct: clamp(((p?.experience ?? 0) - cur) / Math.max(1, next - cur) * 100, 0, 100) };
}

export function openProfile() {
  buzz('select');
  const p = S.profile ?? {};
  const lp = levelProgress(p);
  const rig = equippedGear();

  const handle = el('input', { type: 'text', maxlength: 24, value: p.handle ?? '' });
  const bw = el('input', { type: 'number', step: '0.1', min: '20', max: '300',
    value: p.bodyweight_kg ?? '', placeholder: 'кг' });
  const quota = el('input', { type: 'number', min: '1', max: '14', value: p.weekly_quota ?? 3 });

  const wake = el('input', { type: 'time', value: (p.target_wake ?? '05:00').slice(0, 5) });
  const sleepH = el('input', { type: 'number', step: '15', min: '240', max: '720',
    value: p.target_sleep_min ?? 450 });
  const tol = el('input', { type: 'number', step: '5', min: '0', max: '90',
    value: p.wake_tolerance_min ?? 15 });

  const bedHint = el('div', { class: 'tiny dim' });
  const paintHint = () => {
    const bed = ((hm(wake.value) - Number(sleepH.value || 450)) % 1440 + 1440) % 1440;
    bedHint.textContent = `При таких настройках отбой около ${mmss(bed)}, норма сна ${dur(Number(sleepH.value || 450))}.`;
  };
  [wake, sleepH].forEach(i => i.addEventListener('input', paintHint));
  paintHint();

  const targets = TRACKS.map(t => {
    const i = el('input', { type: 'number', step: '1', value: S.targets[t.code] ?? t.defaultTarget });
    return { t, i, node: el('div', { class: 'field' },
      el('label', {}, `${t.name}, ${t.unit}`), i) };
  });

  modal({
    title: 'Профиль',
    body: el('div', { class: 'col gap-3' },
      el('div', { class: 'card flat col gap-3' },
        el('div', { class: 'row between' },
          el('div', { class: 'col' },
            el('div', { class: 'sm', style: { fontWeight: '700' } }, p.handle ?? 'Оператор'),
            el('div', { class: 'tiny dim' }, isGhost() ? 'локальный профиль' : 'подтверждённый профиль')),
          el('div', { class: 'stat', style: { alignItems: 'flex-end' } },
            el('span', { class: 'k' }, 'Уровень'), el('span', { class: 'v' }, String(lp.lv)))),
        el('div', { class: 'bar' }, el('i', { style: { width: lp.pct + '%' } })),
        el('div', { class: 'row between tiny dim' },
          el('span', {}, `${p.experience ?? 0} опыта`),
          el('span', {}, `${p.nano_credits ?? 0} очков · ×${S.expMultiplier}`)),
        rig.length ? el('div', { class: 'row gap-1 wrap' },
          ...rig.map(g => el('span', { class: 'pill accent' }, g.name))) : null),

      el('div', { class: 'section-h' }, el('h2', {}, 'Личное'), el('span', { class: 'rule' })),
      el('div', { class: 'grid g2' },
        el('div', { class: 'field' }, el('label', {}, 'Позывной'), handle),
        el('div', { class: 'field' }, el('label', {}, 'Вес тела, кг'), bw),
        el('div', { class: 'field' }, el('label', {}, 'Норма тренировок в неделю'), quota)),

      el('div', { class: 'section-h' }, el('h2', {}, 'Сон'), el('span', { class: 'rule' })),
      el('div', { class: 'grid g3' },
        el('div', { class: 'field' }, el('label', {}, 'Подъём'), wake),
        el('div', { class: 'field' }, el('label', {}, 'Норма сна, мин'), sleepH),
        el('div', { class: 'field' }, el('label', {}, 'Допуск, мин'), tol)),
      bedHint,

      el('div', { class: 'section-h' }, el('h2', {}, 'Цели протоколов'), el('span', { class: 'rule' })),
      el('div', { class: 'grid g2' }, ...targets.map(x => x.node)),

      el('div', { class: 'section-h' }, el('h2', {}, 'Сессия'), el('span', { class: 'rule' })),
      el('button', { class: 'btn danger wide', onclick: async () => {
        if (await confirmDialog('Выйти', 'Завершить сессию и вернуться на экран входа?', 'Выйти')) {
          await signOut(); location.reload();
        }
      } }, icon('logout'), el('span', {}, 'Выйти из аккаунта'))),

    actions: [
      { label: 'Закрыть', class: 'ghost' },
      { label: 'Сохранить', class: 'primary', onClick: async () => {
        const patch = {
          handle: handle.value.trim() || p.handle,
          bodyweight_kg: bw.value ? Number(bw.value) : null,
          weekly_quota: clamp(Number(quota.value) || 3, 1, 14),
          target_wake: wake.value || '05:00',
          target_sleep_min: clamp(Number(sleepH.value) || 450, 240, 720),
          wake_tolerance_min: clamp(Number(tol.value) || 15, 0, 90),
        };
        for (const { t, i } of targets) {
          const v = Number(i.value);
          if (v > 0) patch[t.targetKey] = v;
        }
        await setProfile(patch);
        ok('Сохранено', 'Профиль обновлён.');
      } },
    ],
  });
}
