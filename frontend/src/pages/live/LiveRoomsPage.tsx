import { useCallback, useEffect, useRef, useState } from 'react';
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

const REFRESH_MS = 30_000;

/** Kept outside the component so revisiting this page (SPA nav away + back) can render
 *  instantly from the last-known list while a silent background refresh brings it current —
 *  no more blocking full-page spinner on every click into Live Rooms. */
let roomsCache: LiveRoom[] | null = null;

export default function LiveRoomsPage() {
  const { accountType, user } = useAuth();
  const navigate = useNavigate();
  const canManage = canEditChurchMedia(accountType, user?.role);
  const [loading, setLoading] = useState(roomsCache === null);
  const [rooms, setRooms] = useState<LiveRoom[]>(roomsCache || []);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/live/rooms');
      const data = asList<LiveRoom>(res.data);
      roomsCache = data;
      setRooms(data);
    } catch {
      if (!silent) toast.error('Failed to load live rooms');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Already have a cached list showing — refresh quietly instead of blocking on a spinner.
    void load(roomsCache !== null);
    timerRef.current = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [load]);

  const startRoom = async (room: LiveRoom) => {
    try {
      await api.post(`/live/rooms/${room.id}/start`);
      toast.success('Room is live — members notified');
      void load(true);
    } catch {
      toast.error('Could not start room');
    }
  };

  const endRoom = async (room: LiveRoom) => {
    if (!window.confirm(`End "${room.name}" for everyone?`)) return;
    try {
      await api.post(`/live/rooms/${room.id}/end`);
      toast.success('Room ended');
      void load(true);
    } catch {
      toast.error('Could not end room');
    }
  };

  const deleteRoom = async (room: LiveRoom) => {
    if (!window.confirm(`Delete "${room.name}"?`)) return;
    try {
      await api.delete(`/live/rooms/${room.id}`);
      toast.success('Room deleted');
      void load(true);
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
