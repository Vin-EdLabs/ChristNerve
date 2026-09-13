import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../../services/api';
import type { LiveRoom } from '../../types/live';
import { roomTypeMeta } from '../../utils/liveRooms';

const POLL_MS = 30_000;

/** Small "Live Now" promo card for staff + member dashboards — renders nothing when no room is live. */
export function LiveNowCard() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/live/rooms/active');
        if (!cancelled) setRoom(res.data?.room || null);
      } catch {
        /* silent — optional widget */
      }
    };
    void load();
    timerRef.current = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (!room) return null;
  const meta = roomTypeMeta(room.room_type);

  return (
    <button type="button" className="live-now-card" onClick={() => navigate(`/live-rooms/${room.id}`)}>
      <div className="live-now-badge">
        <span className="live-now-dot" /> LIVE NOW
      </div>
      <div className="live-now-body">
        <span className="live-now-icon" style={{ background: `${meta.color}1f`, color: meta.color }}>
          <meta.icon size={20} strokeWidth={2} />
        </span>
        <div className="live-now-copy">
          <strong>{room.name}</strong>
          <span className="live-now-meta">
            {meta.label} · <Users size={12} /> {room.participant_count ?? 0} in the room
          </span>
        </div>
      </div>
      <span className="live-now-cta">Join Now</span>

      <style>{`
        .live-now-card {
          width: 100%; text-align: left; cursor: pointer;
          border: 1px solid rgba(180,35,24,.3); border-radius: 16px;
          background: linear-gradient(135deg, rgba(180,35,24,.08), rgba(180,35,24,.02));
          padding: 14px 16px; display: flex; align-items: center; gap: 14px;
          flex-wrap: wrap; margin-bottom: 16px;
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .live-now-card:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(180,35,24,.12); }
        .live-now-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: .68rem; font-weight: 800; letter-spacing: .06em;
          color: #fff; background: #b42318; padding: 4px 9px; border-radius: 999px;
        }
        .live-now-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: lnPulse 1.2s infinite; }
        @keyframes lnPulse { 50% { opacity: .35; } }
        .live-now-body { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 180px; }
        .live-now-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: grid; place-items: center;
        }
        .live-now-copy { display: flex; flex-direction: column; }
        .live-now-copy strong { font-size: .95rem; }
        .live-now-meta { display: inline-flex; align-items: center; gap: 4px; font-size: .78rem; opacity: .7; }
        .live-now-cta {
          margin-left: auto; font-weight: 700; font-size: .84rem; color: #b42318;
        }
      `}</style>
    </button>
  );
}

export default LiveNowCard;
