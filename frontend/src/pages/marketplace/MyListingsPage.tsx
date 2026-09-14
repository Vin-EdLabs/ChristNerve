import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, Eye, Pencil, Plus, Store, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatGHS } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { churchDomainUrl } from '../../utils/tenantHost';
import type { MarketListing } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCachedQuery } from '../../utils/useCachedQuery';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80';

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.listings)) return obj.listings as T[];
  }
  return [];
}

function priceLabel(listing: MarketListing) {
  if (listing.price_label) return listing.price_label;
  if (listing.price_min != null && listing.price_max != null) {
    return `${formatGHS(Number(listing.price_min))} – ${formatGHS(Number(listing.price_max))}`;
  }
  if (listing.price_min != null) return `From ${formatGHS(Number(listing.price_min))}`;
  return '—';
}

export default function MyListingsPage() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: listings = [], loading, refetch } = useCachedQuery<MarketListing[]>(
    'my-listings',
    async () => {
      try {
        const res = await api.get('/market/my-listings');
        return asList<MarketListing>(res.data);
      } catch {
        toast.error('Failed to load your listings');
        return [];
      }
    }
  );

  const { data: storefrontSlug = null } = useCachedQuery<string | null>(
    'my-storefront-slug',
    async () => {
      try {
        const res = await api.get('/market/my-storefront');
        return res.data?.marketplace_slug || null;
      } catch {
        return null;
      }
    }
  );

  const storefrontLink =
    storefrontSlug && tenant?.slug ? churchDomainUrl(tenant.slug, `/shop/${storefrontSlug}`) : null;

  const copyStorefrontLink = () => {
    if (!storefrontLink) return;
    void navigator.clipboard.writeText(storefrontLink).then(() => {
      setCopied(true);
      toast.success('Storefront link copied');
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDelete = async (listing: MarketListing) => {
    if (!window.confirm(`Remove “${listing.title}”?`)) return;
    try {
      await api.delete(`/market/listings/${listing.id}`);
      toast.success('Listing removed');
      refetch();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Could not delete listing';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="my-listings">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="my-listings">
      <div className="my-listings-toolbar">
        <div>
          <h2 className="page-heading">My Listings</h2>
          <p className="my-listings-sub">
            <Link to="/market/orders">View orders</Link>
            {' · '}
            Tap a product to edit
          </p>
        </div>
        <Link to="/market/create" className="btn btn-primary">
          <Plus size={16} />
          Create Listing
        </Link>
      </div>

      {storefrontLink && (
        <div className="my-storefront-card">
          <span className="my-storefront-icon">
            <Store size={18} />
          </span>
          <div className="my-storefront-info">
            <strong>Your storefront</strong>
            <span>Share this link — visitors see only your items, nobody else's.</span>
          </div>
          <div className="my-storefront-link-row">
            <input readOnly value={storefrontLink} onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="sm" onClick={copyStorefrontLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {listings.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Create a listing for kente, produce, repairs, or photography."
          actionLabel="Create Listing"
          onAction={() => navigate('/market/create')}
        />
      ) : (
        <div className="my-listings-grid">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="my-listing-card"
              onClick={() => navigate(`/market/edit/${listing.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/market/edit/${listing.id}`);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="my-listing-img">
                <img
                  src={resolveMediaUrl(listing.primary_image, PLACEHOLDER)}
                  alt={listing.title}
                />
                <Badge
                  variant={listing.is_active ? 'active' : 'inactive'}
                  className="my-listing-status"
                >
                  {listing.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="my-listing-body">
                <h3>{listing.title}</h3>
                <p className="mono">{priceLabel(listing)}</p>
                <p className="my-listing-meta">
                  {listing.location || '—'} · {listing.views_count ?? 0} views
                </p>
                <div
                  className="my-listing-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigate(`/market/listing/${listing.slug}`)
                    }
                    aria-label="View listing"
                  >
                    <Eye size={16} />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/market/edit/${listing.id}`)}
                    aria-label="Edit listing"
                  >
                    <Pencil size={16} />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(listing)}
                    aria-label="Delete listing"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .my-listings { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 1100px; margin: 0 auto; }
        .my-listings-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }
        .my-listings-sub {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .my-listings-sub a {
          color: var(--accent, #2d1b69);
          text-decoration: none;
        }
        .my-storefront-card {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          padding: 14px 16px; border: 1px solid var(--border, #e8e4dc);
          border-radius: 14px; background: var(--accent-light, #ede8fa);
        }
        .my-storefront-icon {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--bg-primary, #fff); color: var(--accent, #2d1b69);
        }
        .my-storefront-info { display: flex; flex-direction: column; gap: 2px; min-width: 180px; flex: 1; }
        .my-storefront-info strong { font-size: 14px; }
        .my-storefront-info span { font-size: 12px; color: var(--text-muted, #9e9893); }
        .my-storefront-link-row { display: flex; gap: 8px; flex: 2; min-width: 240px; }
        .my-storefront-link-row input {
          flex: 1; min-width: 0; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border, #e8e4dc); background: var(--bg-primary, #fff);
          font-size: 12.5px; color: var(--text-secondary, #6b6560);
        }
        .my-listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }
        .my-listing-card {
          background: #fff;
          border: 1px solid var(--border, #e8e4dc);
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
          text-align: left;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .my-listing-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(15, 13, 10, 0.08);
        }
        .my-listing-img {
          position: relative;
          aspect-ratio: 1;
          background: #f3f1ec;
        }
        .my-listing-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .my-listing-status {
          position: absolute;
          top: 10px;
          left: 10px;
        }
        .my-listing-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .my-listing-body h3 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 20px;
          font-weight: 600;
          margin: 0;
          line-height: 1.2;
        }
        .my-listing-meta {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted, #9e9893);
        }
        .my-listing-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }
        .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); margin: 0; font-size: 13px; }
      `}</style>
    </div>
  );
}
