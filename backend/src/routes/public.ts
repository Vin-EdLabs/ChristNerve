import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { generateSlug } from '../utils/slug';
import { upload, uploadedFilePublicUrl } from '../middleware/upload';

const router = Router();

const RESERVED_SLUGS = new Set([
  'christnerve',
  'app',
  'www',
  'api',
  'admin',
  'market',
  'shop',
  'localhost',
]);

function normalizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * POST /api/public/register-church
 * Self-serve church registration (pending until super-admin reviews).
 * multipart/form-data: church fields + optional logo file field "logo"
 * No pastor account is created here.
 */
router.post('/register-church', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const tagline = String(body.tagline || '').trim();
    const city = String(body.city || '').trim();
    const region = String(body.region || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim() || null;

    if (!name || !tagline || !city || !region || !phone || !email) {
      res.status(400).json({
        error: 'Please fill church name, tagline, city, region, phone, and email',
      });
      return;
    }

    let churchSlug = normalizeSlug(body.slug || generateSlug(name));
    if (!churchSlug || churchSlug.length < 2) {
      churchSlug = `church-${Date.now().toString(36)}`;
    }
    if (RESERVED_SLUGS.has(churchSlug)) {
      churchSlug = `${churchSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Ensure unique slug
    const existing = await pool.query(
      'SELECT id FROM church_tenants WHERE slug = $1',
      [churchSlug]
    );
    if (existing.rows.length > 0) {
      churchSlug = `${churchSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    const logoUrl = uploadedFilePublicUrl(req.file) || null;

    const result = await pool.query(
      `INSERT INTO church_tenants (
         name, slug, tagline, logo_url, address, city, region, phone, email,
         subscription_plan, subscription_status, is_active
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,'starter','pending', false
       )
       RETURNING id, name, slug, logo_url, city, region, phone, email, tagline,
                 subscription_status, is_active, created_at`,
      [
        name,
        churchSlug,
        tagline,
        logoUrl,
        address,
        city,
        region,
        phone,
        email,
      ]
    );

    const church = result.rows[0];

    res.status(201).json({
      ok: true,
      message:
        'Registration received. ChristNerve will review your request shortly.',
      church: {
        id: church.id,
        name: church.name,
        slug: church.slug,
        logo_url: church.logo_url,
        status: 'pending',
      },
    });
  } catch (err: unknown) {
    console.error('Register church error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({
        error: 'A church with this name or domain is already registered',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to register church' });
  }
});

/**
 * GET /api/public/fcm-config
 * Public Web Push VAPID key so every tenant host can register for FCM.
 */
router.get('/fcm-config', (_req: Request, res: Response) => {
  const vapidKey =
    process.env.FIREBASE_WEB_VAPID_KEY?.trim() ||
    process.env.VITE_FIREBASE_VAPID_KEY?.trim() ||
    '';
  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID || 'christnerve',
    vapidKey: vapidKey || null,
    configured: Boolean(vapidKey),
  });
});

/**
 * GET /api/public/manifest
 * Dynamic PWA manifest — church branding when on a tenant host.
 */
