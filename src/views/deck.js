import { html, mount, escape } from "./_dom.js";

export async function renderDeck(ctx, deckId) {
  const deck = await ctx.deckLib.loadDeck(deckId);
  ctx.storage.setDeckMeta(deck.meta.id, deck.meta);
  const progress = ctx.storage.getDeckProgress(deck.meta.id);
  const settings = ctx.storage.getSettings();
  const stats = ctx.deckLib.computeDeckStats(deck, progress);
  const unitStats = ctx.deckLib.computeUnitStats(deck, progress);

  const session = ctx.deckLib.buildSession(deck, progress, settings);
  const sessionSize = session.length;

  const description = deck.meta.description ? `<p>${escape(deck.meta.description)}</p>` : "";
  const attribution = deck.meta.attribution
    ? `<p class="muted" style="font-size:.85rem;color:var(--fg-subtle);margin-top:.5rem">${escape(deck.meta.attribution)}</p>`
    : "";

  const studyDisabled = sessionSize === 0;

  mount(ctx.root, html`
    <div style="margin-bottom:1rem">
      <a href="#/" style="color:var(--fg-muted);font-size:.9rem">← All decks</a>
    </div>

    <div class="deck-header">
      <div class="meta">
        <h1 style="margin:0">${escape(deck.meta.name)}</h1>
        ${description}
        ${attribution}
      </div>
      <div class="actions">
        <button class="btn btn-primary" id="study-btn" ${studyDisabled ? "disabled" : ""}>
          ${studyDisabled ? "Nothing due — come back later" : `Study ${sessionSize} card${sessionSize === 1 ? "" : "s"}`}
        </button>
        <button class="btn" id="export-btn">Export progress</button>
        <button class="btn btn-ghost" id="reset-btn">Reset progress</button>
      </div>
    </div>

    <div class="summary-row">
      <div class="summary-stat"><div class="label">Total</div><div class="value">${stats.total}</div></div>
      <div class="summary-stat new"><div class="label">New</div><div class="value">${stats.fresh}</div></div>
      <div class="summary-stat due"><div class="label">Due now</div><div class="value">${stats.due}</div></div>
      <div class="summary-stat learning"><div class="label">Learning</div><div class="value">${stats.learning}</div></div>
      <div class="summary-stat"><div class="label">Mastered</div><div class="value">${stats.mastered}</div></div>
    </div>

    <h2 style="margin-top:1.5rem">Units</h2>
    <p style="color:var(--fg-muted);margin-top:.25rem">Curated, thematically clustered. Cards are introduced in unit order; new cards from later units don't appear until earlier units are well underway.</p>
    <div class="unit-list">
      ${unitStats.map(unitRowHtml).join("")}
    </div>

    <h2 style="margin-top:2rem">Session settings</h2>
    <p style="color:var(--fg-muted);margin-top:.25rem">Defaults are based on the spaced-repetition research — see <a href="https://github.com/TS00/flashcards/blob/main/RESEARCH.md" target="_blank" rel="noopener">RESEARCH.md</a>. Stick with these unless you know what you're doing.</p>
    <div class="settings-grid">
      <label>
        New cards per day
        <input type="number" id="setting-new" min="0" max="100" step="1" value="${settings.newPerDay}" />
      </label>
      <label>
        Max reviews per session
        <input type="number" id="setting-review" min="10" max="500" step="10" value="${settings.reviewLimit}" />
      </label>
    </div>
  `);

  ctx.root.querySelector("#study-btn").addEventListener("click", () => {
    if (studyDisabled) return;
    ctx.navigate(`/deck/${encodeURIComponent(deck.meta.id)}/study`);
  });
  ctx.root.querySelector("#reset-btn").addEventListener("click", () => {
    if (confirm(`Reset all progress for "${deck.meta.name}"? This can't be undone.`)) {
      ctx.storage.resetDeck(deck.meta.id);
      ctx.navigate(`/deck/${encodeURIComponent(deck.meta.id)}`);
    }
  });
  ctx.root.querySelector("#export-btn").addEventListener("click", () => {
    const blob = new Blob([ctx.storage.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashcards-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const newInput = ctx.root.querySelector("#setting-new");
  const revInput = ctx.root.querySelector("#setting-review");
  function commit() {
    const newPerDay = clamp(parseInt(newInput.value, 10) || 0, 0, 100);
    const reviewLimit = clamp(parseInt(revInput.value, 10) || 0, 10, 500);
    ctx.storage.updateSettings({ newPerDay, reviewLimit });
  }
  newInput.addEventListener("change", commit);
  revInput.addEventListener("change", commit);
}

function unitRowHtml({ unit, total, learned }) {
  const pct = total === 0 ? 0 : Math.round((learned / total) * 100);
  return `
    <div class="unit-row">
      <div>
        <div class="name">${escape(unit.name)}</div>
        ${unit.blurb ? `<div class="blurb">${escape(unit.blurb)}</div>` : ""}
      </div>
      <div class="progress" aria-label="${pct}% learned"><span style="width:${pct}%"></span></div>
      <div class="count">${learned} / ${total}</div>
    </div>
  `;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
