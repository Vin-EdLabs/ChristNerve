import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, UserRoundSearch } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { TextArea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type FollowUp = {
  id: number;
  reason: string;
  status: string;
  notes?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  assignee_first?: string;
  assignee_last?: string;
  created_at?: string;
};

type MemberOpt = { id: number; first_name: string; last_name: string };

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export default function FollowUpPage() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ member_id: '', reason: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pastoral/follow-ups', {
        params: { status: tab },
      });
      setRows(asList<FollowUp>(res.data));
    } catch {
      toast.error('Failed to load follow-ups');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get('/members', { params: { limit: 100, status: 'active' } })
      .then((res) => setMembers(asList<MemberOpt>(res.data)))
      .catch(() => undefined);
  }, []);

  const update = async (id: number, body: Record<string, unknown>) => {
    try {
      await api.put(`/pastoral/follow-ups/${id}`, body);
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
      await api.post('/pastoral/follow-ups', {
        member_id: Number(form.member_id),
        reason: form.reason,
      });
      toast.success('Follow-up added');
      setOpen(false);
      setForm({ member_id: '', reason: '' });
      setTab('pending');
      await load();
    } catch {
      toast.error('Could not add');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pastoral-page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">
            <UserRoundSearch size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Member Follow-Up
          </h1>
          <p className="page-sub">Reach members who need a pastoral call.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add follow-up
        </Button>
      </div>

      <div className="page-tabs">
        {['pending', 'completed', 'visitor'].map((t) => (
          <button
            key={t}
            type="button"
            className={`page-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState title="No follow-ups here" />
      ) : (
        <div className="pastoral-list">
          {rows.map((r) => {
            const img = resolveMediaUrl(r.avatar_url);
            const initials =
              `${r.first_name?.[0] || ''}${r.last_name?.[0] || ''}`.toUpperCase();
            return (
              <article key={r.id} className="card pastoral-card pastoral-follow">
                {img ? (
                  <img src={img} alt="" className="pastoral-avatar" />
                ) : (
                  <span className="pastoral-avatar pastoral-avatar--fb">
                    {initials}
                  </span>
                )}
                <div style={{ flex: 1 }}>
                  <strong>
                    {r.first_name} {r.last_name}
                  </strong>
                  <p>{r.reason}</p>
                  {(r.assignee_first || r.assignee_last) && (
                    <span className="pastoral-meta">
                      Assigned to: {r.assignee_first} {r.assignee_last}
                    </span>
                  )}
                  <div className="pastoral-actions" style={{ marginTop: 10 }}>
                    {r.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          void update(r.id, { status: 'completed' })
                        }
                      >
                        Mark contacted
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const note = window.prompt('Add note', r.notes || '');
                        if (note != null) void update(r.id, { notes: note });
                      }}
                    >
                      Add note
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add follow-up">
        <form onSubmit={create} className="users-cred-form">
          <Select
            label="Member"
            value={form.member_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, member_id: e.target.value }))
            }
            required
            options={members.map((m) => ({
              value: String(m.id),
              label: `${m.first_name} ${m.last_name}`,
            }))}
          />
          <TextArea
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            required
            rows={3}
          />
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </form>
      </Modal>

      <style>{`
        .pastoral-list { display: flex; flex-direction: column; gap: 12px; }
        .pastoral-card { padding: 16px 18px; }
        .pastoral-follow { display: flex; gap: 14px; align-items: flex-start; }
        .pastoral-avatar {
          width: 44px; height: 44px; border-radius: 50%; object-fit: cover;
          flex-shrink: 0;
        }
        .pastoral-avatar--fb {
          display: grid; place-items: center; background: var(--accent-light);
          color: var(--accent); font-weight: 700; font-size: 13px;
        }
        .pastoral-meta { font-size: 12px; color: var(--text-muted); }
        .pastoral-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      `}</style>
    </div>
  );
}
