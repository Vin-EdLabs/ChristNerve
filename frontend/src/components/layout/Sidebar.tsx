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
  Church,
  HeartHandshake,
  UserRoundSearch,
  HandHeart,
  UsersRound,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type NavItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const STAFF_SECTIONS: NavSection[] = [
  {
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Congregation',
    items: [
      { to: '/members', label: 'Members', icon: Users },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
      { to: '/departments', label: 'Departments', icon: Network },
      { to: '/cell-groups', label: 'Cell Groups', icon: UsersRound },
    ],
  },
  {
    label: 'Pastoral Care',
    items: [
      { to: '/prayer-requests', label: 'Prayer Requests', icon: HandHeart },
      { to: '/follow-up', label: 'Follow-Up', icon: UserRoundSearch },
      { to: '/welfare', label: 'Welfare', icon: HeartHandshake },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Dashboard', icon: Wallet, end: true },
      { to: '/finance/giving', label: 'Giving', icon: Wallet },
      { to: '/finance/expenses', label: 'Expenses', icon: Receipt },
    ],
  },
  {
    label: 'Communication',
    items: [
      { to: '/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/events', label: 'Events', icon: Calendar },
      { to: '/church-page', label: 'Church Page', icon: Church },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { to: '/market', label: 'Browse Market', icon: Store },
      { to: '/market/my-listings', label: 'My Listings', icon: Store },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/users', label: 'Users', icon: UserCog },
      { to: '/audit', label: 'Audit Log', icon: ScrollText },
      { to: '/settings', label: 'Church Settings', icon: Settings },
    ],
  },
];

const FINANCE_SECTIONS: NavSection[] = [
  {
    label: 'Finance',
    items: [
      { to: '/finance', label: 'Dashboard', icon: Wallet, end: true },
      { to: '/finance/giving', label: 'Giving', icon: Wallet },
      { to: '/finance/expenses', label: 'Expenses', icon: Receipt },
      { to: '/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
  {
    label: 'Settings',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];

const MEMBER_SECTIONS: NavSection[] = [
  {
    items: [{ to: '/', label: 'Home', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Church life',
    items: [
      { to: '/my-department', label: 'My Department', icon: Network },
      { to: '/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/prayer-requests', label: 'Prayer Requests', icon: HandHeart },
      { to: '/welfare', label: 'Welfare', icon: HeartHandshake },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { to: '/market', label: 'Browse Market', icon: Store },
      { to: '/market/my-listings', label: 'My Shop', icon: Store },
    ],
  },
  {
    label: 'Settings',
    items: [{ to: '/settings', label: 'My Account', icon: Settings }],
  },
];

export const Sidebar: React.FC = () => {
  const { user, tenant, logout, accountType } = useAuth();
  const role = String(user?.role || '').toLowerCase();

  const sections =
    accountType === 'member'
      ? MEMBER_SECTIONS
      : role === 'finance'
        ? FINANCE_SECTIONS
        : STAFF_SECTIONS;

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
        <div className="sidebar-brand-text">
          <strong>{tenant?.short_name || tenant?.name || 'ChristNerve'}</strong>
          <span>Church OS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((section, si) => (
          <div key={section.label || `s-${si}`} className="sidebar-section">
            {section.label ? (
              <p className="sidebar-section-label">{section.label}</p>
            ) : null}
            {section.items.map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? ' active' : ''}`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-name">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="sidebar-user-role">{user?.role || accountType}</div>
          </div>
        </div>
        <button type="button" className="sidebar-signout" onClick={logout}>
          Sign out
        </button>
      </div>

      <style>{`
        .sidebar-section { margin-bottom: 4px; }
        .sidebar-section-label {
          margin: 24px 16px 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: rgba(248, 247, 245, 0.45);
        }
        .sidebar-section:first-child .sidebar-section-label { margin-top: 8px; }
      `}</style>
    </aside>
  );
};
