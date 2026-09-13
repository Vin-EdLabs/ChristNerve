import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { writeAudit } from '../services/audit';
import { notifyChurchBroadcast } from './notifications';
import {
  createRoomToken,
  endLiveKitRoom,
  getLiveParticipantCount,
  getLiveParticipantCounts,
  isLiveKitConfigured,
} from '../services/livekit';

const router = Router();
router.use(requireChurchTenant);

const ROOM_TYPES = [
  'devotion',
  'service',
  'bible_study',
  'cell_group',
  'meeting',
  'counseling',
] as const;
type RoomType = (typeof ROOM_TYPES)[number];

/** Broadcast rooms: one large host, everyone else viewer-only unless promoted. */
const BROADCAST_TYPES = new Set<RoomType>(['devotion', 'service']);

function isRoomType(value: unknown): value is RoomType {
  return typeof value === 'string' && (ROOM_TYPES as readonly string[]).includes(value);
}

function isStaff(req: Request): boolean {
  return req.accountType !== 'member';
}

function canManageRooms(req: Request): boolean {
  if (!isStaff(req)) return false;
  const role = String(req.churchUser?.role || '').toLowerCase();
  return ['pastor', 'admin', 'super-admin', 'secretary', 'media'].includes(role);
}

function requireManage(req: Request, res: Response): boolean {
  if (!canManageRooms(req)) {
    res.status(403).json({ error: 'Staff only' });
    return false;
  }
  return true;
}

function actorIdentity(req: Request): { userType: 'staff' | 'member'; userId: number; identity: string; displayName: string } {
  const user = req.churchUser!;
  const userType = isStaff(req) ? 'staff' : 'member';
  return {
    userType,
    userId: Number(user.id),
    identity: `${userType}-${user.id}`,
    displayName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Guest',
  };
}

async function auditSafe(
  req: Request,
  action: string,
  entityId: number | null,
  summary: string
) {
  try {
    const actor = req.churchUser;
    await writeAudit({
      churchId: req.churchTenant!.id,
      actorType: isStaff(req) ? 'staff' : 'member',
      actorId: actor?.id ?? null,
      actorName: actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() : null,
      action,
      entityType: 'live_rooms',
      entityId,
      summary,
    });
  } catch {
    /* ignore */
  }
}

async function notifyBroadcastSafe(opts: { churchId: number; title: string; body: string; link?: string | null }) {
  try {
    await notifyChurchBroadcast(opts);
  } catch (err) {
    console.warn('Live room broadcast notify failed:', err);
  }
}

function roomIsHost(room: { created_by: number | null }, req: Request): boolean {
  return isStaff(req) && room.created_by != null && Number(room.created_by) === Number(req.churchUser?.id);
}

/* ─── Public, no-login guest join (must stay ahead of requireChurchAuth) ─ */

router.get('/rooms/public/:code', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const code = String(req.params.code || '').trim();
    if (!code) {
      res.status(404).json({ error: 'Invalid invite link' });
      return;
    }
    const result = await pool.query(
      `SELECT id, name, description, room_type, status
       FROM live_rooms
       WHERE church_id = $1 AND public_join_code = $2 AND public_join_enabled = true`,
      [churchId, code]
    );
    const room = result.rows[0];
    if (!room) {
      res.status(404).json({ error: 'This invite link is no longer active' });
      return;
    }
    if (room.status === 'ended') {
      res.status(410).json({ error: 'This room has ended' });
      return;
    }
    res.json({
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        room_type: room.room_type,
        status: room.status,
      },
      church_name: req.churchTenant!.name,
      church_logo_url: req.churchTenant!.logo_url,
      brand_color: req.churchTenant!.brand_color,
    });
  } catch (err) {
    console.error('Public room lookup error:', err);
    res.status(500).json({ error: 'Failed to load room' });
  }
});

