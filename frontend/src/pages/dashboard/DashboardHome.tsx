import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CalendarCheck,
  Wallet,
  Store,
  Sun,
  Moon,
  UserPlus,
  Heart,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import { useAuth } from '../../contexts/AuthContext';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import MemberHome from './MemberHome';

type DashPayload = {
  focus?: {
    new_members_week?: number;
    prayer_pending?: number;
    follow_pending?: number;
    welfare_open?: number;
    attendance_recorded_today?: boolean;
  };
  stats?: {
    members?: number;
    attendance?: number;
    giving?: number;
    listings?: number;
  };
  agenda?: Array<{
    id: number;
    title: string;
    start_datetime?: string;
    location?: string;
  }>;
  activity?: Array<{
    type: string;
    icon: string;
    text: string;
    at?: string;
    href?: string;
  }>;
  pulse?: {
    active?: number;
    visitors?: number;
    inactive?: number;
    new_this_month?: number;
    new_last_month?: number;
    total?: number;
  };
  giving?: {
    tithe?: number;
    offering?: number;
    building?: number;
    other?: number;
    total?: number;
  };
  pending?: {
    prayer?: number;
    follow_up?: number;
    welfare?: number;
    attendance_missing?: boolean;
  };
};

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function barPct(value: number, max: number) {
  if (!max || max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export default function DashboardHome() {
  const { accountType } = useAuth();
  if (accountType === 'member') return <MemberHome />;
  return <StaffDashboardHome />;
}

function StaffDashboardHome() {
  const { user, tenant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashPayload | null>(null);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const GreetingIcon = hour >= 6 && hour < 18 ? Sun : Moon;
  const firstName = user?.first_name || 'Pastor';
  const roleLabel = String(user?.role || 'staff').toLowerCase();
  const titlePrefix =
    roleLabel === 'pastor' || roleLabel === 'admin' ? 'Pastor ' : '';

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-GH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/dashboard/home');
        if (!cancelled) setData(res.data || {});
      } catch {
        if (!cancelled) {
          toast.error('Could not load dashboard');
          setData({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="dash-home">
        <SkeletonCard />
        <div className="dash-stats-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const pulse = data?.pulse || {};
  const giving = data?.giving || {};
  const pending = data?.pending || {};
  const agenda = data?.agenda || [];
  const activity = data?.activity || [];
  const pulseTotal = Math.max(1, Number(pulse.total) || 1);
  const givingMax = Math.max(
    1,
    Number(giving.tithe) || 0,
    Number(giving.offering) || 0,
    Number(giving.building) || 0,
    Number(giving.other) || 0
  );

  return (
    <div className="dash-home">
      <section className="dash-welcome-bar">
        <div>
          <h2>
            <GreetingIcon size={22} />
            {greeting}, {titlePrefix}
            {firstName}
          </h2>
          <p>
            {tenant?.name || 'Your church'} · {dateLabel}
          </p>
        </div>
        <Link to="/attendance" className="dash-welcome-cta">
          <CalendarCheck size={16} />
          Record attendance
        </Link>
      </section>

      <div className="dash-stats-grid">
        <article className="dash-stat-card">
          <div className="dash-stat-icon">
            <Users size={18} />
          </div>
          <div className="dash-stat-value">{stats.members ?? 0}</div>
          <div className="dash-stat-label">Total Members</div>
        </article>
        <article className="dash-stat-card">
          <div className="dash-stat-icon">
            <CalendarCheck size={18} />
          </div>
          <div className="dash-stat-value">{stats.attendance ?? 0}</div>
          <div className="dash-stat-label">This Sunday</div>
        </article>
        <article className="dash-stat-card">
          <div className="dash-stat-icon">
            <Wallet size={18} />
          </div>
          <div className="dash-stat-value dash-stat-value--sm">
            {formatGHS(Number(stats.giving ?? 0))}
          </div>
          <div className="dash-stat-label">Monthly Giving</div>
        </article>
        <article className="dash-stat-card dash-stat-card--soft">
          <div className="dash-stat-icon">
            <Store size={18} />
          </div>
          <div className="dash-stat-value">{stats.listings ?? 0}</div>
          <div className="dash-stat-label">Market Listings</div>
        </article>
      </div>

      <div className="dash-main-grid">
        <div className="dash-main-left">
          <section className="card dash-panel">
            <div className="dash-section-head">
              <p className="dash-section-label">Today&apos;s agenda</p>
              <Link to="/events">View events</Link>
            </div>
            {agenda.length === 0 ? (
              <EmptyState
                title="No events today."
                description="Add one from Events."
                actionLabel="Add event"
                onAction={() => {
                  window.location.href = '/events';
                }}
              />
            ) : (
              <ul className="dash-agenda">
                {agenda.map((ev) => (
                  <li key={ev.id}>
                    <div>
                      <strong>{ev.title}</strong>
                      <span>
                        {ev.start_datetime
                          ? new Date(ev.start_datetime).toLocaleTimeString(
                              'en-GH',
                              { hour: 'numeric', minute: '2-digit' }
                            )
                          : ''}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </span>
                    </div>
                    <Link to="/attendance" className="dash-inline-btn">
                      Record
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card dash-panel">
            <div className="dash-section-head">
              <p className="dash-section-label">Recent activity</p>
            </div>
            {activity.length === 0 ? (
              <p className="dash-muted">No recent activity yet.</p>
            ) : (
              <ul className="dash-activity">
                {activity.map((item, i) => (
                  <li key={`${item.text}-${i}`}>
                    <Link to={item.href || '/'}>
                      <span className="dash-activity-icon">
                        {item.icon === 'wallet' ? (
                          <Wallet size={14} />
                        ) : item.icon === 'calendar-check' ? (
                          <CalendarCheck size={14} />
                        ) : item.icon === 'user-plus' ? (
                          <UserPlus size={14} />
                        ) : (
                          <Heart size={14} />
                        )}
                      </span>
                      <span className="dash-activity-text">{item.text}</span>
                      <time>{timeAgo(item.at)}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="dash-main-right">
          <section className="card dash-panel">
            <p className="dash-section-label">Member pulse</p>
            <div className="dash-pulse-row">
              <span>Active</span>
              <strong>{pulse.active ?? 0}</strong>
              <div className="dash-bar">
                <i
                  style={{
                    width: `${barPct(Number(pulse.active), pulseTotal)}%`,
                  }}
                />
              </div>
              <em>{barPct(Number(pulse.active), pulseTotal)}%</em>
            </div>
            <div className="dash-pulse-row">
              <span>Visitors</span>
              <strong>{pulse.visitors ?? 0}</strong>
              <div className="dash-bar">
                <i
                  style={{
                    width: `${barPct(Number(pulse.visitors), pulseTotal)}%`,
                  }}
                />
              </div>
              <em>{barPct(Number(pulse.visitors), pulseTotal)}%</em>
            </div>
            <p className="dash-pulse-meta">
              New this month <strong>{pulse.new_this_month ?? 0}</strong>
              {pulse.new_last_month != null
                ? ` · from ${pulse.new_last_month} last month`
                : ''}
            </p>
            <p className="dash-pulse-meta">
              Inactive <strong>{pulse.inactive ?? 0}</strong> — needs follow-up
            </p>
            <Link to="/follow-up" className="dash-side-link">
              Follow up inactive members <ChevronRight size={14} />
            </Link>
          </section>

          <section className="card dash-panel">
            <p className="dash-section-label">Giving this month</p>
            {(
              [
                ['Tithe', giving.tithe],
                ['Offering', giving.offering],
                ['Building Fund', giving.building],
                ['Other', giving.other],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="dash-give-row">
                <div className="dash-give-top">
                  <span>{label}</span>
                  <strong>{formatGHS(Number(val || 0))}</strong>
                </div>
                <div className="dash-bar">
                  <i style={{ width: `${barPct(Number(val || 0), givingMax)}%` }} />
                </div>
              </div>
            ))}
            <div className="dash-give-total">
              <span>Total</span>
              <strong>{formatGHS(Number(giving.total || 0))}</strong>
            </div>
          </section>

          <section className="card dash-panel dash-pending">
            <p className="dash-section-label">Pending actions</p>
            <Link to="/prayer-requests">
              <AlertTriangle size={14} /> {pending.prayer || 0} prayer requests
              need response
            </Link>
            <Link to="/follow-up">
              <AlertTriangle size={14} /> {pending.follow_up || 0} members marked
              for follow-up
            </Link>
            <Link to="/welfare">
              <AlertTriangle size={14} /> {pending.welfare || 0} welfare cases
              open
            </Link>
            {pending.attendance_missing ? (
              <Link to="/attendance">
                <AlertTriangle size={14} /> Today&apos;s attendance not recorded
                yet
              </Link>
            ) : null}
          </section>
        </div>
      </div>

      <style>{`
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
          margin: 14px 0 18px;
        }
        .dash-stat-card {
          width: 100%;
          min-height: 132px;
          height: auto;
          aspect-ratio: auto;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px !important;
          box-sizing: border-box;
        }
        .dash-stat-card .dash-stat-icon {
          width: 34px;
          height: 34px;
        }
        .dash-stat-card .dash-stat-value {
          margin-top: auto;
          font-size: clamp(20px, 2.2vw, 28px);
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          line-height: 1.1;
          width: 100%;
        }
        .dash-stat-card .dash-stat-value--sm {
          font-size: clamp(14px, 1.5vw, 18px);
          line-height: 1.2;
          word-break: break-word;
        }
        .dash-stat-card .dash-stat-label {
          margin-top: 6px;
          font-size: 11px;
          letter-spacing: 0.05em;
          line-height: 1.25;
          width: 100%;
        }
        .dash-stat-card--soft { opacity: 0.9; }
        @media (max-width: 720px) {
          .dash-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dash-stat-card {
            min-height: 120px;
          }
        }
        .dash-main-grid {
          display: grid; gap: 16px;
          grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
        }
        @media (max-width: 960px) {
          .dash-main-grid { grid-template-columns: 1fr; }
        }
        .dash-main-left, .dash-main-right {
          display: flex; flex-direction: column; gap: 16px;
        }
        .dash-panel { padding: 18px; }
        .dash-section-head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px;
        }
        .dash-section-label {
          margin: 0 0 12px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted);
        }
        .dash-section-head .dash-section-label { margin: 0; }
        .dash-agenda, .dash-activity { list-style: none; margin: 0; padding: 0; }
        .dash-agenda li {
          display: flex; justify-content: space-between; gap: 12px;
          align-items: center; padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .dash-agenda li:last-child { border-bottom: 0; }
        .dash-agenda strong { display: block; font-size: 14px; }
        .dash-agenda span { font-size: 12px; color: var(--text-muted); }
        .dash-inline-btn {
          font-size: 12px; font-weight: 600; color: var(--accent);
          text-decoration: none; white-space: nowrap;
        }
        .dash-activity li a {
          display: grid; grid-template-columns: 28px 1fr auto;
          gap: 10px; align-items: start; padding: 10px 0;
          border-bottom: 1px solid var(--border);
          text-decoration: none; color: inherit;
        }
        .dash-activity li:last-child a { border-bottom: 0; }
        .dash-activity-icon {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--accent-light); color: var(--accent);
          display: grid; place-items: center;
        }
        .dash-activity-text { font-size: 13px; line-height: 1.4; }
        .dash-activity time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
        .dash-pulse-row {
          display: grid; grid-template-columns: 70px 40px 1fr 36px;
          gap: 8px; align-items: center; margin-bottom: 10px;
          font-size: 13px;
        }
        .dash-bar {
          height: 8px; border-radius: 999px; background: var(--bg-surface);
          overflow: hidden;
        }
        .dash-bar i {
          display: block; height: 100%;
          background: var(--accent); border-radius: 999px;
        }
        .dash-pulse-meta {
          font-size: 12px; color: var(--text-secondary); margin: 8px 0 0;
        }
        .dash-side-link {
          display: inline-flex; align-items: center; gap: 4px;
          margin-top: 12px; font-size: 13px; font-weight: 600;
          color: var(--accent); text-decoration: none;
        }
        .dash-give-row { margin-bottom: 12px; }
        .dash-give-top {
          display: flex; justify-content: space-between;
          font-size: 13px; margin-bottom: 6px;
        }
        .dash-give-total {
          display: flex; justify-content: space-between;
          padding-top: 10px; border-top: 1px solid var(--border);
          font-size: 14px; font-weight: 700;
        }
        .dash-pending a {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 10px 0; border-bottom: 1px solid var(--border);
          font-size: 13px; color: #9a6b1a; text-decoration: none;
        }
        .dash-pending a:last-child { border-bottom: 0; }
        .dash-muted { font-size: 13px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
