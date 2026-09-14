import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Two-tier cache shared by every useCachedQuery() call across the app:
 *  - an in-memory Map (fast, survives the unmount/remount React Router does to a page
 *    component on every route switch — that's what lets a revisited page paint its
 *    last-known data instantly instead of blanking to a spinner while it refetches)
 *  - a sessionStorage-backed layer (survives an actual browser refresh/F5, which wipes
 *    the in-memory Map along with the rest of the JS heap; cleared only when the tab
 *    itself closes, so it never serves another day's data on the next visit)
 * Reads always check memory first, then fall back to sessionStorage and warm the Map.
 * Writes go to both. Either layer can be unavailable (private browsing, quota limits)
 * without breaking anything — persistence is best-effort, not a correctness requirement.
 */
const STORAGE_PREFIX = 'cn_cache:';
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function readPersisted<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function writePersisted(key: string, value: unknown) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded, private browsing, or a non-serializable value — memory cache still works */
  }
}

function readCache<T>(key: string): T | undefined {
  if (cache.has(key)) return cache.get(key) as T;
  const persisted = readPersisted<T>(key);
  if (persisted !== undefined) cache.set(key, persisted);
  return persisted;
}

function writeCache(key: string, value: unknown) {
  cache.set(key, value);
  writePersisted(key, value);
}

function hasCache(key: string): boolean {
  return cache.has(key) || readPersisted(key) !== undefined;
}

export interface UseCachedQueryResult<T> {
  data: T | undefined;
  /** True only on a cold cache (nothing in memory or sessionStorage yet) — never true on a revisit or after a refresh of a page seen before this tab session. */
  loading: boolean;
  /** True while a background refetch is running, whether or not this is the first visit. */
  refreshing: boolean;
  error: unknown;
  refetch: () => void;
  /** Optimistically update the cached value in place (e.g. right after a mutation). */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Stale-while-revalidate data fetching: renders cached data immediately — on remount
 * within the app AND after a real page refresh — and silently refetches in the
 * background, so switching pages or reloading the browser never shows a loading
 * flash/skeleton for a page you've already visited this tab session.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseCachedQueryResult<T> {
  const cached = key ? readCache<T>(key) : undefined;
  const [data, setDataState] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(key != null && !hasCache(key));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    if (!key) return;
    const hadCache = hasCache(key);
    setLoading(!hadCache);
    setRefreshing(true);

    let promise = inflight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = fetcherRef.current();
      inflight.set(key, promise);
      promise.finally(() => inflight.delete(key));
    }

    promise
      .then((result) => {
        writeCache(key, result);
        setDataState(result);
        setError(null);
      })
      .catch((err) => {
        if (!hadCache) setError(err);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (key) {
      const existing = readCache<T>(key);
      if (existing !== undefined) setDataState(existing);
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run, ...deps]);

  const setData = useCallback(
    (updater: T | ((prev: T | undefined) => T)) => {
      if (!key) return;
      const next =
        typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(readCache<T>(key)) : updater;
      writeCache(key, next);
      setDataState(next);
    },
    [key]
  );

  return { data, loading, refreshing, error, refetch: run, setData };
}

/** Drop one cached entry (or everything) — call after a mutation that makes cached data stale. */
export function invalidateCachedQuery(key?: string) {
  if (key) {
    cache.delete(key);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
    return;
  }
  cache.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
