import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { asList, canEditChurchMedia } from '../../utils/churchLife';

type Devotional = {
  id: number;
  title: string;
  scripture?: string | null;
  body: string;
  author_name?: string | null;
  devote_date: string;
};

const empty = {
  title: '',
  scripture: '',
  body: '',
  author_name: '',
  devote_date: new Date().toISOString().slice(0, 10),
};

export default function DevotionalsPage() {
  const { accountType, user } = useAuth();
  const canEdit = canEditChurchMedia(accountType, user?.role);
  const [today, setToday] = useState<Devotional | null>(null);
  const [rows, setRows] = useState<Devotional[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, list] = await Promise.all([
        api.get('/church-life/devotionals/today').catch(() => ({ data: null })),
        api.get('/church-life/devotionals'),
      ]);
      const tData = t.data?.data ?? t.data ?? null;
      setToday(tData && tData.id ? tData : null);
      setRows(asList<Devotional>(list.data));
    } catch {
      toast.error('Failed to load devotionals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and body are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/church-life/devotionals', {
        title: form.title.trim(),
        scripture: form.scripture.trim() || null,
        body: form.body.trim(),
        author_name: form.author_name.trim() || null,
        devote_date: form.devote_date,
      });
      toast.success('Devotional saved');
      setOpen(false);
      setForm(empty);
      await load();
    } catch {
      toast.error('Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this devotional?')) return;
    try {
      await api.delete(`/church-life/devotionals/${id}`);
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Could not delete');
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Daily Devotionals</h1>
          <p className="page-sub">A word for each day.</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> Schedule
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : (
        <>
          {today ? (
            <article className="card glass-card devote-today">
              <p className="devote-kicker">Today · {String(today.devote_date).slice(0, 10)}</p>
              <h2>{today.title}</h2>
              {today.scripture && <p className="devote-scripture">{today.scripture}</p>}
              <p className="devote-body">{today.body}</p>
              {today.author_name && (
                <p className="muted">— {today.author_name}</p>
              )}
            </article>
          ) : (
            <EmptyState
              icon={<BookOpen size={28} />}
              title="No devotion for today"
              description={
                canEdit
                  ? 'Schedule one for today or an upcoming date.'
                  : 'Come back tomorrow for a fresh word.'
              }
            />
          )}

          {rows.length > 0 && (
            <section className="devote-list">
              <h3>Scheduled</h3>
              {rows.map((d) => (
                <div key={d.id} className="card glass-card devote-row">
                  <div>
                    <strong>{d.title}</strong>
                    <p className="muted">{String(d.devote_date).slice(0, 10)}</p>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void remove(d.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Schedule devotional">
        <form onSubmit={create} className="form-stack">
          <Input
            label="Date"
            type="date"
            value={form.devote_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, devote_date: e.target.value }))
            }
            required
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Input
            label="Scripture"
            value={form.scripture}
            onChange={(e) =>
              setForm((f) => ({ ...f, scripture: e.target.value }))
            }
            placeholder="John 3:16"
          />
          <TextArea
            label="Body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={6}
            required
          />
          <Input
            label="Author"
            value={form.author_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, author_name: e.target.value }))
            }
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </Modal>

      <style>{`
        .page-header-row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:16px; }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .devote-today { padding:20px; }
        .devote-kicker { text-transform:uppercase; letter-spacing:.08em; font-size:.72rem; opacity:.65; margin:0 0 8px; }
        .devote-scripture { font-style:italic; opacity:.85; }
        .devote-body { white-space:pre-wrap; line-height:1.55; }
        .devote-list { margin-top:20px; display:flex; flex-direction:column; gap:10px; }
        .devote-row { padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .muted { opacity:.7; margin:4px 0 0; }
        .form-stack { display:flex; flex-direction:column; gap:12px; }
      `}</style>
    </div>
  );
}
