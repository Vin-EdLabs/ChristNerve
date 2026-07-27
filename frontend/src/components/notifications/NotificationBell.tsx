import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  enablePushNotifications,
  isFirebaseConfigured,
  onForegroundMessage,
} from '../../lib/firebase';
import { syncAppBadge } from '../../utils/appBadge';
import toast from 'react-hot-toast';
import './NotificationBell.css';

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationBellProps {
  mode: 'church' | 'platform';
}

function listPath(mode: NotificationBellProps['mode']) {
  return mode === 'platform' ? '/superadmin/notifications' : '/notifications';
}

function readPath(mode: NotificationBellProps['mode'], id: number) {
  return mode === 'platform'
    ? `/superadmin/notifications/read/${id}`
    : `/notifications/read/${id}`;
}

function readAllPath(mode: NotificationBellProps['mode']) {
  return mode === 'platform'
    ? '/superadmin/notifications/read-all'
    : '/notifications/read-all';
}

function deviceTokenPath(mode: NotificationBellProps['mode']) {
  return mode === 'platform'
    ? '/superadmin/notifications/device-token'
    : '/notifications/device-token';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ mode }) => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const unread = items.filter((n) => !n.is_read).length;

  const applyBadge = useCallback(async (notifUnread: number) => {
    let chatUnread = 0;
    if (mode === 'church') {
      try {
        const chat = await api.get('/chat/unread-total');
        chatUnread = Number(chat.data?.count) || 0;
      } catch {
        // ignore
      }
    }
    await syncAppBadge(notifUnread + chatUnread);
  }, [mode]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(listPath(mode));
      const rows = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(rows) ? rows : [];
      setItems(list);
      const unreadCount =
        typeof res.data?.unread === 'number'
          ? res.data.unread
          : list.filter((n: AppNotification) => !n.is_read).length;
      void applyBadge(unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode, applyBadge]);

  useEffect(() => {
    void fetchNotifications();
    const poll = window.setInterval(() => {
      void fetchNotifications();
    }, 12000);
    return () => window.clearInterval(poll);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        // If already granted, register token. Don't auto-prompt here (needs user gesture).
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const result = await enablePushNotifications();
          if (result.token && !cancelled) {
            await api.post(deviceTokenPath(mode), { token: result.token });
          }
        }
        unsubscribe = await onForegroundMessage((payload) => {
          if (cancelled) return;
          toast(
            [payload.title, payload.body].filter(Boolean).join(' — ') ||
              'New notification',
            { icon: '🔔' }
          );
          void fetchNotifications();
        });
      } catch (err) {
        console.warn('[notifications] device token setup skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const markRead = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        const res = await api.post(readPath(mode, n.id));
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
        );
        const nextUnread =
          typeof res.data?.unread === 'number'
            ? res.data.unread
            : Math.max(0, unread - 1);
        void applyBadge(nextUnread);
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post(readAllPath(mode));
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
      void applyBadge(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="topbar-icon-btn notif-bell-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void fetchNotifications();
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="notif-bell-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-panel-head">
            <span className="notif-panel-title">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className="notif-panel-action"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-list">
            {loading && items.length === 0 && (
              <p className="notif-empty">Loading…</p>
            )}
            {!loading && items.length === 0 && (
              <p className="notif-empty">No notifications yet</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notif-item${n.is_read ? '' : ' is-unread'}`}
                onClick={() => void markRead(n)}
              >
                <span className="notif-item-title">{n.title}</span>
                <span className="notif-item-body">{n.body}</span>
                <span className="notif-item-time">{formatTime(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
