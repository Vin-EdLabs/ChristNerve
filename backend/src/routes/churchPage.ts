import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { upload, uploadedFilePublicUrl } from '../middleware/upload';
import { writeAudit } from '../services/audit';
import {
  defaultPinFromPhone,
  hashPin,
  normalizePhone,
} from '../utils/memberPin';
import { generateSlug } from '../utils/slug';

const router = Router();

function canEditVisit(req: Request): boolean {
  if (req.accountType === 'member') return false;
  const role = String(req.churchUser?.role || '').toLowerCase();
  return ['pastor', 'admin', 'super-admin', 'secretary'].includes(role);
}

function canReviewJoins(req: Request): boolean {
  if (req.accountType === 'member') return false;
  const role = String(req.churchUser?.role || '').toLowerCase();
  return ['pastor', 'admin', 'super-admin', 'secretary'].includes(role);
}

/**
 * GET /api/church-page — visit page settings + gallery + pending joins count
 */
router.get('/', requireChurchTenant, requireChurchAuth, async (req, res) => {
  try {
    if (!canEditVisit(req)) {
      res.status(403).json({ error: 'Staff only' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const [church, gallery, joins] = await Promise.all([
      pool.query(
        `SELECT id, name, slug, tagline, description, visit_welcome, youtube_url,
                logo_url, banner_url, visit_hero_url, phone, email, address, city,
                denomination, brand_color
         FROM church_tenants WHERE id = $1`,
        [churchId]
      ),
      pool.query(
        `SELECT id, image_url, caption, display_order
         FROM church_gallery_images
         WHERE church_id = $1
         ORDER BY display_order ASC, id ASC`,
        [churchId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS pending
         FROM church_join_applications
         WHERE church_id = $1 AND status = 'pending'`,
        [churchId]
      ),
    ]);

    res.json({
      church: church.rows[0] || null,
      gallery: gallery.rows,
      pending_joins: joins.rows[0]?.pending || 0,
    });
  } catch (err) {
    console.error('Church page get error:', err);
    res.status(500).json({ error: 'Failed to load church page settings' });
  }
});

/**
 * PUT /api/church-page — update visit content
 */
router.put('/', requireChurchTenant, requireChurchAuth, async (req, res) => {
  try {
    if (!canEditVisit(req)) {
      res.status(403).json({
        error: 'Only pastors and admins can edit the church page',
      });
      return;
    }
    const churchId = req.churchTenant!.id;
    const b = req.body || {};

    const existing = await pool.query(
      `SELECT tagline, description, visit_welcome, youtube_url, phone, email,
              address, city, denomination
       FROM church_tenants WHERE id = $1`,
      [churchId]
    );
    if (!existing.rows.length) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }
    const cur = existing.rows[0];

    const refreshed = await pool.query(
      `UPDATE church_tenants SET
         tagline = $1,
         description = $2,
         visit_welcome = $3,
         youtube_url = $4,
         phone = $5,
         email = $6,
         address = $7,
         city = $8,
         denomination = $9,
         updated_at = NOW()
       WHERE id = $10
       RETURNING id, name, slug, tagline, description, visit_welcome, youtube_url,
                 logo_url, banner_url, visit_hero_url, phone, email, address, city,
                 denomination, brand_color`,
      [
        b.tagline !== undefined ? b.tagline : cur.tagline,
        b.description !== undefined ? b.description : cur.description,
        b.visit_welcome !== undefined ? b.visit_welcome : cur.visit_welcome,
        b.youtube_url !== undefined ? b.youtube_url : cur.youtube_url,
        b.phone !== undefined ? b.phone : cur.phone,
        b.email !== undefined ? b.email : cur.email,
        b.address !== undefined ? b.address : cur.address,
        b.city !== undefined ? b.city : cur.city,
        b.denomination !== undefined ? b.denomination : cur.denomination,
        churchId,
      ]
    );

    res.json({ church: refreshed.rows[0] });
  } catch (err) {
    console.error('Church page update error:', err);
    res.status(500).json({ error: 'Failed to save church page' });
  }
});

/**
 * POST /api/church-page/hero — upload visit hero image
 */
router.post(
  '/hero',
  requireChurchTenant,
  requireChurchAuth,
  upload.single('hero'),
  async (req, res) => {
    try {
      if (!canEditVisit(req)) {
        res.status(403).json({ error: 'Not allowed' });
        return;
      }
      const url = uploadedFilePublicUrl(req.file);
      if (!url) {
        res.status(400).json({ error: 'Hero image required (JPEG, PNG, or WebP)' });
        return;
      }
      const churchId = req.churchTenant!.id;
      const result = await pool.query(
        `UPDATE church_tenants
         SET visit_hero_url = $1, banner_url = COALESCE(banner_url, $1), updated_at = NOW()
         WHERE id = $2
         RETURNING id, visit_hero_url, banner_url, logo_url`,
        [url, churchId]
      );
      res.json({ ok: true, church: result.rows[0] });
    } catch (err) {
      console.error('Hero upload error:', err);
      res.status(500).json({ error: 'Failed to upload hero image' });
    }
  }
);

/**
 * POST /api/church-page/gallery
 */
router.post(
  '/gallery',
  requireChurchTenant,
  requireChurchAuth,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!canEditVisit(req)) {
        res.status(403).json({ error: 'Not allowed' });
        return;
      }
      const url = uploadedFilePublicUrl(req.file);
      if (!url) {
        res.status(400).json({ error: 'Image required' });
        return;
      }
      const churchId = req.churchTenant!.id;
      const caption = String(req.body.caption || '').trim() || null;
      const result = await pool.query(
        `INSERT INTO church_gallery_images (church_id, image_url, caption, display_order)
         VALUES (
           $1, $2, $3,
           COALESCE((SELECT MAX(display_order) + 1 FROM church_gallery_images WHERE church_id = $1), 0)
         )
         RETURNING *`,
        [churchId, url, caption]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Gallery upload error:', err);
      res.status(500).json({ error: 'Failed to upload gallery image' });
    }
  }
);

/**
 * DELETE /api/church-page/gallery/:id
 */
router.delete(
  '/gallery/:id',
  requireChurchTenant,
  requireChurchAuth,
  async (req, res) => {
    try {
      if (!canEditVisit(req)) {
        res.status(403).json({ error: 'Not allowed' });
        return;
      }
      const id = parseInt(req.params.id, 10);
      const churchId = req.churchTenant!.id;
      const result = await pool.query(
        `DELETE FROM church_gallery_images
         WHERE id = $1 AND church_id = $2
         RETURNING id`,
        [id, churchId]
      );
      if (!result.rows.length) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      res.json({ ok: true, id });
    } catch (err) {
      console.error('Gallery delete error:', err);
      res.status(500).json({ error: 'Failed to delete image' });
    }
  }
);

/**
 * GET /api/church-page/joins
 */
router.get('/joins', requireChurchTenant, requireChurchAuth, async (req, res) => {
  try {
    if (!canReviewJoins(req)) {
      res.status(403).json({ error: 'Not allowed' });
      return;
    }
    const churchId = req.churchTenant!.id;
    const status = String(req.query.status || 'pending');
    const result = await pool.query(
      `SELECT *
       FROM church_join_applications
       WHERE church_id = $1
         AND ($2 = 'all' OR status = $2)
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         created_at DESC
       LIMIT 200`,
      [churchId, status]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List joins error:', err);
    res.status(500).json({ error: 'Failed to load join requests' });
  }
});

/**
 * POST /api/church-page/joins/:id/approve — create member from application
 */
router.post(
  '/joins/:id/approve',
  requireChurchTenant,
  requireChurchAuth,
  async (req, res) => {
    try {
      if (!canReviewJoins(req)) {
        res.status(403).json({ error: 'Not allowed' });
        return;
      }
      const churchId = req.churchTenant!.id;
      const slug = req.churchTenant!.slug;
      const id = parseInt(req.params.id, 10);
      const actor = req.churchUser!;

      const appRes = await pool.query(
        `SELECT * FROM church_join_applications
         WHERE id = $1 AND church_id = $2`,
        [id, churchId]
      );
      if (!appRes.rows.length) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }
      const app = appRes.rows[0];
      if (app.status === 'approved' && app.member_id) {
        res.json({ ok: true, member_id: app.member_id, already: true });
        return;
      }

      const rawPhone = String(app.phone || '').trim();
      let phone = normalizePhone(rawPhone) || rawPhone.replace(/\s+/g, ' ');
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 7) {
        res.status(400).json({
          error: 'Applicant phone is invalid — edit the request or add them manually',
        });
        return;
      }
      // Prefer local 0XXXXXXXXX form when Ghana-style; otherwise keep as stored
      if (!/^0\d{9}$/.test(phone) && digits.length >= 7) {
        phone = digits.startsWith('0') ? digits : phone;
      }

      const pin = defaultPinFromPhone(phone) || digits.slice(-4);
      const pinHash = await hashPin(pin);
      const count = await pool.query(
        `SELECT COUNT(*)::int AS n FROM church_members WHERE church_id = $1`,
        [churchId]
      );
      const memberNumber = `${String(slug).toUpperCase()}-${String(count.rows[0].n + 1).padStart(4, '0')}`;
      const marketplaceSlug = `${generateSlug(`${app.first_name}-${app.last_name}`)}-${Date.now().toString(36)}`;

      const member = await pool.query(
        `INSERT INTO church_members (
           church_id, member_number, first_name, last_name, email, phone, whatsapp,
           city, membership_status, membership_date, marketplace_slug,
           member_role, credentials_set, password_hash
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,'active',CURRENT_DATE,$9,'member',true,$10
         )
         RETURNING id, first_name, last_name, phone, member_number`,
        [
          churchId,
          memberNumber,
          app.first_name,
          app.last_name,
          app.email || null,
          phone,
          app.whatsapp ? normalizePhone(app.whatsapp) || app.whatsapp : phone,
          app.city || null,
          marketplaceSlug,
          pinHash,
        ]
      );

      await pool.query(
        `UPDATE church_join_applications SET
           status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           member_id = $2
         WHERE id = $3`,
        [actor.id, member.rows[0].id, id]
      );

      await writeAudit({
        churchId,
        actorType: 'staff',
        actorId: actor.id,
        actorName: `${actor.first_name} ${actor.last_name}`,
        action: 'join.approve',
        entityType: 'church_member',
        entityId: member.rows[0].id,
        summary: `Approved join request for ${app.first_name} ${app.last_name}`,
      });

      res.json({
        ok: true,
        member: member.rows[0],
        default_pin_hint: 'Last 4 digits of phone',
      });
    } catch (err: unknown) {
      console.error('Approve join error:', err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23505') {
        res.status(409).json({ error: 'A member with this email/phone may already exist' });
        return;
      }
      res.status(500).json({ error: 'Failed to approve application' });
    }
  }
);

/**
 * POST /api/church-page/joins/:id/decline
 */
router.post(
  '/joins/:id/decline',
  requireChurchTenant,
  requireChurchAuth,
  async (req, res) => {
    try {
      if (!canReviewJoins(req)) {
        res.status(403).json({ error: 'Not allowed' });
        return;
      }
      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);
      const actor = req.churchUser!;
      const result = await pool.query(
        `UPDATE church_join_applications SET
           status = 'declined',
           reviewed_by = $1,
           reviewed_at = NOW()
         WHERE id = $2 AND church_id = $3
         RETURNING id, status`,
        [actor.id, id, churchId]
      );
      if (!result.rows.length) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Decline join error:', err);
      res.status(500).json({ error: 'Failed to decline application' });
    }
  }
);

export default router;

/**
 * Public join — registered separately without auth
 */
export async function publicJoinHandler(req: Request, res: Response) {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    if (!slug) {
      res.status(400).json({ error: 'Church slug required' });
      return;
    }

    const tenant = await pool.query(
      `SELECT id, name FROM church_tenants WHERE slug = $1 AND is_active = true`,
      [slug]
    );
    if (!tenant.rows.length) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const {
      first_name,
      last_name,
      phone,
      email,
      whatsapp,
      city,
      note,
    } = req.body || {};

    if (!first_name || !last_name || !phone) {
      res.status(400).json({ error: 'first_name, last_name, and phone are required' });
      return;
    }

    const rawPhone = String(phone).trim();
    if (!rawPhone || rawPhone.replace(/\D/g, '').length < 7) {
      res.status(400).json({
        error: 'Please enter a valid phone number',
      });
      return;
    }
    // Accept any international/local format — store digits-normalized when possible
    const normalized = normalizePhone(rawPhone) || rawPhone.replace(/\s+/g, ' ');

    const result = await pool.query(
      `INSERT INTO church_join_applications (
         church_id, first_name, last_name, phone, email, whatsapp, city, note
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, first_name, last_name, status, created_at`,
      [
        tenant.rows[0].id,
        String(first_name).trim(),
        String(last_name).trim(),
        normalized,
        email ? String(email).trim() : null,
        whatsapp
          ? normalizePhone(String(whatsapp)) || String(whatsapp).trim()
          : normalized,
        city ? String(city).trim() : null,
        note ? String(note).trim() : null,
      ]
    );

    res.status(201).json({
      ok: true,
      message: `Thank you — ${tenant.rows[0].name} will review your request.`,
      application: result.rows[0],
    });
  } catch (err) {
    console.error('Public join error:', err);
    res.status(500).json({ error: 'Could not submit join request' });
  }
}
