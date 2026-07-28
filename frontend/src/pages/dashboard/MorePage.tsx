import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  ChevronRight,
  HandHeart,
  HeartHandshake,
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
  UserRoundSearch,
  UsersRound,
  Wallet,
  Church,
  Video,
  Radio,
  BookOpen,
  Newspaper,
  MessagesSquare,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type LinkItem = {
  to: string;
  label: string;
  icon: React.ElementType;
  desc: string;
};

const STAFF_LINKS: LinkItem[] = [
  { to: '/sermons', label: 'Sermons', icon: Video, desc: 'YouTube messages library' },
  { to: '/live', label: 'Live Stream', icon: Radio, desc: 'Go live for members' },
  { to: '/devotionals', label: 'Devotionals', icon: BookOpen, desc: 'Daily word schedule' },
  { to: '/bulletin', label: 'Bulletin', icon: Newspaper, desc: 'Sunday order of service' },
  { to: '/feed', label: 'Church Feed', icon: MessagesSquare, desc: 'Posts & reactions' },
  { to: '/sunday-report', label: 'Sunday Report', icon: ClipboardList, desc: 'Share to WhatsApp' },
  { to: '/growth', label: 'Growth', icon: TrendingUp, desc: 'Membership & giving trends' },
  { to: '/whatsapp-actions', label: 'WhatsApp Actions', icon: MessageCircle, desc: 'Quick pastoral messages' },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, desc: 'Record services' },
  { to: '/cell-groups', label: 'Cell Groups', icon: UsersRound, desc: 'Small groups' },
  { to: '/prayer-requests', label: 'Prayer Requests', icon: HandHeart, desc: 'Pastoral prayer list' },
  { to: '/follow-up', label: 'Follow-Up', icon: UserRoundSearch, desc: 'Members needing contact' },
  { to: '/welfare', label: 'Welfare', icon: HeartHandshake, desc: 'Care cases' },
  { to: '/events', label: 'Events', icon: Calendar, desc: 'Upcoming gatherings' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, desc: 'Church notices' },
  { to: '/departments', label: 'Departments', icon: Network, desc: 'Teams & ministries' },
  { to: '/church-page', label: 'Church Page', icon: Church, desc: 'Visit page & join requests' },
  { to: '/users', label: 'Users & Roles', icon: UserCog, desc: 'Manage staff access' },
  { to: '/market', label: 'Marketplace', icon: Store, desc: 'Member businesses' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, desc: 'Church activity trail' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Church profile' },
];

const MEMBER_LINKS: LinkItem[] = [
  { to: '/', label: 'Home', icon: Home, desc: 'Your church home' },
  { to: '/sermons', label: 'Sermons', icon: Video, desc: 'Watch messages' },
  { to: '/live', label: 'Live Stream', icon: Radio, desc: 'Join when live' },
  { to: '/devotionals', label: 'Devotionals', icon: BookOpen, desc: 'Today’s word' },
  { to: '/bulletin', label: 'Bulletin', icon: Newspaper, desc: 'Order of service' },
  { to: '/feed', label: 'Church Feed', icon: MessagesSquare, desc: 'Amen, Love, Fire' },
  { to: '/my-department', label: 'My Department', icon: Network, desc: 'Team, roster & meetings' },
  { to: '/prayer-requests', label: 'Prayer Requests', icon: HandHeart, desc: 'Send prayer to pastors' },
  { to: '/welfare', label: 'Welfare', icon: HeartHandshake, desc: 'Request practical care' },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, desc: 'Church notices' },
  { to: '/whatsapp-actions', label: 'WhatsApp', icon: MessageCircle, desc: 'Quick wish templates' },
  { to: '/market', label: 'Marketplace', icon: Store, desc: 'Browse member shops' },
  { to: '/market/my-listings', label: 'My shop', icon: Store, desc: 'Your listings & orders' },
  { to: '/market/chat', label: 'Messages', icon: MessageCircle, desc: 'Buyer & seller chats' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Photo, phone & PIN' },
];

const FINANCE_LINKS: LinkItem[] = [
  { to: '/finance', label: 'Finance Dashboard', icon: Wallet, desc: 'Treasury overview' },
  { to: '/finance/giving', label: 'Giving', icon: Wallet, desc: 'Tithes & offerings' },
  { to: '/finance/expenses', label: 'Expenses', icon: Wallet, desc: 'Church expenses' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, desc: 'Finance activity trail' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Your profile' },
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
        {resolveMediaUrl(user?.avatar_url) ? (
          <img
            src={resolveMediaUrl(user?.avatar_url)}
            alt=""
            className="avatar avatar-lg"
          />
        ) : (
          <div className="avatar avatar-lg">
            {`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase()}
          </div>
        )}
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
