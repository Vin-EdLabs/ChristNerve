import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { io, Socket } from 'socket.io-client';

type ReactionType = 'amen' | 'fire' | 'love' | 'peace';

type ReactionCounts = Record<ReactionType, number>;

type Props = {
  churchId: number;
  serviceId: string;
  active?: boolean;
};

const REACTIONS: Array<{ key: ReactionType; emoji: string; label: string }> = [
  { key: 'amen', emoji: '🙏', label: 'Amen' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'peace', emoji: '🕊️', label: 'Peace' },
];

function formatCount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }
  return String(value);
}

export function LiveReactionBar({ churchId, serviceId, active = false }: Props) {
  const { user, accountType } = useAuth();
  const [counts, setCounts] = useState<ReactionCounts>({
    amen: 0,
    fire: 0,
    love: 0,
    peace: 0,
  });
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [floating, setFloating] = useState<Array<{ id: number; key: ReactionType }>>([]);
  const socketRef = useRef<Socket | null>(null);
  const idRef = useRef(0);

  const roomName = useMemo(() => `live:${churchId || 0}`, [churchId]);

  useEffect(() => {
    if (!churchId || !active) return;

    let mounted = true;

    const socket = io(undefined, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
    });

    socketRef.current = socket;
    socket.emit('join-live-room', roomName);

    socket.on('reaction:update', (payload: ReactionCounts) => {
      if (!mounted) return;
      setCounts(payload);
    });

    void api.get(`/church-life/live/reactions/${churchId}/${encodeURIComponent(serviceId)}`).then((res) => {
      if (!mounted) return;
      setCounts((prev) => ({ ...prev, ...res.data }));
    }).catch(() => undefined);

    return () => {
      mounted = false;
      socket.off('reaction:update');
      socket.disconnect();
    };
  }, [active, churchId, roomName, serviceId]);

  const handleReaction = async (reaction: ReactionType) => {
    if (!churchId || !active) return;

    setCounts((prev) => ({ ...prev, [reaction]: prev[reaction] + 1 }));
    setActiveReaction(reaction);
    setFloating((prev) => [...prev, { id: ++idRef.current, key: reaction }]);
    window.setTimeout(() => {
      setActiveReaction((prev) => (prev === reaction ? null : prev));
    }, 350);
    window.setTimeout(() => {
      setFloating((prev) => prev.filter((item) => item.id !== idRef.current));
    }, 800);

    try {
      await api.post('/church-life/live/react', {
        church_id: churchId,
        service_id: serviceId,
        reaction_type: reaction,
        member_id: accountType === 'member' ? user?.id ?? null : null,
      });
    } catch {
      setCounts((prev) => ({ ...prev, [reaction]: Math.max(0, prev[reaction] - 1) }));
    }
  };

  if (!active) return null;

  return (
    <div className="live-reaction-bar">
      <div className="live-reaction-buttons">
        {REACTIONS.map((reaction) => {
          const isActive = activeReaction === reaction.key;
          return (
            <button
              key={reaction.key}
              type="button"
              className={`live-reaction-button${isActive ? ' is-active' : ''}`}
              onClick={() => void handleReaction(reaction.key)}
              aria-label={`React ${reaction.label}`}
            >
              <span className="live-reaction-emoji">{reaction.emoji}</span>
              <span className="live-reaction-count">{formatCount(counts[reaction.key])}</span>
              <span className="live-reaction-label">{reaction.label}</span>
              {floating.some((item) => item.key === reaction.key) && (
                <span className="live-reaction-float">+1</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="live-reaction-status">
        <span className="live-reaction-dot" /> LIVE • 1,247 watching
      </div>
      <style>{`
        .live-reaction-bar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 24px;
          border-top: 1px solid var(--border, #e8e4dc);
          background: var(--bg-secondary, #f7f4ef);
          border-radius: 0 0 18px 18px;
        }
        .live-reaction-buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .live-reaction-button {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-width: 56px;
          min-height: 56px;
          padding: 8px 10px;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          border-radius: 999px;
          transition: transform .18s ease, background-color .18s ease;
          touch-action: manipulation;
        }
        .live-reaction-button:hover {
          background: var(--bg-surface, #fff);
        }
        .live-reaction-button.is-active {
          animation: reactionBounce .35s ease;
        }
        .live-reaction-button:active {
          transform: scale(0.95);
        }
        .live-reaction-emoji {
          font-size: 32px;
          line-height: 1;
        }
        .live-reaction-count {
          font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
        }
        .live-reaction-label {
          font-size: 12px;
          color: var(--text-muted, #8f8780);
        }
        .live-reaction-float {
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 14px;
          font-weight: 700;
          color: #b42318;
          animation: floatUp .8s ease-out forwards;
          pointer-events: none;
        }
        .live-reaction-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-muted, #8f8780);
        }
        .live-reaction-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ff3b30;
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.6);
          animation: livePulse 1.2s infinite;
        }
        @keyframes reactionBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.5); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes floatUp {
          0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -40px) scale(1.3); }
        }
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(255, 59, 48, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
        }
        @media (max-width: 640px) {
          .live-reaction-bar { padding: 16px 16px 18px; }
          .live-reaction-buttons { gap: 18px; }
          .live-reaction-emoji { font-size: 28px; }
        }
      `}</style>
    </div>
  );
}
