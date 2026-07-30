/* ══════════════════════════════════════════════════════════════
   ОБОЛОЧКА ПРИЛОЖЕНИЯ
   Верхняя панель + навигация (сайдбар на десктопе, таббар на телефоне)
   + переключение разделов. Разделы общие для обеих раскладок:
   одна вёрстка, разная подача — дублировать нечего.
   ══════════════════════════════════════════════════════════════ */
import { el, $, bus, LS } from '../core/util.js';
import { S } from '../core/store.js';
import { isGhost } from '../core/supabase.js';
import { icon } from './components/icons.js';
import { onSwipe } from '../core/device.js';
import { buzz } from '../fx/haptics.js';
import { APP } from '../config.js';
import { openQuickLog } from './screens/exercise.js';
import { openProfile } from './screens/profile.js';

import { OverviewSection }  from './sections/overview.js';
import { BodySection }      from './sections/body.js';
import { SleepSection }     from './sections/sleep.js';
import { JournalSection }   from './sections/journal.js';
import { AnalyticsSection } from './sections/analytics.js';
import { ArsenalSection }   from './sections/arsenal.js';

export const SECTIONS = [
  { id: 'overview',  label: 'Обзор',     tab: 'Обзор',   ic: 'overview', build: OverviewSection },
  { id: 'body',      label: 'Тело',      tab: 'Тело',    ic: 'body',     build: BodySection },
  { id: 'sleep',     label: 'Сон',       tab: 'Сон',     ic: 'moon',     build: SleepSection },
  { id: 'journal',   label: 'Журнал',    tab: 'Журнал',  ic: 'journal',  build: JournalSection },
  { id: 'analytics', label: 'Аналитика', tab: 'Данные',  ic: 'chart',    build: AnalyticsSection },
  { id: 'arsenal',   label: 'Арсенал',   tab: 'Арсенал', ic: 'arsenal',  build: ArsenalSection },
];

let current = LS.get('ct365.section', 'overview');

/* ── тема ── */
export function initTheme() {
  const saved = LS.get('ct365.theme');
  const sys = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(saved ?? sys, false);
}
export function setTheme(mode, save = true) {
  document.documentElement.dataset.theme = mode;
  if (save) LS.set('ct365.theme', mode);
  bus.emit('theme:change', mode);
}
export const theme = () => document.documentElement.dataset.theme || 'dark';

/* ── сборка оболочки ── */
export function Shell() {
  const main = el('main', { id: 'view' });

  /* верхняя панель */
  const themeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Сменить тему',
    onclick: () => { setTheme(theme() === 'dark' ? 'light' : 'dark'); paintTheme(); buzz('tap'); } });
  const paintTheme = () => themeBtn.replaceChildren(icon(theme() === 'dark' ? 'sun' : 'moon'));
  paintTheme();

  const brand = el('div', { class: 'brand', title: 'нажмите 5 раз' },
    el('span', { class: 'brand-mark' }, icon('shield')),
    el('span', { class: 'col', style: { lineHeight: '1.15' } },
      el('span', {}, 'CT-365'),
      el('span', { class: 'sub' }, 'ПРОТОКОЛ')));

  const net = el('div', { class: 'netstat' + (isGhost() ? ' ghost' : '') },
    el('i', { class: 'dot' }),
    el('span', {}, isGhost() ? 'локальный режим' : 'связь установлена'));

  const topbar = el('header', { class: 'topbar' },
    brand, el('div', { class: 'spacer' }), net,
    el('button', { class: 'icon-btn', 'aria-label': 'Профиль', onclick: openProfile }, icon('user')),
    themeBtn);

  /* сайдбар */
  const snav = el('nav', { class: 'snav' },
    ...SECTIONS.map(s => el('button', {
      dataset: { sec: s.id },
      onclick: () => go(s.id),
    }, icon(s.ic), el('span', {}, s.label))));

  const sidebar = el('aside', { class: 'sidebar' },
    snav,
    el('div', { class: 'sidebar-foot' },
      el('div', {}, APP.build.toLowerCase()),
      el('div', {}, 'норма ' + (S.profile?.weekly_quota ?? 3) + '/нед'),
      el('div', {}, 'подъём ' + (S.profile?.target_wake ?? '05:00').slice(0, 5)),
      el('div', { class: 'dim' }, 'v' + APP.version)));

  /* таббар */
  const tabbar = el('nav', { class: 'tabbar' },
    ...SECTIONS.map(s => el('button', {
      class: 'tab', dataset: { sec: s.id }, 'aria-label': s.label,
      onclick: () => go(s.id),
    }, icon(s.ic), el('span', {}, s.tab))));

  const fab = el('button', { class: 'fab', 'aria-label': 'Записать тренировку',
    onclick: () => { buzz('tap'); openQuickLog(); } }, icon('plus'));

  const root = el('div', {},
    topbar,
    el('div', { class: 'layout' }, sidebar, main),
    tabbar, fab);

  /* свайп между разделами на телефоне */
  onSwipe(main, {
    left:  () => go(SECTIONS[(idx() + 1) % SECTIONS.length].id),
    right: () => go(SECTIONS[(idx() - 1 + SECTIONS.length) % SECTIONS.length].id),
  });

  function idx() { return Math.max(0, SECTIONS.findIndex(s => s.id === current)); }

  function paintNav() {
    for (const b of root.querySelectorAll('[data-sec]'))
      b.classList.toggle('on', b.dataset.sec === current);
  }

  function paint() {
    const sec = SECTIONS.find(s => s.id === current) ?? SECTIONS[0];
    main.replaceChildren(sec.build());
    paintNav();
  }

  function go(id, scroll = true) {
    if (id === current) return;
    current = id; LS.set('ct365.section', id); buzz('select');
    paint();
    if (scroll) scrollTo({ top: 0, behavior: 'smooth' });
  }

  paint();
  bus.on('store', paint);
  bus.on('nav:go', go);
  bus.on('theme:change', paintTheme);

  return { root, brand, go };
}

export const goTo = id => bus.emit('nav:go', id);
