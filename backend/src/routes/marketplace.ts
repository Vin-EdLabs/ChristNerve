import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { upload } from '../middleware/upload';
import { generateSlug } from '../utils/slug';
import { notifyChurchBroadcast } from './notifications';

const router = Router();

async function uniqueListingSlug(base: string, memberId: number): Promise<string> {
  let candidate = `${base}-${memberId}`;
  let attempt = 0;

  while (true) {
    const slug = attempt === 0 ? candidate : `${base}-${memberId}-${attempt}`;
    const result = await pool.query(
      'SELECT id FROM market_listings WHERE slug = $1',
      [slug]
    );
    if (result.rows.length === 0) return slug;
    attempt += 1;
  }
}

/**
 * GET /api/market/categories — public
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM market_categories ORDER BY display_order ASC, name ASC'
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/market/listings — public
 */
router.get('/listings', async (req: Request, res: Response) => {
  try {
    const churchSlug =
      (req.query.church_slug as string) ||
      req.churchTenant?.slug ||
      (typeof req.headers['x-church-slug'] === 'string'
        ? req.headers['x-church-slug']
        : null);

    if (!churchSlug) {
      res.status(400).json({ error: 'church_slug query parameter is required' });
      return;
    }

    const category = req.query.category as string | undefined;
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(String(req.query.limit || '12'), 10) || 12)
    );
    const offset = (page - 1) * limit;

    const tenant = await pool.query(
      'SELECT id FROM church_tenants WHERE slug = $1 AND is_active = true',
      [churchSlug.toLowerCase()]
    );

    if (tenant.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const churchId = tenant.rows[0].id;
    const conditions: string[] = [
      'l.church_id = $1',
      'l.is_active = true',
    ];
    const params: unknown[] = [churchId];
    let idx = 2;

    if (category) {
      conditions.push(`(c.slug = $${idx} OR c.id::text = $${idx})`);
      params.push(category);
      idx += 1;
    }

    if (search) {
      conditions.push(
        `(l.title ILIKE $${idx} OR l.description ILIKE $${idx} OR l.location ILIKE $${idx})`
      );
      params.push(`%${search}%`);
      idx += 1;
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM market_listings l
       LEFT JOIN market_categories c ON c.id = l.category_id
       WHERE ${where}`,
      params
    );

    const dataResult = await pool.query(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
              m.first_name, m.last_name, m.is_verified, m.marketplace_slug, m.avatar_url,
              (
                SELECT image_url FROM market_listing_images i
                WHERE i.listing_id = l.id
                ORDER BY i.is_primary DESC, i.display_order ASC
                LIMIT 1
              ) AS primary_image,
              (
                SELECT COALESCE(AVG(rating), 0)::numeric(3,2)
                FROM market_reviews r WHERE r.listing_id = l.id
              ) AS avg_rating,
              (
                SELECT COUNT(*)::int FROM market_reviews r WHERE r.listing_id = l.id
              ) AS review_count
       FROM market_listings l
       LEFT JOIN market_categories c ON c.id = l.category_id
       JOIN church_members m ON m.id = l.member_id
       WHERE ${where}
       ORDER BY l.is_featured DESC, l.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (err) {
    console.error('List listings error:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

/**
 * GET /api/market/listings/:slug — public, increments views
 */
router.get('/listings/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `UPDATE market_listings
       SET views_count = views_count + 1
       WHERE slug = $1 AND is_active = true
       RETURNING *`,
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    const listing = result.rows[0];

    const [images, category, member, church, reviews, more] = await Promise.all([
      pool.query(
        `SELECT * FROM market_listing_images
         WHERE listing_id = $1
         ORDER BY is_primary DESC, display_order ASC`,
        [listing.id]
      ),
      pool.query('SELECT * FROM market_categories WHERE id = $1', [
        listing.category_id,
      ]),
      pool.query(
        `SELECT id, first_name, last_name, avatar_url, is_verified,
                marketplace_slug, phone, whatsapp, occupation, city, membership_date
         FROM church_members WHERE id = $1`,
        [listing.member_id]
      ),
      pool.query(
        `SELECT id, name, slug, logo_url, tagline, city, denomination
         FROM church_tenants WHERE id = $1`,
        [listing.church_id]
      ),
      pool.query(
        `SELECT r.*, m.first_name, m.last_name
         FROM market_reviews r
         LEFT JOIN church_members m ON m.id = r.reviewer_member_id
         WHERE r.listing_id = $1
         ORDER BY r.created_at DESC`,
        [listing.id]
      ),
      pool.query(
        `SELECT l.id, l.title, l.slug, l.price_min, l.price_max, l.price_label, l.location,
                l.is_featured, l.member_id, l.whatsapp, l.phone,
                c.name AS category_name, c.slug AS category_slug,
                m.first_name, m.last_name, m.is_verified, m.marketplace_slug,
                (
                  SELECT image_url FROM market_listing_images i
                  WHERE i.listing_id = l.id
                  ORDER BY i.is_primary DESC, i.display_order ASC
                  LIMIT 1
                ) AS primary_image
         FROM market_listings l
         LEFT JOIN market_categories c ON c.id = l.category_id
         LEFT JOIN church_members m ON m.id = l.member_id
         WHERE l.member_id = $1 AND l.id <> $2 AND l.is_active = true
         ORDER BY l.is_featured DESC, l.created_at DESC
         LIMIT 12`,
        [listing.member_id, listing.id]
      ),
    ]);

    res.json({
      ...listing,
      images: images.rows,
      category: category.rows[0] || null,
      member: member.rows[0] || null,
      church: church.rows[0] || null,
      reviews: reviews.rows,
      more_from_seller: more.rows,
    });
  } catch (err) {
    console.error('Get listing error:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

/**
 * GET /api/market/storefront/:memberSlug — public
 */
router.get('/storefront/:memberSlug', async (req: Request, res: Response) => {
  try {
    const { memberSlug } = req.params;

    const memberResult = await pool.query(
      `SELECT m.*,
              t.id AS church_id, t.name AS church_name, t.slug AS church_slug,
              t.logo_url AS church_logo, t.tagline AS church_tagline,
              t.city AS church_city, t.denomination AS church_denomination
       FROM church_members m
       JOIN church_tenants t ON t.id = m.church_id
       WHERE m.marketplace_slug = $1`,
      [memberSlug]
    );

    if (memberResult.rows.length === 0) {
      res.status(404).json({ error: 'Storefront not found' });
      return;
    }

    const member = memberResult.rows[0];

    const listings = await pool.query(
      `SELECT l.*,
              c.name AS category_name, c.slug AS category_slug,
              (
                SELECT image_url FROM market_listing_images i
                WHERE i.listing_id = l.id
                ORDER BY i.is_primary DESC, i.display_order ASC
                LIMIT 1
              ) AS primary_image
       FROM market_listings l
       LEFT JOIN market_categories c ON c.id = l.category_id
       WHERE l.member_id = $1 AND l.is_active = true
       ORDER BY l.is_featured DESC, l.created_at DESC`,
      [member.id]
    );

    res.json({
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        avatar_url: member.avatar_url,
        occupation: member.occupation,
        city: member.city,
        is_verified: member.is_verified,
        marketplace_slug: member.marketplace_slug,
        phone: member.phone,
        whatsapp: member.whatsapp,
        membership_date: member.membership_date,
      },
      church: {
        id: member.church_id,
        name: member.church_name,
        slug: member.church_slug,
        logo_url: member.church_logo,
        tagline: member.church_tagline,
        city: member.church_city,
        denomination: member.church_denomination,
      },
      listings: listings.rows,
    });
  } catch (err) {
    console.error('Storefront error:', err);
    res.status(500).json({ error: 'Failed to fetch storefront' });
  }
});

/**
 * GET /api/market/my-listings — protected
 */
router.get(
  '/my-listings',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      let memberId: number | null = null;

      if (req.accountType === 'member') {
        memberId = req.churchUser!.id;
      } else {
        const memberIdParam = req.query.member_id
          ? parseInt(String(req.query.member_id), 10)
          : null;
        if (memberIdParam && !Number.isNaN(memberIdParam)) {
          memberId = memberIdParam;
        }
      }

      if (!memberId) {
        res.json({ data: [], member_id: null });
        return;
      }

      const result = await pool.query(
        `SELECT l.*,
                c.name AS category_name,
                (
                  SELECT image_url FROM market_listing_images i
                  WHERE i.listing_id = l.id
                  ORDER BY i.is_primary DESC, i.display_order ASC
                  LIMIT 1
                ) AS primary_image
         FROM market_listings l
         LEFT JOIN market_categories c ON c.id = l.category_id
         WHERE l.church_id = $1 AND l.member_id = $2
         ORDER BY l.created_at DESC`,
        [churchId, memberId]
      );

      res.json({ data: result.rows, member_id: memberId });
    } catch (err) {
      console.error('My listings error:', err);
      res.status(500).json({ error: 'Failed to fetch your listings' });
    }
  }
);

/**
 * GET /api/market/my-listings/:id — owner (or staff) detail with images
 */
router.get(
  '/my-listings/:id',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid listing id' });
        return;
      }

      const result = await pool.query(
        `SELECT l.*,
                c.name AS category_name,
                (
                  SELECT image_url FROM market_listing_images i
                  WHERE i.listing_id = l.id
                  ORDER BY i.is_primary DESC, i.display_order ASC
                  LIMIT 1
                ) AS primary_image
         FROM market_listings l
         LEFT JOIN market_categories c ON c.id = l.category_id
         WHERE l.id = $1 AND l.church_id = $2`,
        [id, churchId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      const listing = result.rows[0];
      if (
        req.accountType === 'member' &&
        Number(listing.member_id) !== Number(req.churchUser!.id)
      ) {
        res.status(403).json({ error: 'You can only view your own listings' });
        return;
      }

      const images = await pool.query(
        `SELECT * FROM market_listing_images
         WHERE listing_id = $1
         ORDER BY is_primary DESC, display_order ASC`,
        [id]
      );

      res.json({
        ...listing,
        images: images.rows,
        primary_image:
          listing.primary_image || images.rows[0]?.image_url || null,
      });
    } catch (err) {
      console.error('Get my listing error:', err);
      res.status(500).json({ error: 'Failed to fetch listing' });
    }
  }
);

/**
 * POST /api/market/listings — protected
 */
router.post(
  '/listings',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const {
        member_id,
        category_id,
        title,
        description,
        price_min,
        price_max,
        price_label,
        location,
        whatsapp,
        phone,
        is_featured,
      } = req.body;

      if (!title || !description || !whatsapp) {
        res.status(400).json({
          error: 'title, description, and whatsapp are required',
        });
        return;
      }

      let resolvedMemberId: number | null = null;

      if (req.accountType === 'member') {
        resolvedMemberId = req.churchUser!.id;
      } else {
        resolvedMemberId = member_id ? parseInt(String(member_id), 10) : null;
        if (!resolvedMemberId || Number.isNaN(resolvedMemberId)) {
          res.status(400).json({
            error: 'member_id is required when creating a listing as staff',
          });
          return;
        }
        const member = await pool.query(
          'SELECT id FROM church_members WHERE id = $1 AND church_id = $2',
          [resolvedMemberId, churchId]
        );
        if (member.rows.length === 0) {
          res.status(404).json({ error: 'Member not found in this church' });
          return;
        }
      }

      const listingMemberId = resolvedMemberId as number;
      const baseSlug = generateSlug(title) || 'listing';
      const slug = await uniqueListingSlug(baseSlug, listingMemberId);

      const result = await pool.query(
        `INSERT INTO market_listings (
           church_id, member_id, category_id, title, description,
           price_min, price_max, price_label, location, whatsapp, phone,
           is_featured, slug
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),$13)
         RETURNING *`,
        [
          churchId,
          listingMemberId,
          category_id || null,
          title,
          description,
          price_min ?? null,
          price_max ?? null,
          price_label || null,
          location || null,
          whatsapp,
          phone || null,
          is_featured !== undefined ? is_featured : null,
          slug,
        ]
      );

      const listing = result.rows[0];

      try {
        const seller = await pool.query(
          `SELECT first_name, last_name FROM church_members WHERE id = $1`,
          [listingMemberId]
        );
        const name = seller.rows[0]
          ? `${seller.rows[0].first_name} ${seller.rows[0].last_name}`.trim()
          : 'A member';
        await notifyChurchBroadcast({
          churchId,
          title: 'New marketplace listing',
          body: `${name} posted “${title}” — check it out in the market.`,
          link: `/market/listing/${listing.slug || listing.id}`,
        });
      } catch (notifyErr) {
        console.warn('Listing notify failed:', notifyErr);
      }

      res.status(201).json(listing);
    } catch (err) {
      console.error('Create listing error:', err);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

/**
 * PUT /api/market/listings/:id — protected
 */
router.put(
  '/listings/:id',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid listing id' });
        return;
      }

      const existing = await pool.query(
        'SELECT * FROM market_listings WHERE id = $1 AND church_id = $2',
        [id, churchId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      const cur = existing.rows[0];
      if (
        req.accountType === 'member' &&
        Number(cur.member_id) !== Number(req.churchUser!.id)
      ) {
        res.status(403).json({ error: 'You can only edit your own listings' });
        return;
      }

      const b = req.body;

      const result = await pool.query(
        `UPDATE market_listings SET
           category_id = $1,
           title = $2,
           description = $3,
           price_min = $4,
           price_max = $5,
           price_label = $6,
           location = $7,
           whatsapp = $8,
           phone = $9,
           is_active = $10,
           is_featured = $11,
           updated_at = NOW()
         WHERE id = $12 AND church_id = $13
         RETURNING *`,
        [
          b.category_id !== undefined ? b.category_id : cur.category_id,
          b.title ?? cur.title,
          b.description ?? cur.description,
          b.price_min !== undefined ? b.price_min : cur.price_min,
          b.price_max !== undefined ? b.price_max : cur.price_max,
          b.price_label !== undefined ? b.price_label : cur.price_label,
          b.location !== undefined ? b.location : cur.location,
          b.whatsapp ?? cur.whatsapp,
          b.phone !== undefined ? b.phone : cur.phone,
          b.is_active !== undefined ? b.is_active : cur.is_active,
          b.is_featured !== undefined ? b.is_featured : cur.is_featured,
          id,
          churchId,
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update listing error:', err);
      res.status(500).json({ error: 'Failed to update listing' });
    }
  }
);

/**
 * DELETE /api/market/listings/:id — protected (soft: deactivate)
 */
router.delete(
  '/listings/:id',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid listing id' });
        return;
      }

      const existing = await pool.query(
        'SELECT id, member_id FROM market_listings WHERE id = $1 AND church_id = $2',
        [id, churchId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      if (
        req.accountType === 'member' &&
        Number(existing.rows[0].member_id) !== Number(req.churchUser!.id)
      ) {
        res.status(403).json({ error: 'You can only remove your own listings' });
        return;
      }

      const result = await pool.query(
        `UPDATE market_listings
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND church_id = $2
         RETURNING *`,
        [id, churchId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      res.json({ message: 'Listing deactivated', listing: result.rows[0] });
    } catch (err) {
      console.error('Delete listing error:', err);
      res.status(500).json({ error: 'Failed to delete listing' });
    }
  }
);

/**
 * POST /api/market/listings/:id/images — protected, multer array 5
 */
router.post(
  '/listings/:id/images',
  requireChurchTenant,
  requireChurchAuth,
  upload.array('images', 5),
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);
      const files = req.files as Express.Multer.File[];

      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid listing id' });
        return;
      }

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'At least one image is required' });
        return;
      }

      const listing = await pool.query(
        'SELECT id, member_id FROM market_listings WHERE id = $1 AND church_id = $2',
        [id, churchId]
      );

      if (listing.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      if (
        req.accountType === 'member' &&
        Number(listing.rows[0].member_id) !== Number(req.churchUser!.id)
      ) {
        res.status(403).json({ error: 'You can only upload images to your own listings' });
        return;
      }

      const existingCount = await pool.query(
        'SELECT COUNT(*)::int AS count FROM market_listing_images WHERE listing_id = $1',
        [id]
      );
      const startOrder = existingCount.rows[0].count;
      const hasPrimary = await pool.query(
        'SELECT id FROM market_listing_images WHERE listing_id = $1 AND is_primary = true',
        [id]
      );

      const inserted = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = `/uploads/church/${file.filename}`;
        const isPrimary = hasPrimary.rows.length === 0 && i === 0;

        const row = await pool.query(
          `INSERT INTO market_listing_images (listing_id, image_url, is_primary, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [id, imageUrl, isPrimary, startOrder + i]
        );
        inserted.push(row.rows[0]);
      }

      res.status(201).json({ data: inserted });
    } catch (err) {
      console.error('Upload images error:', err);
      res.status(500).json({ error: 'Failed to upload images' });
    }
  }
);

