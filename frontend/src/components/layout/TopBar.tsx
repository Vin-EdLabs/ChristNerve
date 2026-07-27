import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  LogOut,
  Megaphone,
  MoreVertical,
  Moon,
  Network,
  ScrollText,
  Settings,
  Store,
  Sun,
  User,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';

export interface TopBarProps {
  title: string;
}

type NavLinkItem = {
  to: string;
  label: string;
  icon: React.ElementType;
};

const STAFF_MENU: NavLinkItem[] = [
  { to: '/members', label: 'Members', icon: Users },
  { to: '/users', label: 'Users', icon: UserCog },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/announcements', label: 'News', icon: Megaphone },
  { to: '/departments', label: 'Departments', icon: Network },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/market', label: 'Marketplace', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MEMBER_MENU: NavLinkItem[] = [
  { to: '/my-attendance', label: 'My Attendance', icon: CalendarCheck },
  { to: '/my-department', label: 'My Department', icon: Network },
  { to: '/announcements', label: 'News', icon: Megaphone },
  { to: '/market', label: 'Marketplace', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const FINANCE_MENU: NavLinkItem[] = [
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const TopBar: React.FC<TopBarProps> = ({ title }) => {
  const { user, logout, accountType } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '?';
  const firstName = user?.first_name || 'Friend';
  const role = String(user?.role || '').toLowerCase();

  const menuLinks =
    accountType === 'member'
      ? MEMBER_MENU
      : role === 'finance'
        ? FINANCE_MENU
        : STAFF_MENU;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(t)) {
        setProfileOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(t)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-user-block" ref={profileRef}>
          <button
            type="button"
            className="topbar-profile-btn"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((v) => !v);
              setMoreOpen(false);
            }}
          >
            <div className="avatar avatar-sm">{initials}</div>
            <div className="topbar-user-text">
              <p className="topbar-greet">Greetings {firstName}</p>
              <span className="topbar-role-pill">
                {role === 'super-admin'
                  ? 'PRIMARY ADMIN'
                  : (user?.role || 'member').toUpperCase()}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div className="topbar-dropdown" role="menu">
              <div className="topbar-dropdown-head">
                <strong>
                  {user?.first_name} {user?.last_name}
                </strong>
                <span>{user?.email}</span>
              </div>
              <Link
                to="/settings"
                className="topbar-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <User size={16} />
                Profile & settings
              </Link>
              <button
                type="button"
                className="topbar-dropdown-item"
                onClick={() => {
                  setProfileOpen(false);
                  toggleTheme();
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                className="topbar-dropdown-item topbar-dropdown-danger"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>

        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-actions">
        <span className="topbar-clock">
          {new Date().toLocaleTimeString('en-GH', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>

        <NotificationBell mode="church" />

        <div className="topbar-more-wrap" ref={moreRef}>
          <button
            type="button"
            className="topbar-icon-btn topbar-menu-colon-btn"
            aria-label="Open navigation menu"
            aria-expanded={moreOpen}
            onClick={() => {
              setMoreOpen((v) => !v);
              setProfileOpen(false);
            }}
          >
            <MoreVertical size={18} className="topbar-menu-icon" />
            <span className="topbar-colon" aria-hidden>
              :
            </span>
          </button>

          {moreOpen && (
            <div className="topbar-dropdown topbar-dropdown--right topbar-dropdown--nav" role="menu">
              <div className="topbar-dropdown-head">
                <strong>Menu</strong>
                <span>All pages</span>
              </div>
              {menuLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="topbar-dropdown-item"
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                className="topbar-dropdown-item"
                onClick={() => {
                  setMoreOpen(false);
                  toggleTheme();
                }}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                className="topbar-dropdown-item topbar-dropdown-danger"
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
