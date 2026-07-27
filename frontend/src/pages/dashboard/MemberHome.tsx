import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  ChevronRight,
  Megaphone,
  Network,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import type { ChurchAnnouncement } from '../../types';
import { Spinner } from '../../components/ui/Spinner';

interface AttendanceRow {
  id: number;
  service_type: string;
  service_date: string;
  checked_in_at: string;
}

interface DeptInfo {
  name?: string;
  description?: string | null;
  leader_first_name?: string;
  leader_last_name?: string;
  member_count?: number | null;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1438232992991-9998f8d4b5e0?w=1400&q=80';

export default function MemberHome() {
  const { user, tenant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [presentMonth, setPresentMonth] = useState(0);
  const [department, setDepartment] = useState<DeptInfo | null>(null);
  const [ministry, setMinistry] = useState<string | null>(null);
  const [news, setNews] = useState<ChurchAnnouncement[]>([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [attRes, deptRes, newsRes] = await Promise.all([
          api.get('/attendance/mine').catch(() => ({ data: { data: [], stats: {} } })),
          api.get('/departments/mine').catch(() => ({ data: {} })),
          api.get('/announcements').catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        setAttendance(asList<AttendanceRow>(attRes.data).slice(0, 5));
        setPresentMonth(Number(attRes.data?.stats?.present_this_month || 0));
        setDepartment(deptRes.data?.department || null);
        setMinistry(deptRes.data?.ministry || user?.ministry || null);
        setNews(asList<ChurchAnnouncement>(newsRes.data).slice(0, 3));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.ministry]);

  const greeting = useMemo(
    () => greetingForHour(now.getHours()),
    [now]
  );

  const dateLabel = useMemo(
    () =>
      now.toLocaleDateString('en-GH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [now]
  );

  if (loading) return <Spinner fullPage />;

  const firstName = user?.first_name || 'Friend';
  const churchName = tenant?.name || 'Your church';
  const deptName =
    department?.name || user?.department || 'Not assigned yet';
  const leader = department
    ? `${department.leader_first_name || ''} ${department.leader_last_name || ''}`.trim()
    : '';
  const heroImg = resolveMediaUrl(tenant?.banner_url, HERO_FALLBACK);

  return (
    <div className="member-home member-home--alive">
      <header className="mh-hero">
        <div className="mh-hero-media" aria-hidden>
          <img src={heroImg} alt="" className="mh-hero-img" />
          <div className="mh-hero-veil" />
        </div>
        <div className="mh-hero-copy">
          <p className="mh-hero-church">{churchName}</p>
          <h1 className="mh-hero-title">
            {greeting}, {firstName}
          </h1>
          <p className="mh-hero-sub">{dateLabel} · glad you are here</p>
        </div>
      </header>

      <div className="mh-pulse" aria-hidden>
        <span className="mh-pulse-dot" />
        <span>Church life is open</span>
      </div>

      <div className="member-home-grid">
        <section className="mh-panel mh-panel--attend">
          <div className="member-home-card-head">
            <CalendarCheck size={18} />
            <h2>My attendance</h2>
          </div>
          <p className="member-home-stat">
            <strong>{presentMonth}</strong>
            <span>services this month</span>
          </p>
          {attendance.length === 0 ? (
            <p className="member-home-empty">No check-ins recorded yet.</p>
          ) : (
            <ul className="member-home-list">
              {attendance.map((row) => (
                <li key={row.id}>
                  <span>{row.service_type}</span>
                  <time>
                    {new Date(row.service_date).toLocaleDateString('en-GH', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <Link to="/my-attendance" className="member-home-link">
            View full history <ChevronRight size={14} />
          </Link>
        </section>

        <section className="mh-panel mh-panel--dept">
          <div className="member-home-card-head">
            <Network size={18} />
            <h2>My department</h2>
          </div>
          <p className="member-home-dept-name">{deptName}</p>
          {ministry && <p className="member-home-meta">Ministry: {ministry}</p>}
          {leader && <p className="member-home-meta">Leader: {leader}</p>}
          {department?.member_count != null && (
            <p className="member-home-meta">
              <Users size={14} /> {department.member_count} members
            </p>
          )}
          {department?.description && (
            <p className="member-home-desc">{department.description}</p>
          )}
          <Link to="/my-department" className="member-home-link">
            Department details <ChevronRight size={14} />
          </Link>
        </section>
      </div>

      {news.length > 0 && (
        <section className="mh-panel mh-news">
          <div className="member-home-card-head">
            <Megaphone size={18} />
            <h2>From the church</h2>
          </div>
          <ul className="mh-news-list">
            {news.map((item, i) => (
              <li
                key={item.id}
                className="mh-news-item"
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
          <Link to="/announcements" className="member-home-link">
            All announcements <ChevronRight size={14} />
          </Link>
        </section>
      )}

      <section className="mh-panel mh-links">
        <h2>Quick links</h2>
        <div className="member-home-action-row">
          <Link to="/announcements" className="mh-link">
            <span className="mh-link-icon">
              <Megaphone size={18} />
            </span>
            <span>News</span>
          </Link>
          <Link to="/market" className="mh-link">
            <span className="mh-link-icon">
              <Store size={18} />
            </span>
            <span>Market</span>
          </Link>
          <Link to="/market/my-listings" className="mh-link">
            <span className="mh-link-icon">
              <Store size={18} />
            </span>
            <span>My shop</span>
          </Link>
          <Link to="/settings" className="mh-link">
            <span className="mh-link-icon">
              <Settings size={18} />
            </span>
            <span>Settings</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
