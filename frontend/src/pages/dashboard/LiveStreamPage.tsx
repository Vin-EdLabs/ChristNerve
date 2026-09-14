import { FormEvent, useEffect, useMemo, useState } from 'react';

import { Play, Radio } from 'lucide-react';

import toast from 'react-hot-toast';

import api from '../../services/api';

import { useAuth } from '../../contexts/AuthContext';

import { Button } from '../../components/ui/Button';

import { Input } from '../../components/ui/Input';

import { EmptyState } from '../../components/ui/EmptyState';

import { Spinner } from '../../components/ui/Spinner';

import { canEditChurchMedia } from '../../utils/churchLife';
import { LiveReactionBar } from '../../components/live/LiveReactionBar';
import { LiveComments } from '../../components/live/LiveComments';

import {

  extractYoutubeId,
  youtubeEmbedUrl,
  youtubeThumbnail,

} from '../../utils/youtube';
import { useCachedQuery } from '../../utils/useCachedQuery';



type LiveState = {

  live_stream_url?: string | null;

  live_stream_active?: boolean;

};

type PastStream = {
  id: number;
  youtube_url: string;
  started_at: string;
  ended_at: string;
};



export default function LiveStreamPage() {

  const { accountType, user, tenant } = useAuth();

  const canEdit = canEditChurchMedia(accountType, user?.role);

  const [saving, setSaving] = useState(false);

  const [url, setUrl] = useState('');

  const [active, setActive] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);

  const [watching, setWatching] = useState(false);

  const { data: liveData, loading, setData } = useCachedQuery<LiveState>(
    'live-stream',
    async () => {
      try {
        const res = await api.get('/church-life/live');
        return (res.data?.data || res.data || {}) as LiveState;
      } catch {
        toast.error('Failed to load live stream');
        return {};
      }
    }
  );

  const { data: history = [], refetch: refetchHistory } = useCachedQuery<PastStream[]>(
    'live-stream-history',
    async () => {
      try {
        const res = await api.get('/church-life/live/history');
        return res.data?.data || [];
      } catch {
        /* history is a nice-to-have, fail quietly */
        return [];
      }
    }
  );

  useEffect(() => {
    if (liveData) {
      setUrl((prev) => {
        if (liveData.live_stream_url !== prev) setWatching(false);
        return liveData.live_stream_url || '';
      });
      setActive(!!liveData.live_stream_active);
    }
  }, [liveData]);



  const ytId = useMemo(() => extractYoutubeId(url), [url]);



  const save = async (e?: FormEvent, nextActive?: boolean) => {

    e?.preventDefault();

    setSaving(true);

    try {

      const res = await api.put('/church-life/live', {

        live_stream_url: url.trim() || null,

        live_stream_active:

          typeof nextActive === 'boolean' ? nextActive : active,

      });

      const data = (res.data?.data || res.data || {}) as LiveState;

      setUrl(data.live_stream_url || url);

      setActive(!!data.live_stream_active);

      setData(data);

      toast.success(

        data.live_stream_active ? 'Live is ON — members notified' : 'Saved'

      );

      refetchHistory();

    } catch {

      toast.error('Could not update live stream');

    } finally {

      setSaving(false);

    }

  };



  if (loading) return <Spinner fullPage />;



  return (

    <div className="page-stack live-page">

      <div className="page-header-row">

        <div>

          <h1 className="page-title">Live Stream</h1>

          <p className="page-sub">

            {active

              ? `${tenant?.name || 'Church'} is live now — tap to watch`

              : 'Stream is currently off'}

          </p>

        </div>

        {active && (

          <span className="live-pill">

            <span className="live-dot" /> LIVE

          </span>

        )}

      </div>



      {active && ytId ? (

        <section className="live-stage">

          <div className="live-watch-frame">
            {watching ? (
              <iframe

                title="Live stream"

                src={youtubeEmbedUrl(ytId, { autoplay: true })}

                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"

                allowFullScreen

                loading="eager"

                referrerPolicy="strict-origin-when-cross-origin"

                className="youtube-embed"

              />
            ) : (
              // Tap-to-play instead of an eager autoplaying iframe: browsers silently
              // block unmuted autoplay without a real user gesture, so the embedded
              // player used to sit there buffering/blocked for a long time — which is
              // exactly what read as "the page is stuck loading". A poster + explicit
              // click both makes the page paint instantly and gives YouTube a genuine
              // gesture to autoplay against once tapped.
              <button
                type="button"
                className="live-watch-poster"
                onClick={() => setWatching(true)}
                aria-label="Play live stream"
              >
                <img src={youtubeThumbnail(ytId)} alt="" className="live-watch-poster-img" />
                <span className="live-watch-poster-veil" />
                <span className="live-on-card">
                  <span className="live-dot" /> LIVE
                </span>
                <span className="live-play">
                  <Play size={26} fill="currentColor" />
                </span>
              </button>
            )}

          </div>

          <LiveReactionBar

            churchId={Number(tenant?.id ?? 0)}

            serviceId={ytId}

            active={active}

          />

          <LiveComments churchId={Number(tenant?.id ?? 0)} active={active} />

        </section>

      ) : !canEdit ? (

        <EmptyState

          icon={<Radio size={28} />}

          title="Not live right now"

          description="When the church goes live, you'll get a notification and can tap to watch here."

        />

      ) : (

        <EmptyState

          icon={<Radio size={28} />}

          title="Paste a YouTube live link"

          description="Then tap Go Live so members see the service instantly."

        />

      )}



      {canEdit && (

        <form

          className="card glass-card form-stack"

          onSubmit={(e) => void save(e)}

        >

          <h2>Broadcast controls</h2>

          <Input

            label="YouTube live URL"

            value={url}

            onChange={(e) => setUrl(e.target.value)}

            placeholder="https://youtube.com/live/… or watch?v="

          />

          <div className="live-actions">

            <Button type="submit" variant="outline" disabled={saving}>

              Save URL

            </Button>

            <Button

              type="button"

              disabled={saving || !url.trim()}

              onClick={() => void save(undefined, !active)}

            >

              {active ? 'Turn Live OFF' : 'Go Live'}

            </Button>

          </div>

        </form>

      )}

      {history.length > 0 && (
        <section className="card glass-card live-history">
          <button
            type="button"
            className="live-history-toggle"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span>Past broadcasts ({history.length})</span>
            <span>{historyOpen ? '−' : '+'}</span>
          </button>
          {historyOpen && (
            <ul className="live-history-list">
              {history.map((h) => {
                const started = new Date(h.started_at);
                const ended = new Date(h.ended_at);
                const durationMin = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
                return (
                  <li key={h.id}>
                    <div>
                      <strong>
                        {started.toLocaleDateString('en-GH', { dateStyle: 'medium' })}
                      </strong>
                      <span className="live-history-meta">
                        {started.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {durationMin} min
                      </span>
                    </div>
                    <a href={h.youtube_url} target="_blank" rel="noreferrer" className="live-history-watch">
                      Watch
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <style>{`

        .live-page .page-header-row {

          display:flex; justify-content:space-between; gap:12px;

          align-items:flex-start; margin-bottom:14px;

        }

        .page-title { margin:0; font-size:1.4rem; }

        .page-sub { margin:4px 0 0; opacity:.7; }

        .live-pill {

          display:inline-flex; align-items:center; gap:8px;

          padding:6px 12px; border-radius:999px; background:#b42318;

          color:#fff; font-weight:700; font-size:.8rem; letter-spacing:.04em;

        }
        .live-pill--inline {
          padding: 5px 10px;
          font-size: .74rem;
        }

        .live-dot {

          width:8px; height:8px; border-radius:50%; background:#fff;

          animation: livepulse 1.2s infinite;

        }

        @keyframes livepulse { 50% { opacity:.35; } }

        .live-stage { margin-bottom: 16px; }
        .live-watch-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 16px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 10px 24px rgba(20, 16, 12, 0.08);
        }
        .live-watch-frame iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .live-watch-poster {
          position: absolute; inset: 0; width: 100%; height: 100%;
          border: 0; padding: 0; margin: 0; cursor: pointer; background: #000;
        }
        .live-watch-poster-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .live-watch-poster-veil {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.55) 100%);
        }
        .live-watch-poster .live-on-card {
          position: absolute; left: 14px; top: 14px;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .live-watch-poster .live-play { width: 72px; height: 72px; }
        @media (hover: hover) {
          .live-watch-poster:hover .live-play { transform: translate(-50%, -50%) scale(1.08); }
        }

        .live-card {

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

          width: 100%;

        }

        .live-card:active { transform: scale(0.985); }

        @media (hover: hover) {

          .live-card:hover {

            transform: translateY(-2px);

            box-shadow: 0 14px 32px rgba(20, 16, 12, 0.12);

          }

          .live-card:hover .live-play {

            transform: translate(-50%, -50%) scale(1.08);

          }

        }

        .live-media {

          position: relative;

          aspect-ratio: 16 / 9;

          background: #141210;

          overflow: hidden;

        }

        .live-thumb {

          width: 100%;

          height: 100%;

          object-fit: cover;

          display: block;

        }

        .live-veil {

          position: absolute;

          inset: 0;

          background: linear-gradient(180deg, transparent 35%, rgba(0,0,0,.55) 100%);

          pointer-events: none;

        }

        .live-play {

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

        .live-on-card {

          position: absolute;

          left: 12px;

          top: 12px;

          z-index: 1;

          font-size: .72rem;

          font-weight: 700;

          letter-spacing: .06em;

          color: #fff;

          background: #b42318;

          padding: 5px 10px;

          border-radius: 999px;

          animation: livepulse 1.2s infinite;

        }

        .live-meta {

          padding: 14px 16px 16px;

        }

        .live-meta h3 {

          margin: 0 0 4px;

          font-size: 1.08rem;

          line-height: 1.3;

        }

        .live-meta p {

          margin: 0;

          font-size: .9rem;

          opacity: .7;

        }

        .live-tap {

          display: inline-block;

          margin-top: 8px;

          font-size: .8rem;

          opacity: .65;

        }

        .live-card--preview .live-thumb { opacity: .85; }

        .form-stack {

          display:flex; flex-direction:column; gap:12px;

          padding:16px; margin-top:8px;

        }

        .live-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .live-history { margin-top: 16px; padding: 0; overflow: hidden; }
        .live-history-toggle {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          border: 0; background: transparent; padding: 16px; font-size: 14px; font-weight: 700;
          cursor: pointer; color: inherit;
        }
        .live-history-list { list-style: none; margin: 0; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 4px; }
        .live-history-list li {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          padding: 10px 0; border-top: 1px solid var(--border, #e8e4dc);
        }
        .live-history-meta { display: block; font-size: 12px; opacity: .6; margin-top: 2px; }
        .live-history-watch { font-size: 13px; font-weight: 600; color: var(--accent, #2d1b69); white-space: nowrap; }

      `}</style>

    </div>

  );

}


