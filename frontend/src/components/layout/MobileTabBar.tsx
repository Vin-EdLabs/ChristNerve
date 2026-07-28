import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Wallet,
  Menu,
  Video,
  MessagesSquare,
  Newspaper,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { syncAppBadge } from '../../utils/appBadge';

type Tab = { to: string; label: string; icon: React.ElementType; end?: boolean; badge?: 'messages' };

function staffTabsForRole(role?: string | null): Tab[] {
  const r = (role || '').toLowerCase();
  if (r === 'finance') {
    return [
      { to: '/finance', label: 'Finance', icon: Wallet, end: true },
      { to: '/more', label: 'More', icon: Menu },
    ];
  }
  return [
    { to: '/', label: 'Home', icon: Home, end: true, badge: 'messages' },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/sermons', label: 'Sermons', icon: Video },
    { to: '/finance', label: 'Finance', icon: Wallet },
    { to: '/more', label: 'More', icon: Menu },
  ];
}

const MEMBER_TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, end: true, badge: 'messages' },
  { to: '/sermons', label: 'Sermons', icon: Video },
  { to: '/feed', label: 'Feed', icon: MessagesSquare },
  { to: '/bulletin', label: 'Bulletin', icon: Newspaper },
  { to: '/more', label: 'More', icon: Menu },
];

export const MobileTabBar: React.FC = () => {
  const { accountType, user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [messageCount, setMessageCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const tabs =
    accountType === 'member' ? MEMBER_TABS : staffTabsForRole(user?.role);

  const homeBadge = messageCount + notifCount;

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setMessageCount(0);
      setNotifCount(0);
      void syncAppBadge(0);
      return;
    }
    try {
      const [chatRes, notifRes] = await Promise.all([
        api.get('/chat/unread-total').catch(() => ({ data: { count: 0 } })),
        api.get('/notifications/unread-count').catch(() => ({ data: { count: 0 } })),
      ]);
      const chat = Number(chatRes.data?.count) || 0;
      const notifs = Number(notifRes.data?.count) || 0;
      setMessageCount(chat);
      setNotifCount(notifs);
      void syncAppBadge(chat + notifs);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 20000);
    const onFocus = () => void refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshUnread, location.pathname]);

  return (
    <nav className="mobile-tabbar" aria-label="Mobile navigation">
      {tabs.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}
        >
          <span className="mobile-tab-icon-wrap">
            <Icon size={20} />
            {badge === 'messages' && homeBadge > 0 && (
              <span className="mobile-tab-badge">
                {homeBadge > 9 ? '9+' : homeBadge}
              </span>
            )}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileTabBar;
