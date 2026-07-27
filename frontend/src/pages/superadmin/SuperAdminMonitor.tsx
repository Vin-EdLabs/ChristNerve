import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSuperAdmin } from './SuperAdminLayout';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { NotificationPrompt } from '../../components/notifications/NotificationPrompt';
import { isFcmConfigured } from '../../lib/firebase';

interface AuditRow {
  id: number;
  church_id?: number | null;
  church_name?: string | null;
  action: string;
  summary: string;
  actor_name?: string | null;
  actor_type?: string;
  entity_type?: string | null;
  entity_id?: number | null;
  created_at: string;
}

interface NotifHealth {
  platform_device_tokens?: number;
  church_device_tokens?: number;
  notifications_24h?: number;
  fcm_configured?: boolean;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export default function SuperAdminMonitor() {
  const { refresh } = useSuperAdmin();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [health, setHealth] = useState<NotifHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [auditRes, healthRes] = await Promise.allSettled([
        api.get('/superadmin/audit', { params: { limit: 120 } }),
        api.get('/superadmin/notifications/health'),
      ]);
      if (auditRes.status === 'fulfilled') {
        setRows(asList<AuditRow>(auditRes.value.data));
      }
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data);
      }
    } catch {
      toast.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void refresh();
  }, [load, refresh]);

  const fcmOk = health?.fcm_configured ?? isFcmConfigured();

  return (
    <div className="sa-view sa-monitor">
      <NotificationPrompt mode="platform" />

      <div className="sa-page-head">
        <div className="sa-page-head-icon">
          <Activity size={22} />
        </div>
        <div>
          <h2 className="sa-section-title">Platform Monitor</h2>
          <p className="sa-section-sub">
            Global audit trail and notification health across all churches.
          </p>
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

      <div className="sa-stats sa-stats--4">
        <div className="sa-kpi">
          <span className="sa-kpi-label">FCM / Push</span>
          <strong className="sa-kpi-value" style={{ fontSize: 18 }}>
            {fcmOk ? 'Connected' : 'Needs setup'}
          </strong>
          <span className="sa-muted">
            {fcmOk ? 'Web push ready' : 'Add VAPID key'}
          </span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-label">Church devices</span>
          <strong className="sa-kpi-value">{health?.church_device_tokens ?? '—'}</strong>
          <span className="sa-muted">Tokens</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-label">Platform devices</span>
          <strong className="sa-kpi-value">{health?.platform_device_tokens ?? '—'}</strong>
          <span className="sa-muted">Superadmin</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-label">Notifs (24h)</span>
          <strong className="sa-kpi-value">{health?.notifications_24h ?? '—'}</strong>
          <span className="sa-muted">Network-wide</span>
        </div>
      </div>

      <h3 className="sa-reg-section-title">Global audit trail</h3>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No platform events yet"
          description="Church and admin actions will appear in this table."
        />
      ) : (
        <div className="audit-table-shell">
          <table className="audit-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Church</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Summary</th>
                <th>Entity</th>
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
                  <td data-label="Church">
                    {r.church_name || (r.church_id ? `#${r.church_id}` : 'Platform')}
                  </td>
                  <td data-label="Actor">
                    {r.actor_name || r.actor_type || 'System'}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
