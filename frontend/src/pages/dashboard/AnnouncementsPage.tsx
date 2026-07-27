import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pin, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { ChurchAnnouncement } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function canManageAnnouncements(
  accountType: string | null,
  role?: string | null
) {
  if (accountType === 'member') return false;
  const r = String(role || '').toLowerCase();
  return r === 'pastor' || r === 'admin' || r === 'super-admin';
}

export default function AnnouncementsPage() {
  const { user, accountType } = useAuth();
  const canManage = canManageAnnouncements(accountType, user?.role);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChurchAnnouncement[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [isPinned, setIsPinned] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setItems(asList<ChurchAnnouncement>(res.data));
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('Only pastors and admins can post announcements');
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/announcements', {
        title: title.trim(),
        body: body.trim(),
        audience,
        is_pinned: isPinned,
      });
      toast.success('Announcement published');
      setOpen(false);
      setTitle('');
      setBody('');
      setAudience('all');
      setIsPinned(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not create announcement';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (item: ChurchAnnouncement) => {
    if (!canManage) return;
    try {
      await api.post(`/announcements/${item.id}/pin`);
      toast.success(item.is_pinned ? 'Unpinned' : 'Pinned to top');
      await load();
    } catch {
      toast.error('Could not update pin');
    }
  };

  const handleDelete = async (item: ChurchAnnouncement) => {
    if (!canManage) return;
    if (
      !window.confirm(
        `Delete announcement “${item.title}”? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(item.id);
    try {
      await api.delete(`/announcements/${item.id}`);
      toast.success('Announcement deleted');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not delete announcement';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="ann-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="ann-page">
      <div className="ann-toolbar">
        <h2 className="page-heading">Announcements</h2>
        {canManage && (
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Create
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No announcements yet."
          description={
            canManage
              ? 'Share service updates, prayer requests, and church news.'
              : 'Pastors and admins will post church news here.'
          }
          actionLabel={canManage ? 'Create Announcement' : undefined}
          onAction={canManage ? () => setOpen(true) : undefined}
        />
      ) : (
        <div className="ann-list">
          {items.map((item) => {
            const author =
              item.created_by_name ||
              [item.created_by_first_name, item.created_by_last_name]
                .filter(Boolean)
                .join(' ') ||
              'Church office';
            const when = item.publish_date || item.created_at;
            const audienceLabel =
              item.audience === 'all' || !item.audience
                ? 'All Members'
                : item.audience === 'members'
                  ? 'Members'
                  : item.department_name || item.audience;
            return (
              <article
                key={item.id}
                className={`card ann-card${item.is_pinned ? ' ann-card--pinned' : ''}`}
              >
                <div className="ann-card-top">
                  <div className="ann-title-row">
                    {item.is_pinned && (
                      <span className="ann-pin-label">
                        <Pin size={14} /> Pinned
                      </span>
                    )}
                    <h3>{item.title}</h3>
                  </div>
                  {canManage && (
                    <div className="ann-card-actions">
                      <Button variant="ghost" onClick={() => togglePin(item)}>
                        <Pin size={16} />
                        {item.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                <p className="ann-body">{item.body}</p>
                <div className="ann-footer">
                  <span className="ann-meta">
                    Posted by {author}
                    {when
                      ? ` · ${new Date(when).toLocaleDateString('en-GH')}`
                      : ''}
                  </span>
                  <Badge variant="visitor">{audienceLabel}</Badge>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {canManage && (
        <Modal
          open={open}
          onClose={() => !saving && setOpen(false)}
          title="Add Announcement"
          subtitle="Fill in the details below"
        >
          <form className="ann-form" onSubmit={handleCreate}>
            <Input
              label="Title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitle(e.target.value)
              }
              placeholder="Sunday Service moves to 8:00am"
              required
            />
            <label className="label">Body</label>
            <textarea
              className="input"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share details with the congregation…"
              required
            />
            <label className="label">Audience</label>
            <select
              className="input"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="all">All</option>
              <option value="members">Members</option>
              <option value="department">Department</option>
            </select>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              Pin to top
            </label>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Publish
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
