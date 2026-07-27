import { FormEvent, useCallback, useEffect, useState } from 'react';
import { HeartHandshake, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

type Welfare = {
  id: number;
  title: string;
  description?: string;
  case_type: string;
  status: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
};

type MemberOpt = { id: number; first_name: string; last_name: string };

const TYPES = [
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'financial', label: 'Financial Need' },
  { value: 'other', label: 'Other' },
];

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export default function WelfarePage() {
  const { accountType } = useAuth();
  const isMember = accountType === 'member';
  const [tab, setTab] = useState(isMember ? 'all' : 'open');
  const [rows, setRows] = useState<Welfare[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    member_id: '',
    case_type: 'other',
    title: '',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'all' ? 'all' : tab;
      const res = isMember
        ? await api.get('/pastoral/welfare/mine', { params: { status } })
        : await api.get('/pastoral/welfare', { params: { status } });
      setRows(asList<Welfare>(res.data));
    } catch {
      toast.error('Failed to load welfare cases');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, isMember]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isMember) return;
    api
      .get('/members', { params: { limit: 100 } })
      .then((res) => setMembers(asList<MemberOpt>(res.data)))
      .catch(() => undefined);
  }, [isMember]);

  const update = async (id: number, body: Record<string, unknown>) => {
    try {
      await api.put(`/pastoral/welfare/${id}`, body);
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
        await api.post('/pastoral/welfare/mine', {
          case_type: form.case_type,
          title: form.title,
          description: form.description,
        });
        toast.success('Sent to the care team — they will reach out');
      } else {
        await api.post('/pastoral/welfare', {
          ...form,
          member_id: form.member_id ? Number(form.member_id) : null,
        });
        toast.success('Case created');
      }
      setOpen(false);
      setForm({ member_id: '', case_type: 'other', title: '', description: '' });
      setTab(isMember ? 'all' : 'open');
      await load();
    } catch {
      toast.error('Could not submit');
    } finally {
      setSaving(false);
    }
  };

  const tabs = isMember
    ? ['all', 'open', 'in_progress', 'closed']
    : ['open', 'in_progress', 'closed'];

  return (
    <div className="pastoral-page">
      <div
        className="page-head"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <h1 className="page-title">
            <HeartHandshake size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Welfare
          </h1>
          <p className="page-sub">
            {isMember
              ? 'Ask for practical care — hospital, bereavement, or financial need.'
              : 'Care cases for members in need.'}
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> {isMember ? 'Request care' : 'Add case'}
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
          title={isMember ? 'No care requests yet' : 'No welfare cases'}
          actionLabel={isMember ? 'Request care' : undefined}
          onAction={isMember ? () => setOpen(true) : undefined}
        />
      ) : (
        <div className="pastoral-list">
          {rows.map((r) => (
            <article key={r.id} className="card pastoral-card">
              <div className="pastoral-card-head">
                <strong>{r.title}</strong>
                <span className="role-chip">{r.case_type}</span>
              </div>
              {!isMember && (
                <p>
                  {(r.first_name || r.last_name)
                    ? `${r.first_name || ''} ${r.last_name || ''}`.trim()
                    : 'Unassigned member'}
                </p>
              )}
              {r.description && <p className="pastoral-meta">{r.description}</p>}
              {isMember ? (
                <span className="pastoral-meta">Status: {r.status.replace('_', ' ')}</span>
              ) : (
                <div className="pastoral-actions">
                  {r.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void update(r.id, { status: 'in_progress' })
                      }
                    >
                      Start care
                    </Button>
                  )}
                  {r.status !== 'closed' && (
                    <Button
                      size="sm"
                      onClick={() => void update(r.id, { status: 'closed' })}
                    >
                      Close case
                    </Button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={isMember ? 'Request welfare care' : 'New welfare case'}
      >
        <form onSubmit={create} className="users-cred-form">
          <Select
            label="Type"
            value={form.case_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, case_type: e.target.value }))
            }
            options={TYPES}
          />
          {!isMember && (
            <Select
              label="Member (optional)"
              value={form.member_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, member_id: e.target.value }))
              }
              placeholder="Select"
              options={members.map((m) => ({
                value: String(m.id),
                label: `${m.first_name} ${m.last_name}`,
              }))}
            />
          )}
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder={isMember ? 'How can the church support you?' : undefined}
          />
          <TextArea
            label="Description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
          />
          <Button type="submit" loading={saving}>
            {isMember ? 'Send to care team' : 'Save'}
          </Button>
        </form>
      </Modal>

      <style>{`
        .pastoral-list { display: flex; flex-direction: column; gap: 12px; }
        .pastoral-card { padding: 16px 18px; }
        .pastoral-card-head {
          display: flex; justify-content: space-between; gap: 12px; align-items: center;
          margin-bottom: 6px;
        }
        .pastoral-meta { font-size: 13px; color: var(--text-secondary); }
        .pastoral-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      `}</style>
    </div>
  );
}
