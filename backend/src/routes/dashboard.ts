import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';

const router = Router();
router.use(requireChurchTenant, requireChurchAuth);

function staffOnly(req: Request, res: Response): boolean {
  if (req.accountType === 'member') {
    res.status(403).json({ error: 'Staff only' });
    return false;
  }
  return true;
}

/**
 * GET /api/dashboard/home — church-first briefing payload
 */
router.get('/home', async (req: Request, res: Response) => {
  try {
    if (!staffOnly(req, res)) return;
    const churchId = req.churchTenant!.id;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const [
      memberStats,
      attendanceStats,
      givingSummary,
      eventsToday,
      listings,
      prayerPending,
      followPending,
      welfareOpen,
      recentGiving,
      recentMembers,
      recentAttendance,
      attendanceToday,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE membership_status = 'active')::int AS active,
           COUNT(*) FILTER (WHERE membership_status = 'visitor')::int AS visitors,
           COUNT(*) FILTER (WHERE membership_status = 'inactive')::int AS inactive,
           COUNT(*) FILTER (
             WHERE membership_date >= date_trunc('month', CURRENT_DATE)
           )::int AS new_this_month,
           COUNT(*) FILTER (
             WHERE membership_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
               AND membership_date < date_trunc('month', CURRENT_DATE)
           )::int AS new_last_month,
           COUNT(*) FILTER (
             WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
           )::int AS new_this_week
         FROM church_members WHERE church_id = $1`,
        [churchId]
      ),
      pool.query(
        `SELECT total_count, service_date, service_type
         FROM church_attendance
         WHERE church_id = $1
         ORDER BY service_date DESC
         LIMIT 8`,
        [churchId]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (
             WHERE service_date >= date_trunc('month', CURRENT_DATE)
           ), 0)::float AS this_month_total,
           COALESCE(SUM(amount) FILTER (
             WHERE service_date >= date_trunc('month', CURRENT_DATE)
               AND LOWER(giving_type) LIKE '%tithe%'
           ), 0)::float AS tithe,
           COALESCE(SUM(amount) FILTER (
             WHERE service_date >= date_trunc('month', CURRENT_DATE)
               AND LOWER(giving_type) LIKE '%offer%'
           ), 0)::float AS offering,
           COALESCE(SUM(amount) FILTER (
             WHERE service_date >= date_trunc('month', CURRENT_DATE)
               AND (LOWER(giving_type) LIKE '%building%' OR LOWER(giving_type) LIKE '%fund%')
           ), 0)::float AS building,
           COALESCE(SUM(amount) FILTER (
             WHERE service_date >= date_trunc('month', CURRENT_DATE)
               AND LOWER(giving_type) NOT LIKE '%tithe%'
               AND LOWER(giving_type) NOT LIKE '%offer%'
               AND LOWER(giving_type) NOT LIKE '%building%'
               AND LOWER(giving_type) NOT LIKE '%fund%'
           ), 0)::float AS other
         FROM church_giving WHERE church_id = $1`,
        [churchId]
      ),
      pool.query(
        `SELECT id, title, start_datetime, end_datetime, location, event_type
         FROM church_events
         WHERE church_id = $1
           AND start_datetime::date = $2::date
         ORDER BY start_datetime ASC
         LIMIT 10`,
        [churchId, todayStr]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM market_listings
         WHERE church_id = $1 AND is_active = true`,
        [churchId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM church_prayer_requests
         WHERE church_id = $1 AND status = 'pending'`,
        [churchId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM church_follow_ups
         WHERE church_id = $1 AND status = 'pending'`,
        [churchId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM church_welfare_cases
         WHERE church_id = $1 AND status IN ('open', 'in_progress')`,
        [churchId]
      ),
      pool.query(
        `SELECT g.id, g.amount, g.giving_type, g.service_date, g.created_at,
                m.first_name, m.last_name
         FROM church_giving g
         LEFT JOIN church_members m ON m.id = g.member_id
         WHERE g.church_id = $1
         ORDER BY g.created_at DESC
         LIMIT 8`,
        [churchId]
      ),
      pool.query(
        `SELECT id, first_name, last_name, created_at, membership_date
         FROM church_members
         WHERE church_id = $1
         ORDER BY COALESCE(membership_date, created_at) DESC
         LIMIT 5`,
        [churchId]
      ),
      pool.query(
        `SELECT ma.id, a.service_type, a.service_date, ma.checked_in_at,
                m.first_name, m.last_name
         FROM church_member_attendance ma
         JOIN church_attendance a ON a.id = ma.attendance_id
         JOIN church_members m ON m.id = ma.member_id
         WHERE ma.church_id = $1
         ORDER BY ma.checked_in_at DESC
         LIMIT 5`,
        [churchId]
      ),
      pool.query(
        `SELECT id FROM church_attendance
         WHERE church_id = $1 AND service_date = $2::date
         LIMIT 1`,
        [churchId, todayStr]
      ),
    ]);

    const ms = memberStats.rows[0] || {};
    const gs = givingSummary.rows[0] || {};
    const activity: Array<Record<string, unknown>> = [];

    for (const g of recentGiving.rows) {
      const name =
        g.first_name
          ? `${g.first_name} ${g.last_name || ''}`.trim()
          : 'Someone';
      activity.push({
        type: 'giving',
        icon: 'wallet',
        text: `${name} paid ${g.giving_type || 'tithe'} — GHS ${Number(g.amount).toLocaleString()}`,
        at: g.created_at || g.service_date,
        href: '/finance',
      });
    }
    for (const a of recentAttendance.rows) {
      activity.push({
        type: 'attendance',
        icon: 'calendar-check',
        text: `${a.first_name} ${a.last_name} checked in — ${a.service_type}`,
        at: a.checked_in_at,
        href: '/attendance',
      });
    }
    for (const m of recentMembers.rows) {
      activity.push({
        type: 'member',
        icon: 'user-plus',
        text: `New member: ${m.first_name} ${m.last_name} joined`,
        at: m.membership_date || m.created_at,
        href: `/members/${m.id}`,
      });
    }

    activity.sort(
      (a, b) =>
        new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime()
    );

    const lastSunday = attendanceStats.rows.find((r) => {
      const d = new Date(String(r.service_date));
      return d.getDay() === 0;
    }) || attendanceStats.rows[0];

    res.json({
      focus: {
        new_members_week: ms.new_this_week || 0,
        prayer_pending: prayerPending.rows[0]?.n || 0,
        follow_pending: followPending.rows[0]?.n || 0,
        welfare_open: welfareOpen.rows[0]?.n || 0,
        attendance_recorded_today: (attendanceToday.rows || []).length > 0,
      },
      stats: {
        members: ms.total || 0,
        attendance: lastSunday ? Number(lastSunday.total_count) || 0 : 0,
        giving: Number(gs.this_month_total) || 0,
        listings: listings.rows[0]?.total || 0,
      },
      agenda: eventsToday.rows,
      activity: activity.slice(0, 12),
      pulse: {
        active: ms.active || 0,
        visitors: ms.visitors || 0,
        inactive: ms.inactive || 0,
        new_this_month: ms.new_this_month || 0,
        new_last_month: ms.new_last_month || 0,
        total: ms.total || 0,
      },
      giving: {
        tithe: Number(gs.tithe) || 0,
        offering: Number(gs.offering) || 0,
        building: Number(gs.building) || 0,
        other: Number(gs.other) || 0,
        total: Number(gs.this_month_total) || 0,
      },
      pending: {
        prayer: prayerPending.rows[0]?.n || 0,
        follow_up: followPending.rows[0]?.n || 0,
        welfare: welfareOpen.rows[0]?.n || 0,
        attendance_missing: (attendanceToday.rows || []).length === 0,
      },
    });
  } catch (err) {
    console.error('Dashboard home error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
