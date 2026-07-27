"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const churchTenant_1 = require("../middleware/churchTenant");
const slug_1 = require("../utils/slug");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
router.use(churchTenant_1.requireChurchTenant, churchAuth_1.requireChurchAuth);
async function nextMemberNumber(churchId, slug) {
    const prefix = slug.toUpperCase();
    const result = await db_1.pool.query(`SELECT member_number FROM church_members
     WHERE church_id = $1 AND member_number LIKE $2
     ORDER BY member_number DESC
     LIMIT 1`, [churchId, `${prefix}-%`]);
    let next = 1;
    if (result.rows.length > 0 && result.rows[0].member_number) {
        const parts = String(result.rows[0].member_number).split('-');
        const last = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(last))
            next = last + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
}
async function uniqueMarketplaceSlug(base, excludeId) {
    let candidate = base || 'member';
    let attempt = 0;
    while (true) {
        const slug = attempt === 0 ? candidate : `${candidate}-${attempt}`;
        const result = await db_1.pool.query(`SELECT id FROM church_members WHERE marketplace_slug = $1
       ${excludeId ? 'AND id <> $2' : ''}`, excludeId ? [slug, excludeId] : [slug]);
        if (result.rows.length === 0)
            return slug;
        attempt += 1;
    }
}
/**
 * GET /api/members/stats — must be registered before /:id
 */
router.get('/stats', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const result = await db_1.pool.query(`SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE membership_status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE membership_status = 'visitor')::int AS visitors,
         COUNT(*) FILTER (
           WHERE membership_date >= date_trunc('month', CURRENT_DATE)
         )::int AS new_this_month,
         COUNT(*) FILTER (WHERE is_verified = true)::int AS verified
       FROM church_members
       WHERE church_id = $1`, [churchId]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Member stats error:', err);
        res.status(500).json({ error: 'Failed to fetch member stats' });
    }
});
/**
 * GET /api/members
 */
