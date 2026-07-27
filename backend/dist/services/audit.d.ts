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
export declare function writeAudit(entry: AuditEntry): Promise<void>;
