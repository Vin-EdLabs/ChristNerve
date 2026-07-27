import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Users } from 'lucide-react';
import type { ChurchMember } from '../../types';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export interface MemberTableProps {
  members: ChurchMember[];
  onEdit?: (member: ChurchMember) => void;
  onAdd?: () => void;
}

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
        <div className="members-table-wrap">
          <table className="members-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Member #</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const initials =
                  `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
                const avatarSrc = resolveMediaUrl(m.avatar_url);

                return (
                  <tr key={m.id} onClick={() => navigate(`/members/${m.id}`)}>
                    <td>
                      <div className="members-name-cell">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" className="avatar" />
                        ) : (
                          <div className="avatar">{initials}</div>
                        )}
                        <strong>
                          {m.first_name} {m.last_name}
                        </strong>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.member_number || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {m.phone || '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {m.department || '—'}
                    </td>
                    <td>
                      <Badge variant={statusToBadgeVariant(m.membership_status)}>
                        {m.membership_status}
                      </Badge>
                    </td>
                    <td>
                      {onEdit && (
                        <button
                          type="button"
                          className="row-action"
                          aria-label="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(m);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="members-mobile-list">
        {members.map((m) => {
          const initials =
            `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
          const avatarSrc = resolveMediaUrl(m.avatar_url);
          return (
            <button
              key={m.id}
              type="button"
              className="members-mobile-row"
              onClick={() => navigate(`/members/${m.id}`)}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="avatar" />
              ) : (
                <div className="avatar">{initials}</div>
              )}
              <div className="members-mobile-mid">
                <strong>
                  {m.first_name} {m.last_name}
                </strong>
                <span>
                  {m.member_number || '—'}
                  {m.department ? ` · ${m.department}` : ''}
                </span>
              </div>
              <Badge variant={statusToBadgeVariant(m.membership_status)}>
                {m.membership_status}
              </Badge>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default MemberTable;
