import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, MessageCircle, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatGHS } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import type { MarketListing } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { SellerCard } from '../../components/marketplace/SellerCard';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { Button } from '../../components/ui/Button';

interface ListingDetail extends Omit<MarketListing, 'images'> {
  images?: { id?: number; image_url: string; is_primary?: boolean }[];
  category?: { name?: string; slug?: string } | null;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    is_verified?: boolean;
    phone?: string;
    whatsapp?: string;
    marketplace_slug?: string;
    membership_date?: string;
    city?: string;
  } | null;
  church?: {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
    tagline?: string;
    city?: string;
    denomination?: string;
  } | null;
  more_from_seller?: MarketListing[];
}

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80';

function priceLabel(listing: Pick<MarketListing, 'price_label' | 'price_min' | 'price_max'>) {
  if (listing.price_label) return listing.price_label;
  if (listing.price_min != null && listing.price_max != null) {
    return `${formatGHS(Number(listing.price_min))} – ${formatGHS(Number(listing.price_max))}`;
  }
  if (listing.price_min != null) return `From ${formatGHS(Number(listing.price_min))}`;
  return 'Contact for price';
}

export default function ListingDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToBag, checkoutListing } = useCart();
  const { isAuthenticated, user, accountType } = useAuth();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/market/listings/${slug}`);
        if (!cancelled) {
          setListing(res.data);
          setActiveImage(0);
          document.title = `${res.data?.title || 'Listing'} | ${res.data?.church?.name || 'Marketplace'}`;
        }
      } catch {
        if (!cancelled) {
          toast.error('Listing not found');
          setListing(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="listing-detail">
        <div className="container" style={{ paddingTop: 32 }}>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="listing-detail">
        <div className="container" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <h1>Listing not found</h1>
          <Link to="/market">Back to marketplace</Link>
        </div>
      </div>
    );
  }

  const images =
    listing.images && listing.images.length > 0
      ? listing.images.map((i) => resolveMediaUrl(i.image_url, PLACEHOLDER))
      : listing.primary_image
        ? [resolveMediaUrl(listing.primary_image, PLACEHOLDER)]
        : [PLACEHOLDER];

  const member = listing.member;
  const sellerName = member
    ? `${member.first_name} ${member.last_name}`.trim()
    : 'Seller';

  const asCartListing: MarketListing = {
    ...(listing as MarketListing),
    id: Number(listing.id),
    church_id: Number(listing.church_id),
    member_id: Number(listing.member_id),
    title: listing.title,
    description: listing.description,
    slug: listing.slug,
    whatsapp: member?.whatsapp || listing.whatsapp || '',
    phone: member?.phone || listing.phone,
    first_name: member?.first_name,
    last_name: member?.last_name,
    primary_image:
      listing.images?.[0]?.image_url || listing.primary_image || null,
    is_active: listing.is_active,
    is_featured: listing.is_featured,
    views_count: listing.views_count,
  };

  const isOwnListing =
    accountType === 'member' &&
    Number(user?.id) === Number(listing.member_id);

  const messageSeller = () => {
    if (isOwnListing) {
      toast.error('This is your own listing');
      return;
    }
    const path = `/market/chat?listing=${listing.id}`;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: path } });
      return;
    }
    navigate(path);
  };

  return (
    <div className="listing-detail">
      <div className="container listing-layout">
        <div className="listing-gallery">
          <img
            src={images[activeImage]}
            alt={listing.title}
            className="listing-main-img"
          />
          {images.length > 1 && (
            <div className="listing-thumbs">
              {images.slice(0, 4).map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  className={`listing-thumb${activeImage === i ? ' listing-thumb--active' : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="listing-info">
          <p className="listing-breadcrumb">
            <Link to="/market">Marketplace</Link>
            {' / '}
            {listing.category?.name ||
              (listing as MarketListing & { category_name?: string }).category_name ||
              'Listing'}
          </p>
          <h1>{listing.title}</h1>
          <p className="listing-price">{priceLabel(listing)}</p>

          {member && (
            <SellerCard
              member={{
                ...member,
                is_verified: !!member.is_verified,
              }}
              church={listing.church}
            />
          )}

          <p className="listing-desc">{listing.description}</p>

          {listing.location && (
            <p className="listing-loc">
              <MapPin size={16} />
              {listing.location}
            </p>
          )}

          <div className="listing-buy-actions">
            <Button size="lg" onClick={() => addToBag(asCartListing)}>
              <ShoppingCart size={18} />
              Add to cart
            </Button>
            <Button size="lg" variant="outline" onClick={() => checkoutListing(asCartListing)}>
              Go to checkout
            </Button>
            {!isOwnListing && (
              <Button size="lg" variant="ghost" onClick={messageSeller}>
                <MessageCircle size={18} />
                Message seller
              </Button>
            )}
            <p className="listing-privacy-note">
              Chat goes only to the member who listed this product — they can reply in Messages / Orders.
            </p>
          </div>

          {listing.church && (
            <div className="church-invite">
              <div className="church-invite-left">
                {listing.church.logo_url ? (
                  <img src={resolveMediaUrl(listing.church.logo_url)} alt="" />
                ) : (
                  <div className="church-invite-fallback">
                    {listing.church.name?.[0]}
                  </div>
                )}
                <div>
                  <p>
                    <strong>{sellerName}</strong> is a verified member of{' '}
                    {listing.church.name}
                    {listing.church.city ? `, ${listing.church.city}` : ''}
                  </p>
                  {listing.church.tagline && (
                    <p className="church-invite-tag">
                      &ldquo;{listing.church.tagline}&rdquo;
                    </p>
                  )}
                </div>
              </div>
              <Link to="/" className="btn btn-outline">
                Visit Our Church Page →
              </Link>
            </div>
          )}
        </div>
      </div>

      {(listing.more_from_seller?.length || 0) > 0 && (
        <section className="container more-section">
          <h2>More from {member?.first_name || 'this seller'}</h2>
          <div className="more-grid">
            {listing.more_from_seller!.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      <style>{`
        .listing-detail { min-height: 100vh; background: var(--bg-primary, #fff); padding-bottom: 64px; }
        .listing-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          padding-top: 32px;
          padding-bottom: 40px;
        }
        .listing-main-img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 16px;
          background: var(--bg-surface, #f0eee9);
        }
        .listing-thumbs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 12px;
        }
        .listing-thumb {
          border: 2px solid transparent;
          border-radius: 10px;
          overflow: hidden;
          padding: 0;
          cursor: pointer;
          background: none;
        }
        .listing-thumb--active { border-color: var(--accent, #2d1b69); }
        .listing-thumb img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }
        .listing-breadcrumb {
          font-size: 13px;
          color: var(--text-muted, #9e9893);
          margin-bottom: 10px;
        }
        .listing-breadcrumb a {
          color: var(--text-muted, #9e9893);
          text-decoration: none;
        }
        .listing-info h1 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .listing-price {
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: 22px;
          margin-bottom: 20px;
        }
        .listing-desc {
          font-size: 15px;
          line-height: 1.65;
          color: var(--text-secondary, #6b6560);
          margin: 20px 0;
        }
        .listing-loc {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: var(--text-muted, #9e9893);
          margin-bottom: 20px;
        }
        .listing-buy-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .listing-privacy-note {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
        }
        .church-invite {
          margin-top: 28px;
          padding: 20px;
          background: var(--bg-secondary, #f8f7f5);
          border: 1px solid var(--border, #e8e4dc);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .church-invite-left {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .church-invite-left img,
        .church-invite-fallback {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .church-invite-fallback {
          display: grid;
          place-items: center;
          background: var(--accent-light, #ede8fa);
          color: var(--accent, #2d1b69);
          font-weight: 600;
        }
        .church-invite-tag {
          margin-top: 6px;
          font-size: 13px;
          color: var(--text-secondary, #6b6560);
          font-style: italic;
        }
        .more-section h2 {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .more-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        @media (max-width: 900px) {
          .listing-layout { grid-template-columns: 1fr; gap: 20px; padding-top: 16px; }
          .listing-info h1 { font-size: 24px; }
          .listing-detail { padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); overflow-x: hidden; }
        }
      `}</style>
    </div>
  );
}
