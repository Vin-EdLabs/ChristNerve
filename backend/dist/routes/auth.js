"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
function normalizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('233') && digits.length >= 12) {
        digits = `0${digits.slice(3)}`;
    }
    if (digits.length === 9 && !digits.startsWith('0')) {
        digits = `0${digits}`;
    }
    return digits;
}
function phoneVariants(raw) {
    const n = normalizePhone(raw);
    const last9 = n.slice(-9);
    const variants = new Set([n, last9, `0${last9}`, `233${last9}`]);
    return [...variants].filter(Boolean);
}
function tenantPayload(tenant) {
    return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        tagline: tenant.tagline,
        city: tenant.city,
        denomination: tenant.denomination,
        subscription_status: tenant.subscription_status,
        brand_color: tenant.brand_color || '#2D1B69',
        secondary_color: tenant.secondary_color || '#C4A035',
        short_name: tenant.short_name || null,
    };
}
function memberUserPayload(member) {
    return {
        id: member.id,
        church_id: member.church_id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        username: member.username,
        role: member.member_role || 'member',
        member_role: member.member_role || 'member',
        avatar_url: member.avatar_url,
        marketplace_slug: member.marketplace_slug,
        department: member.department || null,
        ministry: member.ministry || null,
        cell_group: member.cell_group || null,
        membership_date: member.membership_date || null,
        is_verified: Boolean(member.is_verified),
        credentials_set: Boolean(member.credentials_set),
    };
}
function signMemberToken(member, needsSetup = false) {
    return jsonwebtoken_1.default.sign({
        userId: member.id,
        churchId: member.church_id,
        role: 'member',
        accountType: 'member',
        memberId: member.id,
        needsSetup,
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
async function resolveTenant(req, churchSlug) {
    const resolvedSlug = String(churchSlug || req.churchTenant?.slug || '').toLowerCase();
    if (!resolvedSlug)
        return null;
    const tenantResult = await db_1.pool.query('SELECT * FROM church_tenants WHERE slug = $1 AND is_active = true', [resolvedSlug]);
    return tenantResult.rows[0] || null;
}
/**
 * POST /api/auth/login
 * Staff: email + password
 * Member: phone|username|email + password (after credentials set)
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, phone, username, churchSlug } = req.body;
        const identifier = String(email || username || phone || '').trim();
        const resolvedSlug = String(churchSlug || req.churchTenant?.slug || '').toLowerCase();
        if (!identifier || !password || !resolvedSlug) {
            res.status(400).json({
                error: 'Login id, password, and churchSlug are required',
            });
            return;
        }
        const tenant = await resolveTenant(req, resolvedSlug);
        if (!tenant) {
            res.status(404).json({ error: 'Church not found' });
            return;
        }
        const userResult = await db_1.pool.query(`SELECT * FROM church_users
       WHERE church_id = $1
         AND is_active = true
         AND (
           LOWER(email) = LOWER($2)
           OR LOWER(COALESCE(username, '')) = LOWER($2)
         )`, [tenant.id, identifier]);
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const valid = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!valid) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }
            await db_1.pool.query('UPDATE church_users SET last_login = NOW() WHERE id = $1', [user.id]);
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                churchId: tenant.id,
                role: user.role,
                accountType: 'staff',
            }, process.env.JWT_SECRET, { expiresIn: '7d' });
            const { password_hash: _, ...safeUser } = user;
            res.json({
                token,
                accountType: 'staff',
                needsSetup: false,
                user: safeUser,
                tenant: tenantPayload(tenant),
            });
            return;
        }
        const variants = phoneVariants(identifier);
        const memberResult = await db_1.pool.query(`SELECT * FROM church_members
       WHERE church_id = $1
         AND membership_status = 'active'
         AND (
           LOWER(COALESCE(email, '')) = LOWER($2)
           OR LOWER(COALESCE(username, '')) = LOWER($2)
           OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($3::text[])
           OR RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 9) = ANY($3::text[])
           OR RIGHT(regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g'), 9) = ANY($3::text[])
         )`, [tenant.id, identifier, variants]);
        if (memberResult.rows.length === 0) {
            res.status(401).json({ error: 'Invalid login or password' });
            return;
        }
        const member = memberResult.rows[0];
        if (!member.password_hash || !member.credentials_set) {
            res.status(403).json({
                error: 'Login not set yet. Ask your church admin to set your username and password in Users.',
                code: 'NEEDS_FIRST_LOGIN',
            });
            return;
        }
        const memberValid = await bcryptjs_1.default.compare(password, member.password_hash);
        if (!memberValid) {
            res.status(401).json({ error: 'Invalid login or password' });
            return;
        }
        await db_1.pool.query('UPDATE church_members SET last_login = NOW() WHERE id = $1', [member.id]);
        const { password_hash: _ph, ...safeMember } = member;
        res.json({
            token: signMemberToken(member, false),
            accountType: 'member',
            needsSetup: false,
            user: memberUserPayload(member),
            member: safeMember,
            tenant: tenantPayload(tenant),
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});
/**
 * POST /api/auth/member/first-login
 * Body: { first_name, phone, churchSlug }
 * First-time access with name + phone, then set username/password.
 */
router.post('/member/first-login', async (req, res) => {
    try {
        const { first_name, phone, churchSlug } = req.body;
        const firstName = String(first_name || '').trim();
        const phoneRaw = String(phone || '').trim();
        if (!firstName || !phoneRaw) {
            res.status(400).json({ error: 'first_name and phone are required' });
            return;
        }
        const tenant = await resolveTenant(req, churchSlug);
        if (!tenant) {
            res.status(404).json({ error: 'Church not found' });
            return;
        }
        const variants = phoneVariants(phoneRaw);
        const result = await db_1.pool.query(`SELECT * FROM church_members
       WHERE church_id = $1
         AND membership_status = 'active'
         AND LOWER(first_name) = LOWER($2)
         AND (
           regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($3::text[])
           OR RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 9) = ANY($3::text[])
           OR regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g') = ANY($3::text[])
           OR RIGHT(regexp_replace(COALESCE(whatsapp, ''), '\\D', '', 'g'), 9) = ANY($3::text[])
         )
       LIMIT 1`, [tenant.id, firstName, variants]);
        if (result.rows.length === 0) {
            res.status(404).json({
                error: 'No member found with that first name and phone for this church',
            });
            return;
        }
        const member = result.rows[0];
        const needsSetup = !member.credentials_set || !member.password_hash;
        await db_1.pool.query('UPDATE church_members SET last_login = NOW() WHERE id = $1', [member.id]);
        const { password_hash: _, ...safeMember } = member;
        res.json({
            token: signMemberToken(member, needsSetup),
            accountType: 'member',
            needsSetup,
            user: memberUserPayload({ ...member, credentials_set: !needsSetup }),
            member: safeMember,
            tenant: tenantPayload(tenant),
        });
    }
    catch (err) {
        console.error('Member first-login error:', err);
        res.status(500).json({ error: 'Member login failed' });
    }
});
/**
 * POST /api/auth/member/setup-credentials
 * Body: { username, password }
 */
router.post('/member/setup-credentials', churchAuth_1.requireChurchAuth, async (req, res) => {
    try {
        if (req.accountType !== 'member') {
            res.status(403).json({ error: 'Members only' });
            return;
        }
        const username = String(req.body.username || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '');
        const password = String(req.body.password || '');
        if (username.length < 3) {
            res.status(400).json({ error: 'Username must be at least 3 characters' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const memberId = req.churchUser.id;
        const churchId = req.churchUser.church_id;
        const hash = await bcryptjs_1.default.hash(password, 10);
        const clash = await db_1.pool.query(`SELECT id FROM church_members
         WHERE church_id = $1 AND LOWER(username) = LOWER($2) AND id <> $3`, [churchId, username, memberId]);
        if (clash.rows.length > 0) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }
        const updated = await db_1.pool.query(`UPDATE church_members
         SET username = $1,
             password_hash = $2,
             credentials_set = true,
             member_role = COALESCE(NULLIF(member_role, ''), 'member')
         WHERE id = $3 AND church_id = $4
         RETURNING *`, [username, hash, memberId, churchId]);
        const member = updated.rows[0];
        const { password_hash: _, ...safeMember } = member;
        res.json({
            ok: true,
            needsSetup: false,
            token: signMemberToken(member, false),
            user: memberUserPayload(member),
            member: safeMember,
        });
    }
    catch (err) {
        console.error('Setup credentials error:', err);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});
router.get('/me', churchAuth_1.requireChurchAuth, async (req, res) => {
    try {
        const user = req.churchUser;
        const tenantResult = await db_1.pool.query('SELECT * FROM church_tenants WHERE id = $1', [user.church_id]);
        if (tenantResult.rows.length === 0) {
            res.status(404).json({ error: 'Church not found' });
            return;
        }
        const tenant = tenantResult.rows[0];
        let needsSetup = false;
        let enriched = { ...user };
        if (req.accountType === 'member') {
            const full = await db_1.pool.query(`SELECT username, member_role, credentials_set, phone, marketplace_slug,
                department, ministry, cell_group, membership_date, is_verified
         FROM church_members WHERE id = $1`, [user.id]);
            const row = full.rows[0] || {};
            needsSetup = !row.credentials_set;
            enriched = {
                ...user,
                username: row.username,
                phone: row.phone,
                member_role: row.member_role || 'member',
                role: row.member_role || 'member',
                credentials_set: Boolean(row.credentials_set),
                marketplace_slug: row.marketplace_slug,
                department: row.department || null,
                ministry: row.ministry || null,
                cell_group: row.cell_group || null,
                membership_date: row.membership_date || null,
                is_verified: Boolean(row.is_verified),
            };
        }
        const { password_hash: _, ...safeUser } = enriched;
        res.json({
            user: safeUser,
            accountType: req.accountType || 'staff',
            needsSetup,
            tenant: tenantPayload(tenant),
        });
    }
    catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
/**
 * PUT /api/auth/me
 * Members: username + password only.
 * Pastor/admin staff: church profile fields.
 */
router.put('/me', churchAuth_1.requireChurchAuth, async (req, res) => {
    try {
        const user = req.churchUser;
        const churchId = user.church_id;
        if (req.accountType === 'member') {
            const usernameRaw = req.body.username;
            const currentPassword = String(req.body.current_password || '');
            const newPassword = String(req.body.new_password || req.body.password || '');
            if (!currentPassword) {
                res.status(400).json({ error: 'Current password is required' });
                return;
            }
            const existing = await db_1.pool.query(`SELECT id, username, password_hash, credentials_set, first_name, last_name,
                member_role, phone, marketplace_slug
         FROM church_members WHERE id = $1 AND church_id = $2`, [user.id, churchId]);
            if (existing.rows.length === 0) {
                res.status(404).json({ error: 'Member not found' });
                return;
            }
            const row = existing.rows[0];
            if (!row.password_hash) {
                res.status(400).json({ error: 'Set up your credentials first' });
                return;
            }
            const ok = await bcryptjs_1.default.compare(currentPassword, row.password_hash);
            if (!ok) {
                res.status(401).json({ error: 'Current password is incorrect' });
                return;
            }
            let nextUsername = row.username;
            if (usernameRaw !== undefined && usernameRaw !== null) {
                nextUsername = String(usernameRaw)
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]/g, '');
                if (nextUsername.length < 3) {
                    res.status(400).json({ error: 'Username must be at least 3 characters' });
                    return;
                }
                const clash = await db_1.pool.query(`SELECT id FROM church_members
           WHERE church_id = $1 AND LOWER(username) = LOWER($2) AND id <> $3`, [churchId, nextUsername, user.id]);
                if (clash.rows.length > 0) {
                    res.status(409).json({ error: 'Username already taken' });
                    return;
                }
            }
            let nextHash = row.password_hash;
            if (newPassword) {
                if (newPassword.length < 6) {
                    res.status(400).json({ error: 'New password must be at least 6 characters' });
                    return;
                }
                nextHash = await bcryptjs_1.default.hash(newPassword, 10);
            }
            const updated = await db_1.pool.query(`UPDATE church_members
         SET username = $1,
             password_hash = $2,
             credentials_set = true
         WHERE id = $3 AND church_id = $4
         RETURNING *`, [nextUsername, nextHash, user.id, churchId]);
            const member = updated.rows[0];
            const { password_hash: _, ...safeMember } = member;
            res.json({
                ok: true,
                token: signMemberToken(member, false),
                user: memberUserPayload(member),
                member: safeMember,
                accountType: 'member',
            });
            return;
        }
        const role = String(user.role || '').toLowerCase();
        if (role !== 'pastor' && role !== 'admin' && role !== 'super-admin') {
            res.status(403).json({ error: 'Only pastors and admins can edit church profile' });
            return;
        }
        const church = req.body.church || req.body;
        const fields = [
            'name',
            'tagline',
            'description',
            'phone',
            'email',
            'address',
            'city',
            'region',
            'denomination',
            'logo_url',
        ];
        const sets = [];
        const values = [];
        let i = 1;
        for (const key of fields) {
            if (church[key] !== undefined) {
                sets.push(`${key} = $${i++}`);
                values.push(church[key]);
            }
        }
        if (sets.length === 0) {
            res.status(400).json({ error: 'No church fields to update' });
            return;
        }
        values.push(churchId);
        const result = await db_1.pool.query(`UPDATE church_tenants SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`, values);
        res.json({
            ok: true,
            tenant: tenantPayload(result.rows[0]),
            accountType: 'staff',
        });
    }
    catch (err) {
        console.error('Update me error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
/**
 * POST /api/auth/church/logo
 * Pastor/admin upload for church logo (shown on login).
 */
router.post('/church/logo', churchAuth_1.requireChurchAuth, upload_1.upload.single('logo'), async (req, res) => {
    try {
        if (!req.churchUser || req.accountType === 'member') {
            res.status(403).json({ error: 'Staff only' });
            return;
        }
        const role = String(req.churchUser.role || '').toLowerCase();
        if (role !== 'pastor' && role !== 'admin' && role !== 'super-admin') {
            res.status(403).json({ error: 'Only pastors and admins can update the church logo' });
            return;
        }
        const logoUrl = (0, upload_1.uploadedFilePublicUrl)(req.file);
        if (!logoUrl) {
            res.status(400).json({ error: 'Logo image is required (JPEG, PNG, or WebP)' });
            return;
        }
        const churchId = req.churchTenant.id;
        const result = await db_1.pool.query(`UPDATE church_tenants SET logo_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`, [logoUrl, churchId]);
        res.json({
            ok: true,
            tenant: tenantPayload(result.rows[0]),
        });
    }
    catch (err) {
        console.error('Church logo upload error:', err);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
router.post('/superadmin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'email and password are required' });
            return;
        }
        const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@christnerve.com';
        const adminPassword = process.env.SUPERADMIN_PASSWORD || 'password123';
        if (String(email).toLowerCase() !== adminEmail.toLowerCase() ||
            password !== adminPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ role: 'super-admin', email: adminEmail }, process.env.SUPERADMIN_JWT_SECRET, { expiresIn: '12h' });
        res.json({
            token,
            user: {
                email: adminEmail,
                role: 'super-admin',
                first_name: 'Super',
                last_name: 'Admin',
            },
        });
    }
    catch (err) {
        console.error('Superadmin login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map