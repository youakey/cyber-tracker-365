/* Тактические уведомления. */
import { el, $ } from '../../core/util.js';
import { icon } from './icons.js';
import { buzz } from '../../fx/haptics.js';

let host;
const ensure = () => host ??= ($('#toasts') ?? document.body.appendChild(el('div', { id: 'toasts' })));

const GLYPH = { ok: 'check', warn: 'warn', crit: 'warn', info: 'bolt' };
const TONE  = { ok: 'c-green', warn: 'c-amber', crit: 'c-red', info: 'c-cyan' };

export function toast(title, body = '', kind = 'info', ttl = 5200) {
  ensure();
  const node = el('div', { class: `toast ${kind}` },
    el('div', { class: `th ${TONE[kind] ?? ''}` }, icon(GLYPH[kind] ?? 'bolt'), el('span', {}, title)),
    body ? el('div', { class: 'tb' }, body) : null);
  node.addEventListener('click', () => kill(node));
  host.append(node);
  buzz(kind === 'crit' ? 'error' : kind === 'warn' ? 'warn' : 'select');
  if (ttl) setTimeout(() => kill(node), ttl);
  return node;
}

function kill(node) {
  if (!node.isConnected) return;
  node.style.transition = 'opacity .22s, transform .22s';
  node.style.opacity = '0'; node.style.transform = 'translateX(40px)';
  setTimeout(() => node.remove(), 220);
}

export const ok   = (t, b) => toast(t, b, 'ok');
export const warn = (t, b) => toast(t, b, 'warn');
export const err  = (t, b) => toast(t, b, 'crit', 7000);
