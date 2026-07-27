import { FormEvent, useCallback, useEffect, useState } from 'react';
import { HandHeart, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { TextArea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

type Prayer = {
  id: number;
  request: string;
  status: string;
  is_anonymous?: boolean;
  first_name?: string;
  last_name?: string;
  created_at?: string;
  response?: string | null;
  assignee_first?: string;
  assignee_last?: string;
};

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export default function PrayerRequestsPage() {
  const { accountType } = useAuth();
  const isMember = accountType === 'member';
  const [tab, setTab] = useState(isMember ? 'all' : 'pending');
  const [rows, setRows] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    request: '',
    is_anonymous: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = isMember
        ? await api.get('/pastoral/prayer-requests/mine', {
            params: { status: tab === 'all' ? 'all' : tab },
          })
        : await api.get('/pastoral/prayer-requests', {
            params: { status: tab },
          });
      setRows(asList<Prayer>(res.data));
    } catch {
      toast.error('Failed to load prayer requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, isMember]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (id: number, body: Record<string, unknown>) => {
    try {
      await api.put(`/pastoral/prayer-requests/${id}`, body);
      toast.success('Updated');
      await load();
    } catch {
      toast.error('Could not update');
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isMember) {
        await api.post('/pastoral/prayer-requests/mine', {
          request: form.request,
          is_anonymous: form.is_anonymous,
        });
        toast.success('Sent to your pastors — they will pray with you');
      } else {
        await api.post('/pastoral/prayer-requests', {
          request: form.request,
          is_anonymous: form.is_anonymous,
        });
        toast.success('Prayer request added');
      }
      setOpen(false);
      setForm({ request: '', is_anonymous: false });
      setTab(isMember ? 'all' : 'pending');
      await load();
    } catch {
      toast.error('Could not submit');
    } finally {
      setSaving(false);
    }
  };

  const tabs = isMember
    ? ['all', 'pending', 'in_progress', 'answered']
    : ['pending', 'in_progress', 'answered'];

  return (
    <div className="pastoral-page">
      <div
        className="page-head"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1 className="page-title">
            <HandHeart size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Prayer Requests
          </h1>
          <p className="page-sub">
            {isMember
              ? 'Share what is on your heart — your pastors will pray with you.'
              : 'Care for your congregation through prayer.'}
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> {isMember ? 'Send prayer request' : 'Add request'}
        </Button>
      </div>

      <div className="page-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`page-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'in_progress'
              ? 'In Progress'
              : t === 'all'
                ? 'All'
                : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState
          title={isMember ? 'No prayer requests yet' : 'No requests in this tab'}
          description={
            isMember
              ? 'Tap “Send prayer request” when you need the church to stand with you.'
              : undefined
          }
          actionLabel={isMember ? 'Send prayer request' : undefined}
          onAction={isMember ? () => setOpen(true) : undefined}
        />
      ) : (
        <div className="pastoral-list">
          {rows.map((r) => (
            <article key={r.id} className="card pastoral-card">
              <div className="pastoral-card-head">
                <strong>
                  {isMember
                    ? r.status.replace('_', ' ')
                    : r.is_anonymous
                      ? 'Anonymous'
                      : `${r.first_name || ''} ${r.last_name || ''}`.trim() ||
                        'Member'}
                </strong>
                <span>
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString('en-GH')
                    : ''}
                </span>
              </div>
              <p>{r.request}</p>
              {r.response && (
                <p className="pastoral-response">Pastor note: {r.response}</p>
              )}
              {!isMember && (
                <div className="pastoral-actions">
                  {r.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void update(r.id, { status: 'in_progress' })
                      }
                    >
                      Mark in progress
                    </Button>
                  )}
                  {r.status !== 'answered' && (
                    <Button
                      size="sm"
                      onClick={() => void update(r.id, { status: 'answered' })}
                    >
                      Mark answered
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void update(r.id, { is_anonymous: !r.is_anonymous })
                    }
                  >
                    {r.is_anonymous ? 'Show name' : 'Private'}
                  </Button>
                </div>
              )}
              {isMember && (
                <span className={`prayer-status prayer-status--${r.status}`}>
                  {r.status === 'answered'
                    ? 'Answered'
                    : r.status === 'in_progress'
                      ? 'Being prayed for'
                      : 'With your pastors'}
                </span>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isMember ? 'Send a prayer request' : 'Add prayer request'}
      >
        <form onSubmit={create} className="users-cred-form">
          <TextArea
            label={isMember ? 'What can we pray for?' : 'Request'}
            value={form.request}
            onChange={(e) => setForm((f) => ({ ...f, request: e.target.value }))}
            required
            rows={4}
            placeholder={
              isMember
                ? 'Write freely — only your pastoral team will see this.'
                : undefined
            }
          />
          <label
            className="field"
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={form.is_anonymous}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_anonymous: e.target.checked }))
              }
            />
            Keep anonymous from the wider team
          </label>
          <Button type="submit" loading={saving}>
            {isMember ? 'Send to pastors' : 'Save'}
          </Button>
        </form>
      </Modal>

      <style>{`
        .pastoral-list { display: flex; flex-direction: column; gap: 12px; }
        .pastoral-card { padding: 16px 18px; }
        .pastoral-card-head {
          display: flex; justify-content: space-between; gap: 12px;
          margin-bottom: 8px; font-size: 13px;
        }
        .pastoral-card-head span { color: var(--text-muted); }
        .pastoral-card p { margin: 0 0 12px; font-size: 14px; line-height: 1.5; }
        .pastoral-response {
          font-size: 13px !important;
          color: var(--text-secondary);
          background: var(--accent-light, #ede8fa);
          padding: 10px 12px;
          border-radius: 10px;
        }
        .pastoral-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .prayer-status {
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          text-transform: capitalize;
        }
      `}</style>
    </div>
  );
}
