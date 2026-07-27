import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { notifyChurchBroadcast } from './notifications';
import { writeAudit } from '../services/audit';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

function canManageAnnouncements(req: Request) {
  if (req.accountType === 'member') return false;
  const role = String(req.churchUser?.role || '').toLowerCase();
  return role === 'pastor' || role === 'admin' || role === 'super-admin';
}

/**
 * GET /api/announcements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;

    const result = await pool.query(
      `SELECT a.*,
              u.first_name AS created_by_first_name,
              u.last_name AS created_by_last_name,
              d.name AS department_name
       FROM church_announcements a
       LEFT JOIN church_users u ON u.id = a.created_by
       LEFT JOIN church_departments d ON d.id = a.department_id
       WHERE a.church_id = $1
       ORDER BY a.is_pinned DESC, a.publish_date DESC, a.id DESC`,
      [churchId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List announcements error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * GET /api/announcements/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid announcement id' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM church_announcements WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get announcement error:', err);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

/**
 * POST /api/announcements
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!canManageAnnouncements(req)) {
      res.status(403).json({ error: 'Only pastors and admins can post announcements' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const userId = req.churchUser!.id;
    const {
      title,
      body,
      audience,
      department_id,
      is_pinned,
      publish_date,
    } = req.body;

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO church_announcements (
         church_id, title, body, audience, department_id,
         is_pinned, publish_date, created_by
       ) VALUES ($1,$2,$3,COALESCE($4,'all'),$5,COALESCE($6,false),COALESCE($7,CURRENT_DATE),$8)
       RETURNING *`,
      [
        churchId,
        title,
        body,
        audience || null,
        department_id || null,
        is_pinned !== undefined ? is_pinned : null,
        publish_date || null,
        userId,
      ]
    );

    const announcement = result.rows[0];
    const preview =
      String(body).length > 140 ? `${String(body).slice(0, 137)}…` : String(body);

    try {
      await notifyChurchBroadcast({
        churchId,
        title: `Announcement: ${title}`,
        body: preview,
        link: '/announcements',
      });
    } catch (notifyErr) {
      console.error('Announcement notify error:', notifyErr);
    }

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: userId,
      actorName: `${req.churchUser!.first_name} ${req.churchUser!.last_name}`,
      action: 'announcement.create',
      entityType: 'announcement',
      entityId: announcement.id,
      summary: `Posted announcement “${title}”`,
    });

    res.status(201).json(announcement);
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * PUT /api/announcements/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!canManageAnnouncements(req)) {
      res.status(403).json({ error: 'Only pastors and admins can edit announcements' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid announcement id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_announcements WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body;

    const result = await pool.query(
      `UPDATE church_announcements SET
         title = $1,
         body = $2,
         audience = $3,
         department_id = $4,
         is_pinned = $5,
         publish_date = $6
       WHERE id = $7 AND church_id = $8
       RETURNING *`,
      [
        b.title ?? cur.title,
        b.body ?? cur.body,
        b.audience !== undefined ? b.audience : cur.audience,
        b.department_id !== undefined ? b.department_id : cur.department_id,
        b.is_pinned !== undefined ? b.is_pinned : cur.is_pinned,
        b.publish_date !== undefined ? b.publish_date : cur.publish_date,
        id,
        churchId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

/**
 * DELETE /api/announcements/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!canManageAnnouncements(req)) {
      res.status(403).json({ error: 'Only pastors and admins can delete announcements' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid announcement id' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM church_announcements WHERE id = $1 AND church_id = $2 RETURNING id, title',
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: req.churchUser!.id,
      actorName: `${req.churchUser!.first_name} ${req.churchUser!.last_name}`.trim(),
      action: 'announcement.delete',
      summary: `Deleted announcement “${result.rows[0].title}”`,
      entityType: 'church_announcements',
      entityId: id,
    });

    res.json({ message: 'Announcement deleted', id });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

/**
 * POST /api/announcements/:id/pin
 */
router.post('/:id/pin', async (req: Request, res: Response) => {
  try {
    if (!canManageAnnouncements(req)) {
      res.status(403).json({ error: 'Only pastors and admins can pin announcements' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid announcement id' });
      return;
    }

    const existing = await pool.query(
      'SELECT is_pinned FROM church_announcements WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }

    const nextPinned =
      req.body.is_pinned !== undefined
        ? Boolean(req.body.is_pinned)
        : !existing.rows[0].is_pinned;

    const result = await pool.query(
      `UPDATE church_announcements
       SET is_pinned = $1
       WHERE id = $2 AND church_id = $3
       RETURNING *`,
      [nextPinned, id, churchId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Pin announcement error:', err);
    res.status(500).json({ error: 'Failed to pin announcement' });
  }
});

export default router;
