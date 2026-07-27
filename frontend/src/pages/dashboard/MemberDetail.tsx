import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import type { ChurchMember, ChurchGiving, MarketListing } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge, statusToBadgeVariant } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { VerifiedBadge } from '../../components/members/VerifiedBadge';
import { MemberForm } from '../../components/members/MemberForm';
import type { MemberFormValues } from '../../components/members/MemberForm';
import { ListingCard } from '../../components/marketplace/ListingCard';

type TabKey =
  | 'profile'
  | 'attendance'
  | 'giving'
  | 'prayer'
  | 'cell'
  | 'marketplace';

type AttendanceRow = {
  id: number;
  service_type?: string;
  service_date?: string;
  present?: boolean;
};

type PrayerRow = {
  id: number;
  request: string;
  status: string;
  is_anonymous?: boolean;
  created_at?: string;
};

type CellGroupRow = {
  id: number;
  name: string;
  meeting_day?: string;
  meeting_time?: string;
  location?: string;
};

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<ChurchMember | null>(null);
  const [tab, setTab] = useState<TabKey>('profile');
  const [giving, setGiving] = useState<ChurchGiving[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attStats, setAttStats] = useState({
    percentage: 0,
    streak: 0,
    present: 0,
    total: 0,
  });
  const [prayers, setPrayers] = useState<PrayerRow[]>([]);
  const [cellGroups, setCellGroups] = useState<CellGroupRow[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  const loadMember = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/members/${id}`);
      setMember(res.data?.data ?? res.data?.member ?? res.data);
    } catch {
      toast.error('Member not found');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  useEffect(() => {
    if (!id || !member) return;
    let cancelled = false;
    (async () => {
      setTabLoading(true);
      try {
        if (tab === 'giving') {
          const res = await api.get('/finance/giving', {
            params: { member_id: id, limit: 100 },
          });
          const rows = res.data?.data ?? res.data?.giving ?? res.data ?? [];
          if (!cancelled) setGiving(Array.isArray(rows) ? rows : []);
        } else if (tab === 'attendance') {
          const res = await api.get(`/attendance/member/${id}`);
          if (!cancelled) {
            setAttendance(asList<AttendanceRow>(res.data));
            setAttStats({
              percentage: Number(res.data?.stats?.percentage || 0),
              streak: Number(res.data?.stats?.streak || 0),
              present: Number(res.data?.stats?.present || 0),
              total: Number(res.data?.stats?.total || 0),
            });
          }
        } else if (tab === 'prayer') {
          const res = await api.get(`/pastoral/members/${id}/prayer-requests`);
          if (!cancelled) setPrayers(asList<PrayerRow>(res.data));
        } else if (tab === 'cell') {
          const res = await api.get(`/pastoral/members/${id}/cell-groups`);
          if (!cancelled) setCellGroups(asList<CellGroupRow>(res.data));
        } else if (tab === 'marketplace') {
          const slug = member.marketplace_slug;
          if (slug) {
            const res = await api.get(`/market/storefront/${slug}`);
            if (!cancelled) {
              setListings(res.data?.listings ?? res.data?.data ?? []);
            }
          } else {
            setListings([]);
          }
        }
      } catch {
        if (!cancelled) toast.error('Failed to load tab data');
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id, member]);

  const handleVerify = async () => {
    if (!member) return;
    try {
      await api.post(`/members/${member.id}/verify`);
      toast.success('Member verified');
      await loadMember();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not verify member';
      toast.error(msg);
    }
  };

  const handleDeactivate = async () => {
    if (!member) return;
    try {
      await api.put(`/members/${member.id}`, { membership_status: 'inactive' });
      toast.success('Member deactivated');
      await loadMember();
    } catch {
      toast.error('Could not deactivate member');
    }
  };

  const handleSave = async (data: MemberFormValues, avatarFile?: File | null) => {
    if (!member) return;
    setSaving(true);
    try {
      const { avatar_url: _a, ...rest } = data;
      await api.put(`/members/${member.id}`, rest);
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        await api.post(`/members/${member.id}/avatar`, fd);
      }
      toast.success('Member updated successfully');
      setEditOpen(false);
      await loadMember();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not update member';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const yearGiving = useMemo(() => {
    const year = new Date().getFullYear();
    return giving.filter((g) => {
      if (!g.service_date) return false;
      return new Date(g.service_date).getFullYear() === year;
    });
  }, [giving]);

  const givingTotal = yearGiving.reduce((sum, g) => sum + Number(g.amount || 0), 0);

  const givingByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of yearGiving) {
      if (!g.service_date) continue;
      const d = new Date(g.service_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + Number(g.amount || 0));
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [yearGiving]);

  const givingByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of yearGiving) {
      const t = g.giving_type || 'Other';
      map.set(t, (map.get(t) || 0) + Number(g.amount || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [yearGiving]);

  if (loading) {
    return (
      <div className="member-detail">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!member) return null;

  const fullName = `${member.first_name} ${member.last_name}`.trim();
  const since = member.membership_date
    ? new Date(member.membership_date).toLocaleDateString('en-GH', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const profileFields: [string, string | undefined | null][] = [
    ['Member Number', member.member_number],
    ['Email', member.email],
    ['Phone', member.phone],
    ['WhatsApp', member.whatsapp],
    ['Gender', member.gender],
    [
      'Date of Birth',
      member.date_of_birth
        ? new Date(member.date_of_birth).toLocaleDateString('en-GH')
        : null,
    ],
    ['Marital Status', member.marital_status],
    ['Occupation', member.occupation],
    ['Address', member.address],
    ['City', member.city],
    ['Department', member.department],
    ['Ministry', member.ministry],
    ['Cell Group', member.cell_group],
    ['Status', member.membership_status],
    [
      'Baptism Date',
      member.baptism_date
        ? new Date(member.baptism_date).toLocaleDateString('en-GH')
        : null,
    ],
  ];

  const tabs: [TabKey, string][] = [
    ['profile', 'Profile'],
    ['attendance', 'Attendance'],
    ['giving', 'Giving'],
    ['prayer', 'Prayer'],
    ['cell', 'Cell Group'],
    ['marketplace', 'Marketplace'],
  ];

  return (
    <div className="member-detail">
      <header className="card member-header">
        <div className="member-header-main">
          {member.avatar_url ? (
            <img
              src={resolveMediaUrl(member.avatar_url)}
              alt={fullName}
              className="member-avatar"
            />
          ) : (
            <div className="member-avatar member-avatar--fallback">
              {member.first_name?.[0]}
              {member.last_name?.[0]}
            </div>
          )}
          <div>
            <div className="member-name-row">
              <h1>{fullName}</h1>
              {member.is_verified && <VerifiedBadge />}
            </div>
            <p className="member-meta">{member.member_number}</p>
            {member.department && (
              <p className="member-meta">{member.department} Department</p>
            )}
            {since && <p className="member-meta">Member since {since}</p>}
            {member.phone && (
              <p className="member-phone">
                <Phone size={14} /> {member.phone}
              </p>
            )}
            <div className="member-status">
              <Badge variant={statusToBadgeVariant(member.membership_status)}>
                {member.membership_status || 'active'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="member-actions">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          {!member.is_verified && (
            <Button variant="primary" onClick={handleVerify}>
              <ShieldCheck size={16} />
              Verify
            </Button>
          )}
          {member.membership_status !== 'inactive' && (
            <Button variant="ghost" onClick={handleDeactivate}>
              Deactivate
            </Button>
          )}
        </div>
      </header>

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab${tab === key ? ' tab--active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="card">
        {tabLoading ? (
          <SkeletonCard />
        ) : tab === 'profile' ? (
          <dl className="profile-grid">
            {profileFields.map(([label, value]) => (
              <div key={label} className="profile-item">
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : tab === 'attendance' ? (
          attendance.length === 0 ? (
            <EmptyState title="No attendance history yet." />
          ) : (
            <div className="att-panel">
              <div className="att-summary">
                <div>
                  <span className="att-label">Attendance</span>
                  <strong>{attStats.percentage}%</strong>
                  <small>
                    {attStats.present} of last {attStats.total} services
                  </small>
                </div>
                {attStats.streak > 0 && (
                  <p className="att-streak">
                    Present {attStats.streak}{' '}
                    {attStats.streak === 1 ? 'service' : 'services'} in a row
                  </p>
                )}
              </div>
              <div className="att-dots" aria-label="Last 8 services">
                {attendance.map((a) => (
                  <div key={a.id} className="att-dot-wrap" title={a.service_type || 'Service'}>
                    <span
                      className={`att-dot${a.present ? ' att-dot--present' : ' att-dot--absent'}`}
                    />
                    <small>
                      {a.service_date
                        ? new Date(a.service_date).toLocaleDateString('en-GH', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : tab === 'giving' ? (
          yearGiving.length === 0 ? (
            <EmptyState title="No giving records for this member." />
          ) : (
            <>
              <p className="giving-total">
                Total this year:{' '}
                <strong className="mono">{formatGHS(givingTotal)}</strong>
              </p>
              {givingByType.length > 0 && (
                <div className="giving-bars">
                  {givingByType.map(([type, amount]) => {
                    const pct = givingTotal
                      ? Math.round((amount / givingTotal) * 100)
                      : 0;
                    return (
                      <div key={type} className="giving-bar-row">
                        <div className="giving-bar-meta">
                          <span>{type}</span>
                          <strong className="mono">{formatGHS(amount)}</strong>
                        </div>
                        <div className="giving-bar-track">
                          <div
                            className="giving-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {givingByMonth.length > 0 && (
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {givingByMonth.map(([month, amount]) => (
                        <tr key={month}>
                          <td>{month}</td>
                          <td className="mono">{formatGHS(amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        ) : tab === 'prayer' ? (
          prayers.length === 0 ? (
            <EmptyState title="No prayer requests for this member." />
          ) : (
            <ul className="prayer-list">
              {prayers.map((p) => (
                <li key={p.id}>
                  <div className="prayer-list-top">
                    <Badge variant={statusToBadgeVariant(p.status)}>
                      {p.status}
                    </Badge>
                    <span>
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString('en-GH')
                        : '—'}
                    </span>
                  </div>
                  <p>{p.request}</p>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'cell' ? (
          cellGroups.length === 0 && !member.cell_group ? (
            <EmptyState title="Not linked to a cell group yet." />
          ) : (
            <ul className="cell-list">
              {cellGroups.length === 0 && member.cell_group && (
                <li>
                  <strong>{member.cell_group}</strong>
                  <span>From member profile</span>
                </li>
              )}
              {cellGroups.map((g) => (
                <li key={g.id}>
                  <strong>{g.name}</strong>
                  <span>
                    {[g.meeting_day, g.meeting_time, g.location]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : listings.length === 0 ? (
          <EmptyState title="No marketplace listings yet." />
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <MemberForm
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        member={member}
        onSubmit={handleSave}
        loading={saving}
      />

      <style>{`
        .member-detail { display: flex; flex-direction: column; gap: 20px; }
        .member-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .member-header-main { display: flex; gap: 20px; }
        .member-avatar {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 0 0 3px rgba(45, 27, 105, 0.12);
          flex-shrink: 0;
        }
        .member-avatar--fallback {
          display: grid;
          place-items: center;
          background: var(--accent-light, #ede8fa);
          color: var(--accent, #2d1b69);
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .member-name-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .member-name-row h1 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 32px;
          font-weight: 600;
        }
        .member-meta {
          font-size: 14px;
          color: var(--text-secondary, #6b6560);
          margin-top: 4px;
        }
        .member-phone {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 14px;
        }
        .member-status { margin-top: 10px; }
        .member-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start; }
        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border, #e8e4dc);
          overflow-x: auto;
        }
        .tab {
          background: none;
          border: none;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary, #6b6560);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }
        .tab--active {
          color: var(--accent, #2d1b69);
          border-bottom-color: var(--accent, #2d1b69);
        }
        .profile-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px 24px;
        }
        .profile-item dt {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted, #9e9893);
          margin-bottom: 4px;
        }
        .profile-item dd { font-size: 15px; }
        .giving-total { margin-bottom: 16px; font-size: 14px; }
        .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
        .table-wrap { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .data-table th, .data-table td {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid var(--border, #e8e4dc);
        }
        .data-table th {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        .att-summary {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .att-label {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .att-summary strong {
          display: block;
          font-size: 28px;
          font-family: var(--font-mono);
          margin-top: 4px;
        }
        .att-summary small { color: var(--text-secondary); font-size: 13px; }
        .att-streak {
          align-self: flex-end;
          font-size: 14px;
          color: var(--accent);
          font-weight: 500;
          margin: 0;
        }
        .att-dots {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .att-dot-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-width: 44px;
        }
        .att-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--border);
        }
        .att-dot--present { background: var(--accent); }
        .att-dot--absent { background: var(--border); opacity: 0.7; }
        .att-dot-wrap small {
          font-size: 11px;
          color: var(--text-muted);
        }
        .giving-bars { display: flex; flex-direction: column; gap: 10px; }
        .giving-bar-meta {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }
        .giving-bar-track {
          height: 8px;
          border-radius: 999px;
          background: var(--accent-light, #ede8fa);
          overflow: hidden;
        }
        .giving-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 999px;
        }
        .prayer-list, .cell-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prayer-list li, .cell-list li {
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }
        .prayer-list-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .cell-list strong { display: block; font-size: 15px; }
        .cell-list span { font-size: 13px; color: var(--text-secondary); }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        @media (max-width: 640px) {
          .profile-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
