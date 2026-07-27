import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendDirection = 'neutral',
}) => {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <div className="stat-card-value">{value}</div>
      {trend && (
        <div
          className={`stat-card-trend ${
            trendDirection === 'up' ? 'up' : trendDirection === 'down' ? 'down' : ''
          }`}
        >
          {trend}
        </div>
      )}
    </div>
  );
};

export default StatCard;
