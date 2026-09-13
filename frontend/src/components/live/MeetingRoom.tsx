import type { LiveRoom } from '../../types/live';
import { ParticipantGrid } from './ParticipantGrid';

export interface MeetingRoomProps {
  room: Pick<LiveRoom, 'created_by'>;
  isModerator: boolean;
  onMute: (identity: string) => void;
  onRemove: (identity: string) => void;
}

/** Interactive layout for meeting / bible study / cell group / counseling — everyone can publish. */
export function MeetingRoom({ room, isModerator, onMute, onRemove }: MeetingRoomProps) {
  return (
    <div className="meeting-room">
      <ParticipantGrid room={room} isModerator={isModerator} onMute={onMute} onRemove={onRemove} />
      <style>{`
        .meeting-room { width: 100%; height: 100%; }
      `}</style>
    </div>
  );
}

export default MeetingRoom;
