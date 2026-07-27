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
const memberPin_1 = require("../utils/memberPin");
const router = (0, express_1.Router)();
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
        whatsapp: member.whatsapp || null,
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
 * Staff: email/username + password
 * Member: phone (0XXXXXXXXX) + 4-digit PIN
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, phone, username, pin, churchSlug } = req.body;
        const identifier = String(email || username || phone || '').trim();
        const secret = String(pin || password || '').trim();
        const resolvedSlug = String(churchSlug || req.churchTenant?.slug || '').toLowerCase();
        if (!identifier || !secret || !resolvedSlug) {
            res.status(400).json({
                error: 'Login id, PIN/password, and churchSlug are required',
            });
            return;
        }
        const tenant = await resolveTenant(req, resolvedSlug);
        if (!tenant) {
            res.status(404).json({ error: 'Church not found' });
            return;
        }
        // Staff path — only when identifier looks like email/username (not a phone-only login)
        const looksLikePhone = (0, memberPin_1.isValidMemberPhone)(identifier) || /^0\d+$/.test((0, memberPin_1.normalizePhone)(identifier));
        if (!looksLikePhone || String(email || username || '').includes('@')) {
            const staffId = String(email || username || identifier).trim();
            const userResult = await db_1.pool.query(`SELECT * FROM church_users
         WHERE church_id = $1
           AND is_active = true
           AND (
             LOWER(email) = LOWER($2)
             OR LOWER(COALESCE(username, '')) = LOWER($2)
           )`, [tenant.id, staffId]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                const valid = await bcryptjs_1.default.compare(secret, user.password_hash);
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
            if (!looksLikePhone) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }
        }
        // Member path — phone + 4-digit PIN
        if (!(0, memberPin_1.isValidMemberPhone)(identifier)) {
            res.status(400).json({
                error: 'Phone must start with 0 and be 10 digits (e.g. 0244123456)',
            });
            return;
        }
        if (!(0, memberPin_1.isValidPin)(secret)) {
            res.status(400).json({ error: 'PIN must be exactly 4 digits' });
            return;
        }
        const normalized = (0, memberPin_1.normalizePhone)(identifier);
        const variants = (0, memberPin_1.phoneVariants)(normalized);
        const memberResult = await db_1.pool.query(`SELECT * FROM church_members
       WHERE church_id = $1
         AND membership_status = 'active'
         AND (
           regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($2::text[])
           OR RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 9) = ANY($2::text[])
         )`, [tenant.id, variants]);
        if (memberResult.rows.length === 0) {
            res.status(401).json({ error: 'Invalid phone or PIN' });
            return;
        }
        const member = memberResult.rows[0];
        // Ensure phone stored in 0… form
        if ((0, memberPin_1.normalizePhone)(member.phone || '') !== normalized) {
            await db_1.pool.query(`UPDATE church_members SET phone = $1, updated_at = NOW() WHERE id = $2`, [normalized, member.id]);
            member.phone = normalized;
        }
        if (!member.password_hash || !member.credentials_set) {
            const defaultPin = (0, memberPin_1.defaultPinFromPhone)(normalized);
            if (!defaultPin) {
                res.status(403).json({
                    error: 'Login not ready. Ask your church admin to reset your PIN.',
                    code: 'NEEDS_PIN_RESET',
                });
                return;
            }
            const hash = await (0, memberPin_1.hashPin)(defaultPin);
            await db_1.pool.query(`UPDATE church_members
         SET password_hash = $1, credentials_set = true, updated_at = NOW()
         WHERE id = $2`, [hash, member.id]);
            member.password_hash = hash;
            member.credentials_set = true;
        }
        const memberValid = await (0, memberPin_1.verifyPin)(secret, member.password_hash);
        if (!memberValid) {
            // Migrate legacy demo hashes (password123) → phone last-4 PIN
            const defaultPin = (0, memberPin_1.defaultPinFromPhone)(normalized);
            let legacyOk = false;
            try {
                legacyOk = await bcryptjs_1.default.compare('password123', member.password_hash);
            }
            catch {
                legacyOk = false;
            }
            if (legacyOk && defaultPin && secret === defaultPin) {
                const nextHash = await (0, memberPin_1.hashPin)(defaultPin);
                await db_1.pool.query(`UPDATE church_members
           SET password_hash = $1, credentials_set = true, updated_at = NOW()
           WHERE id = $2`, [nextHash, member.id]);
                member.password_hash = nextHash;
                member.credentials_set = true;
            }
            else {
                res.status(401).json({ error: 'Invalid phone or PIN' });
                return;
            }
        }
        await db_1.pool.query('UPDATE church_members SET last_login = NOW() WHERE id = $1', [member.id]);
        const { password_hash: _ph, ...safeMember } = member;
        res.json({
            token: signMemberToken(member, false),
            accountType: 'member',
            needsSetup: false,
            user: memberUserPayload({ ...member, credentials_set: true }),
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
 * POST /api/auth/member/change-pin
 * Member changes their 4-digit PIN.
 */
router.post('/member/change-pin', churchAuth_1.requireChurchAuth, async (req, res) => {
    try {
        if (req.accountType !== 'member') {
            res.status(403).json({ error: 'Members only' });
            return;
        }
        const currentPin = String(req.body.current_pin || req.body.current_password || '');
        const newPin = String(req.body.new_pin || req.body.new_password || '');
        if (!(0, memberPin_1.isValidPin)(currentPin) || !(0, memberPin_1.isValidPin)(newPin)) {
            res.status(400).json({ error: 'PIN must be exactly 4 digits' });
            return;
        }
        const result = await db_1.pool.query(`SELECT id, password_hash, phone FROM church_members
         WHERE id = $1 AND church_id = $2`, [req.churchUser.id, req.churchUser.church_id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        const row = result.rows[0];
        if (!row.password_hash || !(await (0, memberPin_1.verifyPin)(currentPin, row.password_hash))) {
            res.status(401).json({ error: 'Current PIN is incorrect' });
            return;
        }
        const hash = await (0, memberPin_1.hashPin)(newPin);
        const updated = await db_1.pool.query(`UPDATE church_members
         SET password_hash = $1, credentials_set = true, updated_at = NOW()
         WHERE id = $2
         RETURNING *`, [hash, row.id]);
        const member = updated.rows[0];
        const { password_hash: _, ...safeMember } = member;
        res.json({
            ok: true,
            user: memberUserPayload(member),
            member: safeMember,
        });
    }
    catch (err) {
        console.error('Change PIN error:', err);
        res.status(500).json({ error: 'Failed to change PIN' });
    }
});
/* Legacy first-login kept for compatibility — prefer phone + PIN login */
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
        const variants = (0, memberPin_1.phoneVariants)(phoneRaw);
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
            const full = await db_1.pool.query(`SELECT username, member_role, credentials_set, phone, whatsapp, marketplace_slug,
                department, ministry, cell_group, membership_date, is_verified,
                avatar_url
         FROM church_members WHERE id = $1`, [user.id]);
            const row = full.rows[0] || {};
            // Phone + PIN model — no setup page; PIN auto-created from phone last 4
            needsSetup = false;
            enriched = {
                ...user,
                username: row.username,
                phone: row.phone,
                whatsapp: row.whatsapp || null,
                member_role: row.member_role || 'member',
                role: row.member_role || 'member',
                credentials_set: Boolean(row.credentials_set),
                marketplace_slug: row.marketplace_slug,
                department: row.department || null,
                ministry: row.ministry || null,
                cell_group: row.cell_group || null,
                membership_date: row.membership_date || null,
                is_verified: Boolean(row.is_verified),
                avatar_url: row.avatar_url ?? user.avatar_url,
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
 * Members: change 4-digit PIN (current_pin + new_pin).
 * Pastor/admin staff: church profile fields.
 */
router.put('/me', churchAuth_1.requireChurchAuth, async (req, res) => {
    try {
        const user = req.churchUser;
        const churchId = user.church_id;
        if (req.accountType === 'member') {
            // Allow WhatsApp-only update without changing PIN
            if (req.body.whatsapp !== undefined &&
                !req.body.current_pin &&
                !req.body.current_password &&
                !req.body.new_pin &&
                !req.body.new_password &&
                !req.body.password) {
                let whatsapp = String(req.body.whatsapp || '').trim();
                if (whatsapp) {
                    const digits = whatsapp.replace(/\D/g, '');
                    let n = digits;
                    if (n.startsWith('233') && n.length >= 12)
                        n = `0${n.slice(3)}`;
                    else if (n.length === 9)
                        n = `0${n}`;
                    if (!/^0\d{9}$/.test(n)) {
                        res.status(400).json({
                            error: 'WhatsApp must start with 0 (e.g. 0244123456)',
                        });
                        return;
                    }
                    whatsapp = n;
                }
                else {
                    whatsapp = '';
                }
                const updated = await db_1.pool.query(`UPDATE church_members
           SET whatsapp = NULLIF($1, ''), updated_at = NOW()
           WHERE id = $2 AND church_id = $3
           RETURNING *`, [whatsapp, user.id, churchId]);
                if (updated.rows.length === 0) {
                    res.status(404).json({ error: 'Member not found' });
                    return;
                }
                const member = updated.rows[0];
                const { password_hash: _, ...safeMember } = member;
                res.json({
                    ok: true,
                    user: memberUserPayload(member),
                    member: safeMember,
                    accountType: 'member',
                });
                return;
            }
            const currentPin = String(req.body.current_pin || req.body.current_password || '').trim();
            const newPin = String(req.body.new_pin || req.body.new_password || req.body.password || '').trim();
            if (!(0, memberPin_1.isValidPin)(currentPin)) {
                res.status(400).json({ error: 'Current PIN must be 4 digits' });
                return;
            }
            if (!(0, memberPin_1.isValidPin)(newPin)) {
                res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
                return;
            }
            const existing = await db_1.pool.query(`SELECT id, password_hash FROM church_members WHERE id = $1 AND church_id = $2`, [user.id, churchId]);
            if (existing.rows.length === 0) {
                res.status(404).json({ error: 'Member not found' });
                return;
            }
            const row = existing.rows[0];
            if (!row.password_hash || !(await (0, memberPin_1.verifyPin)(currentPin, row.password_hash))) {
                res.status(401).json({ error: 'Current PIN is incorrect' });
                return;
            }
            const nextHash = await (0, memberPin_1.hashPin)(newPin);
            const updated = await db_1.pool.query(`UPDATE church_members
         SET password_hash = $1, credentials_set = true, updated_at = NOW()
         WHERE id = $2 AND church_id = $3
         RETURNING *`, [nextHash, user.id, churchId]);
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
            'youtube_url',
            'visit_welcome',
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
 * POST /api/auth/me/avatar
 * Member or staff upload for personal profile photo.
 */
router.post('/me/avatar', churchAuth_1.requireChurchAuth, upload_1.upload.single('avatar'), async (req, res) => {
    try {
        const avatarUrl = (0, upload_1.uploadedFilePublicUrl)(req.file);
        if (!avatarUrl) {
            res.status(400).json({
                error: 'Profile photo is required (JPEG, PNG, or WebP)',
            });
            return;
        }
        const user = req.churchUser;
        const churchId = user.church_id;
        if (req.accountType === 'member') {
            const result = await db_1.pool.query(`UPDATE church_members
           SET avatar_url = $1, updated_at = NOW()
           WHERE id = $2 AND church_id = $3
           RETURNING *`, [avatarUrl, user.id, churchId]);
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Member not found' });
                return;
            }
            res.json({
                ok: true,
                user: memberUserPayload(result.rows[0]),
                accountType: 'member',
            });
            return;
        }
        const result = await db_1.pool.query(`UPDATE church_users
         SET avatar_url = $1
         WHERE id = $2 AND church_id = $3
         RETURNING id, church_id, first_name, last_name, email, phone,
                   role, avatar_url, is_active, last_login, created_at`, [avatarUrl, user.id, churchId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            ok: true,
            user: result.rows[0],
            accountType: 'staff',
        });
    }
    catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Failed to upload profile photo' });
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