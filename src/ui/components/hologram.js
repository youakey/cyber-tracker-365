/* =========================================================================
   ИНТЕРАКТИВНАЯ ГОЛОГРАММА МЫШЦ
   Pure inline SVG anatomy blueprint (front + posterior). Every zone is a
   tappable target that routes straight into its bound training protocol.
   Zero external assets — draws in ~2ms, weighs nothing.
   ========================================================================= */
import { svg, el, bus } from '../../core/util.js';
import { MUSCLES, MUSCLE_TO_TRACK } from '../../core/presets.js';

const VB = { w: 200, h: 420 };

/* --- zone geometry. `pair:true` renders a mirrored twin automatically. --- */
const FRONT = [
  { m:'neck',       pair:false, d:'M91,49 L109,49 L111,65 L89,65 Z' },
  { m:'traps',      pair:false, d:'M76,70 L92,59 L108,59 L124,70 L119,77 L81,77 Z' },
  { m:'front_delt', pair:true,  d:'M63,74 C58,81 57,93 63,101 L77,97 L79,77 Z' },
  { m:'side_delt',  pair:true,  d:'M58,76 C51,85 51,97 57,105 L63,101 C57,93 58,81 63,74 Z' },
  { m:'chest',      pair:true,  d:'M80,77 L98,74 L98,105 L85,107 C78,99 78,87 80,77 Z' },
  { m:'serratus',   pair:true,  d:'M80,110 L90,107 L90,124 L83,126 Z' },
  { m:'biceps',     pair:true,  d:'M60,103 L75,99 L71,132 L58,131 Z' },
  { m:'forearm',    pair:true,  d:'M57,134 L71,134 L69,172 L55,170 Z' },
  { m:'abs',        pair:false, d:'M88,108 L112,108 L112,158 L100,167 L88,158 Z' },
  { m:'obliques',   pair:true,  d:'M81,113 L87,110 L87,158 L84,150 Z' },
  { m:'hip_flexors',pair:false, d:'M86,161 L114,161 L110,180 L90,180 Z' },
  { m:'adductors',  pair:true,  d:'M92,182 L99,182 L98,222 L91,216 Z' },
  { m:'quads',      pair:true,  d:'M78,172 L94,178 L92,244 L75,238 Z' },
  { m:'calves',     pair:true,  d:'M79,256 L93,254 L90,306 L79,304 Z' },
];

const BACK = [
  { m:'neck',       pair:false, d:'M91,49 L109,49 L111,64 L89,64 Z' },
  { m:'traps',      pair:false, d:'M74,68 L92,58 L108,58 L126,68 L112,112 L100,120 L88,112 Z' },
  { m:'rear_delt',  pair:true,  d:'M60,75 C54,82 53,95 59,103 L76,98 L78,77 Z' },
  { m:'lats',       pair:true,  d:'M79,86 L96,104 L96,146 L84,140 C77,124 76,102 79,86 Z' },
  { m:'triceps',    pair:true,  d:'M58,101 L74,98 L70,133 L56,131 Z' },
  { m:'forearm',    pair:true,  d:'M55,135 L70,135 L68,173 L53,171 Z' },
  { m:'lower_back', pair:false, d:'M87,132 L113,132 L110,168 L90,168 Z' },
  { m:'glutes',     pair:true,  d:'M82,170 L99,170 L99,206 L82,202 C77,190 78,178 82,170 Z' },
  { m:'hamstrings', pair:true,  d:'M80,208 L97,208 L94,254 L79,250 Z' },
  { m:'adductors',  pair:true,  d:'M93,186 L99,186 L98,226 L92,220 Z' },
  { m:'calves',     pair:true,  d:'M79,258 L93,256 L90,308 L79,306 Z' },
];

