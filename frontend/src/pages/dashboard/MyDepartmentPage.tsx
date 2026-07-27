import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Network,
  Users,
  Calendar,
  MapPin,
  Megaphone,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type RosterMember = {
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

type DeptInfo = {
  id: number;
  name?: string;
  description?: string | null;
  leader_first_name?: string;
  leader_last_name?: string;
  member_count?: number | null;
  my_role?: string;
  can_post?: boolean;
  members?: RosterMember[];
  posts?: DeptPost[];
};

export default function MyDepartmentPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DeptInfo[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ministry, setMinistry] = useState<string | null>(null);
  const [cellGroup, setCellGroup] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    body: '',
    post_type: 'update',
    meeting_at: '',
    location: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments/mine');
      const list: DeptInfo[] = Array.isArray(res.data?.departments)
        ? res.data.departments
        : res.data?.department
          ? [res.data.department]
          : [];
      setDepartments(list);
      setActiveId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      setMinistry(res.data?.ministry || null);
      setCellGroup(res.data?.cell_group || null);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const department = departments.find((d) => d.id === activeId) || null;

  const submitPost = async (e: FormEvent) => {
    e.preventDefault();
    if (!department?.id) return;
    if (!postForm.title.trim() || !postForm.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setPosting(true);
    try {
      await api.post(`/departments/${department.id}/posts`, {
        title: postForm.title.trim(),
        body: postForm.body.trim(),
        post_type: postForm.post_type,
        meeting_at: postForm.meeting_at || null,
        location: postForm.location || null,
      });
      toast.success('Posted to department');
      setPostForm({
        title: '',
        body: '',
        post_type: 'update',
        meeting_at: '',
        location: '',
      });
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not post';
      toast.error(msg);
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <Spinner fullPage />;

  const leader = department
    ? `${department.leader_first_name || ''} ${department.leader_last_name || ''}`.trim()
    : '';

  return (
    <div className="member-page dept-hub">
      <div className="page-head">
        <p className="member-home-kicker">Church life</p>
        <h1 className="page-title">My department</h1>
        <p className="page-sub">
          See your team, meetings, and updates from your department leader.
        </p>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          title="No department assigned"
          description="Ask your church admin to place you in one or more departments."
        />
      ) : (
        <>
          {departments.length > 1 && (
            <div className="dept-tabs">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`dept-tab${d.id === activeId ? ' is-active' : ''}`}
                  onClick={() => setActiveId(d.id)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {department && (
            <>
              <article className="glass-card member-dept-card">
                <div className="member-home-card-head">
                  <Network size={20} />
                  <h2>{department.name}</h2>
                </div>
                {department.description && <p>{department.description}</p>}
                {ministry && (
                  <p className="member-home-meta">Ministry: {ministry}</p>
                )}
                {cellGroup && (
                  <p className="member-home-meta">Cell group: {cellGroup}</p>
                )}
                {leader && (
                  <p className="member-home-meta">Leader: {leader}</p>
                )}
                {department.member_count != null && (
                  <p className="member-home-meta">
                    <Users size={14} /> {department.member_count} members
                  </p>
                )}
                {department.my_role === 'leader' && (
                  <p className="member-home-meta">You lead this department</p>
                )}
              </article>

              <section className="dept-section">
                <h3>
                  <Megaphone size={18} /> Updates & meetings
                </h3>
                {department.can_post && (
                  <form className="glass-card dept-post-form" onSubmit={submitPost}>
                    <p className="member-home-meta">Post as department leader</p>
                    <Select
                      label="Type"
                      value={postForm.post_type}
                      onChange={(e) =>
                        setPostForm((f) => ({ ...f, post_type: e.target.value }))
                      }
                      options={[
                        { value: 'update', label: 'Update' },
                        { value: 'meeting', label: 'Meeting' },
                        { value: 'event', label: 'Event' },
                      ]}
                    />
                    <Input
                      label="Title"
                      value={postForm.title}
                      onChange={(e) =>
                        setPostForm((f) => ({ ...f, title: e.target.value }))
                      }
                      required
                    />
                    <TextArea
                      label="Message"
                      value={postForm.body}
                      onChange={(e) =>
                        setPostForm((f) => ({ ...f, body: e.target.value }))
                      }
                      required
                    />
                    {(postForm.post_type === 'meeting' ||
                      postForm.post_type === 'event') && (
                      <div className="form-row">
                        <Input
                          label="When"
                          type="datetime-local"
                          value={postForm.meeting_at}
                          onChange={(e) =>
                            setPostForm((f) => ({
                              ...f,
                              meeting_at: e.target.value,
                            }))
                          }
                        />
                        <Input
                          label="Where"
                          value={postForm.location}
                          onChange={(e) =>
                            setPostForm((f) => ({
                              ...f,
                              location: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                    <Button type="submit" loading={posting}>
                      <Send size={14} /> Post to department
                    </Button>
                  </form>
                )}

                {(department.posts || []).length === 0 ? (
                  <p className="member-home-meta">No posts yet.</p>
                ) : (
                  <ul className="dept-posts">
                    {(department.posts || []).map((p) => (
                      <li key={p.id} className="glass-card dept-post">
                        <div className="dept-post-head">
                          <span className="dept-post-type">
                            {p.post_type || 'update'}
                          </span>
                          <time>
                            {p.created_at
                              ? new Date(p.created_at).toLocaleString('en-GH', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })
                              : ''}
                          </time>
                        </div>
                        <strong>{p.title}</strong>
                        <p>{p.body}</p>
                        {p.meeting_at && (
                          <p className="member-home-meta">
                            <Calendar size={14} />{' '}
                            {new Date(p.meeting_at).toLocaleString('en-GH', {
                              dateStyle: 'full',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                        {p.location && (
                          <p className="member-home-meta">
                            <MapPin size={14} /> {p.location}
                          </p>
                        )}
                        {(p.author_first_name || p.author_last_name) && (
                          <p className="member-home-meta">
                            — {p.author_first_name} {p.author_last_name}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dept-section">
                <h3>
                  <Users size={18} /> Team roster
                </h3>
                <div className="dept-roster">
                  {(department.members || []).map((m) => {
                    const initials =
                      `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
                    const img = resolveMediaUrl(m.avatar_url);
                    return (
                      <article key={m.id} className="dept-roster-card">
                        {img ? (
                          <img src={img} alt="" />
                        ) : (
                          <span className="dept-roster-fallback">{initials}</span>
                        )}
                        <div>
                          <strong>
                            {m.first_name} {m.last_name}
                          </strong>
                          <span>
                            {m.role === 'leader' ? 'Leader' : 'Member'}
                            {user?.id === m.id ? ' · You' : ''}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <Link to="/" className="member-home-link" style={{ marginTop: 16 }}>
        ← Back home
      </Link>

      <style>{`
        .dept-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .dept-tab {
          border: 1px solid var(--border, #e8e4dc); background: #fff;
          border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .dept-tab.is-active {
          background: var(--accent, #2d1b69); color: #fff; border-color: transparent;
        }
        .dept-section { margin-top: 24px; }
        .dept-section h3 {
          display: flex; align-items: center; gap: 8px;
          font-size: 17px; margin-bottom: 12px;
        }
        .dept-post-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; padding: 16px; }
        .dept-posts { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .dept-post { padding: 14px 16px; }
        .dept-post-head {
          display: flex; justify-content: space-between; gap: 8px;
          font-size: 12px; color: #9e9893; margin-bottom: 6px; text-transform: capitalize;
        }
        .dept-post strong { display: block; margin-bottom: 6px; }
        .dept-roster {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;
        }
        .dept-roster-card {
          display: flex; align-items: center; gap: 10px;
          background: #fff; border: 1px solid var(--border, #e8e4dc);
          border-radius: 14px; padding: 10px 12px;
        }
        .dept-roster-card img, .dept-roster-fallback {
          width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
          background: #efeaf6; display: grid; place-items: center; font-weight: 700; font-size: 13px;
        }
        .dept-roster-card strong { display: block; font-size: 14px; }
        .dept-roster-card span { font-size: 12px; color: #9e9893; }
      `}</style>
    </div>
  );
}
