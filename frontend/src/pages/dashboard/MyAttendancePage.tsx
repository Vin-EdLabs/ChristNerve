import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import api from '../../services/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';

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

export default function MyAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [presentMonth, setPresentMonth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/attendance/mine');
        if (cancelled) return;
        setRows(asList<AttendanceRow>(res.data));
        setPresentMonth(Number(res.data?.stats?.present_this_month || 0));
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
