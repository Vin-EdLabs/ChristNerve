import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Heart, MessagesSquare, Play, Plus, Trash2 } from 'lucide-react';
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
import { resolveMediaUrl } from '../../utils/mediaUrl';
import {
  extractYoutubeId,
  youtubeEmbedUrl,
  youtubeThumbnail,
} from '../../utils/youtube';

type FeedPost = {
  id: number;
  body: string;
  image_url?: string | null;
  video_url?: string | null;
  created_at?: string;
  amen_count?: number;
  love_count?: number;
  fire_count?: number;
  my_reaction?: string | null;
};

type Reaction = 'amen' | 'love' | 'fire';

export default function ChurchFeedPage() {
  const { accountType, user } = useAuth();
  const canEdit = canEditChurchMedia(accountType, user?.role);
  const [rows, setRows] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);

  const videoPreviewId = useMemo(
    () => extractYoutubeId(videoUrl),
    [videoUrl]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/church-life/feed');
      setRows(asList<FeedPost>(res.data));
    } catch {
      toast.error('Failed to load feed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleImagePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      toast.error('Write something first');
      return;
    }
    if (videoUrl.trim() && !extractYoutubeId(videoUrl)) {
      toast.error('Paste a valid YouTube link for the video');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('body', body.trim());
      formData.append('video_url', videoUrl.trim());
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await api.post('/church-life/feed', formData);
      toast.success('Posted');
      setOpen(false);
      setBody('');
      setVideoUrl('');
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setImageFile(null);
      await load();
    } catch {
      toast.error('Could not post');
    } finally {
      setSaving(false);
    }
  };

  const react = async (id: number, reaction: Reaction) => {
    try {
      await api.post(`/church-life/feed/${id}/react`, { reaction });
      await load();
    } catch {
      toast.error('Could not react');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/church-life/feed/${id}`);
      toast.success('Deleted');
      await load();
    } catch {
      toast.error('Could not delete');
    }
  };

  return (
    <div className="page-stack feed-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Church Feed</h1>
          <p className="page-sub">Photos, videos & updates from the family.</p>
        </div>
        {canEdit && (
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus size={16} /> New post
          </Button>
        )}
      </div>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare size={28} />}
          title="Feed is quiet"
          description={
            canEdit
              ? 'Share a word, photo, or YouTube clip from service.'
              : 'Posts from the church will appear here.'
          }
        />
      ) : (
        <div className="feed-list">
          {rows.map((p) => {
            const img = resolveMediaUrl(p.image_url || undefined);
            const vid = extractYoutubeId(p.video_url || '');
            return (
              <article key={p.id} className="card glass-card feed-post">
                <p className="feed-body">{p.body}</p>
                {vid && (
                  <button
                    type="button"
                    className="feed-video"
                    onClick={() => setWatchId(vid)}
                  >
                    <img src={youtubeThumbnail(vid)} alt="" />
                    <span className="feed-play">
                      <Play size={26} fill="currentColor" />
                    </span>
                  </button>
                )}
                {img && !vid && <img src={img} alt="" className="feed-img" />}
                {img && vid && <img src={img} alt="" className="feed-img" />}
                <div className="feed-reacts">
                  <button
                    type="button"
                    className={`react-btn${p.my_reaction === 'amen' ? ' on' : ''}`}
                    onClick={() => void react(p.id, 'amen')}
                  >
                    Amen {p.amen_count || 0}
                  </button>
                  <button
                    type="button"
                    className={`react-btn${p.my_reaction === 'love' ? ' on' : ''}`}
                    onClick={() => void react(p.id, 'love')}
                  >
                    <Heart size={14} /> {p.love_count || 0}
                  </button>
                  <button
                    type="button"
                    className={`react-btn${p.my_reaction === 'fire' ? ' on' : ''}`}
                    onClick={() => void react(p.id, 'fire')}
                  >
                    <Flame size={14} /> {p.fire_count || 0}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="react-btn danger"
                      onClick={() => void remove(p.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New feed post">
        <form onSubmit={create} className="form-stack">
          <TextArea
            label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
          />
          <Input
            label="YouTube video (optional)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
          />
          {videoPreviewId && (
            <div className="feed-form-preview">
              <iframe
                title="Preview"
                src={youtubeEmbedUrl(videoPreviewId)}
                allowFullScreen
              />
            </div>
          )}
          <div className="feed-upload-card">
            <label className="feed-upload-label" htmlFor="feed-image">Image upload (optional)</label>
            <input
              id="feed-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImagePick}
            />
            {imagePreview && <img src={imagePreview} alt="Preview" className="feed-upload-preview" />}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Posting…' : 'Post'}
          </Button>
        </form>
      </Modal>

      <VideoWatchOverlay
        open={!!watchId}
        youtubeId={watchId}
        title="Church Feed"
        onClose={() => setWatchId(null)}
      />

      <style>{`
        .feed-page .page-header-row {
          display:flex; justify-content:space-between; gap:12px;
          align-items:flex-start; margin-bottom:16px;
        }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .feed-list { display:flex; flex-direction:column; gap:14px; }
        .feed-post { padding:16px; }
        .feed-body { margin:0; white-space:pre-wrap; line-height:1.5; }
        .feed-img {
          width:100%; margin-top:12px; border-radius:12px;
          max-height:360px; object-fit:cover;
        }
        .feed-video {
          position: relative;
          display: block;
          width: 100%;
          margin-top: 12px;
          border: 0;
          padding: 0;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background: #111;
        }
        .feed-video img {
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          display: block;
        }
        .feed-play {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 58px; height: 58px;
          border-radius: 999px;
          background: rgba(255,255,255,.95);
          color: #1a1410;
          display: grid; place-items: center;
          padding-left: 3px;
          box-shadow: 0 8px 20px rgba(0,0,0,.35);
        }
        .feed-reacts { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
        .react-btn {
          border:1px solid rgba(0,0,0,.12); background:transparent;
          border-radius:999px; padding:6px 12px; font-size:.85rem;
          display:inline-flex; align-items:center; gap:6px; cursor:pointer;
        }
        .react-btn.on {
          background: rgba(180, 90, 40, .12);
          border-color: rgba(180, 90, 40, .35);
        }
        .react-btn.danger { margin-left:auto; }
        .form-stack { display:flex; flex-direction:column; gap:12px; }
        .feed-form-preview {
          position: relative; width: 100%; aspect-ratio: 16/9;
          border-radius: 10px; overflow: hidden; background: #000;
        }
        .feed-form-preview iframe {
          position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
        }
        .feed-upload-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 12px;
          background: rgba(255,255,255,.5);
        }
        .feed-upload-label {
          font-size: .9rem;
          font-weight: 600;
        }
        .feed-upload-card input[type="file"] {
          font: inherit;
        }
        .feed-upload-preview {
          width: 100%;
          max-height: 220px;
          object-fit: cover;
          border-radius: 10px;
          display: block;
        }
      `}</style>
    </div>
  );
}
