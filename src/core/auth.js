/* =========================================================================
   AUTH :: signup / login / email verification / session guard
   ========================================================================= */
import { initSupabase, sb, isGhost } from './supabase.js';
import { bus, LS } from './util.js';

const GHOST_KEY = 'ct365.ghost.session';

export const state = { user: null, session: null, ready: false };

export async function boot() {
  await initSupabase();
  if (isGhost()) {
    const g = LS.get(GHOST_KEY);
    if (g) { state.user = g; state.session = { ghost: true }; }
    state.ready = true;
    bus.emit('auth:change', state);
    return state;
  }
  const c = sb();
  const { data } = await c.auth.getSession();
  state.session = data.session ?? null;
  state.user    = data.session?.user ?? null;
  state.ready   = true;
  c.auth.onAuthStateChange((_evt, session) => {
    state.session = session ?? null;
    state.user    = session?.user ?? null;
    bus.emit('auth:change', state);
  });
  bus.emit('auth:change', state);
  return state;
}

const redirectTo = () => location.origin + location.pathname;

/** Register. Supabase sends the verification mail; the user MUST confirm. */
export async function signUp(email, password, handle) {
  if (isGhost()) return ghostLogin(email, handle);
  const { data, error } = await sb().auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectTo(), data: { handle: handle || null } },
  });
  if (error) throw humanise(error);
  // identities === [] means the address already exists (Supabase anti-enumeration)
  const exists = data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
  return {
    needsVerification: !data.session,
    alreadyRegistered: !!exists,
    email,
  };
}

export async function signIn(email, password) {
  if (isGhost()) return ghostLogin(email);
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw humanise(error);
  if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
    await sb().auth.signOut();
    const e = new Error('SEGMENT LOCKED :: IDENTITY NOT CONFIRMED');
    e.code = 'email_not_confirmed';
    throw e;
  }
  return data;
}

export async function resendVerification(email) {
  if (isGhost()) return true;
  const { error } = await sb().auth.resend({
    type: 'signup', email, options: { emailRedirectTo: redirectTo() },
  });
  if (error) throw humanise(error);
  return true;
}

export async function requestPasswordReset(email) {
  if (isGhost()) return true;
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw humanise(error);
  return true;
}

export async function signOut() {
  if (isGhost()) { LS.del(GHOST_KEY); state.user = null; state.session = null; bus.emit('auth:change', state); return; }
  await sb().auth.signOut();
  state.user = null; state.session = null;
  bus.emit('auth:change', state);
}

/* --- ghost (offline) identity ------------------------------------------- */
function ghostLogin(email, handle) {
  const u = {
    id: 'ghost-' + fingerprint(email || 'operator'),
    email: email || 'operator@localhost',
    user_metadata: { handle: handle || (email || 'OPERATOR').split('@')[0].toUpperCase() },
    ghost: true,
  };
  LS.set(GHOST_KEY, u);
  state.user = u; state.session = { ghost: true };
  bus.emit('auth:change', state);
  return { needsVerification: false, ghost: true };
}

/** Stable, Unicode-safe id derived from the address (no btoa — it throws on non-Latin1). */
function fingerprint(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/* --- error translation into in-world language --------------------------- */
function humanise(error) {
  const m = (error.message || '').toLowerCase();
  const e = new Error(error.message);
  e.code = error.code || error.status;
  if (m.includes('invalid login'))         e.message = 'ACCESS DENIED :: CREDENTIAL MISMATCH';
  else if (m.includes('email not confirmed')) { e.message = 'SEGMENT LOCKED :: IDENTITY NOT CONFIRMED'; e.code = 'email_not_confirmed'; }
  else if (m.includes('already registered')) e.message = 'IDENTITY ALREADY IN REGISTRY';
  else if (m.includes('password'))         e.message = 'CIPHER TOO WEAK :: MIN 6 CHARACTERS';
  else if (m.includes('rate'))             e.message = 'FIREWALL THROTTLE :: RETRY IN 60s';
  else if (m.includes('fetch'))            e.message = 'MAINFRAME UNREACHABLE :: CHECK UPLINK';
  return e;
}
