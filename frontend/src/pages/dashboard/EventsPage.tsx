import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { ChurchEvent } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

const EVENT_TYPES = [
  'Service',
  'Conference',
  'Outreach',
  'Meeting',
  'Social',
  'Youth',
];

const emptyForm = {
  title: '',
  description: '',
  event_type: 'Service',
  start_datetime: '',
  end_datetime: '',
  location: '',
  is_public: true,
};

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function canManageEvents(accountType: string | null, role?: string | null) {
  if (accountType === 'member') return false;
  const r = String(role || '').toLowerCase();
  return r === 'pastor' || r === 'admin' || r === 'super-admin';
}

export default function EventsPage() {
  const { user, accountType } = useAuth();
  const canManage = canManageEvents(accountType, user?.role);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChurchEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events', { params: { upcoming: 'false' } });
      setEvents(asList<ChurchEvent>(res.data));
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (ev: ChurchEvent) => {
    setEditing(ev);
    setForm({
      title: ev.title || '',
      description: ev.description || '',
      event_type: ev.event_type || 'Service',
      start_datetime: toLocalInput(ev.start_datetime),
      end_datetime: toLocalInput(ev.end_datetime),
      location: ev.location || '',
      is_public: ev.is_public !== false,
    });
    setOpen(true);
  };

  const handleDelete = async (ev: ChurchEvent) => {
    if (!canManage) return;
    if (!window.confirm(`Delete event “${ev.title}”? This cannot be undone.`)) {
      return;
    }
    setDeletingId(ev.id);
    try {
      await api.delete(`/events/${ev.id}`);
      toast.success('Event deleted');
      if (editing?.id === ev.id) setOpen(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not delete event';
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_datetime) {
      toast.error('Title and start time are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: form.end_datetime
          ? new Date(form.end_datetime).toISOString()
          : null,
      };
      if (editing?.id) {
        await api.put(`/events/${editing.id}`, payload);
        toast.success('Event updated');
      } else {
        await api.post('/events', payload);
        toast.success('Event created');
      }
      setOpen(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not save event';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="events-page">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="events-page">
      <div className="events-toolbar">
        <h2 className="page-heading">Events</h2>
        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={16} />
            Create Event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet."
          description="Schedule services, conferences, and outreach programmes."
          actionLabel={canManage ? 'Create Event' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="events-list">
          {events.map((ev) => (
            <article key={ev.id} className="card event-card">
              <div>
                <div className="event-top">
                  <h3>{ev.title}</h3>
                  {ev.event_type && <Badge variant="visitor">{ev.event_type}</Badge>}
                </div>
                {ev.description && <p className="event-desc">{ev.description}</p>}
                <p className="event-meta">
                  {ev.start_datetime
                    ? new Date(ev.start_datetime).toLocaleString('en-GH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                  {ev.location ? ` · ${ev.location}` : ''}
                </p>
              </div>
              {canManage && (
                <div className="event-actions">
                  <Button variant="ghost" onClick={() => openEdit(ev)}>
                    <Pencil size={16} />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={deletingId === ev.id}
                    onClick={() => void handleDelete(ev)}
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editing ? 'Edit Event' : 'Add Event'}
        subtitle="Fill in the details below"
      >
        <form className="event-form" onSubmit={handleSubmit}>
          <Input
            label="Title"
            value={form.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, title: e.target.value }))
            }
            required
          />
          <label className="label">Event Type</label>
          <select
            className="input"
            value={form.event_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, event_type: e.target.value }))
            }
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Input
            label="Start"
            type="datetime-local"
            value={form.start_datetime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, start_datetime: e.target.value }))
            }
            required
          />
          <Input
            label="End"
            type="datetime-local"
            value={form.end_datetime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, end_datetime: e.target.value }))
            }
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_public: e.target.checked }))
              }
            />
            Public event
          </label>
          <div className="form-actions">
            {editing && (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete(editing)}
                disabled={saving}
              >
                <Trash2 size={16} />
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
