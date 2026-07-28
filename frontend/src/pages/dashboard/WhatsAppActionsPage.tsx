import { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { whatsappShareUrl } from '../../utils/youtube';

type Templates = Record<string, string>;

const LABELS: { key: string; title: string; desc: string }[] = [
  {
    key: 'missed_service',
    title: 'Missed service',
    desc: 'Follow up with someone who was absent',
  },
  {
    key: 'birthday',
    title: 'Birthday wish',
    desc: 'One-tap birthday greeting',
  },
  {
    key: 'new_visitor',
    title: 'New visitor',
    desc: 'Warm welcome message',
  },
  {
    key: 'sunday_report',
    title: 'Sunday report',
    desc: 'Formatted summary for the leaders group',
  },
];

export default function WhatsAppActionsPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Templates>({});
  const [name, setName] = useState('');
  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/church-life/whatsapp-templates', {
        params: {
          name: name.trim() || undefined,
          service_date: serviceDate || undefined,
        },
      });
      const d = res.data?.data || res.data || {};
      setTemplates(d.filled || d.templates || d);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [name, serviceDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyAndOpen = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      /* ignore */
    }
    window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">WhatsApp Quick Actions</h1>
          <p className="page-sub">
            Pre-filled messages for pastoral follow-up.
          </p>
        </div>
      </div>

      <div className="card glass-card wa-filters">
        <Input
          label="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member name"
        />
        <Input
          label="Service date"
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh texts
        </Button>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : (
        <div className="wa-grid">
          {LABELS.map((item) => {
            const text = String(templates[item.key] || '');
            return (
              <article key={item.key} className="card glass-card wa-card">
                <div className="wa-head">
                  <MessageCircle size={18} />
                  <div>
                    <h2>{item.title}</h2>
                    <p className="muted">{item.desc}</p>
                  </div>
                </div>
                <pre className="wa-text">{text || '—'}</pre>
                <div className="wa-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!text}
                    onClick={async () => {
                      await navigator.clipboard.writeText(text);
                      toast.success('Copied');
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!text}
                    onClick={() => void copyAndOpen(text)}
                  >
                    Open WhatsApp
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .page-header-row { margin-bottom:16px; }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .wa-filters { padding:16px; display:grid; gap:12px; grid-template-columns:1fr 1fr auto; align-items:end; margin-bottom:16px; }
        @media (max-width:720px) { .wa-filters { grid-template-columns:1fr; } }
        .wa-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
        .wa-card { padding:16px; display:flex; flex-direction:column; gap:12px; }
        .wa-head { display:flex; gap:10px; align-items:flex-start; }
        .wa-head h2 { margin:0; font-size:1rem; }
        .muted { margin:2px 0 0; opacity:.7; font-size:.85rem; }
        .wa-text { margin:0; white-space:pre-wrap; background:rgba(0,0,0,.04); padding:12px; border-radius:8px; font-family:inherit; font-size:.9rem; flex:1; }
        .wa-actions { display:flex; gap:8px; flex-wrap:wrap; }
      `}</style>
    </div>
  );
}
