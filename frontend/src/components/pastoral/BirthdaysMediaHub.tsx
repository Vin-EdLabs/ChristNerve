import { useEffect, useMemo, useState } from 'react';
import { Search, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SkeletonCard } from '../ui/SkeletonCard';
import { EmptyState } from '../ui/EmptyState';

export interface BirthdayMember {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department?: string | null;
  cell_group?: string | null;
  date_of_birth?: string | null;
  dob_formatted: string;
  days_until: number;
  turning_age?: number | null;
  is_today: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthOf(member: BirthdayMember): string {
  if (!member.date_of_birth) return '';
  const d = new Date(member.date_of_birth);
  return MONTH_NAMES[d.getUTCMonth()];
}

function dayOf(member: BirthdayMember): number {
  if (!member.date_of_birth) return 0;
  return new Date(member.date_of_birth).getUTCDate();
}

interface DayGroup {
  day: number;
  members: BirthdayMember[];
}

export function BirthdaysSection() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // A full year ahead so every month with an upcoming birthday gets its own group,
        // not just the next couple of weeks.
        const res = await api.get('/church-life/birthdays?days=365');
        if (cancelled) return;
        const data = res.data || {};
        setMembers([...(data.today || []), ...(data.upcoming || [])]);
      } catch (err) {
        console.error('Failed to load birthdays:', err);
        toast.error('Could not load birthdays');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  const filtered = members.filter(
    (m) =>
      monthOf(m) === currentMonth &&
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Members already arrive sorted chronologically (soonest first), so grouping
  // consecutive same-day entries keeps that order intact and naturally clusters
  // everyone who shares a birth date.
  const groups = useMemo(() => {
    const days: DayGroup[] = [];
    for (const member of filtered) {
      const day = dayOf(member);
      let dg = days[days.length - 1];
      if (!dg || dg.day !== day) {
        dg = { day, members: [] };
        days.push(dg);
      }
      dg.members.push(member);
    }
    return days;
  }, [filtered]);

  return (
    <div className="bday-container">
      <div className="bday-header">
        <h2 className="bday-title">Birthdays in {currentMonth}</h2>
        <div className="bday-search-box">
          <Search size={15} className="bday-search-icon" />
          <input
            type="text"
            placeholder="Search member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bday-search-input"
          />
        </div>
      </div>

      {loading && (
        <div className="bday-loading">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && groups.length === 0 && (
        <EmptyState
          icon={<Gift size={22} style={{ color: 'var(--accent)' }} />}
          title="No birthdays this month"
          description={`No members have a birthday in ${currentMonth} on record.`}
        />
      )}

      {!loading && groups.length > 0 && (
        <div className="bday-month-list">
          {groups.map((dg) => (
            <DayGroupRow key={dg.day} group={dg} />
          ))}
        </div>
      )}

      <style>{`
        .bday-container { display: flex; flex-direction: column; gap: 20px; }
        .bday-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
        }
        .bday-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--text-primary); }
        .bday-search-box {
          position: relative; display: flex; align-items: center;
          min-width: 220px;
        }
        .bday-search-icon { position: absolute; left: 10px; color: var(--text-muted); }
        .bday-search-input {
          width: 100%; padding: 8px 12px 8px 32px; border-radius: var(--radius-md);
          border: 1px solid var(--border); background: var(--bg-primary);
          color: var(--text-primary); font-size: 13px;
        }
        .bday-loading { display: flex; flex-direction: column; gap: 10px; }
        .bday-month-list {
          display: flex; flex-direction: column; border: 1px solid var(--border);
          border-radius: var(--radius-md); overflow: hidden; background: var(--bg-primary);
        }
        .bday-day-row {
          display: flex; align-items: flex-start; gap: 14px; padding: 12px 14px;
        }
        .bday-day-row + .bday-day-row { border-top: 1px solid var(--border); }

        .bday-date-badge {
          width: 44px; height: 44px; border-radius: var(--radius-md); flex-shrink: 0;
          display: grid; place-items: center; background: var(--bg-secondary);
          border: 1px solid var(--border);
        }
        .bday-date-badge.is-today { background: var(--accent-light); border-color: var(--accent); }
        .bday-date-day { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .bday-date-badge.is-today .bday-date-day { color: var(--accent); }

        .bday-day-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .bday-day-heading { display: flex; align-items: center; gap: 8px; }
        .bday-day-when { font-size: 12px; font-weight: 600; color: var(--text-muted); }
        .bday-day-count {
          font-size: 11px; font-weight: 700; color: var(--accent);
          background: var(--accent-light); padding: 2px 8px; border-radius: 999px;
        }

        .bday-day-members { display: flex; flex-direction: column; gap: 8px; }
        .bday-name-row { display: flex; align-items: center; gap: 10px; }
        .bday-row-avatar, .bday-row-avatar-placeholder {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          object-fit: cover;
        }
        .bday-row-avatar-placeholder {
          display: grid; place-items: center; background: var(--accent-light);
          color: var(--accent); font-size: 12px; font-weight: 700;
        }
        .bday-row-name {
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bday-row-dept {
          font-size: 11px; color: var(--text-muted); padding: 1px 8px;
          border: 1px solid var(--border); border-radius: 999px; flex-shrink: 0;
        }
        .bday-row-age { font-size: 12px; color: var(--text-muted); margin-left: auto; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

function DayGroupRow({ group }: { group: DayGroup }) {
  const first = group.members[0];
  const count = group.members.length;

  return (
    <div className="bday-day-row">
      <div className={`bday-date-badge${first.is_today ? ' is-today' : ''}`}>
        <span className="bday-date-day">{group.day}</span>
      </div>

      <div className="bday-day-body">
        <div className="bday-day-heading">
          <span className="bday-day-when">
            {first.is_today ? 'Today' : `In ${first.days_until} day${first.days_until === 1 ? '' : 's'}`}
          </span>
          {count > 1 && <span className="bday-day-count">{count} people</span>}
        </div>
        <div className="bday-day-members">
          {group.members.map((member) => (
            <BirthdayName key={member.id} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BirthdayName({ member }: { member: BirthdayMember }) {
  const initials = `${member.first_name[0] || ''}${member.last_name[0] || ''}`.toUpperCase();

  return (
    <div className="bday-name-row">
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={`${member.first_name} ${member.last_name}`} className="bday-row-avatar" />
      ) : (
        <div className="bday-row-avatar-placeholder">{initials}</div>
      )}
      <span className="bday-row-name">
        {member.first_name} {member.last_name}
      </span>
      {member.department && <span className="bday-row-dept">{member.department}</span>}
      {member.turning_age ? <span className="bday-row-age">Turning {member.turning_age}</span> : null}
    </div>
  );
}

export default BirthdaysSection;
