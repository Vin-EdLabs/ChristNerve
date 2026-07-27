import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

/**
 * GET /api/audit — church activity feed (staff + finance)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.accountType === 'member') {
      res.status(403).json({ error: 'Staff only' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

    const result = await pool.query(
      `SELECT id, church_id, actor_type, actor_id, actor_name, action,
              entity_type, entity_id, summary, meta, ip_address, created_at
       FROM audit_logs
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

export default router;
