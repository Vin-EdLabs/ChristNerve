import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

let cachedClient: RoomServiceClient | null = null;
let cachedHost: string | null = null;

function httpUrlFor(url: string): string {
  return url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
}

function creds(): { url: string; apiKey: string; apiSecret: string } {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      'LiveKit is not configured — set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in backend .env'
    );
  }
  return { url, apiKey, apiSecret };
}

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
      process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim()
  );
}

function roomService(): RoomServiceClient {
  const { url, apiKey, apiSecret } = creds();
  const host = httpUrlFor(url);
  if (!cachedClient || cachedHost !== host) {
    cachedClient = new RoomServiceClient(host, apiKey, apiSecret);
    cachedHost = host;
  }
  return cachedClient;
}

export async function createRoomToken(opts: {
  roomName: string;
  identity: string;
  displayName: string;
  canPublish: boolean;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { apiKey, apiSecret } = creds();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.displayName,
    ttl: '6h',
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: opts.canPublish,
    canPublishData: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });
  return at.toJwt();
}

// Short-lived cache so a burst of requests (several staff viewing the room list, or the
// same client's 30s poll landing close to another) doesn't each trigger a fresh LiveKit
// REST round trip — this was the main source of slow /rooms list responses.
const PARTICIPANT_COUNT_TTL_MS = 4000;
const participantCountCache = new Map<string, { count: number; at: number }>();

// The LiveKit Cloud REST call has no built-in timeout — if it's slow or briefly
// unreachable, an un-timed-out await here blocks the whole /rooms list response behind
// it (this was the actual cause of the page appearing to "hang loading" for many
// seconds). Racing it against a short timeout means a slow LiveKit call degrades to a
// stale/zero count almost instantly instead of stalling the page.
const PARTICIPANT_COUNT_FETCH_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Live participant count straight from LiveKit — no DB lag, briefly cached to stay fast. */
export async function getLiveParticipantCount(roomName: string): Promise<number> {
  const cached = participantCountCache.get(roomName);
  if (cached && Date.now() - cached.at < PARTICIPANT_COUNT_TTL_MS) {
    return cached.count;
  }
  try {
    const rows = await withTimeout(roomService().listParticipants(roomName), PARTICIPANT_COUNT_FETCH_TIMEOUT_MS);
    participantCountCache.set(roomName, { count: rows.length, at: Date.now() });
    return rows.length;
  } catch {
    return cached?.count ?? 0;
  }
}

export async function getLiveParticipantCounts(
  roomNames: string[]
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    roomNames.map(async (name) => [name, await getLiveParticipantCount(name)] as const)
  );
  return Object.fromEntries(entries);
}

/** Ends the LiveKit room and disconnects everyone in it. Safe if the room was never created. */
export async function endLiveKitRoom(roomName: string): Promise<void> {
  try {
    await roomService().deleteRoom(roomName);
  } catch {
    /* room may not exist on the LiveKit side yet — fine */
  }
}

export async function removeParticipant(roomName: string, identity: string): Promise<void> {
  try {
    await roomService().removeParticipant(roomName, identity);
  } catch {
    /* already gone */
  }
}
