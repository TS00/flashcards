// Deck loading + light validation.
//
// A deck JSON file is loaded once at study time. We don't keep all decks
// in memory simultaneously; the home screen shows metadata only, and the
// study session is the only thing that needs the full card list.

import * as storage from "./storage.js";

const REQUIRED_META = ["id", "name", "frontLang", "backLang"];
const REQUIRED_CARD = ["id", "front", "back"];

export class DeckError extends Error {
  constructor(msg, where = null) {
    super(where ? `${msg} (at ${where})` : msg);
    this.where = where;
  }
}

// ---- public API ---------------------------------------------------------

export async function loadDeckIndex() {
  // Bundled decks listed in decks/index.json + any custom decks the user
  // has pasted/imported.
  let bundled = [];
  try {
    const res = await fetch("decks/index.json", { cache: "no-cache" });
    if (res.ok) {
      const idx = await res.json();
      bundled = (idx.decks || []).map((d) => ({ ...d, source: "bundled" }));
    }
  } catch {
    // No index file? Fine; just no bundled decks.
  }

  const custom = storage.listCustomDecks();
  const customEntries = Object.values(custom).map((d) => ({
    id: d.meta.id,
    file: null,
    source: "custom",
    deckJson: d,
    featured: false,
  }));

  // Pre-fetch *just metadata* for bundled decks so the home screen can
  // render names/blurbs without loading full card lists.
  const bundledWithMeta = await Promise.all(
    bundled.map(async (entry) => {
      try {
        const deck = await fetchDeck(entry.file);
        return { ...entry, meta: deck.meta, cardCount: deck.cards.length };
      } catch (err) {
        return { ...entry, error: err.message };
      }
    }),
  );
  const customWithMeta = customEntries.map((entry) => ({
    ...entry,
    meta: entry.deckJson.meta,
    cardCount: entry.deckJson.cards.length,
  }));

  return [...bundledWithMeta, ...customWithMeta];
}

export async function loadDeck(idOrEntry) {
  // Accept either a deck id (string) or an index entry object.
  let entry = idOrEntry;
  if (typeof idOrEntry === "string") {
    const all = await loadDeckIndex();
    entry = all.find((d) => d.id === idOrEntry);
    if (!entry) throw new DeckError(`Deck not found: ${idOrEntry}`);
  }
  if (entry.source === "custom") {
    return validateDeck(entry.deckJson);
  }
  return validateDeck(await fetchDeck(entry.file));
}

export function validateDeck(json) {
  if (!json || typeof json !== "object") throw new DeckError("Deck must be a JSON object.");
  if (!json.meta) throw new DeckError("Missing `meta` block.");
  for (const f of REQUIRED_META) {
    if (!json.meta[f]) throw new DeckError(`Missing meta.${f}.`);
  }
  if (!Array.isArray(json.cards)) throw new DeckError("Missing or invalid `cards` array.");
  if (json.cards.length === 0) throw new DeckError("Deck has no cards.");

  const seen = new Set();
  json.cards.forEach((c, i) => {
    for (const f of REQUIRED_CARD) {
      if (!c[f]) throw new DeckError(`Card ${i} is missing field ${f}.`);
    }
    if (seen.has(c.id)) throw new DeckError(`Duplicate card id: ${c.id}`);
    seen.add(c.id);
  });

  // Default unit if not provided: a single "All" unit.
  if (!Array.isArray(json.units) || json.units.length === 0) {
    json.units = [{ id: "all", name: "All cards", blurb: "" }];
    json.cards = json.cards.map((c) => ({ ...c, unit: c.unit || "all" }));
  }
  return json;
}

async function fetchDeck(file) {
  const res = await fetch(`decks/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new DeckError(`Failed to fetch decks/${file} (${res.status})`);
  return res.json();
}

// ---- session building ---------------------------------------------------

// Build the queue of cards for a study session.
// Strategy:
//   1. All cards whose dueAt <= now (ordered by how overdue they are, oldest first).
//      Capped to settings.reviewLimit.
//   2. Up to settings.newPerDay brand-new cards, drawn IN UNIT/SEQUENCE ORDER
//      (because the deck is curated; we want the user to learn unit by unit).
// Already-introduced learning-state cards (sub-day) get prioritized as well.
export function buildSession(deck, progress, settings, now = Date.now()) {
  const cards = deck.cards;
  const states = progress.cards;

  const due = [];
  const learning = [];
  const fresh = [];

  for (const card of cards) {
    const st = states[card.id];
    if (!st || (st.lastReviewAt === null && st.reps === 0)) {
      fresh.push(card);
      continue;
    }
    if (st.dueAt <= now) {
      if (st.lapses > 0 && st.reps < 2) learning.push({ card, st });
      else due.push({ card, st });
    }
  }

  // Sort due cards oldest-first.
  due.sort((a, b) => a.st.dueAt - b.st.dueAt);
  // Cap the review portion.
  const reviewSlice = due.slice(0, settings.reviewLimit).map((x) => x.card);

  // Cap new cards. Already counted today's "learned" toward newPerDay so the
  // schedule stays honest across multiple sessions in a day.
  const today = new Date(now);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const learnedToday = (progress.history[todayKey] || {}).learned || 0;
  const newBudget = Math.max(0, settings.newPerDay - learnedToday);
  const newSlice = fresh.slice(0, newBudget);

  // Order in the session: a few new -> some review -> repeat. Interleaved
  // feels less monotonous than "all new then all review".
  const queue = interleave(reviewSlice, newSlice, learning.map((x) => x.card));
  return queue;
}

function interleave(reviewCards, newCards, learningCards) {
  // Learning-state cards (sub-day) come first; they're time-sensitive.
  const out = [...learningCards];
  // Then alternate: 2 review, 1 new.
  const r = [...reviewCards];
  const n = [...newCards];
  while (r.length || n.length) {
    for (let i = 0; i < 2 && r.length; i++) out.push(r.shift());
    if (n.length) out.push(n.shift());
  }
  return out;
}

// Quick stats over the whole deck for the home / detail views.
export function computeDeckStats(deck, progress, now = Date.now()) {
  const states = progress.cards;
  let total = 0,
    fresh = 0,
    due = 0,
    learning = 0,
    learned = 0,
    mastered = 0;
  for (const card of deck.cards) {
    total += 1;
    const st = states[card.id];
    if (!st || st.lastReviewAt === null) {
      fresh += 1;
      continue;
    }
    if (st.lapses > 0 && st.reps < 2) learning += 1;
    if (st.dueAt <= now) due += 1;
    if (st.reps >= 1) learned += 1;
    if (st.reps >= 4 && st.interval >= 21) mastered += 1;
  }
  return { total, fresh, due, learning, learned, mastered };
}

export function computeUnitStats(deck, progress) {
  const byUnit = new Map();
  for (const u of deck.units) byUnit.set(u.id, { unit: u, total: 0, learned: 0 });
  for (const card of deck.cards) {
    const bucket = byUnit.get(card.unit);
    if (!bucket) continue;
    bucket.total += 1;
    const st = progress.cards[card.id];
    if (st && st.reps >= 1) bucket.learned += 1;
  }
  return [...byUnit.values()];
}
