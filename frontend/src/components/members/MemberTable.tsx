import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Eye, Users } from 'lucide-react';
import type { ChurchMember } from '../../types';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { VerifiedBadge } from './VerifiedBadge';
import { MemberCard } from './MemberCard';
import { EmptyState } from '../ui/EmptyState';

export interface MemberTableProps {
  members: ChurchMember[];
  onEdit?: (member: ChurchMember) => void;
  onAdd?: () => void;
}

const uploadsBase = import.meta.env.VITE_UPLOADS_URL || '';

export const MemberTable: React.FC<MemberTableProps> = ({ members, onEdit, onAdd }) => {
  const navigate = useNavigate();

  if (!members.length) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="No members yet"
        description="Add your first member to get started."
        actionLabel={onAdd ? 'Add Member' : undefined}
        onAction={onAdd}
      />
    );
  }

  return (
    <>
      <div className="members-desktop">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Member #</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
                const avatarSrc = m.avatar_url
                  ? m.avatar_url.startsWith('http')
                    ? m.avatar_url
                    : `${uploadsBase}${m.avatar_url}`
                  : undefined;

                return (
                  <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)}>
                    <td>
                      <div className="table-avatar-cell">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" className="avatar avatar-sm" />
                        ) : (
                          <div className="avatar avatar-sm">{initials}</div>
                        )}
                        <span>
                          {m.first_name} {m.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="mono">{m.member_number || '—'}</td>
                    <td>{m.phone || '—'}</td>
                    <td>{m.department || '—'}</td>
                    <td>
                      <Badge variant={statusToBadgeVariant(m.membership_status)}>
                        {m.membership_status}
                      </Badge>
                    </td>
                    <td>{m.is_verified ? <VerifiedBadge /> : '—'}</td>
                    <td>
                      <div className="flex gap-8" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          aria-label="View"
                          onClick={() => navigate(`/members/${m.id}`)}
                        >
                          <Eye size={16} />
                        </button>
                        {onEdit && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            aria-label="Edit"
                            onClick={() => onEdit(m)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="members-mobile">
        <div className="member-cards">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      </div>
    </>
  );
};

export default MemberTable;
