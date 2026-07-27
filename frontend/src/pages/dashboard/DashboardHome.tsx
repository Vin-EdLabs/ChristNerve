import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CalendarCheck, Wallet, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/ui/StatCard';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import MemberHome from './MemberHome';
import type { ChurchGiving, ChurchEvent, ChurchAnnouncement } from '../../types';

interface DashboardStats {
  members: number;
  attendance: number;
  giving: number;
  listings: number;
  membersTrend?: string;
  attendanceTrend?: string;
  givingTrend?: string;
  listingsTrend?: string;
  attendanceDir?: 'up' | 'down' | 'neutral';
}

function asArray<T>(payload: unknown, keys: string[] = ['data']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export default function DashboardHome() {
  const { accountType } = useAuth();
  if (accountType === 'member') {
    return <MemberHome />;
  }
  return <StaffDashboardHome />;
}

function StaffDashboardHome() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [giving, setGiving] = useState<ChurchGiving[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [announcements, setAnnouncements] = useState<ChurchAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [membersRes, attendanceRes, givingSummaryRes, givingRes, eventsRes, announcementsRes, listingsRes] =
          await Promise.allSettled([
            api.get('/members/stats'),
            api.get('/attendance/stats'),
            api.get('/finance/giving/summary'),
            api.get('/finance/giving', { params: { limit: 10 } }),
            api.get('/events', { params: { upcoming: true } }),
            api.get('/announcements'),
            api.get('/market/listings', { params: { limit: 1, page: 1 } }),
          ]);

        if (cancelled) return;

        const memberStats =
          membersRes.status === 'fulfilled' ? membersRes.value.data : null;
        const attStats =
          attendanceRes.status === 'fulfilled' ? attendanceRes.value.data : null;
        const giveSummary =
          givingSummaryRes.status === 'fulfilled'
            ? givingSummaryRes.value.data
            : null;
        const listingsPayload =
          listingsRes.status === 'fulfilled' ? listingsRes.value.data : null;

        setStats({
          members: memberStats?.total ?? memberStats?.active ?? 0,
          attendance:
            attStats?.recent_sundays?.[attStats.recent_sundays.length - 1]
              ?.total_count ??
            attStats?.this_month_average ??
            0,
          giving:
            giveSummary?.this_month_total ??
            giveSummary?.total_this_month ??
            0,
          listings:
            listingsPayload?.pagination?.total ??
            listingsPayload?.total ??
            0,
          membersTrend: memberStats?.new_this_month
            ? `+${memberStats.new_this_month} this month`
            : undefined,
          attendanceTrend:
            attStats?.trend === 'up'
              ? 'Up vs last month'
              : attStats?.trend === 'down'
                ? 'Down vs last month'
                : 'Steady vs last month',
          attendanceDir:
            attStats?.trend === 'up'
              ? 'up'
              : attStats?.trend === 'down'
                ? 'down'
                : 'neutral',
          givingTrend: 'This month',
          listingsTrend: 'Active listings',
        });

        setGiving(
          asArray<ChurchGiving>(
            givingRes.status === 'fulfilled' ? givingRes.value.data : null,
            ['data', 'giving']
          ).slice(0, 10)
        );
        setEvents(
          asArray<ChurchEvent>(
            eventsRes.status === 'fulfilled' ? eventsRes.value.data : null
          ).slice(0, 5)
        );
        const anns = asArray<ChurchAnnouncement>(
          announcementsRes.status === 'fulfilled'
            ? announcementsRes.value.data
            : null
        );
        setAnnouncements(anns.filter((a) => a.is_pinned).slice(0, 4));
      } catch {
        toast.error('Failed to load dashboard');
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
        <div className="dash-stats-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="dash-bottom">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="dash-home">
      <section className="dash-welcome card">
        <div>
          <h2 className="dash-welcome-title">
            {new Date().getHours() < 12
              ? 'Good morning'
              : new Date().getHours() < 17
                ? 'Good afternoon'
                : 'Good evening'}
          </h2>
          <p className="dash-welcome-date">
            {new Date().toLocaleDateString('en-GH', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="dash-welcome-badges">
            <span className="sa-chip sa-chip--gold">Church Active</span>
            <span className="sa-chip">{stats?.members ?? 0} members</span>
          </div>
        </div>
        <div className="dash-welcome-actions">
          <Link to="/finance" className="btn btn-primary">
            + Record Giving
          </Link>
          <Link to="/members" className="btn btn-outline">
            + Add Member
          </Link>
          <Link to="/announcements" className="btn btn-ghost">
            Announcement
          </Link>
        </div>
      </section>

      <div className="dash-stats-grid">
        <StatCard
          label="Total Members"
          value={stats?.members ?? 0}
          icon={<Users size={18} />}
          trend={stats?.membersTrend}
          trendDirection="up"
        />
        <StatCard
          label="Last Service Attendance"
          value={Math.round(Number(stats?.attendance ?? 0))}
          icon={<CalendarCheck size={18} />}
          trend={stats?.attendanceTrend}
          trendDirection={stats?.attendanceDir}
        />
        <StatCard
          label="Monthly Giving"
          value={formatGHS(Number(stats?.giving ?? 0))}
          icon={<Wallet size={18} />}
          trend={stats?.givingTrend}
          trendDirection="up"
        />
        <StatCard
          label="Active Listings"
          value={stats?.listings ?? 0}
          icon={<Store size={18} />}
          trend={stats?.listingsTrend}
        />
      </div>

      <div className="dash-bottom">
        <section className="card dash-giving">
          <div className="dash-section-head">
            <h2>Recent Giving</h2>
            <Link to="/finance">View all</Link>
          </div>
          {giving.length === 0 ? (
            <EmptyState
              title="No giving recorded this month."
              description="Record tithes and offerings from the finance page."
              actionLabel="Go to Finance"
              onAction={() => {
                window.location.href = '/finance';
              }}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {giving.map((g) => (
                    <tr key={g.id}>
                      <td>
                        {g.member_name ||
                          (g.first_name
                            ? `${g.first_name} ${g.last_name || ''}`
                            : g.member_id
                              ? `Member #${g.member_id}`
                              : 'Anonymous')}
                      </td>
                      <td>{g.giving_type}</td>
                      <td className="mono">{formatGHS(Number(g.amount))}</td>
                      <td>
                        {g.service_date
                          ? new Date(g.service_date).toLocaleDateString('en-GH')
                          : '—'}
                      </td>
                      <td>{g.payment_method || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="dash-side">
          <section className="card">
            <div className="dash-section-head">
              <h2>Upcoming Events</h2>
              <Link to="/events">View</Link>
            </div>
            {events.length === 0 ? (
              <p className="muted">No upcoming events.</p>
            ) : (
              <ul className="dash-list">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <strong>{ev.title}</strong>
                    <span>
                      {ev.start_datetime
                        ? new Date(ev.start_datetime).toLocaleString('en-GH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="dash-section-head">
              <h2>Announcements</h2>
              <Link to="/announcements">View</Link>
            </div>
            {announcements.length === 0 ? (
              <p className="muted">No pinned announcements.</p>
            ) : (
              <ul className="dash-list">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <span className="clamp">{a.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <style>{`
        .dash-home { display: flex; flex-direction: column; gap: 24px; }
        .dash-welcome {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .dash-welcome-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .dash-welcome-date {
          color: var(--text-secondary, #6b6560);
          font-size: 14px;
          margin-top: 4px;
        }
        .dash-welcome-badges {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .dash-welcome-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dash-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .dash-bottom {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 16px;
        }
        .dash-side { display: flex; flex-direction: column; gap: 16px; }
        .dash-section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .dash-section-head h2 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 22px;
          font-weight: 600;
        }
        .dash-section-head a {
          font-size: 13px;
          color: var(--accent, #2d1b69);
          text-decoration: none;
        }
        .dash-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
        .dash-list li { display: flex; flex-direction: column; gap: 4px; }
        .dash-list span { font-size: 13px; color: var(--text-secondary, #6b6560); }
        .clamp {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .muted { color: var(--text-muted, #9e9893); font-size: 14px; }
        .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
        .table-wrap { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .data-table th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted, #9e9893);
          padding: 8px 10px;
          border-bottom: 1px solid var(--border, #e8e4dc);
        }
        .data-table td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border, #e8e4dc);
        }
        @media (max-width: 1100px) {
          .dash-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-bottom { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .dash-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
