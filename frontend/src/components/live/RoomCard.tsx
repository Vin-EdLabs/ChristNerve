import React from 'react';
import { Users, Radio, Square, Trash2, Play } from 'lucide-react';
import { Button } from '../ui/Button';
import type { LiveRoom } from '../../types/live';
import { formatRoomSchedule, roomTypeMeta } from '../../utils/liveRooms';

export interface RoomCardProps {
  room: LiveRoom;
  canManage: boolean;
  onJoin: (room: LiveRoom) => void;
  onStart?: (room: LiveRoom) => void;
  onEnd?: (room: LiveRoom) => void;
  onDelete?: (room: LiveRoom) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, canManage, onJoin, onStart, onEnd, onDelete }) => {
  const meta = roomTypeMeta(room.room_type);
  const isLive = room.status === 'live';
  const isEnded = room.status === 'ended';
  const isScheduled = room.status === 'scheduled';
  const mayManageThis = canManage || room.is_host;

  return (
    <article className={`room-card${isLive ? ' room-card--live' : ''}${isEnded ? ' room-card--ended' : ''}`}>
      <div className="room-card-top">
        <span className="room-card-icon" style={{ background: `${meta.color}1f`, color: meta.color }}>
          <meta.icon size={20} strokeWidth={2} />
        </span>
        {isLive && (
          <span className="room-card-live-pill">
            <span className="room-card-live-dot" /> LIVE
          </span>
        )}
      </div>

      <h3 className="room-card-name">{room.name}</h3>
      <p className="room-card-type">{meta.label}</p>
      {room.description && <p className="room-card-desc">{room.description}</p>}

      <div className="room-card-meta">
        <span>{formatRoomSchedule(room)}</span>
        <span className="room-card-attendees">
          <Users size={13} />
          {isLive
            ? `${room.participant_count ?? 0} watching`
            : isEnded
              ? `${room.attendee_count ?? 0} attended`
              : `Up to ${room.max_participants}`}
        </span>
      </div>

      <div className="room-card-actions">
        {isLive && (
          <Button variant="primary" size="sm" onClick={() => onJoin(room)}>
            <Play size={14} /> Join
          </Button>
        )}
        {isScheduled && (
          <>
            <Button variant="outline" size="sm" onClick={() => onJoin(room)}>
              Join
            </Button>
            {mayManageThis && onStart && (
              <Button variant="primary" size="sm" onClick={() => onStart(room)}>
                <Radio size={14} /> Start Now
              </Button>
            )}
          </>
        )}
        {isEnded && (
          <span className="room-card-ended-label">This room has ended</span>
        )}
        {mayManageThis && isLive && onEnd && (
          <Button variant="danger" size="sm" onClick={() => onEnd(room)}>
            <Square size={13} /> End
          </Button>
        )}
        {mayManageThis && isScheduled && onDelete && (
          <button type="button" className="room-card-delete" onClick={() => onDelete(room)} aria-label="Delete room">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <style>{`
        .room-card {
          background: var(--bg-surface, #fff);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .room-card--live {
          border-color: rgba(180, 35, 24, 0.35);
          box-shadow: 0 8px 24px rgba(180, 35, 24, 0.08);
        }
        .room-card--ended { opacity: .7; }
        .room-card-top { display: flex; align-items: center; justify-content: space-between; }
        .room-card-icon {
          width: 40px; height: 40px; border-radius: 12px;
          display: grid; place-items: center; flex-shrink: 0;
        }
        .room-card-live-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px; border-radius: 999px; background: #b42318;
          color: #fff; font-weight: 700; font-size: .68rem; letter-spacing: .05em;
        }
        .room-card-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: rcLivePulse 1.2s infinite; }
        @keyframes rcLivePulse { 50% { opacity: .35; } }
        .room-card-name { margin: 0; font-size: 1.02rem; }
        .room-card-type { margin: 0; font-size: .78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
        .room-card-desc { margin: 0; font-size: .85rem; color: var(--text-secondary); line-height: 1.4; }
        .room-card-meta {
          display: flex; align-items: center; justify-content: space-between;
          font-size: .8rem; color: var(--text-muted); margin-top: 4px;
        }
        .room-card-attendees { display: inline-flex; align-items: center; gap: 4px; }
        .room-card-actions { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .room-card-ended-label { font-size: .8rem; color: var(--text-muted); }
        .room-card-delete {
          margin-left: auto; border: 0; background: transparent; color: var(--text-muted);
          cursor: pointer; padding: 6px; border-radius: 8px; display: grid; place-items: center;
        }
        .room-card-delete:hover { background: var(--bg-secondary); color: #b42318; }
      `}</style>
    </article>
  );
};

export default RoomCard;
