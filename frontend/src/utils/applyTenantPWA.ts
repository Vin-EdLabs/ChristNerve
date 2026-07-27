import { resolveMediaUrl } from './mediaUrl';

export interface TenantPWAData {
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  secondary_color?: string | null;
}

export function applyTenantPWA(tenant: TenantPWAData | null | undefined) {
  if (!tenant?.name) return;

  const name = tenant.name;
  const shortName =
    tenant.short_name || name.split(/\s+/).slice(0, 2).join(' ') || name;
  const color = tenant.brand_color || '#2D1B69';
  const secondary = tenant.secondary_color || '#C4A035';
  const logoUrl = resolveMediaUrl(tenant.logo_url, '/logo.png');

  document.title = name;
  document.documentElement.style.setProperty('--church-primary', color);
  document.documentElement.style.setProperty('--church-secondary', secondary);

  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', color);
  }

  const appleTouchIcon = document.getElementById('apple-touch-icon');
  if (appleTouchIcon) {
    appleTouchIcon.setAttribute('href', logoUrl);
  }

  let appleTitle = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (!appleTitle) {
    appleTitle = document.createElement('meta');
    appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
    document.head.appendChild(appleTitle);
  }
  appleTitle.setAttribute('content', shortName);

  const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
  if (favicon) {
    favicon.href = logoUrl;
  }

  let manifest = document.querySelector(
    'link[rel="manifest"]'
  ) as HTMLLinkElement | null;
  if (!manifest) {
    manifest = document.createElement('link');
    manifest.rel = 'manifest';
    document.head.appendChild(manifest);
  }
  // Bust cache when tenant branding changes
  manifest.href = `/api/public/manifest?v=${encodeURIComponent(tenant.name)}`;
}

export function applyDefaultPWA() {
  document.title = 'ChristNerve';
  const themeColorMeta = document.getElementById('theme-color-meta');
  if (themeColorMeta) themeColorMeta.setAttribute('content', '#2D1B69');
  const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
  if (favicon) favicon.href = '/logo.png';
  const apple = document.getElementById('apple-touch-icon');
  if (apple) apple.setAttribute('href', '/logo.png');
  let appleTitle = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (appleTitle) appleTitle.setAttribute('content', 'ChristNerve');
  const manifest = document.querySelector(
    'link[rel="manifest"]'
  ) as HTMLLinkElement | null;
  if (manifest) manifest.href = '/api/public/manifest?v=christnerve';
}
