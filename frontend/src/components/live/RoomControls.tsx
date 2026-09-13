import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Smile,
  Users,
  MessageCircle,
  Link2,
  LogOut,
  Radio,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TrackToggle, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { REACTIONS, type ReactionKey } from './LiveReactions';
import { ConfirmDialog } from './ConfirmDialog';
import { InvitePopover } from './InvitePopover';
import { CallPipButton, type UseCallPipResult } from './CallPip';
import type { SidePanel } from './VideoRoom';
import type { LiveRoom } from '../../types/live';

export interface RoomControlsProps {
  canPublish: boolean;
  canManage: boolean;
  activePanel: SidePanel;
  onTogglePeople: () => void;
  onToggleChat: () => void;
  participantCount: number;
  unreadChat: number;
  onReact: (key: ReactionKey) => void;
  onEndRoom: () => void;
  roomData: LiveRoom;
  churchSlug: string;
  publicJoinEnabled: boolean;
  publicJoinCode: string | null;
  pip: UseCallPipResult;
}

type PendingAction = 'leave' | 'end' | null;

export function RoomControls({
  canPublish,
  canManage,
  activePanel,
  onTogglePeople,
  onToggleChat,
  participantCount,
  unreadChat,
  onReact,
  onEndRoom,
  roomData,
  churchSlug,
  publicJoinEnabled,
  publicJoinCode,
  pip,
}: RoomControlsProps) {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const room = useRoomContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  // A page refresh kills the browser's screen-capture stream outright — there's no way to
  // silently resume it (the Screen Capture API requires a fresh user gesture + picker every
  // time, by design). So instead: remember across the refresh that this user was sharing,
  // and offer a one-click way to pick it back up once the call reconnects.
  const shareResumeKey = `cn_live_sharing_${roomData.id}`;
  const resumeCheckedRef = useRef(false);
  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;
    const wasSharing = sessionStorage.getItem(shareResumeKey) === '1';
    sessionStorage.removeItem(shareResumeKey);
    if (wasSharing && !isScreenShareEnabled) {
      toast(
        (t) => (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Screen sharing stopped when the page reloaded.
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                room.localParticipant
                  .setScreenShareEnabled(true)
                  .catch(() => toast.error('Could not resume screen share'));
              }}
              style={{
                border: 0,
                borderRadius: 8,
                padding: '6px 12px',
                fontWeight: 600,
                fontSize: '.8rem',
                background: 'var(--vr-accent, #7c5cbf)',
                color: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Resume sharing
            </button>
          </span>
        ),
        { duration: 10000 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isScreenShareEnabled) sessionStorage.setItem(shareResumeKey, '1');
    else sessionStorage.removeItem(shareResumeKey);
  }, [isScreenShareEnabled, shareResumeKey]);

  return (
    <div className="room-controls">
      <div className="room-controls-main">
        {canPublish && (
          <>
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              className={`rc-btn${isMicrophoneEnabled ? ' rc-on' : ' rc-off'}`}
            >
              {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              <span>Mic</span>
            </TrackToggle>
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className={`rc-btn${isCameraEnabled ? ' rc-on' : ' rc-neutral-off'}`}
            >
              {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              <span>Cam</span>
            </TrackToggle>
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon={false}
              className={`rc-btn${isScreenShareEnabled ? ' rc-active' : ''}`}
              onDeviceError={() => toast.error('Screen sharing is not available on this device')}
            >
              {isScreenShareEnabled ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
              <span>Share</span>
            </TrackToggle>
          </>
        )}

        <div className="rc-popover-anchor">
          <button
            type="button"
            className={`rc-btn${pickerOpen ? ' rc-active' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Smile size={20} />
            <span>React</span>
          </button>
          {pickerOpen && (
            <div className="rc-popover rc-reaction-picker">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className="rc-reaction-btn"
                  onClick={() => onReact(r.key)}
                  aria-label={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className={`rc-btn${activePanel === 'people' ? ' rc-active' : ''}`} onClick={onTogglePeople}>
          <Users size={20} />
          <span>People</span>
          <span className="rc-badge rc-badge-neutral">{participantCount}</span>
        </button>

        <button type="button" className={`rc-btn${activePanel === 'chat' ? ' rc-active' : ''}`} onClick={onToggleChat}>
          <MessageCircle size={20} />
          <span>Chat</span>
          {unreadChat > 0 && activePanel !== 'chat' && <span className="rc-badge">{unreadChat}</span>}
        </button>

        <CallPipButton supported={pip.supported} active={pip.active} onToggle={pip.toggle} />
      </div>

      <div className="room-controls-end">
        {canPublish && (
          <div className="rc-popover-anchor">
            <button type="button" className={`rc-btn${inviteOpen ? ' rc-active' : ''}`} onClick={() => setInviteOpen((v) => !v)}>
              <Link2 size={18} />
              <span>Invite</span>
            </button>
            {inviteOpen && (
              <InvitePopover
                roomId={roomData.id}
                churchSlug={churchSlug}
                initialEnabled={publicJoinEnabled}
                initialCode={publicJoinCode}
                onClose={() => setInviteOpen(false)}
              />
            )}
          </div>
        )}
        {canManage && (
          <button type="button" className="rc-btn rc-end" onClick={() => setPending('end')}>
            <Radio size={16} /> <span>End for All</span>
          </button>
        )}
        <button type="button" className="rc-btn rc-leave" onClick={() => setPending('leave')}>
          <LogOut size={18} />
          <span>Leave</span>
        </button>
      </div>

      <ConfirmDialog
        open={pending === 'leave'}
        title="Leave this room?"
        description="You can rejoin any time while the room is still live."
        confirmLabel="Leave Room"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setPending(null);
          void room.disconnect();
        }}
      />
      <ConfirmDialog
        open={pending === 'end'}
        title="End this room for everyone?"
        description="Every participant will be disconnected immediately. This cannot be undone."
        confirmLabel="End for All"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => {
          setPending(null);
          onEndRoom();
        }}
      />

      <style>{`
        .room-controls {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 10px 18px; background: rgba(12,11,10,.92);
          backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,.08);
          flex-wrap: wrap; flex-shrink: 0;
        }
        .room-controls-main { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .room-controls-end { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        .rc-popover-anchor { position: relative; }
        .rc-btn {
          position: relative; min-width: 60px; padding: 8px 10px 6px;
          border-radius: 12px; border: 0; background: transparent; color: #f5f3f0;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          cursor: pointer; transition: background-color .15s ease, transform .1s ease;
        }
        .rc-btn span { font-size: .68rem; font-weight: 600; opacity: .85; }
        .rc-btn:hover { background: rgba(255,255,255,.1); }
        .rc-btn:active { transform: scale(0.96); }
        .rc-on { color: #3fb96a; }
        .rc-off { color: #ff8a7a; background: rgba(224,90,78,.16); }
        .rc-neutral-off { color: #9a958f; }
        .rc-active { background: var(--vr-accent, #7c5cbf); color: #fff; }
        .rc-active span { opacity: 1; }
        .rc-badge {
          position: absolute; top: 2px; right: 6px; min-width: 16px; height: 16px;
          border-radius: 999px; background: #b42318; color: #fff; font-size: .6rem;
          font-weight: 700; display: grid; place-items: center; padding: 0 4px;
        }
        .rc-badge-neutral { position: static; background: rgba(255,255,255,.15); margin-top: -2px; }
        .rc-end, .rc-leave {
          flex-direction: row; min-width: auto; padding: 0 16px; height: 44px;
          border-radius: 999px; gap: 6px; font-size: .85rem; font-weight: 600;
        }
        .rc-end span, .rc-leave span { font-size: .85rem; opacity: 1; }
        .rc-end { background: rgba(180,35,24,.22); color: #ff9c8f; }
        .rc-end:hover { background: rgba(180,35,24,.38); }
        .rc-leave { background: #b42318; color: #fff; }
        .rc-leave:hover { background: #971d10; }
        .rc-popover {
          position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
          background: rgba(24,22,20,.98); border: 1px solid rgba(255,255,255,.1);
          border-radius: 14px; padding: 10px; box-shadow: 0 12px 28px rgba(0,0,0,.4);
          z-index: 40;
        }
        .rc-reaction-picker { display: flex; gap: 6px; }
        .rc-reaction-btn {
          width: 44px; height: 44px; border-radius: 50%; border: 0;
          background: rgba(255,255,255,.08); font-size: 22px; cursor: pointer;
          display: grid; place-items: center; transition: transform .12s ease, background-color .12s ease;
        }
        .rc-reaction-btn:hover { background: rgba(255,255,255,.16); transform: scale(1.08); }
        @media (max-width: 720px) {
          .room-controls { padding: 8px 8px; gap: 4px; }
          .rc-btn { min-width: 48px; padding: 6px 6px 4px; }
          .rc-btn > span:not(.rc-badge):not(.rc-badge-neutral) { display: none; }
          .rc-end span { display: inline; }
          .rc-leave span { display: none; }
        }
      `}</style>
    </div>
  );
}

export default RoomControls;
