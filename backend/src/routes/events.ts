import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { writeAudit } from '../services/audit';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

/**
 * GET /api/events
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const upcoming = req.query.upcoming !== 'false';

    let query = `
      SELECT e.*,
             u.first_name AS created_by_first_name,
             u.last_name AS created_by_last_name
      FROM church_events e
      LEFT JOIN church_users u ON u.id = e.created_by
      WHERE e.church_id = $1
    `;
    const params: unknown[] = [churchId];

    if (upcoming) {
      query += ` AND e.start_datetime >= NOW() - INTERVAL '1 day'`;
    }

    query += ` ORDER BY e.start_datetime ASC`;

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid event id' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM church_events WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const userId = req.churchUser!.id;
    const {
      title,
      description,
      event_type,
      start_datetime,
      end_datetime,
      location,
      banner_url,
      is_public,
    } = req.body;

    if (!title || !start_datetime) {
      res.status(400).json({ error: 'title and start_datetime are required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO church_events (
         church_id, title, description, event_type, start_datetime,
         end_datetime, location, banner_url, is_public, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, true),$10)
       RETURNING *`,
      [
        churchId,
        title,
        description || null,
        event_type || null,
        start_datetime,
        end_datetime || null,
        location || null,
        banner_url || null,
        is_public !== undefined ? is_public : null,
        userId,
      ]
    );

    const actor = req.churchUser!;
    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: actor.id,
      actorName: `${actor.first_name} ${actor.last_name}`,
      action: 'event.create',
      entityType: 'church_event',
      entityId: result.rows[0].id,
      summary: `Created event “${title}”`,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/events/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid event id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_events WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body;

    const result = await pool.query(
      `UPDATE church_events SET
         title = $1,
         description = $2,
         event_type = $3,
         start_datetime = $4,
         end_datetime = $5,
         location = $6,
         banner_url = $7,
         is_public = $8
       WHERE id = $9 AND church_id = $10
       RETURNING *`,
      [
        b.title ?? cur.title,
        b.description !== undefined ? b.description : cur.description,
        b.event_type !== undefined ? b.event_type : cur.event_type,
        b.start_datetime ?? cur.start_datetime,
        b.end_datetime !== undefined ? b.end_datetime : cur.end_datetime,
        b.location !== undefined ? b.location : cur.location,
        b.banner_url !== undefined ? b.banner_url : cur.banner_url,
        b.is_public !== undefined ? b.is_public : cur.is_public,
        id,
        churchId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * DELETE /api/events/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const role = String(req.churchUser?.role || '').toLowerCase();
    if (req.accountType === 'member') {
      res.status(403).json({ error: 'Members cannot delete events' });
      return;
    }
    if (!['pastor', 'admin', 'super-admin'].includes(role)) {
      res.status(403).json({ error: 'Only pastors and admins can delete events' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid event id' });
      return;
    }

    const existing = await pool.query(
      'SELECT id, title FROM church_events WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    await pool.query(
      'DELETE FROM church_events WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: req.churchUser!.id,
      actorName: `${req.churchUser!.first_name} ${req.churchUser!.last_name}`.trim(),
      action: 'event.delete',
      summary: `Deleted event “${existing.rows[0].title}”`,
      entityType: 'church_events',
      entityId: id,
    });

    res.json({ message: 'Event deleted', id });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
