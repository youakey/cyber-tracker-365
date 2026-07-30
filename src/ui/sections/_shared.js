/* Мелкие строительные блоки, общие для разделов. */
import { el } from '../../core/util.js';

export const card = (title, body, { right = null, cls = '', hud = true } = {}) =>
  el('section', { class: `card ${hud ? 'hud' : ''} scanfx ${cls}` },
    el('span', { class: 'beam' }),
    title ? el('div', { class: 'card-t' },
      el('h3', {}, title),
      right ?? null) : null,
    body);

export const sectionH = (title, aside = null) =>
  el('div', { class: 'section-h' },
    el('h2', {}, title),
    el('span', { class: 'rule' }),
    aside ? el('span', { class: 'aside' }, aside) : null);

export const stat = (k, v, { unit = '', cls = '', sm = false } = {}) =>
  el('div', { class: 'stat' },
    el('span', { class: 'k' }, k),
    el('span', { class: 'row gap-1', style: { alignItems: 'baseline' } },
      el('span', { class: `v ${sm ? 'sm' : ''} ${cls}` }, v),
      unit ? el('span', { class: 'u' }, unit) : null));

export const empty = (big, small = '') =>
  el('div', { class: 'empty' },
    el('div', { class: 'big' }, big),
    small ? el('div', { class: 'tiny' }, small) : null);
