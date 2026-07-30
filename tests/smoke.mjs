/* CYBER-TRACKER 365 :: сквозной тест без браузера
 * Рендерит экран входа и все разделы против DOM-заглушки,
 * прогоняет расчёты сна, тренировок и читы.
 * Запуск:  npm install && npm test
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(ROOT + '/index.html', 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, { url: 'https://example.github.io/cyber-gym/', pretendToBeVisual: true });
const { window } = dom;

/* ── заглушки того, чего нет в jsdom ── */
window.matchMedia = q => ({
  matches: /min-width:\s*(880|1024)px/.test(q) ? !!global.__DESKTOP : false,
  media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){},
});
window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
window.HTMLCanvasElement.prototype.getContext = function () {
  const noop = () => {};
  return new Proxy({}, { get: (_, k) =>
    k === 'createLinearGradient' ? () => ({ addColorStop: noop }) :
    k === 'measureText' ? () => ({ width: 10 }) :
    typeof k === 'string' ? noop : undefined, set: () => true });
};
window.navigator.vibrate = () => true;
window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = clearTimeout;
window.scrollTo = () => {};

for (const k of ['window','document','navigator','localStorage','HTMLElement','Element','Node',
                 'matchMedia','ResizeObserver','requestAnimationFrame','cancelAnimationFrame',
                 'getComputedStyle','CustomEvent','Event','KeyboardEvent','location','devicePixelRatio',
                 'innerWidth','innerHeight','addEventListener','removeEventListener','scrollTo'])
  try { Object.defineProperty(globalThis, k, { value: window[k], writable: true, configurable: true }); } catch {}
global.self = window;

const errors = [];
window.addEventListener('error', e => errors.push('onerror: ' + e.message));
process.on('unhandledRejection', r => errors.push('rejection: ' + r));

const B = ROOT + '/src/';
const util   = await import(B + 'core/util.js');
const auth   = await import(B + 'core/auth.js');
const store  = await import(B + 'core/store.js');
const db     = await import(B + 'core/db.js');
const device = await import(B + 'core/device.js');
const gate   = await import(B + 'ui/screens/auth-gate.js');
const shellM = await import(B + 'ui/shell.js');
const devcon = await import(B + 'ui/devconsole.js');
const fx     = await import(B + 'fx/canvas-fx.js');
await import(B + 'ui/screens/exercise.js');

let pass = 0, fail = 0;
const say = (t, okv, extra = '') => {
  okv ? pass++ : fail++;
  console.log(`${okv ? 'PASS' : 'FAIL'}  ${t}${extra ? '  :: ' + extra : ''}`);
};

/* ─────────── 1. вход ─────────── */
await auth.boot();
say('auth.boot() → локальный режим', !auth.state.user && auth.state.ready);
shellM.initTheme();
device.watchLayout();
gate.mountGate();
const gateHtml = document.getElementById('gate').outerHTML;
say('экран входа отрисован', gateHtml.includes('Войти') && gateHtml.includes('Почта'), `${gateHtml.length} байт`);
say('цели показаны на входе', gateHtml.includes('Подъём 05:00') && gateHtml.includes('Шпагат'));

/* ─────────── 2. данные ─────────── */
await auth.signUp('operator@grid.net', 'hunter2', 'НЕО');
say('локальная регистрация', !!auth.state.user, auth.state.user?.user_metadata?.handle);
await store.hydrate();
say('состояние загружено', !store.S.loading && !!store.S.profile, `очки=${store.S.profile.nano_credits}`);

const n = await db.seedDemoData();
await store.hydrate();
say('демо-данные', n > 20 && store.S.sleep.length > 20,
    `${store.S.logs.length} тренировок, ${store.S.sleep.length} ночей`);
say('рекорды посчитаны', Object.values(store.S.pr).some(v => v > 0), JSON.stringify(store.S.pr));
say('радар в диапазоне 0–100', Object.values(store.S.radar).every(v => v >= 0 && v <= 100));

/* ─────────── 3. математика ─────────── */
say('1ПМ(100кг×5) в коридоре 112–116', (() => { const v = util.estimate1RM(100, 5); return v > 111 && v < 117; })(),
    util.estimate1RM(100, 5) + ' кг');
say('сон через полночь: 23:40→05:10 = 330 мин', db.sleepDuration('23:40', '05:10') === 330,
    db.sleepDuration('23:40', '05:10') + '');
say('сон без перехода: 22:00→06:00 = 480 мин', db.sleepDuration('22:00', '06:00') === 480);
say('hm/mmss обратимы', store.mmss(store.hm('05:07')) === '05:07');
say('dur читается по-русски', store.dur(452) === '7 ч 32 мин', store.dur(452));

const sl = store.S.sleepStats;
say('статистика сна собрана', !!sl && sl.logged > 0,
    `средний подъём ${store.mmss(sl.avgWake)}, серия ${sl.streak}, попаданий ${sl.rate14}%`);
say('цель по умолчанию 05:00', sl.targetMin === 300);
say('совет по отбою = цель − норма', sl.bedtimeAdvice === store.mmss(300 - 450),
    sl.bedtimeAdvice);
say('дрейф считается со знаком', sl.rows.every(r => typeof r.drift === 'number'));

/* поздний подъём не ломает среднее */
await store.logSleep({ slept_on: '2026-01-05', bedtime: '23:30', wake_time: '23:50' });
say('подъём 23:50 трактуется как «до цели», а не +1130',
    store.S.sleepStats.rows.find(r => r.slept_on === '2026-01-05').drift < 0,
    'дрейф = ' + store.S.sleepStats.rows.find(r => r.slept_on === '2026-01-05').drift);

