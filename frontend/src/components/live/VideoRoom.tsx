import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '@livekit/components-styles';
import { LiveKitRoom, RoomAudioRenderer, useParticipants } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { Users } from 'lucide-react';
import type { LiveRoom } from '../../types/live';
import { isBroadcastRoom, roomTypeMeta } from '../../utils/liveRooms';
import { useElapsedTimer } from '../../utils/useElapsedTimer';
import { MeetingRoom } from './MeetingRoom';
import { RoomControls } from './RoomControls';
import { RoomChat, useRoomChatChannel } from './RoomChat';
import { ParticipantsPanel } from './ParticipantsPanel';
import { ReactionsOverlay, useReactionChannel } from './LiveReactions';
import { useModeration } from './ModeratorControls';
import { MinimizedCallBar } from './MinimizedCallBar';
import { useCallPip, type UseCallPipResult } from './CallPip';

export type SidePanel = 'none' | 'people' | 'chat';

export interface VideoRoomProps {
  room: LiveRoom;
  token: string;
  serverUrl: string;
  canPublish: boolean;
  isModerator: boolean;
  churchName: string;
  churchSlug: string;
  churchLogoUrl?: string | null;
  brandColor?: string | null;
  /** Rendered as a small floating bar instead of the full room UI, without disconnecting. */
  minimized?: boolean;
  /** Guest join page has no dashboard sidebar/topbar to avoid. */
  dashboardChrome?: boolean;
  onLeave: () => void;
  onEnded: () => void;
  onRemoved: () => void;
  onRequestEndRoom: () => void;
  onConnectError: (message: string) => void;
  onReturnToRoom?: () => void;
}

function TopBar({
  room,
  churchName,
  churchLogoUrl,
}: {
  room: LiveRoom;
  churchName: string;
  churchLogoUrl?: string | null;
}) {
  const participants = useParticipants();
  const meta = roomTypeMeta(room.room_type);
  const elapsed = useElapsedTimer(room.started_at);
  return (
    <header className="vr-topbar">
      <div className="vr-topbar-left">
        {churchLogoUrl ? (
          <img src={churchLogoUrl} alt="" className="vr-topbar-logo" />
        ) : (
          <span className="vr-topbar-icon" style={{ background: `${meta.color}2e`, color: meta.color }}>
            <meta.icon size={18} strokeWidth={2} />
          </span>
        )}
        <div className="vr-topbar-titles">
          <strong>{room.name}</strong>
          <span className="vr-topbar-church">{churchName} · {meta.label}</span>
        </div>
      </div>
      <div className="vr-topbar-right">
        <span className="vr-live-pill">
          <span className="vr-live-dot" /> LIVE
        </span>
        <span className="vr-timer-pill">{elapsed}</span>
        <span className="vr-participant-count">
          <Users size={14} /> {participants.length}
        </span>
      </div>
    </header>
  );
}

function RoomShell({
  room,
  canPublish,
  isModerator,
  churchName,
  churchSlug,
  churchLogoUrl,
  pip,
  chat,
  onRequestEndRoom,
  onRemoved,
}: {
  room: LiveRoom;
  canPublish: boolean;
  isModerator: boolean;
  churchName: string;
  churchSlug: string;
  churchLogoUrl?: string | null;
  pip: UseCallPipResult;
  chat: ReturnType<typeof useRoomChatChannel>;
  onRequestEndRoom: () => void;
  onRemoved: () => void;
}) {
  const [activePanel, setActivePanel] = useState<SidePanel>('none');
  const participants = useParticipants();
  const { floating, react } = useReactionChannel();
  const { muteParticipant, removeParticipant } = useModeration({ onRemoved });

  const togglePanel = (panel: SidePanel) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  // Reset the unread badge whenever the chat panel is the visible one — including
  // for messages that arrive while it's already open.
  useEffect(() => {
    if (activePanel === 'chat') chat.markSeen();
  }, [activePanel, chat.messages.length, chat.markSeen]);

  return (
    <div className="vr-shell">
      <TopBar room={room} churchName={churchName} churchLogoUrl={churchLogoUrl} />

      <div className="vr-body">
        <div className="vr-main">
          {/* Every room type gets the same Zoom-style grid: everyone's camera tiled full-screen,
              auto-spotlighting whoever shares their screen (their own camera still shows in the
              filmstrip), and anyone can pin a different tile to make it the big one. */}
          <MeetingRoom room={room} isModerator={isModerator} onMute={muteParticipant} onRemove={removeParticipant} />
          <ReactionsOverlay floating={floating} />
        </div>

        <aside className={`vr-side-panel${activePanel !== 'none' ? ' is-open' : ''}`}>
          {activePanel === 'people' && (
            <ParticipantsPanel
              room={room}
              isModerator={isModerator}
              onMute={muteParticipant}
              onRemove={removeParticipant}
              onClose={() => setActivePanel('none')}
            />
          )}
          {activePanel === 'chat' && (
            <RoomChat messages={chat.messages} onSend={chat.sendMessage} onClose={() => setActivePanel('none')} />
          )}
        </aside>
      </div>

      <RoomControls
        canPublish={canPublish}
        canManage={isModerator}
        activePanel={activePanel}
        onTogglePeople={() => togglePanel('people')}
        onToggleChat={() => togglePanel('chat')}
        participantCount={participants.length}
        unreadChat={chat.unread}
        onReact={react}
        onEndRoom={onRequestEndRoom}
        roomData={room}
        churchSlug={churchSlug}
        publicJoinEnabled={Boolean(room.public_join_enabled)}
        publicJoinCode={room.public_join_code ?? null}
        pip={pip}
      />
    </div>
  );
}

