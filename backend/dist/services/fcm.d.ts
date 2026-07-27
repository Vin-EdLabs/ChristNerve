/**
 * FCM push via Firebase Admin SDK (service account).
 * Falls back to legacy FIREBASE_SERVER_KEY if Admin is not configured.
 */
export interface FcmPayload {
    title: string;
    body: string;
    link?: string | null;
    /** Unread count for home-screen / dock badge */
    badge?: number | null;
    data?: Record<string, string>;
}
export declare function isFcmConfigured(): boolean;
export declare function sendFcmToToken(token: string, payload: FcmPayload): Promise<{
    ok: boolean;
    skipped?: boolean;
    error?: string;
    invalid?: boolean;
}>;
export declare function sendFcmToTokens(tokens: string[], payload: FcmPayload): Promise<void>;
