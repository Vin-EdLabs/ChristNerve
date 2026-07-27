import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { upload, uploadedFilePublicUrl } from '../middleware/upload';
import { generateSlug } from '../utils/slug';
import { writeAudit } from '../services/audit';
import {
  defaultPinFromPhone,
  hashPin,
  isValidMemberPhone,
  isValidPin,
  normalizePhone,
} from '../utils/memberPin';

const router = Router();

router.use(requireChurchTenant, requireChurchAuth);

/** Empty form strings → null for PG date/text columns. */
function nullIfEmpty(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function pickDate(
  bodyVal: unknown,
  currentVal: unknown,
  provided: boolean
): string | null {
  if (!provided) {
    return currentVal === undefined || currentVal === null || currentVal === ''
      ? null
      : String(currentVal).slice(0, 10);
  }
  return nullIfEmpty(bodyVal);
}

/** Sync multi-department membership; also refresh free-text `department` label. */
async function syncMemberDepartments(
  churchId: number,
  memberId: number,
  departmentIds: unknown
): Promise<void> {
  if (!Array.isArray(departmentIds)) return;

  const ids = [
    ...new Set(
      departmentIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => !Number.isNaN(n) && n > 0)
    ),
  ];

  await pool.query(
    `DELETE FROM church_department_members
     WHERE church_id = $1 AND member_id = $2`,
    [churchId, memberId]
  );

  for (const deptId of ids) {
    const ok = await pool.query(
      `SELECT id FROM church_departments WHERE id = $1 AND church_id = $2`,
      [deptId, churchId]
    );
    if (ok.rows.length === 0) continue;
    await pool.query(
      `INSERT INTO church_department_members (church_id, department_id, member_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (department_id, member_id) DO NOTHING`,
      [churchId, deptId, memberId]
    );
  }

  // Promote leaders already set on department
  await pool.query(
    `UPDATE church_department_members dm
     SET role = 'leader'
     FROM church_departments d
     WHERE d.id = dm.department_id
       AND d.leader_member_id = dm.member_id
       AND dm.member_id = $1`,
    [memberId]
  );

  const names = await pool.query(
    `SELECT d.name
     FROM church_department_members dm
     JOIN church_departments d ON d.id = dm.department_id
     WHERE dm.member_id = $1
     ORDER BY d.name`,
    [memberId]
  );
  const label = names.rows.map((r) => r.name).join(', ') || null;
  await pool.query(
    `UPDATE church_members SET department = $1, updated_at = NOW() WHERE id = $2`,
    [label, memberId]
  );
}

async function attachDepartmentIds(member: Record<string, unknown>) {
  const r = await pool.query(
    `SELECT department_id FROM church_department_members WHERE member_id = $1`,
    [member.id]
  );
  return {
    ...member,
    department_ids: r.rows.map((row) => row.department_id),
  };
}

async function nextMemberNumber(churchId: number, slug: string): Promise<string> {
  const prefix = slug.toUpperCase();
  const result = await pool.query(
    `SELECT member_number FROM church_members
     WHERE church_id = $1 AND member_number LIKE $2
     ORDER BY member_number DESC
     LIMIT 1`,
    [churchId, `${prefix}-%`]
  );

  let next = 1;
  if (result.rows.length > 0 && result.rows[0].member_number) {
    const parts = String(result.rows[0].member_number).split('-');
    const last = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(last)) next = last + 1;
  }

  return `${prefix}-${String(next).padStart(4, '0')}`;
}

async function uniqueMarketplaceSlug(
  base: string,
  excludeId?: number
): Promise<string> {
  let candidate = base || 'member';
  let attempt = 0;

  while (true) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt}`;
    const result = await pool.query(
      `SELECT id FROM church_members WHERE marketplace_slug = $1
       ${excludeId ? 'AND id <> $2' : ''}`,
      excludeId ? [slug, excludeId] : [slug]
    );
    if (result.rows.length === 0) return slug;
    attempt += 1;
  }
}

/**
 * GET /api/members/stats — must be registered before /:id
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;

    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE membership_status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE membership_status = 'visitor')::int AS visitors,
         COUNT(*) FILTER (
           WHERE membership_date >= date_trunc('month', CURRENT_DATE)
         )::int AS new_this_month,
         COUNT(*) FILTER (WHERE is_verified = true)::int AS verified
       FROM church_members
       WHERE church_id = $1`,
      [churchId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Member stats error:', err);
    res.status(500).json({ error: 'Failed to fetch member stats' });
  }
});

