"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const churchTenant_1 = require("../middleware/churchTenant");
const audit_1 = require("../services/audit");
const notifications_1 = require("./notifications");
const router = (0, express_1.Router)();
router.use(churchTenant_1.requireChurchTenant, churchAuth_1.requireChurchAuth);
function staffFinanceOnly(req, res) {
    if (req.accountType === 'member') {
        res.status(403).json({ error: 'Staff only' });
        return false;
    }
    return true;
}
async function notifyFinanceSafe(opts) {
    try {
        await (0, notifications_1.notifyChurchUsers)({
            churchId: opts.churchId,
            userType: 'staff',
            title: opts.title,
            body: opts.body,
            link: opts.link || '/finance',
        });
    }
    catch (err) {
        console.warn('Finance notify failed:', err);
    }
}
async function nextReceiptNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePart = `${yyyy}${mm}${dd}`;
    const prefix = `CNV-${datePart}-`;
    const result = await db_1.pool.query(`SELECT receipt_number FROM church_giving
     WHERE receipt_number LIKE $1
     ORDER BY receipt_number DESC
     LIMIT 1`, [`${prefix}%`]);
    let next = 1;
    if (result.rows.length > 0 && result.rows[0].receipt_number) {
        const last = String(result.rows[0].receipt_number).split('-').pop();
        const n = parseInt(last || '0', 10);
        if (!Number.isNaN(n))
            next = n + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
}
/**
 * GET /api/finance/giving/summary
 */
router.get('/giving/summary', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const byType = await db_1.pool.query(`SELECT giving_type, COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM church_giving
       WHERE church_id = $1
         AND service_date >= date_trunc('month', CURRENT_DATE)
       GROUP BY giving_type
       ORDER BY total DESC`, [churchId]);
        const thisMonthTotal = await db_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM church_giving
       WHERE church_id = $1
         AND service_date >= date_trunc('month', CURRENT_DATE)`, [churchId]);
        const monthlyTrend = await db_1.pool.query(`SELECT to_char(date_trunc('month', service_date), 'YYYY-MM') AS month,
              COALESCE(SUM(amount), 0)::numeric AS total
       FROM church_giving
       WHERE church_id = $1
         AND service_date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY date_trunc('month', service_date)
       ORDER BY month ASC`, [churchId]);
        const topGivers = await db_1.pool.query(`SELECT m.id, m.first_name, m.last_name, m.member_number,
              COALESCE(SUM(g.amount), 0)::numeric AS total
       FROM church_giving g
       JOIN church_members m ON m.id = g.member_id
       WHERE g.church_id = $1
         AND g.service_date >= date_trunc('month', CURRENT_DATE)
         AND g.member_id IS NOT NULL
       GROUP BY m.id, m.first_name, m.last_name, m.member_number
       ORDER BY total DESC
       LIMIT 10`, [churchId]);
        res.json({
            this_month_total: parseFloat(thisMonthTotal.rows[0].total),
            by_type: byType.rows.map((r) => ({
                ...r,
                total: parseFloat(r.total),
            })),
            monthly_trend: monthlyTrend.rows.map((r) => ({
                ...r,
                total: parseFloat(r.total),
            })),
            top_givers: topGivers.rows.map((r) => ({
                ...r,
                total: parseFloat(r.total),
            })),
        });
    }
    catch (err) {
        console.error('Giving summary error:', err);
        res.status(500).json({ error: 'Failed to fetch giving summary' });
    }
});
/**
 * GET /api/finance/giving
 */
router.get('/giving', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const type = req.query.type;
        const from = req.query.from;
        const to = req.query.to;
        const memberId = req.query.member_id;
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const offset = (page - 1) * limit;
        const conditions = ['g.church_id = $1'];
        const params = [churchId];
        let idx = 2;
        if (type) {
            conditions.push(`g.giving_type = $${idx}`);
            params.push(type);
            idx += 1;
        }
        if (from) {
            conditions.push(`g.service_date >= $${idx}`);
            params.push(from);
            idx += 1;
        }
        if (to) {
            conditions.push(`g.service_date <= $${idx}`);
            params.push(to);
            idx += 1;
        }
        if (memberId) {
            conditions.push(`g.member_id = $${idx}`);
            params.push(parseInt(memberId, 10));
            idx += 1;
        }
        const where = conditions.join(' AND ');
        const countResult = await db_1.pool.query(`SELECT COUNT(*)::int AS total FROM church_giving g WHERE ${where}`, params);
        const dataResult = await db_1.pool.query(`SELECT g.*,
              m.first_name, m.last_name, m.member_number
       FROM church_giving g
       LEFT JOIN church_members m ON m.id = g.member_id
       WHERE ${where}
       ORDER BY g.service_date DESC, g.id DESC
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
        console.error('List giving error:', err);
        res.status(500).json({ error: 'Failed to fetch giving records' });
    }
});
/**
 * POST /api/finance/giving
 */
