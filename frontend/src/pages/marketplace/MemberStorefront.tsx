import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { MarketListing } from '../../types';
import { VerifiedBadge } from '../../components/members/VerifiedBadge';
import { ListingGrid } from '../../components/marketplace/ListingGrid';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { resolveMediaUrl } from '../../utils/mediaUrl';

interface StorefrontData {
  member: {
    id: number;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    occupation?: string;
    city?: string;
    is_verified?: boolean;
    marketplace_slug?: string;
    phone?: string;
    whatsapp?: string;
    membership_date?: string;
  };
  church: {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
    tagline?: string;
    city?: string;
    denomination?: string;
  };
  listings: MarketListing[];
}

const HERO =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80';

export default function MemberStorefront() {
  const { memberSlug } = useParams<{ memberSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorefrontData | null>(null);

  useEffect(() => {
    if (!memberSlug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/market/storefront/${memberSlug}`);
        if (cancelled) return;
        const payload = res.data as StorefrontData;
        setData(payload);
        const name = `${payload.member?.first_name || ''} ${payload.member?.last_name || ''}`.trim();
        const occupation = payload.member?.occupation || 'Business';
        const churchName = payload.church?.name || 'Church';
        document.title = `${name} — ${occupation} | ${churchName} Marketplace`;
        const meta =
          document.querySelector('meta[name="description"]') ||
          (() => {
            const m = document.createElement('meta');
            m.setAttribute('name', 'description');
            document.head.appendChild(m);
            return m;
          })();
        meta.setAttribute(
          'content',
          `Browse ${name}'s business listings. Verified member of ${churchName}${payload.church?.city ? `, ${payload.church.city}` : ''}.`
        );
      } catch {
        if (!cancelled) {
          toast.error('Storefront not found');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberSlug]);

  if (loading) {
    return (
      <div className="storefront">
        <div className="container" style={{ paddingTop: 32 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!data?.member) {
    return (
      <div className="storefront">
        <div className="container" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <h1>Storefront not found</h1>
          <Link to="/market">Browse marketplace</Link>
        </div>
      </div>
    );
  }

  const { member, church, listings } = data;
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  const count = listings?.length || 0;
  const year = member.membership_date
    ? new Date(member.membership_date).getFullYear()
    : null;

  return (
    <div className="storefront storefront--shop">
      <section className="storefront-hero">
        <div
          className="storefront-hero-media"
          aria-hidden
          style={{ backgroundImage: `url('${HERO}')` }}
        />
        <div className="storefront-hero-veil" aria-hidden />
        <div className="container storefront-hero-inner">
          <p className="storefront-hero-kicker">{church.name} marketplace</p>
          <div className="storefront-hero-profile">
            {member.avatar_url ? (
              <img
                src={resolveMediaUrl(member.avatar_url)}
                alt={fullName}
                className="storefront-hero-avatar"
              />
            ) : (
              <div className="storefront-hero-avatar storefront-hero-avatar--fallback">
                {member.first_name?.[0]}
                {member.last_name?.[0]}
              </div>
            )}
            <div>
              <h1>{fullName}</h1>
              {member.occupation && (
                <p className="storefront-hero-role">{member.occupation}</p>
              )}
              <div className="storefront-hero-meta">
                {member.is_verified && <VerifiedBadge />}
                {member.city && (
                  <span>
                    <MapPin size={14} /> {member.city}
                  </span>
                )}
                {year && <span>Member since {year}</span>}
                <span>
                  <Package size={14} /> {count} listing{count === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>
          <div className="storefront-hero-actions">
            <Link to="/market/cart" className="btn btn-primary">
              View cart / checkout
            </Link>
            <Link to="/market" className="btn btn-outline storefront-hero-ghost">
              Back to marketplace
            </Link>
          </div>
        </div>
      </section>

      <div className="container storefront-body">
        <section>
          <div className="storefront-section-head">
            <div>
              <p className="storefront-section-kicker">Vendor shop</p>
              <h2 className="storefront-section-title">
                What {member.first_name} offers
              </h2>
              <p className="storefront-section-sub">
                Browse every active item from this church member in one place.
              </p>
            </div>
          </div>
          {listings?.length ? (
            <ListingGrid listings={listings} />
          ) : (
            <EmptyState title="No active listings yet." />
          )}
        </section>

        <section className="storefront-church card">
          <p className="storefront-church-label">About {church.name}</p>
          <h3>{church.name}</h3>
          <p className="storefront-church-meta">
            {[church.city, church.denomination].filter(Boolean).join(' · ')}
          </p>
          {church.tagline && <p className="storefront-tagline">{church.tagline}</p>}
          <Link to="/visit" className="btn btn-primary">
            Visit church page
          </Link>
        </section>
      </div>

      <style>{`
        .storefront--shop {
          min-height: 100vh;
          background: var(--bg-primary, #fff);
          padding-bottom: 64px;
        }
        .storefront-hero {
          position: relative;
          overflow: hidden;
          color: #f7f3ea;
          padding: 48px 0 56px;
        }
        .storefront-hero-media {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          transform: scale(1.04);
          filter: saturate(0.85) contrast(1.05);
        }
        .storefront-hero-veil {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(16,13,10,0.62) 0%, rgba(16,13,10,0.78) 100%);
        }
        .storefront-hero-inner {
          position: relative;
          z-index: 1;
        }
        .storefront-hero-kicker {
          margin: 0 0 18px;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .storefront-hero-profile {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
        }
        .storefront-hero-avatar {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.35);
          flex-shrink: 0;
        }
        .storefront-hero-avatar--fallback {
          display: grid;
          place-items: center;
          background: rgba(243, 230, 200, 0.2);
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .storefront-hero-inner h1 {
          margin: 0;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: clamp(32px, 5vw, 44px);
          font-weight: 600;
          color: #fff !important;
        }
        .storefront-hero-role {
          margin: 6px 0 10px;
          font-size: 15px;
          opacity: 0.88;
        }
        .storefront-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          align-items: center;
          font-size: 13px;
          opacity: 0.9;
        }
        .storefront-hero-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .storefront-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .storefront-hero-ghost {
          background: transparent;
          color: #f7f3ea;
          border-color: rgba(247, 243, 234, 0.45);
        }
        .storefront-body {
          padding-top: 36px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .storefront-section-kicker {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        .storefront-section-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 30px;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .storefront-section-sub {
          margin: 0 0 22px;
          color: var(--text-secondary, #6b6560);
          max-width: 48ch;
        }
        .storefront-church { text-align: center; }
        .storefront-church-label {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted, #9e9893);
          margin-bottom: 8px;
        }
        .storefront-church h3 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .storefront-church-meta {
          font-size: 14px;
          color: var(--text-muted, #9e9893);
          margin-bottom: 10px;
        }
        .storefront-tagline {
          font-size: 15px;
          color: var(--text-secondary, #6b6560);
          margin-bottom: 20px;
        }
        @media (max-width: 640px) {
          .storefront-hero { padding: 36px 0 40px; }
          .storefront-hero-profile { align-items: flex-start; }
          .storefront-hero-actions .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
