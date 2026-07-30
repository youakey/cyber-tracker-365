/* ============================================================================
 * CYBER-TRACKER 365 :: КОНФИГУРАЦИЯ
 * ----------------------------------------------------------------------------
 * SUPABASE_ANON — публичный ключ. Его безопасно коммитить: он опубликован
 * в любом клиенте по дизайну, а доступ к данным закрывает Row Level Security
 * (см. supabase/migrations/0002_rls.sql). Ключ service_role сюда класть НЕЛЬЗЯ.
 *
 * После создания проекта:
 *   1. Выполнить supabase/schema.sql в SQL Editor
 *   2. Authentication → Providers → Email → включить «Confirm email»
 *   3. Authentication → URL Configuration → Site URL = адрес GitHub Pages
 * ==========================================================================*/

export const SUPABASE_URL  = 'https://svqcioxecvmipgrswsik.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cWNpb3hlY3ZtaXBncnN3c2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTUwNjgsImV4cCI6MjEwMDk5MTA2OH0.rQRXKGudKimDwjUDKYXQ_tPRoa17ldzrg0ySxd_fRvg';

/* false — принудительный локальный режим без сети (данные в браузере). */
export const REQUIRE_BACKEND = true;

/* Недельная норма тренировок в зале. Невыполнение сажает батарею. */
export const WEEKLY_SESSION_QUOTA = 3;

export const FLAGS = {
  scanlines:         true,
  haptics:           true,
  bootSequence:      true,
  coachIntervalMs:   14000,
  particles:         true,   // мягкие частицы на рекордах
};

export const APP = {
  name:    'CYBER-TRACKER 365',
  version: '2.0.0',
  build:   'OPERATIONS-CONSOLE',
};
