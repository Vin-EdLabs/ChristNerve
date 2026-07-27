import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { AttendanceStats as AttendanceStatsType, ChurchAttendance } from '../../types';
import { Button } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { AttendanceForm } from '../../components/attendance/AttendanceForm';
import type { AttendanceFormValues } from '../../components/attendance/AttendanceForm';
import { AttendanceStats } from '../../components/attendance/AttendanceStats';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function mapStats(raw: Record<string, unknown> | null): AttendanceStatsType | null {
  if (!raw) return null;
  const best = raw.best_service as ChurchAttendance | undefined;
  const recent = (raw.recent_sundays as ChurchAttendance[]) || [];
  return {
    average_sunday: Number(
      raw.average_last_3_months ?? raw.average_sunday ?? 0
    ),
    highest_attendance: Number(
      best?.total_count ?? raw.highest_attendance ?? 0
    ),
    highest_date: best?.service_date ?? (raw.highest_date as string) ?? null,
    this_month: Number(raw.this_month_average ?? raw.this_month ?? 0),
    last_month: Number(raw.last_month_average ?? raw.last_month ?? 0),
    trend: recent,
  };
}

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ChurchAttendance[]>([]);
  const [stats, setStats] = useState<AttendanceStatsType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/attendance'),
        api.get('/attendance/stats'),
      ]);
      setRecords(asList<ChurchAttendance>(listRes.data));
      setStats(mapStats(statsRes.data));
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (
    data: AttendanceFormValues & { total_count: number }
  ) => {
    setSaving(true);
    try {
      await api.post('/attendance', {
        service_type: data.service_type,
        service_date: data.service_date,
        men_count: Number(data.men_count || 0),
        women_count: Number(data.women_count || 0),
        children_count: Number(data.children_count || 0),
        visitors_count: Number(data.visitors_count || 0),
        total_count: data.total_count,
        notes: data.notes || undefined,
      });
      toast.success('Service attendance recorded');
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not record attendance';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="att-page">
        <div className="att-stats-skel">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="att-page">
      <div className="att-toolbar">
        <h2 className="page-heading">Service Attendance</h2>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Record Service
        </Button>
      </div>

      <AttendanceStats stats={stats} recent={stats?.trend} />

      <section className="card">
        <h3 className="chart-title">History</h3>
        {records.length === 0 ? (
          <EmptyState
            title="No attendance records yet."
            description="Record your first Sunday service to start tracking growth."
            actionLabel="Record Service"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service Type</th>
                  <th>Total</th>
                  <th>Men</th>
                  <th>Women</th>
                  <th>Children</th>
                  <th>Visitors</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.service_date
                        ? new Date(r.service_date).toLocaleDateString('en-GH')
                        : '—'}
                    </td>
                    <td>{r.service_type}</td>
                    <td><strong>{r.total_count}</strong></td>
                    <td>{r.men_count}</td>
                    <td>{r.women_count}</td>
                    <td>{r.children_count}</td>
                    <td>{r.visitors_count}</td>
                    <td>
                      {r.recorded_by_name ||
                        [
                          (r as ChurchAttendance & { recorded_by_first_name?: string })
                            .recorded_by_first_name,
                          (r as ChurchAttendance & { recorded_by_last_name?: string })
                            .recorded_by_last_name,
                        ]
                          .filter(Boolean)
                          .join(' ') ||
                        '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AttendanceForm
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        onSubmit={handleSubmit}
        loading={saving}
      />

      <style>{`
        .att-page { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
        .att-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .chart-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .att-stats-skel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .table-wrap { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .data-table th, .data-table td {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid var(--border, #e8e4dc);
          white-space: nowrap;
        }
        .data-table th {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        @media (max-width: 768px) {
          .att-stats-skel { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
