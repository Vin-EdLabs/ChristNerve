import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

export interface ChurchTenant {
  id: number;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  city?: string;
  region?: string;
  phone?: string;
  email?: string;
  denomination?: string;
  founded_year?: number;
  subscription_plan?: string;
  subscription_status: string;
  subscription_amount?: number;
  next_billing_date?: string;
  is_active: boolean;
  brand_color?: string;
  secondary_color?: string;
  created_at?: string;
  updated_at?: string;
}

declare global {
  namespace Express {
    interface Request {
      churchTenant?: ChurchTenant;
    }
  }
}

function normalizeSlug(value?: string | null): string | null {
  if (!value) return null;
  const slug = String(value).trim().toLowerCase();
  return slug || null;
}

/**
 * Resolve church slug from:
 * 1) Production host ch-{slug}.scholarnerve.com
 * 2) ?church= query (localhost / tools)
 * 3) X-Church-Slug header (SPA → API)
 */
function resolveSlug(req: Request): string | null {
  const hostHeader = String(
    req.headers['x-forwarded-host'] || req.headers.host || ''
  );
  const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  const subdomain = host.split('.')[0] || '';

  const skip = new Set([
    'christnerve',
    'app',
    'www',
    'api',
    'admin',
    'localhost',
    '127',
  ]);

  // Production — ch-pka.scholarnerve.com
  if (!skip.has(subdomain) && subdomain.startsWith('ch-')) {
    return normalizeSlug(subdomain.slice(3));
  }

  // Localhost / tools — ?church=pka
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    const fromQuery = normalizeSlug(req.query.church as string | undefined);
    if (fromQuery) return fromQuery;
  }

  // SPA always sends this when a church is active
  const headerSlug = req.headers['x-church-slug'];
  if (typeof headerSlug === 'string') {
    return normalizeSlug(headerSlug);
  }

  return null;
}

export const resolveChurchTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const churchSlug = resolveSlug(req);

    if (!churchSlug) {
      next();
      return;
    }

    const result = await pool.query(
      'SELECT * FROM church_tenants WHERE slug = $1 AND is_active = true',
      [churchSlug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    req.churchTenant = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

export const requireChurchTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.churchTenant) {
    res.status(400).json({
      error:
        'Church tenant required. Use ch-{slug}.scholarnerve.com, ?church=slug on localhost, or X-Church-Slug header.',
    });
    return;
  }
  next();
};
