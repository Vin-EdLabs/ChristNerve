import { pool } from '../db';

export interface AuditEntry {
  churchId?: number | null;
  actorType?: 'staff' | 'member' | 'superadmin' | 'system';
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs (
         church_id, actor_type, actor_id, actor_name,
         action, entity_type, entity_id, summary, meta, ip_address
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [
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
      ]
    );
  } catch (err) {
    console.error('audit write failed:', err);
  }
}
