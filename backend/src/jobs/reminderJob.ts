import { pool } from '../db';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Lightweight reminder job — logs a tick and optionally checks upcoming events.
 */
export function startReminderJob(): NodeJS.Timeout {
  console.log('ChristNerve reminder job started');

  const tick = async () => {
    console.log('reminder job tick', new Date().toISOString());

    try {
      const result = await pool.query(
        `SELECT e.id, e.title, e.start_datetime, t.name AS church_name, t.slug
         FROM church_events e
         JOIN church_tenants t ON t.id = e.church_id
         WHERE e.start_datetime > NOW()
           AND e.start_datetime <= NOW() + INTERVAL '24 hours'
         ORDER BY e.start_datetime ASC
         LIMIT 20`
      );

      if (result.rows.length > 0) {
        console.log(
          `Upcoming events in next 24h: ${result.rows.length}`,
          result.rows.map((r) => `${r.church_name}: ${r.title} @ ${r.start_datetime}`)
        );
      }
    } catch (err) {
      console.error('Reminder job query failed:', err);
    }
  };

  // Run once shortly after boot, then on interval
  setTimeout(() => {
    void tick();
  }, 5000);

  return setInterval(() => {
    void tick();
  }, INTERVAL_MS);
}