/**
 * POST /api/market/reviews — protected
 */
router.post(
  '/reviews',
  requireChurchTenant,
  requireChurchAuth,
  async (req: Request, res: Response) => {
    try {
      const churchId = req.churchTenant!.id;
      const { listing_id, rating, comment, reviewer_member_id } = req.body;

      if (!listing_id || !rating) {
        res.status(400).json({ error: 'listing_id and rating are required' });
        return;
      }

      const ratingNum = parseInt(String(rating), 10);
      if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        res.status(400).json({ error: 'rating must be between 1 and 5' });
        return;
      }

      const listing = await pool.query(
        'SELECT id FROM market_listings WHERE id = $1 AND church_id = $2',
        [listing_id, churchId]
      );

      if (listing.rows.length === 0) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      let reviewerId = reviewer_member_id
        ? parseInt(String(reviewer_member_id), 10)
        : null;

      if (!reviewerId || Number.isNaN(reviewerId)) {
        const first = await pool.query(
          `SELECT id FROM church_members
           WHERE church_id = $1 AND membership_status = 'active'
           ORDER BY id ASC LIMIT 1`,
          [churchId]
        );
        reviewerId = first.rows[0]?.id || null;
      }

      const result = await pool.query(
        `INSERT INTO market_reviews (listing_id, reviewer_member_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (listing_id, reviewer_member_id)
         DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
         RETURNING *`,
        [listing_id, reviewerId, ratingNum, comment || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create review error:', err);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

export default router;
