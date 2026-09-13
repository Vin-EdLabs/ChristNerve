import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Video } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { VideoRoom } from '../../components/live/VideoRoom';
import { roomTypeMeta } from '../../utils/liveRooms';
import type { LiveRoomJoinResponse, PublicRoomInfo } from '../../types/live';

type Status = 'loading' | 'form' | 'joining' | 'connected' | 'error' | 'ended';

export default function PublicJoinPage() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<PublicRoomInfo | null>(null);
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [join, setJoin] = useState<LiveRoomJoinResponse | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<PublicRoomInfo>(`/live/rooms/public/${code}`);
        if (cancelled) return;
        setInfo(res.data);
        setStatus('form');
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err?.response?.data?.error || 'This invite link is not active');
        setStatus(err?.response?.status === 410 ? 'ended' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code || !name.trim()) return;
    setStatus('joining');
    try {
      const res = await api.post<LiveRoomJoinResponse>(`/live/rooms/public/${code}/token`, { name: name.trim() });
      setJoin(res.data);
      setStatus('connected');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Could not join this room');
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="pjp-status">
        <Spinner size="lg" />
        <style>{pjpStyles}</style>
      </div>
    );
  }

  if (status === 'error' || status === 'ended') {
    return (
      <div className="pjp-status">
        <Video size={32} />
        <p>{errorMsg || 'This room has ended.'}</p>
        <style>{pjpStyles}</style>
      </div>
    );
  }

  if ((status === 'form' || status === 'joining') && info) {
    const meta = roomTypeMeta(info.room.room_type);
    return (
      <div className="pjp-status">
        <div className="pjp-card">
          {info.church_logo_url ? (
            <img src={info.church_logo_url} alt="" className="pjp-logo" />
          ) : (
            <span className="pjp-icon" style={{ background: `${meta.color}2e`, color: meta.color }}>
              <meta.icon size={22} strokeWidth={2} />
            </span>
          )}
          <p className="pjp-church">{info.church_name}</p>
          <h1>{info.room.name}</h1>
          <p className="pjp-type">{meta.label}</p>
          <form onSubmit={submit} className="pjp-form">
            <Input
              label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Akosua Mensah"
              required
              autoFocus
            />
            <Button type="submit" variant="primary" block disabled={status === 'joining' || !name.trim()}>
              {status === 'joining' ? 'Joining…' : 'Join Room'}
            </Button>
          </form>
        </div>
        <style>{pjpStyles}</style>
      </div>
    );
  }

  if (status === 'connected' && join) {
    return (
      <VideoRoom
        room={join.room}
        token={join.token}
        serverUrl={join.url}
        canPublish={join.can_publish}
        isModerator={false}
        churchName={info?.church_name || 'ChristNerve'}
        churchSlug=""
        churchLogoUrl={info?.church_logo_url}
        brandColor={info?.brand_color}
        dashboardChrome={false}
        onLeave={() => setStatus('ended')}
        onEnded={() => setStatus('ended')}
        onRemoved={() => setStatus('ended')}
        onRequestEndRoom={() => undefined}
        onConnectError={(message) => {
          setErrorMsg(message);
          setStatus('error');
        }}
      />
    );
  }

  return null;
}

const pjpStyles = `
  .pjp-status {
    position: fixed; inset: 0; z-index: 150; background: #0c0b0a; color: #f5f3f0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; text-align: center; padding: 24px;
  }
  .pjp-card {
    width: min(360px, 100%); background: #17151a; border: 1px solid rgba(255,255,255,.1);
    border-radius: 20px; padding: 28px 24px; text-align: center;
  }
  .pjp-logo { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; margin: 0 auto 12px; display: block; }
  .pjp-icon {
    width: 52px; height: 52px; border-radius: 14px; margin: 0 auto 12px;
    display: grid; place-items: center;
  }
  .pjp-church { margin: 0; font-size: .78rem; opacity: .6; text-transform: uppercase; letter-spacing: .05em; }
  .pjp-card h1 { margin: 6px 0 2px; font-size: 1.25rem; }
  .pjp-type { margin: 0 0 20px; font-size: .82rem; opacity: .6; }
  .pjp-form { display: flex; flex-direction: column; gap: 14px; text-align: left; }
`;
