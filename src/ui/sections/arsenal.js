/* РАЗДЕЛ «АРСЕНАЛ» — снаряжение и челленджи. */
import { el } from '../../core/util.js';
import { S, equippedGear } from '../../core/store.js';
import { GearList } from '../screens/shop.js';
import { BossList } from '../screens/boss.js';
import { card, sectionH, stat } from './_shared.js';
import { icon } from '../components/icons.js';

export function ArsenalSection() {
  const rig = equippedGear();

  const wallet = card('Снаряжение',
    el('div', { class: 'col gap-3' },
      el('div', { class: 'row between wrap gap-3' },
        stat('Очки', String(S.profile?.nano_credits ?? 0), { sm: true, cls: 'c-amber' }),
        stat('Множитель опыта', '×' + S.expMultiplier, { sm: true, cls: 'c-cyan' }),
        stat('Установлено', `${rig.length} из ${S.catalog.length}`, { sm: true })),
      rig.length
        ? el('div', { class: 'row gap-1 wrap' },
            ...rig.map(g => el('span', { class: 'pill accent', title: g.description }, g.name)))
        : el('div', { class: 'tiny dim' }, 'Ничего не установлено — множитель опыта базовый.'),
      el('div', { class: 'tiny dim' },
        'Очки начисляются за тренировки, рекорды, режим сна и пройденные челленджи.'),
      GearList()));

  const bosses = card('Челленджи',
    el('div', { class: 'col gap-3' },
      el('div', { class: 'tiny dim' },
        'Челлендж открывается, когда рекорд подходит к цели. Урон засчитывается только по реальным цифрам: ' +
        'нужно превысить 60% собственного лучшего результата.'),
      BossList()),
    { right: el('span', { class: 'pill' },
        `${S.bossDefeats.length} пройдено`) });

  return el('div', {},
    sectionH('Арсенал', `${S.profile?.nano_credits ?? 0} очков`),
    el('div', { class: 'dual' }, el('div', {}, wallet), el('div', {}, bosses)));
}
