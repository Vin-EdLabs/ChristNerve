"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const churchTenant_1 = require("../middleware/churchTenant");
const audit_1 = require("../services/audit");
const router = (0, express_1.Router)();
router.use(churchTenant_1.requireChurchTenant, churchAuth_1.requireChurchAuth);
/**
 * GET /api/attendance/stats — before /:id
 */
router.get('/stats', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const avgResult = await db_1.pool.query(`SELECT COALESCE(AVG(total_count), 0)::numeric(10,1) AS average_last_3_months
       FROM church_attendance
       WHERE church_id = $1
         AND service_date >= (CURRENT_DATE - INTERVAL '3 months')`, [churchId]);
        const bestResult = await db_1.pool.query(`SELECT * FROM church_attendance
       WHERE church_id = $1
       ORDER BY total_count DESC, service_date DESC
       LIMIT 1`, [churchId]);
        const thisMonth = await db_1.pool.query(`SELECT COALESCE(AVG(total_count), 0)::numeric(10,1) AS avg
       FROM church_attendance
       WHERE church_id = $1
         AND service_date >= date_trunc('month', CURRENT_DATE)`, [churchId]);
        const lastMonth = await db_1.pool.query(`SELECT COALESCE(AVG(total_count), 0)::numeric(10,1) AS avg
       FROM church_attendance
       WHERE church_id = $1
         AND service_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
         AND service_date < date_trunc('month', CURRENT_DATE)`, [churchId]);
        const trendResult = await db_1.pool.query(`SELECT service_date, service_type, total_count
       FROM church_attendance
       WHERE church_id = $1
         AND (service_type ILIKE '%sunday%' OR service_type ILIKE '%service%')
       ORDER BY service_date DESC
       LIMIT 8`, [churchId]);
        const thisAvg = parseFloat(thisMonth.rows[0].avg);
        const lastAvg = parseFloat(lastMonth.rows[0].avg);
        let trend = 'flat';
        if (thisAvg > lastAvg)
            trend = 'up';
        else if (thisAvg < lastAvg)
            trend = 'down';
        res.json({
            average_last_3_months: parseFloat(avgResult.rows[0].average_last_3_months),
            best_service: bestResult.rows[0] || null,
            this_month_average: thisAvg,
            last_month_average: lastAvg,
            trend,
            recent_sundays: trendResult.rows.reverse(),
        });
    }
    catch (err) {
        console.error('Attendance stats error:', err);
        res.status(500).json({ error: 'Failed to fetch attendance stats' });
    }
});
/**
 * GET /api/attendance
 */
router.get('/', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const from = req.query.from;
        const to = req.query.to;
        const type = req.query.type;
        const conditions = ['a.church_id = $1'];
        const params = [churchId];
        let idx = 2;
        if (from) {
            conditions.push(`a.service_date >= $${idx}`);
            params.push(from);
            idx += 1;
        }
        if (to) {
            conditions.push(`a.service_date <= $${idx}`);
            params.push(to);
            idx += 1;
        }
        if (type) {
            conditions.push(`a.service_type ILIKE $${idx}`);
            params.push(type);
            idx += 1;
        }
        const result = await db_1.pool.query(`SELECT a.*,
              u.first_name AS recorded_by_first_name,
              u.last_name AS recorded_by_last_name
       FROM church_attendance a
       LEFT JOIN church_users u ON u.id = a.recorded_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.service_date DESC, a.id DESC`, params);
        res.json({ data: result.rows });
    }
    catch (err) {
        console.error('List attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});
/**
 * POST /api/attendance
 */
router.post('/', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const userId = req.churchUser.id;
        const { service_type, service_date, men_count = 0, women_count = 0, children_count = 0, visitors_count = 0, notes, } = req.body;
        if (!service_type || !service_date) {
            res.status(400).json({ error: 'service_type and service_date are required' });
            return;
        }
        const men = Number(men_count) || 0;
        const women = Number(women_count) || 0;
        const children = Number(children_count) || 0;
        const visitors = Number(visitors_count) || 0;
        const total_count = men + women + children + visitors;
        const result = await db_1.pool.query(`INSERT INTO church_attendance (
         church_id, service_type, service_date, total_count,
         men_count, women_count, children_count, visitors_count,
         notes, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`, [
            churchId,
            service_type,
            service_date,
            total_count,
            men,
            women,
            children,
            visitors,
            notes || null,
            userId,
        ]);
        const actor = req.churchUser;
        await (0, audit_1.writeAudit)({
            churchId,
            actorType: 'staff',
            actorId: actor.id,
            actorName: `${actor.first_name} ${actor.last_name}`,
            action: 'attendance.create',
            entityType: 'church_attendance',
            entityId: result.rows[0].id,
            summary: `Recorded ${service_type} attendance (${total_count} people)`,
        });
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Create attendance error:', err);
        res.status(500).json({ error: 'Failed to record attendance' });
    }
});
/**
 * GET /api/attendance/mine — member's personal check-in history
 */
