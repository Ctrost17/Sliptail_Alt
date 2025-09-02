const express = require("express");
const db = require("../db");
const { requireAuth, requireCreator, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Upsert MY creator profile (creator only)
 * Body: { display_name, bio, profile_image, gallery }  // gallery = array of up to 4 image paths/URLs
 * - If profile doesn't exist, creates it
 * - If exists, updates it
 */
router.post("/me", requireAuth, requireCreator, async (req, res) => {
  const userId = req.user.id;
  const { display_name, bio, profile_image, gallery } = req.body || {};

  // enforce: gallery is at most 4 items
  const safeGallery = Array.isArray(gallery) ? gallery.slice(0, 4) : null;

  try {
    const { rows } = await db.query(
      `INSERT INTO creator_profiles (user_id, display_name, bio, profile_image, gallery, featured)
       VALUES ($1,$2,$3,$4,$5,false)
       ON CONFLICT (user_id) DO UPDATE
         SET display_name = COALESCE(EXCLUDED.display_name, creator_profiles.display_name),
             bio          = COALESCE(EXCLUDED.bio,          creator_profiles.bio),
             profile_image= COALESCE(EXCLUDED.profile_image,creator_profiles.profile_image),
             gallery      = COALESCE(EXCLUDED.gallery,      creator_profiles.gallery)
       RETURNING *`,
      [userId, display_name || null, bio || null, profile_image || null, safeGallery ? JSON.stringify(safeGallery) : null]
    );

    res.json({ profile: rows[0] });
  } catch (e) {
    console.error("creator profile save error:", e);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

/**
 * Get a PUBLIC creator profile
 * - Includes avg rating and product count
 */
router.get("/:creatorId", async (req, res) => {
  const creatorId = parseInt(req.params.creatorId, 10);

  try {
    const { rows } = await db.query(
      `SELECT
         cp.user_id,
         cp.display_name,
         cp.bio,
         cp.profile_image,
         cp.gallery,
         cp.featured,
         COALESCE(AVG(r.rating),0)::numeric(3,2) AS average_rating,
         COUNT(DISTINCT p.id)::int               AS products_count
       FROM creator_profiles cp
       LEFT JOIN reviews r  ON r.creator_id = cp.user_id
       LEFT JOIN products p ON p.user_id    = cp.user_id
      WHERE cp.user_id = $1
      GROUP BY cp.user_id, cp.display_name, cp.bio, cp.profile_image, cp.gallery, cp.featured`,
      [creatorId]
    );

    if (!rows.length) return res.status(404).json({ error: "Creator profile not found" });
    const out = rows[0];
    // gallery stored as JSON in DB; ensure it’s an array in the API response
    out.gallery = typeof out.gallery === "string" ? JSON.parse(out.gallery) : out.gallery;
    res.json(out);
  } catch (e) {
    console.error("public profile error:", e);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

/**
 * Set my categories (creator only)
 * Body: { category_ids: [1,2,3] }
 * - Clears old mappings and sets new ones
 */
router.post("/me/categories", requireAuth, requireCreator, async (req, res) => {
  const userId = req.user.id;
  const { category_ids } = req.body || {};
  const ids = Array.isArray(category_ids) ? category_ids.map(n => parseInt(n, 10)).filter(Boolean) : [];

  try {
    await db.query("BEGIN");
    await db.query(`DELETE FROM creator_categories WHERE creator_id=$1`, [userId]);

    if (ids.length) {
      // Insert new mappings
      const values = ids.map((_, i) => `($1,$${i + 2})`).join(",");
      await db.query(
        `INSERT INTO creator_categories (creator_id, category_id) VALUES ${values}`,
        [userId, ...ids]
      );
    }
    await db.query("COMMIT");
    res.json({ success: true, category_ids: ids });
  } catch (e) {
    await db.query("ROLLBACK");
    console.error("set categories error:", e);
    res.status(500).json({ error: "Failed to set categories" });
  }
});

/**
 * Get a creator's categories (public)
 */
router.get("/:creatorId/categories", async (req, res) => {
  const creatorId = parseInt(req.params.creatorId, 10);
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug
         FROM creator_categories cc
         JOIN categories c ON c.id = cc.category_id
        WHERE cc.creator_id = $1
        ORDER BY c.name ASC`,
      [creatorId]
    );
    res.json({ categories: rows });
  } catch (e) {
    console.error("get creator categories error:", e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/**
 * ADMIN: Set/unset featured creator
 * Body: { featured: true|false }
 */
router.patch("/:creatorId/featured", requireAuth, requireAdmin, async (req, res) => {
  const creatorId = parseInt(req.params.creatorId, 10);
  const { featured } = req.body || {};
  const flag = !!featured;

  try {
    const { rows } = await db.query(
      `UPDATE creator_profiles
          SET featured=$1
        WHERE user_id=$2
        RETURNING *`,
      [flag, creatorId]
    );
    if (!rows.length) return res.status(404).json({ error: "Creator profile not found" });

    // optional audit log if you have admin_actions
    try {
      await db.query(
        `INSERT INTO admin_actions (admin_id, action, target_type, target_id, payload_json)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, flag ? "feature_creator" : "unfeature_creator", "user", creatorId, JSON.stringify({ featured: flag })]
      );
    } catch {}

    const out = rows[0];
    out.gallery = typeof out.gallery === "string" ? JSON.parse(out.gallery) : out.gallery;
    res.json({ success: true, profile: out });
  } catch (e) {
    console.error("set featured error:", e);
    res.status(500).json({ error: "Failed to update featured flag" });
  }
});

/**
 * PUBLIC: Seller cards feed (front/back)
 * GET /api/home/cards?featured=true|false&category=<slug or id>&search=<text>&limit=12
 * - featured=true → only featured creators
 * - category=slug or category=id → filter by category
 * - search on display_name or bio
 */
router.get("/:creatorId/card", async (req, res) => {
  const creatorId = parseInt(req.params.creatorId, 10);

  try {
    const { rows: prof } = await db.query(
      `SELECT
         cp.user_id AS creator_id,
         cp.display_name,
         cp.bio,
         cp.profile_image,
         cp.gallery,
         cp.featured,
         COALESCE(AVG(r.rating),0)::numeric(3,2) AS average_rating,
         COUNT(DISTINCT p.id)::int               AS products_count
       FROM creator_profiles cp
       LEFT JOIN reviews r  ON r.creator_id = cp.user_id
       LEFT JOIN products p ON p.user_id    = cp.user_id
      WHERE cp.user_id = $1
      GROUP BY cp.user_id, cp.display_name, cp.bio, cp.profile_image, cp.gallery, cp.featured`,
      [creatorId]
    );
    if (!prof.length) return res.status(404).json({ error: "Creator profile not found" });
    const p = prof[0];
    const gallery = typeof p.gallery === "string" ? JSON.parse(p.gallery) : p.gallery;

    const { rows: cats } = await db.query(
      `SELECT c.id, c.name, c.slug
         FROM creator_categories cc
         JOIN categories c ON c.id = cc.category_id
        WHERE cc.creator_id = $1
        ORDER BY c.name ASC`,
      [creatorId]
    );

    // Optional small product preview (up to 4 latest)
    const { rows: prods } = await db.query(
      `SELECT id, title, product_type, price
         FROM (
           SELECT *,
                  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) rn
           FROM products
         ) t
        WHERE user_id = $1 AND rn <= 4`,
      [creatorId]
    );

    const card = {
      creator_id: p.creator_id,
      front: {
        display_name: p.display_name,
        bio: p.bio,
        profile_image: p.profile_image,
        categories: cats,
        average_rating: p.average_rating,
        products_count: p.products_count,
        featured: p.featured,
        products_preview: prods
      },
      back: {
        gallery: Array.isArray(gallery) ? gallery.slice(0, 4) : []
      },
      links: {
        profile: `/creators/${p.creator_id}` // front-end route to full profile page
      }
    };

    res.json(card);
  } catch (e) {
    console.error("creator card error:", e);
    res.status(500).json({ error: "Failed to fetch creator card" });
  }
});

module.exports = router;