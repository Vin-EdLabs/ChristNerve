import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, Trash2, X } from 'lucide-react';
import { useCart, type CartItem } from '../../contexts/CartContext';
import { formatGHS, formatPriceRange } from '../../utils/formatGHS';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { WhatsAppButton } from './WhatsAppButton';

function resolveImage(url?: string | null): string {
  return resolveMediaUrl(
    url,
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80'
  );
}

function lineAmount(item: CartItem): number | null {
  if (item.price_min != null && !Number.isNaN(Number(item.price_min))) {
    return Number(item.price_min) * item.qty;
  }
  return null;
}

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

export const CartDrawer: React.FC = () => {
  const navigate = useNavigate();
  const { items, drawerOpen, closeDrawer, updateQty, removeItem } = useCart();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      if (mq.matches) {
        closeDrawer();
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [closeDrawer]);

  useEffect(() => {
    const isPhone = window.matchMedia('(max-width: 768px)').matches;
    if (!drawerOpen || isPhone) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  const knownLines = items
    .map(lineAmount)
    .filter((n): n is number => n != null);
  const subtotal =
    knownLines.length > 0 ? knownLines.reduce((s, n) => s + n, 0) : null;
  const hasUnknown = items.some((i) => lineAmount(i) == null);

  const goCheckout = () => {
    closeDrawer();
    navigate('/market/cart');
  };

  return (
    <div
      className={`cart-drawer-root${drawerOpen ? ' is-open' : ''}`}
      aria-hidden={!drawerOpen}
    >
      <button
        type="button"
        className="cart-drawer-backdrop"
        aria-label="Close shopping bag"
        onClick={closeDrawer}
      />

      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >
        <header className="cart-drawer-head">
          <div>
            <p className="cart-drawer-kicker">Your selection</p>
            <h2 className="cart-drawer-title">Shopping bag</h2>
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            aria-label="Close"
            onClick={closeDrawer}
          >
            <X size={20} />
          </button>
        </header>

        <div className="cart-drawer-list">
          {items.length === 0 ? (
            <p className="cart-drawer-empty">Your bag is empty.</p>
          ) : (
            items.map((item) => {
              const phone = item.whatsapp || item.phone || null;
              const pretty = displayPhone(phone);
              return (
                <article key={item.listingId} className="cart-drawer-item">
                  <Link
                    to={`/market/listing/${item.slug}`}
                    onClick={closeDrawer}
                    className="cart-drawer-thumb"
                  >
                    <img src={resolveImage(item.image)} alt="" />
                  </Link>
                  <div className="cart-drawer-item-main">
                    <div className="cart-drawer-item-top">
                      <Link
                        to={`/market/listing/${item.slug}`}
                        onClick={closeDrawer}
                        className="cart-drawer-item-name"
                      >
                        {item.title}
                      </Link>
                      <span className="cart-drawer-item-price">
                        {formatPriceRange(
                          item.price_min,
                          item.price_max,
                          item.price_label
                        )}
                      </span>
                    </div>
                    <p className="cart-drawer-item-seller">by {item.sellerName}</p>
                    {pretty && (
                      <p className="cart-drawer-wa-num">WhatsApp {pretty}</p>
                    )}
                    <div className="cart-drawer-item-row">
                      <div className="cart-drawer-qty">
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
                        className="cart-drawer-remove"
                        aria-label="Remove"
                        onClick={() => removeItem(item.listingId)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {phone && (
                      <div className="cart-drawer-wa">
                        <WhatsAppButton
                          phone={phone}
                          name={item.sellerName}
                          listingTitle={item.title}
                          size="sm"
                          label="WhatsApp"
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <footer className="cart-drawer-foot">
          <div className="cart-drawer-subtotal">
            <span>Subtotal</span>
            <strong>
              {subtotal != null
                ? formatGHS(subtotal)
                : items.length
                  ? 'Ask vendor'
                  : formatGHS(0)}
            </strong>
          </div>
          {hasUnknown && (
            <p className="cart-drawer-note">
              Some prices are set with the vendor at checkout.
            </p>
          )}
          <p className="cart-drawer-note">
            Vendor WhatsApp unlocks here — finish on checkout.
          </p>
          <button
            type="button"
            className="cart-drawer-checkout"
            disabled={items.length === 0}
            onClick={goCheckout}
          >
            Checkout <ArrowRight size={16} />
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default CartDrawer;
