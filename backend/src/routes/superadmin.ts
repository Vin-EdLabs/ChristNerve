import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db';
import { requireSuperAdmin } from '../middleware/churchAuth';
import { generateSlug } from '../utils/slug';
import { sendFcmToTokens, isFcmConfigured } from '../services/fcm';
import { notifyChurchUsers, notifyChurchBroadcast } from './notifications';
import { upload, uploadedFilePublicUrl } from '../middleware/upload';
import { writeAudit } from '../services/audit';

const router = Router();

router.use(requireSuperAdmin);

/**
 * GET /api/superadmin/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM church_tenants) AS total_churches,
         (SELECT COUNT(*)::int FROM church_tenants WHERE is_active = true) AS active_churches,
         (SELECT COUNT(*)::int FROM church_tenants
           WHERE subscription_status = 'pending' AND is_active = false) AS pending_churches,
         (SELECT COUNT(*)::int FROM church_members) AS total_members,
         (SELECT COUNT(*)::int FROM market_listings WHERE is_active = true) AS total_listings,
         (SELECT COALESCE(SUM(subscription_amount), 0)::numeric
            FROM church_tenants
            WHERE subscription_status = 'active') AS monthly_revenue`
    );

    const row = result.rows[0];
    res.json({
      total_churches: row.total_churches,
      active_churches: row.active_churches,
      pending_churches: row.pending_churches,
      total_members: row.total_members,
      total_listings: row.total_listings,
      monthly_revenue: parseFloat(row.monthly_revenue),
    });
  } catch (err) {
    console.error('Superadmin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

/**
 * GET /api/superadmin/churches
 */
