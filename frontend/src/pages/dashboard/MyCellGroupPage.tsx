import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UsersRound, Calendar, MapPin, Crown } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useCachedQuery } from '../../utils/useCachedQuery';

type RosterMember = {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  member_number?: string;
};

type CellGroupInfo = {
  id: number;
  name?: string;
  leader_first_name?: string;
  leader_last_name?: string;
  meeting_day?: string | null;
  meeting_time?: string | null;
  location?: string | null;
  member_count?: number | null;
  is_leader?: boolean;
  members?: RosterMember[];
};

export default function MyCellGroupPage() {
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: groups = [], loading } = useCachedQuery<CellGroupInfo[]>(
    'my-cell-group',
    async () => {
      try {
        const res = await api.get('/pastoral/cell-groups/mine');
        return Array.isArray(res.data?.cell_groups)
          ? res.data.cell_groups
          : res.data?.cell_group
            ? [res.data.cell_group]
            : [];
      } catch {
        return [];
      }
    }
  );

  useEffect(() => {
    setActiveId((prev) => (prev && groups.some((g) => g.id === prev) ? prev : groups[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  if (loading) return <Spinner fullPage />;

  const group = groups.find((g) => g.id === activeId) || null;
  const leader = group
    ? `${group.leader_first_name || ''} ${group.leader_last_name || ''}`.trim()
    : '';

  return (
    <div className="member-page cg-hub">
      <div className="page-head">
        <p className="member-home-kicker">Church life</p>
        <h1 className="page-title">My cell group</h1>
        <p className="page-sub">See your group, meeting details, and who else is in it.</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound size={22} />}
          title="No cell group assigned"
          description="Ask your church admin to add you to a cell group."
        />
      ) : (
        <>
          {groups.length > 1 && (
            <div className="cg-tabs">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`cg-tab${g.id === activeId ? ' is-active' : ''}`}
                  onClick={() => setActiveId(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {group && (
            <>
              <article className="glass-card member-dept-card">
                <div className="member-home-card-head">
                  <UsersRound size={20} />
                  <h2>{group.name}</h2>
                </div>
                {leader && <p className="member-home-meta">Leader: {leader}</p>}
                {(group.meeting_day || group.meeting_time) && (
                  <p className="member-home-meta">
                    <Calendar size={14} />{' '}
                    {[group.meeting_day, group.meeting_time].filter(Boolean).join(' · ')}
                  </p>
                )}
                {group.location && (
                  <p className="member-home-meta">
                    <MapPin size={14} /> {group.location}
                  </p>
                )}
                {group.member_count != null && (
                  <p className="member-home-meta">
                    <Users size={14} /> {group.member_count} members
                  </p>
                )}
                {group.is_leader && (
                  <p className="member-home-meta">You lead this cell group</p>
                )}
              </article>

              <section className="cg-section">
                <h3>
                  <Users size={18} /> Group members
                </h3>
                <div className="cg-roster">
                  {(group.members || []).map((m) => {
                    const initials =
                      `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase();
                    const img = resolveMediaUrl(m.avatar_url);
                    const isLeader = leader === `${m.first_name} ${m.last_name}`.trim();
                    return (
                      <article key={m.id} className="cg-roster-card">
                        {img ? (
                          <img src={img} alt="" />
                        ) : (
                          <span className="cg-roster-fallback">{initials}</span>
                        )}
                        <div>
                          <strong>
                            {m.first_name} {m.last_name}
                            {isLeader && <Crown size={13} className="cg-crown" />}
                          </strong>
                          <span>{user?.id === m.id ? 'You' : isLeader ? 'Leader' : 'Member'}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <Link to="/" className="member-home-link" style={{ marginTop: 16 }}>
        ← Back home
      </Link>

      <style>{`
        .cg-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .cg-tab {
          border: 1px solid var(--border, #e8e4dc); background: #fff;
          border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .cg-tab.is-active { background: var(--accent, #2d1b69); color: #fff; border-color: transparent; }
        .cg-section { margin-top: 24px; }
        .cg-section h3 { display: flex; align-items: center; gap: 8px; font-size: 17px; margin-bottom: 12px; }
        .cg-roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
        .cg-roster-card {
          display: flex; align-items: center; gap: 10px;
          background: #fff; border: 1px solid var(--border, #e8e4dc);
          border-radius: 14px; padding: 10px 12px;
        }
        .cg-roster-card img, .cg-roster-fallback {
          width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
          background: #efeaf6; display: grid; place-items: center; font-weight: 700; font-size: 13px;
          flex-shrink: 0;
        }
        .cg-roster-card strong { display: flex; align-items: center; gap: 4px; font-size: 14px; }
        .cg-roster-card span { font-size: 12px; color: #9e9893; }
        .cg-crown { color: #e8b93d; flex-shrink: 0; }
        @media (max-width: 480px) {
          .cg-roster { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
