import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { sendFcmToToken, sendFcmToTokens } from '../services/fcm';

const router = Router();

router.use(requireChurchAuth);

function unreadWhereClause(): string {
  return `(
    (user_type = $1 AND user_id = $2)
    OR (church_id = $3 AND user_id IS NULL)
  )`;
}

async function countUnreadForUser(
  accountType: string,
  userId: number,
  churchId: number
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS c FROM notifications
     WHERE is_read = false AND ${unreadWhereClause()}`,
    [accountType, userId, churchId]
  );
  return Number(result.rows[0]?.c) || 0;
}

/**
 * GET /api/notifications
 * Personal + church-wide broadcasts for the current staff/member.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.churchUser!;
    const accountType = req.accountType || 'staff';

    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE (user_type = $1 AND user_id = $2)
          OR (church_id = $3 AND user_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`,
      [accountType, user.id, user.church_id]
    );

    const unread = result.rows.filter((r) => !r.is_read).length;
    res.json({ data: result.rows, unread });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const user = req.churchUser!;
    const accountType = req.accountType || 'staff';
    const count = await countUnreadForUser(
      accountType,
      user.id,
      user.church_id
    );
    res.json({ count });
  } catch (err) {
    console.error('Unread notifications count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * POST /api/notifications/read/:id
 */
router.post('/read/:id', async (req: Request, res: Response) => {
  try {
    const user = req.churchUser!;
    const accountType = req.accountType || 'staff';
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }

    const result = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1
         AND (
           (user_type = $2 AND user_id = $3)
           OR (church_id = $4 AND user_id IS NULL)
         )
       RETURNING *`,
      [id, accountType, user.id, user.church_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const unread = await countUnreadForUser(
      accountType,
      user.id,
      user.church_id
    );
    res.json({ ...result.rows[0], unread });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const user = req.churchUser!;
    const accountType = req.accountType || 'staff';

    await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE is_read = false
         AND (
           (user_type = $1 AND user_id = $2)
           OR (church_id = $3 AND user_id IS NULL)
         )`,
      [accountType, user.id, user.church_id]
    );

    res.json({ ok: true, unread: 0 });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * POST /api/notifications/device-token
 * Body: { token: string }
 */
router.post('/device-token', async (req: Request, res: Response) => {
  try {
    const user = req.churchUser!;
    const accountType = req.accountType || 'staff';
    const token = String(req.body?.token || '').trim();

    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    await pool.query(
      `INSERT INTO device_tokens (user_type, user_id, church_id, token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET
         user_type = EXCLUDED.user_type,
         user_id = EXCLUDED.user_id,
         church_id = EXCLUDED.church_id`,
      [accountType, user.id, user.church_id, token]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Save device token error:', err);
    res.status(500).json({ error: 'Failed to save device token' });
  }
});

export default router;

/** Helper used by superadmin when creating church-targeted notifications */
export async function notifyChurchUsers(opts: {
  churchId: number;
  title: string;
  body: string;
  link?: string | null;
  userType?: 'staff' | 'member';
  userId?: number | null;
}): Promise<number> {
  const userType = opts.userType || 'staff';
  const result = await pool.query(
    `INSERT INTO notifications (church_id, user_type, user_id, title, body, link)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      opts.churchId,
      userType,
      opts.userId ?? null,
      opts.title,
      opts.body,
      opts.link ?? null,
    ]
  );

  if (opts.userId != null) {
    const tokens = await pool.query(
      `SELECT token FROM device_tokens
       WHERE church_id = $1 AND user_type = $2 AND user_id = $3`,
      [opts.churchId, userType, opts.userId]
    );
    const badge = await countUnreadForUser(
      userType,
      opts.userId,
      opts.churchId
    );
    if (tokens.rows.length > 0) {
      await sendFcmToTokens(
        tokens.rows.map((r) => r.token as string),
        {
          title: opts.title,
          body: opts.body,
          link: opts.link,
          badge,
        }
      );
    }
  } else {
    // Per-device personalized badge for this audience
    const tokens = await pool.query(
      `SELECT token, user_id FROM device_tokens
       WHERE church_id = $1 AND user_type = $2`,
      [opts.churchId, userType]
    );
    await Promise.all(
      tokens.rows.map(async (row) => {
        const uid = Number(row.user_id);
        const badge = Number.isFinite(uid)
          ? await countUnreadForUser(userType, uid, opts.churchId)
          : 1;
        await sendFcmToToken(String(row.token), {
          title: opts.title,
          body: opts.body,
          link: opts.link,
          badge,
        });
      })
    );
  }

  return result.rows[0].id as number;
}

/**
 * Church-wide announcement broadcast — one in-app row (visible to all staff/members)
 * plus FCM to every registered device for that church (all tenants).
 */
export async function notifyChurchBroadcast(opts: {
  churchId: number;
  title: string;
  body: string;
  link?: string | null;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO notifications (church_id, user_type, user_id, title, body, link)
     VALUES ($1, 'staff', NULL, $2, $3, $4)
     RETURNING id`,
    [opts.churchId, opts.title, opts.body, opts.link ?? null]
  );

  const tokens = await pool.query(
    `SELECT token, user_id, user_type FROM device_tokens WHERE church_id = $1`,
    [opts.churchId]
  );

  await Promise.all(
    tokens.rows.map(async (row) => {
      const uid = Number(row.user_id);
      const utype = String(row.user_type || 'staff');
      let badge = 1;
      if (Number.isFinite(uid) && uid > 0) {
        badge = await countUnreadForUser(utype, uid, opts.churchId);
      }
      await sendFcmToToken(String(row.token), {
        title: opts.title,
        body: opts.body,
        link: opts.link,
        badge,
      });
    })
  );

  return result.rows[0].id as number;
}
