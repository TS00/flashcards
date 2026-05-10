import { html, mount, escape } from "./_dom.js";

export async function renderHome(ctx) {
  const decks = await ctx.deckLib.loadDeckIndex();
  const featured = decks.find((d) => d.featured) || decks[0];

  const heroDeck = featured && !featured.error ? featured : null;
  let heroBlurb = "Pick a deck below to start studying.";
  if (heroDeck) {
    heroBlurb = heroDeck.meta.description || heroBlurb;
  }

  const cards = decks.map((d) => deckCardHtml(d, ctx));

  mount(ctx.root, html`
    <section class="hero">
      <span class="pill">Flashcards · spaced repetition</span>
      <h1>Learn vocabulary that actually sticks.</h1>
      <p>${escape(heroBlurb)}</p>
    </section>

    <section>
      <h2 style="margin-bottom:1rem">Decks</h2>
      <div class="deck-grid">
        ${cards.join("")}
      </div>
      ${decks.length === 0 ? `<div class="empty"><h2>No decks yet</h2><p>Paste one in below or add a JSON file to <code>decks/</code>.</p></div>` : ""}
    </section>

    <section class="import-box">
      <h3>Import a deck</h3>
      <p>Paste a deck JSON to add it to your collection. It's stored locally; nothing is uploaded. <a href="https://github.com/TS00/flashcards/blob/main/decks/SCHEMA.md" target="_blank" rel="noopener">Schema docs</a>.</p>
      <textarea id="import-textarea" placeholder='{ "meta": { "id": "my-deck", "name": "My Deck", "frontLang": "es", "backLang": "en" }, "cards": [...] }'></textarea>
      <div class="actions">
        <button class="btn btn-primary" id="import-btn">Add deck</button>
        <button class="btn btn-ghost" id="import-clear">Clear</button>
      </div>
      <div id="import-error" class="import-error" hidden></div>
    </section>
  `);

  // Wire events.
  ctx.root.querySelectorAll("[data-deck-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.navigate(`/deck/${encodeURIComponent(el.dataset.deckLink)}`);
    });
  });

  const ta = ctx.root.querySelector("#import-textarea");
  const errEl = ctx.root.querySelector("#import-error");
  ctx.root.querySelector("#import-btn").addEventListener("click", () => {
    errEl.hidden = true;
    try {
      const json = JSON.parse(ta.value);
      ctx.deckLib.validateDeck(json);
      ctx.storage.saveCustomDeck(json);
      ctx.navigate(`/deck/${encodeURIComponent(json.meta.id)}`);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
  ctx.root.querySelector("#import-clear").addEventListener("click", () => {
    ta.value = "";
    errEl.hidden = true;
  });
}

function deckCardHtml(d, ctx) {
  if (d.error) {
    return `<div class="deck-card"><h3>${escape(d.id)}</h3><p style="color:var(--bad)">${escape(d.error)}</p></div>`;
  }
  const progress = ctx.storage.getDeckProgress(d.id);
  const stats = computeQuickStats(d, progress, ctx);
  const sourceTag = d.source === "custom" ? `<span class="locale-tag">imported</span>` : "";
  return `
    <a class="deck-card ${d.featured ? "deck-card-featured" : ""}" href="#/deck/${encodeURIComponent(d.id)}" data-deck-link="${escape(d.id)}">
      <div class="deck-card-head">
        <h3>${escape(d.meta.name)}</h3>
        <span class="locale-tag">${escape((d.meta.frontLocale || d.meta.frontLang || "").toUpperCase())} → ${escape(d.meta.backLang.toUpperCase())}</span>
      </div>
      <p>${escape(d.meta.description || "")}</p>
      <div class="deck-stats">
        <span><strong>${d.cardCount}</strong> cards</span>
        <span><strong>${stats.due}</strong> due</span>
        <span><strong>${stats.learned}</strong> learned</span>
        ${sourceTag}
      </div>
    </a>
  `;
}

function computeQuickStats(deckEntry, progress, ctx) {
  // We have card count from index; for due/learned we need full states.
  let due = 0,
    learned = 0;
  const now = Date.now();
  for (const id of Object.keys(progress.cards)) {
    const st = progress.cards[id];
    if (st.dueAt <= now && st.lastReviewAt !== null) due += 1;
    if (st.reps >= 1) learned += 1;
  }
  return { due, learned };
}
