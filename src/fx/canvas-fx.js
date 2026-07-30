/* =========================================================================
   ЭФФЕКТЫ НА CANVAS
   Один общий полноэкранный холст. Без библиотек, с учётом DPR, цикл RAF
   останавливается сам, когда рисовать нечего.

   Тон намеренно сдержанный: короткая вспышка вместо фейерверка,
   мягкое смещение вместо тряски экрана. Всё уважает prefers-reduced-motion.
   ========================================================================= */
import { rnd, rndInt, pick, clamp } from '../core/util.js';
import { buzz } from './haptics.js';

let cv, ctx, dpr = 1, raf = 0, running = false;
let particles = [];
let shockwaves = [];
let rain = null;              // matrix rain state (null = off)
let banners = [];

export function initFX(host = document.getElementById('fx-layer')) {
  if (cv) return cv;
  cv = document.createElement('canvas');
  ctx = cv.getContext('2d');
  host.append(cv);
  resize();
  addEventListener('resize', resize);
  return cv;
}

function resize() {
  if (!cv) return;
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width  = Math.floor(innerWidth  * dpr);
  cv.height = Math.floor(innerHeight * dpr);
  if (rain) seedRain();
}

function ensureLoop() {
  if (running) return;
  running = true;
  raf = requestAnimationFrame(tick);
}

function tick() {
  const W = cv.width, H = cv.height;
  if (rain) drawRain(W, H); else ctx.clearRect(0, 0, W, H);

  drawShockwaves(W, H);
  drawParticles();
  drawBanners(W, H);

  const alive = particles.length || shockwaves.length || banners.length || rain;
  if (alive) raf = requestAnimationFrame(tick);
  else { running = false; ctx.clearRect(0, 0, W, H); }
}

/* ---------------------------- PARTICLES --------------------------------- */
const themeVar = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
const palette = () => [
  themeVar('--cyan', '#22e3d4'), themeVar('--elec', '#4d9fff'),
  themeVar('--green', '#2ee6a8'), themeVar('--amber', '#ffb020'),
  themeVar('--violet', '#a78bfa'),
];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Particle explosion at viewport coords (CSS px). */
export function burst(x, y, {
  count = 90, hue = null, speed = 9, life = 62, size = 3, gravity = .16, spread = Math.PI * 2,
} = {}) {
  initFX();
  const px = x * dpr, py = y * dpr;
  for (let i = 0; i < count; i++) {
    const a = rnd(0, spread);
    const v = rnd(speed * .25, speed) * dpr;
    particles.push({
      x: px, y: py,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - rnd(0, 2) * dpr,
      r: rnd(size * .4, size) * dpr,
      life: rndInt(life * .5, life), max: life,
      c: hue ?? pick(palette()), g: gravity * dpr,
      spin: rnd(-.3, .3), rot: rnd(0, 6.28), sq: Math.random() < .45,
    });
  }
  if (particles.length > 1400) particles = particles.slice(-1400);
  ensureLoop();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .985; p.vy *= .985;
    p.rot += p.spin; p.life--;
    if (p.life <= 0 || p.y > cv.height + 60) { particles.splice(i, 1); continue; }
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.c;
    ctx.shadowBlur = 14 * dpr; ctx.shadowColor = p.c;
    if (p.sq) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, 6.2832); ctx.fill();
    }
  }
  ctx.restore();
}

/* --------------------------- SHOCKWAVES --------------------------------- */
export function shockwave(x, y, { color = '#00f0ff', max = 340, width = 4 } = {}) {
  initFX();
  shockwaves.push({ x: x * dpr, y: y * dpr, r: 4, max: max * dpr, w: width * dpr, c: color });
  ensureLoop();
}

function drawShockwaves() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r += (s.max - s.r) * .09 + 2;
    const a = 1 - s.r / s.max;
    if (a <= .02) { shockwaves.splice(i, 1); continue; }
    ctx.globalAlpha = a;
    ctx.strokeStyle = s.c; ctx.lineWidth = s.w * a;
    ctx.shadowBlur = 26 * dpr; ctx.shadowColor = s.c;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.stroke();
    ctx.globalAlpha = a * .35;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * .62, 0, 6.2832); ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------- CRIT BANNER -------------------------------- */
