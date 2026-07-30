/* ══════════════════════════════════════════════════════════════
   ГРАФИКИ НА CANVAS :: радар, спарклайн, шкала цели, график подъёма
   Без библиотек. Цвета читаются из CSS-переменных, поэтому графики
   сами перекрашиваются при смене темы.
   ══════════════════════════════════════════════════════════════ */
import { el, clamp, bus } from '../../core/util.js';

/** Значение CSS-переменной, например cssv('--cyan'). */
export function cssv(name, fallback = '#22e3d4') {
  if (!name) return fallback;
  if (name.startsWith('var(')) name = name.slice(4, -1).trim();
  if (!name.startsWith('--')) return name;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const alpha = (hex, a) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/** Базовый холст: DPR, авто-перерисовка на resize и смене темы. */
function canvasBox(height, draw) {
  const wrap = el('div', { style: { position: 'relative', width: '100%' } });
  const cv = el('canvas', { style: { width: '100%', display: 'block',
    height: height ? height + 'px' : 'auto' } });
  wrap.append(cv);
  const render = () => {
    const W = wrap.clientWidth || 300;
    if (!W) return;
    const H = height || W;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    if (!height) cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    draw(ctx, W, H);
  };
  requestAnimationFrame(render);
  new ResizeObserver(render).observe(wrap);
  bus.on('theme:change', () => requestAnimationFrame(render));
  wrap._redraw = render;
  return wrap;
}

/* ─────────────────────────── РАДАР ─────────────────────────── */
export function RadarChart(data) {
  return canvasBox(null, (ctx, W) => {
    const line = cssv('--line-hot', '#2b415c');
    const txt3 = cssv('--txt-3', '#52687f');
    const cyan = cssv('--cyan');
    const keys = Object.keys(data);
    const n = keys.length || 1;
    const cx = W / 2, cy = W / 2, R = W * 0.33;
    const ang = i => (Math.PI * 2 * i) / n - Math.PI / 2;

    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = ang(i % n), rr = (R * r) / 4;
        i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
          : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.strokeStyle = alpha(line, r === 4 ? .9 : .4); ctx.lineWidth = 1; ctx.stroke();
    }

    ctx.font = `${Math.max(8.5, W * 0.031)}px ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    keys.forEach((k, i) => {
      const a = ang(i);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = alpha(line, .45); ctx.stroke();
      const lx = cx + Math.cos(a) * (R + W * 0.088);
      const ly = cy + Math.sin(a) * (R + W * 0.072);
      ctx.fillStyle = txt3; ctx.fillText(k, lx, ly);
      ctx.fillStyle = cyan;
      ctx.font = `700 ${Math.max(9.5, W * 0.036)}px ui-monospace, monospace`;
      ctx.fillText(String(Math.round(data[k])), lx, ly + W * 0.045);
      ctx.font = `${Math.max(8.5, W * 0.031)}px ui-monospace, monospace`;
    });

    ctx.beginPath();
    keys.forEach((k, i) => {
      const a = ang(i), v = clamp(data[k] ?? 0, 0, 100) / 100;
      const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, alpha(cyan, .34));
    g.addColorStop(1, alpha(cssv('--elec', '#4d9fff'), .12));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = cyan; ctx.lineWidth = 2; ctx.stroke();

    keys.forEach((k, i) => {
      const a = ang(i), v = clamp(data[k] ?? 0, 0, 100) / 100;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v, 3, 0, 6.2832);
      ctx.fillStyle = cssv('--surface', '#0b111a'); ctx.fill();
      ctx.strokeStyle = cyan; ctx.lineWidth = 2; ctx.stroke();
    });
  });
}

/* ───────────────────────── СПАРКЛАЙН ───────────────────────── */
export function Sparkline(points, { height = 68, color = '--cyan', unit = '' } = {}) {
  return canvasBox(height, (ctx, W, H) => {
    const c = cssv(color);
    if (points.length < 2) {
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = cssv('--txt-3'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('данных пока нет', W / 2, H / 2);
      return;
    }
    const ys = points.map(p => p.y);
    const min = Math.min(...ys) * 0.95, max = Math.max(...ys) * 1.05 || 1;
    const X = i => 3 + (i / (points.length - 1)) * (W - 6);
    const Y = v => H - 8 - ((v - min) / (max - min || 1)) * (H - 20);

    ctx.strokeStyle = alpha(cssv('--line-hot'), .35); ctx.lineWidth = 1;
    for (let g = 0; g < 4; g++) {
      const y = 8 + (g / 3) * (H - 16);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.beginPath(); ctx.moveTo(X(0), H);
    points.forEach((p, i) => ctx.lineTo(X(i), Y(p.y)));
    ctx.lineTo(X(points.length - 1), H); ctx.closePath();
    const g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, alpha(c, .26)); g2.addColorStop(1, alpha(c, 0));
    ctx.fillStyle = g2; ctx.fill();

    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.y)) : ctx.moveTo(X(i), Y(p.y)));
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    const lx = X(points.length - 1), ly = Y(points.at(-1).y);
    ctx.beginPath(); ctx.arc(lx, ly, 3.4, 0, 6.2832);
    ctx.fillStyle = cssv('--surface'); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();

    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillStyle = c; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(points.at(-1).y + (unit ? ' ' + unit : ''), W - 4, 4);
  });
}

/* ──────────────────── ГРАФИК ВРЕМЕНИ ПОДЪЁМА ──────────────────── */
/**
 * points = [{ x:'2026-07-30', wake:312, onTarget:true }]  (минуты от полуночи)
 * Горизонтальная линия — цель. Точки выше линии — проспал.
 */
export function WakePlot(points, { targetMin = 300, tol = 15, height = 132 } = {}) {
  return canvasBox(height, (ctx, W, H) => {
    const cyan = cssv('--cyan'), green = cssv('--green'), amber = cssv('--amber');
    const line = cssv('--line-hot'), txt3 = cssv('--txt-3');

    if (!points.length) {
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillStyle = txt3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('нет записей о сне', W / 2, H / 2);
      return;
    }

    const vals = points.map(p => p.wake);
    const lo = Math.min(targetMin - 40, ...vals) - 15;
    const hi = Math.max(targetMin + 40, ...vals) + 15;
    const padL = 40, padR = 8, padT = 12, padB = 18;
    const X = i => padL + (points.length === 1 ? (W - padL - padR) / 2
      : (i / (points.length - 1)) * (W - padL - padR));
    const Y = v => padT + ((v - lo) / (hi - lo || 1)) * (H - padT - padB);

    /* подписи часов слева */
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = txt3;
    for (let m = Math.ceil(lo / 60) * 60; m <= hi; m += 60) {
      const y = Y(m);
      ctx.strokeStyle = alpha(line, .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL - 5, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText(`${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:00`, padL - 9, y);
    }

    /* зона допуска вокруг цели */
    ctx.fillStyle = alpha(green, .10);
    ctx.fillRect(padL, Y(targetMin - tol), W - padL - padR, Math.max(2, Y(targetMin + tol) - Y(targetMin - tol)));

    /* линия цели */
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = green; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(padL, Y(targetMin)); ctx.lineTo(W - padR, Y(targetMin)); ctx.stroke();
    ctx.setLineDash([]);

    /* ломаная */
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.wake)) : ctx.moveTo(X(i), Y(p.wake)));
    ctx.strokeStyle = alpha(cyan, .85); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    /* точки */
    points.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(X(i), Y(p.wake), 3.4, 0, 6.2832);
      ctx.fillStyle = cssv('--surface'); ctx.fill();
      ctx.strokeStyle = p.onTarget ? green : amber; ctx.lineWidth = 2; ctx.stroke();
    });

    /* подпись цели */
    ctx.font = "700 10px ui-monospace, monospace";
    ctx.fillStyle = green; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('цель', padL + 3, Y(targetMin) - 3);
  });
}

/* ───────────────────── ШКАЛА К ЦЕЛИ ───────────────────── */
export function TargetBar(value, target, { unit = '', color = '--cyan', label = '' } = {}) {
  const p = clamp(target > 0 ? (value / target) * 100 : 0, 0, 100);
  const c = cssv(color);
  return el('div', { class: 'col gap-1' },
    el('div', { class: 'row between tiny' },
      el('span', { class: 'mono', style: { color: c, fontWeight: '700' } }, `${value}${unit}`),
      el('span', { class: 'dim mono' }, `цель ${target}${unit}`)),
    el('div', { class: 'bar lg' },
      el('i', { style: { width: p + '%', background: c } })),
    label ? el('div', { class: 'tiny dim' }, label) : null);
}
