// Main app controller. Hash-based router, three views: home, deck, study,
// stats, about. Pure DOM, no framework. Each view function renders into
// the #app container and wires its own events.

import * as storage from "./storage.js";
import * as deckLib from "./deck.js";
import * as sm2 from "./sm2.js";
import * as tts from "./tts.js";
import { renderHome } from "./views/home.js";
import { renderDeck } from "./views/deck.js";
import { renderStudy } from "./views/study.js";
import { renderStats } from "./views/stats.js";
import { renderAbout } from "./views/about.js";

const root = document.getElementById("app");
const ctx = { storage, deckLib, sm2, tts, navigate, root };

// ---- theme --------------------------------------------------------------

function applyTheme() {
  const saved = storage.getSettings().theme;
  let mode = saved;
  if (mode == null) {
    mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = mode;
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  storage.updateSettings({ theme: next });
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (storage.getSettings().theme == null) applyTheme();
});

applyTheme();

// ---- router -------------------------------------------------------------

function parseRoute() {
  const hash = window.location.hash.slice(1) || "/";
  const parts = hash.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "home" };
  if (parts[0] === "deck" && parts[1]) {
    if (parts[2] === "study") return { name: "study", deckId: decodeURIComponent(parts[1]) };
    return { name: "deck", deckId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "stats") return { name: "stats" };
  if (parts[0] === "about") return { name: "about" };
  return { name: "home" };
}

function navigate(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  } else {
    handleRoute();
  }
}

async function handleRoute() {
  const route = parseRoute();
  highlightNav(route.name);
  root.innerHTML = '<div class="loading">Loading…</div>';
  try {
    switch (route.name) {
      case "home":
        await renderHome(ctx);
        break;
      case "deck":
        await renderDeck(ctx, route.deckId);
        break;
      case "study":
        await renderStudy(ctx, route.deckId);
        break;
      case "stats":
        await renderStats(ctx);
        break;
      case "about":
        await renderAbout(ctx);
        break;
      default:
        await renderHome(ctx);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <div class="empty">
        <h2>Something went wrong</h2>
        <p>${escapeHtml(err.message || String(err))}</p>
        <p><a href="#/">Back home</a></p>
      </div>`;
  }
}

function highlightNav(routeName) {
  document.querySelectorAll(".nav a, .brand").forEach((a) => {
    const target = a.dataset.route;
    if (!target) return;
    a.classList.toggle("active", target === routeName);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

window.addEventListener("hashchange", handleRoute);
handleRoute();

// Help dialog (?)
document.addEventListener("keydown", (e) => {
  if (e.key === "?" && !isTypingTarget(e.target)) {
    e.preventDefault();
    document.getElementById("help-dialog").showModal();
  }
});
function isTypingTarget(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
