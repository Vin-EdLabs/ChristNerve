import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireChurchAuth } from '../middleware/churchAuth';
import { requireChurchTenant } from '../middleware/churchTenant';
import { extractYoutubeId, youtubeThumbnail } from '../utils/youtube';
import { notifyChurchBroadcast, notifyChurchUsers } from './notifications';
import { writeAudit } from '../services/audit';
import { io } from '../socket';
import { upload, uploadedFilePublicUrl } from '../middleware/upload';

const router = Router();
router.use(requireChurchTenant);

const liveReactionTypes = ['amen', 'fire', 'love', 'peace'] as const;
type LiveReactionType = (typeof liveReactionTypes)[number];

function isLiveReactionType(value: unknown): value is LiveReactionType {
  return typeof value === 'string' && liveReactionTypes.includes(value as LiveReactionType);
}

router.post('/live/react', async (req, res) => {
  try {
    const churchId = Number(req.body?.church_id ?? req.body?.churchId ?? req.churchTenant?.id);
    const serviceId = String(req.body?.service_id ?? req.body?.serviceId ?? '').trim();
    const reactionType = String(req.body?.reaction_type ?? req.body?.reactionType ?? '').trim().toLowerCase();
    const memberId = req.body?.member_id ?? req.body?.memberId ?? null;

    if (!churchId || !serviceId || !isLiveReactionType(reactionType)) {
      res.status(400).json({ error: 'church_id, service_id, and a valid reaction_type are required' });
      return;
    }

    await pool.query(
      `INSERT INTO live_reactions (church_id, service_id, reaction_type, member_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [churchId, serviceId, reactionType, memberId ? Number(memberId) : null]
    );

    const countsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE reaction_type = 'amen')::int AS amen,
         COUNT(*) FILTER (WHERE reaction_type = 'fire')::int AS fire,
         COUNT(*) FILTER (WHERE reaction_type = 'love')::int AS love,
         COUNT(*) FILTER (WHERE reaction_type = 'peace')::int AS peace
       FROM live_reactions
       WHERE church_id = $1 AND service_id = $2`,
      [churchId, serviceId]
    );

    const counts = {
      amen: Number(countsResult.rows[0]?.amen || 0),
      fire: Number(countsResult.rows[0]?.fire || 0),
      love: Number(countsResult.rows[0]?.love || 0),
      peace: Number(countsResult.rows[0]?.peace || 0),
    };

    io.to(`live:${churchId}`).emit('reaction:update', counts);
    io.to(`live:${churchId}`).emit('reaction:new', { reaction_type: reactionType, counts });

    res.status(201).json({ ok: true, counts });
  } catch (err) {
    console.error('Live reaction create error:', err);
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

router.get('/live/reactions/:church_id/:service_id', async (req, res) => {
  try {
    const churchId = Number(req.params.church_id);
    const serviceId = String(req.params.service_id || '').trim();

    if (!churchId || !serviceId) {
      res.status(400).json({ error: 'church_id and service_id are required' });
      return;
    }

    const countsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE reaction_type = 'amen')::int AS amen,
         COUNT(*) FILTER (WHERE reaction_type = 'fire')::int AS fire,
         COUNT(*) FILTER (WHERE reaction_type = 'love')::int AS love,
         COUNT(*) FILTER (WHERE reaction_type = 'peace')::int AS peace
       FROM live_reactions
       WHERE church_id = $1 AND service_id = $2`,
      [churchId, serviceId]
    );

    res.json({
      amen: Number(countsResult.rows[0]?.amen || 0),
      fire: Number(countsResult.rows[0]?.fire || 0),
      love: Number(countsResult.rows[0]?.love || 0),
      peace: Number(countsResult.rows[0]?.peace || 0),
    });
  } catch (err) {
    console.error('Live reactions load error:', err);
    res.status(500).json({ error: 'Failed to load reactions' });
  }
});

router.use(requireChurchAuth);

function isStaff(req: Request): boolean {
  return req.accountType !== 'member';
}

function canEdit(req: Request): boolean {
  if (!isStaff(req)) return false;
  const role = String(req.churchUser?.role || '').toLowerCase();
  return ['pastor', 'admin', 'super-admin', 'secretary', 'media'].includes(role);
}

function requireEdit(req: Request, res: Response): boolean {
  if (!canEdit(req)) {
    res.status(403).json({ error: 'Staff only' });
    return false;
  }
  return true;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

async function notifyBroadcastSafe(opts: {
  churchId: number;
  title: string;
  body: string;
  link?: string | null;
}) {
  try {
    await notifyChurchBroadcast(opts);
  } catch (err) {
    console.warn('Church life broadcast notify failed:', err);
  }
}

async function notifyUsersSafe(opts: {
  churchId: number;
  title: string;
  body: string;
  link?: string | null;
  userType?: 'staff' | 'member';
  userId?: number | null;
}) {
  try {
    await notifyChurchUsers(opts);
  } catch (err) {
    console.warn('Church life notify failed:', err);
  }
}

async function auditSafe(
  req: Request,
  action: string,
  entityType: string,
  entityId: number | null,
  summary: string
) {
  try {
    const actor = req.churchUser;
    await writeAudit({
      churchId: req.churchTenant!.id,
      actorType: isStaff(req) ? 'staff' : 'member',
      actorId: actor?.id ?? null,
      actorName: actor
        ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim()
        : null,
      action,
      entityType,
      entityId,
      summary,
    });
  } catch {
    /* ignore */
  }
}

async function feedPostsWithReactions(
  churchId: number,
  limit: number,
  viewer: { type: 'member' | 'staff'; id: number } | null
) {
  const result = await pool.query(
    `SELECT p.*,
            COALESCE(r.amen_count, 0)::int AS amen_count,
            COALESCE(r.love_count, 0)::int AS love_count,
            COALESCE(r.fire_count, 0)::int AS fire_count,
            my.reaction AS my_reaction
     FROM church_feed_posts p
     LEFT JOIN (
       SELECT post_id,
              COUNT(*) FILTER (WHERE reaction = 'amen') AS amen_count,
              COUNT(*) FILTER (WHERE reaction = 'love') AS love_count,
              COUNT(*) FILTER (WHERE reaction = 'fire') AS fire_count
       FROM church_feed_reactions
       WHERE church_id = $1
       GROUP BY post_id
     ) r ON r.post_id = p.id
     LEFT JOIN church_feed_reactions my
       ON my.post_id = p.id
      AND my.church_id = $1
      AND (
        ($2 = 'member' AND my.member_id = $3)
        OR ($2 = 'staff' AND my.staff_id = $3)
      )
     WHERE p.church_id = $1 AND p.is_published = true
     ORDER BY p.created_at DESC
     LIMIT $4`,
    [churchId, viewer?.type ?? null, viewer?.id ?? null, limit]
  );
  return result.rows;
}

/* ─── Live stream ─────────────────────────────────────────── */

router.get('/live', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT live_stream_url, live_stream_active, live_service_url, live_service_active
       FROM church_tenants WHERE id = $1`,
      [churchId]
    );
    const row = result.rows[0] || {};
    const liveUrl = row.live_service_url ?? row.live_stream_url ?? null;
    const liveActive = Boolean(row.live_service_active ?? row.live_stream_active);
    res.json({
      live_stream_url: liveUrl,
      live_stream_active: liveActive,
      live_service_url: liveUrl,
      live_service_active: liveActive,
    });
  } catch (err) {
    console.error('Live get error:', err);
    res.status(500).json({ error: 'Failed to load live stream' });
  }
});

router.put('/live', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { live_stream_url, live_stream_active } = req.body || {};

    const current = await pool.query(
      `SELECT live_stream_url, live_stream_active, name
       FROM church_tenants WHERE id = $1`,
      [churchId]
    );
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Church not found' });
      return;
    }

    const nextUrl =
      live_stream_url !== undefined
        ? live_stream_url
          ? String(live_stream_url).trim()
          : null
        : current.rows[0].live_stream_url;
    const nextActive =
      live_stream_active !== undefined
        ? Boolean(live_stream_active)
        : Boolean(current.rows[0].live_stream_active);

    const result = await pool.query(
      `UPDATE church_tenants
       SET live_stream_url = $1,
           live_stream_active = $2,
           live_service_url = $3,
           live_service_active = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING live_stream_url, live_stream_active, live_service_url, live_service_active`,
      [nextUrl, nextActive, nextUrl, nextActive, churchId]
    );

    const wasActive = Boolean(current.rows[0].live_stream_active);
    if (nextActive && !wasActive) {
      const churchName = current.rows[0].name || 'Church';
      await notifyBroadcastSafe({
        churchId,
        title: "We're live",
        body: `${churchName} — Join the live stream`,
        link: '/live',
      });
    }

    await auditSafe(req, 'live.update', 'church_tenants', churchId, 'Updated live stream');
    const updated = result.rows[0] || {};
    const liveUrl = updated.live_service_url ?? updated.live_stream_url ?? null;
    const liveActive = Boolean(updated.live_service_active ?? updated.live_stream_active);
    res.json({
      live_stream_url: liveUrl,
      live_stream_active: liveActive,
      live_service_url: liveUrl,
      live_service_active: liveActive,
    });
  } catch (err) {
    console.error('Live update error:', err);
    res.status(500).json({ error: 'Failed to update live stream' });
  }
});

