"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireChurchTenant = exports.resolveChurchTenant = void 0;
const db_1 = require("../db");
function normalizeSlug(value) {
    if (!value)
        return null;
    const slug = String(value).trim().toLowerCase();
    return slug || null;
}
/**
 * Resolve church slug from:
 * 1) Production host ch-{slug}.scholarnerve.com
 * 2) ?church= query (localhost / tools)
 * 3) X-Church-Slug header (SPA → API)
 */
function resolveSlug(req) {
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '');
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
        const fromQuery = normalizeSlug(req.query.church);
        if (fromQuery)
            return fromQuery;
    }
    // SPA always sends this when a church is active
    const headerSlug = req.headers['x-church-slug'];
    if (typeof headerSlug === 'string') {
        return normalizeSlug(headerSlug);
    }
    return null;
}
const resolveChurchTenant = async (req, res, next) => {
    try {
        const churchSlug = resolveSlug(req);
        if (!churchSlug) {
            next();
            return;
        }
        const result = await db_1.pool.query('SELECT * FROM church_tenants WHERE slug = $1 AND is_active = true', [churchSlug]);
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
            error: 'Church tenant required. Use ch-{slug}.scholarnerve.com, ?church=slug on localhost, or X-Church-Slug header.',
        });
        return;
    }
    next();
};
exports.requireChurchTenant = requireChurchTenant;
//# sourceMappingURL=churchTenant.js.map