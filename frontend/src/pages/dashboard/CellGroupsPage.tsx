import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';

type CellGroup = {
  id: number;
  name: string;
  leader_first_name?: string;
  leader_last_name?: string;
  member_count?: number;
  meeting_day?: string;
  meeting_time?: string;
  location?: string;
  last_meeting_at?: string;
  next_meeting_at?: string;
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

export default function CellGroupsPage() {
  const [rows, setRows] = useState<CellGroup[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<(CellGroup & { members?: MemberOpt[] }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    leader_member_id: '',
    meeting_day: '',
    meeting_time: '',
    location: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pastoral/cell-groups');
      setRows(asList<CellGroup>(res.data));
    } catch {
      toast.error('Failed to load cell groups');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api
      .get('/members', { params: { limit: 100, status: 'active' } })
      .then((res) => setMembers(asList<MemberOpt>(res.data)))
      .catch(() => undefined);
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pastoral/cell-groups', {
        ...form,
        leader_member_id: form.leader_member_id
          ? Number(form.leader_member_id)
          : null,
      });
      toast.success('Cell group created');
      setOpen(false);
      setForm({
        name: '',
        leader_member_id: '',
        meeting_day: '',
        meeting_time: '',
        location: '',
      });
      await load();
    } catch {
      toast.error('Could not create');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: number) => {
    try {
      const res = await api.get(`/pastoral/cell-groups/${id}`);
      setDetail(res.data);
    } catch {
      toast.error('Could not load group');
    }
  };

  const recordMeeting = async (id: number) => {
    try {
      await api.put(`/pastoral/cell-groups/${id}`, {
        last_meeting_at: new Date().toISOString(),
      });
      toast.success('Meeting recorded');
      await load();
      if (detail?.id === id) await openDetail(id);
    } catch {
      toast.error('Could not record');
    }
  };

  return (
    <div className="pastoral-page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">
            <UsersRound size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Cell Groups
          </h1>
          <p className="page-sub">Small groups that keep the church family close.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add group
        </Button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState title="No cell groups yet" description="Create your first group." />
      ) : (
        <div className="cell-grid">
          {rows.map((g) => (
            <article key={g.id} className="card cell-card">
              <h3>{g.name}</h3>
              <p>
                Leader:{' '}
                {(g.leader_first_name || g.leader_last_name)
                  ? `${g.leader_first_name || ''} ${g.leader_last_name || ''}`.trim()
                  : '—'}
              </p>
              <p>{g.member_count ?? 0} members</p>
              {(g.meeting_day || g.meeting_time) && (
                <p className="pastoral-meta">
                  Meets {g.meeting_day || ''} {g.meeting_time || ''}
                  {g.location ? ` · ${g.location}` : ''}
                </p>
              )}
              {g.last_meeting_at && (
                <p className="pastoral-meta">
                  Last meeting:{' '}
                  {new Date(g.last_meeting_at).toLocaleDateString('en-GH')}
                </p>
              )}
              <div className="pastoral-actions">
                <Button size="sm" variant="outline" onClick={() => void openDetail(g.id)}>
                  View members
                </Button>
                <Button size="sm" onClick={() => void recordMeeting(g.id)}>
                  Record meeting
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New cell group">
        <form onSubmit={create} className="users-cred-form">
          <Input
            label="Group name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Select
            label="Leader"
            value={form.leader_member_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, leader_member_id: e.target.value }))
            }
            placeholder="Select"
            options={members.map((m) => ({
              value: String(m.id),
              label: `${m.first_name} ${m.last_name}`,
            }))}
          />
          <div className="form-row">
            <Input
              label="Meeting day"
              value={form.meeting_day}
              onChange={(e) =>
                setForm((f) => ({ ...f, meeting_day: e.target.value }))
              }
              placeholder="Wednesday"
            />
            <Input
              label="Time"
              type="time"
              value={form.meeting_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, meeting_time: e.target.value }))
              }
            />
          </div>
          <Input
            label="Location"
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
          <Button type="submit" loading={saving}>
            Create
          </Button>
        </form>
      </Modal>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Cell group'}
      >
        {(detail?.members || []).length === 0 ? (
          <p className="pastoral-meta">No members linked yet.</p>
        ) : (
          <ul className="cell-members">
            {(detail?.members || []).map((m) => (
              <li key={m.id}>
                {m.first_name} {m.last_name}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <style>{`
        .cell-grid {
          display: grid; gap: 12px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .cell-card { padding: 16px; }
        .cell-card h3 { margin: 0 0 8px; font-size: 17px; }
        .cell-card p { margin: 0 0 4px; font-size: 13px; }
        .pastoral-meta { color: var(--text-muted); font-size: 12px !important; }
        .pastoral-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .cell-members { list-style: none; margin: 0; padding: 0; }
        .cell-members li {
          padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 14px;
        }
      `}</style>
    </div>
  );
}
