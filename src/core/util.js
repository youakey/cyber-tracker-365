/* CYBER-TRACKER 365 :: micro DOM + math utilities (no dependencies) */

/* --- DOM ---------------------------------------------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const svg = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  kids.flat(3).forEach(k => k && n.append(k.nodeType ? k : document.createTextNode(String(k))));
  return n;
};

export const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const mount = (n, ...kids) => { clear(n); n.append(...kids.flat(3).filter(Boolean)); return n; };

/* --- math --------------------------------------------------------------- */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const pct   = (v, max) => clamp(max > 0 ? (v / max) * 100 : 0, 0, 100);
export const rnd   = (a, b) => a + Math.random() * (b - a);
export const rndInt= (a, b) => Math.floor(rnd(a, b + 1));
export const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
export const sum   = arr => arr.reduce((a, b) => a + (Number(b) || 0), 0);

/** Epley formula with a Brzycki blend — stable for 1-12 reps. */
export function estimate1RM(weightKg, reps) {
  const w = Number(weightKg) || 0, r = clamp(Number(reps) || 0, 0, 20);
  if (!w || !r) return 0;
  if (r === 1) return round1(w);
  const epley   = w * (1 + r / 30);
  const brzycki = w * (36 / (37 - Math.min(r, 35)));
  return round1((epley + brzycki) / 2);
}
export const round1 = n => Math.round(n * 10) / 10;

/* --- dates -------------------------------------------------------------- */
export const iso = d => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const today = () => iso(new Date());
export function weekKey(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;            // monday = 0
  x.setDate(x.getDate() - day);
  return iso(x);
}
export const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
export const monthMatrix = (year, month) => {
  const first = new Date(year, month, 1);
  const lead  = (first.getDay() + 6) % 7;      // monday-first
  const len   = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= len; d++) cells.push(iso(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
};

/* --- text --------------------------------------------------------------- */
const HEX = '0123456789ABCDEF';
export const hex = n => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('');
export const hexAddr = () => '0x' + hex(8);
export const pad = (n, w = 2) => String(n).padStart(w, '0');
export const stamp = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --- async -------------------------------------------------------------- */
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function throttle(fn, ms = 100) {
  let last = 0; return (...a) => { const n = Date.now(); if (n - last >= ms) { last = n; fn(...a); } };
}

/* --- tiny event bus ----------------------------------------------------- */
export const bus = (() => {
  const map = new Map();
  return {
    on(evt, fn) { (map.get(evt) ?? map.set(evt, new Set()).get(evt)).add(fn); return () => map.get(evt)?.delete(fn); },
    off(evt, fn) { map.get(evt)?.delete(fn); },
    clear(evt) { evt ? map.delete(evt) : map.clear(); },
    emit(evt, payload) { map.get(evt)?.forEach(fn => { try { fn(payload); } catch (e) { console.error('[bus]', evt, e); } }); },
  };
})();

/* --- typewriter --------------------------------------------------------- */
export async function typeInto(node, text, speed = 16) {
  node.textContent = '';
  for (const ch of text) { node.textContent += ch; await sleep(speed); }
  return node;
}

/* --- safe localStorage -------------------------------------------------- */
export const LS = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k)    { try { localStorage.removeItem(k); } catch {} },
};
