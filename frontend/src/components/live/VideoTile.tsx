import { useState } from 'react';
import { Crown, MicOff, Pin, PinOff, VideoOff } from 'lucide-react';
import { VideoTrack, isTrackReference, useIsSpeaking } from '@livekit/components-react';
import { Track, type Participant } from 'livekit-client';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import type { LiveRoom } from '../../types/live';
import { colorForName, initialsOf, isRoomHost, parseParticipantMeta, roleLabelFor } from '../../utils/liveRooms';

export interface VideoTileProps {
  trackRef: TrackReferenceOrPlaceholder;
  room: Pick<LiveRoom, 'created_by'>;
  isSelf: boolean;
  isModerator?: boolean;
  onMute?: (identity: string) => void;
  onRemove?: (identity: string) => void;
  isPinned?: boolean;
  onTogglePin?: (identity: string) => void;
  compact?: boolean;
}

/**
 * A single video tile — real video when the camera/screen is actually publishing,
 * otherwise a colored initials circle (never the library's default camera-off icon).
 */
export function VideoTile({
  trackRef,
  room,
  isSelf,
  isModerator,
  onMute,
  onRemove,
  isPinned,
  onTogglePin,
  compact,
}: VideoTileProps) {
  const [hover, setHover] = useState(false);
  const participant: Participant = trackRef.participant;
  const speaking = useIsSpeaking(participant);
  const name = participant.name || participant.identity;
  const host = isRoomHost(room, participant);
  const roleLabel = isSelf ? '(You)' : roleLabelFor(parseParticipantMeta(participant), host);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  // A published-but-disabled camera still resolves as a real TrackReference, so also
  // check the live enabled state — otherwise a muted cam falls through to a blank video
  // element instead of our initials placeholder.
  const hasVideo = isTrackReference(trackRef) && (isScreenShare || participant.isCameraEnabled);
  const canModerate = Boolean(isModerator && onMute && onRemove) && !isSelf;

  return (
    <div
      className={`vtile${speaking ? ' is-speaking' : ''}${compact ? ' is-compact' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={`vtile-video${isScreenShare ? ' is-screenshare' : ''}`}
        />
      ) : (
        <div className="vtile-placeholder">
          <span className="vtile-initials" style={{ background: colorForName(name) }}>
            {initialsOf(name)}
          </span>
          <span className="vtile-placeholder-name">
            {name}
            {host && <Crown size={13} className="vtile-crown" />}
          </span>
          <span className="vtile-placeholder-role">{roleLabel}</span>
        </div>
      )}

      <div className="vtile-footer">
        <span className="vtile-name">
          {name}
          {host && <Crown size={12} className="vtile-crown" />}
          {isSelf ? ' (You)' : ''}
          {isScreenShare ? ' · sharing screen' : ''}
        </span>
        <span className="vtile-icons">
          {!participant.isMicrophoneEnabled && (
            <span className="vtile-icon is-off">
              <MicOff size={12} />
            </span>
          )}
          {!participant.isCameraEnabled && !isScreenShare && (
            <span className="vtile-icon is-off">
              <VideoOff size={12} />
            </span>
          )}
        </span>
      </div>

      {onTogglePin && (hover || isPinned) && (
        <button
          type="button"
          className={`vtile-pin${isPinned ? ' is-pinned' : ''}`}
          onClick={() => onTogglePin(participant.identity)}
          aria-label={isPinned ? 'Unpin' : 'Pin for me'}
          title={isPinned ? 'Unpin' : 'Pin for me'}
        >
          {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      )}

      {canModerate && hover && (
        <div className="vtile-mod-overlay">
          <button type="button" onClick={() => onMute!(participant.identity)} disabled={!participant.isMicrophoneEnabled}>
            <MicOff size={13} /> Mute
          </button>
          <button type="button" className="is-danger" onClick={() => onRemove!(participant.identity)}>
            Remove
          </button>
        </div>
      )}

      <style>{`
        .vtile {
          position: relative; border-radius: 10px; overflow: hidden;
          background: #17151a; min-height: 0; min-width: 0;
          width: 100%; height: 100%;
        }
        .vtile.is-speaking { box-shadow: 0 0 0 3px var(--vr-accent, #7c5cbf); }
        .vtile-pin {
          position: absolute; top: 8px; right: 8px; z-index: 5;
          width: 26px; height: 26px; border-radius: 50%; border: 0;
          background: rgba(0,0,0,.55); color: #fff; cursor: pointer;
          display: grid; place-items: center; transition: background-color .15s ease;
        }
        .vtile-pin:hover { background: rgba(0,0,0,.75); }
        .vtile-pin.is-pinned { background: var(--vr-accent, #7c5cbf); }
        .vtile.is-compact .vtile-name { font-size: .68rem; padding: 2px 7px; }
        .vtile.is-compact .vtile-initials { font-size: clamp(11px, 4vw, 18px); }
        .vtile.is-compact .vtile-placeholder-role { display: none; }
        .vtile-video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .vtile-video.is-screenshare { object-fit: contain; background: #000; }
        .vtile-placeholder {
          width: 100%; height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; background: #17151a;
        }
        .vtile-initials {
          width: 26%; aspect-ratio: 1; max-width: 88px; min-width: 40px;
          border-radius: 50%; color: #fff; font-weight: 700;
          display: grid; place-items: center; font-size: clamp(13px, 2.6vw, 28px);
        }
        .vtile-placeholder-name {
          color: #fff; font-size: .9rem; font-weight: 600;
          display: inline-flex; align-items: center; gap: 5px;
        }
        .vtile-placeholder-role { color: rgba(255,255,255,.55); font-size: .76rem; }
        .vtile-crown { color: #e8b93d; flex-shrink: 0; }
        .vtile-footer {
          position: absolute; left: 8px; bottom: 8px; right: 8px;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          pointer-events: none;
        }
        .vtile-name {
          background: rgba(0,0,0,.5); color: #fff; font-size: .78rem; font-weight: 600;
          padding: 3px 9px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%;
        }
        .vtile-icons { display: flex; gap: 4px; }
        .vtile-icon {
          width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,.55);
          display: grid; place-items: center; color: #fff;
        }
        .vtile-icon.is-off { color: #ff8a7a; }
        .vtile-mod-overlay {
          position: absolute; inset: 0; background: rgba(10,9,8,.45);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .vtile-mod-overlay button {
          display: inline-flex; align-items: center; gap: 5px;
          border: 1px solid rgba(255,255,255,.25); background: rgba(20,18,16,.85);
          color: #fff; border-radius: 8px; padding: 6px 12px; font-size: .8rem;
          font-weight: 600; cursor: pointer;
        }
        .vtile-mod-overlay button:hover { background: rgba(40,36,32,.95); }
        .vtile-mod-overlay button:disabled { opacity: .4; cursor: default; }
        .vtile-mod-overlay button.is-danger { color: #ff8a7a; border-color: rgba(224,90,78,.5); }
      `}</style>
    </div>
  );
}

export default VideoTile;
