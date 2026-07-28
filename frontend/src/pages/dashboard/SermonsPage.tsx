import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Plus, Trash2, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { VideoWatchOverlay } from '../../components/media/VideoWatchOverlay';
import { asList, canEditChurchMedia } from '../../utils/churchLife';
import {
  extractYoutubeId,
  youtubeThumbnail,
} from '../../utils/youtube';

type Sermon = {
  id: number;
  title: string;
  preacher?: string | null;
  series?: string | null;
  youtube_url: string;
  youtube_id?: string | null;
  thumbnail_url?: string | null;
  preached_at?: string | null;
  description?: string | null;
};

const emptyForm = {
  title: '',
  preacher: '',
  series: '',
  youtube_url: '',
  preached_at: '',
  description: '',
};

function formatDate(raw?: string | null) {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SermonsPage() {
  const { accountType, user } = useAuth();
  const canEdit = canEditChurchMedia(accountType, user?.role);
  const [rows, setRows] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [watch, setWatch] = useState<Sermon | null>(null);

  const previewId = useMemo(
    () => extractYoutubeId(form.youtube_url),
    [form.youtube_url]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/church-life/sermons');
      setRows(asList<Sermon>(res.data));
    } catch {
      toast.error('Failed to load sermons');
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
    if (!form.title.trim() || !form.youtube_url.trim()) {
      toast.error('Title and YouTube link are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/church-life/sermons', {
        title: form.title.trim(),
        preacher: form.preacher.trim() || null,
        series: form.series.trim() || null,
        youtube_url: form.youtube_url.trim(),
        preached_at: form.preached_at || null,
        description: form.description.trim() || null,
      });
      toast.success('Sermon added — members notified');
      setOpen(false);
      setForm(emptyForm);
      await load();
    } catch {
      toast.error('Could not save sermon');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this sermon?')) return;
    try {
      await api.delete(`/church-life/sermons/${id}`);
      toast.success('Removed');
      await load();
    } catch {
      toast.error('Could not remove');
    }
  };

  const watchId =
    watch?.youtube_id || (watch ? extractYoutubeId(watch.youtube_url) : null);

  return (
    <div className="page-stack sermons-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Sermons</h1>
          <p className="page-sub">Tap a message to watch.</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add sermon
          </Button>
        )}
      </div>

      {loading ? (
        <div className="sermon-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Video size={28} />}
          title="No sermons yet"
          description={
            canEdit
              ? 'Paste a YouTube link to add the first message.'
              : 'Check back after the next service.'
          }
        />
      ) : (
        <div className="sermon-grid">
          {rows.map((s) => {
            const id = s.youtube_id || extractYoutubeId(s.youtube_url);
            const thumb = s.thumbnail_url || (id ? youtubeThumbnail(id) : '');
            return (
              <button
                key={s.id}
                type="button"
                className="sermon-card"
                onClick={() => setWatch(s)}
              >
                <div className="sermon-media">
                  {thumb ? (
                    <img src={thumb} alt="" className="sermon-thumb" />
                  ) : (
                    <div className="sermon-thumb sermon-thumb--empty">
                      <Video size={32} />
                    </div>
                  )}
                  <div className="sermon-veil" />
                  <span className="sermon-play" aria-hidden>
                    <Play size={28} fill="currentColor" />
                  </span>
                  {s.series && <span className="sermon-series">{s.series}</span>}
                </div>
                <div className="sermon-meta">
                  <h3>{s.title}</h3>
                  <p>
                    {[s.preacher, formatDate(s.preached_at)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {canEdit && (
                    <span
                      className="sermon-del"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => void remove(s.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void remove(s.id, e as unknown as React.MouseEvent);
                      }}
                    >
                      <Trash2 size={14} /> Remove
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add sermon">
        <form onSubmit={create} className="form-stack">
          <Input
            label="YouTube link"
            value={form.youtube_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, youtube_url: e.target.value }))
            }
            placeholder="https://youtube.com/watch?v=…"
            required
          />
          {previewId && (
            <img
              src={youtubeThumbnail(previewId)}
              alt=""
              className="sermon-form-preview"
            />
          )}
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Input
            label="Preacher"
            value={form.preacher}
            onChange={(e) =>
              setForm((f) => ({ ...f, preacher: e.target.value }))
            }
          />
          <Input
            label="Series"
            value={form.series}
            onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))}
          />
          <Input
            label="Date preached"
            type="date"
            value={form.preached_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, preached_at: e.target.value }))
            }
          />
          <TextArea
            label="Description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save sermon'}
          </Button>
        </form>
      </Modal>

      <VideoWatchOverlay
        open={!!watch}
        youtubeId={watchId}
        title={watch?.title}
        subtitle={[watch?.preacher, formatDate(watch?.preached_at)]
          .filter(Boolean)
          .join(' · ')}
        onClose={() => setWatch(null)}
      />

      <style>{`
        .sermons-page .page-header-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .page-title { margin: 0; font-size: 1.4rem; }
        .page-sub { margin: 4px 0 0; opacity: 0.7; }
        .sermon-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        }
        @media (max-width: 560px) {
          .sermon-grid { grid-template-columns: 1fr; gap: 14px; }
        }
        .sermon-card {
          border: 0;
          padding: 0;
          text-align: left;
          background: var(--surface, #fff);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(20, 16, 12, 0.08);
          transition: transform .18s ease, box-shadow .18s ease;
          color: inherit;
          display: flex;
          flex-direction: column;
        }
        .sermon-card:active { transform: scale(0.985); }
        @media (hover: hover) {
          .sermon-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 32px rgba(20, 16, 12, 0.12);
          }
          .sermon-card:hover .sermon-play {
            transform: translate(-50%, -50%) scale(1.08);
          }
        }
        .sermon-media {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #141210;
          overflow: hidden;
        }
        .sermon-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sermon-thumb--empty {
          display: grid;
          place-items: center;
          color: rgba(255,255,255,.45);
          height: 100%;
        }
        .sermon-veil {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 35%, rgba(0,0,0,.55) 100%);
          pointer-events: none;
        }
        .sermon-play {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 64px;
          height: 64px;
          border-radius: 999px;
          background: rgba(255,255,255,.94);
          color: #1a1410;
          display: grid;
          place-items: center;
          box-shadow: 0 8px 24px rgba(0,0,0,.35);
          transition: transform .18s ease;
          padding-left: 3px;
        }
        .sermon-series {
          position: absolute;
          left: 12px;
          bottom: 12px;
          z-index: 1;
          font-size: .72rem;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #fff;
          background: rgba(0,0,0,.45);
          padding: 5px 10px;
          border-radius: 999px;
          backdrop-filter: blur(6px);
        }
        .sermon-meta {
          padding: 14px 16px 16px;
        }
        .sermon-meta h3 {
          margin: 0 0 4px;
          font-size: 1.08rem;
          line-height: 1.3;
        }
        .sermon-meta p {
          margin: 0;
          font-size: .9rem;
          opacity: .7;
        }
        .sermon-del {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          font-size: .8rem;
          opacity: .65;
          color: #b42318;
        }
        .sermon-form-preview {
          width: 100%;
          border-radius: 10px;
          max-height: 160px;
          object-fit: cover;
        }
        .form-stack { display: flex; flex-direction: column; gap: 12px; }
      `}</style>
    </div>
  );
}