export function critBanner(text = 'CRITICAL HIT', sub = '') {
  initFX();
  banners.push({ text, sub, t: 0, life: 104 });
  ensureLoop();
}

function drawBanners(W, H) {
  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i]; b.t++;
    if (b.t > b.life) { banners.splice(i, 1); continue; }
    const p = b.t / b.life;
    const a = p < .12 ? p / .12 : p > .78 ? (1 - p) / .22 : 1;
    const scale = 1 + (1 - Math.min(1, p * 5)) * .6;
    const jitter = p < .3 ? rnd(-5, 5) * dpr : 0;

    ctx.save();
    ctx.translate(W / 2 + jitter, H * .38);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = a;
    const fs = Math.min(W * .07, 48 * dpr);
    ctx.font = `700 ${fs}px ui-monospace, monospace`;
    ctx.fillStyle = themeVar('--cyan', '#22e3d4');
    ctx.shadowBlur = 22 * dpr; ctx.shadowColor = themeVar('--cyan', '#22e3d4');
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = `${fs * .26}px ui-monospace, monospace`;
      ctx.shadowBlur = 8 * dpr; ctx.fillStyle = themeVar('--txt-2', '#8ba4c0');
      ctx.fillText(b.sub, 0, fs * .74);
    }
    ctx.restore();
  }
}

/* --------------------------- MATRIX RAIN -------------------------------- */
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF';

function seedRain() {
  const fs = 16 * dpr;
  const cols = Math.ceil(cv.width / fs);
  rain = { fs, cols, y: Array.from({ length: cols }, () => rnd(-60, 0)), speed: Array.from({ length: cols }, () => rnd(.5, 1.7)) };
}

export function toggleMatrixRain(on) {
  initFX();
  if (on === undefined) on = !rain;
  if (on) { seedRain(); ensureLoop(); } else { rain = null; ensureLoop(); }
  return !!rain;
}
export const matrixRainOn = () => !!rain;

function drawRain(W, H) {
  ctx.fillStyle = 'rgba(0,6,4,.10)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `${rain.fs}px 'Share Tech Mono', monospace`;
  ctx.textBaseline = 'top';
  for (let i = 0; i < rain.cols; i++) {
    const x = i * rain.fs;
    const y = rain.y[i] * rain.fs;
    const g = themeVar('--green', '#2ee6a8');
    ctx.fillStyle = '#e8fff5'; ctx.shadowBlur = 12; ctx.shadowColor = g;
    ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x, y);
    ctx.shadowBlur = 0; ctx.fillStyle = g;
    for (let k = 1; k < 9; k++) {
      const yy = y - k * rain.fs;
      if (yy < -rain.fs) break;
      ctx.globalAlpha = 1 - k / 9;
      ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], x, yy);
    }
    ctx.globalAlpha = 1;
    rain.y[i] += rain.speed[i];
    if (y > H && Math.random() > .975) rain.y[i] = rnd(-40, 0);
  }
}

/* --------------------------- СОСТАВНЫЕ ЭФФЕКТЫ --------------------------- */

/**
 * Празднование рекорда: мягкое смещение страницы, одна волна, короткий
 * залп частиц и подпись. Ощутимо, но не выбивает из контекста.
 */
export function celebrate({ x = innerWidth / 2, y = innerHeight * .42, label = 'Готово', sub = '' } = {}) {
  nudge();
  if (!reduced()) {
    shockwave(x, y, { color: themeVar('--cyan', '#22e3d4'), max: Math.min(innerWidth, 720) });
    burst(x, y, { count: 70, speed: 8, life: 54, size: 2.8, gravity: .2 });
  }
  critBanner(label, sub);
  buzz('confirm');
}

/** Короткая вспышка в точке — подтверждение действия. */
export function spark(x, y, color = '--cyan') {
  if (reduced()) { buzz('tap'); return; }
  burst(x, y, { count: 18, speed: 4.5, life: 30, size: 2, hue: themeVar(color.startsWith('--') ? color : '--cyan', '#22e3d4') });
  buzz('tap');
}

/** Мягкое смещение вместо тряски. */
export function nudge() {
  const app = document.getElementById('app');
  if (!app || reduced()) return;
  app.classList.remove('nudge'); void app.offsetWidth; app.classList.add('nudge');
  setTimeout(() => app.classList.remove('nudge'), 420);
}