/**
 * GET /api/members
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const department = (req.query.department as string) || '';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20)
    );
    const offset = (page - 1) * limit;

    const conditions: string[] = ['church_id = $1'];
    const params: unknown[] = [churchId];
    let idx = 2;

    if (search) {
      conditions.push(
        `(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx}
          OR phone ILIKE $${idx} OR member_number ILIKE $${idx})`
      );
      params.push(`%${search}%`);
      idx += 1;
    }

    if (status) {
      conditions.push(`membership_status = $${idx}`);
      params.push(status);
      idx += 1;
    }

    if (department) {
      conditions.push(`department ILIKE $${idx}`);
      params.push(department);
      idx += 1;
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM church_members WHERE ${where}`,
      params
    );

    const dataResult = await pool.query(
      `SELECT id, church_id, member_number, first_name, last_name, other_names,
              email, phone, whatsapp, gender, date_of_birth, marital_status,
              occupation, address, city, avatar_url, department, ministry,
              cell_group, membership_status, membership_date, baptism_date,
              marketplace_slug, member_role, username, credentials_set,
              is_verified, last_login, created_at, updated_at
       FROM church_members
       WHERE ${where}
       ORDER BY last_name ASC, first_name ASC
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
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * POST /api/members
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const slug = req.churchTenant!.slug;
    const {
      first_name,
      last_name,
      other_names,
      email,
      phone,
      whatsapp,
      gender,
      date_of_birth,
      marital_status,
      occupation,
      address,
      city,
      avatar_url,
      department,
      department_ids,
      ministry,
      cell_group,
      membership_status,
      membership_date,
      baptism_date,
    } = req.body;

    if (!first_name || !last_name) {
      res.status(400).json({ error: 'first_name and last_name are required' });
      return;
    }

    if (!phone || !isValidMemberPhone(phone)) {
      res.status(400).json({
        error: 'Phone is required and must start with 0 (e.g. 0244123456)',
      });
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const defaultPin = defaultPinFromPhone(normalizedPhone)!;
    const pinHash = await hashPin(defaultPin);

    const memberNumber = await nextMemberNumber(churchId, slug);
    const marketplaceSlug = await uniqueMarketplaceSlug(
      generateSlug(`${first_name} ${last_name}`)
    );

    const result = await pool.query(
      `INSERT INTO church_members (
         church_id, member_number, first_name, last_name, other_names,
         email, phone, whatsapp, gender, date_of_birth, marital_status,
         occupation, address, city, avatar_url, department, ministry,
         cell_group, membership_status, membership_date, baptism_date,
         marketplace_slug, member_role, credentials_set, password_hash
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
         COALESCE($19, 'active'), $20, $21, $22, 'member', true, $23
       )
       RETURNING *`,
      [
        churchId,
        memberNumber,
        first_name,
        last_name,
        nullIfEmpty(other_names),
        nullIfEmpty(email),
        normalizedPhone,
        whatsapp
          ? normalizePhone(whatsapp) || whatsapp
          : normalizedPhone,
        nullIfEmpty(gender),
        nullIfEmpty(date_of_birth),
        nullIfEmpty(marital_status),
        nullIfEmpty(occupation),
        nullIfEmpty(address),
        nullIfEmpty(city),
        nullIfEmpty(avatar_url),
        nullIfEmpty(department),
        nullIfEmpty(ministry),
        nullIfEmpty(cell_group),
        nullIfEmpty(membership_status) || 'active',
        nullIfEmpty(membership_date),
        nullIfEmpty(baptism_date),
        marketplaceSlug,
        pinHash,
      ]
    );

    const member = result.rows[0];

    if (Array.isArray(department_ids) && department_ids.length > 0) {
      await syncMemberDepartments(churchId, member.id, department_ids);
    } else if (department) {
      const named = await pool.query(
        `SELECT id FROM church_departments
         WHERE church_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
         LIMIT 1`,
        [churchId, department]
      );
      if (named.rows[0]) {
        await syncMemberDepartments(churchId, member.id, [named.rows[0].id]);
      }
    }

    const actor = req.churchUser;
    await writeAudit({
      churchId,
      actorType: req.accountType === 'member' ? 'member' : 'staff',
      actorId: actor?.id ?? null,
      actorName: actor
        ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim()
        : null,
      action: 'member.create',
      entityType: 'church_member',
      entityId: member.id,
      summary: `Added member ${member.first_name} ${member.last_name} (login phone ${normalizedPhone})`,
    });

    const refreshed = await pool.query(
      'SELECT * FROM church_members WHERE id = $1',
      [member.id]
    );
    const { password_hash: _, ...safe } = refreshed.rows[0];
    res.status(201).json({
      ...(await attachDepartmentIds(safe)),
      default_pin_hint: 'Last 4 digits of phone',
    });
  } catch (err: unknown) {
    console.error('Create member error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'A member with this email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create member' });
  }
});

/**
 * GET /api/members/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid member id' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM church_members WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const { password_hash: _, ...safe } = result.rows[0];
    res.json(await attachDepartmentIds(safe));
  } catch (err) {
    console.error('Get member error:', err);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

/**
 * PUT /api/members/:id/credentials  (legacy alias)
 * PUT /api/members/:id/reset-pin
 * Staff reset member PIN. Default = last 4 digits of phone.
 * Optional body: { pin: "1234" }
 */