router.post('/rooms/public/:code/token', async (req: Request, res: Response) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: 'Live rooms are not configured yet — contact an administrator' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const code = String(req.params.code || '').trim();
    const guestName = String(req.body?.name || '').trim().slice(0, 60) || 'Guest';

    const result = await pool.query(
      `SELECT * FROM live_rooms
       WHERE church_id = $1 AND public_join_code = $2 AND public_join_enabled = true`,
      [churchId, code]
    );
    const room = result.rows[0];
    if (!room) {
      res.status(404).json({ error: 'This invite link is no longer active' });
      return;
    }
    if (room.status === 'ended') {
      res.status(410).json({ error: 'This room has ended' });
      return;
    }

    let liveRoom = room;
    if (room.status === 'scheduled') {
      const flipped = await pool.query(
        `UPDATE live_rooms
         SET status = 'live', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [room.id]
      );
      liveRoom = flipped.rows[0];
    }

    const identity = `guest-${randomUUID()}`;
    const canPublish = !BROADCAST_TYPES.has(liveRoom.room_type as RoomType);

    const token = await createRoomToken({
      roomName: liveRoom.livekit_room,
      identity,
      displayName: guestName,
      canPublish,
      metadata: { userType: 'guest', userId: 0, role: canPublish ? 'publisher' : 'viewer' },
    });

    await pool.query(
      `INSERT INTO live_room_attendees (room_id, church_id, user_type, user_id, display_name, identity)
       VALUES ($1,$2,'guest',$3,$4,$5)
       ON CONFLICT (room_id, user_type, user_id) DO NOTHING`,
      [room.id, churchId, Math.floor(Math.random() * 1_000_000_000), guestName, identity]
    );

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
      room: liveRoom,
      identity,
      can_publish: canPublish,
      is_host: false,
    });
  } catch (err) {
    console.error('Public room token error:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

router.use(requireChurchAuth);

router.get('/config', (_req, res) => {
  res.json({
    configured: isLiveKitConfigured(),
    url: process.env.LIVEKIT_URL || null,
  });
});

/* ─── Public link (moderator) ────────────────────────────────── */

router.post('/rooms/:id/public-link', async (req: Request, res: Response) => {
  try {
    // Any signed-in member or staff in the room can generate/share the join link, not just managers.
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const enabled = Boolean(req.body?.enabled);

    const existing = await pool.query(
      `SELECT id, public_join_code FROM live_rooms WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const code = existing.rows[0].public_join_code || randomUUID().replace(/-/g, '').slice(0, 10);

    const result = await pool.query(
      `UPDATE live_rooms
       SET public_join_enabled = $1, public_join_code = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, public_join_enabled, public_join_code`,
      [enabled, code, id]
    );

    await auditSafe(req, 'live_room.public_link', id, `${enabled ? 'Enabled' : 'Disabled'} public join link`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Live room public link error:', err);
    res.status(500).json({ error: 'Failed to update public link' });
  }
});

/* ─── Rooms list ──────────────────────────────────────────── */

router.get('/rooms', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM live_room_attendees a WHERE a.room_id = r.id) AS attendee_count
       FROM live_rooms r
       WHERE r.church_id = $1
       ORDER BY
         CASE r.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
         COALESCE(r.scheduled_at, r.created_at) ASC`,
      [churchId]
    );

    const liveRooms = result.rows.filter((r) => r.status === 'live');
    const counts = await getLiveParticipantCounts(liveRooms.map((r) => r.livekit_room));

    const rows = result.rows.map((r) => ({
      ...r,
      participant_count: r.status === 'live' ? counts[r.livekit_room] || 0 : 0,
    }));

    res.json({ data: rows });
  } catch (err) {
    console.error('Live rooms list error:', err);
    res.status(500).json({ error: 'Failed to load live rooms' });
  }
});

/** Lightweight "is anything live right now" check for dashboards. */
router.get('/rooms/active', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT * FROM live_rooms
       WHERE church_id = $1 AND status = 'live'
       ORDER BY started_at DESC
       LIMIT 1`,
      [churchId]
    );
    const room = result.rows[0];
    if (!room) {
      res.json({ room: null });
      return;
    }
    const participant_count = await getLiveParticipantCount(room.livekit_room);
    res.json({ room: { ...room, participant_count } });
  } catch (err) {
    console.error('Live room active error:', err);
    res.status(500).json({ error: 'Failed to load active room' });
  }
});

router.get('/rooms/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `SELECT * FROM live_rooms WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    const room = result.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const participant_count =
      room.status === 'live' ? await getLiveParticipantCount(room.livekit_room) : 0;
    res.json({
      ...room,
      participant_count,
      is_host: roomIsHost(room, req),
      can_manage: canManageRooms(req) || roomIsHost(room, req),
    });
  } catch (err) {
    console.error('Live room get error:', err);
    res.status(500).json({ error: 'Failed to load room' });
  }
});

/* ─── Create / start / end ────────────────────────────────── */

