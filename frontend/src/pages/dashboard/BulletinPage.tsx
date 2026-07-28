import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Newspaper, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { asList, canEditChurchMedia } from '../../utils/churchLife';

type Bulletin = {
  id: number;
  title: string;
  service_date: string;
  order_of_service?: string | null;
  announcements?: string | null;
  offering_focus?: string | null;
  welcome_note?: string | null;
  is_published?: boolean;
};

const empty = {
  title: 'Sunday Bulletin',
  service_date: new Date().toISOString().slice(0, 10),
  order_of_service: '',
  announcements: '',
  offering_focus: '',
  welcome_note: '',
};

export default function BulletinPage() {
  const { accountType, user } = useAuth();
  const canEdit = canEditChurchMedia(accountType, user?.role);
  const [latest, setLatest] = useState<Bulletin | null>(null);
  const [rows, setRows] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, list] = await Promise.all([
        api.get('/church-life/bulletins/latest').catch(() => ({ data: null })),
        canEdit
          ? api.get('/church-life/bulletins')
          : Promise.resolve({ data: [] }),
      ]);
      const ld = l.data?.data ?? l.data ?? null;
      setLatest(ld && ld.id ? ld : null);
      setRows(asList<Bulletin>(list.data));
    } catch {
      toast.error('Failed to load bulletin');
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/church-life/bulletins', {
        ...form,
        title: form.title.trim() || 'Sunday Bulletin',
      });
      toast.success('Bulletin saved (draft)');
      setOpen(false);
      setForm(empty);
      await load();
    } catch {
      toast.error('Could not save bulletin');
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: number) => {
    try {
      await api.post(`/church-life/bulletins/${id}/publish`);
      toast.success('Published to members');
      await load();
    } catch {
      toast.error('Could not publish');
    }
  };

  const view = latest || rows.find((r) => r.is_published) || null;

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Sunday Bulletin</h1>
          <p className="page-sub">Order of service and announcements.</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> New bulletin
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : view ? (
        <article className="card glass-card bulletin-view">
          <p className="kicker">
            {String(view.service_date).slice(0, 10)}
            {view.is_published === false ? ' · Draft' : ''}
          </p>
          <h2>{view.title}</h2>
          {view.welcome_note && (
            <section>
              <h3>Welcome</h3>
              <p className="pre">{view.welcome_note}</p>
            </section>
          )}
          {view.order_of_service && (
            <section>
              <h3>Order of service</h3>
              <p className="pre">{view.order_of_service}</p>
            </section>
          )}
          {view.announcements && (
            <section>
              <h3>Announcements</h3>
              <p className="pre">{view.announcements}</p>
            </section>
          )}
          {view.offering_focus && (
            <section>
              <h3>Offering focus</h3>
              <p className="pre">{view.offering_focus}</p>
            </section>
          )}
        </article>
      ) : (
        <EmptyState
          icon={<Newspaper size={28} />}
          title="No bulletin published"
          description={
            canEdit
              ? 'Create this Sunday’s order of service.'
              : 'The bulletin will appear here when published.'
          }
        />
      )}

      {canEdit && rows.length > 0 && (
        <section className="bulletin-drafts">
          <h3>All bulletins</h3>
          {rows.map((b) => (
            <div key={b.id} className="card glass-card draft-row">
              <div>
                <strong>{b.title}</strong>
                <p className="muted">
                  {String(b.service_date).slice(0, 10)} ·{' '}
                  {b.is_published ? 'Published' : 'Draft'}
                </p>
              </div>
              {!b.is_published && (
                <Button type="button" size="sm" onClick={() => void publish(b.id)}>
                  Publish
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create bulletin">
        <form onSubmit={create} className="form-stack">
          <Input
            label="Service date"
            type="date"
            value={form.service_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, service_date: e.target.value }))
            }
            required
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextArea
            label="Welcome note"
            value={form.welcome_note}
            onChange={(e) =>
              setForm((f) => ({ ...f, welcome_note: e.target.value }))
            }
            rows={2}
          />
          <TextArea
            label="Order of service"
            value={form.order_of_service}
            onChange={(e) =>
              setForm((f) => ({ ...f, order_of_service: e.target.value }))
            }
            rows={5}
          />
          <TextArea
            label="Announcements"
            value={form.announcements}
            onChange={(e) =>
              setForm((f) => ({ ...f, announcements: e.target.value }))
            }
            rows={4}
          />
          <TextArea
            label="Offering focus"
            value={form.offering_focus}
            onChange={(e) =>
              setForm((f) => ({ ...f, offering_focus: e.target.value }))
            }
            rows={2}
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        </form>
      </Modal>

      <style>{`
        .page-header-row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:16px; }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .bulletin-view { padding:20px; }
        .bulletin-view section { margin-top:16px; }
        .bulletin-view h3 { margin:0 0 6px; font-size:.95rem; }
        .kicker { text-transform:uppercase; letter-spacing:.08em; font-size:.72rem; opacity:.65; margin:0 0 8px; }
        .pre { white-space:pre-wrap; line-height:1.5; margin:0; }
        .bulletin-drafts { margin-top:20px; display:flex; flex-direction:column; gap:10px; }
        .draft-row { padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .muted { opacity:.7; margin:4px 0 0; }
        .form-stack { display:flex; flex-direction:column; gap:12px; }
      `}</style>
    </div>
  );
}
