/* ══════════════════════════════════════════════════════════════
   ЭКРАН ВХОДА
   Вход · регистрация · подтверждение почты · восстановление.
   При отправке под полем идёт тонкая полоса дешифровки с бегущим
   hex — это только индикатор ожидания, реальный запрос он не держит.
   ══════════════════════════════════════════════════════════════ */
import { el, $, hex, sleep, bus } from '../../core/util.js';
import * as auth from '../../core/auth.js';
import { isGhost } from '../../core/supabase.js';
import { icon } from '../components/icons.js';
import { ok, err, warn } from '../components/toast.js';
import { spark } from '../../fx/canvas-fx.js';
import { buzz } from '../../fx/haptics.js';

let mode = 'login';          // login | signup | verify | reset
let pendingEmail = '';

const GOALS = ['Шпагат', 'Горизонт', 'Стойка', 'Жим', 'Присед', 'Сумо', 'Подъём 05:00'];

export function mountGate() {
  const gate = $('#gate');
  const logo = $('#gateLogo');
  if (logo && !logo.firstChild) logo.append(icon('shield'));
  render();
  return gate;
}

export function hideGate() {
  const gate = $('#gate');
  if (!gate) return;
  gate.style.transition = 'opacity .4s';
  gate.style.opacity = '0';
  setTimeout(() => { gate.style.display = 'none'; }, 400);
}

export function showGate() {
  const gate = $('#gate');
  if (!gate) return;
  gate.style.display = 'grid';
  gate.style.opacity = '1';
  render();
}

/* ─────────────────────────── отрисовка ─────────────────────────── */
function render() {
  const body = $('#gateBody');
  if (!body) return;
  body.replaceChildren(mode === 'verify' ? verifyView() : formView());

  let goals = $('#gateGoals');
  if (!goals) {
    goals = el('div', { class: 'gate-goals', id: 'gateGoals' },
      ...GOALS.map(g => el('span', { class: 'pill' }, g)));
    $('.gate-card')?.append(goals);
  }
}

function formView() {
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';

  const email = el('input', { type: 'email', autocomplete: 'email',
    placeholder: 'you@example.com', value: pendingEmail, required: true });
  const pass = el('input', { type: 'password', minlength: 6,
    autocomplete: isSignup ? 'new-password' : 'current-password', placeholder: '••••••••' });
  const handle = el('input', { type: 'text', maxlength: 24, placeholder: 'Позывной', autocomplete: 'nickname' });

  const submit = el('button', { class: 'btn primary wide', type: 'submit' },
    el('span', { class: 'label' }, isSignup ? 'Создать профиль' : isReset ? 'Отправить ссылку' : 'Войти'));

  const form = el('form', { class: 'col gap-3', onsubmit: e => { e.preventDefault(); run(); } },
    el('p', { class: 'gate-note' },
      isSignup ? 'Новый профиль. На почту придёт письмо — без подтверждения вход закрыт.'
      : isReset ? 'Пришлём ссылку для смены пароля.'
      : 'Введите почту и пароль.'),
    el('div', { class: 'field' }, el('label', {}, 'Почта'), email),
    isReset ? null : el('div', { class: 'field' }, el('label', {}, 'Пароль'), pass),
    isSignup ? el('div', { class: 'field' }, el('label', {}, 'Позывной'), handle) : null,
    submit,
    isGhost() ? el('div', { class: 'gate-msg warn' },
      'Сервер не настроен — приложение работает локально, данные останутся в этом браузере.') : null,
    el('div', { class: 'gate-links' },
      el('button', { type: 'button', class: 'linkbtn',
        onclick: () => { mode = isSignup ? 'login' : 'signup'; buzz('tap'); render(); } },
        isSignup ? 'У меня уже есть профиль' : 'Создать профиль'),
      el('button', { type: 'button', class: 'linkbtn',
        onclick: () => { mode = isReset ? 'login' : 'reset'; buzz('tap'); render(); } },
        isReset ? 'Назад' : 'Забыли пароль?')));

  async function run() {
    const e = email.value.trim(), p = pass.value;
    email.classList.remove('err'); pass.classList.remove('err');

    if (!/^\S+@\S+\.\S+$/.test(e)) {
      email.classList.add('err'); shakeGate();
      err('Проверьте почту', 'Адрес выглядит некорректно.'); buzz('error'); return;
    }
    if (!isReset && p.length < 6) {
      pass.classList.add('err'); shakeGate();
      err('Короткий пароль', 'Минимум 6 символов.'); buzz('error'); return;
    }

    const stop = decrypt([email, isReset ? null : pass], submit);
    const t0 = Date.now();
    try {
      if (isReset) {
        await auth.requestPasswordReset(e);
        await settle(t0, stop);
        ok('Письмо отправлено', 'Проверьте почту и перейдите по ссылке.');
        mode = 'login'; pendingEmail = e; render(); return;
      }
      if (isSignup) {
        const r = await auth.signUp(e, p, handle.value.trim());
        await settle(t0, stop);
        if (r.ghost) { granted(submit); return; }
        pendingEmail = e;
        if (r.alreadyRegistered) {
          warn('Такая почта уже есть', 'Войдите со своим паролем.');
          mode = 'login'; render(); return;
        }
        mode = 'verify'; render(); return;
      }
      await auth.signIn(e, p);
      await settle(t0, stop);
      granted(submit);
    } catch (ex) {
      await settle(t0, stop);
      buzz('error'); shakeGate();
      if (ex.code === 'email_not_confirmed') { pendingEmail = e; mode = 'verify'; render(); return; }
      email.classList.add('err'); if (!isReset) pass.classList.add('err');
      err('Не получилось войти', ex.message || 'Неизвестная ошибка.');
    }
  }

  return form;
}