router.get('/', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const department = req.query.department || '';
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const offset = (page - 1) * limit;
        const conditions = ['church_id = $1'];
        const params = [churchId];
        let idx = 2;
        if (search) {
            conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx}
          OR phone ILIKE $${idx} OR member_number ILIKE $${idx})`);
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
        const countResult = await db_1.pool.query(`SELECT COUNT(*)::int AS total FROM church_members WHERE ${where}`, params);
        const dataResult = await db_1.pool.query(`SELECT id, church_id, member_number, first_name, last_name, other_names,
              email, phone, whatsapp, gender, date_of_birth, marital_status,
              occupation, address, city, avatar_url, department, ministry,
              cell_group, membership_status, membership_date, baptism_date,
              marketplace_slug, member_role, username, credentials_set,
              is_verified, last_login, created_at, updated_at
       FROM church_members
       WHERE ${where}
       ORDER BY last_name ASC, first_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`, [...params, limit, offset]);
        res.json({
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                total: countResult.rows[0].total,
                totalPages: Math.ceil(countResult.rows[0].total / limit),
            },
        });
    }
    catch (err) {
        console.error('List members error:', err);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});
/**
 * POST /api/members
 */
router.post('/', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const slug = req.churchTenant.slug;
        const { first_name, last_name, other_names, email, phone, whatsapp, gender, date_of_birth, marital_status, occupation, address, city, avatar_url, department, ministry, cell_group, membership_status, membership_date, baptism_date, } = req.body;
        if (!first_name || !last_name) {
            res.status(400).json({ error: 'first_name and last_name are required' });
            return;
        }
        const memberNumber = await nextMemberNumber(churchId, slug);
        const marketplaceSlug = await uniqueMarketplaceSlug((0, slug_1.generateSlug)(`${first_name} ${last_name}`));
        const result = await db_1.pool.query(`INSERT INTO church_members (
         church_id, member_number, first_name, last_name, other_names,
         email, phone, whatsapp, gender, date_of_birth, marital_status,
         occupation, address, city, avatar_url, department, ministry,
         cell_group, membership_status, membership_date, baptism_date,
         marketplace_slug, member_role, credentials_set
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
         COALESCE($19, 'active'), $20, $21, $22, 'member', false
       )
       RETURNING *`, [
            churchId,
            memberNumber,
            first_name,
            last_name,
            other_names || null,
            email || null,
            phone || null,
            whatsapp || null,
            gender || null,
            date_of_birth || null,
            marital_status || null,
            occupation || null,
            address || null,
            city || null,
            avatar_url || null,
            department || null,
            ministry || null,
            cell_group || null,
            membership_status || null,
            membership_date || null,
            baptism_date || null,
            marketplaceSlug,
        ]);
        const member = result.rows[0];
        const actor = req.churchUser;
        await (0, audit_1.writeAudit)({
            churchId,
            actorType: req.accountType === 'member' ? 'member' : 'staff',
            actorId: actor?.id ?? null,
            actorName: actor
                ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim()
                : null,
            action: 'member.create',
            entityType: 'church_member',
            entityId: member.id,
            summary: `Added member ${member.first_name} ${member.last_name}`,
        });
        res.status(201).json(member);
    }
    catch (err) {
        console.error('Create member error:', err);
        const pgErr = err;
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
router.get('/:id', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const result = await db_1.pool.query('SELECT * FROM church_members WHERE id = $1 AND church_id = $2', [id, churchId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Get member error:', err);
        res.status(500).json({ error: 'Failed to fetch member' });
    }
});
/**
 * PUT /api/members/:id/credentials
 * Staff (pastor/admin) set member username + password for login.
 */
router.put('/:id/credentials', async (req, res) => {
    try {
        if (req.accountType === 'member') {
            res.status(403).json({ error: 'Staff only' });
            return;
        }
        const role = String(req.churchUser?.role || '').toLowerCase();
        if (!['pastor', 'admin', 'secretary'].includes(role)) {
            res.status(403).json({ error: 'Not allowed to manage member logins' });
            return;
        }
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const username = String(req.body.username || '')
            .trim()
            .toLowerCase();
        const password = String(req.body.password || '');
        if (!username || username.length < 3) {
            res.status(400).json({ error: 'Username must be at least 3 characters' });
            return;
        }
        if (!/^[a-z0-9._-]+$/.test(username)) {
            res.status(400).json({
                error: 'Username may only use letters, numbers, dots, underscores, hyphens',
            });
            return;
        }
        if (!password || password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const existing = await db_1.pool.query('SELECT id FROM church_members WHERE id = $1 AND church_id = $2', [id, churchId]);
        if (existing.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        const taken = await db_1.pool.query(`SELECT id FROM church_members
       WHERE church_id = $1 AND LOWER(username) = $2 AND id <> $3`, [churchId, username, id]);
        if (taken.rows.length > 0) {
            res.status(409).json({ error: 'That username is already taken' });
            return;
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        const result = await db_1.pool.query(`UPDATE church_members
       SET username = $1,
           password_hash = $2,
           credentials_set = true
       WHERE id = $3 AND church_id = $4
       RETURNING id, first_name, last_name, email, phone, username,
                 credentials_set, membership_status, member_role`, [username, hash, id, churchId]);
        const member = result.rows[0];
        const actor = req.churchUser;
        await (0, audit_1.writeAudit)({
            churchId,
            actorType: 'staff',
            actorId: actor?.id ?? null,
            actorName: actor
                ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim()
                : null,
            action: 'member.credentials',
            entityType: 'church_member',
            entityId: member.id,
            summary: `Set login for ${member.first_name} ${member.last_name} (@${member.username})`,
        });
        res.json({ ok: true, member });
    }
    catch (err) {
        console.error('Set member credentials error:', err);
        const pgErr = err;
        if (pgErr.code === '23505') {
            res.status(409).json({ error: 'That username is already taken' });
            return;
        }
        res.status(500).json({ error: 'Failed to set member credentials' });
    }
});
/**
 * PUT /api/members/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const existing = await db_1.pool.query('SELECT * FROM church_members WHERE id = $1 AND church_id = $2', [id, churchId]);
        if (existing.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        const current = existing.rows[0];
        const body = req.body;
        const first_name = body.first_name ?? current.first_name;
        const last_name = body.last_name ?? current.last_name;
        let marketplace_slug = current.marketplace_slug;
        if ((body.first_name && body.first_name !== current.first_name) ||
            (body.last_name && body.last_name !== current.last_name)) {
            marketplace_slug = await uniqueMarketplaceSlug((0, slug_1.generateSlug)(`${first_name} ${last_name}`), id);
        }
        const result = await db_1.pool.query(`UPDATE church_members SET
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
       RETURNING *`, [
            first_name,
            last_name,
            body.other_names !== undefined ? body.other_names : current.other_names,
            body.email !== undefined ? body.email : current.email,
            body.phone !== undefined ? body.phone : current.phone,
            body.whatsapp !== undefined ? body.whatsapp : current.whatsapp,
            body.gender !== undefined ? body.gender : current.gender,
            body.date_of_birth !== undefined ? body.date_of_birth : current.date_of_birth,
            body.marital_status !== undefined ? body.marital_status : current.marital_status,
            body.occupation !== undefined ? body.occupation : current.occupation,
            body.address !== undefined ? body.address : current.address,
            body.city !== undefined ? body.city : current.city,
            body.avatar_url !== undefined ? body.avatar_url : current.avatar_url,
            body.department !== undefined ? body.department : current.department,
            body.ministry !== undefined ? body.ministry : current.ministry,
            body.cell_group !== undefined ? body.cell_group : current.cell_group,
            body.membership_status !== undefined
                ? body.membership_status
                : current.membership_status,
            body.membership_date !== undefined
                ? body.membership_date
                : current.membership_date,
            body.baptism_date !== undefined ? body.baptism_date : current.baptism_date,
            marketplace_slug,
            id,
            churchId,
        ]);
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Update member error:', err);
        const pgErr = err;
        if (pgErr.code === '23505') {
            res.status(409).json({ error: 'Email or marketplace slug conflict' });
            return;
        }
        res.status(500).json({ error: 'Failed to update member' });
    }
});
/**
 * DELETE /api/members/:id — soft delete
 */
router.delete('/:id', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const result = await db_1.pool.query(`UPDATE church_members
       SET membership_status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND church_id = $2
       RETURNING *`, [id, churchId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        res.json({ message: 'Member deactivated', member: result.rows[0] });
    }
    catch (err) {
        console.error('Delete member error:', err);
        res.status(500).json({ error: 'Failed to deactivate member' });
    }
});
/**
 * POST /api/members/:id/verify
 */
router.post('/:id/verify', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const result = await db_1.pool.query(`UPDATE church_members
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1 AND church_id = $2
       RETURNING *`, [id, churchId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (err) {
        console.error('Verify member error:', err);
        res.status(500).json({ error: 'Failed to verify member' });
    }
});
exports.default = router;
//# sourceMappingURL=members.js.map