import React from 'react';
import { Link } from 'react-router-dom';
import type { ChurchMember, ChurchTenant } from '../../types';
import { VerifiedBadge } from '../members/VerifiedBadge';

export interface SellerCardProps {
  member: Pick<
    ChurchMember,
    'id' | 'first_name' | 'last_name' | 'avatar_url' | 'is_verified' | 'marketplace_slug' | 'membership_date' | 'city'
  >;
  church?: Pick<ChurchTenant, 'name' | 'slug'> | null;
  showLink?: boolean;
}

const uploadsBase = import.meta.env.VITE_UPLOADS_URL || '';

export const SellerCard: React.FC<SellerCardProps> = ({
  member,
  church,
  showLink = true,
}) => {
  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase();
  const avatarSrc = member.avatar_url
    ? member.avatar_url.startsWith('http')
      ? member.avatar_url
      : `${uploadsBase}${member.avatar_url}`
    : undefined;
  const year = member.membership_date
    ? new Date(member.membership_date).getFullYear()
    : null;

  const content = (
    <div className="seller-card">
      {avatarSrc ? (
        <img src={avatarSrc} alt="" className="avatar" />
      ) : (
        <div className="avatar">{initials}</div>
      )}
      <div>
        <div className="seller-card-name">
          {member.first_name} {member.last_name}
        </div>
        <div className="seller-card-meta">
          {member.is_verified && <VerifiedBadge label="Verified Member" />}
          {church?.name && <span>— {church.name}</span>}
          {year && <span>Member since {year}</span>}
        </div>
      </div>
    </div>
  );

  if (showLink && member.marketplace_slug) {
    return (
      <Link to={`/shop/${member.marketplace_slug}`} style={{ display: 'block' }}>
        {content}
      </Link>
    );
  }

  return content;
};

export default SellerCard;
