const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../db");
const { requireAuth, requireCreator } = require("../middleware/auth");
const { notifyCreatorNewRequest, notifyRequestDelivered } = require("../utils/notify");
const { validate } = require("../middleware/validate");
const { requestCreate, requestDecision, requestDeliver } = require("../validators/schemas");
const { strictLimiter, standardLimiter } = require("../middleware/rateLimit");

const router = express.Router();

/* ---------- Upload setup (must be defined before routes use it) ---------- */

// store attachments in the same uploads folder you already use
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `req-${Date.now()}${ext}`);
  },
});

const allowed = new Set([
  "application/pdf", "application/epub+zip",
  "image/png", "image/jpeg", "image/webp",
  "video/mp4", "video/quicktime", "video/x-msvideo",
  "text/plain"
]);

const upload = multer({
  storage,
  limits: { fileSize: 2500 * 1024 * 1024 }, // 2.5GB max
  fileFilter: (req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  }
});

/* --------------------------- Helper functions --------------------------- */

// Ensure a product is a 'request' product that belongs to creator_id
async function getRequestProduct(productId, creatorId) {
  const { rows } = await db.query(
    `SELECT id, user_id AS creator_id, product_type, price
       FROM products
      WHERE id = $1`,
    [productId]
  );
  const p = rows[0];
  if (!p) return { error: "Product not found", code: 404 };
  if (p.creator_id !== creatorId) return { error: "Product does not belong to this creator", code: 400 };
  if (p.product_type !== "request") return { error: "Product is not a request type", code: 400 };
  return { ok: true, product: p };
}

/* -------------------------------- Routes -------------------------------- */

/**
 * BUYER creates a request for a specific creator + request product
 * Body fields:
 *  - creator_id (int)  -> the seller receiving the request
 *  - product_id (int)  -> the creator's product with product_type='request'
 *  - message (text)    -> buyer's details
 * Optional file field: "attachment"
 *
 * Creates:
 *  - orders row (status='pending', amount from product price)
 *  - custom_requests row (status='pending', with optional attachment_path)
 *
 * Later, Stripe webhook will set orders.status='paid'.
 */
router.post(
  "/create",
  requireAuth,
  strictLimiter,                   // sensitive (creates an order)
  upload.single("attachment"),
  validate(requestCreate),
  async (req, res) => {
    const buyerId = req.user.id;
    const { creator_id, product_id, message } = req.body;

    // basic checks
    if (Number(creator_id) === buyerId) {
      return res.status(400).json({ error: "You cannot request your own product" });
    }

    // attachment path if provided (store only basename)
    const attachment_path = req.file ? path.basename(req.file.path) : null;

    try {
      // 1) validate that product_id is a request product of this creator
      const v = await getRequestProduct(Number(product_id), Number(creator_id));
      if (v.error) return res.status(v.code).json({ error: v.error });

      const amount = Number(v.product.price ?? 0);
      if (Number.isNaN(amount) || amount < 0) {
        return res.status(400).json({ error: "Invalid product price" });
      }

      // 2) Do both writes atomically
      await db.query("BEGIN");

      // create order (pending)
      const { rows: orderRows } = await db.query(
        `INSERT INTO orders (buyer_id, product_id, amount, status, created_at)
         VALUES ($1, $2, $3, 'pending', NOW())
         RETURNING *`,
        [buyerId, product_id, amount]
      );
      const order = orderRows[0];

      // create custom_requests (pending)
      const { rows: reqRows } = await db.query(
        `INSERT INTO custom_requests (order_id, buyer_id, creator_id, details, attachment_path, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
         RETURNING *`,
        [order.id, buyerId, creator_id, message || null, attachment_path]
      );
      const request = reqRows[0];

      await db.query("COMMIT");

      // respond to client
      res.status(201).json({ success: true, order, request });

      // 3) fire-and-forget email notify (correct id reference)
      notifyCreatorNewRequest({ requestId: request.id }).catch(console.error);
    } catch (err) {
      // rollback if we started a tx
      try { await db.query("ROLLBACK"); } catch {}
      console.error("Create request error:", err);
      res.status(500).json({ error: "Failed to create request" });
    }
  }
);

/**
 * CREATOR inbox: list requests for me (optionally filter by status)
 * Query: ?status=pending|accepted|declined|delivered
 */