/* ─── Sermons ─────────────────────────────────────────────── */

router.get('/sermons', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const staff = isStaff(req);
    const result = await pool.query(
      `SELECT * FROM church_sermons
       WHERE church_id = $1
         AND ($2 OR is_published = true)
       ORDER BY preached_at DESC NULLS LAST, id DESC
       LIMIT 50`,
      [churchId, staff]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Sermons list error:', err);
    res.status(500).json({ error: 'Failed to load sermons' });
  }
});

router.get('/sermons/:id', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const staff = isStaff(req);
    const result = await pool.query(
      `SELECT * FROM church_sermons
       WHERE id = $1 AND church_id = $2
         AND ($3 OR is_published = true)`,
      [id, churchId, staff]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Sermon not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sermon get error:', err);
    res.status(500).json({ error: 'Failed to load sermon' });
  }
});

router.post('/sermons', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const {
      title,
      youtube_url,
      preacher,
      series,
      preached_at,
      description,
      is_published,
    } = req.body || {};

    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!youtube_url?.trim()) {
      res.status(400).json({ error: 'youtube_url is required' });
      return;
    }

    const ytUrl = String(youtube_url).trim();
    const youtubeId = extractYoutubeId(ytUrl);
    const thumbnail = youtubeId ? youtubeThumbnail(youtubeId) : null;
    const published =
      is_published === undefined ? true : Boolean(is_published);

    const result = await pool.query(
      `INSERT INTO church_sermons (
         church_id, title, preacher, series, youtube_url, youtube_id,
         thumbnail_url, preached_at, description, is_published, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        churchId,
        String(title).trim(),
        preacher ? String(preacher).trim() : null,
        series ? String(series).trim() : null,
        ytUrl,
        youtubeId,
        thumbnail,
        preached_at || null,
        description ? String(description).trim() : null,
        published,
        req.churchUser!.id,
      ]
    );

    if (published) {
      const churchName = req.churchTenant!.name || 'Church';
      await notifyBroadcastSafe({
        churchId,
        title: 'New sermon',
        body: `${churchName} — "${result.rows[0].title}" is ready to watch`,
        link: '/sermons',
      });
    }

    await auditSafe(
      req,
      'sermon.create',
      'church_sermons',
      result.rows[0].id,
      `Created sermon "${result.rows[0].title}"`
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Sermon create error:', err);
    res.status(500).json({ error: 'Failed to create sermon' });
  }
});

router.put('/sermons/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM church_sermons WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ error: 'Sermon not found' });
      return;
    }

    const cur = existing.rows[0];
    const body = req.body || {};
    const ytUrl =
      body.youtube_url !== undefined
        ? String(body.youtube_url || '').trim()
        : cur.youtube_url;
    const youtubeId = extractYoutubeId(ytUrl);
    const thumbnail = youtubeId ? youtubeThumbnail(youtubeId) : null;
    const nextPublished =
      body.is_published !== undefined
        ? Boolean(body.is_published)
        : cur.is_published;

    const result = await pool.query(
      `UPDATE church_sermons SET
         title = $1,
         preacher = $2,
         series = $3,
         youtube_url = $4,
         youtube_id = $5,
         thumbnail_url = $6,
         preached_at = $7,
         description = $8,
         is_published = $9,
         updated_at = NOW()
       WHERE id = $10 AND church_id = $11
       RETURNING *`,
      [
        body.title !== undefined ? String(body.title).trim() : cur.title,
        body.preacher !== undefined
          ? body.preacher
            ? String(body.preacher).trim()
            : null
          : cur.preacher,
        body.series !== undefined
          ? body.series
            ? String(body.series).trim()
            : null
          : cur.series,
        ytUrl,
        youtubeId,
        thumbnail,
        body.preached_at !== undefined ? body.preached_at || null : cur.preached_at,
        body.description !== undefined
          ? body.description
            ? String(body.description).trim()
            : null
          : cur.description,
        nextPublished,
        id,
        churchId,
      ]
    );

    if (nextPublished && !cur.is_published) {
      const churchName = req.churchTenant!.name || 'Church';
      await notifyBroadcastSafe({
        churchId,
        title: 'New sermon',
        body: `${churchName} — "${result.rows[0].title}" is ready to watch`,
        link: '/sermons',
      });
    }

    await auditSafe(req, 'sermon.update', 'church_sermons', id, 'Updated sermon');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sermon update error:', err);
    res.status(500).json({ error: 'Failed to update sermon' });
  }
});

router.delete('/sermons/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `DELETE FROM church_sermons
       WHERE id = $1 AND church_id = $2
       RETURNING id`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Sermon not found' });
      return;
    }
    await auditSafe(req, 'sermon.delete', 'church_sermons', id, 'Deleted sermon');
    res.json({ ok: true });
  } catch (err) {
    console.error('Sermon delete error:', err);
    res.status(500).json({ error: 'Failed to delete sermon' });
  }
});

/* ─── Devotionals ─────────────────────────────────────────── */

router.get('/devotionals/today', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const today = todayISO();
    const result = await pool.query(
      `SELECT * FROM church_devotionals
       WHERE church_id = $1 AND is_published = true AND devote_date <= $2
       ORDER BY devote_date DESC
       LIMIT 1`,
      [churchId, today]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Devotional today error:', err);
    res.status(500).json({ error: 'Failed to load today\'s devotional' });
  }
});

router.get('/devotionals', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const staff = isStaff(req);
    const dateParam = req.query.date ? String(req.query.date).slice(0, 10) : null;

    if (staff) {
      const result = await pool.query(
        `SELECT * FROM church_devotionals
         WHERE church_id = $1
           AND ($2::date IS NULL OR devote_date = $2::date)
         ORDER BY devote_date DESC
         LIMIT 60`,
        [churchId, dateParam]
      );
      res.json({ data: result.rows });
      return;
    }

    const target = dateParam || todayISO();
    const result = await pool.query(
      `SELECT * FROM church_devotionals
       WHERE church_id = $1 AND is_published = true AND devote_date = $2
       LIMIT 1`,
      [churchId, target]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Devotionals list error:', err);
    res.status(500).json({ error: 'Failed to load devotionals' });
  }
});

router.post('/devotionals', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { title, body, scripture, author_name, devote_date, is_published } =
      req.body || {};

    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!body?.trim()) {
      res.status(400).json({ error: 'body is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO church_devotionals (
         church_id, title, scripture, body, author_name, devote_date,
         is_published, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        churchId,
        String(title).trim(),
        scripture ? String(scripture).trim() : null,
        String(body).trim(),
        author_name ? String(author_name).trim() : null,
        devote_date || todayISO(),
        is_published === undefined ? true : Boolean(is_published),
        req.churchUser!.id,
      ]
    );

    await auditSafe(
      req,
      'devotional.create',
      'church_devotionals',
      result.rows[0].id,
      `Created devotional "${result.rows[0].title}"`
    );
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(409).json({ error: 'A devotional already exists for that date' });
      return;
    }
    console.error('Devotional create error:', err);
    res.status(500).json({ error: 'Failed to create devotional' });
  }
});

router.put('/devotionals/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM church_devotionals WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ error: 'Devotional not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body || {};
    const result = await pool.query(
      `UPDATE church_devotionals SET
         title = $1,
         scripture = $2,
         body = $3,
         author_name = $4,
         devote_date = $5,
         is_published = $6
       WHERE id = $7 AND church_id = $8
       RETURNING *`,
      [
        b.title !== undefined ? String(b.title).trim() : cur.title,
        b.scripture !== undefined
          ? b.scripture
            ? String(b.scripture).trim()
            : null
          : cur.scripture,
        b.body !== undefined ? String(b.body).trim() : cur.body,
        b.author_name !== undefined
          ? b.author_name
            ? String(b.author_name).trim()
            : null
          : cur.author_name,
        b.devote_date !== undefined ? b.devote_date || cur.devote_date : cur.devote_date,
        b.is_published !== undefined ? Boolean(b.is_published) : cur.is_published,
        id,
        churchId,
      ]
    );

    await auditSafe(req, 'devotional.update', 'church_devotionals', id, 'Updated devotional');
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(409).json({ error: 'A devotional already exists for that date' });
      return;
    }
    console.error('Devotional update error:', err);
    res.status(500).json({ error: 'Failed to update devotional' });
  }
});

router.delete('/devotionals/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `DELETE FROM church_devotionals
       WHERE id = $1 AND church_id = $2
       RETURNING id`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Devotional not found' });
      return;
    }
    await auditSafe(req, 'devotional.delete', 'church_devotionals', id, 'Deleted devotional');
    res.json({ ok: true });
  } catch (err) {
    console.error('Devotional delete error:', err);
    res.status(500).json({ error: 'Failed to delete devotional' });
  }
});

/* ─── Bulletins ───────────────────────────────────────────── */

router.get('/bulletins/latest', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT * FROM church_bulletins
       WHERE church_id = $1 AND is_published = true
       ORDER BY service_date DESC, id DESC
       LIMIT 1`,
      [churchId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Bulletin latest error:', err);
    res.status(500).json({ error: 'Failed to load latest bulletin' });
  }
});

