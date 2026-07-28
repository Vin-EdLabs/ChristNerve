import { useCallback, useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { canEditChurchMedia } from '../../utils/churchLife';

type TrendPoint = { month?: string; date?: string; count?: number; total?: number; amount?: number };

type Growth = {
  membership_trend: TrendPoint[];
  attendance_trend: TrendPoint[];
  giving_trend: TrendPoint[];
};

function BarList({
  items,
  valueKey,
  labelKey,
}: {
  items: TrendPoint[];
  valueKey: 'count' | 'total' | 'amount';
  labelKey: 'month' | 'date';
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey] || 0)));
  if (!items.length) return <p className="muted">No data yet</p>;
  return (
    <ul className="trend-bars">
      {items.map((item, i) => {
        const val = Number(item[valueKey] || 0);
        const label = String(item[labelKey] || '').slice(0, 10);
        return (
          <li key={`${label}-${i}`}>
            <span className="trend-label">{label}</span>
            <span className="trend-track">
              <span
                className="trend-fill"
                style={{ width: `${Math.round((val / max) * 100)}%` }}
              />
            </span>
            <span className="trend-val">{val}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function GrowthDashboardPage() {
  const { accountType, user } = useAuth();
  const canView = accountType !== 'member';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Growth>({
    membership_trend: [],
    attendance_trend: [],
    giving_trend: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/church-life/growth');
      const d = res.data?.data || res.data || {};
      setData({
        membership_trend: d.membership_trend || [],
        attendance_trend: d.attendance_trend || [],
        giving_trend: d.giving_trend || [],
      });
    } catch {
      toast.error('Failed to load growth');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  if (!canView) {
    return (
      <EmptyState
        icon={<TrendingUp size={28} />}
        title="Staff only"
        description="Growth insights are for church leadership."
      />
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Growth Dashboard</h1>
          <p className="page-sub">
            Membership, attendance, and giving at a glance.
            {!canEditChurchMedia(accountType, user?.role)
              ? ''
              : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : (
        <div className="growth-grid">
          <section className="card glass-card growth-card">
            <h2>Membership</h2>
            <BarList
              items={data.membership_trend}
              valueKey="count"
              labelKey="month"
            />
          </section>
          <section className="card glass-card growth-card">
            <h2>Attendance</h2>
            <BarList
              items={data.attendance_trend}
              valueKey="total"
              labelKey="date"
            />
          </section>
          <section className="card glass-card growth-card">
            <h2>Giving</h2>
            <BarList
              items={data.giving_trend}
              valueKey="amount"
              labelKey="month"
            />
          </section>
        </div>
      )}

      <style>{`
        .page-header-row { margin-bottom:16px; }
        .page-title { margin:0; font-size:1.4rem; }
        .page-sub { margin:4px 0 0; opacity:.7; }
        .growth-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
        .growth-card { padding:16px; }
        .growth-card h2 { margin:0 0 12px; font-size:1rem; }
        .trend-bars { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
        .trend-bars li { display:grid; grid-template-columns:72px 1fr 48px; gap:8px; align-items:center; font-size:.85rem; }
        .trend-track { height:8px; background:rgba(0,0,0,.08); border-radius:999px; overflow:hidden; }
        .trend-fill { display:block; height:100%; background:#8b5a2b; border-radius:999px; min-width:2px; }
        .trend-val { text-align:right; opacity:.8; }
        .muted { opacity:.7; }
      `}</style>
    </div>
  );
}
