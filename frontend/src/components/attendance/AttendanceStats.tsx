import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { StatCard } from '../ui/StatCard';
import { TrendingUp, Trophy, CalendarCheck } from 'lucide-react';
import type { AttendanceStats, ChurchAttendance } from '../../types';

export interface AttendanceStatsProps {
  stats: AttendanceStats | null;
  recent?: ChurchAttendance[];
}

export const AttendanceStatsPanel: React.FC<AttendanceStatsProps> = ({
  stats,
  recent = [],
}) => {
  const chartData = (stats?.trend || recent)
    .slice()
    .reverse()
    .slice(-8)
    .map((row) => ({
      date: new Date(row.service_date).toLocaleDateString('en-GH', {
        month: 'short',
        day: 'numeric',
      }),
      total: row.total_count,
    }));

  const thisMonth = stats?.this_month ?? 0;
  const lastMonth = stats?.last_month ?? 0;
  const delta = thisMonth - lastMonth;
  const trendDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';

  return (
    <div>
      <div className="stats-row mb-24">
        <StatCard
          label="Avg Sunday (3 mo)"
          value={Math.round(stats?.average_sunday ?? 0)}
          icon={<CalendarCheck size={18} />}
        />
        <StatCard
          label="Highest Attendance"
          value={stats?.highest_attendance ?? 0}
          icon={<Trophy size={18} />}
          trend={
            stats?.highest_date
              ? new Date(stats.highest_date).toLocaleDateString('en-GH')
              : undefined
          }
        />
        <StatCard
          label="This Month vs Last"
          value={thisMonth}
          icon={<TrendingUp size={18} />}
          trend={
            lastMonth
              ? `${delta >= 0 ? '+' : ''}${delta} vs last month`
              : 'No prior data'
          }
          trendDirection={trendDir}
        />
      </div>

      {chartData.length > 0 && (
        <div className="card">
          <h3 className="section-title">Last 8 Services</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="total" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export { AttendanceStatsPanel as AttendanceStats };
export default AttendanceStatsPanel;