router.put('/:id/credentials', async (req: Request, res: Response) => {
  return resetMemberPin(req, res);
});

router.put('/:id/reset-pin', async (req: Request, res: Response) => {
  return resetMemberPin(req, res);
});

async function resetMemberPin(req: Request, res: Response) {
  try {
    if (req.accountType === 'member') {
      res.status(403).json({ error: 'Staff only' });
      return;
    }
    const role = String(req.churchUser?.role || '').toLowerCase();
    if (!['pastor', 'admin', 'secretary'].includes(role)) {
      res.status(403).json({ error: 'Not allowed to reset member PINs' });
      return;
    }

    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid member id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_members WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const member = existing.rows[0];
    let phone = normalizePhone(member.phone || '');
    if (!isValidMemberPhone(phone)) {
      res.status(400).json({
        error: 'Member needs a valid phone starting with 0 before PIN can be set',
      });
      return;
    }

    const requested = String(req.body.pin || req.body.password || '').trim();
    const pin = isValidPin(requested)
      ? requested
      : defaultPinFromPhone(phone)!;

    if (!isValidPin(pin)) {
      res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      return;
    }

    const hash = await hashPin(pin);
    const result = await pool.query(
      `UPDATE church_members
       SET phone = $1,
           password_hash = $2,
           credentials_set = true,
           updated_at = NOW()
       WHERE id = $3 AND church_id = $4
       RETURNING id, first_name, last_name, email, phone, username,
                 credentials_set, membership_status, member_role`,
      [phone, hash, id, churchId]
    );

    const updated = result.rows[0];
    const actor = req.churchUser;
    await writeAudit({
      churchId,
      actorType: 'staff',
      actorId: actor?.id ?? null,
      actorName: actor
        ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim()
        : null,
      action: 'member.reset_pin',
      entityType: 'church_member',
      entityId: updated.id,
      summary: `Reset PIN for ${updated.first_name} ${updated.last_name}`,
    });

    res.json({
      ok: true,
      member: updated,
      pin_reset_to: isValidPin(requested) ? 'custom' : 'last_4_of_phone',
    });
  } catch (err: unknown) {
    console.error('Reset member PIN error:', err);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
}

/**
 * PUT /api/members/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid member id' });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM church_members WHERE id = $1 AND church_id = $2',
      [id, churchId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const current = existing.rows[0];
    const body = req.body;

    const first_name = body.first_name ?? current.first_name;
    const last_name = body.last_name ?? current.last_name;

    let marketplace_slug = current.marketplace_slug;
    if (
      (body.first_name && body.first_name !== current.first_name) ||
      (body.last_name && body.last_name !== current.last_name)
    ) {
      marketplace_slug = await uniqueMarketplaceSlug(
        generateSlug(`${first_name} ${last_name}`),
        id
      );
    }

    const result = await pool.query(
      `UPDATE church_members SET
         first_name = $1,
         last_name = $2,
         other_names = $3,
         email = $4,
         phone = $5,
         whatsapp = $6,
         gender = $7,
         date_of_birth = $8,
         marital_status = $9,
         occupation = $10,
         address = $11,
         city = $12,
         avatar_url = $13,
         department = $14,
         ministry = $15,
         cell_group = $16,
         membership_status = $17,
         membership_date = $18,
         baptism_date = $19,
         marketplace_slug = $20,
         updated_at = NOW()
       WHERE id = $21 AND church_id = $22
       RETURNING *`,
      [
        first_name,
        last_name,
        body.other_names !== undefined
          ? nullIfEmpty(body.other_names)
          : current.other_names,
        body.email !== undefined ? nullIfEmpty(body.email) : current.email,
        body.phone !== undefined
          ? normalizePhone(body.phone) || body.phone
          : current.phone,
        body.whatsapp !== undefined
          ? body.whatsapp
            ? normalizePhone(body.whatsapp) || body.whatsapp
            : null
          : current.whatsapp,
        body.gender !== undefined ? nullIfEmpty(body.gender) : current.gender,
        pickDate(body.date_of_birth, current.date_of_birth, body.date_of_birth !== undefined),
        body.marital_status !== undefined
          ? nullIfEmpty(body.marital_status)
          : current.marital_status,
        body.occupation !== undefined
          ? nullIfEmpty(body.occupation)
          : current.occupation,
        body.address !== undefined ? nullIfEmpty(body.address) : current.address,
        body.city !== undefined ? nullIfEmpty(body.city) : current.city,
        body.avatar_url !== undefined
          ? nullIfEmpty(body.avatar_url)
          : current.avatar_url,
        body.department !== undefined
          ? nullIfEmpty(body.department)
          : current.department,
        body.ministry !== undefined
          ? nullIfEmpty(body.ministry)
          : current.ministry,
        body.cell_group !== undefined
          ? nullIfEmpty(body.cell_group)
          : current.cell_group,
        body.membership_status !== undefined
          ? nullIfEmpty(body.membership_status) || current.membership_status
          : current.membership_status,
        pickDate(
          body.membership_date,
          current.membership_date,
          body.membership_date !== undefined
        ),
        pickDate(
          body.baptism_date,
          current.baptism_date,
          body.baptism_date !== undefined
        ),
        marketplace_slug,
        id,
        churchId,
      ]
    );

    if (Array.isArray(body.department_ids)) {
      await syncMemberDepartments(churchId, id, body.department_ids);
    }

    const refreshed = await pool.query(
      'SELECT * FROM church_members WHERE id = $1',
      [id]
    );
    const { password_hash: _, ...safe } = refreshed.rows[0] || result.rows[0];
    res.json(await attachDepartmentIds(safe));
  } catch (err: unknown) {
    console.error('Update member error:', err);
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: 'Email or marketplace slug conflict' });
      return;
    }
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/**
 * POST /api/members/:id/avatar — staff upload member profile photo
 */
router.post(
  '/:id/avatar',
  upload.single('avatar'),
  async (req: Request, res: Response) => {
    try {
      if (req.accountType === 'member') {
        res.status(403).json({ error: 'Staff only' });
        return;
      }

      const churchId = req.churchTenant!.id;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: 'Invalid member id' });
        return;
      }

      const avatarUrl = uploadedFilePublicUrl(req.file);
      if (!avatarUrl) {
        res.status(400).json({
          error: 'Profile photo is required (JPEG, PNG, or WebP)',
        });
        return;
      }

      const result = await pool.query(
        `UPDATE church_members
         SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2 AND church_id = $3
         RETURNING *`,
        [avatarUrl, id, churchId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Member avatar upload error:', err);
      res.status(500).json({ error: 'Failed to upload profile photo' });
    }
  }
);

/**
 * DELETE /api/members/:id — soft delete
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid member id' });
      return;
    }

    const result = await pool.query(
      `UPDATE church_members
       SET membership_status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND church_id = $2
       RETURNING *`,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json({ message: 'Member deactivated', member: result.rows[0] });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

/**
 * POST /api/members/:id/verify
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid member id' });
      return;
    }

    const result = await pool.query(
      `UPDATE church_members
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1 AND church_id = $2
       RETURNING *`,
      [id, churchId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Verify member error:', err);
    res.status(500).json({ error: 'Failed to verify member' });
  }
});

export default router;
