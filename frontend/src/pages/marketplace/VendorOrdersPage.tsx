import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';

const uploadsBase = import.meta.env.VITE_UPLOADS_URL || '';
const PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80';

type SellerOrder = {
  id: number;
  listing_title?: string | null;
  listing_slug?: string | null;
  listing_image?: string | null;
  buyer_first_name?: string | null;
  buyer_last_name?: string | null;
  last_message?: string | null;
  unread_count?: number;
  last_message_at?: string | null;
  seller_member_id?: number;
};

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function resolveImage(url?: string | null) {
  if (!url) return PLACEHOLDER;
  if (url.startsWith('http')) return url;
  return `${uploadsBase}${url}`;
}

export default function VendorOrdersPage() {
  const { user, accountType } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SellerOrder[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/conversations');
      const all = asList<SellerOrder>(res.data);
      const mine =
        accountType === 'member'
          ? all.filter((c) => Number(c.seller_member_id) === Number(user?.id))
          : all;
      setOrders(mine);
    } catch {
      toast.error('Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [accountType, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="vendor-orders">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="vendor-orders">
      <div className="vendor-orders-head">
        <h2 className="page-heading">Orders</h2>
        <p className="vendor-orders-sub">
          Buyer chats about your products — open to reply and fulfill.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When someone messages you about a listing, it will show up here."
          actionLabel="My Listings"
          onAction={() => navigate('/market/my-listings')}
        />
      ) : (
        <div className="vendor-orders-list">
          {orders.map((order) => {
            const buyer = [order.buyer_first_name, order.buyer_last_name]
              .filter(Boolean)
              .join(' ') || 'Buyer';
            const when = order.last_message_at
              ? new Date(order.last_message_at).toLocaleString('en-GH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : '';
            return (
              <Link
                key={order.id}
                to={`/market/chat/${order.id}`}
                className="vendor-order-card"
              >
                <div className="vendor-order-img">
                  {order.listing_image ? (
                    <img
                      src={resolveImage(order.listing_image)}
                      alt=""
                    />
                  ) : (
                    <div className="vendor-order-img--empty">
                      <Package size={22} />
                    </div>
                  )}
                </div>
                <div className="vendor-order-body">
                  <div className="vendor-order-top">
                    <h3>{order.listing_title || 'Marketplace inquiry'}</h3>
                    {(order.unread_count || 0) > 0 && (
                      <span className="vendor-order-badge">
                        {order.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="vendor-order-buyer">From {buyer}</p>
                  {order.last_message && (
                    <p className="vendor-order-msg">{order.last_message}</p>
                  )}
                  {when && <p className="vendor-order-time">{when}</p>}
                </div>
                <ChevronRight size={18} className="vendor-order-chevron" />
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .vendor-orders { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 800px; margin: 0 auto; }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }
        .vendor-orders-sub {
          margin: 6px 0 0;
          font-size: 14px;
          color: var(--text-muted, #9e9893);
        }
        .vendor-orders-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .vendor-order-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px;
          background: #fff;
          border: 1px solid var(--border, #e8e4dc);
          border-radius: 14px;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s ease;
        }
        .vendor-order-card:hover { background: #faf9f7; }
        .vendor-order-img {
          width: 64px;
          height: 64px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          background: #f3f1ec;
        }
        .vendor-order-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vendor-order-img--empty {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: var(--text-muted, #9e9893);
        }
        .vendor-order-body { flex: 1; min-width: 0; }
        .vendor-order-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .vendor-order-top h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vendor-order-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: var(--accent, #2d1b69);
          color: #fff;
          font-size: 11px;
          display: inline-grid;
          place-items: center;
          flex-shrink: 0;
        }
        .vendor-order-buyer,
        .vendor-order-msg,
        .vendor-order-time {
          margin: 2px 0 0;
          font-size: 13px;
          color: var(--text-muted, #9e9893);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vendor-order-msg { color: var(--text-secondary, #6b6560); }
        .vendor-order-chevron {
          color: var(--text-muted, #9e9893);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
