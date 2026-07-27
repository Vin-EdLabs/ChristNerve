"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireChurchTenant = exports.resolveChurchTenant = void 0;
const db_1 = require("../db");
const PLATFORM_SUBDOMAINS = new Set([
    'christnerve',
    'app',
    'www',
    'api',
    'localhost',
]);
function slugFromHost(hostHeader) {
    const host = hostHeader.split(':')[0].toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1')
        return null;
    const parts = host.split('.').filter(Boolean);
    if (parts.length < 2)
        return null;
    const sub = parts[0];
    if (PLATFORM_SUBDOMAINS.has(sub))
        return null;
    return sub;
}
const resolveChurchTenant = async (req, res, next) => {
    try {
        let slug = slugFromHost(req.headers.host || '');
        const headerSlug = req.headers['x-church-slug'];
        if (!slug && typeof headerSlug === 'string' && headerSlug.trim()) {
            slug = headerSlug.trim().toLowerCase();
        }
        if (!slug) {
            next();
            return;
        }
        const result = await db_1.pool.query('SELECT * FROM church_tenants WHERE slug = $1 AND is_active = true', [slug]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Church not found' });
            return;
        }
        req.churchTenant = result.rows[0];
        next();
    }
    catch (err) {
        next(err);
    }
};
exports.resolveChurchTenant = resolveChurchTenant;
const requireChurchTenant = (req, res, next) => {
    if (!req.churchTenant) {
        res.status(400).json({
            error: 'Church tenant required. Use a church subdomain (e.g. pka.localhost) or X-Church-Slug header.',
        });
        return;
    }
    next();
};
exports.requireChurchTenant = requireChurchTenant;
//# sourceMappingURL=churchTenant.js.map