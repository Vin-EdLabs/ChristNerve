"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
const db_1 = require("../db");
async function writeAudit(entry) {
    try {
        await db_1.pool.query(`INSERT INTO audit_logs (
         church_id, actor_type, actor_id, actor_name,
         action, entity_type, entity_id, summary, meta, ip_address
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [
            entry.churchId ?? null,
            entry.actorType || 'system',
            entry.actorId ?? null,
            entry.actorName ?? null,
            entry.action,
            entry.entityType ?? null,
            entry.entityId ?? null,
            entry.summary,
            JSON.stringify(entry.meta || {}),
            entry.ip ?? null,
        ]);
    }
    catch (err) {
        console.error('audit write failed:', err);
    }
}
//# sourceMappingURL=audit.js.map