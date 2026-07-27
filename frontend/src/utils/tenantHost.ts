/**
 * Tenant host helpers for ChristNerve multi-tenant routing.
 *
 * Production:
 *   christnerve.scholarnerve.com        → platform landing + /admin
 *   ch-pka.scholarnerve.com             → church tenant "pka"
 *
 * Local (no real subdomains):
 *   http://localhost:5174               → landing
 *   http://localhost:5174?church=pka    → church "pka"
 *   http://localhost:5174/market?church=pka
 *   http://localhost:5174/admin         → superadmin
 */

const CHURCH_SLUG_KEY = 'christnerve_church_slug';

function hostname(): string {
  return window.location.hostname.toLowerCase();
}

export const isLocalHost = (): boolean => {
  const host = hostname();
  return host === 'localhost' || host === '127.0.0.1';
};

export const getRootDomain = (): string => {
  const host = hostname();
  if (isLocalHost()) return 'localhost';
  if (host.endsWith('.scholarnerve.com')) return 'scholarnerve.com';
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return host || 'localhost';
};

export function rememberChurchSlug(slug: string | null): void {
  if (!slug) {
    sessionStorage.removeItem(CHURCH_SLUG_KEY);
    return;
  }
  sessionStorage.setItem(CHURCH_SLUG_KEY, slug.trim().toLowerCase());
}

export function clearChurchSlug(): void {
  sessionStorage.removeItem(CHURCH_SLUG_KEY);
}

function slugFromProductionHost(): string | null {
  const host = hostname();
  if (!host.includes('scholarnerve.com')) return null;
  const subdomain = host.split('.')[0] || '';
  if (!subdomain.startsWith('ch-')) return null;
  const slug = subdomain.slice(3).trim().toLowerCase();
  return slug || null;
}

/** Church slug from ch-* host (prod) or ?church= / session (local). */
export const getChurchSlug = (): string | null => {
  const fromHost = slugFromProductionHost();
  if (fromHost) {
    rememberChurchSlug(fromHost);
    return fromHost;
  }

  if (!isLocalHost()) return null;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('church')?.trim().toLowerCase() || null;
  if (fromQuery) {
    rememberChurchSlug(fromQuery);
    return fromQuery;
  }

  return sessionStorage.getItem(CHURCH_SLUG_KEY)?.trim().toLowerCase() || null;
};

/**
 * Platform = landing / superadmin (no church tenant).
 * Local: `/admin` always platform.
 * Local: bare `/` (no ?church=) is always the marketing landing.
 * Local: other paths keep church mode when session has a slug or church token.
 */
export const isPlatformHost = (): boolean => {
  const host = hostname();
  const path = window.location.pathname;

  if (host.startsWith('christnerve')) return true;
  if (path.startsWith('/admin') || path.startsWith('/superadmin')) return true;

  if (isLocalHost()) {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('church')?.trim().toLowerCase();
    if (fromQuery) {
      rememberChurchSlug(fromQuery);
      return false;
    }

    // Explicit marketing landing — never treat as church portal
    if (path === '/' || path === '') {
      return true;
    }

    const sessionSlug = sessionStorage.getItem(CHURCH_SLUG_KEY)?.trim().toLowerCase();
    const hasChurchToken = Boolean(localStorage.getItem('church_token'));
    return !sessionSlug && !hasChurchToken;
  }

  return !slugFromProductionHost();
};

export const isLandingPage = (): boolean => {
  const host = hostname();
  if (host.startsWith('christnerve')) {
    return window.location.pathname === '/' || window.location.pathname === '';
  }
  if (isLocalHost()) {
    const hasChurch = Boolean(
      new URLSearchParams(window.location.search).get('church')
    );
    return (
      !hasChurch &&
      (window.location.pathname === '/' || window.location.pathname === '')
    );
  }
  return false;
};

/** Public URL for a church (prod subdomain or local ?church=). */
export const churchDomainUrl = (slug: string, path = '/'): string => {
  const cleanSlug = slug.trim().toLowerCase();
  const [rawPath, rawSearch] = path.split('?');
  let pathname = rawPath || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  if (isLocalHost()) {
    const port = window.location.port ? `:${window.location.port}` : '';
    const params = new URLSearchParams(rawSearch || '');
    params.set('church', cleanSlug);
    return `${window.location.protocol}//localhost${port}${pathname}?${params.toString()}`;
  }

  const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:';
  const search = rawSearch ? `?${rawSearch}` : '';
  return `${protocol}//ch-${cleanSlug}.${getRootDomain()}${pathname}${search}`;
};

export const platformDomainUrl = (path = '/'): string => {
  let pathname = path || '/';
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  if (isLocalHost()) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//localhost${port}${pathname}`;
  }

  const protocol = window.location.protocol === 'http:' ? 'http:' : 'https:';
  return `${protocol}//christnerve.${getRootDomain()}${pathname}`;
};

export const goToChurchHost = (slug: string, path = '/login'): void => {
  rememberChurchSlug(slug);
  window.location.href = churchDomainUrl(slug, path);
};

export const churchHostLabel = (slug: string): string =>
  `ch-${slug.trim().toLowerCase()}.scholarnerve.com`;

/** @deprecated prefer goToChurchHost */
export const setDevChurchMode = (enabled: boolean, slug = 'pka'): void => {
  if (enabled) {
    goToChurchHost(slug, '/login');
  } else {
    clearChurchSlug();
    window.location.href = platformDomainUrl('/');
  }
};
