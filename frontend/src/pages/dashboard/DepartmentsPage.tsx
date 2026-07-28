import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Megaphone,
  Network,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { ChurchDepartment } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type DeptListItem = ChurchDepartment & {
  leader_first_name?: string;
  leader_last_name?: string;
  member_count?: number;
};

type DeptMember = {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  role?: string;
  member_number?: string;
};

type DeptPost = {
  id: number;
  title: string;
  body: string;
  post_type?: string;
  meeting_at?: string | null;
  location?: string | null;
  created_at?: string;
  author_first_name?: string;
  author_last_name?: string;
};

type DeptDetail = DeptListItem & {
  members?: DeptMember[];
  posts?: DeptPost[];
};

type MemberOption = {
  id: number;
  first_name: string;
  last_name: string;
};

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

const DEPT_COLORS = [
  '#2d1b69',
  '#1a5f4a',
  '#8b4513',
  '#1e4a7a',
  '#7a1e4a',
  '#4a1e7a',
];

function deptColor(id: number) {
  return DEPT_COLORS[id % DEPT_COLORS.length];
}

function leaderName(d: DeptListItem) {
  return `${d.leader_first_name || ''} ${d.leader_last_name || ''}`.trim();
}

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DeptListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DeptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [leaderId, setLeaderId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      setDepartments(asList<DeptListItem>(res.data));
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const [deptRes, membersRes] = await Promise.all([
        api.get(`/departments/${id}`),
        api.get('/members', { params: { status: 'active', limit: 100 } }),
      ]);
      setDetail(deptRes.data as DeptDetail);
      setEditForm({
        name: deptRes.data.name || '',
        description: deptRes.data.description || '',
      });
      setLeaderId(
        deptRes.data.leader_member_id ? String(deptRes.data.leader_member_id) : ''
      );
      setMemberOptions(asList<MemberOption>(membersRes.data));
    } catch {
      toast.error('Could not load department');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const totalMembers = useMemo(
    () => departments.reduce((sum, d) => sum + (d.member_count || 0), 0),
    [departments]
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/departments', {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Department created');
      setOpen(false);
      setName('');
      setDescription('');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not create department';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/departments/${selectedId}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        leader_member_id: leaderId ? Number(leaderId) : null,
      });
      toast.success('Department updated');
      setEditing(false);
      await load();
      await loadDetail(selectedId);
    } catch {
      toast.error('Could not update department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !detail) return;
    if (!confirm(`Delete "${detail.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/departments/${selectedId}`);
      toast.success('Department removed');
      setSelectedId(null);
      await load();
    } catch {
      toast.error('Could not delete department');
    }
  };

  if (loading) {
    return (
      <div className="dept-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="dept-page">
      <div className="dept-hero">
        <div>
          <p className="dept-kicker">Congregation</p>
          <h2 className="page-heading">Departments</h2>
          <p className="dept-hero-sub">
            {departments.length} teams · {totalMembers} members across all
            departments
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          Create Department
        </Button>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet."
          description="Organise Choir, Ushering, Youth, Media, and more."
          actionLabel="Create Department"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="dept-grid">
          {departments.map((d) => {
            const color = deptColor(d.id);
            const leader = leaderName(d);
            return (
              <button
                key={d.id}
                type="button"
                className={`dept-card${selectedId === d.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(d.id)}
                style={{ '--dept-accent': color } as React.CSSProperties}
              >
                <div className="dept-card-icon">
                  <Network size={22} />
                </div>
                <div className="dept-card-body">
                  <h3>{d.name}</h3>
                  <p>{d.description || 'Tap to view team & updates'}</p>
                  <div className="dept-card-meta">
                    <span>
                      <Users size={13} /> {d.member_count ?? 0} members
                    </span>
                    {leader && <span>Leader: {leader}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="dept-card-arrow" />
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <div
          className="dept-drawer-backdrop"
          onClick={() => {
            setSelectedId(null);
            setEditing(false);
          }}
          role="presentation"
        >
          <aside
            className="dept-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={detail?.name || 'Department details'}
          >
            <div className="dept-drawer-head">
              <div>
                <p className="dept-kicker">Department</p>
                <h3>{detail?.name || 'Loading…'}</h3>
              </div>
              <button
                type="button"
                className="dept-drawer-close"
                onClick={() => {
                  setSelectedId(null);
                  setEditing(false);
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading || !detail ? (
              <Spinner />
            ) : editing ? (
              <form className="dept-edit-form" onSubmit={handleUpdate}>
                <Input
                  label="Name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                />
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
                <label className="label">Leader</label>
                <select
                  className="input"
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                >
                  <option value="">No leader assigned</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </option>
                  ))}
                </select>
                <div className="dept-drawer-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving}>
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {detail.description && (
                  <p className="dept-drawer-desc">{detail.description}</p>
                )}
                <div className="dept-stats">
                  <div className="dept-stat">
                    <Users size={16} />
                    <strong>{detail.member_count ?? 0}</strong>
                    <span>Members</span>
                  </div>
                  <div className="dept-stat">
                    <Megaphone size={16} />
                    <strong>{detail.posts?.length ?? 0}</strong>
                    <span>Updates</span>
                  </div>
                </div>

                <div className="dept-drawer-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>

                <section className="dept-drawer-section">
                  <h4>
                    <Users size={16} /> Team roster
                  </h4>
                  {(detail.members || []).length === 0 ? (
                    <p className="dept-muted">
                      No members yet — assign people from the member profile.
                    </p>
                  ) : (
                    <ul className="dept-roster-list">
                      {(detail.members || []).map((m) => {
                        const initials =
                          `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
                        const img = resolveMediaUrl(m.avatar_url);
                        return (
                          <li key={m.id} className="dept-roster-item">
                            {img ? (
                              <img src={img} alt="" />
                            ) : (
                              <span className="dept-roster-fallback">
                                {initials}
                              </span>
                            )}
                            <div>
                              <strong>
                                {m.first_name} {m.last_name}
                              </strong>
                              <span>
                                {m.role === 'leader' ? 'Leader' : 'Member'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="dept-drawer-section">
                  <h4>
                    <Megaphone size={16} /> Recent updates
                  </h4>
                  {(detail.posts || []).length === 0 ? (
                    <p className="dept-muted">
                      Leaders can post meetings and updates from My Department.
                    </p>
                  ) : (
                    <ul className="dept-post-list">
                      {(detail.posts || []).slice(0, 5).map((p) => (
                        <li key={p.id} className="dept-post-item">
                          <span className={`dept-post-tag dept-post-tag--${p.post_type || 'update'}`}>
                            {p.post_type || 'update'}
                          </span>
                          <strong>{p.title}</strong>
                          <p>{p.body.slice(0, 120)}{p.body.length > 120 ? '…' : ''}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </aside>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Add Department"
        subtitle="Fill in the details below"
      >
        <form className="dept-form" onSubmit={handleCreate}>
          <Input
            label="Name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="Choir"
            required
          />
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Leads worship every Sunday and midweek."
          />
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <style>{`
        .dept-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
        .dept-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        .dept-kicker {
          margin: 0 0 4px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }
        .dept-hero-sub { margin: 6px 0 0; font-size: 14px; color: var(--text-secondary, #6b6560); }
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }
        .dept-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          text-align: left;
          border: 1px solid var(--border, #e8e4dc);
          background: #fff;
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
          color: inherit;
          width: 100%;
        }
        .dept-card:hover, .dept-card.is-selected {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(20, 16, 12, 0.1);
          border-color: var(--dept-accent, #2d1b69);
          background: linear-gradient(135deg, #fff 0%, color-mix(in srgb, var(--dept-accent, #2d1b69) 6%, white) 100%);
        }
        .dept-card:active { transform: scale(0.985); }
        .dept-card-icon {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--dept-accent, #2d1b69) 12%, white);
          color: var(--dept-accent, #2d1b69);
          display: grid;
          place-items: center;
        }
        .dept-card-body { flex: 1; min-width: 0; }
        .dept-card-body h3 {
          margin: 0 0 6px;
          font-size: 17px;
          font-weight: 600;
        }
        .dept-card-body p {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary, #6b6560);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .dept-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
          font-size: 12px;
          color: var(--text-muted, #9e9893);
        }
        .dept-card-meta span { display: inline-flex; align-items: center; gap: 4px; }
        .dept-card-arrow {
          flex-shrink: 0;
          opacity: .35;
          margin-top: 4px;
          transition: transform .18s ease, opacity .18s ease;
        }
        .dept-card:hover .dept-card-arrow {
          transform: translateX(3px);
          opacity: .7;
        }
        .dept-drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(10, 8, 6, 0.45);
          display: flex;
          justify-content: flex-end;
          animation: dept-fade .2s ease;
        }
        @keyframes dept-fade { from { opacity: 0; } to { opacity: 1; } }
        .dept-drawer {
          width: min(420px, 100%);
          height: 100%;
          background: linear-gradient(180deg, #fff 0%, #faf8f5 100%);
          overflow-y: auto;
          padding: 20px 18px max(20px, env(safe-area-inset-bottom));
          box-shadow: -8px 0 32px rgba(0,0,0,.12);
          animation: dept-slide .24s ease;
        }
        @keyframes dept-slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .dept-drawer-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .dept-drawer-head h3 { margin: 0; font-size: 22px; }
        .dept-drawer-close {
          border: 0;
          background: rgba(0,0,0,.06);
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .dept-drawer-desc {
          margin: 0 0 16px;
          font-size: 14px;
          line-height: 1.55;
          color: var(--text-secondary, #6b6560);
        }
        .dept-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .dept-stat {
          background: #f8f6f2;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }
        .dept-stat strong { font-size: 22px; line-height: 1; }
        .dept-stat span { font-size: 12px; color: var(--text-muted, #9e9893); }
        .dept-drawer-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .dept-drawer-section { margin-bottom: 20px; }
        .dept-drawer-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          margin: 0 0 12px;
        }
        .dept-muted { font-size: 13px; color: var(--text-muted, #9e9893); margin: 0; }
        .dept-roster-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
          padding: 0;
        }
        .dept-roster-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border, #e8e4dc);
          transition: background .15s ease;
        }
        .dept-roster-item:hover { background: #faf8f5; transform: translateX(2px); }
        .dept-roster-item img, .dept-roster-fallback {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
          background: #efeaf6;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }
        .dept-roster-item strong { display: block; font-size: 14px; }
        .dept-roster-item span { font-size: 12px; color: var(--text-muted, #9e9893); }
        .dept-post-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dept-post-item {
          padding: 12px 14px;
          border-radius: 12px;
          background: #f8f6f2;
          border: 1px solid transparent;
          transition: border-color .15s ease;
        }
        .dept-post-item:hover { border-color: var(--border, #e8e4dc); transform: translateY(-1px); }
        .dept-post-item strong { display: block; margin: 6px 0 4px; font-size: 14px; }
        .dept-post-item p { margin: 0; font-size: 13px; color: var(--text-secondary, #6b6560); line-height: 1.45; }
        .dept-post-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .dept-post-tag--update { background: #e8e4f8; color: #2d1b69; }
        .dept-post-tag--meeting { background: #e4f0e8; color: #1a5f4a; }
        .dept-post-tag--event { background: #f8e8e4; color: #8b4513; }
        .dept-edit-form { display: flex; flex-direction: column; gap: 12px; }
        .dept-form { display: flex; flex-direction: column; gap: 12px; }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
