/* =========================================================================
   SUPABASE BRIDGE
   Lazily pulls the official ESM client from a CDN. If the project is not
   configured (or the CDN is unreachable) the app degrades into GHOST MODE:
   fully playable, backed by localStorage, with a persistent HUD warning.
   ========================================================================= */
import { SUPABASE_URL, SUPABASE_ANON, REQUIRE_BACKEND } from '../config.js';
import { bus } from './util.js';

const CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const isConfigured = () =>
  REQUIRE_BACKEND &&
  /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(SUPABASE_URL || '') &&
  (SUPABASE_ANON || '').length > 40;

let _client = null;
let _mode = 'unknown';           // 'live' | 'ghost'
let _initPromise = null;

export const mode = () => _mode;
export const isGhost = () => _mode === 'ghost';

export function initSupabase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    if (!isConfigured()) {
      _mode = 'ghost';
      bus.emit('backend:ghost', { reason: 'not_configured' });
      return null;
    }
    try {
      const { createClient } = await import(/* @vite-ignore */ CDN);
      _client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'ct365.auth',
        },
        global: { headers: { 'x-client-info': 'cyber-tracker-365' } },
      });
      _mode = 'live';
      bus.emit('backend:live');
      return _client;
    } catch (err) {
      console.warn('[supabase] bridge failed, falling back to GHOST MODE', err);
      _mode = 'ghost';
      bus.emit('backend:ghost', { reason: 'cdn_unreachable', err });
      return null;
    }
  })();
  return _initPromise;
}

export const sb = () => _client;

/** Wraps a supabase call so callers never have to null-check the client. */
export async function withDb(fn, fallback = null) {
  const c = await initSupabase();
  if (!c) return fallback;
  try { return await fn(c); }
  catch (err) { console.error('[db]', err); bus.emit('db:error', err); return fallback; }
}
