// localStorage-backed persistence layer. All data is keyed under a single
// namespace so it's trivial to export / import / clear.
//
// Shape:
//   {
//     version: 1,
//     settings: { theme: "light"|"dark", newPerDay: number, reviewLimit: number },
//     decks: {
//       [deckId]: {
//         lastStudiedAt: number,
//         cards: { [cardId]: SM2CardState },
//         history: { [YYYY-MM-DD]: { reviewed: number, learned: number } },
//         importedSource?: "bundled"|"pasted",
//         meta?: { name, version }
//       }
//     },
//     // Optional pasted decks live here so they survive reload.
//     customDecks: { [deckId]: deckJson }
//   }

const KEY = "flashcards.v1";
const VERSION = 1;

const DEFAULTS = Object.freeze({
  version: VERSION,
  settings: {
    theme: null, // null = follow system
    newPerDay: 15,
    reviewLimit: 200,
  },
  decks: {},
  customDecks: {},
});

let cache = null;

function load() {
  if (cache) return cache;
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) {
    cache = structuredClone(DEFAULTS);
    return cache;
  }
  try {
    const parsed = JSON.parse(raw);
    cache = mergeWithDefaults(parsed);
  } catch {
    cache = structuredClone(DEFAULTS);
  }
  return cache;
}

function mergeWithDefaults(obj) {
  const out = structuredClone(DEFAULTS);
  if (obj.settings) Object.assign(out.settings, obj.settings);
  if (obj.decks) out.decks = obj.decks;
  if (obj.customDecks) out.customDecks = obj.customDecks;
  return out;
}

function save() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("Could not persist to localStorage:", err);
  }
}

// ---- public API ---------------------------------------------------------

export function getSettings() {
  return { ...load().settings };
}

export function updateSettings(patch) {
  const s = load();
  Object.assign(s.settings, patch);
  save();
}

export function getDeckProgress(deckId) {
  const s = load();
  if (!s.decks[deckId]) {
    s.decks[deckId] = {
      lastStudiedAt: 0,
      cards: {},
      history: {},
    };
    save();
  }
  return s.decks[deckId];
}

export function setCardState(deckId, cardId, state) {
  const s = load();
  if (!s.decks[deckId]) s.decks[deckId] = { lastStudiedAt: 0, cards: {}, history: {} };
  s.decks[deckId].cards[cardId] = state;
  s.decks[deckId].lastStudiedAt = Date.now();
  save();
}

export function recordReview(deckId, dayKey, { wasNew }) {
  const s = load();
  if (!s.decks[deckId]) s.decks[deckId] = { lastStudiedAt: 0, cards: {}, history: {} };
  const h = s.decks[deckId].history;
  if (!h[dayKey]) h[dayKey] = { reviewed: 0, learned: 0 };
  h[dayKey].reviewed += 1;
  if (wasNew) h[dayKey].learned += 1;
  save();
}

export function setDeckMeta(deckId, meta, importedSource = "bundled") {
  const s = load();
  if (!s.decks[deckId]) s.decks[deckId] = { lastStudiedAt: 0, cards: {}, history: {} };
  s.decks[deckId].meta = { name: meta.name, version: meta.version || null };
  s.decks[deckId].importedSource = importedSource;
  save();
}

export function listCustomDecks() {
  return load().customDecks;
}

export function saveCustomDeck(deckJson) {
  const s = load();
  s.customDecks[deckJson.meta.id] = deckJson;
  save();
}

export function removeCustomDeck(deckId) {
  const s = load();
  delete s.customDecks[deckId];
  delete s.decks[deckId];
  save();
}

// Aggregated history across all decks for the stats view.
export function getGlobalHistory() {
  const s = load();
  const merged = {};
  for (const deckId of Object.keys(s.decks)) {
    const h = s.decks[deckId].history || {};
    for (const day of Object.keys(h)) {
      if (!merged[day]) merged[day] = { reviewed: 0, learned: 0 };
      merged[day].reviewed += h[day].reviewed;
      merged[day].learned += h[day].learned;
    }
  }
  return merged;
}

// Wholesale export / import for power users.
export function exportAll() {
  return JSON.stringify(load(), null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || !parsed) {
    throw new Error("Invalid backup file.");
  }
  cache = mergeWithDefaults(parsed);
  save();
}

export function resetAll() {
  cache = structuredClone(DEFAULTS);
  save();
}

export function resetDeck(deckId) {
  const s = load();
  if (s.decks[deckId]) {
    s.decks[deckId].cards = {};
    s.decks[deckId].history = {};
    save();
  }
}
