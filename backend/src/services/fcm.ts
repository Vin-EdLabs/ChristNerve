/**
 * FCM push via Firebase Admin SDK (service account).
 * Falls back to legacy FIREBASE_SERVER_KEY if Admin is not configured.
 */

import fs from 'fs';
import path from 'path';
import {
  App,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface FcmPayload {
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, string>;
}

let initAttempted = false;
let adminReady = false;
let app: App | null = null;

function resolveServiceAccountPath(): string | null {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (configured) {
    const abs = path.isAbsolute(configured)
      ? path.resolve(configured)
      : path.resolve(process.cwd(), configured);
    if (fs.existsSync(abs)) return abs;
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_PATH not found:', abs);
  }

  const fallback = path.resolve(
    process.cwd(),
    'secrets',
    'firebase-adminsdk.json'
  );
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

export function isFcmConfigured(): boolean {
  ensureAdmin();
  return (
    adminReady ||
    Boolean(process.env.FIREBASE_SERVER_KEY?.trim()) ||
    Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim())
  );
}

function ensureAdmin(): boolean {
  if (initAttempted) return adminReady;
  initAttempted = true;

  try {
    const existing = getApps();
    if (existing.length > 0) {
      app = existing[0]!;
      adminReady = true;
      return true;
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() || 'christnerve';

    if (clientEmail && privateKey) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
      adminReady = true;
      console.log('[fcm] Firebase Admin ready via env credentials');
      return true;
    }

    const saPath = resolveServiceAccountPath();
    if (saPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8')) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      app = initializeApp({
        credential: cert(serviceAccount as ServiceAccount),
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          serviceAccount.project_id ||
          'christnerve',
      });
      adminReady = true;
      console.log('[fcm] Firebase Admin ready via service account file');
      return true;
    }
  } catch (err) {
    console.error('[fcm] Firebase Admin init failed:', err);
    adminReady = false;
  }

  return adminReady;
}

async function sendViaAdmin(
  token: string,
  payload: FcmPayload
): Promise<{ ok: boolean; error?: string; invalid?: boolean }> {
  try {
    if (!app) ensureAdmin();
    await getMessaging(app || undefined).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        title: payload.title,
        body: payload.body,
        link: payload.link || '',
        ...(payload.data || {}),
      },
      webpush: {
        fcmOptions: {
          link: payload.link || '/',
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/logo.png',
        },
      },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FCM admin send error';
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code || '')
        : '';
    const invalid =
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      /not.?registered|invalid.?token/i.test(message);
    console.error('[fcm] admin send failed:', message);
    return { ok: false, error: message, invalid };
  }
}

async function sendViaLegacyServerKey(
  token: string,
  payload: FcmPayload
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const serverKey = process.env.FIREBASE_SERVER_KEY?.trim();
  if (!serverKey) {
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          link: payload.link || '',
          ...(payload.data || {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[fcm] legacy send failed:', res.status, text);
      return { ok: false, error: text };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FCM send error';
    console.error('[fcm]', message);
    return { ok: false, error: message };
  }
}

export async function sendFcmToToken(
  token: string,
  payload: FcmPayload
): Promise<{ ok: boolean; skipped?: boolean; error?: string; invalid?: boolean }> {
  if (!token?.trim()) {
    return { ok: false, error: 'empty token' };
  }

  if (ensureAdmin()) {
    return sendViaAdmin(token, payload);
  }

  if (process.env.FIREBASE_SERVER_KEY?.trim()) {
    return sendViaLegacyServerKey(token, payload);
  }

  console.log(
    '[fcm] No Firebase Admin credentials — skipping push:',
    payload.title
  );
  return { ok: true, skipped: true };
}

export async function sendFcmToTokens(
  tokens: string[],
  payload: FcmPayload
): Promise<void> {
  const unique = [...new Set(tokens.filter(Boolean))];
  const results = await Promise.all(
    unique.map(async (t) => ({ token: t, result: await sendFcmToToken(t, payload) }))
  );

  const invalid = results
    .filter((r) => (r.result as { invalid?: boolean }).invalid)
    .map((r) => r.token);

  if (invalid.length === 0) return;

  try {
    const { pool } = await import('../db');
    await pool.query(`DELETE FROM device_tokens WHERE token = ANY($1::text[])`, [
      invalid,
    ]);
    console.log('[fcm] pruned invalid device tokens:', invalid.length);
  } catch (err) {
    console.warn('[fcm] failed to prune invalid tokens:', err);
  }
}
