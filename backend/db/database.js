"use strict";

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "muktar.db");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Could not open database:", err.message);
  } else {
    console.log("✅ Connected to SQLite database");
    initSchema();
  }
});

function initSchema() {
  db.serialize(() => {
    // ── Users table ──────────────────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT    NOT NULL UNIQUE,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        full_name   TEXT,
        bio         TEXT,
        avatar_url  TEXT,
        role        TEXT    NOT NULL DEFAULT 'user',
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Contact messages table ────────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        subject    TEXT,
        message    TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'unread',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Newsletter subscribers table ──────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── News / blog posts table ───────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS news_posts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        slug        TEXT NOT NULL UNIQUE,
        content     TEXT NOT NULL,
        summary     TEXT,
        category    TEXT DEFAULT 'general',
        author_id   INTEGER,
        views       INTEGER DEFAULT 0,
        published   INTEGER DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);

    // ── Password reset tokens table ───────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL,
        token      TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used       INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // ── Sessions / activity log ───────────────────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        action     TEXT NOT NULL,
        details    TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // ── Seed default admin user ───────────────────────────────────────────────
    db.get("SELECT id FROM users WHERE username = 'Muktar'", (err, row) => {
      if (!row) {
        const hash = bcrypt.hashSync("admin123", 10);
        db.run(
          `INSERT INTO users (username, email, password, full_name, role)
           VALUES (?, ?, ?, ?, ?)`,
          ["Muktar", "muktar@example.com", hash, "Muktar Hosen", "admin"],
          (err) => {
            if (!err) console.log("✅ Default admin user created (username: Muktar, password: admin123)");
          }
        );
      }
    });

    // ── Seed sample news posts ────────────────────────────────────────────────
    db.get("SELECT id FROM news_posts LIMIT 1", (err, row) => {
      if (!row) {
        const posts = [
          {
            title: "JavaScript ES2025 Features You Must Know",
            slug: "js-es2025-features",
            content: "The latest ECMAScript specification brings exciting new features including pattern matching, temporal API improvements, and more. Let's dive deep into each one and see how they'll improve your code...",
            summary: "Explore the hottest new JavaScript features landing in 2025.",
            category: "JavaScript"
          },
          {
            title: "Master Async/Await in 10 Minutes",
            slug: "master-async-await",
            content: "Asynchronous programming is the heart of modern JavaScript. Understanding promises and async/await unlocks the full potential of non-blocking code. In this article we break down every concept with real examples...",
            summary: "A concise but complete guide to async JavaScript.",
            category: "Tutorial"
          },
          {
            title: "Build a REST API with Node.js & Express",
            slug: "node-rest-api",
            content: "In this comprehensive guide, we'll build a production-ready REST API from scratch using Node.js and Express. We'll cover authentication, validation, error handling, and database integration...",
            summary: "Step-by-step guide to building a real-world REST API.",
            category: "Backend"
          },
          {
            title: "CSS Grid vs Flexbox: When to Use Which",
            slug: "css-grid-vs-flexbox",
            content: "Both CSS Grid and Flexbox are powerful layout tools, but they shine in different situations. This guide clarifies when and why you should reach for each, with visual examples and practical patterns...",
            summary: "Stop guessing — here's exactly when to use Grid vs Flexbox.",
            category: "CSS"
          }
        ];

        posts.forEach(p => {
          db.run(
            `INSERT INTO news_posts (title, slug, content, summary, category, author_id)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [p.title, p.slug, p.content, p.summary, p.category]
          );
        });
        console.log("✅ Sample news posts seeded");
      }
    });
  });
}

module.exports = db;
