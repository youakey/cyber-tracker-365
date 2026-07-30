/* INTERACTIVE SKILL-TREE NODE MAP :: six protocol nodes on a live link grid. */
import { el, svg, bus } from '../../core/util.js';
import { TRACKS } from '../../core/presets.js';
import { S, progressPct } from '../../core/store.js';
import { buzz } from '../../fx/haptics.js';

const LINKS = [
  ['split', 'planche'], ['planche', 'handstand'],
  ['split', 'bench'], ['planche', 'squat'], ['handstand', 'deadlift'],
  ['bench', 'squat'], ['squat', 'deadlift'], ['bench', 'deadlift'],
];

export function SkillTree({ onPick, height = 230 } = {}) {
  const root = el('div', { class: 'tree', style: { position: 'relative', height: height + 'px' } });

  function render() {
    const pos = Object.fromEntries(TRACKS.map(t => [t.code, t.node]));

    /* link layer */
    const s = svg('svg', {
      viewBox: '0 0 100 100', preserveAspectRatio: 'none',
      style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none',
    });
    for (const [a, b] of LINKS) {
      const pa = pos[a], pb = pos[b];
      const done = progressPct(a) >= 100 && progressPct(b) >= 100;
      const live = progressPct(a) > 8 || progressPct(b) > 8;
      s.append(svg('line', {
        x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
        stroke: done ? 'var(--green)' : live ? 'var(--cyan)' : 'var(--line-hot)',
        'stroke-width': done ? .7 : .45,
        'stroke-dasharray': live ? 'none' : '1.5 1.5',
        opacity: live ? .8 : .5,
        'vector-effect': 'non-scaling-stroke',
      }));
    }
    /* travelling pulse along the strongest link */
    const hot = TRACKS.slice().sort((a, b) => progressPct(b.code) - progressPct(a.code))[0];
    if (hot) {
      const c = svg('circle', { r: 1.1, fill: 'var(--cyan)', opacity: .9 });
      const anim = svg('animateMotion', { dur: '3.2s', repeatCount: 'indefinite',
        path: `M${pos[hot.code].x},${pos[hot.code].y} L50,50` });
      c.append(anim); s.append(c);
    }

    const nodes = TRACKS.map(t => {
      const p = progressPct(t.code);
      const cls = ['node'];
      if (p >= 100) cls.push('done'); else if (p > 5) cls.push('active'); else cls.push('locked');
      return el('button', {
        class: cls.join(' '),
        style: { left: t.node.x + '%', top: t.node.y + '%' },
        title: `${t.name} — ${Math.round(p)}%`,
        onclick: () => { buzz('select'); bus.emit('track:open', t.code); onPick?.(t.code); },
      },
        el('span', {}, t.glyph),
        el('span', { class: 'pc' }, Math.round(p) + '%'));
    });

    root.replaceChildren(s, ...nodes,
      el('div', { class: 'tiny dim mono', style: { position: 'absolute', left: 0, bottom: 0 } }, 'ТРЕК A · КАЛИСТЕНИКА'),
      el('div', { class: 'tiny dim mono', style: { position: 'absolute', right: 0, bottom: 0 } }, 'ТРЕК B · СИЛОВЫЕ'));
  }

  render(); bus.on('store', render);
  return root;
}
