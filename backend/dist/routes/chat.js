"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const churchAuth_1 = require("../middleware/churchAuth");
const churchTenant_1 = require("../middleware/churchTenant");
const notifications_1 = require("./notifications");
const router = (0, express_1.Router)();
router.use(churchTenant_1.requireChurchTenant, churchAuth_1.requireChurchAuth);
function actor(req) {
    const accountType = req.accountType === 'member' ? 'member' : 'staff';
    return { type: accountType, id: Number(req.churchUser.id) };
}
/**
 * GET /api/chat/unread-total
 */
router.get('/unread-total', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const me = actor(req);
        const result = await db_1.pool.query(`SELECT COALESCE(SUM(unread), 0)::int AS count
       FROM (
         SELECT (
           SELECT COUNT(*)::int FROM market_messages mm
           WHERE mm.conversation_id = c.id
             AND mm.is_read = false
             AND NOT (
               CASE
                 WHEN c.buyer_type = $2 AND c.buyer_id = $3
                   THEN mm.sender_type = 'buyer' AND mm.sender_id = $3
                 WHEN c.seller_member_id = $3 AND $2 = 'member'
                   THEN mm.sender_type = 'seller' AND mm.sender_id = $3
                 ELSE false
               END
             )
         ) AS unread
         FROM market_conversations c
         WHERE c.church_id = $1
           AND (
             (c.buyer_type = $2 AND c.buyer_id = $3)
             OR (c.seller_member_id = $3 AND $2 = 'member')
           )
       ) t`, [churchId, me.type, me.id]);
        res.json({ count: result.rows[0]?.count || 0 });
    }
    catch (err) {
        console.error('Unread total error:', err);
        res.status(500).json({ error: 'Failed to load unread count' });
    }
});
/**
 * GET /api/chat/conversations
 */
router.get('/conversations', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const me = actor(req);
        const result = await db_1.pool.query(`SELECT c.*,
              m.first_name AS seller_first_name,
              m.last_name AS seller_last_name,
              m.avatar_url AS seller_avatar,
              CASE
                WHEN c.buyer_type = 'member' THEN bm.first_name
                ELSE bu.first_name
              END AS buyer_first_name,
              CASE
                WHEN c.buyer_type = 'member' THEN bm.last_name
                ELSE bu.last_name
              END AS buyer_last_name,
              l.title AS listing_title,
              l.slug AS listing_slug,
              l.price_label AS listing_price_label,
              l.price_min AS listing_price_min,
              l.price_max AS listing_price_max,
              (
                SELECT image_url FROM market_listing_images i
                WHERE i.listing_id = c.listing_id
                ORDER BY i.is_primary DESC, i.display_order ASC
                LIMIT 1
              ) AS listing_image,
              (
                SELECT body FROM market_messages mm
                WHERE mm.conversation_id = c.id
                ORDER BY mm.created_at DESC LIMIT 1
              ) AS last_message,
              (
                SELECT COUNT(*)::int FROM market_messages mm
                WHERE mm.conversation_id = c.id
                  AND mm.is_read = false
                  AND NOT (
                    CASE
                      WHEN c.buyer_type = $2 AND c.buyer_id = $3 THEN mm.sender_type = 'buyer' AND mm.sender_id = $3
                      WHEN c.seller_member_id = $3 AND $2 = 'member' THEN mm.sender_type = 'seller' AND mm.sender_id = $3
                      ELSE false
                    END
                  )
              ) AS unread_count
       FROM market_conversations c
       JOIN church_members m ON m.id = c.seller_member_id
       LEFT JOIN church_members bm
         ON c.buyer_type = 'member' AND bm.id = c.buyer_id
       LEFT JOIN church_users bu
         ON c.buyer_type = 'staff' AND bu.id = c.buyer_id
       LEFT JOIN market_listings l ON l.id = c.listing_id
       WHERE c.church_id = $1
         AND (
           (c.buyer_type = $2 AND c.buyer_id = $3)
           OR (c.seller_member_id = $3 AND $2 = 'member')
         )
       ORDER BY c.last_message_at DESC NULLS LAST`, [churchId, me.type, me.id]);
        res.json({ data: result.rows });
    }
    catch (err) {
        console.error('List conversations error:', err);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
});
/**
 * POST /api/chat/conversations
 * Body: { listing_id } preferred — seller is taken from the listing owner.
 * Optional: seller_member_id (fallback only if no listing), body?
 */
