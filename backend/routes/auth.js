"use strict";

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db/database");
const { requireAuth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "muktar_jwt_secret_2025";
const JWT_EXPIRES = "7d";

// ─── Helper ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function logActivity(userId, action, details, ip) {
  db.run(
    "INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?,?,?,?)",
    [userId, action, details, ip]
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", (req, res) => {
  const { username, email, password, full_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  // Check duplicate
  db.get(
    "SELECT id FROM users WHERE username = ? OR email = ?",
    [username, email],
    (err, existing) => {
      if (err) return res.status(500).json({ error: "Database error." });
      if (existing) return res.status(409).json({ error: "Username or email already taken." });

      const hash = bcrypt.hashSync(password, 10);
      db.run(
        "INSERT INTO users (username, email, password, full_name) VALUES (?,?,?,?)",
        [username, email, hash, full_name || username],
        function (err) {
          if (err) return res.status(500).json({ error: "Could not create account." });

          const newUser = { id: this.lastID, username, email, role: "user" };
          const token = signToken(newUser);
          logActivity(newUser.id, "register", "New account registered", req.ip);

          res.status(201).json({
            message: "Account created successfully!",
            token,
            user: { id: newUser.id, username, email, full_name: full_name || username, role: "user" }
          });
        }
      );
    }
  );
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  db.get(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [username, username],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Database error." });
      if (!user) return res.status(401).json({ error: "Invalid username or password." });

      const match = bcrypt.compareSync(password, user.password);
      if (!match) return res.status(401).json({ error: "Invalid username or password." });

      const token = signToken(user);
      logActivity(user.id, "login", "User logged in", req.ip);

      res.json({
        message: `Welcome back, ${user.full_name || user.username}!`,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          bio: user.bio,
          avatar_url: user.avatar_url,
          role: user.role,
          created_at: user.created_at
        }
      });
    }
  );
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required." });

  db.get("SELECT id, email FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error." });
    // Always respond 200 to prevent email enumeration
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1h

    db.run(
      "INSERT INTO password_resets (email, token, expires_at) VALUES (?,?,?)",
      [email, token, expiresAt],
      (err) => {
        if (err) return res.status(500).json({ error: "Could not create reset token." });

        // In production: send email with reset link
        // For demo: return token directly
        console.log(`[PASSWORD RESET] Token for ${email}: ${token}`);

        res.json({
          message: "Password reset link sent! (In production this would be emailed)",
          // Only expose in dev:
          dev_token: token,
          dev_link: `http://localhost:3000/pages/reset-password.html?token=${token}&email=${email}`
        });
      }
    );
  });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post("/reset-password", (req, res) => {
  const { token, email, new_password } = req.body;
  if (!token || !email || !new_password) {
    return res.status(400).json({ error: "Token, email, and new password are required." });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  db.get(
    "SELECT * FROM password_resets WHERE token = ? AND email = ? AND used = 0",
    [token, email],
    (err, reset) => {
      if (err) return res.status(500).json({ error: "Database error." });
      if (!reset) return res.status(400).json({ error: "Invalid or expired reset token." });

      if (new Date(reset.expires_at) < new Date()) {
        return res.status(400).json({ error: "Reset token has expired." });
      }

      const hash = bcrypt.hashSync(new_password, 10);
      db.run("UPDATE users SET password = ? WHERE email = ?", [hash, email], (err) => {
        if (err) return res.status(500).json({ error: "Could not update password." });

        db.run("UPDATE password_resets SET used = 1 WHERE id = ?", [reset.id]);
        res.json({ message: "Password updated successfully! You can now log in." });
      });
    }
  );
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
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

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", requireAuth, (req, res) => {
  logActivity(req.user.id, "logout", "User logged out", req.ip);
  // JWT is stateless; client simply discards the token
  res.json({ message: "Logged out successfully." });
});

module.exports = router;
