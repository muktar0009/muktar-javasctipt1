"use strict";

// ─── API Base URL ─────────────────────────────────────────────────────────────
const API_BASE = window.location.origin + "/api";

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem("muktar_token"),
  getUser: () => {
    const u = localStorage.getItem("muktar_user");
    return u ? JSON.parse(u) : null;
  },
  setSession: (token, user) => {
    localStorage.setItem("muktar_token", token);
    localStorage.setItem("muktar_user", JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem("muktar_token");
    localStorage.removeItem("muktar_user");
  },
  isLoggedIn: () => !!localStorage.getItem("muktar_token"),
  isAdmin: () => {
    const u = Auth.getUser();
    return u && u.role === "admin";
  }
};

// ─── Fetch wrapper ────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(API_BASE + endpoint, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (err) {
    throw err;
  }
}

// ─── Toast notifications ──────────────────────────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Navbar login state ───────────────────────────────────────────────────────
function updateNavbar() {
  const loginBtn = document.getElementById("lgbtn");
  if (!loginBtn) return;

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    loginBtn.textContent = user?.username || "Profile";
    loginBtn.href = "../pages/profile.html";
    loginBtn.title = "View Profile";
  } else {
    loginBtn.textContent = "Login";
    loginBtn.href = "./pages/login.html";
  }
}

// ─── Hamburger Menu ───────────────────────────────────────────────────────────
function initHamburger() {
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.querySelector(".nav-menu");
  if (!hamburger || !navMenu) return;

  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
  });
  navMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      navMenu.classList.remove("active");
    });
  });
}

// ─── Format date ──────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });
}

// ─── Init on DOM ready ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initHamburger();
  updateNavbar();
});
