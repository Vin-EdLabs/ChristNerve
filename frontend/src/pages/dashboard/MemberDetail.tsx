import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import type { ChurchMember, ChurchGiving, MarketListing } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge, statusToBadgeVariant } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { VerifiedBadge } from '../../components/members/VerifiedBadge';
import { MemberForm } from '../../components/members/MemberForm';
import type { MemberFormValues } from '../../components/members/MemberForm';
import { ListingCard } from '../../components/marketplace/ListingCard';

type TabKey = 'profile' | 'giving' | 'attendance' | 'marketplace';

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<ChurchMember | null>(null);
  const [tab, setTab] = useState<TabKey>('profile');
  const [giving, setGiving] = useState<ChurchGiving[]>([]);
  const [attendance, setAttendance] = useState<
    { id: number; service_type?: string; service_date?: string; checked_in_at?: string }[]
  >([]);
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
          const res = await api.get(`/attendance`);
          const rows = res.data?.data ?? res.data ?? [];
          if (!cancelled) {
            setAttendance(Array.isArray(rows) ? rows.slice(0, 20) : []);
          }
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

  const handleSave = async (data: MemberFormValues) => {
    if (!member) return;
    setSaving(true);
    try {
      await api.put(`/members/${member.id}`, data);
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
  const givingTotal = giving.reduce((sum, g) => sum + Number(g.amount || 0), 0);

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

  return (
    <div className="member-detail">
      <header className="card member-header">
        <div className="member-header-main">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={fullName} className="member-avatar" />
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
        {(
          [
            ['profile', 'Profile'],
            ['giving', 'Giving'],
            ['attendance', 'Attendance'],
            ['marketplace', 'Marketplace'],
          ] as const
        ).map(([key, label]) => (
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
        ) : tab === 'giving' ? (
          giving.length === 0 ? (
            <EmptyState title="No giving records for this member." />
          ) : (
            <>
              <p className="giving-total">
                Total: <strong className="mono">{formatGHS(givingTotal)}</strong>
              </p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Date</th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giving.map((g) => (
                      <tr key={g.id}>
                        <td>{g.giving_type}</td>
                        <td className="mono">{formatGHS(Number(g.amount))}</td>
                        <td>{g.payment_method || '—'}</td>
                        <td>
                          {g.service_date
                            ? new Date(g.service_date).toLocaleDateString('en-GH')
                            : '—'}
                        </td>
                        <td>{g.receipt_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : tab === 'attendance' ? (
          attendance.length === 0 ? (
            <EmptyState title="No attendance history yet." />
          ) : (
            <ul className="att-list">
              {attendance.map((a) => (
                <li key={a.id}>
                  <strong>{a.service_type || 'Service'}</strong>
                  <span>
                    {a.service_date
                      ? new Date(a.service_date).toLocaleDateString('en-GH')
                      : a.checked_in_at
                        ? new Date(a.checked_in_at).toLocaleDateString('en-GH')
                        : '—'}
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
          border-radius: 20px;
          object-fit: cover;
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
        .att-list { list-style: none; display: flex; flex-direction: column; gap: 12px; }
        .att-list li { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
        .att-list span { color: var(--text-secondary, #6b6560); }
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
