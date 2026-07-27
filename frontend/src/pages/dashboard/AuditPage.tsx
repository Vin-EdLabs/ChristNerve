import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';

interface AuditRow {
  id: number;
  action: string;
  summary: string;
  actor_name?: string | null;
  actor_type?: string;
  actor_id?: number | null;
  entity_type?: string | null;
  entity_id?: number | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function metaPreview(meta: AuditRow['meta']): string {
  if (!meta || typeof meta !== 'object') return '—';
  if (Object.keys(meta).length === 0) return '—';
  try {
    const text = JSON.stringify(meta);
    return text.length > 64 ? `${text.slice(0, 61)}…` : text;
  } catch {
    return '—';
  }
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', { params: { limit: 200 } });
      setRows(asList<AuditRow>(res.data));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to load audit log';
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="audit-page">
      <div className="page-head audit-page-head">
        <div>
          <h1 className="page-title">Church Audit</h1>
          <p className="page-sub">Who did what, on which record, and when.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Staff actions across the church will appear in this table."
        />
      ) : (
        <div className="audit-table-shell">
          <table className="audit-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="When">
                    {new Date(r.created_at).toLocaleString('en-GH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td data-label="Actor">
                    <strong>{r.actor_name || 'System'}</strong>
                    <span className="audit-muted">
                      {' '}
                      · {r.actor_type || 'system'}
                    </span>
                  </td>
                  <td data-label="Action">
                    <code>{r.action}</code>
                  </td>
                  <td data-label="Summary">{r.summary}</td>
                  <td data-label="Entity">
                    {r.entity_type
                      ? `${r.entity_type}${r.entity_id != null ? ` #${r.entity_id}` : ''}`
                      : '—'}
                  </td>
                  <td data-label="Details" title={metaPreview(r.meta)}>
                    {metaPreview(r.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
