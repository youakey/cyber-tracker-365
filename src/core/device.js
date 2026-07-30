/* Viewport / capability detection + reactive layout switching. */
import { bus, throttle } from './util.js';

export const isTouch = () => matchMedia('(pointer:coarse)').matches;
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.platform) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
export const isStandalone = () => matchMedia('(display-mode:standalone)').matches || navigator.standalone === true;

const MQ = matchMedia('(min-width:1024px)');
export let layout = MQ.matches ? 'desktop' : 'mobile';

export function watchLayout() {
  const apply = () => {
    const next = MQ.matches ? 'desktop' : 'mobile';
    if (next !== layout) { layout = next; document.body.dataset.layout = next; bus.emit('layout:change', next); }
  };
  MQ.addEventListener?.('change', apply);
  addEventListener('resize', throttle(apply, 180));
  document.body.dataset.layout = layout;
  if (isIOS()) document.body.dataset.ios = '1';
  return layout;
}

/** Horizontal swipe recogniser for the Pocket Cyber-Deck. */
export function onSwipe(node, { left, right, threshold = 62 } = {}) {
  let x0 = 0, y0 = 0, t0 = 0, active = false;
  node.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); active = true;
  }, { passive: true });
  node.addEventListener('touchend', e => {
    if (!active) return; active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 800) return;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    (dx < 0 ? left : right)?.();
  }, { passive: true });
}
