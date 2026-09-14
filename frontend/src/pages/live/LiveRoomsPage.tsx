import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { RoomCard } from '../../components/live/RoomCard';
import { canEditChurchMedia, asList } from '../../utils/churchLife';
import type { LiveRoom } from '../../types/live';
import { useCachedQuery } from '../../utils/useCachedQuery';

const REFRESH_MS = 30_000;

export default function LiveRoomsPage() {
  const { accountType, user } = useAuth();
  const navigate = useNavigate();
  const canManage = canEditChurchMedia(accountType, user?.role);

  const { data: rooms = [], loading, refetch } = useCachedQuery<LiveRoom[]>(
    'live-rooms',
    async () => {
      try {
        const res = await api.get('/live/rooms');
        return asList<LiveRoom>(res.data);
      } catch {
        toast.error('Failed to load live rooms');
        return [];
      }
    }
  );

  useEffect(() => {
    const timerId = window.setInterval(() => refetch(), REFRESH_MS);
    return () => window.clearInterval(timerId);
  }, [refetch]);

  const startRoom = async (room: LiveRoom) => {
    try {
      await api.post(`/live/rooms/${room.id}/start`);
      toast.success('Room is live — members notified');
      refetch();
    } catch {
      toast.error('Could not start room');
    }
  };

  const endRoom = async (room: LiveRoom) => {
    if (!window.confirm(`End "${room.name}" for everyone?`)) return;
    try {
      await api.post(`/live/rooms/${room.id}/end`);
      toast.success('Room ended');
      refetch();
    } catch {
      toast.error('Could not end room');
    }
  };

  const deleteRoom = async (room: LiveRoom) => {
    if (!window.confirm(`Delete "${room.name}"?`)) return;
    try {
      await api.delete(`/live/rooms/${room.id}`);
      toast.success('Room deleted');
      refetch();
    } catch {
      toast.error('Could not delete room');
    }
  };

  if (loading) return <Spinner fullPage />;

  const live = rooms.filter((r) => r.status === 'live');
  const scheduled = rooms.filter((r) => r.status === 'scheduled');
  const ended = rooms.filter((r) => r.status === 'ended').slice(0, 12);

  return (
    <div className="page-stack live-rooms-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Live Rooms</h1>
          <p className="page-sub">Devotions, Bible studies, cell groups &amp; meetings — face to face</p>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => navigate('/live-rooms/create')}>
            <Plus size={16} /> Create Room
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={<Video size={28} />}
          title="No live rooms yet"
          description={
            canManage
              ? 'Start a devotion, Bible study, or meeting and your church can join from anywhere.'
              : 'When staff schedule a live room, it will show up here.'
          }
          actionLabel={canManage ? 'Create Room' : undefined}
          onAction={canManage ? () => navigate('/live-rooms/create') : undefined}
        />
      ) : (
        <>
          {live.length > 0 && (
            <section className="room-section">
              <h2 className="room-section-title">🔴 Live Now</h2>
              <div className="room-grid">
                {live.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    canManage={canManage}
                    onJoin={(r) => navigate(`/live-rooms/${r.id}`)}
                    onEnd={endRoom}
                  />
                ))}
              </div>
            </section>
          )}

          {scheduled.length > 0 && (
            <section className="room-section">
              <h2 className="room-section-title">📅 Scheduled</h2>
              <div className="room-grid">
                {scheduled.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    canManage={canManage}
                    onJoin={(r) => navigate(`/live-rooms/${r.id}`)}
                    onStart={startRoom}
                    onDelete={deleteRoom}
                  />
                ))}
              </div>
            </section>
          )}

          {ended.length > 0 && (
            <section className="room-section">
              <h2 className="room-section-title">✅ Ended</h2>
              <div className="room-grid">
                {ended.map((room) => (
                  <RoomCard key={room.id} room={room} canManage={canManage} onJoin={() => undefined} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <style>{`
        .live-rooms-page .page-header-row {
          display: flex; justify-content: space-between; gap: 12px;
          align-items: flex-start; margin-bottom: 18px;
        }
        .page-title { margin: 0; font-size: 1.4rem; }
        .page-sub { margin: 4px 0 0; opacity: .7; }
        .room-section { margin-bottom: 26px; }
        .room-section-title { font-size: .95rem; margin: 0 0 12px; }
        .room-grid {
          display: grid; gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        }
      `}</style>
    </div>
  );
}
