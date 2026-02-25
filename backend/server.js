"use strict";

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const path = require("path");

// Route imports
const authRoutes = require("./routes/auth");
const contactRoutes = require("./routes/contact");
const newsRoutes = require("./routes/news");
const userRoutes = require("./routes/user");

// DB init
const db = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "muktar_secret_key_2025",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true in production with HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 24h
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "..")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/user", userRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─── Serve pages ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving frontend from: ${path.join(__dirname, "..")}`);
});

module.exports = app;