/* ─────────── 4. запись ночи ─────────── */
const before = store.S.profile.experience;
const res = await store.logSleep({ slept_on: util.today(), bedtime: '21:30', wake_time: '05:05' });
say('подъём 05:05 попадает в допуск ±15', res.onTarget, `дрейф ${res.drift} мин`);
say('за ночь начислен опыт', store.S.profile.experience > before, `+${res.exp}`);
say('повторная запись за день не дублирует',
    store.S.sleep.filter(r => r.slept_on === util.today()).length === 1);

/* ─────────── 5. оболочка и разделы ─────────── */
global.__DESKTOP = true; device.watchLayout();
const shell = shellM.Shell();
document.getElementById('app').replaceChildren(shell.root);
const sh = shell.root.outerHTML;
say('оболочка собрана', sh.includes('topbar') && sh.includes('sidebar') && sh.includes('tabbar'),
    `${sh.length} байт`);
say('6 разделов в навигации', shell.root.querySelectorAll('.snav button').length === 6);
say('таббар тоже на 6 пунктов', shell.root.querySelectorAll('.tab').length === 6);

for (const sec of shellM.SECTIONS) {
  let okv = true, note = '';
  try {
    const node = sec.build();
    const h = node.outerHTML;
    okv = h.length > 400;
    note = h.length + ' байт';
  } catch (e) { okv = false; note = e.message; }
  say(`раздел «${sec.label}» строится`, okv, note);
}

/* содержимое ключевых разделов */
const overview = shellM.SECTIONS[0].build().outerHTML;
say('обзор показывает норму и сон', overview.includes('Норма недели') && overview.includes('Режим сна'));
const sleepSec = shellM.SECTIONS[2].build().outerHTML;
say('раздел сна показывает серию и график', sleepSec.includes('Серия') && sleepSec.includes('Время подъёма'));
const journal = shellM.SECTIONS[3].build().outerHTML;
say('журнал: календарь + записи', journal.includes('Календарь') && journal.includes('Последние записи'));
say('дни с тренировками подсвечены', /class="[^"]*lv[123]/.test(journal));

/* ─────────── 5b. иконки не растянуты ─────────── */
{
  const icons = [...shell.root.querySelectorAll('svg')];
  const sized = icons.every(s => s.hasAttribute('width') || /\bwidth\s*:/.test(s.getAttribute('style') || ''));
  say('у всех иконок задан размер', sized && icons.length > 5,
      `${icons.filter(s => s.hasAttribute('width')).length} из ${icons.length}`);
}

/* ─────────── 6. тема ─────────── */
shellM.setTheme('light');
say('светлая тема применяется', document.documentElement.dataset.theme === 'light');
shellM.setTheme('dark');
say('тёмная тема возвращается', document.documentElement.dataset.theme === 'dark');

/* ─────────── 7. мобильная раскладка ─────────── */
global.__DESKTOP = false; device.watchLayout();
say('раскладка переключается на мобильную', device.layout === 'mobile');

/* ─────────── 8. читы ─────────── */
const credBefore = store.S.profile.nano_credits;
devcon.toggleConsole(true);
const shellEl = document.getElementById('devcon');
say('консоль открывается', !!shellEl && !!shellEl.querySelector('input'));
const inp = shellEl.querySelector('input');
const fire = cmd => { inp.value = cmd; inp.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
fire('give_shards'); await new Promise(r => setTimeout(r, 120));
say('give_shards начисляет 9999', store.S.profile.nano_credits >= credBefore + 9999,
    `${credBefore} → ${store.S.profile.nano_credits}`);
fire('idqd'); await new Promise(r => setTimeout(r, 120));
say('idqd включает режим бога', store.S.profile.god_mode === true);
fire('matrix'); await new Promise(r => setTimeout(r, 60));
say('matrix включает дождь', fx.matrixRainOn() === true);
fire('help'); await new Promise(r => setTimeout(r, 60));
say('help на русском', shellEl.querySelector('.out').textContent.includes('ДОСТУПНЫЕ КОМАНДЫ'));

/* ─────────── 9. тренировки и экономика ─────────── */
let prFired = false;
util.bus.on('pr:beaten', () => prFired = true);
const bestBench = store.S.pr.bench;
await store.logSession({ track: 'bench', weight_kg: bestBench + 40, reps: 3 });
say('рекорд поднимает событие pr:beaten', prFired, `жим ${bestBench} → ${store.S.pr.bench} кг`);
const buy = await store.purchase('neural_link');
say('покупка снаряжения', buy.ok, buy.ok ? `множитель ×${store.S.expMultiplier}` : buy.reason);
say('достижения выдаются', store.S.achievements.length > 0,
    store.S.achievements.map(a => a.title).slice(0, 3).join(', '));
say('есть достижения по сну', store.S.achievements.some(a => a.code.startsWith('sleep_')),
    store.S.achievements.filter(a => a.code.startsWith('sleep_')).map(a => a.title).join(', ') || '—');
say('челленджи открываются по прогрессу', store.availableBosses().some(b => b.unlocked));

console.log('');
console.log(errors.length ? 'ОШИБКИ ВЫПОЛНЕНИЯ:\n' + errors.join('\n') : 'ошибок выполнения нет');
console.log(`\nИтог: ${pass} пройдено, ${fail} провалено`);

/* Выходим явно, а не через process.exitCode.
   Приложение поднимает живые таймеры: часы в оболочке, интервал коуча,
   тикер консоли. В браузере их снимает закрытие вкладки, а в Node они
   держат цикл событий, и процесс не завершается никогда — на CI задание
   висело бы до таймаута раннера. stdout перед выходом дожимаем вручную,
   иначе при перенаправлении в файл последние строки теряются. */
const code = fail ? 1 : 0;
if (process.stdout.writableLength === 0) process.exit(code);
else process.stdout.write('', () => process.exit(code));
