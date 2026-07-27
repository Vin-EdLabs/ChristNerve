import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  Store,
  Calendar,
  Megaphone,
  Network,
  Settings,
  UserCog,
  ScrollText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BrandLogo } from '../ui/BrandLogo';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
};

const FULL_STAFF_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/users', label: 'Users', icon: UserCog },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/market', label: 'Marketplace', icon: Store },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/departments', label: 'Departments', icon: Network },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const FINANCE_NAV: NavItem[] = [
  { to: '/finance', label: 'Finance', icon: Wallet, end: true },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MEMBER_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/my-attendance', label: 'My Attendance', icon: CalendarCheck },
  { to: '/my-department', label: 'My Department', icon: Network },
  { to: '/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/market', label: 'Marketplace', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user, tenant, logout, accountType } = useAuth();
  const role = String(user?.role || '').toLowerCase();

  const nav =
    accountType === 'member'
      ? MEMBER_NAV
      : role === 'finance'
        ? FINANCE_NAV
        : FULL_STAFF_NAV;

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : '?';

  const logoSrc = resolveMediaUrl(tenant?.logo_url);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {logoSrc ? (
          <img src={logoSrc} alt="" className="sidebar-logo" />
        ) : (
          <img src="/logo.png" alt="ChristNerve" className="sidebar-logo" />
        )}
        <span className="sidebar-church-name">{tenant?.name || 'ChristNerve'}</span>
      </div>

      <nav className="sidebar-nav">
        {nav.map((item) => {
          const Icon = item.icon;
          const end = Boolean(item.end);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
        {accountType !== 'member' && role !== 'finance' && (
          <a href="/market" className="sidebar-link" style={{ opacity: 0.85 }}>
            <Store size={18} />
            Public Market
          </a>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          {user?.avatar_url ? (
            <img
              src={resolveMediaUrl(user.avatar_url)}
              alt=""
              className="sidebar-avatar"
            />
          ) : (
            <div className="sidebar-avatar sidebar-avatar--fallback">{initials}</div>
          )}
          <div>
            <div className="sidebar-user-name">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="sidebar-user-role">
              {accountType === 'member' ? 'Member' : user?.role || 'Admin'}
            </div>
          </div>
        </div>
        <button type="button" className="sidebar-signout" onClick={logout}>
          Sign out
        </button>
        <div style={{ marginTop: 12, opacity: 0.7 }}>
          <BrandLogo size="sm" inverted showWordmark={false} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
