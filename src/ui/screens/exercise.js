/* ══════════════════════════════════════════════════════════════
   ПРОТОКОЛ :: телеметрия по цели + форма записи
   Открывается из дерева, с карты мышц или из быстрой записи.
   ══════════════════════════════════════════════════════════════ */
import { el, estimate1RM, round1, today, bus } from '../../core/util.js';
import { TRACK_BY_CODE, PROGRESSIONS, PROGRESSION_RU, MUSCLES } from '../../core/presets.js';
import { S, logSession, trackSeries, progressPct, setProfile } from '../../core/store.js';
import { Sparkline, TargetBar } from '../components/radar.js';
import { Hologram } from '../components/hologram.js';
import { modal } from '../components/modal.js';
import { ok, err } from '../components/toast.js';
import { celebrate, spark } from '../../fx/canvas-fx.js';
import { buzz } from '../../fx/haptics.js';

export function openProtocol(code) {
  const t = TRACK_BY_CODE[code];
  if (!t) return;
  buzz('select');

  const fields = {};
  const mk = (key, label, attrs = {}) => {
    const inp = el('input', { inputmode: 'decimal', ...attrs });
    fields[key] = inp;
    return el('div', { class: 'field' }, el('label', {}, label), inp);
  };

  const grid = el('div', { class: 'grid g2' });
  if (t.metric === 'load') {
    grid.append(
      mk('weight_kg', 'Вес, кг', { type: 'number', step: '0.5', min: '0', placeholder: '0' }),
      mk('reps', 'Повторения', { type: 'number', step: '1', min: '1', max: '30', placeholder: '5' }),
      mk('sets', 'Подходы', { type: 'number', step: '1', min: '1', max: '20', placeholder: '4' }),
      mk('rpe', 'RPE 1–10', { type: 'number', step: '0.5', min: '1', max: '10', placeholder: '8' }));
  } else if (t.metric === 'hold') {
    grid.append(
      mk('hold_seconds', 'Удержание, сек', { type: 'number', step: '1', min: '0', placeholder: '0' }),
      mk('sets', 'Попытки', { type: 'number', step: '1', min: '1', placeholder: '5' }));
  } else {
    grid.append(
      mk('angle_degrees', 'Угол в тазу, °', { type: 'number', step: '1', min: '0', max: '190', placeholder: '150' }),
      mk('stretch_minutes', 'Растяжка, мин', { type: 'number', step: '1', min: '0', placeholder: '20' }));
  }
  grid.append(
    mk('duration_min', 'Длительность, мин', { type: 'number', step: '5', min: '0', placeholder: '45' }),
    mk('performed_on', 'Дата', { type: 'date', value: S.selectedDate || today(), max: today() }));

  /* прогрессия */
  let progression = null;
  let progRow = null;
  if (t.progression) {
    const states = PROGRESSIONS[t.progression];
    const seg = el('div', { class: 'seg' });
    seg.append(...states.map(st => el('button', {
      onclick: e => {
        progression = st; buzz('tap');
        [...seg.children].forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
      },
    }, PROGRESSION_RU[st] ?? st)));
    progRow = el('div', { class: 'field' }, el('label', {}, 'Состояние прогрессии'), seg);
  }

  /* живой расчёт 1ПМ */
  const readout = el('div', { class: 'tiny', style: { minHeight: '16px' } });
  const updateReadout = () => {
    if (t.metric !== 'load') return;
    const e1 = estimate1RM(fields.weight_kg?.value, fields.reps?.value);
    const pr = S.pr[t.code] ?? 0;
    if (!e1) { readout.textContent = ''; return; }
    readout.textContent = e1 > pr
      ? `Расчётный 1ПМ ${e1} кг — это новый рекорд (было ${pr} кг)`
      : `Расчётный 1ПМ ${e1} кг · текущий рекорд ${pr} кг`;
    readout.className = 'tiny ' + (e1 > pr ? 'c-green' : 'dim');
  };
  ['weight_kg', 'reps'].forEach(k => fields[k]?.addEventListener('input', updateReadout));

  const body = el('div', { class: 'col gap-3' },
    el('div', { class: 'row between gap-3' },
      el('div', { class: 'col' },
        el('div', { class: 'sm', style: { color: t.color, fontWeight: '700' } }, t.name),
        el('div', { class: 'tiny dim' }, t.en)),
      el('div', { class: 'stat', style: { alignItems: 'flex-end' } },
        el('span', { class: 'k' }, 'Рекорд'),
        el('span', { class: 'v', style: { color: t.color } }, `${S.pr[t.code] ?? 0} ${t.unit}`))),
    el('div', { class: 'sm muted' }, t.blurb),
    TargetBar(S.pr[t.code] ?? 0, S.targets[t.code] ?? t.defaultTarget, { unit: ' ' + t.unit, color: t.color }),
    el('div', { class: 'card flat tight' },
      el('div', { class: 'tiny dim', style: { marginBottom: '4px' } }, 'Динамика, последние 24 записи'),
      Sparkline(trackSeries(t.code, 24), { color: t.color, unit: t.unit, height: 74 })),
    el('div', { class: 'row gap-1 wrap' },
      ...t.muscles.map(m => el('span', { class: 'pill' }, MUSCLES[m] ?? m))),
    el('div', { class: 'section-h' }, el('h2', {}, 'Новая запись'), el('span', { class: 'rule' })),
    grid, progRow, readout);

  return modal({
    title: `${t.name} · ${Math.round(progressPct(t.code))}%`,
    body,
    actions: [
      { label: 'Изменить цель', class: 'ghost', dismiss: false, onClick: () => { retarget(t); return false; } },
      { label: 'Сохранить', class: 'primary', dismiss: false, onClick: async close => { await commit(close); return false; } },
    ],
  });

  async function commit(close) {
    const entry = { track: t.code, kind: t.kind, exercise: t.name, muscles: t.muscles, progression };
    for (const [k, inp] of Object.entries(fields)) {
      const v = inp.value;
      if (v === '' || v === null) continue;
      entry[k] = k === 'performed_on' ? v : Number(v);
    }
    const primary = t.metric === 'load' ? entry.weight_kg
      : t.metric === 'hold' ? entry.hold_seconds : entry.angle_degrees;
    if (!primary) { err('Не заполнено главное поле', 'Без него запись не имеет смысла.'); buzz('error'); return; }
    if (t.metric === 'load' && !entry.reps) { err('Нужны повторения', 'Без них 1ПМ не посчитать.'); buzz('error'); return; }

    const res = await logSession(entry);
    close();
    if (res.isPR) {
      celebrate({ label: 'Новый рекорд', sub: `${t.name} +${res.delta} ${t.unit} · +${res.exp} опыта · +${res.credits} очков` });
    } else {
      spark(innerWidth / 2, innerHeight * .55, t.color);
      ok('Записано', `+${res.exp} опыта · +${res.credits} очков`);
    }
  }
}

