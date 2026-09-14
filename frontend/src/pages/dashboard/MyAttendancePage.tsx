import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import api from '../../services/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useCachedQuery } from '../../utils/useCachedQuery';

interface AttendanceRow {
  id: number;
  service_type: string;
  service_date: string;
  checked_in_at: string;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

type MyAttendancePayload = {
  rows: AttendanceRow[];
  presentMonth: number;
};

export default function MyAttendancePage() {
  const { data, loading } = useCachedQuery<MyAttendancePayload>(
    'my-attendance',
    async () => {
      try {
        const res = await api.get('/attendance/mine');
        return {
          rows: asList<AttendanceRow>(res.data),
          presentMonth: Number(res.data?.stats?.present_this_month || 0),
        };
      } catch {
        return { rows: [], presentMonth: 0 };
      }
    }
  );
  const rows = data?.rows ?? [];
  const presentMonth = data?.presentMonth ?? 0;

  if (loading) return <Spinner fullPage />;

  return (
    <div className="member-page">
      <div className="page-head">
        <p className="member-home-kicker">Church life</p>
        <h1 className="page-title">My attendance</h1>
        <p className="page-sub">
          {presentMonth} check-in{presentMonth === 1 ? '' : 's'} this month.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No attendance yet"
          description="When you are checked in at a service, it will show up here."
        />
      ) : (
        <div className="member-att-list">
          {rows.map((row) => (
            <article key={row.id} className="glass-card member-att-row">
              <CalendarCheck size={18} />
              <div>
                <strong>{row.service_type}</strong>
                <p>
                  {new Date(row.service_date).toLocaleDateString('en-GH', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <Link to="/" className="member-home-link" style={{ marginTop: 16 }}>
        ← Back home
      </Link>
    </div>
  );
}