/**
 * Always the sole child of <LiveKitRoom>, regardless of minimized/full — this is what lets
 * `useCallPip` hold onto its floating window across that switch, and lets chat history and
 * remote audio survive it too. If any of these lived inside RoomShell or MinimizedCallBar
 * directly, toggling between them (which are mutually exclusive) would unmount whichever
 * held it: an open PiP window would silently close, chat messages would vanish, and — since
 * RoomAudioRenderer is what actually plays back remote audio — minimizing would go silent
 * even though the call itself is still connected.
 */
function RoomInner({
  room,
  canPublish,
  isModerator,
  churchName,
  churchSlug,
  churchLogoUrl,
  minimized,
  onRequestEndRoom,
  onRemoved,
  onLeave,
  onReturnToRoom,
}: {
  room: LiveRoom;
  canPublish: boolean;
  isModerator: boolean;
  churchName: string;
  churchSlug: string;
  churchLogoUrl?: string | null;
  minimized: boolean;
  onRequestEndRoom: () => void;
  onRemoved: () => void;
  onLeave: () => void;
  onReturnToRoom: () => void;
}) {
  const pip = useCallPip(room);
  const chat = useRoomChatChannel();

  return (
    <>
      {minimized ? (
        <MinimizedCallBar room={room} pip={pip} onReturn={onReturnToRoom} onLeave={onLeave} />
      ) : (
        <RoomShell
          room={room}
          canPublish={canPublish}
          isModerator={isModerator}
          churchName={churchName}
          churchSlug={churchSlug}
          churchLogoUrl={churchLogoUrl}
          pip={pip}
          chat={chat}
          onRequestEndRoom={onRequestEndRoom}
          onRemoved={onRemoved}
        />
      )}
      {/* Always mounted — remote audio must keep playing while minimized. */}
      <RoomAudioRenderer />
    </>
  );
}