/* ─────────────────────────── смена цели ─────────────────────────── */
function retarget(t) {
  const inp = el('input', { type: 'number', step: '1', value: String(S.targets[t.code] ?? t.defaultTarget) });
  modal({
    title: 'Цель протокола',
    body: el('div', { class: 'col gap-2' },
      el('div', { class: 'sm muted' }, `Какой результат считать финишем для «${t.name}»?`),
      el('div', { class: 'field' }, el('label', {}, `Цель, ${t.unit}`), inp)),
    actions: [
      { label: 'Отмена', class: 'ghost' },
      { label: 'Сохранить', class: 'primary', onClick: async () => {
        const v = Number(inp.value);
        if (!v || v <= 0) return;
        await setProfile({ [t.targetKey]: v });
        ok('Цель обновлена', `${t.name}: ${v} ${t.unit}`);
      } },
    ],
  });
}

/* ─────────────────────── быстрый выбор протокола ─────────────────────── */
export function openQuickLog() {
  const { close } = modal({
    title: 'Что записываем',
    body: el('div', { class: 'col gap-2' },
      ...Object.values(TRACK_BY_CODE).map(t =>
        el('button', { class: 'item', onclick: () => { close(); openProtocol(t.code); } },
          el('span', { class: 'ic', style: { color: t.color } }, t.glyph),
          el('span', { class: 'col grow gap-1' },
            el('span', { class: 'sm' }, t.name),
            el('span', { class: 'tiny dim' }, `рекорд ${S.pr[t.code] ?? 0} ${t.unit}`)),
          el('span', { class: 'pill' }, Math.round(progressPct(t.code)) + '%')))),
  });
}

/* ─────────────────────── просмотр дня ─────────────────────── */
export function openDayLog(date, rows) {
  const muscles = [...new Set(rows.flatMap(r => r.muscles ?? []))];
  const body = rows.length
    ? el('div', { class: 'col gap-2' }, ...rows.map(r => {
        const t = TRACK_BY_CODE[r.track];
        const metrics = [
          r.weight_kg ? `${r.weight_kg} кг × ${r.reps ?? '—'}${r.sets ? ' × ' + r.sets : ''}` : null,
          r.est_1rm ? `1ПМ ${round1(r.est_1rm)} кг` : null,
          r.hold_seconds ? `удержание ${r.hold_seconds} с` : null,
          r.angle_degrees ? `угол ${r.angle_degrees}°` : null,
          r.stretch_minutes ? `растяжка ${r.stretch_minutes} мин` : null,
          r.progression ? PROGRESSION_RU[r.progression] ?? r.progression : null,
          r.duration_min ? `${r.duration_min} мин` : null,
        ].filter(Boolean).join(' · ');
        return el('div', { class: 'card flat tight col gap-1' },
          el('div', { class: 'row between' },
            el('span', { class: 'sm', style: { color: t?.color ?? 'var(--cyan)' } }, r.exercise),
            r.is_pr ? el('span', { class: 'pill ok' }, 'рекорд') : null),
          el('div', { class: 'tiny dim' }, metrics || '—'),
          el('div', { class: 'row gap-1 wrap' },
            ...(r.muscles ?? []).map(m => el('span', { class: 'pill' }, MUSCLES[m] ?? m))));
      }))
    : el('div', { class: 'empty' },
        el('div', { class: 'big' }, 'В этот день записей нет'),
        el('div', { class: 'tiny' }, 'Выберите другой день или добавьте запись'));

  modal({
    title: new Date(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }),
    body: el('div', { class: 'col gap-3' },
      muscles.length ? el('div', { style: { maxWidth: '200px', margin: '0 auto' } },
        Hologram('front', { active: muscles, hint: false })) : null,
      body),
    actions: [{ label: 'Закрыть', class: 'ghost' }],
  });
}

bus.on('track:open', openProtocol);
bus.on('holo:pick', ({ track }) => { if (track) openProtocol(track); });
bus.on('calendar:pick', ({ date, rows }) => openDayLog(date, rows));
