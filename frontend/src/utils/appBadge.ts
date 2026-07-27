/**
 * Home-screen / dock badge (Badging API).
 * Works on installed PWAs: Android Chrome, desktop Chromium, Safari iOS (A2HS).
 */

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export async function setAppBadgeCount(count: number): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as NavigatorWithBadge;
  const n = Math.max(0, Math.floor(Number(count) || 0));

  try {
    if (n <= 0) {
      if (typeof nav.clearAppBadge === 'function') {
        await nav.clearAppBadge();
      } else if (typeof nav.setAppBadge === 'function') {
        await nav.setAppBadge(0);
      }
      return;
    }
    if (typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(n);
    }
  } catch (err) {
    // Unsupported / denied — ignore
    console.debug('[badge] setAppBadge unavailable:', err);
  }
}

/** Persist last known total so SW / other tabs can stay roughly in sync. */
const BADGE_STORAGE_KEY = 'christnerve_app_badge';

export function rememberBadgeCount(count: number): void {
  try {
    localStorage.setItem(BADGE_STORAGE_KEY, String(Math.max(0, count)));
  } catch {
    // ignore
  }
}

export function readRememberedBadgeCount(): number {
  try {
    return Math.max(0, parseInt(localStorage.getItem(BADGE_STORAGE_KEY) || '0', 10) || 0);
  } catch {
    return 0;
  }
}

export async function syncAppBadge(count: number): Promise<void> {
  rememberBadgeCount(count);
  await setAppBadgeCount(count);
}
