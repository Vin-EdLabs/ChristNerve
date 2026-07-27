import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Menu, MessageCircle, ShoppingBag, X } from 'lucide-react';
import type { ChurchTenant, MarketCategory } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export interface PublicNavbarProps {
  tenant?: Pick<ChurchTenant, 'name' | 'logo_url'> | null;
  categories?: MarketCategory[];
}

/** Fixed market header — menu lists all categories. */
export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  tenant,
  categories = [],
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const activeCategory = params.get('category');
  const { count, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const logoSrc = resolveMediaUrl(tenant?.logo_url);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const openCart = () => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      navigate('/market/cart');
      return;
    }
    openDrawer();
  };

  const goCategory = (slug: string | null) => {
    setMenuOpen(false);
    if (!slug) {
      navigate('/market');
      return;
    }
    navigate(`/market?category=${encodeURIComponent(slug)}`);
  };

  const chatActive = pathname.startsWith('/market/chat');
  const homeActive = pathname === '/' || pathname === '';

  return (
    <header className="public-navbar public-navbar--fixed">
      <div className="public-navbar-inner" ref={menuRef}>
        <button
          type="button"
          className="topbar-icon-btn"
          aria-label={menuOpen ? 'Close categories' : 'Open categories'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <Link to="/market" className="public-navbar-brand public-navbar-brand--center">
          {logoSrc ? (
            <img src={logoSrc} alt="" className="public-navbar-logo" />
          ) : (
            <div className="public-navbar-logo public-navbar-logo--fallback" aria-hidden>
              ✝
            </div>
          )}
          <span className="public-navbar-name">
            {tenant?.name || 'Marketplace'}
          </span>
        </Link>

        <div className="public-navbar-actions">
          <nav className="public-navbar-desktop-links" aria-label="Marketplace links">
            <Link
              to="/"
              className={`public-navbar-link${homeActive ? ' is-active' : ''}`}
            >
              <Home size={16} />
              Home
            </Link>
            <Link to="/visit" className="public-navbar-link">
              Visit church
            </Link>
            <Link
              to="/market/chat"
              className={`public-navbar-link${chatActive ? ' is-active' : ''}`}
            >
              <MessageCircle size={16} />
              Chat
            </Link>
          </nav>
          <button
            type="button"
            className="topbar-icon-btn public-navbar-bag"
            aria-label="Shopping bag"
            onClick={openCart}
          >
            <ShoppingBag size={18} />
            {count > 0 && (
              <span className="public-navbar-bag-badge">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        </div>

        {menuOpen && (
          <div
            className="public-navbar-menu public-navbar-menu--panel public-navbar-menu--categories"
            role="menu"
          >
            <p className="public-navbar-menu-title">Categories</p>
            <button
              type="button"
              className={`public-navbar-menu-item${!activeCategory ? ' is-active' : ''}`}
              onClick={() => goCategory(null)}
            >
              All products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`public-navbar-menu-item${
                  activeCategory === cat.slug ? ' is-active' : ''
                }`}
                onClick={() => goCategory(cat.slug)}
              >
                {cat.name}
              </button>
            ))}
            <div className="public-navbar-menu-divider" />
            <Link
              to="/"
              className="public-navbar-menu-item public-navbar-menu-item--mobile-only"
              onClick={() => setMenuOpen(false)}
            >
              <Home size={16} /> Portal home
            </Link>
            <Link
              to="/visit"
              className="public-navbar-menu-item"
              onClick={() => setMenuOpen(false)}
            >
              Visit church
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default PublicNavbar;
