import React from 'react';
import type { MarketListing } from '../../types';
import { ListingCard } from './ListingCard';
import { EmptyState } from '../ui/EmptyState';
import { Store } from 'lucide-react';
import { SkeletonCard } from '../ui/SkeletonCard';

export interface ListingGridProps {
  listings: MarketListing[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
}

export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  loading = false,
  emptyTitle = 'No listings yet',
  emptyDescription = 'Encourage members to share their businesses.',
  onEmptyAction,
  emptyActionLabel,
}) => {
  if (loading) {
    return <SkeletonCard variant="listing" count={8} />;
  }

  if (!listings.length) {
    return (
      <EmptyState
        icon={<Store size={24} />}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="listing-grid">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
};

export default ListingGrid;