/* --- non-interactive body silhouette (blueprint chrome) ------------------ */
function silhouette(view) {
  const g = svg('g', { class: 'frame' });
  g.append(
    svg('ellipse', { cx:100, cy:33, rx:16, ry:20 }),
    svg('path', { d:'M76,70 C60,74 52,86 52,104 L52,176 C52,182 56,184 60,182 L66,178 L74,250 L74,308 L78,330 L94,330 L96,250 L100,214' }),
    svg('path', { d:'M124,70 C140,74 148,86 148,104 L148,176 C148,182 144,184 140,182 L134,178 L126,250 L126,308 L122,330 L106,330 L104,250 L100,214' }),
    svg('path', { d:'M76,70 L124,70 L128,120 L124,168 L114,182 L86,182 L76,168 L72,120 Z' }),
    svg('path', { d:'M78,330 L78,342 L96,342 L96,330' }),
    svg('path', { d:'M122,330 L122,342 L104,342 L104,330' }),
    // targeting reticle chrome
    svg('path', { d:'M14,14 L14,4 L34,4 M186,14 L186,4 L166,4 M14,406 L14,416 L34,416 M186,406 L186,416 L166,416',
      stroke:'var(--line-hot)', 'stroke-dasharray':'none' }),
  );
  if (view === 'back') g.setAttribute('opacity', '.9');
  return g;
}

/**
 * @param {'front'|'back'} view
 * @param {object} opts { heat:{muscle:0..1}, active:string[], selected:string[], onPick(muscle,track) }
 */
export function Hologram(view = 'front', opts = {}) {
  const zones = view === 'back' ? BACK : FRONT;
  const root = el('div', { class: 'holo', dataset: { view } });

  const s = svg('svg', {
    viewBox: `0 0 ${VB.w} ${VB.h}`,
    role: 'img',
    'aria-label': `Голограмма анатомии (${view === 'back' ? 'сзади' : 'спереди'})`,
  });

  /* defs: scan gradient */
  const defs = svg('defs');
  const lg = svg('linearGradient', { id: `scan-${view}`, x1:0, y1:0, x2:0, y2:1 });
  lg.append(
    svg('stop', { offset:'0%',  'stop-color':'currentColor', 'stop-opacity':0 }),
    svg('stop', { offset:'50%', 'stop-color':'currentColor', 'stop-opacity':.4 }),
    svg('stop', { offset:'100%','stop-color':'currentColor', 'stop-opacity':0 }),
  );
  defs.append(lg);
  s.append(defs, silhouette(view));

  const heat = opts.heat ?? {};
  const active = new Set(opts.active ?? []);
  const selected = new Set(opts.selected ?? []);

  const makePath = (z, mirrored) => {
    const p = svg('path', {
      d: z.d,
      class: 'mz',
      'data-m': z.m,
      tabindex: 0,
      role: 'button',
      'aria-label': MUSCLES[z.m] ?? z.m,
    });
    const h = heat[z.m] ?? 0;
    if (selected.has(z.m)) p.classList.add('sel');
    else if (active.has(z.m)) p.classList.add('on');
    else if (h > 0.05) {
      p.classList.add(h > 0.55 ? 'on' : 'on2');
      p.style.opacity = String(0.35 + h * 0.65);
    }
    const fire = ev => {
      ev.preventDefault();
      const track = MUSCLE_TO_TRACK[z.m] ?? null;
      bus.emit('holo:pick', { muscle: z.m, track, label: MUSCLES[z.m] });
      opts.onPick?.(z.m, track, ev);
    };
    p.addEventListener('click', fire);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
    if (mirrored) p.classList.add('mir');
    return p;
  };

  const gL = svg('g');
  const gR = svg('g', { transform: `translate(${VB.w},0) scale(-1,1)` });
  for (const z of zones) {
    gL.append(makePath(z, false));
    if (z.pair) gR.append(makePath(z, true));
  }
  s.append(gL, gR);

  /* sweeping scan bar */
  s.append(svg('rect', {
    class: 'scanline', x: 0, y: -40, width: VB.w, height: 40,
    fill: `url(#scan-${view})`, 'pointer-events': 'none',
  }));

  root.append(s);
  if (opts.hint !== false) {
    root.append(el('div', { class: 'holo-hint' }, 'коснитесь группы мышц, чтобы открыть протокол'));
  }
  return root;
}

/** Dual front/back rig for the desktop centre column. */
export function HologramRig(opts = {}) {
  return el('div', { class: 'grid g2' },
    el('div', {}, Hologram('front', { ...opts, hint: false }),
      el('div', { class: 'holo-hint' }, 'спереди')),
    el('div', {}, Hologram('back', { ...opts, hint: false }),
      el('div', { class: 'holo-hint' }, 'сзади')),
  );
}

export const MUSCLE_LABEL = m => MUSCLES[m] ?? m.toUpperCase();
