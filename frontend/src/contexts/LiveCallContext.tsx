import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { LiveRoomJoinResponse } from '../types/live';

type CallStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'ended' | 'removed';

interface LiveCallState {
  activeRoomId: number | null;
  status: CallStatus;
  join: LiveRoomJoinResponse | null;
  errorMessage: string;
}

interface LiveCallContextValue extends LiveCallState {
  /** Start (or silently resume) a call for this room. Safe to call repeatedly. */
  joinRoom: (roomId: number) => void;
  /** Retry a failed/ended join for the current room. */
  retry: () => void;
  /** Explicit user-initiated leave — clears the call entirely. */
  leaveCall: () => void;
  /** Host ended the room, or this client got disconnected without leaving on purpose. */
  markEnded: () => void;
  /** A moderator removed this client from the room. */
  markRemoved: () => void;
  /** The live WebRTC connection itself failed (bad token, network, etc). */
  markConnectError: (message: string) => void;
}

const STORAGE_KEY = 'christnerve_active_live_room';

const LiveCallContext = createContext<LiveCallContextValue | null>(null);

export const LiveCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRoomId, setActiveRoomIdState] = useState<number | null>(null);
  const [status, setStatusState] = useState<CallStatus>('idle');
  const [join, setJoin] = useState<LiveRoomJoinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Mirrors activeRoomId/status synchronously so `joinRoom` can read fresh values
  // without needing to change identity every time they change. That stability is what
  // stops a disconnect from cascading into an endless rejoin loop: LiveRoomPage's effect
  // depends on `joinRoom`, so if that reference changed on every status transition, any
  // disconnect (network blip, blocked camera permission, anything) would clear the call,
  // hand LiveRoomPage a new `joinRoom`, and its effect would immediately fire it again —
  // rejoin, fail the same way, disconnect, repeat forever. A stable `joinRoom` means the
  // effect only ever re-fires when the *route's* roomId actually changes.
  const liveRef = useRef<{ activeRoomId: number | null; status: CallStatus }>({
    activeRoomId: null,
    status: 'idle',
  });
  const setActiveRoomId = (id: number | null) => {
    liveRef.current.activeRoomId = id;
    setActiveRoomIdState(id);
  };
  const setStatus = (s: CallStatus) => {
    liveRef.current.status = s;
    setStatusState(s);
  };

  // Tracks the room id currently being fetched — null once settled (success or failure).
  // Prevents two concurrent fetches for the same room (e.g. the provider's silent resume
  // and the room page's own join both firing on the same initial mount).
  const inflightRoomRef = useRef<number | null>(null);
  const currentRoomRef = useRef<number | null>(null);

  const fetchToken = useCallback(async (roomId: number) => {
    if (inflightRoomRef.current === roomId) return;
    inflightRoomRef.current = roomId;
    currentRoomRef.current = roomId;
    setStatus('connecting');
    setErrorMessage('');
    try {
      const res = await api.post<LiveRoomJoinResponse>(`/live/rooms/${roomId}/token`);
      if (currentRoomRef.current !== roomId) return; // superseded by a newer join
      setJoin(res.data);
      setStatus('ready');
      sessionStorage.setItem(STORAGE_KEY, String(roomId));
    } catch (err: any) {
      if (currentRoomRef.current !== roomId) return;
      const httpStatus = err?.response?.status;
      if (httpStatus === 410) {
        setStatus('ended');
      } else {
        setErrorMessage(err?.response?.data?.error || 'Could not join this room');
        setStatus('error');
      }
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      if (inflightRoomRef.current === roomId) inflightRoomRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinRoom = useCallback(
    (roomId: number) => {
      const { activeRoomId: curRoomId, status: curStatus } = liveRef.current;
      if (curRoomId === roomId && (curStatus === 'ready' || curStatus === 'connecting')) return;
      setActiveRoomId(roomId);
      void fetchToken(roomId);
    },
    [fetchToken]
  );

  const retry = useCallback(() => {
    if (liveRef.current.activeRoomId != null) void fetchToken(liveRef.current.activeRoomId);
  }, [fetchToken]);

  const clearAll = useCallback(() => {
    inflightRoomRef.current = null;
    currentRoomRef.current = null;
    setActiveRoomId(null);
    setJoin(null);
    setStatus('idle');
    setErrorMessage('');
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const leaveCall = useCallback(() => {
    clearAll();
  }, [clearAll]);

  // Ended/removed keep activeRoomId so the room's own page can still show the
  // right status screen — only join/token state is cleared (the call itself is over).
  const markEnded = useCallback(() => {
    toast('The room has ended', { icon: '📴' });
    inflightRoomRef.current = null;
    currentRoomRef.current = null;
    setJoin(null);
    setStatus('ended');
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const markRemoved = useCallback(() => {
    toast.error('You were removed from the room by the host');
    inflightRoomRef.current = null;
    currentRoomRef.current = null;
    setJoin(null);
    setStatus('removed');
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const markConnectError = useCallback((message: string) => {
    inflightRoomRef.current = null;
    currentRoomRef.current = null;
    setJoin(null);
    setErrorMessage(message);
    setStatus('error');
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Silently resume a call that survives a page refresh.
  useEffect(() => {
    if (!localStorage.getItem('church_token')) return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const roomId = Number(stored);
      if (Number.isFinite(roomId)) joinRoom(roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing the tab (or a hard refresh) always ends the call outright — there's no way
  // for audio to keep playing once this page's JS stops running, so the best we can do
  // is stop that from happening by accident. Browsers ignore any custom message here and
  // show their own generic "leave site?" prompt — that's a platform restriction, not
  // something we control.
  useEffect(() => {
    if (status !== 'ready') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  return (
    <LiveCallContext.Provider
      value={{
        activeRoomId,
        status,
        join,
        errorMessage,
        joinRoom,
        retry,
        leaveCall,
        markEnded,
        markRemoved,
        markConnectError,
      }}
    >
      {children}
    </LiveCallContext.Provider>
  );
};

export function useLiveCall(): LiveCallContextValue {
  const ctx = useContext(LiveCallContext);
  if (!ctx) throw new Error('useLiveCall must be used within LiveCallProvider');
  return ctx;
}
