import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getChurchSlug } from '../../utils/tenantHost';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import type { MarketListing, MarketCategory, ChurchTenant } from '../../types';
import { CategoryFilter } from '../../components/marketplace/CategoryFilter';
import { ListingGrid } from '../../components/marketplace/ListingGrid';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';

const CLASSIC_HERO =
  'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=2000&q=80';

function asList<T>(payload: unknown, keys: string[] = ['data']): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export default function MarketplacePage() {
  const slug = getChurchSlug() || 'pka';
  const [params, setParams] = useSearchParams();
  const [church, setChurch] = useState<ChurchTenant | null>(null);
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const category = params.get('category');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const setCategory = (slugValue: string | null) => {
    const next = new URLSearchParams(params);
    if (slugValue) next.set('category', slugValue);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [churchRes, catRes] = await Promise.all([
          api.get(`/public/church/${slug}`),
          api.get('/market/categories'),
        ]);
        if (cancelled) return;
        setChurch(churchRes.data?.church ?? churchRes.data ?? null);
        setCategories(asList<MarketCategory>(catRes.data));
      } catch {
        if (!cancelled) toast.error('Failed to load marketplace');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadListings = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await api.get('/market/listings', {
          params: {
            church_slug: slug,
            category: category || undefined,
            search: query || undefined,
            page: pageNum,
            limit: 12,
          },
        });
        const rows = asList<MarketListing>(res.data);
        const pages = res.data?.pagination?.totalPages ?? 1;
        setTotalPages(pages);
        setPage(pageNum);
        setListings((prev) => (append ? [...prev, ...rows] : rows));
      } catch {
        toast.error('Failed to load listings');
        if (!append) setListings([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [slug, category, query]
  );

  useEffect(() => {
    loadListings(1, false);
  }, [loadListings]);

  const churchName = church?.name || 'our church';
  const heroImage = church?.banner_url
    ? resolveMediaUrl(church.banner_url, CLASSIC_HERO)
    : CLASSIC_HERO;

  return (
    <div className="market-page market-page--shop">
      <section className="market-hero market-hero--classic">
        <div
          className="market-hero-media"
          aria-hidden
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="market-hero-veil" aria-hidden />
        <div className="container market-hero-inner">
          <p className="market-hero-brand">{churchName}</p>
          <span className="market-hero-rule" aria-hidden />
          <h1 className="market-hero-title">Marketplace</h1>
          <p className="market-hero-sub">
            Classic goods and trusted services from members of the congregation.
          </p>
          <div className="market-search">
            <Search size={18} className="market-search-icon" />
            <Input
              placeholder="Search the marketplace…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
            />
          </div>
        </div>
      </section>

      <div className="container market-body" id="market-listings">
        <CategoryFilter
          categories={categories}
          activeSlug={category}
          onChange={setCategory}
        />

        {!loading && listings.length === 0 ? (
          <EmptyState
            title="No listings yet. Encourage members to share their businesses."
            description="When members list their shops, the whole congregation benefits."
          />
        ) : (
          <>
            <ListingGrid listings={listings} loading={loading} />
            {page < totalPages && (
              <div className="market-more">
                <Button
                  variant="outline"
                  loading={loadingMore}
                  onClick={() => loadListings(page + 1, true)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
