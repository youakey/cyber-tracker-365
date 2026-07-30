/* Web Vibration API wrapper — tactile pulses for critical events. */
import { FLAGS } from '../config.js';

const can = () => FLAGS.haptics && typeof navigator.vibrate === 'function';

export const PATTERNS = {
  tap:      [12],
  select:   [8, 26, 8],
  confirm:  [22, 40, 22],
  warn:     [50, 60, 50],
  error:    [90, 50, 90, 50, 140],
  critical: [30, 30, 30, 30, 60, 40, 200],
  boss:     [16, 24, 16, 24, 16, 24, 90],
  levelup:  [26, 50, 26, 50, 26, 50, 160],
};

export function buzz(kind = 'tap') {
  if (!can()) return false;
  try { return navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap); } catch { return false; }
}
export const stopBuzz = () => { if (can()) navigator.vibrate(0); };