function verifyView() {
  return el('div', { class: 'col gap-3' },
    el('div', { class: 'gate-msg err row gap-3', style: { alignItems: 'flex-start' } },
      el('span', { class: 'c-red', style: { flex: 'none', marginTop: '1px' } }, icon('warn')),
      el('span', { class: 'col gap-1' },
        el('b', {}, 'Почта не подтверждена'),
        el('span', {},
          'Адрес ', el('b', {}, pendingEmail), ' зарегистрирован, но письмо ещё не открыто. ',
          'Перейдите по ссылке из письма — после этого вход откроется.'))),
    el('p', { class: 'gate-note' }, 'Письма нет? Проверьте папку «Спам».'),
    el('button', { class: 'btn wide', onclick: async ev => {
      const stop = decrypt([], ev.currentTarget);
      try {
        await auth.resendVerification(pendingEmail);
        await sleep(800); stop();
        ok('Письмо отправлено повторно');
      } catch (e) { stop(); err('Не отправилось', e.message); }
    } }, icon('mail'), el('span', { class: 'label' }, 'Отправить письмо ещё раз')),
    el('button', { class: 'btn ghost wide', onclick: () => { mode = 'login'; buzz('tap'); render(); } },
      'Вернуться ко входу'));
}

/* ─────────────────────────── дешифровка ─────────────────────────── */
/**
 * Тонкая полоса с бегущим hex под каждым полем + блокировка кнопки.
 * Возвращает stop(). Чисто индикатор: результат запроса не ждёт её.
 */
export function decrypt(targets, button) {
  const overlays = [];
  button?.classList.add('busy');

  for (const t of targets) {
    if (!t) continue;
    const host = t.parentElement?.classList.contains('field') ? t.parentElement : t;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const ov = el('div', { class: 'decrypt' });
    host.append(ov);
    overlays.push({ ov, w: t.clientWidth || 260 });
  }
  if (button) {
    if (getComputedStyle(button).position === 'static') button.style.position = 'relative';
    const ov = el('div', { class: 'decrypt', style: { top: '0', height: '100%', justifyContent: 'center' } });
    button.append(ov);
    overlays.push({ ov, w: button.clientWidth || 200 });
  }

  const id = setInterval(() => {
    for (const { ov, w } of overlays) {
      const n = Math.max(4, Math.min(22, Math.floor(w / 22)));
      ov.textContent = Array.from({ length: n }, () => hex(2)).join(' ');
    }
  }, 55);

  return function stop() {
    clearInterval(id);
    overlays.forEach(({ ov }) => ov.remove());
    button?.classList.remove('busy');
  };
}

/** Держим индикатор на экране не меньше min мс — иначе он мигает. */
async function settle(t0, stop, min = 850) {
  const dt = Date.now() - t0;
  if (dt < min) await sleep(min - dt);
  stop();
}

function shakeGate() {
  const g = $('#gate'); if (!g) return;
  g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
  setTimeout(() => g.classList.remove('shake'), 500);
}

function granted(anchor) {
  const r = anchor?.getBoundingClientRect?.();
  spark(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top : innerHeight / 2, '--green');
  buzz('confirm');
  ok('Готово', 'Загружаю профиль…');
  bus.emit('auth:granted');
}