router.post('/conversations', async (req, res) => {
    try {
        if (req.accountType !== 'member') {
            res.status(403).json({
                error: 'Only church members can use in-app chat. Use WhatsApp from checkout.',
            });
            return;
        }
        const churchId = req.churchTenant.id;
        const me = actor(req);
        let listingId = req.body.listing_id
            ? parseInt(String(req.body.listing_id), 10)
            : null;
        let sellerId = NaN;
        let listingTitle = null;
        if (listingId && !Number.isNaN(listingId)) {
            const listing = await db_1.pool.query(`SELECT id, member_id, title, is_active
         FROM market_listings
         WHERE id = $1 AND church_id = $2`, [listingId, churchId]);
            if (listing.rows.length === 0) {
                res.status(404).json({ error: 'Listing not found' });
                return;
            }
            // Always use the listing owner — never trust a client-supplied seller id
            sellerId = Number(listing.rows[0].member_id);
            listingTitle = listing.rows[0].title;
        }
        else {
            res.status(400).json({
                error: 'listing_id is required so we can message the correct vendor',
            });
            return;
        }
        if (me.type === 'member' && me.id === sellerId) {
            res.status(400).json({ error: 'You cannot chat with yourself about your own listing' });
            return;
        }
        const seller = await db_1.pool.query(`SELECT id, first_name, last_name FROM church_members
       WHERE id = $1 AND church_id = $2 AND membership_status = 'active'`, [sellerId, churchId]);
        if (seller.rows.length === 0) {
            res.status(404).json({ error: 'Seller not found' });
            return;
        }
        let conv = await db_1.pool.query(`SELECT * FROM market_conversations
       WHERE church_id = $1
         AND buyer_type = $2
         AND buyer_id = $3
         AND seller_member_id = $4
         AND COALESCE(listing_id, 0) = COALESCE($5::int, 0)`, [churchId, me.type, me.id, sellerId, listingId]);
        if (conv.rows.length === 0) {
            try {
                conv = await db_1.pool.query(`INSERT INTO market_conversations (
             church_id, buyer_type, buyer_id, seller_member_id, listing_id
           ) VALUES ($1,$2,$3,$4,$5)
           RETURNING *`, [churchId, me.type, me.id, sellerId, listingId]);
            }
            catch (insertErr) {
                // Unique index collision — fetch existing
                const code = insertErr?.code;
                if (code === '23505') {
                    conv = await db_1.pool.query(`SELECT * FROM market_conversations
             WHERE church_id = $1
               AND buyer_type = $2
               AND buyer_id = $3
               AND seller_member_id = $4
               AND COALESCE(listing_id, 0) = COALESCE($5::int, 0)`, [churchId, me.type, me.id, sellerId, listingId]);
                }
                else {
                    throw insertErr;
                }
            }
        }
        const conversation = conv.rows[0];
        if (!conversation) {
            res.status(500).json({ error: 'Failed to start chat' });
            return;
        }
        // Keep listing linked if we have one
        if (listingId && Number(conversation.listing_id) !== listingId) {
            await db_1.pool.query(`UPDATE market_conversations SET listing_id = $1 WHERE id = $2`, [listingId, conversation.id]);
            conversation.listing_id = listingId;
        }
        const firstBody = String(req.body.body || '').trim() ||
            (listingTitle
                ? `Hi — I'm interested in "${listingTitle}" from the marketplace.`
                : 'Hi — I would like to chat about your product.');
        const existingMsg = await db_1.pool.query(`SELECT id FROM market_messages WHERE conversation_id = $1 LIMIT 1`, [conversation.id]);
        if (existingMsg.rows.length === 0) {
            await db_1.pool.query(`INSERT INTO market_messages (conversation_id, sender_type, sender_id, body)
         VALUES ($1, 'buyer', $2, $3)`, [conversation.id, me.id, firstBody]);
            await db_1.pool.query(`UPDATE market_conversations SET last_message_at = NOW() WHERE id = $1`, [conversation.id]);
            try {
                await (0, notifications_1.notifyChurchUsers)({
                    churchId,
                    userType: 'member',
                    userId: sellerId,
                    title: listingTitle
                        ? `New message about “${listingTitle}”`
                        : 'New marketplace message',
                    body: firstBody.slice(0, 120),
                    link: `/market/chat/${conversation.id}`,
                });
            }
            catch {
                // ignore notify failures
            }
        }
        res.status(201).json({
            ...conversation,
            seller_first_name: seller.rows[0].first_name,
            seller_last_name: seller.rows[0].last_name,
            listing_title: listingTitle,
        });
    }
    catch (err) {
        console.error('Create conversation error:', err);
        res.status(500).json({ error: 'Failed to start chat' });
    }
});
/**
 * GET /api/chat/conversations/:id/messages
 */
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const me = actor(req);
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid conversation id' });
            return;
        }
        const conv = await db_1.pool.query(`SELECT c.*,
              m.first_name AS seller_first_name,
              m.last_name AS seller_last_name,
              CASE
                WHEN c.buyer_type = 'member' THEN bm.first_name
                ELSE bu.first_name
              END AS buyer_first_name,
              CASE
                WHEN c.buyer_type = 'member' THEN bm.last_name
                ELSE bu.last_name
              END AS buyer_last_name,
              l.title AS listing_title,
              l.slug AS listing_slug,
              l.price_label AS listing_price_label,
              l.price_min AS listing_price_min,
              l.price_max AS listing_price_max,
              (
                SELECT image_url FROM market_listing_images i
                WHERE i.listing_id = c.listing_id
                ORDER BY i.is_primary DESC, i.display_order ASC
                LIMIT 1
              ) AS listing_image
       FROM market_conversations c
       JOIN church_members m ON m.id = c.seller_member_id
       LEFT JOIN church_members bm
         ON c.buyer_type = 'member' AND bm.id = c.buyer_id
       LEFT JOIN church_users bu
         ON c.buyer_type = 'staff' AND bu.id = c.buyer_id
       LEFT JOIN market_listings l ON l.id = c.listing_id
       WHERE c.id = $1 AND c.church_id = $2`, [id, churchId]);
        if (conv.rows.length === 0) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        const c = conv.rows[0];
        const isBuyer = c.buyer_type === me.type && Number(c.buyer_id) === me.id;
        const isSeller = me.type === 'member' && Number(c.seller_member_id) === me.id;
        if (!isBuyer && !isSeller) {
            res.status(403).json({ error: 'Not allowed' });
            return;
        }
        const messages = await db_1.pool.query(`SELECT * FROM market_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 300`, [id]);
        await db_1.pool.query(`UPDATE market_messages SET is_read = true
       WHERE conversation_id = $1
         AND is_read = false
         AND NOT (sender_type = $2 AND sender_id = $3)`, [id, isBuyer ? 'buyer' : 'seller', me.id]);
        res.json({ conversation: c, data: messages.rows });
    }
    catch (err) {
        console.error('List messages error:', err);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});
