"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const churchTenant_1 = require("../middleware/churchTenant");
const router = (0, express_1.Router)();
router.use(churchTenant_1.requireChurchTenant, churchAuth_1.requireChurchAuth);
/**
 * GET /api/audit — church activity feed (staff + finance)
 */
router.get('/', async (req, res) => {
    try {
        if (req.accountType === 'member') {
            res.status(403).json({ error: 'Staff only' });
            return;
        }
        const churchId = req.churchTenant.id;
        const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
        const result = await db_1.pool.query(`SELECT id, church_id, actor_type, actor_id, actor_name, action,
              entity_type, entity_id, summary, meta, ip_address, created_at
       FROM audit_logs
       WHERE church_id = $1
       ORDER BY created_at DESC
       LIMIT $2`, [churchId, limit]);
        res.json({ data: result.rows });
    }
    catch (err) {
        console.error('Church audit error:', err);
        res.status(500).json({
            error: 'Failed to fetch audit log. If this persists, run the audit migration.',
        });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map