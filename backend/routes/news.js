"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// ─── GET /api/news ────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { category, page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  let where = "WHERE n.published = 1";
  const params = [];

  if (category) { where += " AND n.category = ?"; params.push(category); }
  if (search) { where += " AND (n.title LIKE ? OR n.summary LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  db.all(
    `SELECT n.id, n.title, n.slug, n.summary, n.category, n.views, n.created_at,
            u.username as author
     FROM news_posts n
     LEFT JOIN users u ON n.author_id = u.id
     ${where}
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error." });

      // Get total count
      db.get(
        `SELECT COUNT(*) as total FROM news_posts n ${where}`,
        params,
        (err2, count) => {
          res.json({
            posts: rows,
            total: count?.total || 0,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil((count?.total || 0) / limit)
          });
        }
      );
    }
  );
});

// ─── GET /api/news/categories ─────────────────────────────────────────────────
router.get("/categories", (req, res) => {
  db.all(
    "SELECT category, COUNT(*) as count FROM news_posts WHERE published = 1 GROUP BY category ORDER BY count DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ categories: rows });
    }
  );
});

// ─── GET /api/news/:slug ──────────────────────────────────────────────────────
router.get("/:slug", (req, res) => {
  db.get(
    `SELECT n.*, u.username as author, u.full_name as author_name, u.bio as author_bio
     FROM news_posts n
     LEFT JOIN users u ON n.author_id = u.id
     WHERE n.slug = ? AND n.published = 1`,
    [req.params.slug],
    (err, post) => {
      if (err) return res.status(500).json({ error: "Database error." });
      if (!post) return res.status(404).json({ error: "Post not found." });

      // Increment views
      db.run("UPDATE news_posts SET views = views + 1 WHERE id = ?", [post.id]);

      res.json({ post });
    }
  );
});

// ─── POST /api/news (admin only) ──────────────────────────────────────────────
router.post("/", requireAuth, requireAdmin, (req, res) => {
  const { title, slug, content, summary, category } = req.body;

  if (!title || !slug || !content) {
    return res.status(400).json({ error: "Title, slug, and content are required." });
  }

  db.run(
    "INSERT INTO news_posts (title, slug, content, summary, category, author_id) VALUES (?,?,?,?,?,?)",
    [title, slug, content, summary || "", category || "general", req.user.id],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Slug already exists." });
        return res.status(500).json({ error: "Could not create post." });
      }
      res.status(201).json({ message: "Post created.", id: this.lastID });
    }
  );
});

// ─── PUT /api/news/:id (admin only) ──────────────────────────────────────────
router.put("/:id", requireAuth, requireAdmin, (req, res) => {
  const { title, content, summary, category, published } = req.body;

  db.run(
    `UPDATE news_posts SET title=?, content=?, summary=?, category=?, published=?,
     updated_at=datetime('now') WHERE id=?`,
    [title, content, summary, category, published !== undefined ? published : 1, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error." });
      if (this.changes === 0) return res.status(404).json({ error: "Post not found." });
      res.json({ message: "Post updated." });
    }
  );
});

// ─── DELETE /api/news/:id (admin only) ───────────────────────────────────────
router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  db.run("DELETE FROM news_posts WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Database error." });
    if (this.changes === 0) return res.status(404).json({ error: "Post not found." });
    res.json({ message: "Post deleted." });
  });
});

module.exports = router;
