/* Снаряжение: покупка и установка. Множитель опыта складывается произведением. */
import { el, bus } from '../../core/util.js';
import { S, purchase, equip } from '../../core/store.js';
import { modal } from '../components/modal.js';
import { ok, err } from '../components/toast.js';
import { spark } from '../../fx/canvas-fx.js';
import { buzz } from '../../fx/haptics.js';

const RARITY_RU = { common: 'обычное', uncommon: 'необычное', rare: 'редкое', epic: 'эпическое', legendary: 'легендарное' };
const SLOT_RU = { wrist: 'запястья', waist: 'пояс', hands: 'кисти', spine: 'спина', neural: 'нейро', boots: 'обувь' };

export function GearList() {
  const root = el('div', { class: 'col gap-2' });
  const render = () => {
    const owned = new Map(S.gear.map(g => [g.gear_code, g]));
    root.replaceChildren(...S.catalog.map(item => {
      const has = owned.get(item.code);
      const can = (S.profile?.nano_credits ?? 0) >= item.cost;
      return el('div', { class: `item ${has ? 'owned' : ''} ${has?.equipped ? 'equipped' : ''}` },
        el('span', { class: 'ic' }, item.glyph),
        el('span', { class: 'col grow gap-1' },
          el('span', { class: 'row between gap-2' },
            el('span', { class: `sm rar-${item.rarity}` }, item.name),
            el('span', { class: 'tiny c-amber mono nowrap' }, '×' + item.exp_multiplier)),
          el('span', { class: 'tiny dim' }, item.description),
          el('span', { class: 'row gap-1' },
            el('span', { class: 'pill' }, SLOT_RU[item.slot] ?? item.slot),
            el('span', { class: `pill` }, RARITY_RU[item.rarity] ?? item.rarity))),
        has
          ? el('button', { class: 'btn sm ghost', onclick: async () => { buzz('tap'); await equip(item.code, !has.equipped); } },
              has.equipped ? 'Снять' : 'Надеть')
          : el('button', {
              class: `btn sm ${can ? 'primary' : ''}`, disabled: !can,
              onclick: async ev => {
                const r = await purchase(item.code);
                if (!r.ok) { err('Не куплено', r.reason); buzz('error'); return; }
                const b = ev.currentTarget.getBoundingClientRect();
                spark(b.left + b.width / 2, b.top + b.height / 2, '--amber');
                buzz('confirm');
                ok('Установлено', `${item.name}. Множитель опыта ×${S.expMultiplier}.`);
              },
            }, el('span', { class: 'nowrap' }, `${item.cost} оч.`)));
    }));
  };
  render(); bus.on('store', render);
  return root;
}

export function openShop() {
  buzz('select');
  const bal = el('div', { class: 'row between' },
    el('span', { class: 'tiny dim' }, 'Доступно'),
    el('span', { class: 'mono c-amber', style: { fontSize: '17px', fontWeight: '700' } },
      `${S.profile?.nano_credits ?? 0} оч.`));
  const off = bus.on('store', () => bal.lastChild.textContent = `${S.profile?.nano_credits ?? 0} оч.`);
  modal({
    title: 'Снаряжение',
    body: el('div', { class: 'col gap-3' }, bal, GearList()),
    actions: [{ label: 'Закрыть', class: 'ghost' }],
    onClose: off,
  });
}
