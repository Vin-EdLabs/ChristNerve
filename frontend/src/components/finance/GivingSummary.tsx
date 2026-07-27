import React from 'react';
import { formatGHS } from '../../utils/formatGHS';
import type { GivingSummary } from '../../types';
import { StatCard } from '../ui/StatCard';
import { Wallet, Heart, Gift, Building2, MoreHorizontal } from 'lucide-react';

export interface GivingSummaryProps {
  summary: GivingSummary | null;
  loading?: boolean;
}

export const GivingSummaryCards: React.FC<GivingSummaryProps> = ({ summary }) => {
  const total = summary?.total_this_month ?? 0;
  const tithes = summary?.tithes ?? summary?.by_type?.Tithe ?? 0;
  const offerings = summary?.offerings ?? summary?.by_type?.Offering ?? 0;
  const building =
    summary?.building_fund ?? summary?.by_type?.['Building Fund'] ?? 0;
  const other = summary?.other ?? 0;

  return (
    <div className="stats-row mb-24">
      <StatCard
        label="Total This Month"
        value={formatGHS(total)}
        icon={<Wallet size={18} />}
      />
      <StatCard label="Tithes" value={formatGHS(tithes)} icon={<Heart size={18} />} />
      <StatCard label="Offerings" value={formatGHS(offerings)} icon={<Gift size={18} />} />
      <StatCard
        label="Building Fund"
        value={formatGHS(building)}
        icon={<Building2 size={18} />}
      />
      <StatCard
        label="Other"
        value={formatGHS(other)}
        icon={<MoreHorizontal size={18} />}
      />
    </div>
  );
};

export { GivingSummaryCards as GivingSummary };
export default GivingSummaryCards;