router.get('/churches', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
              (SELECT COUNT(*)::int FROM church_members m WHERE m.church_id = t.id) AS member_count,
              (SELECT COUNT(*)::int FROM market_listings l
                WHERE l.church_id = t.id AND l.is_active = true) AS listing_count,
              (SELECT COUNT(*)::int FROM church_users u WHERE u.church_id = t.id) AS user_count,
              (
                SELECT json_build_object(
                  'id', u.id,
                  'first_name', u.first_name,
                  'last_name', u.last_name,
                  'email', u.email,
                  'username', u.username,
                  'role', u.role
                )
                FROM church_users u
                WHERE u.church_id = t.id
                  AND u.is_active = true
                  AND u.role IN ('super-admin', 'pastor', 'admin')
                ORDER BY
                  CASE u.role
                    WHEN 'super-admin' THEN 0
                    WHEN 'pastor' THEN 1
                    ELSE 2
                  END,
                  u.id ASC
                LIMIT 1
              ) AS primary_admin
       FROM church_tenants t
       ORDER BY
         CASE WHEN t.subscription_status = 'pending' THEN 0 ELSE 1 END,
         t.created_at DESC`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('List churches error:', err);
    res.status(500).json({ error: 'Failed to fetch churches' });
  }
});

/**
 * POST /api/superadmin/churches
 * Creates a church tenant + optional pastor/admin login account.
 * Accepts JSON or multipart/form-data with optional "logo" file.
 */
router.post('/churches', upload.single('logo'), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const {
      name,
      slug,
      tagline,
      description,
      banner_url,
      address,
      city,
      region,
      phone,
      email,
      denomination,
      founded_year,
      subscription_plan,
      subscription_status,
      subscription_amount,
      next_billing_date,
      admin_first_name,
      admin_last_name,
      admin_email,
      admin_password,
      admin_phone,
      admin_role,
    } = body;

    const logo_url = uploadedFilePublicUrl(req.file) || body.logo_url || null;

    if (!name) {
      res.status(400).json({ error: 'Church name is required' });
      return;
    }

    const churchSlug = String(slug || generateSlug(name))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!churchSlug || churchSlug.length < 2) {
      res.status(400).json({ error: 'Choose a valid domain slug (letters, numbers, hyphens)' });
      return;
    }

    const reserved = ['christnerve', 'app', 'www', 'api', 'admin', 'market', 'shop'];
    if (reserved.includes(churchSlug)) {
      res.status(400).json({ error: 'This domain slug is reserved' });
      return;
    }

    if (!admin_email || !admin_password) {
      res.status(400).json({
        error: 'Pastor/admin email and password are required to open the church account',
      });
      return;
    }

    if (String(admin_password).length < 6) {
      res.status(400).json({ error: 'Admin password must be at least 6 characters' });
      return;
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO church_tenants (
         name, slug, tagline, description, logo_url, banner_url,
         address, city, region, phone, email, denomination, founded_year,
         subscription_plan, subscription_status, subscription_amount, next_billing_date,
         is_active
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         COALESCE($14,'starter'), COALESCE($15,'active'), COALESCE($16,300.00), $17,
         true
       )
       RETURNING *`,
      [
        name,
        churchSlug,
        tagline || null,
        description || null,
        logo_url || null,
        banner_url || null,
        address || null,
        city || null,
        region || null,
        phone || null,
        email || null,
        denomination || null,
        founded_year || null,
        subscription_plan || null,
        subscription_status || null,
        subscription_amount || null,
        next_billing_date || null,
      ]
    );

    const church = result.rows[0];
    const passwordHash = await bcrypt.hash(String(admin_password), 10);

    const adminResult = await client.query(
      `INSERT INTO church_users (
         church_id, first_name, last_name, email, password_hash, phone, role
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, church_id, first_name, last_name, email, phone, role, created_at`,
      [
        church.id,
        admin_first_name || 'Pastor',
        admin_last_name || 'Admin',
        String(admin_email).toLowerCase(),
        passwordHash,
        admin_phone || null,
        admin_role || 'pastor',
      ]
    );

    await client.query('COMMIT');

    await writeAudit({
      churchId: church.id,
      actorType: 'superadmin',
      action: 'church.create',
      entityType: 'church_tenant',
      entityId: church.id,
      summary: `Created church ${church.name} (${churchSlug})`,
    });

    res.status(201).json({
      ...church,
      domain: `${churchSlug}.scholarnerve.com`,
      admin: adminResult.rows[0],
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Create church error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({
        error: 'This domain slug or admin email is already in use',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to create church' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/superadmin/churches/:id/logo
 */
router.post('/churches/:id/logo', upload.single('logo'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }
    const logoUrl = uploadedFilePublicUrl(req.file);
    if (!logoUrl) {
      res.status(400).json({ error: 'Logo image is required (JPEG, PNG, or WebP)' });
      return;
    }

    const result = await pool.query(
      `UPDATE church_tenants SET logo_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [logoUrl, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Upload church logo error:', err);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

/**
 * POST /api/superadmin/churches/:id/approve
 * Accepts a registration request — does NOT activate login or create pastor account.
 */
router.post('/churches/:id/approve', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const result = await pool.query(
      `UPDATE church_tenants
       SET is_active = false,
           subscription_status = 'approved',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    res.json({
      ok: true,
      church: result.rows[0],
      message: 'Request approved. Set up the church account when you are ready.',
    });
  } catch (err) {
    console.error('Approve church error:', err);
    res.status(500).json({ error: 'Failed to approve church' });
  }
});

/**
 * POST /api/superadmin/churches/:id/setup
 * Activate church: update profile + brand colors + Primary Admin login.
 * Body: church fields + admin_name, admin_username, admin_password
 * Email for Primary Admin is always the church email.
 */
router.post('/churches/:id/setup', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const body = req.body || {};
    const existing = await client.query(
      'SELECT * FROM church_tenants WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const church = existing.rows[0];
    const name = String(body.name || church.name || '').trim();
    const tagline = body.tagline !== undefined ? String(body.tagline || '').trim() : church.tagline;
    const city = body.city !== undefined ? String(body.city || '').trim() : church.city;
    const region = body.region !== undefined ? String(body.region || '').trim() : church.region;
    const phone = body.phone !== undefined ? String(body.phone || '').trim() : church.phone;
    const email = String(body.email || church.email || '').trim().toLowerCase();
    const address =
      body.address !== undefined ? String(body.address || '').trim() || null : church.address;
    const denomination =
      body.denomination !== undefined
        ? String(body.denomination || '').trim() || null
        : church.denomination;
    const brandColor = String(body.brand_color || body.primary_color || church.brand_color || '#2D1B69').trim();
    const secondaryColor = String(
      body.secondary_color || church.secondary_color || '#C4A035'
    ).trim();
    const shortName =
      body.short_name !== undefined
        ? String(body.short_name || '').trim() || null
        : church.short_name;

    const adminName = String(body.admin_name || '').trim();
    const adminFirst =
      String(body.admin_first_name || '').trim() ||
      (adminName ? adminName.split(/\s+/)[0] : '') ||
      'Primary';
    const adminLast =
      String(body.admin_last_name || '').trim() ||
      (adminName ? adminName.split(/\s+/).slice(1).join(' ') : '') ||
      'Admin';
    const adminUsername = String(body.admin_username || email || '')
      .trim()
      .toLowerCase();
    const adminPassword = String(body.admin_password || '');
    const adminEmail = email;
    const adminPhone = String(body.admin_phone || phone || '').trim() || null;

    if (!name) {
      res.status(400).json({ error: 'Church name is required' });
      return;
    }
    if (!adminEmail) {
      res.status(400).json({ error: 'Church email is required for Primary Admin login' });
      return;
    }
    if (!adminUsername || adminUsername.length < 3) {
      res.status(400).json({ error: 'Primary Admin username is required (min 3 characters)' });
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    let nextSlug = String(body.slug || church.slug || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!nextSlug || nextSlug.length < 2) {
      res.status(400).json({ error: 'A valid domain slug is required' });
      return;
    }

    const reserved = ['christnerve', 'app', 'www', 'api', 'admin', 'market', 'shop'];
    if (reserved.includes(nextSlug)) {
      res.status(400).json({ error: 'This domain slug is reserved' });
      return;
    }

    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE church_tenants
       SET name = $1,
           slug = $2,
           tagline = $3,
           city = $4,
           region = $5,
           phone = $6,
           email = $7,
           address = $8,
           denomination = $9,
           brand_color = $10,
           secondary_color = $11,
           short_name = $12,
           is_active = true,
           subscription_status = 'active',
           updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [
        name,
        nextSlug,
        tagline || null,
        city || null,
        region || null,
        phone || null,
        adminEmail,
        address,
        denomination,
        brandColor,
        secondaryColor,
        shortName,
        id,
      ]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminResult = await client.query(
      `INSERT INTO church_users (
         church_id, first_name, last_name, email, username, password_hash, phone, role
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'super-admin')
       ON CONFLICT (church_id, email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         username = EXCLUDED.username,
         phone = COALESCE(EXCLUDED.phone, church_users.phone),
         role = 'super-admin',
         is_active = true
       RETURNING id, church_id, first_name, last_name, email, username, phone, role, created_at`,
      [id, adminFirst, adminLast, adminEmail, adminUsername, passwordHash, adminPhone]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      church: updated.rows[0],
      admin: adminResult.rows[0],
      domain: `${nextSlug}.scholarnerve.com`,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Setup church error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({
        error: 'Domain slug, email, or username is already in use',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to set up church account' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/superadmin/churches/:id/reject
 */
router.post('/churches/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const result = await pool.query(
      `UPDATE church_tenants
       SET is_active = false,
           subscription_status = 'rejected',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    res.json({ ok: true, church: result.rows[0] });
  } catch (err) {
    console.error('Reject church error:', err);
    res.status(500).json({ error: 'Failed to reject church' });
  }
});

/**
 * DELETE /api/superadmin/churches/:id
 * Permanently remove a church tenant and all cascaded church data.
 */
router.delete('/churches/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const existing = await pool.query(
      'SELECT id, name, slug FROM church_tenants WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const church = existing.rows[0] as {
      id: number;
      name: string;
      slug: string;
    };

    // Related rows cascade via FK (members, users, events, market, etc.)
    await pool.query('DELETE FROM church_tenants WHERE id = $1', [id]);

    res.json({
      ok: true,
      message: 'Church deleted permanently',
      church,
    });
  } catch (err) {
    console.error('Delete church error:', err);
    res.status(500).json({ error: 'Failed to delete church' });
  }
});

/**
 * PUT /api/superadmin/churches/:id
 */
router.put('/churches/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_tenants WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body;

    const result = await pool.query(
      `UPDATE church_tenants SET
         name = $1,
         slug = $2,
         tagline = $3,
         description = $4,
         logo_url = $5,
         banner_url = $6,
         address = $7,
         city = $8,
         region = $9,
         phone = $10,
         email = $11,
         denomination = $12,
         founded_year = $13,
         subscription_plan = $14,
         subscription_status = $15,
         subscription_amount = $16,
         next_billing_date = $17,
         is_active = $18,
         brand_color = $19,
         secondary_color = $20,
         short_name = $21,
         updated_at = NOW()
       WHERE id = $22
       RETURNING *`,
      [
        b.name ?? cur.name,
        b.slug !== undefined ? String(b.slug).toLowerCase() : cur.slug,
        b.tagline !== undefined ? b.tagline : cur.tagline,
        b.description !== undefined ? b.description : cur.description,
        b.logo_url !== undefined ? b.logo_url : cur.logo_url,
        b.banner_url !== undefined ? b.banner_url : cur.banner_url,
        b.address !== undefined ? b.address : cur.address,
        b.city !== undefined ? b.city : cur.city,
        b.region !== undefined ? b.region : cur.region,
        b.phone !== undefined ? b.phone : cur.phone,
        b.email !== undefined ? b.email : cur.email,
        b.denomination !== undefined ? b.denomination : cur.denomination,
        b.founded_year !== undefined ? b.founded_year : cur.founded_year,
        b.subscription_plan !== undefined
          ? b.subscription_plan
          : cur.subscription_plan,
        b.subscription_status !== undefined
          ? b.subscription_status
          : cur.subscription_status,
        b.subscription_amount !== undefined
          ? b.subscription_amount
          : cur.subscription_amount,
        b.next_billing_date !== undefined
          ? b.next_billing_date
          : cur.next_billing_date,
        b.is_active !== undefined
          ? b.is_active === true || b.is_active === 'true' || b.is_active === 1
          : cur.is_active,
        b.brand_color !== undefined
          ? b.brand_color
          : b.primary_color !== undefined
            ? b.primary_color
            : cur.brand_color,
        b.secondary_color !== undefined ? b.secondary_color : cur.secondary_color,
        b.short_name !== undefined ? b.short_name : cur.short_name,
        id,
      ]
    );

    const updated = result.rows[0];

    // Optional Primary Admin update (name / username / password)
    const adminName = b.admin_name !== undefined ? String(b.admin_name || '').trim() : '';
    const adminUsername =
      b.admin_username !== undefined
        ? String(b.admin_username || '').trim().toLowerCase()
        : '';
    const adminPassword =
      b.admin_password !== undefined ? String(b.admin_password || '') : '';
    const adminEmail =
      b.admin_email !== undefined
        ? String(b.admin_email || '').trim().toLowerCase()
        : String(updated.email || '').toLowerCase();

    if (adminName || adminUsername || adminPassword || b.admin_email !== undefined) {
      const primary = await pool.query(
        `SELECT * FROM church_users
         WHERE church_id = $1
           AND role IN ('super-admin', 'pastor', 'admin')
         ORDER BY
           CASE role
             WHEN 'super-admin' THEN 0
             WHEN 'pastor' THEN 1
             ELSE 2
           END,
           id ASC
         LIMIT 1`,
        [id]
      );

      const first =
        adminName.split(/\s+/)[0] ||
        primary.rows[0]?.first_name ||
        'Primary';
      const last =
        adminName.split(/\s+/).slice(1).join(' ') ||
        primary.rows[0]?.last_name ||
        'Admin';

      if (primary.rows.length > 0) {
        const curAdmin = primary.rows[0];
        let passwordHash = curAdmin.password_hash;
        if (adminPassword) {
          if (adminPassword.length < 6) {
            res.status(400).json({ error: 'Admin password must be at least 6 characters' });
            return;
          }
          passwordHash = await bcrypt.hash(adminPassword, 10);
        }
        await pool.query(
          `UPDATE church_users SET
             first_name = $1,
             last_name = $2,
             email = $3,
             username = COALESCE(NULLIF($4, ''), username),
             password_hash = $5,
             role = CASE
               WHEN role = 'super-admin' THEN 'super-admin'
               ELSE 'super-admin'
             END,
             is_active = true
           WHERE id = $6 AND church_id = $7`,
          [
            first,
            last,
            adminEmail || curAdmin.email,
            adminUsername || null,
            passwordHash,
            curAdmin.id,
            id,
          ]
        );
      } else if (adminPassword && adminEmail) {
        if (adminPassword.length < 6) {
          res.status(400).json({ error: 'Admin password must be at least 6 characters' });
          return;
        }
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await pool.query(
          `INSERT INTO church_users (
             church_id, first_name, last_name, email, username, password_hash, role
           ) VALUES ($1,$2,$3,$4,$5,$6,'super-admin')`,
          [
            id,
            first,
            last,
            adminEmail,
            adminUsername || adminEmail,
            passwordHash,
          ]
        );
      }
    }

    await writeAudit({
      churchId: updated.id,
      actorType: 'superadmin',
      action: updated.is_active ? 'church.update' : 'church.suspend',
      entityType: 'church_tenant',
      entityId: updated.id,
      summary: updated.is_active
        ? `Updated church ${updated.name}`
        : `Suspended church ${updated.name}`,
    });

    res.json(updated);
  } catch (err: unknown) {
    console.error('Update church error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Slug, email, or username already in use' });
      return;
    }
    res.status(500).json({ error: 'Failed to update church' });
  }
});

/**
 * GET /api/superadmin/churches/:id/stats
 */
router.get('/churches/:id/stats', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid church id' });
      return;
    }

    const church = await pool.query(
      'SELECT * FROM church_tenants WHERE id = $1',
      [id]
    );

    if (church.rows.length === 0) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM church_members WHERE church_id = $1) AS members,
         (SELECT COUNT(*)::int FROM church_members
           WHERE church_id = $1 AND membership_status = 'active') AS active_members,
         (SELECT COUNT(*)::int FROM church_users WHERE church_id = $1) AS users,
         (SELECT COUNT(*)::int FROM market_listings
           WHERE church_id = $1 AND is_active = true) AS listings,
         (SELECT COUNT(*)::int FROM church_events WHERE church_id = $1) AS events,
         (SELECT COALESCE(SUM(amount), 0)::numeric FROM church_giving
           WHERE church_id = $1
             AND service_date >= date_trunc('month', CURRENT_DATE)) AS giving_this_month,
         (SELECT COALESCE(AVG(total_count), 0)::numeric(10,1) FROM church_attendance
           WHERE church_id = $1
             AND service_date >= (CURRENT_DATE - INTERVAL '3 months')) AS avg_attendance`
      ,
      [id]
    );

    const row = stats.rows[0];
    res.json({
      church: church.rows[0],
      stats: {
        members: row.members,
        active_members: row.active_members,
        users: row.users,
        listings: row.listings,
        events: row.events,
        giving_this_month: parseFloat(row.giving_this_month),
        avg_attendance: parseFloat(row.avg_attendance),
      },
    });
  } catch (err) {
    console.error('Church stats error:', err);
    res.status(500).json({ error: 'Failed to fetch church stats' });
  }
});

/**
 * GET /api/superadmin/notifications
 * Platform notifications for the superadmin console.
 */
router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_type = 'superadmin'
          OR (church_id IS NULL AND user_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List platform notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * POST /api/superadmin/notifications
 * Create a platform notification, or target a church when church_id is set.
 * Body: { title, body, link?, church_id?, user_type?, user_id? }
 */
router.post('/notifications', async (req: Request, res: Response) => {
  try {
    const { title, body, link, church_id, user_type, user_id } = req.body;

    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const churchId =
      church_id !== undefined && church_id !== null && church_id !== ''
        ? parseInt(String(church_id), 10)
        : null;

    if (churchId !== null && Number.isNaN(churchId)) {
      res.status(400).json({ error: 'Invalid church_id' });
      return;
    }

    // Target a church (staff/member broadcast or specific user)
    if (churchId !== null) {
      const church = await pool.query(
        'SELECT id FROM church_tenants WHERE id = $1',
        [churchId]
      );
      if (church.rows.length === 0) {
        res.status(404).json({ error: 'Church not found' });
        return;
      }

      const targetType =
        user_type === 'member' || user_type === 'staff' ? user_type : null;
      const targetUserId =
        user_id !== undefined && user_id !== null && user_id !== ''
          ? parseInt(String(user_id), 10)
          : null;

      if (targetUserId !== null && Number.isNaN(targetUserId)) {
        res.status(400).json({ error: 'Invalid user_id' });
        return;
      }

      const id =
        targetUserId == null && !targetType
          ? await notifyChurchBroadcast({
              churchId,
              title: String(title),
              body: String(body),
              link: link ? String(link) : null,
            })
          : await notifyChurchUsers({
              churchId,
              title: String(title),
              body: String(body),
              link: link ? String(link) : null,
              userType: targetType || 'staff',
              userId: targetUserId,
            });

      const row = await pool.query('SELECT * FROM notifications WHERE id = $1', [
        id,
      ]);
      res.status(201).json(row.rows[0]);
      return;
    }

    // Platform-wide / superadmin notification
    const result = await pool.query(
      `INSERT INTO notifications (church_id, user_type, user_id, title, body, link)
       VALUES (NULL, 'superadmin', NULL, $1, $2, $3)
       RETURNING *`,
      [String(title), String(body), link ? String(link) : null]
    );

    const tokens = await pool.query(
      `SELECT token FROM device_tokens WHERE user_type = 'superadmin'`
    );
    if (tokens.rows.length > 0) {
      await sendFcmToTokens(
        tokens.rows.map((r) => r.token as string),
        {
          title: String(title),
          body: String(body),
          link: link ? String(link) : null,
        }
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create platform notification error:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * POST /api/superadmin/notifications/read/:id
 */
router.post('/notifications/read/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }

    const result = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1
         AND (user_type = 'superadmin' OR (church_id IS NULL AND user_id IS NULL))
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark platform notification read error:', err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/superadmin/notifications/read-all
 */
router.post('/notifications/read-all', async (_req: Request, res: Response) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE is_read = false
         AND (user_type = 'superadmin' OR (church_id IS NULL AND user_id IS NULL))`
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark all platform notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * POST /api/superadmin/notifications/device-token
 * Body: { token: string }
 */
router.post('/notifications/device-token', async (req: Request, res: Response) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    await pool.query(
      `INSERT INTO device_tokens (user_type, user_id, church_id, token)
       VALUES ('superadmin', 0, NULL, $1)
       ON CONFLICT (token) DO UPDATE SET
         user_type = 'superadmin',
         user_id = 0,
         church_id = NULL`,
      [token]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Save superadmin device token error:', err);
    res.status(500).json({ error: 'Failed to save device token' });
  }
});

/**
 * GET /api/superadmin/audit — platform-wide monitoring feed
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 300);
    const result = await pool.query(
      `SELECT a.*, t.name AS church_name
       FROM audit_logs a
       LEFT JOIN church_tenants t ON t.id = a.church_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Platform audit error:', err);
    res.status(500).json({ error: 'Failed to fetch platform audit' });
  }
});

/**
 * GET /api/superadmin/notifications/health
 */
router.get('/notifications/health', async (_req: Request, res: Response) => {
  try {
    const [churchTokens, platformTokens, notifs] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS c FROM device_tokens WHERE church_id IS NOT NULL`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM device_tokens WHERE user_type = 'superadmin'`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM notifications
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      ),
    ]);

    res.json({
      fcm_configured: isFcmConfigured(),
      church_device_tokens: churchTokens.rows[0]?.c ?? 0,
      platform_device_tokens: platformTokens.rows[0]?.c ?? 0,
      notifications_24h: notifs.rows[0]?.c ?? 0,
    });
  } catch (err) {
    console.error('Notification health error:', err);
    res.status(500).json({ error: 'Failed to fetch notification health' });
  }
});

export default router;
