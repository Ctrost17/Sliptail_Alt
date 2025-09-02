const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

/**
 * List my notifications (newest first)
 * GET /api/notifications?limit=20&offset=0&unread_only=true
 */
router.get("/", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
  const unreadOnly = req.query.unread_only === "true";

  const where = [`user_id = $1`];
  const params = [req.user.id, limit, offset];

  if (unreadOnly) {
    where.push(`read_at IS NULL`);
  }

  const { rows } = await db.query(
    `SELECT id, type, title, body, metadata, read_at, created_at
       FROM notifications
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    params
  );

  // Count unread for badge
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND read_at IS NULL`,
    [req.user.id]
  );

  res.json({ notifications: rows, unread: countRows[0].unread });
});

/**
 * Mark one notification as read
 */
router.post("/:id/read", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rows } = await db.query(
    `UPDATE notifications
        SET read_at = NOW()
      WHERE id=$1 AND user_id=$2 AND read_at IS NULL
      RETURNING id, read_at`,
    [id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json({ success: true, id, read_at: rows[0].read_at });
});

/**
 * Mark all as read
 */
router.post("/read-all", requireAuth, async (req, res) => {
  await db.query(
    `UPDATE notifications SET read_at = NOW()
      WHERE user_id=$1 AND read_at IS NULL`,
    [req.user.id]
  );
  res.json({ success: true });
});

module.exports = router;