export function VideoRoom({
  room,
  token,
  serverUrl,
  canPublish,
  isModerator,
  churchName,
  churchSlug,
  churchLogoUrl,
  brandColor,
  minimized = false,
  dashboardChrome = true,
  onLeave,
  onEnded,
  onRemoved,
  onRequestEndRoom,
  onConnectError,
  onReturnToRoom,
}: VideoRoomProps) {
  const broadcast = isBroadcastRoom(room.room_type);
  const hasConnectedRef = useRef(false);
  const errorTimerRef = useRef<number | null>(null);
  const removedRef = useRef(false);

  return (
    <div
      className={minimized ? 'video-room-minimized' : 'video-room-root'}
      style={
        !minimized
          ? ({
              '--vr-accent': brandColor || 'var(--accent, #7c5cbf)',
              left: dashboardChrome ? undefined : 0,
              top: dashboardChrome ? undefined : 0,
            } as CSSProperties)
          : ({ '--vr-accent': brandColor || 'var(--accent, #7c5cbf)' } as CSSProperties)
      }
      data-lk-theme="default"
    >
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        audio={canPublish && !broadcast}
        video={canPublish && !broadcast}
        onConnected={() => {
          hasConnectedRef.current = true;
          if (errorTimerRef.current != null) {
            window.clearTimeout(errorTimerRef.current);
            errorTimerRef.current = null;
          }
        }}
        onDisconnected={(reason) => {
          if (!hasConnectedRef.current) {
            // Never actually connected — onError (debounced) surfaces the reason.
            return;
          }
          if (removedRef.current) {
            // useModeration already fired onRemoved() before disconnecting.
            return;
          }
          if (reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.ROOM_CLOSED) {
            onEnded();
          } else {
            onLeave();
          }
        }}
        onError={(err) => {
          const message = err.message || 'Could not connect to the live room';
          // React StrictMode double-mounts in dev, which can cancel the first connect
          // attempt mid-handshake — give the (surviving) remount a moment to succeed
          // before treating this as a real failure.
          if (errorTimerRef.current != null) window.clearTimeout(errorTimerRef.current);
          errorTimerRef.current = window.setTimeout(() => {
            if (!hasConnectedRef.current) onConnectError(message);
          }, 800);
        }}
      >
        <RoomInner
          room={room}
          canPublish={canPublish}
          isModerator={isModerator}
          churchName={churchName}
          churchSlug={churchSlug}
          churchLogoUrl={churchLogoUrl}
          minimized={minimized}
          onRequestEndRoom={onRequestEndRoom}
          onRemoved={() => {
            removedRef.current = true;
            onRemoved();
          }}
          onLeave={onLeave}
          onReturnToRoom={onReturnToRoom || (() => undefined)}
        />
      </LiveKitRoom>

      <style>{`
        .video-room-minimized { display: contents; }
        .video-room-root {
          position: fixed;
          top: calc(var(--topbar-height, 68px) + var(--safe-top, 0px));
          right: 0; bottom: 0; left: var(--sidebar-width, 0px);
          z-index: 150;
          background: #0c0b0a; color: #f5f3f0;
          animation: vrEnter .35s ease both;
        }
        @keyframes vrEnter {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          .video-room-root { left: 0; }
        }
        .vr-shell { display: flex; flex-direction: column; height: 100%; }
        .vr-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 18px; background: rgba(12,11,10,.9);
          border-bottom: 1px solid rgba(255,255,255,.08);
          border-top: 3px solid var(--vr-accent, #7c5cbf);
          flex-shrink: 0;
        }
        .vr-topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .vr-topbar-logo {
          width: 36px; height: 36px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
        }
        .vr-topbar-icon {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: grid; place-items: center;
        }
        .vr-topbar-titles { min-width: 0; }
        .vr-topbar-titles strong {
          display: block; font-size: .95rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .vr-topbar-church {
          font-size: .74rem; opacity: .6;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: block;
        }
        .vr-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .vr-live-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 999px; background: #b42318;
          color: #fff; font-weight: 700; font-size: .68rem; letter-spacing: .05em;
        }
        .vr-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: vrPulse 1.2s infinite; }
        @keyframes vrPulse { 50% { opacity: .35; } }
        .vr-timer-pill {
          font-size: .78rem; font-weight: 600; opacity: .85; font-variant-numeric: tabular-nums;
          padding: 4px 9px; border-radius: 999px; background: rgba(255,255,255,.08);
        }
        .vr-participant-count {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: .78rem; opacity: .75; font-variant-numeric: tabular-nums;
        }

        .vr-body { position: relative; flex: 1; min-height: 0; display: flex; }
        .vr-main { flex: 1; min-width: 0; position: relative; padding: 8px; }

        .vr-side-panel {
          width: 0; flex-shrink: 0; overflow: hidden;
          transition: width .28s ease;
          border-left: 1px solid rgba(255,255,255,.08); background: #161412;
        }
        .vr-side-panel.is-open { width: 300px; }

        @media (max-width: 768px) {
          .vr-topbar { padding: 10px 12px; gap: 8px; }
          .vr-topbar-titles strong { font-size: .86rem; max-width: 34vw; }
          .vr-topbar-church { max-width: 34vw; }
          .vr-timer-pill { display: none; }
          .vr-side-panel.is-open {
            width: min(86vw, 340px); position: absolute; top: 0; right: 0; bottom: 0; left: auto;
            box-shadow: -10px 0 30px rgba(0,0,0,.45);
          }
          .vr-main { padding: 4px; }
        }
      `}</style>
    </div>
  );
}

export default VideoRoom;