router.post('/giving', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const userId = req.churchUser.id;
        const { member_id, giving_type, amount, payment_method, mobile_money_ref, service_date, notes, currency, } = req.body;
        if (!giving_type || amount === undefined || amount === null) {
            res.status(400).json({ error: 'giving_type and amount are required' });
            return;
        }
        const amt = parseFloat(amount);
        if (Number.isNaN(amt) || amt <= 0) {
            res.status(400).json({ error: 'amount must be a positive number' });
            return;
        }
        if (member_id) {
            const member = await db_1.pool.query('SELECT id FROM church_members WHERE id = $1 AND church_id = $2', [member_id, churchId]);
            if (member.rows.length === 0) {
                res.status(404).json({ error: 'Member not found' });
                return;
            }
        }
        const receipt_number = await nextReceiptNumber();
        const result = await db_1.pool.query(`INSERT INTO church_giving (
         church_id, member_id, giving_type, amount, currency,
         payment_method, mobile_money_ref, service_date, notes,
         recorded_by, receipt_number
       ) VALUES ($1,$2,$3,$4,COALESCE($5,'GHS'),$6,$7,COALESCE($8, CURRENT_DATE),$9,$10,$11)
       RETURNING *`, [
            churchId,
            member_id || null,
            giving_type,
            amt,
            currency || null,
            payment_method || null,
            mobile_money_ref || null,
            service_date || null,
            notes || null,
            userId,
            receipt_number,
        ]);
        const row = result.rows[0];
        await (0, audit_1.writeAudit)({
            churchId,
            actorType: 'staff',
            actorId: userId,
            actorName: `${req.churchUser.first_name} ${req.churchUser.last_name}`,
            action: 'finance.giving',
            entityType: 'giving',
            entityId: row.id,
            summary: `Recorded ${giving_type} of GHS ${amt.toFixed(2)}`,
        });
        await notifyFinanceSafe({
            churchId,
            title: 'Giving recorded',
            body: `${giving_type}: GHS ${amt.toFixed(2)} · Receipt ${receipt_number}`,
            link: '/finance/giving',
        });
        if (member_id) {
            try {
                await (0, notifications_1.notifyChurchUsers)({
                    churchId,
                    userType: 'member',
                    userId: Number(member_id),
                    title: 'Giving received — thank you',
                    body: `Your ${giving_type} of GHS ${amt.toFixed(2)} was recorded.`,
                    link: '/',
                });
            }
            catch {
                /* ignore */
            }
        }
        res.status(201).json(row);
    }
    catch (err) {
        console.error('Create giving error:', err);
        res.status(500).json({ error: 'Failed to record giving' });
    }
});
/**
 * GET /api/finance/expenses
 */
