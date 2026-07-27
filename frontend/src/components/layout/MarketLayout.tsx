import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  MessageCircle,
  ShoppingCart,
  Store,
} from 'lucide-react';
import api from '../../services/api';
import { getChurchSlug } from '../../utils/tenantHost';
import type { ChurchTenant, MarketCategory } from '../../types';
import { useCart } from '../../contexts/CartContext';
import { PublicNavbar } from './PublicNavbar';
import { CartDrawer } from '../marketplace/CartDrawer';

type Tab = { to: string; label: string; icon: React.ElementType; end?: boolean };

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const d = (payload as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

export const MarketTabBar: React.FC = () => {
  const { count, openDrawer } = useCart();
  const { pathname } = useLocation();

  const tabs: Tab[] = [
    { to: '/market', label: 'Browse', icon: Store, end: true },
    { to: '/market/cart', label: 'Cart', icon: ShoppingCart },
    { to: '/market/chat', label: 'Chat', icon: MessageCircle },
    { to: '/', label: 'Church', icon: Home, end: true },
  ];

  const isTabActive = (to: string) => {
    if (to === '/') return false;
    if (to === '/market') {
      return (
        pathname === '/market' ||
        pathname.startsWith('/market/listing') ||
        pathname.startsWith('/shop/')
      );
    }
    if (to === '/market/chat') return pathname.startsWith('/market/chat');
    if (to === '/market/cart') return pathname.startsWith('/market/cart');
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const onCartClick = (e: React.MouseEvent) => {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    e.preventDefault();
    openDrawer();
  };

  return (
    <nav className="mobile-tabbar market-tabbar" aria-label="Marketplace navigation">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={`${to}-${label}`}
          to={to}
          end={end}
          onClick={to === '/market/cart' ? onCartClick : undefined}
          className={() => `mobile-tab${isTabActive(to) ? ' active' : ''}`}
        >
          <span className="mobile-tab-icon-wrap">
            <Icon size={20} />
            {to === '/market/cart' && count > 0 && (
              <span className="mobile-tab-badge">{count > 9 ? '9+' : count}</span>
            )}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export const MarketLayout: React.FC = () => {
  const slug = getChurchSlug() || 'pka';
  const [tenant, setTenant] = useState<Pick<ChurchTenant, 'name' | 'logo_url'> | null>(
    null
  );
  const [categories, setCategories] = useState<MarketCategory[]>([]);

  useEffect(() => {
    // Clear any stuck body lock from drawer / modals on phone
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [churchRes, catRes] = await Promise.all([
          api.get(`/public/church/${slug}`),
          api.get('/market/categories'),
        ]);
        if (cancelled) return;
        setTenant(churchRes.data?.church ?? churchRes.data ?? null);
        setCategories(asList<MarketCategory>(catRes.data));
      } catch {
        // keep null brand fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="market-shell">
      <PublicNavbar tenant={tenant} categories={categories} />
      <div className="market-shell-body">
        <Outlet context={{ tenant, categories }} />
      </div>
      <MarketTabBar />
      <CartDrawer />
    </div>
  );
};

export default MarketLayout;
