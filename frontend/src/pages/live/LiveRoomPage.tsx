import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveCall } from '../../contexts/LiveCallContext';

/**
 * Thin trigger only — the actual connection and UI live in <ActiveCallOverlay>, mounted
 * once near the app root, so the call survives navigating to other pages.
 */
export default function LiveRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { joinRoom } = useLiveCall();

  useEffect(() => {
    const id = Number(roomId);
    if (Number.isFinite(id)) joinRoom(id);
  }, [roomId, joinRoom]);

  return null;
}
