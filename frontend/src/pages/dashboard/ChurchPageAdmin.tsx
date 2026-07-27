import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  ImagePlus,
  Trash2,
  Check,
  X,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  UserPlus,
  Clock3,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { churchDomainUrl, getChurchSlug } from '../../utils/tenantHost';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

type ChurchPageData = {
  id?: number;
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  visit_welcome?: string;
  youtube_url?: string;
  logo_url?: string;
  banner_url?: string;
  visit_hero_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  denomination?: string;
};

type GalleryItem = {
  id: number;
  image_url: string;
  caption?: string | null;
};

type JoinApp = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  note?: string | null;
  status: string;
  created_at?: string;
};

export default function ChurchPageAdmin() {
  const { user, tenant } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const canEdit = ['pastor', 'admin', 'super-admin', 'secretary'].includes(role);

  const [tab, setTab] = useState<'content' | 'joins'>('content');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [church, setChurch] = useState<ChurchPageData>({});
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [joins, setJoins] = useState<JoinApp[]>([]);
  const [pending, setPending] = useState(0);
  const [joinFilter, setJoinFilter] = useState<'pending' | 'approved' | 'declined' | 'all'>(
    'pending'
  );
  const [actingId, setActingId] = useState<number | null>(null);
  const heroRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pageRes, joinsRes] = await Promise.all([
        api.get('/church-page'),
        api.get('/church-page/joins', { params: { status: 'all' } }).catch(() => ({
          data: { data: [] },
        })),
      ]);
      setChurch(pageRes.data?.church || {});
      setGallery(Array.isArray(pageRes.data?.gallery) ? pageRes.data.gallery : []);
      setPending(Number(pageRes.data?.pending_joins) || 0);
      setJoins(Array.isArray(joinsRes.data?.data) ? joinsRes.data.data : []);
    } catch {
      toast.error('Failed to load church page settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveContent = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/church-page', {
        tagline: church.tagline || '',
        description: church.description || '',
        visit_welcome: church.visit_welcome || '',
        youtube_url: church.youtube_url || '',
        phone: church.phone || '',
        email: church.email || '',
        address: church.address || '',
        city: church.city || '',
        denomination: church.denomination || '',
      });
      setChurch(res.data?.church || church);
      toast.success('Church page saved');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const uploadHero = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('hero', file);
      const res = await api.post('/church-page/hero', fd);
      setChurch((c) => ({
        ...c,
        visit_hero_url: res.data?.church?.visit_hero_url,
        banner_url: res.data?.church?.banner_url || c.banner_url,
      }));
      toast.success('Hero image updated');
    } catch {
      toast.error('Could not upload hero');
    } finally {
      setSaving(false);
    }
  };

  const uploadGallery = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/church-page/gallery', fd);
      setGallery((g) => [...g, res.data]);
      toast.success('Photo added');
    } catch {
      toast.error('Could not upload photo');
    } finally {
      setSaving(false);
    }
  };

  const removeGallery = async (id: number) => {
    try {
      await api.delete(`/church-page/gallery/${id}`);
      setGallery((g) => g.filter((x) => x.id !== id));
      toast.success('Photo removed');
    } catch {
      toast.error('Could not remove photo');
    }
  };

  const approve = async (id: number) => {
    setActingId(id);
    try {
      await api.post(`/church-page/joins/${id}/approve`);
      toast.success('Approved — member added (PIN = last 4 of phone)');
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not approve';
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  };

  const decline = async (id: number) => {
    setActingId(id);
    try {
      await api.post(`/church-page/joins/${id}/decline`);
      toast.success('Request declined');
      await load();
    } catch {
      toast.error('Could not decline');
    } finally {
      setActingId(null);
    }
  };

  const joinCounts = useMemo(() => {
    const all = joins.length;
    const pendingCount = joins.filter((j) => j.status === 'pending').length;
    const approved = joins.filter((j) => j.status === 'approved').length;
    const declined = joins.filter((j) => j.status === 'declined').length;
    return { all, pending: pendingCount, approved, declined };
  }, [joins]);

  const filteredJoins = useMemo(() => {
    if (joinFilter === 'all') return joins;
    return joins.filter((j) => j.status === joinFilter);
  }, [joins, joinFilter]);

  const formatJoinDate = (raw?: string) => {
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleDateString('en-GH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  if (loading) return <Spinner fullPage />;
  if (!canEdit) {
    return (
      <EmptyState
        title="Church page"
        description="Only pastors, admins, and secretaries can edit the public church page."
      />
    );
  }

  const heroSrc = resolveMediaUrl(
    church.visit_hero_url || church.banner_url || ''
  );
  const slug =
    church.slug || tenant?.slug || getChurchSlug() || 'pka';
  const visitPreviewUrl = churchDomainUrl(slug, '/visit');

  return (
    <div className="church-page-admin">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Church page</h1>
          <p className="page-sub">
            Design the public visit page visitors see when the link is shared.
          </p>
        </div>
        <a
          className="btn btn-outline"
          href={visitPreviewUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} /> Preview visit page
        </a>
      </div>

      <div className="users-seg" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className={`users-seg-btn${tab === 'content' ? ' is-active' : ''}`}
          onClick={() => setTab('content')}
        >
          Page content
        </button>
        <button
          type="button"
          className={`users-seg-btn${tab === 'joins' ? ' is-active' : ''}`}
          onClick={() => setTab('joins')}
        >
          Join requests{pending ? ` (${pending})` : ''}
        </button>
      </div>

      {tab === 'content' ? (
        <div className="cpa-grid">
          <form className="card cpa-form" onSubmit={saveContent}>
            <h3>Welcome copy</h3>
            <Input
              label="Tagline"
              value={church.tagline || ''}
              onChange={(e) =>
                setChurch((c) => ({ ...c, tagline: e.target.value }))
              }
              placeholder="A family of faith"
            />
            <TextArea
              label="Visit welcome message"
              value={church.visit_welcome || ''}
              onChange={(e) =>
                setChurch((c) => ({ ...c, visit_welcome: e.target.value }))
              }
              rows={4}
              placeholder="Warm words for people visiting for the first time"
            />
            <TextArea
              label="About the church"
              value={church.description || ''}
              onChange={(e) =>
                setChurch((c) => ({ ...c, description: e.target.value }))
              }
              rows={4}
            />
            <TextArea
              label="YouTube video URL(s)"
              value={church.youtube_url || ''}
              onChange={(e) =>
                setChurch((c) => ({ ...c, youtube_url: e.target.value }))
              }
              rows={3}
              placeholder={
                'One link per line — visitors can play them on the visit page\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/...'
              }
            />
            <div className="form-row">
              <Input
                label="Phone"
                value={church.phone || ''}
                onChange={(e) =>
                  setChurch((c) => ({ ...c, phone: e.target.value }))
                }
              />
              <Input
                label="Email"
                value={church.email || ''}
                onChange={(e) =>
                  setChurch((c) => ({ ...c, email: e.target.value }))
                }
              />
            </div>
            <div className="form-row">
              <Input
                label="City"
                value={church.city || ''}
                onChange={(e) =>
                  setChurch((c) => ({ ...c, city: e.target.value }))
                }
              />
              <Input
                label="Denomination"
                value={church.denomination || ''}
                onChange={(e) =>
                  setChurch((c) => ({ ...c, denomination: e.target.value }))
                }
              />
            </div>
            <Input
              label="Address"
              value={church.address || ''}
              onChange={(e) =>
                setChurch((c) => ({ ...c, address: e.target.value }))
              }
            />
            <Button type="submit" loading={saving}>
              Save page content
            </Button>
          </form>

          <div className="cpa-media">
            <div className="card">
              <h3>Hero image</h3>
              <p className="page-sub">
                Full-bleed image at the top of the visit page.
              </p>
              <div
                className="cpa-hero-preview"
                style={
                  heroSrc
                    ? { backgroundImage: `url(${heroSrc})` }
                    : undefined
                }
              >
                {!heroSrc && <span>No hero yet</span>}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => heroRef.current?.click()}
                loading={saving}
              >
                <ImagePlus size={14} /> Upload hero
              </Button>
              <input
                ref={heroRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  void uploadHero(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="card">
              <h3>Life in church gallery</h3>
              <div className="cpa-gallery">
                {gallery.map((g) => (
                  <figure key={g.id}>
                    <img src={resolveMediaUrl(g.image_url)} alt="" />
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => void removeGallery(g.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </figure>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => galleryRef.current?.click()}
                loading={saving}
              >
                <ImagePlus size={14} /> Add photo
              </Button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  void uploadGallery(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="join-board">
          <div className="join-board-hero">
            <div className="join-board-hero-copy">
              <p className="join-board-kicker">Congregation</p>
              <h2>People who want to join</h2>
              <p>
                Review each request, then approve to create their member profile
                automatically. Default PIN is the last 4 digits of their phone.
              </p>
            </div>
            <div className="join-board-stats">
              <div className="join-stat join-stat--pending">
                <span className="join-stat-value">{joinCounts.pending}</span>
                <span className="join-stat-label">Pending</span>
              </div>
              <div className="join-stat">
                <span className="join-stat-value">{joinCounts.approved}</span>
                <span className="join-stat-label">Approved</span>
              </div>
              <div className="join-stat">
                <span className="join-stat-value">{joinCounts.declined}</span>
                <span className="join-stat-label">Declined</span>
              </div>
            </div>
          </div>

          <div className="join-pin-note">
            <KeyRound size={16} />
            <span>
              When you approve, their login phone is saved and the PIN defaults
              to the <strong>last 4 digits</strong> of that number.
            </span>
          </div>

          <div className="join-filters" role="tablist" aria-label="Filter join requests">
            {(
              [
                ['pending', 'Pending', joinCounts.pending],
                ['approved', 'Approved', joinCounts.approved],
                ['declined', 'Declined', joinCounts.declined],
                ['all', 'All', joinCounts.all],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={joinFilter === key}
                className={`join-filter${joinFilter === key ? ' is-active' : ''}`}
                onClick={() => setJoinFilter(key)}
              >
                {label}
                <em>{count}</em>
              </button>
            ))}
          </div>

          {filteredJoins.length === 0 ? (
            <EmptyState
              title={
                joinFilter === 'pending'
                  ? 'No pending requests'
                  : 'No join requests here'
              }
              description={
                joinFilter === 'pending'
                  ? 'New visitors who submit the join form will appear here.'
                  : 'Try another filter, or share the visit page to invite people.'
              }
            />
          ) : (
            <div className="join-list">
              {filteredJoins.map((j) => {
                const initials =
                  `${j.first_name?.[0] || ''}${j.last_name?.[0] || ''}`.toUpperCase() ||
                  '?';
                const when = formatJoinDate(j.created_at);
                const busy = actingId === j.id;
                return (
                  <article
                    key={j.id}
                    className={`join-card join-card--${j.status}`}
                  >
                    <div className="join-card-top">
                      <div className="join-avatar" aria-hidden>
                        {initials}
                      </div>
                      <div className="join-card-identity">
                        <div className="join-card-name-row">
                          <h3>
                            {j.first_name} {j.last_name}
                          </h3>
                          <span className={`join-badge join-badge--${j.status}`}>
                            {j.status}
                          </span>
                        </div>
                        {when && (
                          <p className="join-card-when">
                            <Clock3 size={13} />
                            Requested {when}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="join-card-details">
                      <a className="join-detail" href={`tel:${j.phone}`}>
                        <Phone size={15} />
                        <span>{j.phone}</span>
                      </a>
                      {j.whatsapp && j.whatsapp !== j.phone && (
                        <div className="join-detail">
                          <MessageCircle size={15} />
                          <span>{j.whatsapp}</span>
                        </div>
                      )}
                      {j.email && (
                        <a className="join-detail" href={`mailto:${j.email}`}>
                          <Mail size={15} />
                          <span>{j.email}</span>
                        </a>
                      )}
                      {j.city && (
                        <div className="join-detail">
                          <MapPin size={15} />
                          <span>{j.city}</span>
                        </div>
                      )}
                    </div>

                    {j.note ? (
                      <blockquote className="join-note">
                        <p>{j.note}</p>
                      </blockquote>
                    ) : (
                      <p className="join-note join-note--empty">No note left</p>
                    )}

                    {j.status === 'pending' ? (
                      <div className="join-card-actions">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void approve(j.id)}
                        >
                          <UserPlus size={15} />
                          {busy ? 'Working…' : 'Add as member'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void decline(j.id)}
                        >
                          <X size={15} />
                          Decline
                        </Button>
                      </div>
                    ) : j.status === 'approved' ? (
                      <p className="join-card-result">
                        <Check size={14} />
                        Member profile created — PIN is last 4 of phone
                      </p>
                    ) : (
                      <p className="join-card-result join-card-result--muted">
                        Request was declined
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        .cpa-grid {
          display: grid; gap: 16px;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
        }
        @media (max-width: 900px) {
          .cpa-grid { grid-template-columns: 1fr; }
        }
        .cpa-form, .cpa-media .card {
          display: flex; flex-direction: column; gap: 12px; padding: 20px;
        }
        .cpa-form h3, .cpa-media h3 { margin: 0 0 4px; font-size: 16px; }
        .cpa-media { display: flex; flex-direction: column; gap: 16px; }
        .cpa-hero-preview {
          height: 180px; border-radius: 14px; background: #2c2c2e center/cover;
          display: grid; place-items: center; color: #c4a035; font-size: 13px;
          border: 1px solid rgba(196,160,53,0.25);
        }
        .cpa-gallery {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
        }
        .cpa-gallery figure {
          position: relative; margin: 0; aspect-ratio: 1;
          border-radius: 10px; overflow: hidden;
        }
        .cpa-gallery img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cpa-gallery button {
          position: absolute; top: 4px; right: 4px; border: 0; border-radius: 6px;
          background: rgba(0,0,0,0.55); color: #fff; width: 28px; height: 28px;
          display: grid; place-items: center; cursor: pointer;
        }
        .users-seg {
          display: inline-flex; gap: 4px; padding: 4px; background: #f3f0ea;
          border-radius: 12px;
        }
        .users-seg-btn {
          border: 0; background: transparent; padding: 8px 16px; border-radius: 9px;
          font-size: 13px; font-weight: 600; color: #6b6570; cursor: pointer;
        }
        .users-seg-btn.is-active {
          background: #fff; color: #1a1523;
          box-shadow: 0 1px 3px rgba(15,13,20,0.08);
        }

        /* Join requests board */
        .join-board {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .join-board-hero {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: stretch;
          padding: 24px 26px;
          border-radius: 18px;
          background:
            linear-gradient(135deg, #1a1523 0%, #2d1b69 58%, #3d2a1f 100%);
          color: #f7f3ea;
          overflow: hidden;
          position: relative;
        }
        .join-board-hero::after {
          content: '';
          position: absolute;
          inset: auto -40px -60px auto;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: rgba(196, 160, 53, 0.18);
          pointer-events: none;
        }
        .join-board-hero-copy {
          position: relative;
          z-index: 1;
          max-width: 48ch;
        }
        .join-board-kicker {
          margin: 0 0 6px;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(247, 243, 234, 0.65);
        }
        .join-board-hero h2 {
          margin: 0 0 8px;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 600;
          color: #fff !important;
        }
        .join-board-hero p {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: rgba(247, 243, 234, 0.82);
        }
        .join-board-stats {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 10px;
          align-items: stretch;
          flex-shrink: 0;
        }
        .join-stat {
          min-width: 84px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          text-align: center;
        }
        .join-stat--pending {
          background: rgba(196, 160, 53, 0.22);
          border-color: rgba(196, 160, 53, 0.35);
        }
        .join-stat-value {
          display: block;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          line-height: 1;
          margin-bottom: 4px;
        }
        .join-stat-label {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.75;
        }
        .join-pin-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: #f7f3ea;
          border: 1px solid #ebe4d6;
          color: #5c564e;
          font-size: 13px;
          line-height: 1.45;
        }
        .join-pin-note svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: #c4a035;
        }
        .join-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .join-filter {
          border: 1px solid #e8e4dc;
          background: #fff;
          color: #6b6560;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .join-filter em {
          font-style: normal;
          font-size: 11px;
          font-weight: 700;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #f3f0ea;
          color: #5c564e;
        }
        .join-filter.is-active {
          background: #1a1523;
          border-color: #1a1523;
          color: #f7f3ea;
        }
        .join-filter.is-active em {
          background: rgba(196, 160, 53, 0.25);
          color: #f3e6c8;
        }
        .join-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }
        .join-card {
          background: #fff;
          border: 1px solid #ebe6dc;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 1px 2px rgba(20, 16, 12, 0.04);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .join-card:hover {
          border-color: #ddd5c6;
          box-shadow: 0 8px 24px rgba(20, 16, 12, 0.06);
        }
        .join-card--pending {
          border-color: rgba(196, 160, 53, 0.35);
        }
        .join-card-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .join-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          background: linear-gradient(145deg, #ede8fa, #f7f3ea);
          color: #2d1b69;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 18px;
          font-weight: 700;
        }
        .join-card-identity {
          min-width: 0;
          flex: 1;
        }
        .join-card-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .join-card-name-row h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 650;
          color: #1a1523;
          line-height: 1.25;
        }
        .join-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .join-badge--pending {
          background: rgba(196, 160, 53, 0.16);
          color: #8a6a12;
        }
        .join-badge--approved {
          background: rgba(46, 125, 75, 0.12);
          color: #1f6b43;
        }
        .join-badge--declined {
          background: rgba(140, 140, 140, 0.14);
          color: #6b6560;
        }
        .join-card-when {
          margin: 6px 0 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: #9e9893;
        }
        .join-card-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .join-detail {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #4a453f;
          text-decoration: none;
          min-width: 0;
        }
        .join-detail svg {
          color: #9e9893;
          flex-shrink: 0;
        }
        .join-detail span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        a.join-detail:hover span {
          color: #2d1b69;
          text-decoration: underline;
        }
        .join-note {
          margin: 0;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f8f6f1;
          border-left: 3px solid #c4a035;
        }
        .join-note p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #4a453f;
        }
        .join-note--empty {
          border-left-color: #ddd5c6;
          color: #9e9893;
          font-size: 13px;
          font-style: italic;
        }
        .join-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
          padding-top: 2px;
        }
        .join-card-result {
          margin: 0;
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #1f6b43;
          font-weight: 500;
        }
        .join-card-result--muted {
          color: #9e9893;
          font-weight: 400;
        }
        @media (max-width: 720px) {
          .join-board-hero {
            flex-direction: column;
            padding: 20px;
          }
          .join-board-stats {
            width: 100%;
          }
          .join-stat {
            flex: 1;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
}
