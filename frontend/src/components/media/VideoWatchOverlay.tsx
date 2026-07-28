import { useEffect } from 'react';
import { X } from 'lucide-react';
import { youtubeEmbedUrl } from '../../utils/youtube';

type Props = {
  open: boolean;
  youtubeId: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** Live streams — show LIVE badge */
  live?: boolean;
};

/**
 * Full-screen video watcher — works on phone (tap card → watch inline).
 * Not a slide panel; video needs the full viewport.
 */
export function VideoWatchOverlay({
  open,
  youtubeId,
  title,
  subtitle,
  onClose,
  live,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !youtubeId) return null;

  return (
    <div className="vwo" role="dialog" aria-modal="true" aria-label={title || 'Video'}>
      <div className="vwo-bar">
        <div className="vwo-bar-text">
          {live && <span className="vwo-live">LIVE</span>}
          <div>
            {title && <strong>{title}</strong>}
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <button type="button" className="vwo-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>
      <div className="vwo-stage">
        <div className="vwo-frame">
          <iframe
            key={youtubeId}
            title={title || 'Video'}
            src={youtubeEmbedUrl(youtubeId, { autoplay: true })}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
      <style>{`
        .vwo {
          position: fixed;
          inset: 0;
          z-index: 12000;
          background: #0b0b0c;
          display: flex;
          flex-direction: column;
          animation: vwo-in .22s ease;
        }
        @keyframes vwo-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vwo-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: max(12px, env(safe-area-inset-top)) 14px 10px;
          color: #f5f5f4;
        }
        .vwo-bar-text {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          min-width: 0;
        }
        .vwo-bar-text strong {
          display: block;
          font-size: 1rem;
          line-height: 1.3;
        }
        .vwo-bar-text p {
          margin: 2px 0 0;
          opacity: .7;
          font-size: .85rem;
        }
        .vwo-live {
          flex-shrink: 0;
          margin-top: 2px;
          background: #b42318;
          color: #fff;
          font-size: .68rem;
          font-weight: 800;
          letter-spacing: .06em;
          padding: 4px 8px;
          border-radius: 999px;
        }
        .vwo-close {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .vwo-stage {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 0 max(12px, env(safe-area-inset-bottom));
          min-height: 0;
        }
        .vwo-frame {
          width: 100%;
          max-width: 1100px;
          aspect-ratio: 16 / 9;
          background: #000;
          position: relative;
        }
        @media (max-width: 720px) {
          .vwo-frame {
            width: 100%;
            max-width: none;
            aspect-ratio: auto;
            height: min(56.25vw, calc(100dvh - 96px));
            min-height: 220px;
          }
        }
        .vwo-frame iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
      `}</style>
    </div>
  );
}

export default VideoWatchOverlay;
