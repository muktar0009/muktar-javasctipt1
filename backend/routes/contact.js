"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// ─── POST /api/contact ────────────────────────────────────────────────────────
router.post("/", (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  if (message.length < 10) {
    return res.status(400).json({ error: "Message must be at least 10 characters." });
  }

  db.run(
    "INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)",
    [name.trim(), email.trim(), subject?.trim() || "General Inquiry", message.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: "Could not save message." });
      res.status(201).json({
        message: "Message sent successfully! We'll get back to you soon.",
        id: this.lastID
      });
    }
  );
});

// ─── POST /api/contact/subscribe ─────────────────────────────────────────────
router.post("/subscribe", (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  db.run(
    "INSERT OR IGNORE INTO subscribers (email) VALUES (?)",
    [email.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: "Could not subscribe." });
      if (this.changes === 0) {
        return res.status(409).json({ error: "This email is already subscribed." });
      }
      res.status(201).json({ message: "Subscribed successfully! Welcome aboard." });
    }
  );
});

// ─── GET /api/contact/messages  (admin only) ──────────────────────────────────
router.get("/messages", requireAuth, requireAdmin, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const where = status ? "WHERE status = ?" : "";
  const params = status ? [status, limit, offset] : [limit, offset];

  db.all(
    `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error." });
      res.json({ messages: rows, page: Number(page), limit: Number(limit) });
    }
  );
});

// ─── PATCH /api/contact/messages/:id/read  (admin only) ──────────────────────
router.patch("/messages/:id/read", requireAuth, requireAdmin, (req, res) => {
  db.run(
    "UPDATE contact_messages SET status = 'read' WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error." });
      if (this.changes === 0) return res.status(404).json({ error: "Message not found." });
      res.json({ message: "Marked as read." });
    }
  );
});

module.exports = router;
