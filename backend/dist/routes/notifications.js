"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyChurchUsers = notifyChurchUsers;
exports.notifyChurchBroadcast = notifyChurchBroadcast;
const express_1 = require("express");
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const fcm_1 = require("../services/fcm");
const router = (0, express_1.Router)();
router.use(churchAuth_1.requireChurchAuth);
function unreadWhereClause() {
    return `(
    (user_type = $1 AND user_id = $2)
    OR (church_id = $3 AND user_id IS NULL)
  )`;
}
async function countUnreadForUser(accountType, userId, churchId) {
    const result = await db_1.pool.query(`SELECT COUNT(*)::int AS c FROM notifications
     WHERE is_read = false AND ${unreadWhereClause()}`, [accountType, userId, churchId]);
    return Number(result.rows[0]?.c) || 0;
}
/**
 * GET /api/notifications
 * Personal + church-wide broadcasts for the current staff/member.
 */
router.get('/', async (req, res) => {
    try {
        const user = req.churchUser;
        const accountType = req.accountType || 'staff';
        const result = await db_1.pool.query(`SELECT * FROM notifications
       WHERE (user_type = $1 AND user_id = $2)
          OR (church_id = $3 AND user_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`, [accountType, user.id, user.church_id]);
        const unread = result.rows.filter((r) => !r.is_read).length;
        res.json({ data: result.rows, unread });
    }
    catch (err) {
        console.error('List notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', async (req, res) => {
    try {
        const user = req.churchUser;
        const accountType = req.accountType || 'staff';
        const count = await countUnreadForUser(accountType, user.id, user.church_id);
        res.json({ count });
    }
    catch (err) {
        console.error('Unread notifications count error:', err);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});
/**
 * POST /api/notifications/read/:id
 */
router.post('/read/:id', async (req, res) => {
    try {
        const user = req.churchUser;
        const accountType = req.accountType || 'staff';
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid notification id' });
            return;
        }
        const result = await db_1.pool.query(`UPDATE notifications SET is_read = true
       WHERE id = $1
         AND (
           (user_type = $2 AND user_id = $3)
           OR (church_id = $4 AND user_id IS NULL)
         )
       RETURNING *`, [id, accountType, user.id, user.church_id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        const unread = await countUnreadForUser(accountType, user.id, user.church_id);
        res.json({ ...result.rows[0], unread });
    }
    catch (err) {
        console.error('Mark notification read error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', async (req, res) => {
    try {
        const user = req.churchUser;
        const accountType = req.accountType || 'staff';
        await db_1.pool.query(`UPDATE notifications SET is_read = true
       WHERE is_read = false
         AND (
           (user_type = $1 AND user_id = $2)
           OR (church_id = $3 AND user_id IS NULL)
         )`, [accountType, user.id, user.church_id]);
        res.json({ ok: true, unread: 0 });
    }
    catch (err) {
        console.error('Mark all notifications read error:', err);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});
/**
 * POST /api/notifications/device-token
 * Body: { token: string }
 */
router.post('/device-token', async (req, res) => {
    try {
        const user = req.churchUser;
        const accountType = req.accountType || 'staff';
        const token = String(req.body?.token || '').trim();
        if (!token) {
            res.status(400).json({ error: 'token is required' });
            return;
        }
        await db_1.pool.query(`INSERT INTO device_tokens (user_type, user_id, church_id, token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET
         user_type = EXCLUDED.user_type,
         user_id = EXCLUDED.user_id,
         church_id = EXCLUDED.church_id`, [accountType, user.id, user.church_id, token]);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('Save device token error:', err);
        res.status(500).json({ error: 'Failed to save device token' });
    }
});
exports.default = router;
/** Helper used by superadmin when creating church-targeted notifications */
async function notifyChurchUsers(opts) {
    const userType = opts.userType || 'staff';
    const result = await db_1.pool.query(`INSERT INTO notifications (church_id, user_type, user_id, title, body, link)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`, [
        opts.churchId,
        userType,
        opts.userId ?? null,
        opts.title,
        opts.body,
        opts.link ?? null,
    ]);
    if (opts.userId != null) {
        const tokens = await db_1.pool.query(`SELECT token FROM device_tokens
       WHERE church_id = $1 AND user_type = $2 AND user_id = $3`, [opts.churchId, userType, opts.userId]);
        const badge = await countUnreadForUser(userType, opts.userId, opts.churchId);
        if (tokens.rows.length > 0) {
            await (0, fcm_1.sendFcmToTokens)(tokens.rows.map((r) => r.token), {
                title: opts.title,
                body: opts.body,
                link: opts.link,
                badge,
            });
        }
    }
    else {
        // Per-device personalized badge for this audience
        const tokens = await db_1.pool.query(`SELECT token, user_id FROM device_tokens
       WHERE church_id = $1 AND user_type = $2`, [opts.churchId, userType]);
        await Promise.all(tokens.rows.map(async (row) => {
            const uid = Number(row.user_id);
            const badge = Number.isFinite(uid)
                ? await countUnreadForUser(userType, uid, opts.churchId)
                : 1;
            await (0, fcm_1.sendFcmToToken)(String(row.token), {
                title: opts.title,
                body: opts.body,
                link: opts.link,
                badge,
            });
        }));
    }
    return result.rows[0].id;
}
/**
 * Church-wide announcement broadcast — one in-app row (visible to all staff/members)
 * plus FCM to every registered device for that church (all tenants).
 */
async function notifyChurchBroadcast(opts) {
    const result = await db_1.pool.query(`INSERT INTO notifications (church_id, user_type, user_id, title, body, link)
     VALUES ($1, 'staff', NULL, $2, $3, $4)
     RETURNING id`, [opts.churchId, opts.title, opts.body, opts.link ?? null]);
    const tokens = await db_1.pool.query(`SELECT token, user_id, user_type FROM device_tokens WHERE church_id = $1`, [opts.churchId]);
    await Promise.all(tokens.rows.map(async (row) => {
        const uid = Number(row.user_id);
        const utype = String(row.user_type || 'staff');
        let badge = 1;
        if (Number.isFinite(uid) && uid > 0) {
            badge = await countUnreadForUser(utype, uid, opts.churchId);
        }
        await (0, fcm_1.sendFcmToToken)(String(row.token), {
            title: opts.title,
            body: opts.body,
            link: opts.link,
            badge,
        });
    }));
    return result.rows[0].id;
}
//# sourceMappingURL=notifications.js.map