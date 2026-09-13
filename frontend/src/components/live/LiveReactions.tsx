import { useCallback, useRef, useState } from 'react';
import { useDataChannel, useLocalParticipant } from '@livekit/components-react';

export type ReactionKey = 'amen' | 'fire' | 'love' | 'praise' | 'laugh';

export const REACTIONS: Array<{ key: ReactionKey; emoji: string; label: string }> = [
  { key: 'amen', emoji: '🙏', label: 'Amen' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'praise', emoji: '🙌', label: 'Praise' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
];

type FloatingReaction = {
  id: number;
  key: ReactionKey;
  name: string;
  x: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** DataChannel-backed reactions: send/receive + the floating queue to render. */
export function useReactionChannel() {
  const { localParticipant } = useLocalParticipant();
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const idRef = useRef(0);

  const spawn = useCallback((key: ReactionKey, name: string) => {
    const id = ++idRef.current;
    const x = 42 + Math.random() * 16; // jitter near bottom-center
    setFloating((prev) => [...prev.slice(-24), { id, key, name, x }]);
    window.setTimeout(() => {
      setFloating((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  }, []);

  const { send } = useDataChannel('reaction', (msg) => {
    try {
      const payload = JSON.parse(decoder.decode(msg.payload)) as { key: ReactionKey; name: string };
      if (REACTIONS.some((r) => r.key === payload.key)) spawn(payload.key, payload.name || 'Someone');
    } catch {
      /* ignore malformed */
    }
  });

  const react = useCallback(
    (key: ReactionKey) => {
      const name = localParticipant?.name || 'You';
      spawn(key, name);
      void send(encoder.encode(JSON.stringify({ key, name })), { reliable: false });
    },
    [localParticipant, send, spawn]
  );

  return { floating, react };
}

/** The floating "🙏 Akosua" pills that rise from bottom-center of the stage. */
export function ReactionsOverlay({ floating }: { floating: FloatingReaction[] }) {
  return (
    <div className="reactions-overlay" aria-hidden>
      {floating.map((r) => {
        const meta = REACTIONS.find((x) => x.key === r.key);
        return (
          <span key={r.id} className="reactions-overlay-pill" style={{ left: `${r.x}%` }}>
            <span className="reactions-overlay-emoji">{meta?.emoji}</span>
            <span className="reactions-overlay-name">{r.name}</span>
          </span>
        );
      })}

      <style>{`
        .reactions-overlay { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 25; }
        .reactions-overlay-pill {
          position: absolute; bottom: 70px;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 999px;
          background: rgba(20,18,16,.55); backdrop-filter: blur(4px);
          color: #fff; font-size: .82rem; font-weight: 600;
          white-space: nowrap;
          animation: reactRise 3s ease-out forwards;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,.3));
        }
        .reactions-overlay-emoji { font-size: 20px; }
        @keyframes reactRise {
          0% { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          12% { opacity: 1; transform: translate(-50%, -10px) scale(1); }
          100% { transform: translate(-50%, -280px) scale(1.05); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default ReactionsOverlay;