router.get('/bulletins', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const staff = isStaff(req);
    const result = await pool.query(
      `SELECT * FROM church_bulletins
       WHERE church_id = $1
         AND ($2 OR is_published = true)
       ORDER BY service_date DESC, id DESC
       LIMIT 40`,
      [churchId, staff]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Bulletins list error:', err);
    res.status(500).json({ error: 'Failed to load bulletins' });
  }
});

router.post('/bulletins', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const {
      service_date,
      title,
      order_of_service,
      announcements,
      offering_focus,
      welcome_note,
      is_published,
    } = req.body || {};

    if (!service_date) {
      res.status(400).json({ error: 'service_date is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO church_bulletins (
         church_id, title, service_date, order_of_service, announcements,
         offering_focus, welcome_note, is_published, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        churchId,
        title ? String(title).trim() : 'Sunday Bulletin',
        service_date,
        order_of_service ?? null,
        announcements ?? null,
        offering_focus ?? null,
        welcome_note ?? null,
        Boolean(is_published),
        req.churchUser!.id,
      ]
    );

    await auditSafe(
      req,
      'bulletin.create',
      'church_bulletins',
      result.rows[0].id,
      `Created bulletin for ${service_date}`
    );
    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(409).json({ error: 'A bulletin already exists for that date' });
      return;
    }
    console.error('Bulletin create error:', err);
    res.status(500).json({ error: 'Failed to create bulletin' });
  }
});

