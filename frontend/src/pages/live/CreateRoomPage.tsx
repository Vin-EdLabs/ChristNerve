import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { canEditChurchMedia } from '../../utils/churchLife';
import { RoomTypePicker } from '../../components/live/RoomTypePicker';
import type { LiveRoomType } from '../../types/live';

export default function CreateRoomPage() {
  const { accountType, user } = useAuth();
  const navigate = useNavigate();
  const canManage = canEditChurchMedia(accountType, user?.role);

  const [name, setName] = useState('');
  const [roomType, setRoomType] = useState<LiveRoomType>('meeting');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('50');
  const [saving, setSaving] = useState(false);

  if (!canManage) return <Navigate to="/live-rooms" replace />;

  const submit = async (startNow: boolean) => {
    if (!name.trim()) {
      toast.error('Give the room a name');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/live/rooms', {
        name: name.trim(),
        room_type: roomType,
        description: description.trim() || null,
        scheduled_at: startNow ? null : scheduledAt || null,
        max_participants: Number(maxParticipants) || 50,
        start_now: startNow,
      });
      toast.success(startNow ? 'Room is live — members notified' : 'Room scheduled');
      navigate(`/live-rooms/${res.data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not create room');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack create-room-page">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Create Live Room</h1>
          <p className="page-sub">Set it up, then go live now or schedule it for later</p>
        </div>
      </div>

      <form
        className="card glass-card form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <Input
          label="Room Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tuesday Morning Devotion"
          required
        />
        <RoomTypePicker value={roomType} onChange={setRoomType} />
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this room about?"
          rows={3}
        />
        <Input
          label="Schedule Date/Time (optional — leave blank to start immediately)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <Input
          label="Max Participants"
          type="number"
          min="2"
          max="500"
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
        />

        <div className="create-room-actions">
          <Button type="submit" variant="outline" disabled={saving}>
            Schedule for Later
          </Button>
          <Button type="button" variant="primary" disabled={saving} onClick={() => void submit(true)}>
            Go Live Now
          </Button>
        </div>
      </form>

      <style>{`
        .create-room-page .page-header-row { margin-bottom: 14px; }
        .page-title { margin: 0; font-size: 1.4rem; }
        .page-sub { margin: 4px 0 0; opacity: .7; }
        .form-stack { display: flex; flex-direction: column; gap: 12px; padding: 20px; max-width: 560px; }
        .create-room-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      `}</style>
    </div>
  );
}
