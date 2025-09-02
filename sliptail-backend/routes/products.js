const express = require("express");
const router = express.Router();
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireAuth, requireCreator } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { productCreateFile, productCreateNoFile, productUpdate } = require("../validators/schemas");
const { standardLimiter } = require("../middleware/rateLimit");

/* --------------------------- helpers & setup --------------------------- */

function linkify(product) {
  const id = product.id;
  return {
    ...product,
    view_url: `/api/downloads/view/${id}`,
    download_url: `/api/downloads/file/${id}`,
  };
}

// 📁 Ensure upload folder exists
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 📦 Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "raw-" + Date.now() + ext);
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
    if (!allowed.has(file.mimetype)) return cb(new Error("Unsupported file type"));
    cb(null, true);
  },
});

async function assertOwner(productId, userId) {
  const { rows } = await db.query("SELECT user_id FROM products WHERE id = $1", [productId]);
  if (!rows[0]) return { error: "Product not found", code: 404 };
  if (rows[0].user_id !== userId) return { error: "You do not own this product", code: 403 };
  return { ok: true };
}

// 🔍 Helper: is this a video file?
const isVideo = (mimeType) => mimeType.startsWith("video/");

/* -------------------------------- routes -------------------------------- */

// 📤 Upload + create product (CREATOR ONLY) — uses JWT user id
router.post(
  "/upload",
  requireAuth, requireCreator,
  standardLimiter,
  upload.single("file"),
  validate(productCreateFile),
  async (req, res) => {
    const inputPath = req.file.path;
    const mimeType = req.file.mimetype;

    // take creator id from token, never from body
    const user_id = req.user.id;
    const { title, description, product_type, price } = req.body;

    if (!["purchase", "membership", "request"].includes(product_type)) {
      return res.status(400).json({ error: "Invalid product_type" });
    }
    if (price != null && isNaN(Number(price))) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    const saveProductToDB = async (filename) => {
      try {
        const result = await db.query(
          `INSERT INTO products (user_id, title, description, filename, product_type, price)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [user_id, title, description, filename, product_type, price ?? null]
        );
        res.json({ success: true, product: linkify(result.rows[0]) });
      } catch (err) {
        console.error("DB insert error:", err);
        res.status(500).json({ error: "Database insert failed" });
      }
    };

    if (isVideo(mimeType)) {
      const outputFilename = `video-${Date.now()}.mp4`;
      const outputPath = path.join(uploadDir, outputFilename);

      ffmpeg(inputPath)
        .output(outputPath)
        .on("end", () => {
          try { fs.unlinkSync(inputPath); } catch {}
          saveProductToDB(outputFilename);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          res.status(500).json({ error: "Video conversion failed" });
        })
        .run();
    } else {
      const finalName = `file-${Date.now()}${path.extname(req.file.originalname)}`;
      const finalPath = path.join(uploadDir, finalName);
      fs.rename(inputPath, finalPath, (err) => {
        if (err) {
          console.error("Rename error:", err);
          return res.status(500).json({ error: "File save failed" });
        }
        saveProductToDB(finalName);
      });
    }
  }
);

// 📥 Get all products for a user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await db.query(
      "SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json({ products: result.rows.map(linkify) });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// 🔎 Get single product by product ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query("SELECT * FROM products WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(linkify(result.rows[0]));
  } catch (err) {
    console.error("Product fetch error:", err);
    res.status(500).json({ error: "Error fetching product" });
  }
});

// ➕ Create product WITHOUT a file (e.g., membership or request)
router.post(
  "/new",
  requireAuth, requireCreator,
  standardLimiter,
  validate(productCreateNoFile),
  async (req, res) => {
    const user_id = req.user.id;
    const { title, description, product_type, price } = req.body;

    if (!["purchase", "membership", "request"].includes(product_type)) {
      return res.status(400).json({ error: "Invalid product_type" });
    }
    if (price != null && isNaN(Number(price))) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    try {
      const result = await db.query(
        `INSERT INTO products (user_id, title, description, product_type, price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, title, description, product_type, price ?? null]
      );

      res.status(201).json({ product: linkify(result.rows[0]) });
    } catch (err) {
      console.error("Create product error:", err);
      res.status(500).json({ error: "Could not create product" });
    }
  }
);

// 🗑️ Delete a product by ID (creator must own it) + remove file from disk
router.delete("/:id", requireAuth, requireCreator, async (req, res) => {
  const productId = parseInt(req.params.id, 10);

  // creator must own it
  const ownership = await assertOwner(productId, req.user.id);
  if (ownership.error) return res.status(ownership.code).json({ error: ownership.error });

  try {
    // 1) grab filename first
    const { rows: pre } = await db.query(
      `SELECT id, filename FROM products WHERE id=$1`,
      [productId]
    );
    if (!pre.length) return res.status(404).json({ error: "Product not found" });
    const oldName = pre[0].filename;

    // 2) delete DB row
    await db.query("BEGIN");
    const { rows } = await db.query(
      `DELETE FROM products WHERE id=$1 RETURNING *`,
      [productId]
    );
    await db.query("COMMIT");

    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    const deleted = rows[0];

    // 3) best-effort: remove file from disk AFTER commit
    if (oldName) {
      const fp = path.join(uploadDir, oldName);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); }
        catch (e) { console.warn("Could not delete file:", e.message); }
      }
    }

    return res.json({ success: true, deleted });
  } catch (err) {
    try { await db.query("ROLLBACK"); } catch {}
    console.error("Delete product error:", err);
    return res.status(500).json({ error: "Failed to delete product" });
  }
});