router.get('/expenses', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const category = req.query.category;
        const from = req.query.from;
        const to = req.query.to;
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const offset = (page - 1) * limit;
        const conditions = ['e.church_id = $1'];
        const params = [churchId];
        let idx = 2;
        if (category) {
            conditions.push(`e.category = $${idx}`);
            params.push(category);
            idx += 1;
        }
        if (from) {
            conditions.push(`e.expense_date >= $${idx}`);
            params.push(from);
            idx += 1;
        }
        if (to) {
            conditions.push(`e.expense_date <= $${idx}`);
            params.push(to);
            idx += 1;
        }
        const where = conditions.join(' AND ');
        const countResult = await db_1.pool.query(`SELECT COUNT(*)::int AS total FROM church_expenses e WHERE ${where}`, params);
        const dataResult = await db_1.pool.query(`SELECT e.*,
              u.first_name AS recorded_by_first_name,
              u.last_name AS recorded_by_last_name
       FROM church_expenses e
       LEFT JOIN church_users u ON u.id = e.recorded_by
       WHERE ${where}
       ORDER BY e.expense_date DESC, e.id DESC
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
        console.error('List expenses error:', err);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});
/**
 * POST /api/finance/expenses
 */
router.post('/expenses', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const userId = req.churchUser.id;
        const { category, description, amount, payment_method, expense_date, receipt_url, currency, } = req.body;
        if (!category || !description || amount === undefined || amount === null || !expense_date) {
            res.status(400).json({
                error: 'category, description, amount, and expense_date are required',
            });
            return;
        }
        const amt = parseFloat(amount);
        if (Number.isNaN(amt) || amt <= 0) {
            res.status(400).json({ error: 'amount must be a positive number' });
            return;
        }
        const result = await db_1.pool.query(`INSERT INTO church_expenses (
         church_id, category, description, amount, currency,
         payment_method, expense_date, receipt_url, recorded_by
       ) VALUES ($1,$2,$3,$4,COALESCE($5,'GHS'),$6,$7,$8,$9)
       RETURNING *`, [
            churchId,
            category,
            description,
            amt,
            currency || null,
            payment_method || null,
            expense_date,
            receipt_url || null,
            userId,
        ]);
        const row = result.rows[0];
        await (0, audit_1.writeAudit)({
            churchId,
            actorType: 'staff',
            actorId: userId,
            actorName: `${req.churchUser.first_name} ${req.churchUser.last_name}`,
            action: 'finance.expense',
            entityType: 'expense',
            entityId: row.id,
            summary: `Recorded expense “${category}” of GHS ${amt.toFixed(2)}`,
        });
        await notifyFinanceSafe({
            churchId,
            title: 'Expense recorded',
            body: `${category}: GHS ${amt.toFixed(2)}`,
            link: '/finance/expenses',
        });
        res.status(201).json(row);
    }
    catch (err) {
        console.error('Create expense error:', err);
        res.status(500).json({ error: 'Failed to record expense' });
    }
});
/**
 * GET /api/finance/report
 */
router.get('/report', async (req, res) => {
    try {
        if (!staffFinanceOnly(req, res))
            return;
        const churchId = req.churchTenant.id;
        const now = new Date();
        const month = parseInt(String(req.query.month || now.getMonth() + 1), 10);
        const year = parseInt(String(req.query.year || now.getFullYear()), 10);
        if (month < 1 || month > 12 || Number.isNaN(year)) {
            res.status(400).json({ error: 'Invalid month or year' });
            return;
        }
        const incomeByType = await db_1.pool.query(`SELECT giving_type, COALESCE(SUM(amount), 0)::numeric AS total
       FROM church_giving
       WHERE church_id = $1
         AND EXTRACT(MONTH FROM service_date) = $2
         AND EXTRACT(YEAR FROM service_date) = $3
       GROUP BY giving_type
       ORDER BY total DESC`, [churchId, month, year]);
        const expenseByCategory = await db_1.pool.query(`SELECT category, COALESCE(SUM(amount), 0)::numeric AS total
       FROM church_expenses
       WHERE church_id = $1
         AND EXTRACT(MONTH FROM expense_date) = $2
         AND EXTRACT(YEAR FROM expense_date) = $3
       GROUP BY category
       ORDER BY total DESC`, [churchId, month, year]);
        const incomeTotal = incomeByType.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);
        const expenseTotal = expenseByCategory.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);
        res.json({
            month,
            year,
            income_by_type: incomeByType.rows.map((r) => ({
                ...r,
                total: parseFloat(r.total),
            })),
            expenses_by_category: expenseByCategory.rows.map((r) => ({
                ...r,
                total: parseFloat(r.total),
            })),
            total_income: incomeTotal,
            total_expenses: expenseTotal,
            net_balance: incomeTotal - expenseTotal,
        });
    }
    catch (err) {
        console.error('Finance report error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});
exports.default = router;
//# sourceMappingURL=finance.js.map