import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging';
import { ensureAppServiceWorker, isIosDevice, isPwaStandalone } from '../utils/pwa';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

let vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim();
let vapidResolved = Boolean(vapidKey);
let vapidPromise: Promise<string | null> | null = null;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let analyticsReady = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId &&
      firebaseConfig.messagingSenderId
  );
}

export function isFcmConfigured(): boolean {
  return isFirebaseConfigured() && Boolean(vapidKey);
}

async function resolveVapidKey(): Promise<string | null> {
  if (vapidKey) return vapidKey;
  if (vapidResolved && !vapidKey) return null;
  if (vapidPromise) return vapidPromise;

  vapidPromise = (async () => {
    try {
      const res = await fetch('/api/public/fcm-config', { credentials: 'same-origin' });
      if (!res.ok) {
        vapidResolved = true;
        return null;
      }
      const data = (await res.json()) as { vapidKey?: string | null };
      const key = String(data?.vapidKey || '').trim();
      vapidKey = key || undefined;
      vapidResolved = true;
      return vapidKey || null;
    } catch {
      vapidResolved = true;
      return null;
    } finally {
      vapidPromise = null;
    }
  })();

  return vapidPromise;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/** Initialize Analytics when supported (browser only). */
export async function initFirebaseAnalytics(): Promise<void> {
  if (analyticsReady || !isFirebaseConfigured()) return;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return;
  try {
    if (await isAnalyticsSupported()) {
      getAnalytics(firebaseApp);
      analyticsReady = true;
    }
  } catch (err) {
    console.warn('[firebase] analytics unavailable:', err);
  }
}

async function getMessagingInstance(): Promise<Messaging | null> {
  const key = await resolveVapidKey();
  if (!isFirebaseConfigured() || !key) return null;
  const supported = await isMessagingSupported();
  if (!supported) return null;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!messaging) {
    messaging = getMessaging(firebaseApp);
  }
  return messaging;
}

/** Request browser notification permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (err) {
    console.warn('[firebase] permission request failed:', err);
    return false;
  }
}

/**
 * Ask for permission, then register FCM token.
 * On iPhone, Web Push only works after Add to Home Screen (standalone).
 */
export async function enablePushNotifications(): Promise<{
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  error?: string;
  needsInstall?: boolean;
}> {
  if (typeof Notification === 'undefined') {
    return {
      permission: 'unsupported',
      token: null,
      error: 'Notifications not supported in this browser',
    };
  }

  if (isIosDevice() && !isPwaStandalone()) {
    return {
      permission: Notification.permission,
      token: null,
      needsInstall: true,
      error:
        'On iPhone, add ChristNerve to your Home Screen first (Share → Add to Home Screen), then open the app and enable notifications.',
    };
  }

  const granted = await requestNotificationPermission();
  const permission = Notification.permission;

  if (!granted) {
    return {
      permission,
      token: null,
      error:
        permission === 'denied'
          ? 'Notifications are blocked. Enable them in your browser or phone settings.'
          : 'Notification permission was not granted',
    };
  }

  if (!isFirebaseConfigured()) {
    return { permission, token: null, error: 'Firebase is not configured' };
  }

  const key = await resolveVapidKey();
  if (!key) {
    return {
      permission,
      token: null,
      error:
        'Push key missing. Add VITE_FIREBASE_VAPID_KEY (Firebase → Cloud Messaging → Web Push certificates).',
    };
  }

  const msg = await getMessagingInstance();
  if (!msg) {
    return { permission, token: null, error: 'Push messaging is not supported here' };
  }

  try {
    const registration = await ensureAppServiceWorker();
    if (!registration) {
      return { permission, token: null, error: 'Service worker failed to register' };
    }
    const token = await getToken(msg, {
      vapidKey: key,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      return { permission, token: null, error: 'Could not create a push token' };
    }
    return { permission, token };
  } catch (err) {
    console.warn('[firebase] enablePushNotifications failed:', err);
    return {
      permission,
      token: null,
      error: err instanceof Error ? err.message : 'Failed to enable push',
    };
  }
}

/** Get an FCM registration token (requires VAPID key + permission + SW). */
export async function getFcmToken(): Promise<string | null> {
  const result = await enablePushNotifications();
  return result.token;
}

/** Foreground message handler — returns unsubscribe. */
export async function onForegroundMessage(
  handler: (payload: { title?: string; body?: string; link?: string }) => void
): Promise<() => void> {
  const msg = await getMessagingInstance();
  if (!msg) return () => undefined;

  return onMessage(msg, (payload) => {
    handler({
      title: payload.notification?.title || payload.data?.title,
      body: payload.notification?.body || payload.data?.body,
      link: payload.data?.link,
    });
  });
}
