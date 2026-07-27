"use strict";
/**
 * FCM push via Firebase Admin SDK (service account).
 * Falls back to legacy FIREBASE_SERVER_KEY if Admin is not configured.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFcmConfigured = isFcmConfigured;
exports.sendFcmToToken = sendFcmToToken;
exports.sendFcmToTokens = sendFcmToTokens;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
let initAttempted = false;
let adminReady = false;
let app = null;
function resolveServiceAccountPath() {
    const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    if (configured) {
        const abs = path_1.default.isAbsolute(configured)
            ? path_1.default.resolve(configured)
            : path_1.default.resolve(process.cwd(), configured);
        if (fs_1.default.existsSync(abs))
            return abs;
        console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_PATH not found:', abs);
    }
    const fallback = path_1.default.resolve(process.cwd(), 'secrets', 'firebase-adminsdk.json');
    if (fs_1.default.existsSync(fallback))
        return fallback;
    return null;
}
function isFcmConfigured() {
    ensureAdmin();
    return (adminReady ||
        Boolean(process.env.FIREBASE_SERVER_KEY?.trim()) ||
        Boolean(process.env.FIREBASE_PRIVATE_KEY?.trim()));
}
function ensureAdmin() {
    if (initAttempted)
        return adminReady;
    initAttempted = true;
    try {
        const existing = (0, app_1.getApps)();
        if (existing.length > 0) {
            app = existing[0];
            adminReady = true;
            return true;
        }
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || 'christnerve';
        if (clientEmail && privateKey) {
            app = (0, app_1.initializeApp)({
                credential: (0, app_1.cert)({
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
            const serviceAccount = JSON.parse(fs_1.default.readFileSync(saPath, 'utf8'));
            app = (0, app_1.initializeApp)({
                credential: (0, app_1.cert)(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID ||
                    serviceAccount.project_id ||
                    'christnerve',
            });
            adminReady = true;
            console.log('[fcm] Firebase Admin ready via service account file');
            return true;
        }
    }
    catch (err) {
        console.error('[fcm] Firebase Admin init failed:', err);
        adminReady = false;
    }
    return adminReady;
}
async function sendViaAdmin(token, payload) {
    try {
        if (!app)
            ensureAdmin();
        const badge = payload.badge != null && Number.isFinite(Number(payload.badge))
            ? Math.max(0, Math.floor(Number(payload.badge)))
            : undefined;
        const data = {
            title: payload.title,
            body: payload.body,
            link: payload.link || '',
            ...(badge != null ? { badge: String(badge) } : {}),
            ...(payload.data || {}),
        };
        await (0, messaging_1.getMessaging)(app || undefined).send({
            token,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data,
            webpush: {
                fcmOptions: {
                    link: payload.link || '/',
                },
                notification: {
                    title: payload.title,
                    body: payload.body,
                    icon: '/logo.png',
                    // Monochrome status-bar icon (Android); numeric badge goes via data + Badging API
                    badge: '/logo.png',
                    ...(badge != null ? { renotify: true, tag: 'christnerve' } : {}),
                },
                headers: {
                    Urgency: 'high',
                },
            },
        });
        return { ok: true };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'FCM admin send error';
        const code = err && typeof err === 'object' && 'code' in err
            ? String(err.code || '')
            : '';
        const invalid = code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            /not.?registered|invalid.?token/i.test(message);
        console.error('[fcm] admin send failed:', message);
        return { ok: false, error: message, invalid };
    }
}
async function sendViaLegacyServerKey(token, payload) {
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
                    ...(payload.badge != null
                        ? { badge: Math.max(0, Math.floor(Number(payload.badge))) }
                        : {}),
                },
                data: {
                    link: payload.link || '',
                    ...(payload.badge != null ? { badge: String(payload.badge) } : {}),
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'FCM send error';
        console.error('[fcm]', message);
        return { ok: false, error: message };
    }
}
async function sendFcmToToken(token, payload) {
    if (!token?.trim()) {
        return { ok: false, error: 'empty token' };
    }
    if (ensureAdmin()) {
        return sendViaAdmin(token, payload);
    }
    if (process.env.FIREBASE_SERVER_KEY?.trim()) {
        return sendViaLegacyServerKey(token, payload);
    }
    console.log('[fcm] No Firebase Admin credentials — skipping push:', payload.title);
    return { ok: true, skipped: true };
}
async function sendFcmToTokens(tokens, payload) {
    const unique = [...new Set(tokens.filter(Boolean))];
    const results = await Promise.all(unique.map(async (t) => ({ token: t, result: await sendFcmToToken(t, payload) })));
    const invalid = results
        .filter((r) => r.result.invalid)
        .map((r) => r.token);
    if (invalid.length === 0)
        return;
    try {
        const { pool } = await Promise.resolve().then(() => __importStar(require('../db')));
        await pool.query(`DELETE FROM device_tokens WHERE token = ANY($1::text[])`, [
            invalid,
        ]);
        console.log('[fcm] pruned invalid device tokens:', invalid.length);
    }
    catch (err) {
        console.warn('[fcm] failed to prune invalid tokens:', err);
    }
}
//# sourceMappingURL=fcm.js.map