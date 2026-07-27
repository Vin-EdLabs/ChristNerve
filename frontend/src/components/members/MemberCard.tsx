import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChurchMember } from '../../types';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { VerifiedBadge } from './VerifiedBadge';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export interface MemberCardProps {
  member: ChurchMember;
  onClick?: () => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, onClick }) => {
  const navigate = useNavigate();
  const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase();
  const avatarSrc = resolveMediaUrl(member.avatar_url);

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/members/${member.id}`);
  };

  return (
    <div className="member-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}>
      {avatarSrc ? (
        <img src={avatarSrc} alt="" className="avatar" />
      ) : (
        <div className="avatar">{initials}</div>
      )}
      <div className="member-card-body">
        <div className="member-card-name">
          {member.first_name} {member.last_name}
        </div>
        <div className="member-card-meta">
          {member.member_number || '—'}
          {member.phone ? ` · ${member.phone}` : ''}
        </div>
        <div className="member-card-badges">
          <Badge variant={statusToBadgeVariant(member.membership_status)}>
            {member.membership_status}
          </Badge>
          {member.is_verified && <VerifiedBadge />}
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
