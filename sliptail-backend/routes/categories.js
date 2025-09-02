const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Public: list categories (only active)
 */
router.get("/", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, slug
         FROM categories
        WHERE active = TRUE
        ORDER BY name ASC`
    );
    res.json({ categories: rows });
  } catch (e) {
    console.error("list categories error:", e);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/**
 * Admin: create category
 * Body: { name, slug }
 */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, slug } = req.body || {};
  try {
    const { rows } = await db.query(
      `INSERT INTO categories (name, slug, active)
       VALUES ($1, $2, TRUE)
       RETURNING *`,
      [name, slug]
    );
    res.status(201).json({ category: rows[0] });
  } catch (e) {
    console.error("create category error:", e);
    res.status(500).json({ error: "Failed to create category" });
  }
});

/**
 * Admin: update category (rename, toggle active)
 * Body: { name?, slug?, active? }
 */
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, slug, active } = req.body || {};
  try {
    const { rows } = await db.query(
      `UPDATE categories
          SET name = COALESCE($1, name),
              slug = COALESCE($2, slug),
              active = COALESCE($3, active)
        WHERE id=$4
        RETURNING *`,
      [name ?? null, slug ?? null, typeof active === "boolean" ? active : null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Category not found" });
    res.json({ category: rows[0] });
  } catch (e) {
    console.error("update category error:", e);
    res.status(500).json({ error: "Failed to update category" });
  }
});

module.exports = router;