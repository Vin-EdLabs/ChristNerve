"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderJob = startReminderJob;
const db_1 = require("../db");
const notifications_1 = require("../routes/notifications");
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ranBirthday = new Set();
const ranAbsent = new Set(); // churchId-weekKey
const ranBadges = new Set(); // YYYY-MM
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function weekKey() {
    const d = new Date();
    const day = d.getUTCDay() || 7;
    const thursday = new Date(d);
    thursday.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${thursday.getUTCFullYear()}-W${week}`;
}
function monthKey() {
    return new Date().toISOString().slice(0, 7);
}
async function runBirthdayAnniversaryAlerts() {
    const day = todayKey();
    if (ranBirthday.has(day))
        return;
    // Only fire once per calendar day after 06:00 local (server local)
    if (new Date().getHours() < 6)
        return;
    try {
        const birthdays = await db_1.pool.query(`SELECT m.id, m.church_id, m.first_name, m.last_name, m.phone, m.whatsapp,
              t.name AS church_name
       FROM church_members m
       JOIN church_tenants t ON t.id = m.church_id
       WHERE COALESCE(m.membership_status, 'active') = 'active'
         AND m.date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM m.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM m.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)`);
        const anniversaries = await db_1.pool.query(`SELECT m.id, m.church_id, m.first_name, m.last_name, m.phone, m.whatsapp,
              t.name AS church_name
       FROM church_members m
       JOIN church_tenants t ON t.id = m.church_id
       WHERE COALESCE(m.membership_status, 'active') = 'active'
         AND m.wedding_anniversary IS NOT NULL
         AND EXTRACT(MONTH FROM m.wedding_anniversary) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM m.wedding_anniversary) = EXTRACT(DAY FROM CURRENT_DATE)`);
        const byChurch = new Map();
        for (const row of birthdays.rows) {
            const entry = byChurch.get(row.church_id) || {
                churchName: row.church_name || '',
                bdays: [],
                anniv: [],
            };
            entry.bdays.push(row);
            byChurch.set(row.church_id, entry);
        }
        for (const row of anniversaries.rows) {
            const entry = byChurch.get(row.church_id) || {
                churchName: row.church_name || '',
                bdays: [],
                anniv: [],
            };
            entry.anniv.push(row);
            byChurch.set(row.church_id, entry);
        }
        for (const [churchId, data] of byChurch) {
            const names = [
                ...data.bdays.map((m) => `${m.first_name} ${m.last_name} (birthday)`.trim()),
                ...data.anniv.map((m) => `${m.first_name} ${m.last_name} (anniversary)`.trim()),
            ];
            if (!names.length)
                continue;
            await (0, notifications_1.notifyChurchUsers)({
                churchId,
                userType: 'staff',
                title: 'Celebrations today',
                body: names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : ''),
                link: '/',
            });
        }
        ranBirthday.add(day);
        console.log(`[reminder] birthday/anniversary alerts: ${birthdays.rows.length} bdays, ${anniversaries.rows.length} anniv`);
    }
    catch (err) {
        console.error('[reminder] birthday alerts failed:', err);
    }
}
/** Members absent from the last 2 recorded Sunday services */
async function runWeeklyAbsentDetection() {
    const wk = weekKey();
    // Run Mondays after 07:00
    const now = new Date();
    if (now.getDay() !== 1 || now.getHours() < 7)
        return;
    try {
        const churches = await db_1.pool.query(`SELECT id, name FROM church_tenants WHERE is_active = true OR is_active IS NULL`);
        for (const church of churches.rows) {
            const key = `${church.id}-${wk}`;
            if (ranAbsent.has(key))
                continue;
            const services = await db_1.pool.query(`SELECT DISTINCT service_date
         FROM church_attendance
         WHERE church_id = $1
           AND service_date >= CURRENT_DATE - INTERVAL '21 days'
         ORDER BY service_date DESC
         LIMIT 2`, [church.id]);
            if (services.rows.length < 2) {
                ranAbsent.add(key);
                continue;
            }
            const dates = services.rows.map((r) => r.service_date);
            const absent = await db_1.pool.query(`SELECT m.id, m.first_name, m.last_name
         FROM church_members m
         WHERE m.church_id = $1
           AND COALESCE(m.membership_status, 'active') = 'active'
           AND NOT EXISTS (
             SELECT 1
             FROM church_member_attendance ma
             JOIN church_attendance a ON a.id = ma.attendance_id
             WHERE ma.member_id = m.id
               AND ma.church_id = m.church_id
               AND a.service_date = ANY($2::date[])
           )
         ORDER BY m.last_name, m.first_name
         LIMIT 40`, [church.id, dates]);
            if (absent.rows.length > 0) {
                const preview = absent.rows
                    .slice(0, 6)
                    .map((m) => `${m.first_name} ${m.last_name}`.trim())
                    .join(', ');
                await (0, notifications_1.notifyChurchUsers)({
                    churchId: church.id,
                    userType: 'staff',
                    title: 'Weekly absence check',
                    body: `${absent.rows.length} member(s) missed the last 2 services: ${preview}${absent.rows.length > 6 ? '…' : ''}`,
                    link: '/follow-up',
                });
            }
            ranAbsent.add(key);
            console.log(`[reminder] absent check church ${church.id}: ${absent.rows.length}`);
        }
    }
    catch (err) {
        console.error('[reminder] absent detection failed:', err);
    }
}
/** Award simple milestone badges on the 1st of each month */
async function runMonthlyMilestoneBadges() {
    const mk = monthKey();
    if (ranBadges.has(mk))
        return;
    const now = new Date();
    if (now.getDate() !== 1 || now.getHours() < 8)
        return;
    try {
        // Membership years: 1, 5, 10
        await db_1.pool.query(`INSERT INTO church_member_badges (church_id, member_id, badge_key, badge_label, awarded_at)
       SELECT m.church_id, m.id,
              'membership_' || EXTRACT(YEAR FROM AGE(CURRENT_DATE, m.membership_date))::int,
              CASE EXTRACT(YEAR FROM AGE(CURRENT_DATE, m.membership_date))::int
                WHEN 1 THEN '1 Year Member'
                WHEN 5 THEN '5 Year Member'
                WHEN 10 THEN '10 Year Member'
                ELSE NULL
              END,
              NOW()
       FROM church_members m
       WHERE COALESCE(m.membership_status, 'active') = 'active'
         AND m.membership_date IS NOT NULL
         AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, m.membership_date))::int IN (1, 5, 10)
         AND EXTRACT(MONTH FROM m.membership_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM m.membership_date) = EXTRACT(DAY FROM CURRENT_DATE)
       ON CONFLICT (church_id, member_id, badge_key) DO NOTHING`);
        // Perfect attendance last month (checked in to every recorded service)
        await db_1.pool.query(`INSERT INTO church_member_badges (church_id, member_id, badge_key, badge_label, awarded_at)
       SELECT m.church_id, m.id, $1, 'Faithful Attender', NOW()
       FROM church_members m
       WHERE COALESCE(m.membership_status, 'active') = 'active'
         AND (
           SELECT COUNT(DISTINCT service_date) FROM church_attendance
           WHERE church_id = m.church_id
             AND service_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
             AND service_date < date_trunc('month', CURRENT_DATE)
         ) > 0
         AND (
           SELECT COUNT(DISTINCT a.service_date)
           FROM church_member_attendance ma
           JOIN church_attendance a ON a.id = ma.attendance_id
           WHERE ma.member_id = m.id
             AND a.service_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
             AND a.service_date < date_trunc('month', CURRENT_DATE)
         ) = (
           SELECT COUNT(DISTINCT service_date) FROM church_attendance
           WHERE church_id = m.church_id
             AND service_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
             AND service_date < date_trunc('month', CURRENT_DATE)
         )
       ON CONFLICT (church_id, member_id, badge_key) DO NOTHING`, [`faithful_${mk}`]);
        ranBadges.add(mk);
        console.log(`[reminder] monthly badges awarded for ${mk}`);
    }
    catch (err) {
        console.error('[reminder] monthly badges failed:', err);
    }
}
async function logUpcomingEvents() {
    try {
        const result = await db_1.pool.query(`SELECT e.id, e.title, e.start_datetime, t.name AS church_name, t.slug
       FROM church_events e
       JOIN church_tenants t ON t.id = e.church_id
       WHERE e.start_datetime > NOW()
         AND e.start_datetime <= NOW() + INTERVAL '24 hours'
       ORDER BY e.start_datetime ASC
       LIMIT 20`);
        if (result.rows.length > 0) {
            console.log(`Upcoming events in next 24h: ${result.rows.length}`, result.rows.map((r) => `${r.church_name}: ${r.title} @ ${r.start_datetime}`));
        }
    }
    catch (err) {
        console.error('Reminder job query failed:', err);
    }
}
/**
 * Church-life reminder job: events, birthdays, absentees, milestone badges.
 */
function startReminderJob() {
    console.log('ChristNerve reminder job started');
    const tick = async () => {
        console.log('reminder job tick', new Date().toISOString());
        await logUpcomingEvents();
        await runBirthdayAnniversaryAlerts();
        await runWeeklyAbsentDetection();
        await runMonthlyMilestoneBadges();
    };
    setTimeout(() => {
        void tick();
    }, 5000);
    return setInterval(() => {
        void tick();
    }, INTERVAL_MS);
}
//# sourceMappingURL=reminderJob.js.map