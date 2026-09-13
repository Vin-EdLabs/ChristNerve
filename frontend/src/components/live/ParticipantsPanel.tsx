import { Crown, Mic, MicOff, Video, VideoOff, Users, X } from 'lucide-react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import type { LiveRoom } from '../../types/live';
import { colorForName, initialsOf, isRoomHost, parseParticipantMeta, roleLabelFor } from '../../utils/liveRooms';

export interface ParticipantsPanelProps {
  room: LiveRoom;
  isModerator: boolean;
  onMute: (identity: string) => void;
  onRemove: (identity: string) => void;
  onClose: () => void;
}

export function ParticipantsPanel({ room, isModerator, onMute, onRemove, onClose }: ParticipantsPanelProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const sorted = [...participants].sort((a, b) => {
    const hostA = isRoomHost(room, a) ? 0 : 1;
    const hostB = isRoomHost(room, b) ? 0 : 1;
    if (hostA !== hostB) return hostA - hostB;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  return (
    <div className="participants-panel">
      <header className="participants-panel-header">
        <Users size={15} />
        <span>In This Room ({participants.length})</span>
        <button type="button" className="side-panel-close" onClick={onClose} aria-label="Close">
          <X size={17} />
        </button>
      </header>

      <ul className="participants-panel-list">
        {sorted.map((p) => {
          const isSelf = p.identity === localParticipant?.identity;
          const host = isRoomHost(room, p);
          const meta = parseParticipantMeta(p);
          const name = p.name || p.identity;
          const roleLabel = roleLabelFor(meta, host);
          const showActions = isModerator && !isSelf;

          return (
            <li key={p.identity} className="participant-row">
              <span className="participant-avatar" style={{ background: colorForName(name) }}>
                {initialsOf(name)}
              </span>
              <div className="participant-info">
                <span className="participant-name">
                  {name}
                  {isSelf ? ' (You)' : ''}
                  {host && <Crown size={13} className="participant-crown" />}
                </span>
                <span className="participant-role">{roleLabel}</span>
              </div>
              <div className="participant-status">
                <span className={`participant-status-icon${p.isMicrophoneEnabled ? ' is-on' : ' is-off'}`}>
                  {p.isMicrophoneEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                </span>
                <span className={`participant-status-icon${p.isCameraEnabled ? ' is-on' : ' is-off'}`}>
                  {p.isCameraEnabled ? <Video size={13} /> : <VideoOff size={13} />}
                </span>
              </div>
              {showActions && (
                <div className="participant-actions">
                  <button type="button" onClick={() => onMute(p.identity)} disabled={!p.isMicrophoneEnabled}>
                    Mute
                  </button>
                  <button type="button" className="is-danger" onClick={() => onRemove(p.identity)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <style>{`
        .participants-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; color: #f5f3f0; }
        .participants-panel-header {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; font-size: .82rem; font-weight: 700;
          border-bottom: 1px solid rgba(255,255,255,.08); flex-shrink: 0;
        }
        .side-panel-close {
          margin-left: auto; border: 0; background: transparent; color: rgba(245,243,240,.65);
          cursor: pointer; padding: 4px; display: grid; place-items: center; border-radius: 6px;
        }
        .side-panel-close:hover { background: rgba(255,255,255,.08); color: #fff; }
        .participants-panel-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; min-height: 0; }
        .participant-row {
          display: flex; align-items: center; gap: 10px; padding: 8px;
          border-radius: 10px; flex-wrap: wrap;
        }
        .participant-row:hover { background: rgba(255,255,255,.05); }
        .participant-avatar {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          display: grid; place-items: center; font-size: .72rem; font-weight: 700; color: #fff;
        }
        .participant-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .participant-name {
          font-size: .86rem; font-weight: 600;
          display: flex; align-items: center; gap: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .participant-crown { color: #e8b93d; flex-shrink: 0; }
        .participant-role { font-size: .7rem; opacity: .55; }
        .participant-status { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .participant-status-icon {
          width: 22px; height: 22px; border-radius: 50%;
          display: grid; place-items: center;
        }
        .participant-status-icon.is-on { color: #3fb96a; }
        .participant-status-icon.is-off { color: #e05a4e; }
        .participant-actions { display: flex; gap: 6px; width: 100%; margin-top: 2px; }
        .participant-actions button {
          flex: 1; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.06);
          color: #f5f3f0; border-radius: 8px; padding: 4px 8px; font-size: .72rem;
          cursor: pointer; font-weight: 600;
        }
        .participant-actions button:hover { background: rgba(255,255,255,.12); }
        .participant-actions button:disabled { opacity: .4; cursor: default; }
        .participant-actions button.is-danger { color: #ff8a7a; border-color: rgba(224,90,78,.4); }
        .participant-actions button.is-danger:hover { background: rgba(224,90,78,.18); }
      `}</style>
    </div>
  );
}

export default ParticipantsPanel;
