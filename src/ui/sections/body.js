/* РАЗДЕЛ «ТЕЛО» — голограмма-карта и дерево протоколов. */
import { el } from '../../core/util.js';
import { S, progressPct } from '../../core/store.js';
import { TRACKS, MUSCLES } from '../../core/presets.js';
import { Hologram } from '../components/hologram.js';
import { SkillTree } from '../components/skilltree.js';
import { card, sectionH } from './_shared.js';
import { openProtocol } from '../screens/exercise.js';
import { buzz } from '../../fx/haptics.js';

export function BodySection() {
  let view = 'front';
  const holoHost = el('div', {});
  const seg = el('div', { class: 'seg' });

  const paint = () => {
    holoHost.replaceChildren(Hologram(view, { heat: S.muscleHeat }));
    seg.replaceChildren(...[['front', 'Спереди'], ['back', 'Сзади']].map(([v, label]) =>
      el('button', { class: v === view ? 'on' : '', onclick: () => { view = v; buzz('tap'); paint(); } }, label)));
  };
  paint();

  /* самые нагруженные группы за 14 дней */
  const top = Object.entries(S.muscleHeat)
    .sort((a, b) => b[1] - a[1]).slice(0, 8);

  const holo = card('Карта мышц',
    el('div', { class: 'col gap-3' }, seg, holoHost),
    { right: el('span', { class: 'pill' }, '14 дней') });

  const load = card('Нагрузка за 2 недели',
    top.length
      ? el('div', { class: 'col gap-2' }, ...top.map(([m, v]) =>
          el('div', { class: 'col gap-1' },
            el('div', { class: 'row between tiny' },
              el('span', {}, MUSCLES[m] ?? m),
              el('span', { class: 'dim mono' }, Math.round(v * 100) + '%')),
            el('div', { class: 'bar' }, el('i', { style: { width: (v * 100) + '%' } })))))
      : el('div', { class: 'tiny dim' }, 'Записей за две недели нет — карта пустая.'));

  const tree = card('Дерево протоколов',
    el('div', { class: 'col gap-3' },
      SkillTree({ height: 240 }),
      el('div', { class: 'grid g2 gap-2' }, ...TRACKS.map(t =>
        el('button', { class: 'item', onclick: () => openProtocol(t.code) },
          el('span', { class: 'ic', style: { color: t.color } }, t.glyph),
          el('span', { class: 'col grow gap-1' },
            el('span', { class: 'sm' }, t.name),
            el('span', { class: 'tiny dim' }, `${S.pr[t.code] ?? 0} / ${S.targets[t.code]} ${t.unit}`)),
          el('span', { class: 'pill' }, Math.round(progressPct(t.code)) + '%'))))));

  return el('div', {},
    sectionH('Тело', 'коснитесь мышцы — откроется протокол'),
    el('div', { class: 'dual' }, el('div', {}, holo, load), el('div', {}, tree)));
}
