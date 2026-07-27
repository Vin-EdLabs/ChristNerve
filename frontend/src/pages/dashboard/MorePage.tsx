import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  ChevronRight,
  Home,
  LogOut,
  Megaphone,
  MessageCircle,
  Moon,
  Network,
  ScrollText,
  Settings,
  Store,
  Sun,
  UserCog,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

type LinkItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  desc: string;
};

const STAFF_LINKS: LinkItem[] = [
  { to: '/users', label: 'Users & Roles', icon: UserCog, desc: 'Manage staff access' },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, desc: 'Record services' },
  { to: '/events', label: 'Events', icon: Calendar, desc: 'Upcoming gatherings' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, desc: 'Church notices' },
  { to: '/departments', label: 'Departments', icon: Network, desc: 'Teams & ministries' },
  { to: '/market', label: 'Marketplace', icon: Store, desc: 'Member businesses' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, desc: 'Church activity trail' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Church profile' },
];

const FINANCE_LINKS: LinkItem[] = [
  { to: '/finance', label: 'Finance', icon: Wallet, desc: 'Tithes, offerings, expenses' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, desc: 'Finance activity trail' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Your profile' },
];

const MEMBER_LINKS: LinkItem[] = [
  { to: '/', label: 'Home', icon: Home, desc: 'Attendance & department' },
  { to: '/my-attendance', label: 'My Attendance', icon: CalendarCheck, desc: 'Your service check-ins' },
  { to: '/my-department', label: 'My Department', icon: Network, desc: 'Where you serve' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, desc: 'Church notices' },
  { to: '/market', label: 'Marketplace', icon: Store, desc: 'Browse member shops' },
  { to: '/market/my-listings', label: 'My shop', icon: Store, desc: 'Your listings & orders' },
  { to: '/market/chat', label: 'Messages', icon: MessageCircle, desc: 'Buyer & seller chats' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Username & password' },
];

export default function MorePage() {
  const { user, tenant, logout, accountType } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const role = String(user?.role || '').toLowerCase();

  const links =
    accountType === 'member'
      ? MEMBER_LINKS
      : role === 'finance'
        ? FINANCE_LINKS
        : STAFF_LINKS;

  return (
    <div className="more-page">
      <div className="more-profile card glass-card">
        <div className="avatar avatar-lg">
          {`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase()}
        </div>
        <div>
          <h2>
            {user?.first_name} {user?.last_name}
          </h2>
          <p>{tenant?.name}</p>
          <span className="topbar-role-pill">
            {(accountType === 'member' ? 'member' : user?.role || 'staff').toUpperCase()}
          </span>
        </div>
      </div>

      <section className="more-section">
        <h3 className="more-section-title">Menu</h3>
        <div className="more-list card glass-card">
          {links.map(({ to, label, icon: Icon, desc }) => (
            <Link key={to} to={to} className="more-item">
              <span className="more-item-icon">
                <Icon size={18} />
              </span>
              <span className="more-item-text">
                <strong>{label}</strong>
                <small>{desc}</small>
              </span>
              <ChevronRight size={16} className="more-chevron" />
            </Link>
          ))}
        </div>
      </section>

      <section className="more-section">
        <h3 className="more-section-title">Preferences</h3>
        <div className="more-list card glass-card">
          <button type="button" className="more-item" onClick={toggleTheme}>
            <span className="more-item-icon">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span className="more-item-text">
              <strong>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong>
              <small>Switch appearance</small>
            </span>
          </button>
          <button type="button" className="more-item more-item--danger" onClick={logout}>
            <span className="more-item-icon">
              <LogOut size={18} />
            </span>
            <span className="more-item-text">
              <strong>Sign out</strong>
              <small>Leave this church session</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
