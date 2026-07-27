import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

async function isDeptLeader(
  churchId: number,
  departmentId: number,
  memberId: number
): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM church_departments
     WHERE id = $1 AND church_id = $2 AND leader_member_id = $3
     UNION
     SELECT 1 FROM church_department_members
     WHERE department_id = $1 AND church_id = $2 AND member_id = $3
       AND role = 'leader'
     LIMIT 1`,
    [departmentId, churchId, memberId]
  );
  return r.rows.length > 0;
}

/**
 * GET /api/departments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;

    const result = await pool.query(
      `SELECT d.*,
              m.first_name AS leader_first_name,
              m.last_name AS leader_last_name,
              (
                SELECT COUNT(*)::int FROM church_department_members dm
                WHERE dm.department_id = d.id
              ) AS member_count
       FROM church_departments d
       LEFT JOIN church_members m ON m.id = d.leader_member_id
       WHERE d.church_id = $1
       ORDER BY d.name ASC`,
      [churchId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * GET /api/departments/mine — member's departments, roster, and leader posts
 */
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;

    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }

    const memberId = req.churchUser!.id;

    const member = await pool.query(
      `SELECT department, ministry, cell_group, membership_date
       FROM church_members WHERE id = $1 AND church_id = $2`,
      [memberId, churchId]
    );

    if (member.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const profile = member.rows[0];

    let depts = await pool.query(
      `SELECT d.*,
              m.first_name AS leader_first_name,
              m.last_name AS leader_last_name,
              dm.role AS my_role,
              (
                SELECT COUNT(*)::int FROM church_department_members x
                WHERE x.department_id = d.id
              ) AS member_count
       FROM church_department_members dm
       JOIN church_departments d ON d.id = dm.department_id
       LEFT JOIN church_members m ON m.id = d.leader_member_id
       WHERE dm.member_id = $1 AND dm.church_id = $2
       ORDER BY d.name ASC`,
      [memberId, churchId]
    );

    // Fallback: free-text department name if junction empty
    if (depts.rows.length === 0 && profile.department) {
      const fallback = await pool.query(
        `SELECT d.*,
                m.first_name AS leader_first_name,
                m.last_name AS leader_last_name,
                'member' AS my_role,
                (
                  SELECT COUNT(*)::int FROM church_department_members x
                  WHERE x.department_id = d.id
                ) AS member_count
         FROM church_departments d
         LEFT JOIN church_members m ON m.id = d.leader_member_id
         WHERE d.church_id = $1 AND d.name ILIKE $2
         LIMIT 1`,
        [churchId, String(profile.department).split(',')[0].trim()]
      );
      depts = { ...fallback, rows: fallback.rows };
    }

    const departments = [];
    for (const d of depts.rows) {
      const [roster, posts] = await Promise.all([
        pool.query(
          `SELECT cm.id, cm.first_name, cm.last_name, cm.avatar_url, cm.phone,
                  cm.member_number, dm.role
           FROM church_department_members dm
           JOIN church_members cm ON cm.id = dm.member_id
           WHERE dm.department_id = $1 AND cm.membership_status = 'active'
           ORDER BY
             CASE WHEN dm.role = 'leader' THEN 0 ELSE 1 END,
             cm.last_name, cm.first_name`,
          [d.id]
        ),
        pool.query(
          `SELECT p.*,
                  a.first_name AS author_first_name,
                  a.last_name AS author_last_name
           FROM church_department_posts p
           LEFT JOIN church_members a ON a.id = p.author_member_id
           WHERE p.department_id = $1
           ORDER BY p.created_at DESC
           LIMIT 30`,
          [d.id]
        ),
      ]);

      const canPost =
        d.leader_member_id === memberId ||
        d.my_role === 'leader' ||
        (await isDeptLeader(churchId, d.id, memberId));

      departments.push({
        ...d,
        members: roster.rows,
        posts: posts.rows,
        can_post: canPost,
      });
    }

    res.json({
      departments,
      department: departments[0] || null,
      ministry: profile.ministry,
      cell_group: profile.cell_group,
      membership_date: profile.membership_date,
    });
  } catch (err) {
    console.error('My department error:', err);
    res.status(500).json({ error: 'Failed to fetch your department' });
  }
});

/**
 * POST /api/departments/:id/posts — leader posts meeting / event / update
 */
router.post('/:id/posts', async (req: Request, res: Response) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const departmentId = parseInt(req.params.id, 10);
    const memberId = req.churchUser!.id;

    if (Number.isNaN(departmentId)) {
      res.status(400).json({ error: 'Invalid department id' });
      return;
    }

    if (!(await isDeptLeader(churchId, departmentId, memberId))) {
      res.status(403).json({ error: 'Only department leaders can post' });
      return;
    }

    const { title, body, post_type, meeting_at, location } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const type = ['update', 'meeting', 'event'].includes(post_type)
      ? post_type
      : 'update';

    const result = await pool.query(
      `INSERT INTO church_department_posts (
         church_id, department_id, author_member_id, post_type, title, body,
         meeting_at, location
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        churchId,
        departmentId,
        memberId,
        type,
        title,
        body,
        meeting_at || null,
        location || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create dept post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

/**
 * DELETE /api/departments/:id/posts/:postId
 */
router.delete('/:id/posts/:postId', async (req: Request, res: Response) => {
  try {
    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const departmentId = parseInt(req.params.id, 10);
    const postId = parseInt(req.params.postId, 10);
    const memberId = req.churchUser!.id;

    if (Number.isNaN(departmentId) || Number.isNaN(postId)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    if (!(await isDeptLeader(churchId, departmentId, memberId))) {
      res.status(403).json({ error: 'Only department leaders can delete posts' });
      return;
    }

    const result = await pool.query(
      `DELETE FROM church_department_posts
       WHERE id = $1 AND department_id = $2 AND church_id = $3
       RETURNING id`,
      [postId, departmentId, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({ message: 'Post deleted', id: postId });
  } catch (err) {
    console.error('Delete dept post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

/**
 * GET /api/departments/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid department id' });
      return;
    }

    const result = await pool.query(
      `SELECT d.*,
              m.first_name AS leader_first_name,
              m.last_name AS leader_last_name,
              (
                SELECT COUNT(*)::int FROM church_department_members dm
                WHERE dm.department_id = d.id
              ) AS member_count
       FROM church_departments d
       LEFT JOIN church_members m ON m.id = d.leader_member_id
       WHERE d.id = $1 AND d.church_id = $2`,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    const members = await pool.query(
      `SELECT cm.id, cm.first_name, cm.last_name, cm.member_number, cm.phone,
              cm.membership_status, cm.avatar_url, dm.role
       FROM church_department_members dm
       JOIN church_members cm ON cm.id = dm.member_id
       WHERE dm.department_id = $1 AND dm.church_id = $2
       ORDER BY cm.last_name, cm.first_name`,
      [id, churchId]
    );

    const posts = await pool.query(
      `SELECT p.*,
              a.first_name AS author_first_name,
              a.last_name AS author_last_name
       FROM church_department_posts p
       LEFT JOIN church_members a ON a.id = p.author_member_id
       WHERE p.department_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      ...result.rows[0],
      members: members.rows,
      posts: posts.rows,
    });
  } catch (err) {
    console.error('Get department error:', err);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

/**
 * POST /api/departments
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const { name, description, leader_member_id } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    if (leader_member_id) {
      const member = await pool.query(
        'SELECT id FROM church_members WHERE id = $1 AND church_id = $2',
        [leader_member_id, churchId]
      );
      if (member.rows.length === 0) {
        res.status(404).json({ error: 'Leader member not found' });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO church_departments (church_id, name, description, leader_member_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [churchId, name, description || null, leader_member_id || null]
    );

    const dept = result.rows[0];
    if (leader_member_id) {
      await pool.query(
        `INSERT INTO church_department_members (church_id, department_id, member_id, role)
         VALUES ($1, $2, $3, 'leader')
         ON CONFLICT (department_id, member_id) DO UPDATE SET role = 'leader'`,
        [churchId, dept.id, leader_member_id]
      );
    }

    res.status(201).json(dept);
  } catch (err) {
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

/**
 * PUT /api/departments/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid department id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_departments WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body;

    if (b.leader_member_id) {
      const member = await pool.query(
        'SELECT id FROM church_members WHERE id = $1 AND church_id = $2',
        [b.leader_member_id, churchId]
      );
      if (member.rows.length === 0) {
        res.status(404).json({ error: 'Leader member not found' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE church_departments SET
         name = $1,
         description = $2,
         leader_member_id = $3
       WHERE id = $4 AND church_id = $5
       RETURNING *`,
      [
        b.name ?? cur.name,
        b.description !== undefined ? b.description : cur.description,
        b.leader_member_id !== undefined ? b.leader_member_id : cur.leader_member_id,
        id,
        churchId,
      ]
    );

    const leaderId =
      b.leader_member_id !== undefined ? b.leader_member_id : cur.leader_member_id;
    if (leaderId) {
      await pool.query(
        `INSERT INTO church_department_members (church_id, department_id, member_id, role)
         VALUES ($1, $2, $3, 'leader')
         ON CONFLICT (department_id, member_id) DO UPDATE SET role = 'leader'`,
        [churchId, id, leaderId]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

/**
 * DELETE /api/departments/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid department id' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM church_departments WHERE id = $1 AND church_id = $2 RETURNING id',
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    res.json({ message: 'Department deleted', id });
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

export default router;
