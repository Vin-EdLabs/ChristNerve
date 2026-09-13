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
  /** Overrides the default `/market/listing/:slug` navigation for every card —
   *  used by storefront-scoped views so a click never leaves that seller's shop. */
  onListingClick?: (listing: MarketListing) => void;
}

export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  loading = false,
  emptyTitle = 'No listings yet',
  emptyDescription = 'Encourage members to share their businesses.',
  onEmptyAction,
  emptyActionLabel,
  onListingClick,
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
        <ListingCard
          key={listing.id}
          listing={listing}
          onClick={onListingClick ? () => onListingClick(listing) : undefined}
        />
      ))}
    </div>
  );
};

export default ListingGrid;
