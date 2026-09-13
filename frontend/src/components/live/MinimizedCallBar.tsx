import { Maximize2, LogOut, PictureInPicture2, Users } from 'lucide-react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import type { LiveRoom } from '../../types/live';
import { roomTypeMeta } from '../../utils/liveRooms';
import { useElapsedTimer } from '../../utils/useElapsedTimer';
import type { UseCallPipResult } from './CallPip';

export interface MinimizedCallBarProps {
  room: LiveRoom;
  pip: UseCallPipResult;
  onReturn: () => void;
  onLeave: () => void;
}

/** Floating pill shown while a call stays connected but the user has browsed to another page. */
export function MinimizedCallBar({ room, pip, onReturn, onLeave }: MinimizedCallBarProps) {
  const participants = useParticipants();
  const { isMicrophoneEnabled } = useLocalParticipant();
  const meta = roomTypeMeta(room.room_type);
  const elapsed = useElapsedTimer(room.started_at);
  const { supported: pipSupported, active: pipActive, toggle: togglePip } = pip;

  return (
    <div className="mcb-bar" role="status">
      <button type="button" className="mcb-main" onClick={onReturn}>
        <span className="mcb-icon" style={{ background: `${meta.color}2e`, color: meta.color }}>
          <meta.icon size={16} strokeWidth={2} />
        </span>
        <span className="mcb-copy">
          <strong>{room.name}</strong>
          <span className="mcb-meta">
            <span className="mcb-live-dot" /> {elapsed} · <Users size={11} /> {participants.length}
            {!isMicrophoneEnabled ? ' · muted' : ''}
          </span>
        </span>
      </button>
      {pipSupported && (
        <button
          type="button"
          className={`mcb-action${pipActive ? ' is-active' : ''}`}
          onClick={togglePip}
          aria-label="Float this call in a window"
          title="Float this call in a window"
        >
          <PictureInPicture2 size={15} />
        </button>
      )}
      <button type="button" className="mcb-action" onClick={onReturn} aria-label="Return to call">
        <Maximize2 size={16} />
      </button>
      <button type="button" className="mcb-action mcb-leave" onClick={onLeave} aria-label="Leave call">
        <LogOut size={16} />
      </button>

      <style>{`
        .mcb-bar {
          position: fixed; right: 20px; bottom: 20px; z-index: 250;
          display: flex; align-items: center; gap: 6px;
          background: rgba(18,16,15,.96); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,.1); border-radius: 999px;
          padding: 6px 8px 6px 6px; box-shadow: 0 14px 34px rgba(0,0,0,.45);
          animation: mcbIn .25s ease both;
          max-width: calc(100vw - 32px);
        }
        @keyframes mcbIn { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .mcb-main {
          display: flex; align-items: center; gap: 10px; border: 0; background: transparent;
          cursor: pointer; padding: 4px 6px; border-radius: 999px; min-width: 0;
        }
        .mcb-main:hover { background: rgba(255,255,255,.06); }
        .mcb-icon {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: grid; place-items: center;
        }
        .mcb-copy { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
        .mcb-copy strong {
          color: #fff; font-size: .82rem; max-width: 160px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcb-meta {
          display: inline-flex; align-items: center; gap: 4px;
          color: rgba(255,255,255,.6); font-size: .7rem; font-variant-numeric: tabular-nums;
        }
        .mcb-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff4d3d; animation: mcbPulse 1.2s infinite; }
        @keyframes mcbPulse { 50% { opacity: .35; } }
        .mcb-action {
          width: 34px; height: 34px; border-radius: 50%; border: 0; flex-shrink: 0;
          background: rgba(255,255,255,.08); color: #fff; cursor: pointer;
          display: grid; place-items: center; transition: background-color .15s ease;
        }
        .mcb-action:hover { background: rgba(255,255,255,.16); }
        .mcb-action.is-active { background: var(--vr-accent, #7c5cbf); }
        .mcb-leave { background: rgba(180,35,24,.3); color: #ff9c8f; }
        .mcb-leave:hover { background: rgba(180,35,24,.5); }
        @media (max-width: 640px) {
          .mcb-bar { right: 12px; bottom: calc(12px + var(--mobile-tabbar-height, 64px)); }
          .mcb-copy strong { max-width: 110px; }
        }
      `}</style>
    </div>
  );
}

export default MinimizedCallBar;
