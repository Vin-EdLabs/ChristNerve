"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.requireChurchAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const requireChurchAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (decoded.accountType === 'member' || decoded.role === 'member') {
            const result = await db_1.pool.query(`SELECT id, church_id, first_name, last_name, email, phone, avatar_url,
                marketplace_slug, membership_status, username, member_role,
                credentials_set
         FROM church_members
         WHERE id = $1 AND membership_status = 'active'`, [decoded.userId]);
            if (result.rows.length === 0) {
                res.status(401).json({ error: 'Member not found' });
                return;
            }
            const member = result.rows[0];
            if (req.churchTenant && member.church_id !== req.churchTenant.id) {
                res.status(403).json({ error: 'Member does not belong to this church' });
                return;
            }
            req.accountType = 'member';
            req.churchUser = {
                id: member.id,
                church_id: member.church_id,
                first_name: member.first_name,
                last_name: member.last_name,
                email: member.email || member.username || '',
                phone: member.phone,
                role: member.member_role || 'member',
                avatar_url: member.avatar_url,
                marketplace_slug: member.marketplace_slug,
                is_active: true,
            };
            next();
            return;
        }
        const result = await db_1.pool.query('SELECT * FROM church_users WHERE id = $1 AND is_active = true', [decoded.userId]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const user = result.rows[0];
        if (req.churchTenant && user.church_id !== req.churchTenant.id) {
            res.status(403).json({ error: 'User does not belong to this church' });
            return;
        }
        req.accountType = 'staff';
        req.churchUser = user;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.requireChurchAuth = requireChurchAuth;
const requireSuperAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.SUPERADMIN_JWT_SECRET);
        if (decoded.role !== 'super-admin') {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        req.superAdmin = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.requireSuperAdmin = requireSuperAdmin;
//# sourceMappingURL=churchAuth.js.map