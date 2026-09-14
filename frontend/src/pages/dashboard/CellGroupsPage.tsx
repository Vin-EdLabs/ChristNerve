import { FormEvent, useState } from 'react';
import { Calendar, MapPin, Plus, Users, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useCachedQuery } from '../../utils/useCachedQuery';

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

type MemberOpt = { id: number; first_name: string; last_name: string; avatar_url?: string | null };

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function initialsOf(first?: string, last?: string): string {
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || '?';
}

export default function CellGroupsPage() {
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

  const { data: rows = [], loading, refetch: refetchGroups } = useCachedQuery<CellGroup[]>(
    'cell-groups',
    async () => {
      try {
        const res = await api.get('/pastoral/cell-groups');
        return asList<CellGroup>(res.data);
      } catch {
        toast.error('Failed to load cell groups');
        return [];
      }
    }
  );

  const { data: members = [] } = useCachedQuery<MemberOpt[]>(
    'cell-group-leader-options',
    async () => {
      try {
        const res = await api.get('/members', { params: { limit: 100, status: 'active' } });
        return asList<MemberOpt>(res.data);
      } catch {
        return [];
      }
    }
  );

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
      refetchGroups();
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
      refetchGroups();
      if (detail?.id === id) await openDetail(id);
    } catch {
      toast.error('Could not record');
    }
  };

  return (
    <div className="pastoral-page cg-page">
      <div className="page-head">
        <div className="page-head-icon">
          <UsersRound size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="page-head-title">Cell Groups</h1>
          <p className="page-head-sub">Small groups that keep the church family close.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add group
        </Button>
      </div>

      {loading ? (
        <div className="cg-skeleton-row">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UsersRound size={22} />}
          title="No cell groups yet"
          description="Create your first group."
          actionLabel="Add group"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="cell-grid">
          {rows.map((g) => {
            const leaderName = (g.leader_first_name || g.leader_last_name)
              ? `${g.leader_first_name || ''} ${g.leader_last_name || ''}`.trim()
              : null;
            return (
              <article key={g.id} className="cell-card">
                <div className="cell-card-top">
                  <span className="cell-card-avatar">{initialsOf(g.leader_first_name, g.leader_last_name) || <UsersRound size={18} />}</span>
                  <div className="cell-card-head">
                    <h3>{g.name}</h3>
                    <span className="cell-card-leader">{leaderName ? `Led by ${leaderName}` : 'No leader assigned'}</span>
                  </div>
                </div>

                <div className="cell-card-meta">
                  <span><Users size={13} /> {g.member_count ?? 0} members</span>
                  {(g.meeting_day || g.meeting_time) && (
                    <span>
                      <Calendar size={13} /> {[g.meeting_day, g.meeting_time].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {g.location && (
                    <span><MapPin size={13} /> {g.location}</span>
                  )}
                </div>

                {g.last_meeting_at && (
                  <p className="cell-card-last">
                    Last meeting {new Date(g.last_meeting_at).toLocaleDateString('en-GH')}
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
            );
          })}
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
          <EmptyState title="No members linked yet" description="Add members to this group from the members page." />
        ) : (
          <div className="cg-roster">
            {(detail?.members || []).map((m) => {
              const img = resolveMediaUrl(m.avatar_url);
              return (
                <article key={m.id} className="cg-roster-card">
                  {img ? <img src={img} alt="" /> : <span className="cg-roster-fallback">{initialsOf(m.first_name, m.last_name)}</span>}
                  <strong>{m.first_name} {m.last_name}</strong>
                </article>
              );
            })}
          </div>
        )}
      </Modal>

      <style>{`
        .cg-page { display: flex; flex-direction: column; gap: 18px; }
        .cg-skeleton-row { display: flex; flex-direction: column; gap: 10px; }
        .cell-grid {
          display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
        .cell-card {
          padding: 16px; border-radius: var(--radius-md);
          border: 1px solid var(--border); background: var(--bg-primary);
          display: flex; flex-direction: column; gap: 12px;
        }
        .cell-card-top { display: flex; align-items: center; gap: 12px; }
        .cell-card-avatar {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          display: grid; place-items: center; background: var(--accent-light);
          color: var(--accent); font-weight: 700; font-size: 14px;
        }
        .cell-card-head { min-width: 0; }
        .cell-card-head h3 { margin: 0; font-size: 16px; font-weight: 700; }
        .cell-card-leader { font-size: 12px; color: var(--text-muted); }
        .cell-card-meta { display: flex; flex-direction: column; gap: 5px; }
        .cell-card-meta span {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--text-secondary);
        }
        .cell-card-last { margin: 0; font-size: 11px; color: var(--text-muted); }
        .pastoral-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
        .cg-roster {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;
        }
        .cg-roster-card {
          display: flex; align-items: center; gap: 10px;
          border: 1px solid var(--border); border-radius: 12px; padding: 10px;
        }
        .cg-roster-card img, .cg-roster-fallback {
          width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
          background: var(--accent-light); color: var(--accent);
          display: grid; place-items: center; font-weight: 700; font-size: 12px;
          flex-shrink: 0;
        }
        .cg-roster-card strong { font-size: 13px; }
        @media (max-width: 480px) {
          .cell-grid { grid-template-columns: 1fr; }
          .pastoral-actions { flex-direction: column; }
          .pastoral-actions button { width: 100%; }
          .cg-roster { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
