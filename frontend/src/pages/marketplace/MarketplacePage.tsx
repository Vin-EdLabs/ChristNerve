import { useEffect, useState } from 'react';
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
import { useCachedQuery } from '../../utils/useCachedQuery';

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

type ChurchCatPayload = {
  church: ChurchTenant | null;
  categories: MarketCategory[];
};

type ListingsPayload = {
  listings: MarketListing[];
  totalPages: number;
};

export default function MarketplacePage() {
  const slug = getChurchSlug() || 'pka';
  const [params, setParams] = useSearchParams();
  const category = params.get('category');
  const listingType = params.get('type') === 'professional' ? 'professional' : 'product';

  const setListingTypeFilter = (type: 'product' | 'professional') => {
    const next = new URLSearchParams(params);
    if (type === 'professional') next.set('type', 'professional');
    else next.delete('type');
    setParams(next, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [extraListings, setExtraListings] = useState<MarketListing[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const setCategory = (slugValue: string | null) => {
    const next = new URLSearchParams(params);
    if (slugValue) next.set('category', slugValue);
    else next.delete('category');
    setParams(next, { replace: true });
  };

  const { data: churchCatData } = useCachedQuery<ChurchCatPayload>(
    `market-church:${slug}`,
    async () => {
      try {
        const [churchRes, catRes] = await Promise.all([
          api.get(`/public/church/${slug}`),
          api.get('/market/categories'),
        ]);
        return {
          church: churchRes.data?.church ?? churchRes.data ?? null,
          categories: asList<MarketCategory>(catRes.data),
        };
      } catch {
        toast.error('Failed to load marketplace');
        return { church: null, categories: [] };
      }
    },
    [slug]
  );
  const church = churchCatData?.church ?? null;
  const categories = churchCatData?.categories ?? [];

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: page1Data, loading } = useCachedQuery<ListingsPayload>(
    `market-listings:${slug}:${category || ''}:${query}:${listingType}`,
    async () => {
      try {
        const res = await api.get('/market/listings', {
          params: {
            church_slug: slug,
            category: category || undefined,
            search: query || undefined,
            listing_type: listingType,
            page: 1,
            limit: 24,
          },
        });
        return {
          listings: asList<MarketListing>(res.data),
          totalPages: res.data?.pagination?.totalPages ?? 1,
        };
      } catch {
        toast.error('Failed to load listings');
        return { listings: [], totalPages: 1 };
      }
    },
    [slug, category, query, listingType]
  );
  const listings = [...(page1Data?.listings ?? []), ...extraListings];
  const totalPages = page1Data?.totalPages ?? 1;

  useEffect(() => {
    setPage(1);
    setExtraListings([]);
  }, [slug, category, query, listingType]);

  const loadMore = async (pageNum: number) => {
    setLoadingMore(true);
    try {
      const res = await api.get('/market/listings', {
        params: {
          church_slug: slug,
          category: category || undefined,
          search: query || undefined,
          listing_type: listingType,
          page: pageNum,
          limit: 24,
        },
      });
      setExtraListings((prev) => [...prev, ...asList<MarketListing>(res.data)]);
      setPage(pageNum);
    } catch {
      toast.error('Failed to load listings');
    } finally {
      setLoadingMore(false);
    }
  };

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
            Shirts, books, fresh food, drinks, and more — shop goods and
            services from members of the congregation.
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
        <div className="market-type-toggle">
          <button
            type="button"
            className={`market-type-btn${listingType === 'product' ? ' active' : ''}`}
            onClick={() => setListingTypeFilter('product')}
          >
            Products
          </button>
          <button
            type="button"
            className={`market-type-btn${listingType === 'professional' ? ' active' : ''}`}
            onClick={() => setListingTypeFilter('professional')}
          >
            Professionals
          </button>
        </div>

        <CategoryFilter
          categories={categories}
          activeSlug={category}
          onChange={setCategory}
        />

        {!loading && listings.length === 0 ? (
          <EmptyState
            title={
              listingType === 'professional'
                ? 'No professionals listed yet.'
                : 'No listings yet. Encourage members to share their businesses.'
            }
            description={
              listingType === 'professional'
                ? 'When members add their trade or profession, they will show up here.'
                : 'When members list their shops, the whole congregation benefits.'
            }
          />
        ) : (
          <>
            <ListingGrid listings={listings} loading={loading} />
            {page < totalPages && (
              <div className="market-more">
                <Button
                  variant="outline"
                  loading={loadingMore}
                  onClick={() => loadMore(page + 1)}
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