router.put('/bulletins/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM church_bulletins WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ error: 'Bulletin not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body || {};
    const result = await pool.query(
      `UPDATE church_bulletins SET
         title = $1,
         service_date = $2,
         order_of_service = $3,
         announcements = $4,
         offering_focus = $5,
         welcome_note = $6,
         is_published = $7,
         updated_at = NOW()
       WHERE id = $8 AND church_id = $9
       RETURNING *`,
      [
        b.title !== undefined ? String(b.title).trim() : cur.title,
        b.service_date !== undefined ? b.service_date : cur.service_date,
        b.order_of_service !== undefined ? b.order_of_service : cur.order_of_service,
        b.announcements !== undefined ? b.announcements : cur.announcements,
        b.offering_focus !== undefined ? b.offering_focus : cur.offering_focus,
        b.welcome_note !== undefined ? b.welcome_note : cur.welcome_note,
        b.is_published !== undefined ? Boolean(b.is_published) : cur.is_published,
        id,
        churchId,
      ]
    );

    await auditSafe(req, 'bulletin.update', 'church_bulletins', id, 'Updated bulletin');
    res.json(result.rows[0]);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      res.status(409).json({ error: 'A bulletin already exists for that date' });
      return;
    }
    console.error('Bulletin update error:', err);
    res.status(500).json({ error: 'Failed to update bulletin' });
  }
});

