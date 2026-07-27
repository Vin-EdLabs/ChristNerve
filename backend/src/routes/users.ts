import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { writeAudit } from '../services/audit';

const router = Router();
const ROLES = ['pastor', 'admin', 'finance', 'secretary'] as const;

router.use(requireChurchTenant, requireChurchAuth);

function requireStaffAdmin(req: Request, res: Response): boolean {
  if (req.accountType === 'member') {
    res.status(403).json({ error: 'Staff only' });
    return false;
  }
  const role = String(req.churchUser?.role || '').toLowerCase();
  if (!['pastor', 'admin', 'super-admin'].includes(role)) {
    res.status(403).json({ error: 'Only pastors and admins can manage users' });
    return false;
  }
  return true;
}

/**
 * GET /api/users/audit/feed — church audit feed (must stay before /:id)
 */
router.get('/audit/feed', async (req: Request, res: Response) => {
  try {
    if (req.accountType === 'member') {
      res.status(403).json({ error: 'Staff only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const result = await pool.query(
      `SELECT * FROM audit_logs
       WHERE church_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [churchId, limit]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Church audit error:', err);
    res.status(500).json({
      error:
        'Failed to fetch audit log. If this persists, run the audit migration.',
    });
  }
});

/**
 * GET /api/users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.accountType === 'member') {
      res.status(403).json({ error: 'Staff only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT id, church_id, first_name, last_name, email, phone, role,
              avatar_url, is_active, last_login, created_at, member_id
       FROM church_users
       WHERE church_id = $1
       ORDER BY
         CASE role
           WHEN 'pastor' THEN 0
           WHEN 'admin' THEN 1
           WHEN 'finance' THEN 2
           ELSE 3
         END,
         first_name`,
      [churchId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/users
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!requireStaffAdmin(req, res)) return;
    const churchId = req.churchTenant!.id;
    const actor = req.churchUser!;
    const { first_name, last_name, email, phone, role, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      res.status(400).json({ error: 'first_name, last_name, email, password required' });
      return;
    }

    const nextRole = ROLES.includes(role) ? role : 'secretary';
    const hash = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `INSERT INTO church_users (
         church_id, first_name, last_name, email, phone, role, password_hash
       ) VALUES ($1,$2,$3,LOWER($4),$5,$6,$7)
       RETURNING id, church_id, first_name, last_name, email, phone, role,
                 avatar_url, is_active, last_login, created_at`,
      [churchId, first_name, last_name, email, phone || null, nextRole, hash]
    );

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: actor.id,
      actorName: `${actor.first_name} ${actor.last_name}`,
      action: 'user.create',
      entityType: 'church_user',
      entityId: result.rows[0].id,
      summary: `Created user ${email} as ${nextRole}`,
    });

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(409).json({ error: 'Email already exists for this church' });
      return;
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/users/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!requireStaffAdmin(req, res)) return;
    const churchId = req.churchTenant!.id;
    const actor = req.churchUser!;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_users WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body;
    const nextRole =
      b.role && ROLES.includes(b.role) ? b.role : cur.role;

    let passwordHash = cur.password_hash;
    if (b.password) {
      passwordHash = await bcrypt.hash(String(b.password), 10);
    }

    const result = await pool.query(
      `UPDATE church_users SET
         first_name = $1,
         last_name = $2,
         email = LOWER($3),
         phone = $4,
         role = $5,
         is_active = $6,
         password_hash = $7
       WHERE id = $8 AND church_id = $9
       RETURNING id, church_id, first_name, last_name, email, phone, role,
                 avatar_url, is_active, last_login, created_at`,
      [
        b.first_name ?? cur.first_name,
        b.last_name ?? cur.last_name,
        b.email ?? cur.email,
        b.phone !== undefined ? b.phone : cur.phone,
        nextRole,
        b.is_active !== undefined ? Boolean(b.is_active) : cur.is_active,
        passwordHash,
        id,
        churchId,
      ]
    );

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: actor.id,
      actorName: `${actor.first_name} ${actor.last_name}`,
      action: 'user.update',
      entityType: 'church_user',
      entityId: id,
      summary: `Updated user ${result.rows[0].email} (role: ${nextRole})`,
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * POST /api/users/promote-member
 * Create a staff login linked to an existing member (dual role).
 * Body: { member_id, email, password, role?, phone? }
 */
router.post('/promote-member', async (req: Request, res: Response) => {
  try {
    if (!requireStaffAdmin(req, res)) return;
    const churchId = req.churchTenant!.id;
    const actor = req.churchUser!;
    const { member_id, email, password, role, phone } = req.body;

    if (!member_id || !email || !password) {
      res.status(400).json({
        error: 'member_id, email, and password are required',
      });
      return;
    }

    const member = await pool.query(
      `SELECT * FROM church_members WHERE id = $1 AND church_id = $2`,
      [member_id, churchId]
    );
    if (member.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const m = member.rows[0];
    const linked = await pool.query(
      `SELECT id FROM church_users WHERE church_id = $1 AND member_id = $2`,
      [churchId, member_id]
    );
    if (linked.rows.length > 0) {
      res.status(409).json({
        error: 'This member is already linked to a staff account',
        user_id: linked.rows[0].id,
      });
      return;
    }

    const nextRole = ROLES.includes(role) ? role : 'secretary';
    const hash = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `INSERT INTO church_users (
         church_id, first_name, last_name, email, phone, role, password_hash, member_id
       ) VALUES ($1,$2,$3,LOWER($4),$5,$6,$7,$8)
       RETURNING id, church_id, first_name, last_name, email, phone, role,
                 avatar_url, is_active, last_login, created_at, member_id`,
      [
        churchId,
        m.first_name,
        m.last_name,
        email,
        phone || m.phone || null,
        nextRole,
        hash,
        member_id,
      ]
    );

    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: actor.id,
      actorName: `${actor.first_name} ${actor.last_name}`,
      action: 'user.promote_member',
      entityType: 'church_user',
      entityId: result.rows[0].id,
      summary: `Promoted member ${m.first_name} ${m.last_name} to staff (${nextRole})`,
    });

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(409).json({ error: 'Email already exists for this church' });
      return;
    }
    console.error('Promote member error:', err);
    res.status(500).json({ error: 'Failed to promote member' });
  }
});

export default router;
