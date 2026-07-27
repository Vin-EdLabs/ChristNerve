import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

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
                SELECT COUNT(*)::int FROM church_members cm
                WHERE cm.church_id = d.church_id
                  AND cm.department ILIKE d.name
                  AND cm.membership_status = 'active'
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
 * GET /api/departments/mine — member's department details
 */
router.get('/mine', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;

    if (req.accountType !== 'member') {
      res.status(403).json({ error: 'Members only' });
      return;
    }

    const member = await pool.query(
      `SELECT department, ministry, cell_group, membership_date
       FROM church_members WHERE id = $1 AND church_id = $2`,
      [req.churchUser!.id, churchId]
    );

    if (member.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const profile = member.rows[0];
    let department = null;

    if (profile.department) {
      const dept = await pool.query(
        `SELECT d.*,
                m.first_name AS leader_first_name,
                m.last_name AS leader_last_name,
                (
                  SELECT COUNT(*)::int FROM church_members cm
                  WHERE cm.church_id = d.church_id
                    AND cm.department ILIKE d.name
                    AND cm.membership_status = 'active'
                ) AS member_count
         FROM church_departments d
         LEFT JOIN church_members m ON m.id = d.leader_member_id
         WHERE d.church_id = $1 AND d.name ILIKE $2
         LIMIT 1`,
        [churchId, profile.department]
      );
      department = dept.rows[0] || {
        name: profile.department,
        description: null,
        member_count: null,
      };
    }

    res.json({
      department,
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
              m.last_name AS leader_last_name
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
      `SELECT id, first_name, last_name, member_number, phone, membership_status
       FROM church_members
       WHERE church_id = $1 AND department ILIKE $2
       ORDER BY last_name, first_name`,
      [churchId, result.rows[0].name]
    );

    res.json({ ...result.rows[0], members: members.rows });
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

    res.status(201).json(result.rows[0]);
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
