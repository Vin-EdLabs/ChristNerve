import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Minus, Phone, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatPriceRange } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { WhatsAppButton } from '../../components/marketplace/WhatsAppButton';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80';

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
  const { isAuthenticated } = useAuth();
  const focusFromNav = (location.state as { focusListingId?: number } | null)
    ?.focusListingId;
  const focusId = focusFromNav ?? lastAddedId;
  const focusedRef = useRef<HTMLElement | null>(null);

  const orderedItems = useMemo(() => {
    if (!focusId) return items;
    const focused = items.filter((i) => Number(i.listingId) === Number(focusId));
    const rest = items.filter((i) => Number(i.listingId) !== Number(focusId));
    return [...focused, ...rest];
  }, [items, focusId]);

  useEffect(() => {
    if (!focusId || !focusedRef.current) return;
    focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusId, orderedItems.length]);

  const openChat = (item: (typeof items)[0]) => {
    if (!item.listingId) {
      toast.error('This bag item is missing product details');
      return;
    }
    const chatPath = `/market/chat?listing=${item.listingId}`;
    if (!isAuthenticated) {
      toast.error('Sign in to chat with the vendor');
      navigate('/login', { state: { from: chatPath } });
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
                  Contact each vendor with WhatsApp or in-app chat to complete your order.
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
                      <p className="cart-item-seller">by {item.sellerName}</p>
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
                              No phone on file — use in-app chat
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
                          <Button size="sm" variant="outline" onClick={() => openChat(item)}>
                            <MessageCircle size={14} /> In-app chat
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
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
      `}</style>
    </div>
  );
}
