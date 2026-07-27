/**
 * Register the push service worker without wiping it on every load.
 * Only removes the legacy firebase-messaging-sw.js that self-unregisters.
 */
export async function ensureAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => r.active?.scriptURL?.includes('firebase-messaging-sw.js'))
        .map((r) => r.unregister())
    );
  } catch {
    // ignore
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing?.active?.scriptURL?.includes('/sw.js')) {
      await navigator.serviceWorker.ready;
      return existing;
    }
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || ios;
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