router.post('/bulletins/:id/publish', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `UPDATE church_bulletins
       SET is_published = true, updated_at = NOW()
       WHERE id = $1 AND church_id = $2
       RETURNING *`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Bulletin not found' });
      return;
    }

    const churchName = req.churchTenant!.name || 'Church';
    await notifyBroadcastSafe({
      churchId,
      title: 'New bulletin',
      body: `${churchName} — ${result.rows[0].title || 'Sunday Bulletin'} is ready`,
      link: '/bulletin',
    });

    await auditSafe(req, 'bulletin.publish', 'church_bulletins', id, 'Published bulletin');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Bulletin publish error:', err);
    res.status(500).json({ error: 'Failed to publish bulletin' });
  }
});

/* ─── Feed ────────────────────────────────────────────────── */

router.get('/feed', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const viewer = req.churchUser
      ? {
          type: (isStaff(req) ? 'staff' : 'member') as 'staff' | 'member',
          id: Number(req.churchUser.id),
        }
      : null;
    const rows = await feedPostsWithReactions(churchId, 40, viewer);
    res.json({ data: rows });
  } catch (err) {
    console.error('Feed list error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

router.post('/feed', upload.single('image'), async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const { body, image_url, video_url } = req.body || {};
    if (!body?.trim()) {
      res.status(400).json({ error: 'body is required' });
      return;
    }

    const uploadedImageUrl = uploadedFilePublicUrl(req.file);
    const persistedImageUrl = uploadedImageUrl || (image_url ? String(image_url).trim() : null);

    const result = await pool.query(
      `INSERT INTO church_feed_posts (
         church_id, author_staff_id, body, image_url, video_url, is_published
       ) VALUES ($1,$2,$3,$4,$5,true)
       RETURNING *`,
      [
        churchId,
        req.churchUser!.id,
        String(body).trim(),
        persistedImageUrl,
        video_url ? String(video_url).trim() : null,
      ]
    );

    const churchName = req.churchTenant!.name || 'Church';
    const preview = String(body).trim().replace(/\s+/g, ' ').slice(0, 90);
    await notifyBroadcastSafe({
      churchId,
      title: 'New church update',
      body: `${churchName}: ${preview}${preview.length >= 90 ? '…' : ''}`,
      link: '/feed',
    });

    await auditSafe(
      req,
      'feed.create',
      'church_feed_posts',
      result.rows[0].id,
      'Created feed post'
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Feed create error:', err);
    res.status(500).json({ error: 'Failed to create feed post' });
  }
});

router.delete('/feed/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `DELETE FROM church_feed_posts
       WHERE id = $1 AND church_id = $2
       RETURNING id`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    await auditSafe(req, 'feed.delete', 'church_feed_posts', id, 'Deleted feed post');
    res.json({ ok: true });
  } catch (err) {
    console.error('Feed delete error:', err);
    res.status(500).json({ error: 'Failed to delete feed post' });
  }
});

router.post('/feed/:id/react', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const postId = Number(req.params.id);
    const reaction = String(req.body?.reaction || '').toLowerCase();
    if (!['amen', 'love', 'fire'].includes(reaction)) {
      res.status(400).json({ error: 'reaction must be amen, love, or fire' });
      return;
    }

    const post = await pool.query(
      `SELECT id FROM church_feed_posts
       WHERE id = $1 AND church_id = $2 AND is_published = true`,
      [postId, churchId]
    );
    if (!post.rows[0]) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const staff = isStaff(req);
    const userId = Number(req.churchUser!.id);

    const existing = await pool.query(
      staff
        ? `SELECT id, reaction FROM church_feed_reactions
           WHERE post_id = $1 AND church_id = $2 AND staff_id = $3
           LIMIT 1`
        : `SELECT id, reaction FROM church_feed_reactions
           WHERE post_id = $1 AND church_id = $2 AND member_id = $3
           LIMIT 1`,
      [postId, churchId, userId]
    );

    if (existing.rows[0]) {
      if (existing.rows[0].reaction === reaction) {
        await pool.query(`DELETE FROM church_feed_reactions WHERE id = $1`, [
          existing.rows[0].id,
        ]);
        res.json({ reaction: null, toggled_off: true });
        return;
      }
      await pool.query(
        `UPDATE church_feed_reactions SET reaction = $1 WHERE id = $2`,
        [reaction, existing.rows[0].id]
      );
      res.json({ reaction, toggled_off: false });
      return;
    }

    await pool.query(
      staff
        ? `INSERT INTO church_feed_reactions
             (post_id, church_id, staff_id, reaction)
           VALUES ($1,$2,$3,$4)`
        : `INSERT INTO church_feed_reactions
             (post_id, church_id, member_id, reaction)
           VALUES ($1,$2,$3,$4)`,
      [postId, churchId, userId, reaction]
    );
    res.json({ reaction, toggled_off: false });
  } catch (err) {
    console.error('Feed react error:', err);
    res.status(500).json({ error: 'Failed to react' });
  }
});

/* ─── Sunday reports ──────────────────────────────────────── */

router.get('/sunday-reports', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const result = await pool.query(
      `SELECT *,
              (COALESCE(men,0) + COALESCE(women,0) + COALESCE(children,0)) AS total_attendance
       FROM church_sunday_reports
       WHERE church_id = $1
       ORDER BY service_date DESC
       LIMIT 52`,
      [churchId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Sunday reports list error:', err);
    res.status(500).json({ error: 'Failed to load sunday reports' });
  }
});

router.get('/sunday-reports/:id/whatsapp-text', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `SELECT * FROM church_sunday_reports
       WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const r = result.rows[0];
    const total =
      Number(r.men || 0) + Number(r.women || 0) + Number(r.children || 0);
    const churchName = req.churchTenant!.name || 'Church';
    const dateStr = r.service_date
      ? String(r.service_date).slice(0, 10)
      : '';

    const lines = [
      `*${churchName} — Sunday Report*`,
      `📅 ${dateStr}`,
      '',
      `👥 Attendance: *${total}*`,
      `   Men: ${r.men || 0}`,
      `   Women: ${r.women || 0}`,
      `   Children: ${r.children || 0}`,
      `   Visitors: ${r.visitors || 0}`,
      '',
      `✨ Salvations: ${r.salvations || 0}`,
      `🙏 Decisions: ${r.decisions || 0}`,
    ];
    if (r.notes) {
      lines.push('', `Notes: ${r.notes}`);
    }
    lines.push('', '_Shared via ChristNerve_');

    res.json({ text: lines.join('\n') });
  } catch (err) {
    console.error('Sunday report whatsapp error:', err);
    res.status(500).json({ error: 'Failed to format report' });
  }
});