// ✏️ Update product details (creator must own it)
router.put(
  "/:id",
  requireAuth, requireCreator,
  standardLimiter,
  validate(productUpdate),
  async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const { title, description, product_type, price } = req.body;

    if (product_type && !["purchase", "membership", "request"].includes(product_type)) {
      return res.status(400).json({ error: "Invalid product_type" });
    }
    if (price != null && isNaN(Number(price))) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    // optional: prevent changing type after sales (simple check)
    if (product_type) {
      const { rows: sold } = await db.query(
        "SELECT 1 FROM orders WHERE product_id=$1 AND status='paid' LIMIT 1",
        [productId]
      );
      if (sold.length) {
        return res.status(400).json({ error: "Cannot change product_type after sales exist" });
      }
    }

    const ownership = await assertOwner(productId, req.user.id);
    if (ownership.error) return res.status(ownership.code).json({ error: ownership.error });

    try {
      const result = await db.query(
        `UPDATE products
         SET
           title = COALESCE($1, title),
           description = COALESCE($2, description),
           product_type = COALESCE($3, product_type),
           price = COALESCE($4, price)
         WHERE id = $5
         RETURNING *`,
        [title ?? null, description ?? null, product_type ?? null, price ?? null, productId]
      );
      res.json({ success: true, product: linkify(result.rows[0]) });
    } catch (err) {
      console.error("Update product error:", err);
      res.status(500).json({ error: "Could not update product" });
    }
  }
);

// 🔁 Replace product file by ID (creator must own it)
router.put("/:id/file", requireAuth, requireCreator, upload.single("file"), async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const ownership = await assertOwner(productId, req.user.id);
  if (ownership.error) return res.status(ownership.code).json({ error: ownership.error });

  // get OLD filename first
  const { rows: prevRows } = await db.query("SELECT filename FROM products WHERE id=$1", [productId]);
  const oldName = prevRows[0]?.filename || null;

  const inputPath = req.file.path;
  const mimeType = req.file.mimetype;

  const saveNewFilename = async (newName) => {
    try {
      const updated = await db.query(
        "UPDATE products SET filename = $1 WHERE id = $2 RETURNING *",
        [newName, productId]
      );

      // delete old file if different
      if (oldName && oldName !== newName) {
        const oldPath = path.join(uploadDir, oldName);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) { console.warn("Delete old file failed:", e.message); }
        }
      }

      res.json({ success: true, product: linkify(updated.rows[0]) });
    } catch (err) {
      console.error("File update DB error:", err);
      res.status(500).json({ error: "Failed to update product file" });
    }
  };

  if (mimeType.startsWith("video/")) {
    const outputFilename = `video-${Date.now()}.mp4`;
    const outputPath = path.join(uploadDir, outputFilename);
    ffmpeg(inputPath)
      .output(outputPath)
      .on("end", () => { try { fs.unlinkSync(inputPath); } catch {}; saveNewFilename(outputFilename); })
      .on("error", () => res.status(500).json({ error: "Video conversion failed" }))
      .run();
  } else {
    const finalName = `file-${Date.now()}${path.extname(req.file.originalname)}`;
    const finalPath = path.join(uploadDir, finalName);
    fs.rename(inputPath, finalPath, (err) => {
      if (err) return res.status(500).json({ error: "File save failed" });
      saveNewFilename(finalName);
    });
  }
});

module.exports = router;