import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RefreshCw, ArrowLeft, CheckCircle2, UserX } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveCall } from '../../contexts/LiveCallContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { VideoRoom } from './VideoRoom';

/**
 * Mounted once near the app root (inside the router) so the LiveKit connection survives
 * navigating between pages — only the visual presentation (full room vs. a small floating
 * bar) changes based on whether the user is currently on that room's own page.
 */
export function ActiveCallOverlay() {
  const { activeRoomId, status, join, errorMessage, retry, leaveCall, markEnded, markRemoved, markConnectError } =
    useLiveCall();
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useAuth();

  const isOnRoomRoute = activeRoomId != null && location.pathname === `/live-rooms/${activeRoomId}`;

  // The room's own page already renders full-bleed below the app header — hiding the
  // header too reclaims that strip of height for the call instead of leaving it blank.
  useEffect(() => {
    document.body.classList.toggle('live-room-full', isOnRoomRoute);
    return () => document.body.classList.remove('live-room-full');
  }, [isOnRoomRoute]);

  if (!activeRoomId) return null;

  const churchLogoUrl = resolveMediaUrl(tenant?.logo_url) || null;

  // Off the room's own page: only the ready (connected) state gets a visible presence
  // (the minimized bar). Connecting/error/ended stay silent elsewhere in the app.
  if (!isOnRoomRoute && status !== 'ready') return null;

  if (status === 'connecting') {
    return (
      <div className="acs-status">
        {churchLogoUrl ? <img src={churchLogoUrl} alt="" className="acs-logo" /> : null}
        <Spinner size="lg" />
        <p>Connecting to {tenant?.name || 'ChristNerve'}…</p>
        <style>{acsStyles}</style>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="acs-status">
        {churchLogoUrl ? <img src={churchLogoUrl} alt="" className="acs-logo" /> : null}
        <p>{errorMessage}</p>
        <div className="acs-actions">
          <Button variant="outline" onClick={() => navigate('/live-rooms')}>
            <ArrowLeft size={15} /> Back to rooms
          </Button>
          <Button variant="primary" onClick={retry}>
            <RefreshCw size={15} /> Retry
          </Button>
        </div>
        <style>{acsStyles}</style>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="acs-status">
        <CheckCircle2 size={32} />
        <p>This room has ended.</p>
        <Button variant="primary" onClick={() => { leaveCall(); navigate('/live-rooms'); }}>
          Back to Live Rooms
        </Button>
        <style>{acsStyles}</style>
      </div>
    );
  }

  if (status === 'removed') {
    return (
      <div className="acs-status">
        <UserX size={32} />
        <p>You were removed from this room by the host.</p>
        <Button variant="primary" onClick={() => { leaveCall(); navigate('/live-rooms'); }}>
          Back to Live Rooms
        </Button>
        <style>{acsStyles}</style>
      </div>
    );
  }

  if (status === 'ready' && join) {
    return (
      <VideoRoom
        room={join.room}
        token={join.token}
        serverUrl={join.url}
        canPublish={join.can_publish}
        isModerator={join.is_host}
        churchName={tenant?.name || 'ChristNerve'}
        churchSlug={tenant?.slug || ''}
        churchLogoUrl={churchLogoUrl}
        brandColor={tenant?.brand_color}
        minimized={!isOnRoomRoute}
        onLeave={() => {
          leaveCall();
          if (isOnRoomRoute) navigate('/live-rooms');
        }}
        onEnded={() => {
          markEnded();
          if (isOnRoomRoute) navigate('/live-rooms');
        }}
        onRemoved={() => {
          markRemoved();
          if (isOnRoomRoute) navigate('/live-rooms');
        }}
        onRequestEndRoom={async () => {
          try {
            await api.post(`/live/rooms/${activeRoomId}/end`);
            toast.success('Room ended');
            leaveCall();
            navigate('/live-rooms');
          } catch {
            toast.error('Could not end room');
          }
        }}
        onConnectError={markConnectError}
        onReturnToRoom={() => navigate(`/live-rooms/${activeRoomId}`)}
      />
    );
  }

  return null;
}

const acsStyles = `
  .acs-status {
    position: fixed;
    top: calc(var(--topbar-height, 68px) + var(--safe-top, 0px));
    right: 0; bottom: 0; left: var(--sidebar-width, 0px);
    z-index: 150; background: #0c0b0a; color: #f5f3f0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; text-align: center; padding: 24px;
  }
  @media (max-width: 768px) {
    .acs-status { left: 0; }
  }
  .acs-logo { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; }
  .acs-actions { display: flex; gap: 10px; }
`;

export default ActiveCallOverlay;
