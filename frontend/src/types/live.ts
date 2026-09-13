/** Live Rooms (LiveKit) domain types — mirror backend `live_rooms` shape. */

export type LiveRoomType =
  | 'devotion'
  | 'service'
  | 'bible_study'
  | 'cell_group'
  | 'meeting'
  | 'counseling';

export type LiveRoomStatus = 'scheduled' | 'live' | 'ended';

export interface LiveRoom {
  id: number;
  church_id: number;
  livekit_room: string;
  name: string;
  description?: string | null;
  room_type: LiveRoomType;
  status: LiveRoomStatus;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  max_participants: number;
  created_by?: number | null;
  created_by_name?: string | null;
  peak_participants?: number;
  attendee_count?: number;
  participant_count?: number;
  created_at?: string;
  updated_at?: string;
  is_host?: boolean;
  can_manage?: boolean;
  public_join_enabled?: boolean;
  public_join_code?: string | null;
}

export interface PublicRoomInfo {
  room: Pick<LiveRoom, 'id' | 'name' | 'description' | 'room_type' | 'status'>;
  church_name: string;
  church_logo_url?: string | null;
  brand_color?: string | null;
}

export interface LiveRoomJoinResponse {
  token: string;
  url: string;
  room: LiveRoom;
  identity: string;
  can_publish: boolean;
  is_host: boolean;
}
