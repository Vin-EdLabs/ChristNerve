import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { PictureInPicture2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { LiveRoom } from '../../types/live';
import { roomTypeMeta } from '../../utils/liveRooms';
import { useElapsedTimer } from '../../utils/useElapsedTimer';

/** The experimental Document Picture-in-Picture API isn't in TS's DOM lib yet. */
interface DocumentPipWindow extends Window {
  document: Document;
}
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPipWindow>;
  window: DocumentPipWindow | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function isCallPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

const PIP_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0c0b0a; color: #f5f3f0; height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; padding: 16px; text-align: center;
  }
  .pip-icon { display: flex; align-items: center; justify-content: center; }
  .pip-name { font-size: 1rem; font-weight: 700; margin: 0; }
  .pip-meta { font-size: .82rem; opacity: .7; display: flex; align-items: center; gap: 6px; }
  .pip-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4d3d; animation: pipPulse 1.2s infinite; }
  @keyframes pipPulse { 50% { opacity: .3; } }
  .pip-actions { display: flex; gap: 8px; margin-top: 6px; }
  .pip-actions button {
    border: 0; border-radius: 999px; padding: 8px 16px; font-size: .82rem; font-weight: 600;
    cursor: pointer;
  }
  .pip-return { background: rgba(255,255,255,.12); color: #fff; }
  .pip-leave { background: #b42318; color: #fff; }
`;

function MiniPipView({
  room,
  participantCount,
  onLeave,
  onClose,
}: {
  room: LiveRoom;
  participantCount: number;
  onLeave: () => void;
  onClose: () => void;
}) {
  const meta = roomTypeMeta(room.room_type);
  const elapsed = useElapsedTimer(room.started_at);
  return (
    <>
      <span className="pip-icon" style={{ color: meta.color }}>
        <meta.icon size={26} strokeWidth={2} />
      </span>
      <p className="pip-name">{room.name}</p>
      <span className="pip-meta">
        <span className="pip-dot" /> {elapsed} · {participantCount} in the room
      </span>
      <div className="pip-actions">
        <button type="button" className="pip-return" onClick={onClose}>
          Back to tab
        </button>
        <button
          type="button"
          className="pip-leave"
          onClick={() => {
            onLeave();
            onClose();
          }}
        >
          Leave
        </button>
      </div>
    </>
  );
}

export interface UseCallPipResult {
  supported: boolean;
  active: boolean;
  toggle: () => void;
}

/**
 * Floats the call in a real OS-level always-on-top window via the Document
 * Picture-in-Picture API, so it stays visible even after switching to another
 * app or window (not just another browser tab). Falls back to unsupported/hidden
 * on browsers without the API (Firefox, Safari at the time of writing) — there's
 * no way to keep a page visibly "open" once the browser itself is fully closed.
 */
export function useCallPip(room: LiveRoom): UseCallPipResult {
  const participants = useParticipants();
  const roomCtx = useRoomContext();
  const [active, setActive] = useState(false);
  const pipWindowRef = useRef<DocumentPipWindow | null>(null);
  const rootRef = useRef<Root | null>(null);
  const supported = isCallPipSupported();

  const cleanup = useCallback(() => {
    rootRef.current?.unmount();
    rootRef.current = null;
    pipWindowRef.current = null;
    setActive(false);
  }, []);

  const close = useCallback(() => {
    pipWindowRef.current?.close();
  }, []);

  const leave = useCallback(() => {
    void roomCtx.disconnect();
  }, [roomCtx]);

  // Keep the floating window's content current as participants/room state change.
  useEffect(() => {
    if (!active || !rootRef.current) return;
    rootRef.current.render(
      <MiniPipView room={room} participantCount={participants.length} onLeave={leave} onClose={close} />
    );
  }, [active, room, participants.length, leave, close]);

  const open = useCallback(async () => {
    if (!supported || pipWindowRef.current) return;
    try {
      const pipWindow = await window.documentPictureInPicture!.requestWindow({ width: 280, height: 170 });
      pipWindowRef.current = pipWindow;
      const styleEl = pipWindow.document.createElement('style');
      styleEl.textContent = PIP_STYLES;
      pipWindow.document.head.appendChild(styleEl);
      pipWindow.document.title = room.name;

      const container = pipWindow.document.createElement('div');
      pipWindow.document.body.appendChild(container);
      rootRef.current = createRoot(container);
      rootRef.current.render(
        <MiniPipView room={room} participantCount={participants.length} onLeave={leave} onClose={close} />
      );

      pipWindow.addEventListener('pagehide', cleanup, { once: true });
      setActive(true);
    } catch (err) {
      console.warn('[CallPip] could not open floating window:', err);
      toast.error('Could not float this call — try again from the tab (not an embedded preview)');
      cleanup();
    }
  }, [supported, room, participants.length, leave, close, cleanup]);

  const toggle = useCallback(() => {
    if (active) close();
    else void open();
  }, [active, close, open]);

  useEffect(() => cleanup, [cleanup]);

  return { supported, active, toggle };
}

/** Purely presentational — the hook instance must live in a component that stays
 *  mounted across the full/minimized switch (see VideoRoom.tsx), or toggling
 *  between those views would tear down this hook mid-flight and silently close
 *  an open PiP window out from under the user. */
export function CallPipButton({ supported, active, onToggle }: { supported: boolean; active: boolean; onToggle: () => void }) {
  if (!supported) return null;

  return (
    <button
      type="button"
      className={`rc-btn${active ? ' rc-active' : ''}`}
      onClick={onToggle}
      aria-label="Float this call in a window"
      title="Float this call in a window"
    >
      <PictureInPicture2 size={20} />
      <span>Float</span>
    </button>
  );
}

export default CallPipButton;
