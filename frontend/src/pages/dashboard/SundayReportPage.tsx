import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { asList, canEditChurchMedia } from '../../utils/churchLife';
import { whatsappShareUrl } from '../../utils/youtube';

type Report = {
  id: number;
  service_date: string;
  men?: number;
  women?: number;
  children?: number;
  visitors?: number;
  salvations?: number;
  decisions?: number;
  notes?: string | null;
};

const empty = {
  service_date: new Date().toISOString().slice(0, 10),
  men: 0,
  women: 0,
  children: 0,
  visitors: 0,
  salvations: 0,
  decisions: 0,
  notes: '',
};

export default function SundayReportPage() {
  const { accountType, user } = useAuth();
  const canEdit = canEditChurchMedia(accountType, user?.role);
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/church-life/sunday-reports');
      setRows(asList<Report>(res.data));
    } catch {
      toast.error('Failed to load reports');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/church-life/sunday-reports', {
        ...form,
        notes: form.notes.trim() || null,
      });
      toast.success('Sunday report saved');
      setOpen(false);
      setForm(empty);
      await load();
    } catch {
      toast.error('Could not save report');
    } finally {
      setSaving(false);
    }
  };

  const shareWhatsApp = async (id: number) => {
    try {
      const res = await api.get(`/church-life/sunday-reports/${id}/whatsapp-text`);
      const text = String(res.data?.text || res.data?.data?.text || '');
      if (!text) {
        toast.error('No text generated');
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success('Copied — opening WhatsApp');
      window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not prepare WhatsApp text');
    }
  };

  if (!canEdit) {
    return (
      <EmptyState
        icon={<ClipboardList size={28} />}
        title="Staff only"
        description="Sunday reports are managed by church staff."
      />
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Sunday Report</h1>
          <p className="page-sub">
            Attendance, salvations, and decisions — ready for WhatsApp.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> New report
        </Button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="No reports yet"
          description="Record after service to share with leaders."
        />
      ) : (
        <div className="report-list">
          {rows.map((r) => {
            const total =
              Number(r.men || 0) +
              Number(r.women || 0) +
              Number(r.children || 0);
            return (
              <article key={r.id} className="card glass-card report-card">
                <div>
                  <strong>{String(r.service_date).slice(0, 10)}</strong>
                  <p className="muted">
                    {total} present · {r.visitors || 0} visitors ·{' '}
                    {r.salvations || 0} salvations · {r.decisions || 0} decisions
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void shareWhatsApp(r.id)}
                >
                  WhatsApp
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Sunday report">
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
          <div className="num-grid">
            {(
              [
                ['men', 'Men'],
                ['women', 'Women'],
                ['children', 'Children'],
                ['visitors', 'Visitors'],
                ['salvations', 'Salvations'],
                ['decisions', 'Decisions'],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                label={label}
                type="number"
                min={0}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [key]: Number(e.target.value) || 0,
                  }))
                }
              />
            ))}
          </div>
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save report'}
          </Button>
        </form>
      </Modal>

      <style>{`
        .page-header-row { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:16px; }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .report-list { display:flex; flex-direction:column; gap:10px; }
        .report-card { padding:14px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .muted { opacity:.7; margin:4px 0 0; }
        .form-stack { display:flex; flex-direction:column; gap:12px; }
        .num-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      `}</style>
    </div>
  );
}