/**
 * POST /api/chat/conversations/:id/messages
 * Body: { body }
 */
router.post('/conversations/:id/messages', async (req, res) => {
    try {
        const churchId = req.churchTenant.id;
        const me = actor(req);
        const id = parseInt(req.params.id, 10);
        const body = String(req.body.body || '').trim();
        if (Number.isNaN(id) || !body) {
            res.status(400).json({ error: 'body is required' });
            return;
        }
        const conv = await db_1.pool.query(`SELECT c.*, l.title AS listing_title
       FROM market_conversations c
       LEFT JOIN market_listings l ON l.id = c.listing_id
       WHERE c.id = $1 AND c.church_id = $2`, [id, churchId]);
        if (conv.rows.length === 0) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        const c = conv.rows[0];
        const isBuyer = c.buyer_type === me.type && Number(c.buyer_id) === me.id;
        const isSeller = me.type === 'member' && Number(c.seller_member_id) === me.id;
        if (!isBuyer && !isSeller) {
            res.status(403).json({ error: 'Not allowed' });
            return;
        }
        const senderType = isBuyer ? 'buyer' : 'seller';
        const result = await db_1.pool.query(`INSERT INTO market_messages (conversation_id, sender_type, sender_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [id, senderType, me.id, body]);
        await db_1.pool.query(`UPDATE market_conversations SET last_message_at = NOW() WHERE id = $1`, [id]);
        try {
            if (isBuyer) {
                await (0, notifications_1.notifyChurchUsers)({
                    churchId,
                    userType: 'member',
                    userId: c.seller_member_id,
                    title: c.listing_title
                        ? `Buyer message · ${c.listing_title}`
                        : 'New marketplace message',
                    body: body.slice(0, 120),
                    link: `/market/chat/${id}`,
                });
            }
            else {
                await (0, notifications_1.notifyChurchUsers)({
                    churchId,
                    userType: c.buyer_type === 'member' ? 'member' : 'staff',
                    userId: c.buyer_id,
                    title: c.listing_title
                        ? `Vendor replied · ${c.listing_title}`
                        : 'Vendor replied',
                    body: body.slice(0, 120),
                    link: `/market/chat/${id}`,
                });
            }
        }
        catch {
            // ignore
        }
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
exports.default = router;
//# sourceMappingURL=chat.js.map