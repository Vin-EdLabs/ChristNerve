import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Minus, Phone, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatPriceRange } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { WhatsAppButton } from '../../components/marketplace/WhatsAppButton';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import type { MarketListing } from '../../types';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&q=80';

function displayPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('233') && digits.length >= 12) {
    return `0${digits.slice(3, 12)}`;
  }
  if (digits.startsWith('0')) return digits.slice(0, 10);
  return raw;
}

export default function CartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, updateQty, removeItem, clear, lastAddedId } = useCart();
  const { isAuthenticated, accountType } = useAuth();
  const canChat = isAuthenticated && accountType === 'member';
  const focusFromNav = (location.state as { focusListingId?: number } | null)
    ?.focusListingId;
  const focusId = focusFromNav ?? lastAddedId;
  const focusedRef = useRef<HTMLElement | null>(null);
  const [vendorMore, setVendorMore] = useState<MarketListing[]>([]);
  const [vendorSlug, setVendorSlug] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);

  const orderedItems = useMemo(() => {
    if (!focusId) return items;
    const focused = items.filter((i) => Number(i.listingId) === Number(focusId));
    const rest = items.filter((i) => Number(i.listingId) !== Number(focusId));
    return [...focused, ...rest];
  }, [items, focusId]);

  const focusItem = useMemo(() => {
    if (!focusId) return orderedItems[0] || null;
    return (
      orderedItems.find((i) => Number(i.listingId) === Number(focusId)) ||
      orderedItems[0] ||
      null
    );
  }, [orderedItems, focusId]);

  useEffect(() => {
    if (!focusId || !focusedRef.current) return;
    focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusId, orderedItems.length]);

  useEffect(() => {
    if (!focusItem?.slug) {
      setVendorMore([]);
      setVendorSlug(null);
      setVendorName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/market/listings/${focusItem.slug}`);
        if (cancelled) return;
        const more = (res.data?.more_from_seller || []) as MarketListing[];
        const member = res.data?.member;
        setVendorMore(more);
        setVendorSlug(member?.marketplace_slug || focusItem.sellerSlug || null);
        setVendorName(
          member
            ? `${member.first_name} ${member.last_name}`.trim()
            : focusItem.sellerName
        );
      } catch {
        if (!cancelled) {
          setVendorMore([]);
          setVendorSlug(focusItem.sellerSlug || null);
          setVendorName(focusItem.sellerName);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusItem?.slug, focusItem?.sellerName, focusItem?.sellerSlug]);

  const openChat = (item: (typeof items)[0]) => {
    if (!item.listingId) {
      toast.error('This bag item is missing product details');
      return;
    }
    const chatPath = `/market/chat?listing=${item.listingId}`;
    if (!canChat) {
      toast.error(
        'In-app chat is for church members. Use WhatsApp below to message the vendor.'
      );
      if (!isAuthenticated) {
        navigate('/login', { state: { from: chatPath } });
      }
      return;
    }
    navigate(chatPath);
  };

  return (
    <div className="market-page cart-shell">
      <div className="container cart-page">
        {orderedItems.length === 0 ? (
          <>
            <EmptyState
              title="Your bag is empty"
              description="Browse the marketplace and add items to checkout."
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link to="/market">
                <Button>Browse marketplace</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="cart-head">
              <div>
                <p className="cart-kicker">Checkout</p>
                <h1 className="page-title">Your bag</h1>
                <p className="page-sub">
                  Contact each vendor on WhatsApp to complete your order.
                  {canChat
                    ? ' Members can also use in-app chat.'
                    : ' Sign in as a member to use in-app chat.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear all
              </Button>
            </div>

            <div className="cart-list">
              {orderedItems.map((item) => {
                const phone = item.whatsapp || item.phone || null;
                const pretty = displayPhone(phone);
                const isFocused = Number(item.listingId) === Number(focusId);
                return (
                  <article
                    key={item.listingId}
                    ref={isFocused ? focusedRef : undefined}
                    className={`cart-item glass-card${isFocused ? ' cart-item--focus' : ''}`}
                  >
                    <img
                      src={resolveMediaUrl(item.image, PLACEHOLDER)}
                      alt={item.title}
                      className="cart-item-img"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (el.src !== PLACEHOLDER) el.src = PLACEHOLDER;
                      }}
                    />
                    <div className="cart-item-body">
                      {isFocused && (
                        <p className="cart-item-focus-label">Checking out</p>
                      )}
                      <Link
                        to={`/market/listing/${item.slug}`}
                        className="cart-item-title"
                      >
                        {item.title}
                      </Link>
                      <p className="cart-item-seller">
                        by {item.sellerName}
                        {item.sellerSlug && (
                          <>
                            {' · '}
                            <Link to={`/shop/${item.sellerSlug}`}>
                              Browse shop
                            </Link>
                          </>
                        )}
                      </p>
                      <p className="cart-item-price">
                        {formatPriceRange(
                          item.price_min,
                          item.price_max,
                          item.price_label
                        )}
                      </p>

                      <div className="cart-item-row">
                        <div className="cart-qty">
                          <button
                            type="button"
                            aria-label="Decrease"
                            onClick={() => updateQty(item.listingId, item.qty - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase"
                            onClick={() => updateQty(item.listingId, item.qty + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="cart-remove"
                          onClick={() => removeItem(item.listingId)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="cart-vendor-box">
                        <div className="cart-vendor-head">
                          <strong>Vendor contact</strong>
                          {pretty ? (
                            <a href={`tel:${phone}`} className="cart-vendor-phone">
                              <Phone size={14} />
                              {pretty}
                            </a>
                          ) : (
                            <span className="cart-vendor-missing">
                              No WhatsApp on file
                            </span>
                          )}
                        </div>
                        <div className="cart-vendor-actions">
                          {phone && (
                            <WhatsAppButton
                              phone={phone}
                              name={item.sellerName}
                              listingTitle={item.title}
                              size="sm"
                              label="WhatsApp vendor"
                            />
                          )}
                          {canChat && (
                            <Button size="sm" variant="outline" onClick={() => openChat(item)}>
                              <MessageCircle size={14} /> In-app chat
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {(vendorMore.length > 0 || vendorSlug) && (
              <section className="cart-vendor-browse">
                <div className="cart-vendor-browse-head">
                  <div>
                    <p className="cart-vendor-browse-kicker">Keep shopping</p>
                    <h2>
                      More from {vendorName || 'this vendor'}
                    </h2>
                    <p>
                      Browse other items from the same seller before you finish
                      checkout.
                    </p>
                  </div>
                  {vendorSlug && (
                    <Link to={`/shop/${vendorSlug}`} className="btn btn-outline">
                      View full shop →
                    </Link>
                  )}
                </div>
                {vendorMore.length > 0 ? (
                  <div className="cart-vendor-browse-grid">
                    {vendorMore.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                ) : (
                  <p className="cart-vendor-browse-empty">
                    No other active listings right now — check their full shop
                    for updates.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
      <style>{`
        .cart-item--focus {
          outline: 2px solid var(--accent, #2d1b69);
          outline-offset: 2px;
        }
        .cart-item-focus-label {
          margin: 0 0 4px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--accent, #2d1b69);
          font-weight: 600;
        }
        .cart-vendor-browse {
          margin-top: 40px;
          padding: 28px 0 8px;
          border-top: 1px solid var(--border, #e8e4dc);
        }
        .cart-vendor-browse-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 22px;
        }
        .cart-vendor-browse-kicker {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted, #9e9893);
        }
        .cart-vendor-browse-head h2 {
          margin: 0 0 6px;
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
        }
        .cart-vendor-browse-head p {
          margin: 0;
          max-width: 46ch;
          color: var(--text-secondary, #6b6560);
          font-size: 14px;
        }
        .cart-vendor-browse-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }
        .cart-vendor-browse-empty {
          margin: 0;
          padding: 18px;
          border: 1px dashed var(--border, #e8e4dc);
          border-radius: 12px;
          color: var(--text-secondary, #6b6560);
        }
        @media (max-width: 700px) {
          .cart-vendor-browse-head {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
