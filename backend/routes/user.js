"use strict";

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// ─── GET /api/user/profile ────────────────────────────────────────────────────
router.get("/profile", requireAuth, (req, res) => {
  db.get(
    "SELECT id, username, email, full_name, bio, avatar_url, role, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Database error." });
      if (!user) return res.status(404).json({ error: "User not found." });
      res.json({ user });
    }
  );
});

// ─── PATCH /api/user/profile ──────────────────────────────────────────────────
router.patch("/profile", requireAuth, (req, res) => {
  const { full_name, bio, avatar_url } = req.body;

  db.run(
    `UPDATE users SET full_name=?, bio=?, avatar_url=?, updated_at=datetime('now') WHERE id=?`,
    [full_name, bio, avatar_url, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ message: "Profile updated successfully." });
    }
  );
});

// ─── PATCH /api/user/change-password ─────────────────────────────────────────
router.patch("/change-password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: "Both current and new passwords are required." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  db.get("SELECT password FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ message: "Password changed successfully." });
    });
  });
});

// ─── GET /api/user/activity ───────────────────────────────────────────────────
router.get("/activity", requireAuth, (req, res) => {
  db.all(
    "SELECT action, details, ip_address, created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ activity: rows });
    }
  );
});

// ─── GET /api/user/all  (admin only) ──────────────────────────────────────────
router.get("/all", requireAuth, requireAdmin, (req, res) => {
  db.all(
    "SELECT id, username, email, full_name, role, created_at FROM users ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ users: rows });
    }
  );
});

// ─── DELETE /api/user/:id  (admin only) ───────────────────────────────────────
router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own admin account." });
  }
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: "Database error." });
    if (this.changes === 0) return res.status(404).json({ error: "User not found." });
    res.json({ message: "User deleted." });
  });
});

module.exports = router;
