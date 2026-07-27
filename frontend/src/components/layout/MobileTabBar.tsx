import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  Wallet,
  Store,
  Menu,
  Network,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Tab = { to: string; label: string; icon: React.ElementType; end?: boolean };

function staffTabsForRole(role?: string | null): Tab[] {
  const r = (role || '').toLowerCase();
  if (r === 'finance') {
    return [
      { to: '/finance', label: 'Finance', icon: Wallet, end: true },
      { to: '/more', label: 'More', icon: Menu },
    ];
  }
  return [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/finance', label: 'Finance', icon: Wallet },
    { to: '/market', label: 'Market', icon: Store },
    { to: '/more', label: 'More', icon: Menu },
  ];
}

/** Church first, with marketplace on the tab bar. */
const MEMBER_TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/market', label: 'Market', icon: Store },
  { to: '/my-department', label: 'Dept', icon: Network },
  { to: '/announcements', label: 'News', icon: Megaphone },
  { to: '/more', label: 'More', icon: Menu },
];

export const MobileTabBar: React.FC = () => {
  const { accountType, user } = useAuth();
  const tabs =
    accountType === 'member' ? MEMBER_TABS : staffTabsForRole(user?.role);

  return (
    <nav className="mobile-tabbar" aria-label="Mobile navigation">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}
        >
          <span className="mobile-tab-icon-wrap">
            <Icon size={20} />
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileTabBar;
