/* =========================================================================
   СКРЫТАЯ КОНСОЛЬ :: 5 нажатий на логотип (или клавиша `)
   Ретро-читы: idqd / give_shards / matrix и несколько утилит.
   ========================================================================= */
import { el, $, bus, stamp, hexAddr, hex, sleep } from '../core/util.js';
import { S, setProfile, grant, hydrate, recompute, emit } from '../core/store.js';
import { seedDemoData, wipeLocal } from '../core/db.js';
import { toggleMatrixRain, celebrate, burst, nudge } from '../fx/canvas-fx.js';
import { buzz } from '../fx/haptics.js';
import { toast, ok } from './components/toast.js';

let node = null;
let taps = 0, tapTimer = null;
const history = [];
let hIndex = -1;

/* ------------------------------------------------------------- surfacing */
export function bindLogoTaps(logoEl) {
  logoEl.addEventListener('click', () => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 1200);
    if (taps >= 3 && taps < 5) { logoEl.style.opacity = '.55'; buzz('tap'); }
    if (taps >= 5) {
      taps = 0; logoEl.style.opacity = '';
      toggleConsole(true);
    }
  });
}

export function toggleConsole(on) {
  if (on === undefined) on = !node;
  if (!on) { node?.remove(); node = null; return false; }
  if (node) { $('#devcon input')?.focus(); return true; }

  const out = el('div', { class: 'out' });
  const inp = el('input', {
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    'aria-label': 'developer console input',
  });
  node = el('div', { id: 'devcon' },
    el('div', { class: 'conh' },
      el('span', {}, `консоль · ${hexAddr()} · наберите help`),
      el('button', { class: 'linkbtn', onclick: () => toggleConsole(false) }, 'закрыть')),
    out,
    el('div', { class: 'in' }, el('span', {}, 'root@ct365:~$'), inp),
  );
  document.body.append(node);

  print('CYBER-TRACKER 365 — служебная консоль.');
  print('Наберите help, чтобы увидеть список команд.');
  print('');

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = inp.value.trim(); inp.value = '';
      if (!v) return;
      history.unshift(v); hIndex = -1;
      print(`root@ct365:~$ ${v}`);
      exec(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex < history.length - 1) inp.value = history[++hIndex] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex > 0) inp.value = history[--hIndex] ?? ''; else { hIndex = -1; inp.value = ''; }
    } else if (e.key === 'Escape') toggleConsole(false);
  });

  /* Присваивание должно стоять ДО return: раньше оно было после него,
     то есть в недостижимом коде, и весь вывод читов молча терялся. */
  node._print = print;

  setTimeout(() => inp.focus(), 80);
  buzz('confirm');
  return true;

  function print(txt, cls = '') {
    out.append(el('div', { class: cls }, txt));
    out.scrollTop = out.scrollHeight;
  }
}

const print = (t, c) => node?._print?.(t, c);

