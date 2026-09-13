import { Sunrise, BookOpen, Users, Handshake, MessageCircle, Church, type LucideIcon } from 'lucide-react';
import type { Participant } from 'livekit-client';
import type { LiveRoom, LiveRoomType } from '../types/live';

export const ROOM_TYPE_META: Record<LiveRoomType, { label: string; icon: LucideIcon; color: string }> = {
  devotion: { label: 'Morning Devotion', icon: Sunrise, color: '#e8a33d' },
  bible_study: { label: 'Bible Study', icon: BookOpen, color: '#4A2F9A' },
  cell_group: { label: 'Cell Group', icon: Users, color: '#2f9a6e' },
  meeting: { label: 'Meeting', icon: Handshake, color: '#7c5cbf' },
  counseling: { label: 'Counseling', icon: MessageCircle, color: '#2f8fa9' },
  service: { label: 'Service', icon: Church, color: '#b4562f' },
};

export const ROOM_TYPE_OPTIONS: { value: LiveRoomType; label: string; icon: LucideIcon; color: string }[] = (
  Object.keys(ROOM_TYPE_META) as LiveRoomType[]
).map((value) => ({
  value,
  label: ROOM_TYPE_META[value].label,
  icon: ROOM_TYPE_META[value].icon,
  color: ROOM_TYPE_META[value].color,
}));

const BROADCAST_TYPES = new Set<LiveRoomType>(['devotion', 'service']);

/** Broadcast rooms: one large featured host, everyone else viewer-only. */
export function isBroadcastRoom(type: string): boolean {
  return BROADCAST_TYPES.has(type as LiveRoomType);
}

export function roomTypeMeta(type: string) {
  return ROOM_TYPE_META[type as LiveRoomType] || { label: type, icon: Church, color: '#7c5cbf' };
}

export interface ParticipantMeta {
  userType: 'staff' | 'member' | 'guest';
  userId: number;
  role: 'publisher' | 'viewer';
}

/** Parses the JSON metadata we stamp onto each LiveKit access token. */
export function parseParticipantMeta(participant?: Participant | null): ParticipantMeta | null {
  if (!participant?.metadata) return null;
  try {
    const parsed = JSON.parse(participant.metadata) as Partial<ParticipantMeta>;
    if (!parsed.userType || parsed.userId == null) return null;
    return {
      userType: parsed.userType,
      userId: Number(parsed.userId),
      role: parsed.role === 'publisher' ? 'publisher' : 'viewer',
    };
  } catch {
    return null;
  }
}

/** Human label for a participant's role — anonymous public-link joiners read "Guest". */
export function roleLabelFor(meta: ParticipantMeta | null, isHost: boolean): string {
  if (isHost) return 'Host';
  if (meta?.userType === 'staff') return 'Staff';
  if (meta?.userType === 'guest') return 'Guest';
  return 'Member';
}

/** The room creator — shown with a crown badge and sorted first. */
export function isRoomHost(room: Pick<LiveRoom, 'created_by'>, participant?: Participant | null): boolean {
  const meta = parseParticipantMeta(participant);
  if (!meta || room.created_by == null) return false;
  return meta.userType === 'staff' && meta.userId === Number(room.created_by);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const AVATAR_PALETTE = ['#7c5cbf', '#2f9a6e', '#b4562f', '#2f8fa9', '#c0447a', '#9a7d2f', '#4A2F9A', '#2f7a9a'];

/** Deterministic avatar color per name, so a person's color stays stable across renders. */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function formatRoomSchedule(room: Pick<LiveRoom, 'status' | 'scheduled_at' | 'started_at' | 'ended_at'>): string {
  if (room.status === 'live') return 'Live now';
  if (room.status === 'ended') {
    return room.ended_at
      ? `Ended ${new Date(room.ended_at).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })}`
      : 'Ended';
  }
  if (!room.scheduled_at) return 'Starts when the host joins';
  return new Date(room.scheduled_at).toLocaleString('en-GH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
