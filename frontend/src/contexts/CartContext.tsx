import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { MarketListing } from '../types';
import { resolveMediaUrl } from '../utils/mediaUrl';

export interface CartItem {
  listingId: number;
  slug: string;
  title: string;
  price_label?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  image?: string | null;
  sellerName: string;
  sellerSlug?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  memberId?: number | null;
  qty: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  drawerOpen: boolean;
  lastAddedTitle: string | null;
  lastAddedId: number | null;
  addItem: (listing: MarketListing, qty?: number) => void;
  addToBag: (listing: MarketListing, qty?: number) => void;
  checkoutListing: (listing: MarketListing, qty?: number) => void;
  removeItem: (listingId: number) => void;
  updateQty: (listingId: number, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'christnerve_cart';

function isMobileView() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

function listingToItem(listing: MarketListing, qty = 1): CartItem {
  const listingId = Number(listing.id);
  const rawImage =
    listing.primary_image || listing.images?.[0]?.image_url || null;
  return {
    listingId,
    slug: listing.slug,
    title: listing.title,
    price_label: listing.price_label,
    price_min: listing.price_min != null ? Number(listing.price_min) : null,
    price_max: listing.price_max != null ? Number(listing.price_max) : null,
    image: rawImage ? resolveMediaUrl(rawImage) : null,
    sellerName:
      [listing.first_name, listing.last_name].filter(Boolean).join(' ') ||
      'Seller',
    sellerSlug: listing.marketplace_slug || null,
    whatsapp: listing.whatsapp || null,
    phone: listing.phone || null,
    memberId:
      listing.member_id != null ? Number(listing.member_id) : null,
    qty,
  };
}

function upsertItem(prev: CartItem[], listing: MarketListing, qty: number) {
  const listingId = Number(listing.id);
  const existing = prev.find((i) => Number(i.listingId) === listingId);
  if (existing) {
    return prev.map((i) =>
      Number(i.listingId) === listingId
        ? {
            ...listingToItem(listing, Math.min(99, i.qty + qty)),
          }
        : i
    );
  }
  return [...prev, listingToItem(listing, qty)];
}

function normalizeStored(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Partial<CartItem>;
      const listingId = Number(r.listingId);
      if (!listingId || !r.slug || !r.title) return null;
      return {
        listingId,
        slug: String(r.slug),
        title: String(r.title),
        price_label: r.price_label ?? null,
        price_min: r.price_min != null ? Number(r.price_min) : null,
        price_max: r.price_max != null ? Number(r.price_max) : null,
        image: r.image ? resolveMediaUrl(r.image) : null,
        sellerName: r.sellerName || 'Seller',
        sellerSlug: r.sellerSlug ?? null,
        whatsapp: r.whatsapp ?? null,
        phone: r.phone ?? null,
        memberId: r.memberId != null ? Number(r.memberId) : null,
        qty: Math.max(1, Math.min(99, Number(r.qty) || 1)),
      } as CartItem;
    })
    .filter(Boolean) as CartItem[];
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return normalizeStored(JSON.parse(raw));
    } catch {
      return [];
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAddedTitle, setLastAddedTitle] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((listing: MarketListing, qty = 1) => {
    if (!listing?.id || !listing.slug) return;
    flushSync(() => {
      setItems((prev) => upsertItem(prev, listing, qty));
      setLastAddedTitle(listing.title);
      setLastAddedId(Number(listing.id));
    });
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  /** Add item + laptop bag drawer / phone checkout. */
  const addToBag = useCallback(
    (listing: MarketListing, qty = 1) => {
      addItem(listing, qty);
      if (isMobileView()) {
        setDrawerOpen(false);
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        toast.success(`${listing.title} added`);
        navigate('/market/cart', {
          state: { focusListingId: Number(listing.id) },
        });
      } else {
        toast.success(`${listing.title} added to bag.`);
        setDrawerOpen(true);
      }
    },
    [addItem, navigate]
  );

  /** Ensure this listing is in the bag, then open checkout for it. */
  const checkoutListing = useCallback(
    (listing: MarketListing, qty = 1) => {
      addItem(listing, qty);
      setDrawerOpen(false);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      navigate('/market/cart', {
        state: { focusListingId: Number(listing.id) },
      });
    },
    [addItem, navigate]
  );

  const removeItem = useCallback((listingId: number) => {
    const id = Number(listingId);
    setItems((prev) => prev.filter((i) => Number(i.listingId) !== id));
  }, []);

  const updateQty = useCallback((listingId: number, qty: number) => {
    const id = Number(listingId);
    setItems((prev) =>
      prev
        .map((i) =>
          Number(i.listingId) === id
            ? { ...i, qty: Math.max(0, Math.min(99, qty)) }
            : i
        )
        .filter((i) => i.qty > 0)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((s, i) => s + i.qty, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        drawerOpen,
        lastAddedTitle,
        lastAddedId,
        addItem,
        addToBag,
        checkoutListing,
        removeItem,
        updateQty,
        clear,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
