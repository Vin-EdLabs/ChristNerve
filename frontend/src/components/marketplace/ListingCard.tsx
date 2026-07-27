import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { MarketListing } from '../../types';
import { formatPriceRange } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useCart } from '../../contexts/CartContext';
import { VerifiedBadge } from '../members/VerifiedBadge';

export interface ListingCardProps {
  listing: MarketListing;
  onClick?: () => void;
}

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80';

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onClick }) => {
  const navigate = useNavigate();
  const { addToBag } = useCart();
  const price = formatPriceRange(
    listing.price_min,
    listing.price_max,
    listing.price_label
  );
  const image = resolveMediaUrl(
    listing.primary_image || listing.images?.[0]?.image_url,
    PLACEHOLDER
  );

  const goDetail = () => {
    if (onClick) onClick();
    else navigate(`/market/listing/${listing.slug}`);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToBag({
      ...listing,
      id: Number(listing.id),
      member_id:
        listing.member_id != null ? Number(listing.member_id) : listing.member_id,
    });
  };

  return (
    <article
      className="listing-card"
      onClick={goDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goDetail();
      }}
    >
      <div className="listing-card-media">
        <img src={image} alt={listing.title} loading="lazy" />
        {listing.is_verified && (
          <div className="listing-card-verified">
            <VerifiedBadge />
          </div>
        )}
        <span className="listing-card-fav" aria-hidden>
          <Heart size={14} />
        </span>
      </div>

      <div className="listing-card-body">
        <div className="listing-card-category">
          {listing.category_name || 'Marketplace'}
        </div>
        <h3 className="listing-card-title">{listing.title}</h3>
        <div className="listing-card-price">{price}</div>
        <button
          type="button"
          className="listing-quick-add"
          onClick={handleAdd}
        >
          Quick add +
        </button>
      </div>
    </article>
  );
};

export default ListingCard;
