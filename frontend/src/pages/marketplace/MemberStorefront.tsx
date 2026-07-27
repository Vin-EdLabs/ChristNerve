import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
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

  return (
    <div className="storefront">
      <div className="storefront-banner">
        <div className="container storefront-banner-inner">
          <div className="storefront-banner-left">
            {church.logo_url ? (
              <img src={resolveMediaUrl(church.logo_url)} alt={church.name} />
            ) : (
              <div className="storefront-logo-fallback">{church.name?.[0]}</div>
            )}
            <p>
              <strong>{fullName}</strong> is a verified member of {church.name}
              {church.city ? `, ${church.city}` : ''}
            </p>
          </div>
          <Link to="/market" className="btn btn-outline storefront-visit">
            Visit →
          </Link>
        </div>
      </div>

      <div className="container storefront-body">
        <section className="card storefront-member">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={fullName} className="storefront-avatar" />
          ) : (
            <div className="storefront-avatar storefront-avatar--fallback">
              {member.first_name?.[0]}
              {member.last_name?.[0]}
            </div>
          )}
          <h1>{fullName}</h1>
          {member.occupation && (
            <p className="storefront-occupation">{member.occupation}</p>
          )}
          <div className="storefront-badges">
            {member.is_verified && <VerifiedBadge />}
            {member.city && (
              <span className="storefront-city">
                <MapPin size={14} />
                {member.city}
              </span>
            )}
          </div>
          <div className="storefront-actions">
            <Link to="/market/cart" className="btn btn-primary">
              View cart / checkout
            </Link>
            <Link to="/market" className="btn btn-outline">
              Browse marketplace
            </Link>
          </div>
          <p className="listing-privacy-note" style={{ marginTop: 12 }}>
            Seller contact unlocks at checkout after you add items to your cart.
          </p>
        </section>

        <section>
          <h2 className="storefront-section-title">
            What {member.first_name} Offers
          </h2>
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
          <Link to="/" className="btn btn-primary">
            Join Our Community
          </Link>
        </section>
      </div>

      <style>{`
        .storefront {
          min-height: 100vh;
          background: var(--bg-primary, #fff);
          padding-bottom: 64px;
        }
        .storefront-banner {
          background: var(--bg-secondary, #f8f7f5);
          border-bottom: 1px solid var(--border, #e8e4dc);
          padding: 16px 0;
        }
        .storefront-banner-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .storefront-banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
        }
        .storefront-banner-left img,
        .storefront-logo-fallback {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .storefront-logo-fallback {
          display: grid;
          place-items: center;
          background: var(--accent-light, #ede8fa);
          color: var(--accent, #2d1b69);
          font-weight: 600;
        }
        .storefront-visit { white-space: nowrap; }
        .storefront-body {
          padding-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .storefront-member { text-align: center; padding: 36px 24px; }
        .storefront-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          margin: 0 auto 16px;
        }
        .storefront-avatar--fallback {
          display: grid;
          place-items: center;
          background: var(--accent-light, #ede8fa);
          color: var(--accent, #2d1b69);
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .storefront-member h1 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 32px;
          font-weight: 600;
        }
        .storefront-occupation {
          font-size: 15px;
          color: var(--text-secondary, #6b6560);
          margin-top: 6px;
        }
        .storefront-badges {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin: 14px 0 20px;
          flex-wrap: wrap;
        }
        .storefront-city {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .storefront-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .storefront-section-title {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 20px;
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
          .storefront-banner-inner { flex-direction: column; align-items: flex-start; }
          .storefront-actions { flex-direction: column; }
          .storefront-actions .btn,
          .storefront-actions a { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
