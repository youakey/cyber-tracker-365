/* ══════════════════════════════════════════════════════════════
   ЧЕЛЛЕНДЖИ
   Урон засчитывается только по реальным цифрам: нужно превысить
   60% собственного лучшего результата. Слабый ввод — контратака.
   ══════════════════════════════════════════════════════════════ */
import { el, clamp, round1, bus } from '../../core/util.js';
import { S, availableBosses, grant } from '../../core/store.js';
import { recordBossDefeat } from '../../core/db.js';
import { TRACK_BY_CODE } from '../../core/presets.js';
import { modal } from '../components/modal.js';
import { ok, warn, err } from '../components/toast.js';
import { celebrate, spark, nudge } from '../../fx/canvas-fx.js';
import { buzz } from '../../fx/haptics.js';

export function BossList() {
  const root = el('div', { class: 'col gap-2' });
  const render = () => {
    root.replaceChildren(...availableBosses().map(b => {
      const t = b.trackMeta;
      return el('button', {
        class: `item ${b.beaten ? 'owned' : ''} ${b.unlocked || b.beaten ? '' : 'locked'}`,
        onclick: () => b.unlocked
          ? openBoss(b.code)
          : warn('Пока закрыт', `Нужно дойти до ${Math.round(b.unlock.at * 100)}% цели «${t.name}».`),
      },
        el('span', { class: 'ic', style: { color: b.beaten ? 'var(--green)' : 'var(--amber)' } },
          b.beaten ? '✓' : '!'),
        el('span', { class: 'col grow gap-1' },
          el('span', { class: 'sm' }, b.name),
          el('span', { class: 'tiny dim' }, `${t.name} · ${b.hp} прочности · награда ${b.credits} оч.`)),
        el('span', { class: 'pill ' + (b.beaten ? 'ok' : b.unlocked ? 'warn' : '') },
          b.beaten ? 'пройден' : b.unlocked ? 'открыт' : Math.round(b.ratio * 100) + '%'));
    }));
  };
  render(); bus.on('store', render);
  return root;
}

export function openBoss(code) {
  const b = availableBosses().find(x => x.code === code);
  if (!b) return;
  const t = TRACK_BY_CODE[b.track];
  buzz('select');

  let hp = b.hp, dealt = 0, strikes = 0;

  const art = el('pre', { class: 'foe' }, b.art);
  const bar = el('div', { class: 'hpbar' }, el('i', { style: { width: '100%' } }), el('span', {}, `${hp} / ${b.hp}`));
  const log = el('div', { class: 'feed', style: { height: '96px' } });
  const push = (txt, kind = '') => {
    log.prepend(el('div', { class: `line ${kind}` }, txt));
    while (log.children.length > 12) log.lastChild.remove();
  };

  const label = t.metric === 'load' ? 'Вес, кг' : t.metric === 'hold' ? 'Удержание, сек' : 'Угол, °';
  const input = el('input', { type: 'number', step: '0.5', min: '0', placeholder: '0' });
  const reps = t.metric === 'load' ? el('input', { type: 'number', min: '1', max: '30', placeholder: '5' }) : null;
  const threshold = round1((S.pr[t.code] ?? 0) * 0.6) || 1;

  const strike = el('button', { class: 'btn primary wide', onclick: onStrike }, 'Удар');

  const dlg = modal({
    title: b.name,
    kind: 'danger',
    body: el('div', { class: 'col gap-3' },
      el('div', { class: 'card flat' }, art),
      bar,
      el('div', { class: 'sm muted' },
        'Челлендж привязан к протоколу «', el('b', {}, t.name), '». Каждая цифра выше ',
        el('b', { class: 'c-cyan' }, `${threshold} ${t.unit}`), ' превращается в урон. Ниже — контратака.'),
      el('div', { class: 'grid ' + (reps ? 'g2' : '') },
        el('div', { class: 'field' }, el('label', {}, label), input),
        reps ? el('div', { class: 'field' }, el('label', {}, 'Повторения'), reps) : null),
      strike,
      el('div', { class: 'card flat tight' }, log)),
    actions: [{ label: 'Выйти', class: 'ghost' }],
  });

  push('Противник активен. Прочность 100%.', 'crit');

  async function onStrike() {
    const v = Number(input.value);
    if (!v || v <= 0) { err('Нужна цифра', 'Введите реальный результат.'); buzz('error'); return; }
    if (t.metric === 'load' && !Number(reps?.value)) { err('Нужны повторения'); buzz('error'); return; }

    strikes++;
    const ratio = v / threshold;
    if (ratio < 1) {
      hp = Math.min(b.hp, hp + Math.round(b.hp * .04));
      paint();
      push(`Удар ${strikes} не прошёл: ${v} ${t.unit} ниже порога. Противник восстановился.`, 'warn');
      nudge(); buzz('warn');
      art.classList.remove('hit'); void art.offsetWidth; art.classList.add('hit');
      return;
    }

    const neural = S.gear.some(g => g.equipped && g.gear_code === 'neural_link') ? 2 : 1;
    const god = S.profile?.god_mode ? 4 : 1;
    const crit = Math.random() < .18;
    const dmg = Math.round(v * 3.2 * ratio * neural * god * (crit ? 2.5 : 1));
    hp = Math.max(0, hp - dmg); dealt += dmg;
    paint();

    const r = strike.getBoundingClientRect();
    spark(r.left + r.width / 2, r.top, crit ? '--amber' : '--cyan');
    push(crit ? `Критический удар — ${dmg} урона!` : `Удар ${strikes}: ${dmg} урона.`, crit ? 'ok' : '');
    buzz(crit ? 'confirm' : 'tap');
    art.classList.remove('hit'); void art.offsetWidth; art.classList.add('hit');

    if (hp <= 0) await finish();
  }

  function paint() {
    bar.firstChild.style.width = clamp((hp / b.hp) * 100, 0, 100) + '%';
    bar.lastChild.textContent = `${hp} / ${b.hp}`;
  }

  async function finish() {
    const bonus = Math.round(b.credits * (S.profile?.god_mode ? 3 : 1));
    await recordBossDefeat(b.code, dealt, bonus);
    S.bossDefeats.unshift({ boss_code: b.code, damage_dealt: dealt, credits_won: bonus });
    await grant({ exp: Math.round(b.hp / 2), credits: bonus });
    celebrate({ label: 'Челлендж пройден', sub: `${b.name} · +${bonus} очков · +${Math.round(b.hp / 2)} опыта` });
    bus.emit('boss:defeated', b);
    ok('Пройдено', `${b.name} — за ${strikes} ударов.`);
    setTimeout(() => dlg.close(), 1400);
  }
}

export function openBossHub() {
  modal({
    title: 'Челленджи',
    body: el('div', { class: 'col gap-3' },
      el('div', { class: 'sm muted' },
        'Открываются по мере приближения рекордов к целям.'),
      BossList()),
    actions: [{ label: 'Закрыть', class: 'ghost' }],
  });
}