/* ---------------------------------------------------------- cheat engine */
const CHEATS = {
  async help() {
    print('ДОСТУПНЫЕ КОМАНДЫ');
    print('  idqd            режим бога (тройные награды)');
    print('  give_shards     начислить 9999 очков');
    print('  matrix          фон с падающим кодом');
    print('  iddqd / idkfa   старые псевдонимы');
    print('  exp <n>         начислить опыт');
    print('  seed            сгенерировать демо-данные за 10 недель');
    print('  stats           показать расчётные показатели');
    print('  crit            проиграть анимацию рекорда');
    print('  wipe            очистить локальный кэш');
    print('  clear           очистить консоль');
    print('  exit            закрыть консоль');
  },

  async idqd() {
    const on = !(S.profile?.god_mode);
    await setProfile({ god_mode: on });

    print(on ? '>> Режим бога включён.' : '>> Режим бога выключен.');
    bus.emit('cheat:used', { code: 'idqd', msg: on
      ? 'Тревога: повышение привилегий. Подсистема контроля обойдена.'
      : 'Привилегии сняты. Подсистема контроля восстановлена.' });
    nudge(); buzz('confirm');
    if (on) burst(innerWidth / 2, innerHeight / 2, { count: 60, speed: 8 });
    return true;
  },

  async give_shards() {
    await grant({ credits: 9999 });
    print('>> Начислено 9999 очков.');
    print('>> Контрольная сумма журнала: ' + hexAddr() + ' [подделана]');
    bus.emit('cheat:used', { code: 'give_shards',
      msg: 'SYSTEM HACKING ALERT :: unauthorised credit injection at ' + hexAddr() + '. Ledger integrity compromised. Auditor daemon suppressed.' });
    burst(innerWidth / 2, innerHeight * .6, { count: 50, speed: 7 });
    buzz('confirm');
    toast('Журнал изменён', 'Начислено 9999 очков.', 'warn');
    return true;
  },

  async matrix() {
    const on = toggleMatrixRain();
    print(on ? '>> Падающий код включён.' : '>> Падающий код выключен.');
    bus.emit('cheat:used', { code: 'matrix', msg: on
      ? 'Конвейер отрисовки перехвачен.'
      : 'Конвейер отрисовки восстановлен.' });
    buzz('confirm');
    return true;
  },

  async exp(n) {
    const v = Math.round(Number(n) || 1000);
    await grant({ exp: v });
    print(`>> Начислено ${v} опыта.`);
    return true;
  },

  async seed() {
    print('>> Генерирую демо-данные…');
    const n = await seedDemoData();
    await hydrate();
    print(`>> Добавлено ${n} записей.`);
    ok('Демо-данные готовы', `Добавлено ${n} записей.`);
    return true;
  },

  async stats() {
    print('PR         ' + JSON.stringify(S.pr));
    print('TARGETS    ' + JSON.stringify(S.targets));
    print('RADAR      ' + JSON.stringify(S.radar));
    print(`СЕРИЯ ${S.streak} нед · БАТАРЕЯ ${S.energy}% · МНОЖИТЕЛЬ x${S.expMultiplier}`);
    print('СОН   ' + JSON.stringify({ серия: S.sleepStats?.streak, средний: S.sleepStats?.avgWake, попаданий: S.sleepStats?.rate14 }));
    print(`ЗАПИСЕЙ ${S.logs.length} · НОЧЕЙ ${S.sleep.length} · СНАРЯЖЕНИЯ ${S.gear.length} · ДОСТИЖЕНИЙ ${S.achievements.length}`);
    return true;
  },

  async crit() {
    celebrate({ label: 'Проверка', sub: 'демонстрация анимации рекорда' });
    return true;
  },

  async wipe() {
    await wipeLocal();
    print('>> Локальный кэш очищен. Перезагрузка…');
    await sleep(600); location.reload();
    return true;
  },

  async clear() { $('#devcon .out')?.replaceChildren(); return true; },
  async exit() { toggleConsole(false); return true; },
};

/* legacy aliases */
CHEATS.iddqd = CHEATS.idqd;
CHEATS.idkfa = CHEATS.give_shards;
CHEATS.godmode = CHEATS.idqd;
CHEATS.credits = CHEATS.give_shards;

async function exec(line) {
  const [cmd, ...args] = line.split(/\s+/);
  const fn = CHEATS[cmd.toLowerCase()];
  if (!fn) {
    print(`${cmd}: команда не найдена`, '');
    print(`Наберите help для списка команд.`);
    buzz('error');
    return;
  }
  try { await fn(...args); } catch (e) { print('ERR :: ' + e.message); }
}

/** Also allow the Konami-style keyboard entry anywhere in the app. */
export function bindGlobalCheats() {
  let buf = '';
  addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === '`' || (e.ctrlKey && e.key === '`')) { toggleConsole(); return; }
    if (!/^[a-z_]$/i.test(e.key)) return;
    buf = (buf + e.key.toLowerCase()).slice(-14);
    for (const code of ['idqd', 'give_shards', 'matrix', 'iddqd', 'idkfa']) {
      if (buf.endsWith(code)) { buf = ''; CHEATS[code](); }
    }
  });
}
