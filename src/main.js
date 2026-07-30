/* ══════════════════════════════════════════════════════════════
   CYBER-TRACKER 365 :: точка сборки
   ══════════════════════════════════════════════════════════════ */
import { $, el, bus, sleep, hex, LS } from './core/util.js';
import { APP, FLAGS } from './config.js';
import * as auth from './core/auth.js';
import { isGhost, mode } from './core/supabase.js';
import { S, hydrate } from './core/store.js';
import { watchLayout } from './core/device.js';
import { initFX } from './fx/canvas-fx.js';
import { mountGate, hideGate, showGate } from './ui/screens/auth-gate.js';
import { Shell, initTheme } from './ui/shell.js';
import { startCoach, pushLog } from './ui/components/ticker.js';
import { bindLogoTaps, bindGlobalCheats } from './ui/devconsole.js';
import { toast, warn, ok } from './ui/components/toast.js';
import './ui/screens/exercise.js';   // подписки на шину

const app = () => $('#app');
let shell = null;

/* ───────────────────────── фоновый hex-дождь ───────────────────────── */
function seedRain() {
  const host = $('#envRain');
  if (!host || matchMedia('(max-width:700px)').matches) return;
  const cols = Math.min(14, Math.floor(innerWidth / 150));
  for (let i = 0; i < cols; i++) {
    const strip = el('i', { style: {
      left: ((i + .5) / cols * 100).toFixed(1) + '%',
      animationDuration: (14 + Math.random() * 20).toFixed(1) + 's',
      animationDelay: (-Math.random() * 24).toFixed(1) + 's',
    } });
    strip.textContent = Array.from({ length: 34 }, () => hex(2)).join('\n');
    host.append(strip);
  }
}

/* ───────────────────────── загрузочный экран ───────────────────────── */
const BOOT = [
  'CYBER-TRACKER 365',
  '',
  'Проверка окружения ......... ок',
  'Схема анатомии ............. 20 зон',
  'Реестр протоколов .......... 6 целей',
  'Трекер сна ................. цель 05:00',
  'Слой эффектов .............. готов',
  'Связь с сервером ........... ',
];

async function bootSequence() {
  if (!FLAGS.bootSequence || LS.get('ct365.booted')) return;
  const box = el('div', { id: 'boot' });
  document.body.append(box);
  for (const line of BOOT) {
    box.append(el('div', {}, line));
    await sleep(line ? 58 : 20);
  }
  const last = box.lastChild;
  for (let i = 0; i < 6; i++) { last.textContent = 'Связь с сервером ........... ' + hex(6); await sleep(50); }
  last.textContent = 'Связь с сервером ........... ' + (isGhost() ? 'локальный режим' : 'установлена');
  await sleep(360);
  box.style.transition = 'opacity .35s'; box.style.opacity = '0';
  setTimeout(() => box.remove(), 360);
  LS.set('ct365.booted', 1);
}

/* ───────────────────────────── маршрут ───────────────────────────── */
async function route() {
  if (!auth.state.user) {
    app().classList.remove('on');
    showGate();
    return;
  }
  await hydrate();
  bus.clear('store');            // снять подписчиков предыдущего дерева
  shell = Shell();
  app().replaceChildren(shell.root);
  app().classList.add('on');
  bindLogoTaps(shell.brand);
  hideGate();
  startCoach();
  greet();
}

function greet() {
  if (!S.profile) return;
  if (S.depleted) {
    warn('Батарея разряжена', `Норма недели не выполнена: ${S.weekSessions} из ${S.quota}.`);
  } else if (S.weekSessions >= S.quota) {
    ok('Норма выполнена', `${S.weekSessions} из ${S.quota} за эту неделю.`);
  }
  const sl = S.sleepStats;
  if (sl && !sl.today && new Date().getHours() < 12) {
    toast('Ночь не записана', 'Отметьте время подъёма — серия считается по дням.', 'info', 7000);
  }
  if (!S.logs.length) {
    toast('Журнал пуст', 'Добавьте первую тренировку, чтобы графики ожили.', 'info', 8000);
    pushLog('Истории тренировок нет. Нужна отправная точка.', 'warn');
  }
}

/* ────────────────────────────── старт ────────────────────────────── */
(async function start() {
  document.title = APP.name;
  initTheme();
  initFX();
  watchLayout();
  bindGlobalCheats();
  seedRain();
  mountGate();

  bus.on('auth:granted', () => setTimeout(route, 600));
  bus.on('auth:change', () => { if (!auth.state.user) { app().classList.remove('on'); showGate(); } });
  bus.on('backend:ghost', () => setTimeout(() => warn('Работаю локально',
    'Сервер не настроен или недоступен — данные сохраняются только в этом браузере.'), 1200));

  await Promise.all([bootSequence(), auth.boot()]);
  await route();

  if (location.hash.includes('type=recovery')) {
    toast('Смена пароля', 'Задайте новый пароль в профиле.', 'warn', 9000);
  }

  console.log(`%c${APP.name} %cv${APP.version} %c[${mode()}]`,
    'color:#22e3d4;font-weight:700', 'color:#2ee6a8', 'color:#ffb020');
  console.log('%cПодсказка: 5 нажатий на логотип (или клавиша `) открывают консоль.', 'color:#8ba4c0');
})();
