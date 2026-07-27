import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { notifyChurchUsers } from './notifications';

const router = Router();
router.use(requireChurchTenant, requireChurchAuth);

function staffOnly(req: Request, res: Response): boolean {
  if (req.accountType === 'member') {
    res.status(403).json({ error: 'Staff only' });
    return false;
  }
  return true;
}

function previewText(text: string, max = 90) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function notifyPastorsSafe(opts: {
  churchId: number;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    await notifyChurchUsers({
      churchId: opts.churchId,
      userType: 'staff',
      title: opts.title,
      body: opts.body,
      link: opts.link || null,
    });
  } catch (err) {
    console.warn('Pastoral notify failed:', err);
  }
}

async function notifyMemberSafe(opts: {
  churchId: number;
  memberId: number;
  title: string;
  body: string;
  link?: string;
}) {
  try {
    await notifyChurchUsers({
      churchId: opts.churchId,
      userType: 'member',
      userId: opts.memberId,
      title: opts.title,
      body: opts.body,
      link: opts.link || null,
    });
  } catch (err) {
    console.warn('Member notify failed:', err);
  }
}

/* ─── Prayer Requests ─────────────────────────────────────── */

/** Member: list own prayer requests */
router.get('/prayer-requests/mine', async (req, res) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const memberId = req.churchUser!.id;
    const status = String(req.query.status || 'all');
    const result = await pool.query(
      `SELECT p.*,
              u.first_name AS assignee_first, u.last_name AS assignee_last
       FROM church_prayer_requests p
       LEFT JOIN church_users u ON u.id = p.assigned_to
       WHERE p.church_id = $1 AND p.member_id = $2
         AND ($3 = 'all' OR p.status = $3)
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [churchId, memberId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('My prayer list error:', err);
    res.status(500).json({ error: 'Failed to load your prayer requests' });
  }
});

/** Member: submit prayer request → pastors notified */
router.post('/prayer-requests/mine', async (req, res) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const memberId = req.churchUser!.id;
    const { is_anonymous, request } = req.body;
    if (!request?.trim()) {
      res.status(400).json({ error: 'request is required' });
      return;
    }
    const anonymous = Boolean(is_anonymous);
    const result = await pool.query(
      `INSERT INTO church_prayer_requests
         (church_id, member_id, is_anonymous, request, status)
       VALUES ($1,$2,$3,$4,'pending')
       RETURNING *`,
      [churchId, memberId, anonymous, String(request).trim()]
    );

    const who = anonymous
      ? 'An anonymous member'
      : `${req.churchUser!.first_name || ''} ${req.churchUser!.last_name || ''}`.trim() ||
        'A member';
    await notifyPastorsSafe({
      churchId,
      title: 'New prayer request',
      body: `${who}: ${previewText(request)}`,
      link: '/prayer-requests',
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Member create prayer error:', err);
    res.status(500).json({ error: 'Failed to submit prayer request' });
  }
});

router.get('/prayer-requests', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const status = String(req.query.status || 'all');
    const result = await pool.query(
      `SELECT p.*,
              m.first_name, m.last_name, m.avatar_url,
              u.first_name AS assignee_first, u.last_name AS assignee_last
       FROM church_prayer_requests p
       LEFT JOIN church_members m ON m.id = p.member_id
       LEFT JOIN church_users u ON u.id = p.assigned_to
       WHERE p.church_id = $1
         AND ($2 = 'all' OR p.status = $2)
       ORDER BY
         CASE p.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         p.created_at DESC
       LIMIT 200`,
      [churchId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List prayer error:', err);
    res.status(500).json({ error: 'Failed to load prayer requests' });
  }
});

router.post('/prayer-requests', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { member_id, is_anonymous, request, assigned_to } = req.body;
    if (!request?.trim()) {
      res.status(400).json({ error: 'request is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_prayer_requests
         (church_id, member_id, is_anonymous, request, assigned_to)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        churchId,
        member_id || null,
        Boolean(is_anonymous),
        String(request).trim(),
        assigned_to || null,
      ]
    );

    await notifyPastorsSafe({
      churchId,
      title: 'Prayer request logged',
      body: previewText(request),
      link: '/prayer-requests',
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create prayer error:', err);
    res.status(500).json({ error: 'Failed to create prayer request' });
  }
});

router.put('/prayer-requests/:id', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const prev = await pool.query(
      `SELECT status, member_id, request FROM church_prayer_requests
       WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!prev.rows.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const result = await pool.query(
      `UPDATE church_prayer_requests SET
         status = COALESCE($1, status),
         assigned_to = COALESCE($2, assigned_to),
         response = COALESCE($3, response),
         is_anonymous = COALESCE($4, is_anonymous),
         updated_at = NOW()
       WHERE id = $5 AND church_id = $6
       RETURNING *`,
      [
        b.status ?? null,
        b.assigned_to !== undefined ? b.assigned_to : null,
        b.response !== undefined ? b.response : null,
        b.is_anonymous !== undefined ? Boolean(b.is_anonymous) : null,
        id,
        churchId,
      ]
    );
    const row = result.rows[0];
    const oldStatus = prev.rows[0].status;
    if (
      row.member_id &&
      b.status &&
      b.status !== oldStatus &&
      (b.status === 'answered' || b.status === 'in_progress')
    ) {
      await notifyMemberSafe({
        churchId,
        memberId: Number(row.member_id),
        title:
          b.status === 'answered'
            ? 'Your prayer was answered'
            : 'Your prayer is being lifted',
        body:
          b.status === 'answered'
            ? 'The pastoral team marked your prayer request as answered.'
            : 'A pastor is praying with you — keep faith.',
        link: '/prayer-requests',
      });
    }
    res.json(row);
  } catch (err) {
    console.error('Update prayer error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/* ─── Follow-ups ──────────────────────────────────────────── */

router.get('/follow-ups', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const status = String(req.query.status || 'pending');
    const result = await pool.query(
      `SELECT f.*,
              m.first_name, m.last_name, m.avatar_url, m.phone, m.membership_status,
              u.first_name AS assignee_first, u.last_name AS assignee_last
       FROM church_follow_ups f
       JOIN church_members m ON m.id = f.member_id
       LEFT JOIN church_users u ON u.id = f.assigned_to
       WHERE f.church_id = $1
         AND ($2 = 'all' OR f.status = $2)
       ORDER BY f.created_at DESC
       LIMIT 200`,
      [churchId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List follow-ups error:', err);
    res.status(500).json({ error: 'Failed to load follow-ups' });
  }
});

router.post('/follow-ups', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { member_id, reason, assigned_to, status } = req.body;
    if (!member_id || !reason?.trim()) {
      res.status(400).json({ error: 'member_id and reason required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_follow_ups
         (church_id, member_id, reason, assigned_to, status)
       VALUES ($1,$2,$3,$4,COALESCE($5,'pending'))
       RETURNING *`,
      [churchId, member_id, String(reason).trim(), assigned_to || null, status || null]
    );

    await notifyPastorsSafe({
      churchId,
      title: 'New follow-up assigned',
      body: previewText(reason),
      link: '/follow-up',
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create follow-up error:', err);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

router.put('/follow-ups/:id', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const prev = await pool.query(
      `SELECT member_id, status FROM church_follow_ups WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!prev.rows.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const result = await pool.query(
      `UPDATE church_follow_ups SET
         status = COALESCE($1, status),
         assigned_to = COALESCE($2, assigned_to),
         notes = COALESCE($3, notes),
         completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $4 AND church_id = $5
       RETURNING *`,
      [
        b.status ?? null,
        b.assigned_to !== undefined ? b.assigned_to : null,
        b.notes !== undefined ? b.notes : null,
        id,
        churchId,
      ]
    );
    const row = result.rows[0];
    if (
      row.member_id &&
      b.status === 'completed' &&
      prev.rows[0].status !== 'completed'
    ) {
      await notifyMemberSafe({
        churchId,
        memberId: Number(row.member_id),
        title: 'Follow-up completed',
        body: 'A pastor completed your follow-up visit. God bless you.',
        link: '/',
      });
    }
    res.json(row);
  } catch (err) {
    console.error('Update follow-up error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/* ─── Welfare ─────────────────────────────────────────────── */

/** Member: list own welfare cases */
router.get('/welfare/mine', async (req, res) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const memberId = req.churchUser!.id;
    const status = String(req.query.status || 'all');
    const result = await pool.query(
      `SELECT w.*
       FROM church_welfare_cases w
       WHERE w.church_id = $1 AND w.member_id = $2
         AND ($3 = 'all' OR w.status = $3)
       ORDER BY w.created_at DESC
       LIMIT 100`,
      [churchId, memberId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('My welfare list error:', err);
    res.status(500).json({ error: 'Failed to load your welfare cases' });
  }
});

/** Member: request welfare care → pastors notified */
router.post('/welfare/mine', async (req, res) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const memberId = req.churchUser!.id;
    const { case_type, title, description } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_welfare_cases
         (church_id, member_id, case_type, title, description, status)
       VALUES ($1,$2,COALESCE($3,'other'),$4,$5,'open')
       RETURNING *`,
      [
        churchId,
        memberId,
        case_type || 'other',
        String(title).trim(),
        description || null,
      ]
    );

    const who =
      `${req.churchUser!.first_name || ''} ${req.churchUser!.last_name || ''}`.trim() ||
      'A member';
    await notifyPastorsSafe({
      churchId,
      title: 'New welfare request',
      body: `${who}: ${previewText(title)}`,
      link: '/welfare',
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Member create welfare error:', err);
    res.status(500).json({ error: 'Failed to submit welfare request' });
  }
});

router.get('/welfare', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const status = String(req.query.status || 'all');
    const result = await pool.query(
      `SELECT w.*,
              m.first_name, m.last_name, m.avatar_url, m.phone,
              u.first_name AS assignee_first, u.last_name AS assignee_last
       FROM church_welfare_cases w
       LEFT JOIN church_members m ON m.id = w.member_id
       LEFT JOIN church_users u ON u.id = w.assigned_to
       WHERE w.church_id = $1
         AND ($2 = 'all' OR w.status = $2)
       ORDER BY
         CASE w.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         w.created_at DESC
       LIMIT 200`,
      [churchId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List welfare error:', err);
    res.status(500).json({ error: 'Failed to load welfare cases' });
  }
});

router.post('/welfare', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { member_id, case_type, title, description, assigned_to } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_welfare_cases
         (church_id, member_id, case_type, title, description, assigned_to)
       VALUES ($1,$2,COALESCE($3,'other'),$4,$5,$6)
       RETURNING *`,
      [
        churchId,
        member_id || null,
        case_type || 'other',
        String(title).trim(),
        description || null,
        assigned_to || null,
      ]
    );

    await notifyPastorsSafe({
      churchId,
      title: 'Welfare case opened',
      body: previewText(title),
      link: '/welfare',
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create welfare error:', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.put('/welfare/:id', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const prev = await pool.query(
      `SELECT status, member_id FROM church_welfare_cases WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!prev.rows.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const result = await pool.query(
      `UPDATE church_welfare_cases SET
         status = COALESCE($1, status),
         assigned_to = COALESCE($2, assigned_to),
         description = COALESCE($3, description),
         case_type = COALESCE($4, case_type),
         title = COALESCE($5, title),
         updated_at = NOW()
       WHERE id = $6 AND church_id = $7
       RETURNING *`,
      [
        b.status ?? null,
        b.assigned_to !== undefined ? b.assigned_to : null,
        b.description !== undefined ? b.description : null,
        b.case_type ?? null,
        b.title ?? null,
        id,
        churchId,
      ]
    );
    const row = result.rows[0];
    if (
      row.member_id &&
      b.status &&
      b.status !== prev.rows[0].status &&
      (b.status === 'in_progress' || b.status === 'closed')
    ) {
      await notifyMemberSafe({
        churchId,
        memberId: Number(row.member_id),
        title:
          b.status === 'closed'
            ? 'Welfare case closed'
            : 'Welfare care in progress',
        body:
          b.status === 'closed'
            ? 'Your welfare case was closed by the care team.'
            : 'The church care team is working on your request.',
        link: '/welfare',
      });
    }
    res.json(row);
  } catch (err) {
    console.error('Update welfare error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/* ─── Cell groups ─────────────────────────────────────────── */

router.get('/cell-groups', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT g.*,
              m.first_name AS leader_first_name,
              m.last_name AS leader_last_name,
              (SELECT COUNT(*)::int FROM church_cell_group_members cm
               WHERE cm.cell_group_id = g.id) AS member_count
       FROM church_cell_groups g
       LEFT JOIN church_members m ON m.id = g.leader_member_id
       WHERE g.church_id = $1
       ORDER BY g.name ASC`,
      [churchId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List cell groups error:', err);
    res.status(500).json({ error: 'Failed to load cell groups' });
  }
});

router.get('/cell-groups/:id', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const group = await pool.query(
      `SELECT g.*,
              m.first_name AS leader_first_name,
              m.last_name AS leader_last_name
       FROM church_cell_groups g
       LEFT JOIN church_members m ON m.id = g.leader_member_id
       WHERE g.id = $1 AND g.church_id = $2`,
      [id, churchId]
    );
    if (!group.rows.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const members = await pool.query(
      `SELECT cm.id AS link_id, m.id, m.first_name, m.last_name, m.phone, m.avatar_url, cm.joined_at
       FROM church_cell_group_members cm
       JOIN church_members m ON m.id = cm.member_id
       WHERE cm.cell_group_id = $1
       ORDER BY m.last_name, m.first_name`,
      [id]
    );
    res.json({ ...group.rows[0], members: members.rows });
  } catch (err) {
    console.error('Get cell group error:', err);
    res.status(500).json({ error: 'Failed to load cell group' });
  }
});

router.post('/cell-groups', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { name, leader_member_id, meeting_day, meeting_time, location } =
      req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_cell_groups
         (church_id, name, leader_member_id, meeting_day, meeting_time, location)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        churchId,
        String(name).trim(),
        leader_member_id || null,
        meeting_day || null,
        meeting_time || null,
        location || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create cell group error:', err);
    res.status(500).json({ error: 'Failed to create cell group' });
  }
});

router.post('/cell-groups/:id/members', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const memberId = parseInt(String(req.body.member_id), 10);
    const ok = await pool.query(
      `SELECT id FROM church_cell_groups WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!ok.rows.length) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO church_cell_group_members (cell_group_id, member_id)
       VALUES ($1,$2)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [id, memberId]
    );
    res.status(201).json(result.rows[0] || { ok: true });
  } catch (err) {
    console.error('Add cell member error:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.put('/cell-groups/:id', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const cur = await pool.query(
      `SELECT * FROM church_cell_groups WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!cur.rows.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const c = cur.rows[0];
    const result = await pool.query(
      `UPDATE church_cell_groups SET
         name = $1,
         leader_member_id = $2,
         meeting_day = $3,
         meeting_time = $4,
         location = $5,
         last_meeting_at = $6,
         next_meeting_at = $7
       WHERE id = $8
       RETURNING *`,
      [
        b.name ?? c.name,
        b.leader_member_id !== undefined ? b.leader_member_id : c.leader_member_id,
        b.meeting_day !== undefined ? b.meeting_day : c.meeting_day,
        b.meeting_time !== undefined ? b.meeting_time : c.meeting_time,
        b.location !== undefined ? b.location : c.location,
        b.last_meeting_at !== undefined ? b.last_meeting_at : c.last_meeting_at,
        b.next_meeting_at !== undefined ? b.next_meeting_at : c.next_meeting_at,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update cell group error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/** Member-scoped prayer list for profile */
router.get('/members/:memberId/prayer-requests', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const memberId = parseInt(req.params.memberId, 10);
    const result = await pool.query(
      `SELECT * FROM church_prayer_requests
       WHERE church_id = $1 AND member_id = $2
       ORDER BY created_at DESC`,
      [churchId, memberId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Member prayer error:', err);
    res.status(500).json({ error: 'Failed to load' });
  }
});

router.get('/members/:memberId/cell-groups', async (req, res) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const memberId = parseInt(req.params.memberId, 10);
    const result = await pool.query(
      `SELECT g.*
       FROM church_cell_group_members cm
       JOIN church_cell_groups g ON g.id = cm.cell_group_id
       WHERE cm.member_id = $1 AND g.church_id = $2`,
      [memberId, churchId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Member cell error:', err);
    res.status(500).json({ error: 'Failed to load' });
  }
});

export default router;