router.get("/inbox", requireAuth, requireCreator, async (req, res) => {
  const creatorId = req.user.id;
  const { status } = req.query;

  try {
    const params = [creatorId];
    let where = `cr.creator_id = $1`;
    if (status) {
      params.push(status);
      where += ` AND cr.status = $2`;
    }

    const { rows } = await db.query(
      `SELECT cr.*, o.status AS order_status, o.amount,
              u.email AS buyer_email, u.username AS buyer_username
         FROM custom_requests cr
         JOIN orders o ON o.id = cr.order_id
         JOIN users u  ON u.id = cr.buyer_id
        WHERE ${where}
        ORDER BY cr.created_at DESC`,
      params
    );

    res.json({ requests: rows });
  } catch (err) {
    console.error("Inbox error:", err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/**
 * BUYER view: list my requests
 */
router.get("/mine", requireAuth, async (req, res) => {
  const buyerId = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT cr.*, o.status AS order_status, o.amount
         FROM custom_requests cr
         JOIN orders o ON o.id = cr.order_id
        WHERE cr.buyer_id = $1
        ORDER BY cr.created_at DESC`,
      [buyerId]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error("My requests error:", err);
    res.status(500).json({ error: "Failed to fetch my requests" });
  }
});

/**
 * CREATOR accepts or declines a request
 * Body: { action: "accept" | "decline" }
 */
router.patch(
  "/:id/decision",
  requireAuth, requireCreator,
  standardLimiter,
  validate(requestDecision),
  async (req, res) => {
    const creatorId = req.user.id;
    const requestId = parseInt(req.params.id, 10);
    const { action } = req.body;

    try {
      // must be this creator's request
      const { rows } = await db.query(
        `SELECT id, status FROM custom_requests WHERE id=$1 AND creator_id=$2`,
        [requestId, creatorId]
      );
      const r = rows[0];
      if (!r) return res.status(404).json({ error: "Request not found" });
      if (r.status !== "pending") return res.status(400).json({ error: "Request is not pending" });

      const newStatus = action === "accept" ? "accepted" : "declined";
      const { rows: upd } = await db.query(
        `UPDATE custom_requests SET status=$1 WHERE id=$2 RETURNING *`,
        [newStatus, requestId]
      );

      res.json({ success: true, request: upd[0] });
    } catch (err) {
      console.error("Decision error:", err);
      res.status(500).json({ error: "Failed to update request" });
    }
  }
);

/**
 * CREATOR delivers a file (only after payment)
 * File field: "file"
 * - checks order is paid
 * - sets custom_requests.status='delivered' and stores attachment_path
 */
router.post(
  "/:id/deliver",
  requireAuth, requireCreator,
  standardLimiter,
  upload.single("file"),
  validate(requestDeliver),
  async (req, res) => {
    const creatorId = req.user.id;
    const requestId = parseInt(req.params.id, 10);

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      // find the request and its order
      const { rows } = await db.query(
        `SELECT cr.id, cr.creator_id, cr.status, cr.order_id, o.status AS order_status
           FROM custom_requests cr
           JOIN orders o ON o.id = cr.order_id
          WHERE cr.id = $1 AND cr.creator_id = $2`,
        [requestId, creatorId]
      );
      const r = rows[0];
      if (!r) return res.status(404).json({ error: "Request not found" });

      // only allow delivery after payment
      if (r.order_status !== "paid") {
        return res.status(400).json({ error: "Order is not paid yet" });
      }

      const newPath = path.basename(req.file.path);
      const { rows: upd } = await db.query(
        `UPDATE custom_requests
            SET attachment_path = $1,
                status = 'delivered'
          WHERE id = $2
          RETURNING *`,
        [newPath, requestId]
      );

      res.json({ success: true, request: upd[0] });

      // notify the buyer that the request was delivered
      notifyRequestDelivered({ requestId }).catch(console.error);
    } catch (err) {
      console.error("Deliver error:", err);
      res.status(500).json({ error: "Failed to deliver file" });
    }
  }
);

/**
 * BUYER downloads the delivered file
 * - only buyer can download
 * - only when status='delivered'
 * Note: purchases download is in routes/downloads.js
 */
router.get("/:id/download", requireAuth, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  try {
    const { rows } = await db.query(
      `SELECT attachment_path, status, buyer_id
         FROM custom_requests
        WHERE id = $1`,
      [requestId]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Request not found" });
    if (r.buyer_id !== userId) return res.status(403).json({ error: "Not your request" });
    if (r.status !== "delivered") return res.status(403).json({ error: "Not delivered yet" });
    if (!r.attachment_path) return res.status(404).json({ error: "No delivery file" });

    const fullPath = path.join(uploadDir, r.attachment_path);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "File missing on disk" });

    return res.download(fullPath, path.basename(r.attachment_path));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Download failed" });
  }
});

module.exports = router;