router.get('/mine', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        if (req.accountType !== 'member') {
            res.status(403).json({ error: 'Members only' });
            return;
        }
        const memberId = req.churchUser.id;
        const result = await db_1.pool.query(`SELECT cma.id,
              cma.checked_in_at,
              a.id AS attendance_id,
              a.service_type,
              a.service_date,
              a.total_count
       FROM church_member_attendance cma
       JOIN church_attendance a ON a.id = cma.attendance_id
       WHERE cma.church_id = $1 AND cma.member_id = $2
       ORDER BY a.service_date DESC, cma.checked_in_at DESC
       LIMIT 40`, [churchId, memberId]);
        const presentThisMonth = await db_1.pool.query(`SELECT COUNT(*)::int AS count
       FROM church_member_attendance cma
       JOIN church_attendance a ON a.id = cma.attendance_id
       WHERE cma.church_id = $1
         AND cma.member_id = $2
         AND a.service_date >= date_trunc('month', CURRENT_DATE)`, [churchId, memberId]);
        res.json({
            data: result.rows,
            stats: {
                present_this_month: presentThisMonth.rows[0]?.count || 0,
                total_recorded: result.rows.length,
            },
        });
    }
    catch (err) {
        console.error('My attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch your attendance' });
    }
});
/**
 * GET /api/attendance/member/:memberId — last services + present/absent for profile
 */
router.get('/member/:memberId', async (req, res) => {
    try {
        if (req.accountType === 'member') {
            res.status(403).json({ error: 'Staff only' });
            return;
        }
        const churchId = req.churchTenant.id;
        const memberId = parseInt(req.params.memberId, 10);
        if (Number.isNaN(memberId)) {
            res.status(400).json({ error: 'Invalid member id' });
            return;
        }
        const services = await db_1.pool.query(`SELECT a.id, a.service_type, a.service_date,
              EXISTS (
                SELECT 1 FROM church_member_attendance cma
                WHERE cma.attendance_id = a.id AND cma.member_id = $2
              ) AS present
       FROM church_attendance a
       WHERE a.church_id = $1
       ORDER BY a.service_date DESC, a.id DESC
       LIMIT 8`, [churchId, memberId]);
        const presentCount = services.rows.filter((r) => r.present).length;
        const total = services.rows.length;
        let streak = 0;
        for (const row of services.rows) {
            if (row.present)
                streak += 1;
            else
                break;
        }
        res.json({
            data: services.rows,
            stats: {
                present: presentCount,
                total,
                percentage: total ? Math.round((presentCount / total) * 100) : 0,
                streak,
            },
        });
    }
    catch (err) {
        console.error('Member attendance profile error:', err);
        res.status(500).json({ error: 'Failed to fetch member attendance' });
    }
});
/**
 * GET /api/attendance/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid attendance id' });
            return;
        }
        const result = await db_1.pool.query(`SELECT a.*,
              u.first_name AS recorded_by_first_name,
              u.last_name AS recorded_by_last_name
       FROM church_attendance a
       LEFT JOIN church_users u ON u.id = a.recorded_by
       WHERE a.id = $1 AND a.church_id = $2`, [id, churchId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Attendance record not found' });
            return;
        }
        const checkins = await db_1.pool.query(`SELECT cma.*, m.first_name, m.last_name, m.member_number
       FROM church_member_attendance cma
       JOIN church_members m ON m.id = cma.member_id
       WHERE cma.attendance_id = $1 AND cma.church_id = $2
       ORDER BY cma.checked_in_at ASC`, [id, churchId]);
        res.json({
            ...result.rows[0],
            checkins: checkins.rows,
        });
    }
    catch (err) {
        console.error('Get attendance error:', err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});
/**
 * POST /api/attendance/:id/checkin
 */
router.post('/:id/checkin', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const attendanceId = parseInt(req.params.id, 10);
        const { member_id } = req.body;
        if (Number.isNaN(attendanceId) || !member_id) {
            res.status(400).json({ error: 'Valid attendance id and member_id are required' });
            return;
        }
        const attendance = await db_1.pool.query('SELECT id FROM church_attendance WHERE id = $1 AND church_id = $2', [attendanceId, churchId]);
        if (attendance.rows.length === 0) {
            res.status(404).json({ error: 'Attendance record not found' });
            return;
        }
        const member = await db_1.pool.query('SELECT id FROM church_members WHERE id = $1 AND church_id = $2', [member_id, churchId]);
        if (member.rows.length === 0) {
            res.status(404).json({ error: 'Member not found' });
            return;
        }
        const result = await db_1.pool.query(`INSERT INTO church_member_attendance (church_id, attendance_id, member_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (attendance_id, member_id) DO NOTHING
       RETURNING *`, [churchId, attendanceId, member_id]);
        if (result.rows.length === 0) {
            res.status(409).json({ error: 'Member already checked in' });
            return;
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Checkin error:', err);
        res.status(500).json({ error: 'Failed to check in member' });
    }
});
exports.default = router;
//# sourceMappingURL=attendance.js.map