import React from 'react';

export interface SkeletonCardProps {
  variant?: 'listing' | 'stat' | 'row' | 'member';
  count?: number;
}

const ListingSkeleton: React.FC = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-img mb-16" />
    <div className="skeleton skeleton-line w-30" />
    <div className="skeleton skeleton-line w-80" />
    <div className="skeleton skeleton-line w-40" />
  </div>
);

const StatSkeleton: React.FC = () => (
  <div className="stat-card">
    <div className="skeleton skeleton-line w-40" style={{ height: 12 }} />
    <div className="skeleton skeleton-line w-60" style={{ height: 36, marginTop: 12 }} />
    <div className="skeleton skeleton-line w-30" style={{ height: 12 }} />
  </div>
);

const RowSkeleton: React.FC = () => (
  <div className="card" style={{ padding: '14px 16px', marginBottom: 8 }}>
    <div className="skeleton skeleton-line w-80" />
    <div className="skeleton skeleton-line w-40" />
  </div>
);

const MemberSkeleton: React.FC = () => (
  <div className="member-card">
    <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
    <div style={{ flex: 1 }}>
      <div className="skeleton skeleton-line w-60" />
      <div className="skeleton skeleton-line w-40" />
    </div>
  </div>
);

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'listing',
  count = 1,
}) => {
  const Item =
    variant === 'stat'
      ? StatSkeleton
      : variant === 'row'
        ? RowSkeleton
        : variant === 'member'
          ? MemberSkeleton
          : ListingSkeleton;

  if (variant === 'listing' && count > 1) {
    return (
      <div className="listing-grid">
        {Array.from({ length: count }).map((_, i) => (
          <Item key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'stat' && count > 1) {
    return (
      <div className="stats-row">
        {Array.from({ length: count }).map((_, i) => (
          <Item key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </>
  );
};

export default SkeletonCard;