router.get('/sunday-reports/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const result = await pool.query(
      `SELECT *,
              (COALESCE(men,0) + COALESCE(women,0) + COALESCE(children,0)) AS total_attendance
       FROM church_sunday_reports
       WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sunday report get error:', err);
    res.status(500).json({ error: 'Failed to load sunday report' });
  }
});

router.post('/sunday-reports', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const {
      service_date,
      men,
      women,
      children,
      visitors,
      salvations,
      decisions,
      notes,
    } = req.body || {};

    if (!service_date) {
      res.status(400).json({ error: 'service_date is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO church_sunday_reports (
         church_id, service_date, men, women, children, visitors,
         salvations, decisions, notes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (church_id, service_date) DO UPDATE SET
         men = EXCLUDED.men,
         women = EXCLUDED.women,
         children = EXCLUDED.children,
         visitors = EXCLUDED.visitors,
         salvations = EXCLUDED.salvations,
         decisions = EXCLUDED.decisions,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [
        churchId,
        service_date,
        Number(men) || 0,
        Number(women) || 0,
        Number(children) || 0,
        Number(visitors) || 0,
        Number(salvations) || 0,
        Number(decisions) || 0,
        notes ? String(notes).trim() : null,
        req.churchUser!.id,
      ]
    );

    await auditSafe(
      req,
      'sunday_report.upsert',
      'church_sunday_reports',
      result.rows[0].id,
      `Sunday report for ${service_date}`
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Sunday report create error:', err);
    res.status(500).json({ error: 'Failed to save sunday report' });
  }
});

router.put('/sunday-reports/:id', async (req, res) => {
  try {
    if (!requireEdit(req, res)) return;
    const churchId = req.churchTenant!.id;
    const id = Number(req.params.id);
    const existing = await pool.query(
      `SELECT * FROM church_sunday_reports WHERE id = $1 AND church_id = $2`,
      [id, churchId]
    );
    if (!existing.rows[0]) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const cur = existing.rows[0];
    const b = req.body || {};
    const result = await pool.query(
      `UPDATE church_sunday_reports SET
         service_date = $1,
         men = $2,
         women = $3,
         children = $4,
         visitors = $5,
         salvations = $6,
         decisions = $7,
         notes = $8,
         updated_at = NOW()
       WHERE id = $9 AND church_id = $10
       RETURNING *`,
      [
        b.service_date !== undefined ? b.service_date : cur.service_date,
        b.men !== undefined ? Number(b.men) || 0 : cur.men,
        b.women !== undefined ? Number(b.women) || 0 : cur.women,
        b.children !== undefined ? Number(b.children) || 0 : cur.children,
        b.visitors !== undefined ? Number(b.visitors) || 0 : cur.visitors,
        b.salvations !== undefined ? Number(b.salvations) || 0 : cur.salvations,
        b.decisions !== undefined ? Number(b.decisions) || 0 : cur.decisions,
        b.notes !== undefined
          ? b.notes
            ? String(b.notes).trim()
            : null
          : cur.notes,
        id,
        churchId,
      ]
    );

    await auditSafe(req, 'sunday_report.update', 'church_sunday_reports', id, 'Updated sunday report');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sunday report update error:', err);
    res.status(500).json({ error: 'Failed to update sunday report' });
  }
});

/* ─── Growth ──────────────────────────────────────────────── */

router.get('/growth', async (req, res) => {
  const churchId = req.churchTenant!.id;
  const empty = {
    membership_trend: [] as { month: string; count: number }[],
    attendance_trend: [] as { date: string; total: number }[],
    giving_trend: [] as { month: string; amount: number }[],
  };

  try {
    const [membership, attendance, giving] = await Promise.all([
      pool
        .query(
          `SELECT to_char(date_trunc('month', membership_date), 'YYYY-MM') AS month,
                  COUNT(*)::int AS count
           FROM church_members
           WHERE church_id = $1
             AND membership_date IS NOT NULL
             AND membership_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
           GROUP BY 1
           ORDER BY 1`,
          [churchId]
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `SELECT service_date::text AS date,
                  COALESCE(SUM(total_count), 0)::int AS total
           FROM church_attendance
           WHERE church_id = $1
             AND service_date >= CURRENT_DATE - INTERVAL '12 months'
           GROUP BY service_date
           ORDER BY service_date`,
          [churchId]
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `SELECT to_char(date_trunc('month', COALESCE(service_date, created_at::date)), 'YYYY-MM') AS month,
                  COALESCE(SUM(amount), 0)::numeric AS amount
           FROM church_giving
           WHERE church_id = $1
             AND COALESCE(service_date, created_at::date) >= date_trunc('month', CURRENT_DATE) - INTERVAL '11 months'
           GROUP BY 1
           ORDER BY 1`,
          [churchId]
        )
        .catch(() => ({ rows: [] })),
    ]);

    res.json({
      membership_trend: membership.rows.map((r) => ({
        month: r.month,
        count: Number(r.count) || 0,
      })),
      attendance_trend: attendance.rows.map((r) => ({
        date: String(r.date).slice(0, 10),
        total: Number(r.total) || 0,
      })),
      giving_trend: giving.rows.map((r) => ({
        month: r.month,
        amount: Number(r.amount) || 0,
      })),
    });
  } catch (err) {
    console.error('Growth error:', err);
    res.json(empty);
  }
});

/* ─── Birthdays ───────────────────────────────────────────── */

router.get('/birthdays', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;

    const birthdays = await pool.query(
      `SELECT id, first_name, last_name, phone, whatsapp, date_of_birth
       FROM church_members
       WHERE church_id = $1
         AND date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
       ORDER BY first_name, last_name`,
      [churchId]
    );

    let anniversaries: unknown[] = [];
    try {
      const ann = await pool.query(
        `SELECT id, first_name, last_name, phone, whatsapp, wedding_anniversary
         FROM church_members
         WHERE church_id = $1
           AND wedding_anniversary IS NOT NULL
           AND EXTRACT(MONTH FROM wedding_anniversary) = EXTRACT(MONTH FROM CURRENT_DATE)
           AND EXTRACT(DAY FROM wedding_anniversary) = EXTRACT(DAY FROM CURRENT_DATE)
         ORDER BY first_name, last_name`,
        [churchId]
      );
      anniversaries = ann.rows;
    } catch {
      /* wedding_anniversary column may not exist yet */
    }

    res.json({ birthdays: birthdays.rows, anniversaries });
  } catch (err) {
    console.error('Birthdays error:', err);
    res.status(500).json({ error: 'Failed to load birthdays' });
  }
});

/* ─── WhatsApp templates ──────────────────────────────────── */

const WHATSAPP_TEMPLATES = {
  missed_service:
    'Hello {{name}}, we missed you at church on {{service_date}}. Hope you are well — looking forward to seeing you soon! 🙏',
  birthday:
    'Happy Birthday {{name}}! 🎂 May God bless you abundantly this year. Love from your church family!',
  new_visitor:
    'Welcome {{name}}! We were so glad to have you visit on {{service_date}}. You are always welcome here.',
  sunday_report:
    'Sunday Report ({{service_date}}):\nAttendance, salvations & decisions summary ready to share.',
};

router.get('/whatsapp-templates', async (req, res) => {
  try {
    const name = req.query.name ? String(req.query.name) : '';
    const service_date = req.query.service_date
      ? String(req.query.service_date)
      : '';
    const vars = { name, service_date };

    if (name || service_date) {
      res.json({
        missed_service: fillTemplate(WHATSAPP_TEMPLATES.missed_service, vars),
        birthday: fillTemplate(WHATSAPP_TEMPLATES.birthday, vars),
        new_visitor: fillTemplate(WHATSAPP_TEMPLATES.new_visitor, vars),
        sunday_report: fillTemplate(WHATSAPP_TEMPLATES.sunday_report, vars),
      });
      return;
    }

    res.json(WHATSAPP_TEMPLATES);
  } catch (err) {
    console.error('WhatsApp templates error:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

/* ─── Member home aggregate ───────────────────────────────── */

router.get('/home', async (req, res) => {
  try {
    const churchId = req.churchTenant!.id;
    const today = todayISO();
    const viewer = req.churchUser
      ? {
          type: (isStaff(req) ? 'staff' : 'member') as 'staff' | 'member',
          id: Number(req.churchUser.id),
        }
      : null;

    const [live, devotionals, sermon, bulletin, feed, bdayCount] =
      await Promise.all([
        pool.query(
          `SELECT live_stream_url, live_stream_active, live_service_url, live_service_active
           FROM church_tenants WHERE id = $1`,
          [churchId]
        ),
        pool.query(
          `SELECT * FROM church_devotionals
           WHERE church_id = $1 AND is_published = true AND devote_date <= $2
           ORDER BY devote_date DESC
           LIMIT 1`,
          [churchId, today]
        ),
        pool.query(
          `SELECT * FROM church_sermons
           WHERE church_id = $1 AND is_published = true
           ORDER BY preached_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [churchId]
        ),
        pool.query(
          `SELECT * FROM church_bulletins
           WHERE church_id = $1 AND is_published = true
           ORDER BY service_date DESC, id DESC
           LIMIT 1`,
          [churchId]
        ),
        feedPostsWithReactions(churchId, 5, viewer),
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM church_members
           WHERE church_id = $1
             AND date_of_birth IS NOT NULL
             AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
             AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)`,
          [churchId]
        ),
      ]);

    const liveRow = live.rows[0] || {};
    const liveUrl = liveRow.live_service_url ?? liveRow.live_stream_url ?? null;
    const liveActive = Boolean(liveRow.live_service_active ?? liveRow.live_stream_active);
    res.json({
      live: {
        live_stream_url: liveUrl,
        live_stream_active: liveActive,
        live_service_url: liveUrl,
        live_service_active: liveActive,
      },
      todays_devotional: devotionals.rows[0] || null,
      latest_sermon: sermon.rows[0] || null,
      latest_bulletin: bulletin.rows[0] || null,
      feed,
      birthdays_today: Number(bdayCount.rows[0]?.count) || 0,
    });
  } catch (err) {
    console.error('Home aggregate error:', err);
    res.status(500).json({ error: 'Failed to load home' });
  }
});

export default router;