router.post('/rooms', async (req: Request, res: Response) => {
  try {
    if (!requireManage(req, res)) return;
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: 'Live rooms are not configured yet — contact an administrator' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const { name, room_type, description, scheduled_at, max_participants, start_now } =
      req.body || {};

    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const roomType: RoomType = isRoomType(room_type) ? room_type : 'meeting';
    const startNow = Boolean(start_now) || !scheduled_at;
    const livekitRoom = `ch${churchId}-${randomUUID()}`;
    const creator = req.churchUser!;
    const creatorName = `${creator.first_name || ''} ${creator.last_name || ''}`.trim();

    const result = await pool.query(
      `INSERT INTO live_rooms (
         church_id, livekit_room, name, description, room_type, status,
         scheduled_at, started_at, max_participants, created_by, created_by_name
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        churchId,
        livekitRoom,
        String(name).trim(),
        description ? String(description).trim() : null,
        roomType,
        startNow ? 'live' : 'scheduled',
        scheduled_at || null,
        startNow ? new Date() : null,
        Number(max_participants) > 0 ? Number(max_participants) : 50,
        creator.id,
        creatorName,
      ]
    );

    const room = result.rows[0];

    if (startNow) {
      const roomLabel =
        roomType === 'devotion'
          ? 'Morning Devotion'
          : roomType === 'service'
            ? 'Service'
            : room.name;
      await notifyBroadcastSafe({
        churchId,
        title: `🔴 ${room.name} is starting now`,
        body: `Join ${req.churchTenant!.name || 'ChristNerve'} Live — ${roomLabel}`,
        link: `/live-rooms/${room.id}`,
      });
    }

    await auditSafe(req, 'live_room.create', room.id, `Created live room "${room.name}"`);
    res.status(201).json(room);
  } catch (err) {
    console.error('Live room create error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.post('/rooms/:id/start', async (req: Request, res: Response) => {
  try {
    if (!requireManage(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);

    const result = await pool.query(
      `UPDATE live_rooms
       SET status = 'live', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1 AND church_id = $2 AND status != 'ended'
       RETURNING *`,
      [id, churchId]
    );
    const room = result.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    await notifyBroadcastSafe({
      churchId,
      title: `🔴 ${room.name} is starting now`,
      body: `Join ${req.churchTenant!.name || 'ChristNerve'} Live`,
      link: `/live-rooms/${room.id}`,
    });
    await auditSafe(req, 'live_room.start', room.id, `Started live room "${room.name}"`);
    res.json(room);
  } catch (err) {
    console.error('Live room start error:', err);
    res.status(500).json({ error: 'Failed to start room' });
  }
});

router.post('/rooms/:id/end', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM live_rooms WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    const room = existing.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (!canManageRooms(req) && !roomIsHost(room, req)) {
      res.status(403).json({ error: 'Only the host or staff can end this room' });
      return;
    }

    await endLiveKitRoom(room.livekit_room);

    const result = await pool.query(
      `UPDATE live_rooms
       SET status = 'ended', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await auditSafe(req, 'live_room.end', id, `Ended live room "${room.name}"`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Live room end error:', err);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

router.delete('/rooms/:id', async (req: Request, res: Response) => {
  try {
    if (!requireManage(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `DELETE FROM live_rooms
       WHERE id = $1 AND church_id = $2 AND status != 'live'
       RETURNING id`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Room not found, or it is currently live — end it first' });
      return;
    }
    await auditSafe(req, 'live_room.delete', id, 'Deleted live room');
    res.json({ ok: true });
  } catch (err) {
    console.error('Live room delete error:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

/* ─── Join token ──────────────────────────────────────────── */

router.post('/rooms/:id/token', async (req: Request, res: Response) => {
  try {
    if (!isLiveKitConfigured()) {
      res.status(503).json({ error: 'Live rooms are not configured yet — contact an administrator' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM live_rooms WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    const room = existing.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.status === 'ended') {
      res.status(410).json({ error: 'This room has ended' });
      return;
    }

    // First joiner flips a scheduled room live (covers interactive room types with no explicit "start").
    let liveRoom = room;
    if (room.status === 'scheduled') {
      const flipped = await pool.query(
        `UPDATE live_rooms
         SET status = 'live', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      liveRoom = flipped.rows[0];
    }

    const { userType, userId, identity, displayName } = actorIdentity(req);
    // Any signed-in member or staff can publish mic/camera/screen — only anonymous
    // public-link guests (see /rooms/public/:code/token below) stay viewer-only in
    // broadcast-type rooms.
    const canPublish = true;

    const token = await createRoomToken({
      roomName: liveRoom.livekit_room,
      identity,
      displayName,
      canPublish,
      metadata: { userType, userId, role: canPublish ? 'publisher' : 'viewer' },
    });

    await pool.query(
      `INSERT INTO live_room_attendees (room_id, church_id, user_type, user_id, display_name, identity)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (room_id, user_type, user_id) DO NOTHING`,
      [id, churchId, userType, userId, displayName, identity]
    );

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
      room: liveRoom,
      identity,
      can_publish: canPublish,
      is_host: roomIsHost(liveRoom, req) || canManageRooms(req),
    });
  } catch (err) {
    console.error('Live room token error:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

export default router;
