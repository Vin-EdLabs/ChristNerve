import { useState } from 'react';
import { Check, ShoppingBag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCachedQuery } from '../../utils/useCachedQuery';

interface SellerRequest {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  department?: string | null;
  seller_requested_at?: string | null;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function SellerRequestsPage() {
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: requests = [], loading, setData } = useCachedQuery<SellerRequest[]>(
    'seller-requests',
    async () => {
      try {
        const res = await api.get('/market/seller-requests', { params: { status: 'pending' } });
        return asList<SellerRequest>(res.data);
      } catch {
        toast.error('Failed to load seller requests');
        return [];
      }
    }
  );

  const decide = async (memberId: number, status: 'approved' | 'rejected') => {
    setBusyId(memberId);
    try {
      await api.put(`/market/seller-requests/${memberId}`, { status });
      toast.success(status === 'approved' ? 'Seller approved' : 'Request declined');
      setData((prev) => (prev || []).filter((r) => r.id !== memberId));
    } catch {
      toast.error('Could not update this request');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="seller-requests">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="seller-requests">
      <h2 className="page-heading">Seller Requests</h2>

      {requests.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={22} style={{ color: 'var(--accent)' }} />}
          title="No pending requests"
          description="Members who ask for seller access will show up here."
        />
      ) : (
        <div className="sr-list">
          {requests.map((r) => (
            <div key={r.id} className="sr-row">
              <div className="sr-avatar">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" />
                ) : (
                  <span>{`${r.first_name[0] || ''}${r.last_name[0] || ''}`.toUpperCase()}</span>
                )}
              </div>
              <div className="sr-info">
                <span className="sr-name">
                  {r.first_name} {r.last_name}
                </span>
                <span className="sr-meta">
                  {r.department || 'No department'} · {r.whatsapp || r.phone || 'No contact'}
                </span>
              </div>
              <div className="sr-actions">
                <Button
                  variant="ghost"
                  onClick={() => decide(r.id, 'rejected')}
                  disabled={busyId === r.id}
                >
                  <X size={15} /> Decline
                </Button>
                <Button
                  variant="primary"
                  onClick={() => decide(r.id, 'approved')}
                  loading={busyId === r.id}
                >
                  <Check size={15} /> Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .seller-requests { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 720px; margin: 0 auto; }
        .page-heading {
          font-family: var(--font-display, 'Cormorant Garamond', serif);
          font-size: 28px; font-weight: 600;
        }
        .sr-list {
          display: flex; flex-direction: column; border: 1px solid var(--border);
          border-radius: var(--radius-md); overflow: hidden; background: var(--bg-primary);
        }
        .sr-row { display: flex; align-items: center; gap: 12px; padding: 14px; flex-wrap: wrap; }
        .sr-row + .sr-row { border-top: 1px solid var(--border); }
        .sr-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
          display: grid; place-items: center; background: var(--accent-light); color: var(--accent);
          font-size: 13px; font-weight: 700;
        }
        .sr-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sr-info { flex: 1; min-width: 160px; display: flex; flex-direction: column; }
        .sr-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .sr-meta { font-size: 12px; color: var(--text-muted); }
        .sr-actions { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
}
