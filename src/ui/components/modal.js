/* Модальное окно: скруглённая карточка, ловушка фокуса, закрытие по Esc. */
import { el, $$ } from '../../core/util.js';
import { icon } from './icons.js';

export function modal({ title = 'Система', body, actions = [], kind = '', onClose } = {}) {
  const close = () => {
    scrim.style.transition = 'opacity .18s'; scrim.style.opacity = '0';
    setTimeout(() => scrim.remove(), 180);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };

  const panel = el('div', { class: `modal ${kind}`, role: 'dialog', 'aria-modal': 'true' },
    el('div', { class: 'modal-h' },
      el('h2', {}, title),
      el('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Закрыть' }, icon('x'))),
    el('div', { class: 'modal-b' }, body),
    actions.length ? el('div', { class: 'modal-f' },
      ...actions.map(a => el('button', {
        class: `btn ${a.class ?? ''}`,
        onclick: async () => { const r = await a.onClick?.(close); if (r !== false && a.dismiss !== false) close(); },
      }, el('span', { class: 'label' }, a.label)))) : null,
  );

  const scrim = el('div', { class: 'scrim', onclick: e => { if (e.target === scrim) close(); } }, panel);
  document.body.append(scrim);
  document.addEventListener('keydown', onKey);
  setTimeout(() => $$('input,button', panel)[1]?.focus(), 60);
  return { close, panel, scrim };
}

export const confirmDialog = (title, message, confirmLabel = 'Подтвердить') =>
  new Promise(res => {
    modal({
      title, body: el('div', { class: 'sm muted' }, message),
      actions: [
        { label: 'Отмена', class: 'ghost', onClick: () => res(false) },
        { label: confirmLabel, class: 'danger', onClick: () => res(true) },
      ],
      onClose: () => res(false),
    });
  });
