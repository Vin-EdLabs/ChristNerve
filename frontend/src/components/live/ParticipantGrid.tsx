import { useEffect, useState, type CSSProperties } from 'react';
import { useTracks, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { LiveRoom } from '../../types/live';
import { VideoTile } from './VideoTile';

export interface ParticipantGridProps {
  room: Pick<LiveRoom, 'created_by'>;
  isModerator: boolean;
  onMute: (identity: string) => void;
  onRemove: (identity: string) => void;
}

function gridDims(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 3, rows: Math.ceil(count / 3) };
}

/** Grid of every participant — used for interactive room types (meeting, bible study, cell group, counseling). */
export function ParticipantGrid({ room, isModerator, onMute, onRemove }: ParticipantGridProps) {
  const { localParticipant } = useLocalParticipant();
  const screenShares = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], {
    onlySubscribed: false,
  });
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });

  const tiles = [...screenShares, ...cameraTracks];

  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);
  const [autoPinned, setAutoPinned] = useState(false);

  // Auto-pin whoever is sharing their screen so everyone's view focuses on it;
  // a manual pin (autoPinned=false) always wins over this.
  const sharerIdentity = screenShares[0]?.participant.identity ?? null;
  useEffect(() => {
    if (sharerIdentity) {
      setPinnedIdentity((prev) => {
        if (!prev || autoPinned) {
          setAutoPinned(true);
          return sharerIdentity;
        }
        return prev;
      });
    } else {
      setAutoPinned((prev) => {
        if (prev) setPinnedIdentity(null);
        return false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharerIdentity]);

  const togglePin = (identity: string) => {
    setAutoPinned(false);
    setPinnedIdentity((prev) => (prev === identity ? null : identity));
  };

  const pinnedTile = pinnedIdentity ? tiles.find((t) => t.participant.identity === pinnedIdentity) : undefined;

  if (pinnedTile) {
    const others = tiles.filter((t) => t !== pinnedTile);
    return (
      <div className="participant-spotlight">
        <div className="spotlight-main">
          <VideoTile
            trackRef={pinnedTile}
            room={room}
            isSelf={pinnedTile.participant.identity === localParticipant?.identity}
            isModerator={isModerator}
            onMute={onMute}
            onRemove={onRemove}
            isPinned
            onTogglePin={togglePin}
          />
        </div>
        {others.length > 0 && (
          <div className="spotlight-strip">
            {others.map((trackRef) => (
              <div className="spotlight-strip-item" key={`${trackRef.participant.identity}-${trackRef.source}`}>
                <VideoTile
                  trackRef={trackRef}
                  room={room}
                  isSelf={trackRef.participant.identity === localParticipant?.identity}
                  isModerator={isModerator}
                  onMute={onMute}
                  onRemove={onRemove}
                  onTogglePin={togglePin}
                  compact
                />
              </div>
            ))}
          </div>
        )}
        <style>{spotlightStyles}</style>
      </div>
    );
  }

  const { cols, rows } = gridDims(tiles.length);

  return (
    <div
      className="participant-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {tiles.map((trackRef, i) => {
        // Odd tile out at count 3 spans the full width on its own row.
        const spanFull = tiles.length === 3 && i === 2;
        return (
          <div
            key={`${trackRef.participant.identity}-${trackRef.source}`}
            className="participant-grid-cell"
            style={spanFull ? ({ gridColumn: '1 / -1' } as CSSProperties) : undefined}
          >
            <VideoTile
              trackRef={trackRef}
              room={room}
              isSelf={trackRef.participant.identity === localParticipant?.identity}
              isModerator={isModerator}
              onMute={onMute}
              onRemove={onRemove}
              onTogglePin={togglePin}
            />
          </div>
        );
      })}

      <style>{`
        .participant-grid {
          display: grid; gap: 4px;
          width: 100%; height: 100%;
        }
        .participant-grid-cell { min-width: 0; min-height: 0; }
        .participant-grid-cell > * { width: 100%; height: 100%; }
      `}</style>
    </div>
  );
}

const spotlightStyles = `
  .participant-spotlight { display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; min-height: 0; }
  .spotlight-main { flex: 1; min-height: 0; }
  .spotlight-strip { display: flex; gap: 8px; overflow-x: auto; flex-shrink: 0; height: 96px; }
  .spotlight-strip-item { flex: 0 0 150px; height: 100%; }
  @media (max-width: 640px) {
    .spotlight-strip { height: 76px; }
    .spotlight-strip-item { flex-basis: 110px; }
  }
`;

export default ParticipantGrid;