router.get('/manifest', async (req: Request, res: Response) => {
  try {
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
    const parts = host.split('.').filter(Boolean);
    const subdomain = parts.length >= 2 ? parts[0] : '';

    let churchSlug: string | null = null;
    if (subdomain.startsWith('ch-')) {
      churchSlug = subdomain.slice(3).trim().toLowerCase() || null;
    }

    const headerSlug = req.headers['x-church-slug'];
    if (!churchSlug && typeof headerSlug === 'string' && headerSlug.trim()) {
      churchSlug = headerSlug.trim().toLowerCase();
    }

    const querySlug = req.query.church;
    if (!churchSlug && typeof querySlug === 'string' && querySlug.trim()) {
      churchSlug = querySlug.trim().toLowerCase();
    }

    let church: {
      name: string;
      slug: string;
      logo_url?: string | null;
      brand_color?: string | null;
      short_name?: string | null;
    } | null = null;

    if (churchSlug) {
      const result = await pool.query(
        `SELECT name, slug, logo_url, brand_color, short_name
         FROM church_tenants
         WHERE slug = $1 AND is_active = true`,
        [churchSlug]
      );
      church = result.rows[0] || null;
    }

    const proto = String(
      req.headers['x-forwarded-proto'] || req.protocol || 'https'
    ).split(',')[0].trim();
    const origin = `${proto}://${hostHeader || 'localhost'}`;

    const absolute = (pathOrUrl: string) => {
      if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
      if (pathOrUrl.startsWith('/')) return `${origin}${pathOrUrl}`;
      return `${origin}/${pathOrUrl.replace(/^\//, '')}`;
    };

    const defaultIcons = [
      {
        src: absolute('/logo.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: absolute('/logo.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: absolute('/logo.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ];

    if (!church) {
      res
        .status(200)
        .set('Content-Type', 'application/manifest+json')
        .set('Cache-Control', 'public, max-age=300')
        .json({
          name: 'ChristNerve',
          short_name: 'ChristNerve',
          description: 'The Nerve System of Your Church.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#FFFFFF',
          theme_color: '#2D1B69',
          icons: defaultIcons,
        });
      return;
    }

    const appName = church.name;
    const shortName =
      church.short_name ||
      church.name.split(/\s+/).slice(0, 2).join(' ') ||
      church.name;
    const themeColor = church.brand_color || '#2D1B69';
    const logoSrc = church.logo_url
      ? absolute(church.logo_url)
      : absolute('/logo.png');

    res
      .status(200)
      .set('Content-Type', 'application/manifest+json')
      .set('Cache-Control', 'public, max-age=3600')
      .json({
        name: appName,
        short_name: shortName.slice(0, 12),
        description: `${appName} — Powered by ChristNerve`,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFFFFF',
        theme_color: themeColor,
        categories: ['religion', 'productivity'],
        icons: [
          { src: logoSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: logoSrc, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: logoSrc, sizes: '180x180', type: 'image/png', purpose: 'any' },
          {
            src: logoSrc,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        prefer_related_applications: false,
      });
  } catch (err) {
    console.error('Manifest error:', err);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
});

/**
 * GET /api/public/church/:slug
 */
router.get('/church/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.toLowerCase();

    const churchResult = await pool.query(
      `SELECT id, name, slug, tagline, description, logo_url, banner_url,
              address, city, region, phone, email, denomination, founded_year,
              brand_color, secondary_color, short_name
       FROM church_tenants
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (churchResult.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const church = churchResult.rows[0];

    const [events, listings, memberCount] = await Promise.all([
      pool.query(
        `SELECT id, title, description, event_type, start_datetime, end_datetime,
                location, banner_url
         FROM church_events
         WHERE church_id = $1 AND is_public = true AND start_datetime >= NOW()
         ORDER BY start_datetime ASC
         LIMIT 5`,
        [church.id]
      ),
      pool.query(
        `SELECT l.id, l.title, l.slug, l.price_min, l.price_max, l.price_label,
                l.location, l.is_featured,
                c.name AS category_name,
                m.first_name, m.last_name, m.is_verified,
                (
                  SELECT image_url FROM market_listing_images i
                  WHERE i.listing_id = l.id
                  ORDER BY i.is_primary DESC, i.display_order ASC
                  LIMIT 1
                ) AS primary_image
         FROM market_listings l
         LEFT JOIN market_categories c ON c.id = l.category_id
         JOIN church_members m ON m.id = l.member_id
         WHERE l.church_id = $1 AND l.is_active = true
         ORDER BY l.is_featured DESC, l.views_count DESC
         LIMIT 6`,
        [church.id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM church_members
         WHERE church_id = $1 AND membership_status = 'active'`,
        [church.id]
      ),
    ]);

    res.json({
      church,
      upcoming_events: events.rows,
      featured_listings: listings.rows,
      member_count: memberCount.rows[0].total,
    });
  } catch (err) {
    console.error('Public church error:', err);
    res.status(500).json({ error: 'Failed to fetch church profile' });
  }
});

/**
 * GET /api/public/church/:slug/events
 */
router.get('/church/:slug/events', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.toLowerCase();

    const church = await pool.query(
      'SELECT id FROM church_tenants WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (church.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const events = await pool.query(
      `SELECT id, title, description, event_type, start_datetime, end_datetime,
              location, banner_url
       FROM church_events
       WHERE church_id = $1 AND is_public = true AND start_datetime >= NOW() - INTERVAL '1 day'
       ORDER BY start_datetime ASC`,
      [church.rows[0].id]
    );

    res.json({ data: events.rows });
  } catch (err) {
    console.error('Public events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/public/church/:slug/market
 */
router.get('/church/:slug/market', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug.toLowerCase();

    const church = await pool.query(
      `SELECT id, name, slug, logo_url, tagline, city
       FROM church_tenants WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (church.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const churchId = church.rows[0].id;

    const [categoryCounts, featured, totals] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.slug, c.icon, COUNT(l.id)::int AS listing_count
         FROM market_categories c
         LEFT JOIN market_listings l
           ON l.category_id = c.id AND l.church_id = $1 AND l.is_active = true
         GROUP BY c.id, c.name, c.slug, c.icon, c.display_order
         HAVING COUNT(l.id) > 0
         ORDER BY c.display_order ASC`,
        [churchId]
      ),
      pool.query(
        `SELECT l.id, l.title, l.slug, l.price_min, l.price_max, l.price_label,
                l.location, l.is_featured, l.views_count,
                c.name AS category_name,
                m.first_name, m.last_name, m.is_verified,
                (
                  SELECT image_url FROM market_listing_images i
                  WHERE i.listing_id = l.id
                  ORDER BY i.is_primary DESC, i.display_order ASC
                  LIMIT 1
                ) AS primary_image
         FROM market_listings l
         LEFT JOIN market_categories c ON c.id = l.category_id
         JOIN church_members m ON m.id = l.member_id
         WHERE l.church_id = $1 AND l.is_active = true
         ORDER BY l.is_featured DESC, l.created_at DESC
         LIMIT 8`,
        [churchId]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE is_active = true)::int AS active_listings,
           COUNT(*) FILTER (WHERE is_featured = true AND is_active = true)::int AS featured_count,
           COUNT(DISTINCT member_id) FILTER (WHERE is_active = true)::int AS seller_count
         FROM market_listings
         WHERE church_id = $1`,
        [churchId]
      ),
    ]);

    res.json({
      church: church.rows[0],
      categories: categoryCounts.rows,
      featured_listings: featured.rows,
      summary: totals.rows[0],
    });
  } catch (err) {
    console.error('Public market error:', err);
    res.status(500).json({ error: 'Failed to fetch marketplace summary' });
  }
});

export default router;
