import { html, mount, escape } from "./_dom.js";

export async function renderStats(ctx) {
  const history = ctx.storage.getGlobalHistory();
  const decks = await ctx.deckLib.loadDeckIndex();

  const today = ctx.sm2.dayKey();
  const todayStats = history[today] || { reviewed: 0, learned: 0 };
  const streak = computeStreak(history);
  const last30 = lastNDays(history, 30);
  const totalReviewed = Object.values(history).reduce((a, b) => a + b.reviewed, 0);
  const totalLearned = Object.values(history).reduce((a, b) => a + b.learned, 0);

  // Per-deck quick numbers.
  const deckRows = await Promise.all(
    decks.map(async (entry) => {
      if (entry.error) return null;
      const progress = ctx.storage.getDeckProgress(entry.id);
      let due = 0,
        learned = 0;
      const now = Date.now();
      for (const id of Object.keys(progress.cards)) {
        const st = progress.cards[id];
        if (st.dueAt <= now && st.lastReviewAt !== null) due += 1;
        if (st.reps >= 1) learned += 1;
      }
      return { entry, due, learned };
    }),
  );

  const heatmapHtml = renderHeatmap(history);

  mount(ctx.root, html`
    <h1>Your stats</h1>
    <p style="color:var(--fg-muted); margin-bottom: 1.5rem">All-local. Nothing leaves your browser.</p>

    <div class="stats-overall">
      <div class="summary-stat"><div class="label">Today</div><div class="value">${todayStats.reviewed}</div><div class="label" style="margin-top:.5rem">${todayStats.learned} new</div></div>
      <div class="summary-stat"><div class="label">Streak</div><div class="value">${streak}</div><div class="label" style="margin-top:.5rem">day${streak === 1 ? "" : "s"}</div></div>
      <div class="summary-stat"><div class="label">Last 30 days</div><div class="value">${last30}</div><div class="label" style="margin-top:.5rem">reviews</div></div>
      <div class="summary-stat"><div class="label">All-time</div><div class="value">${totalReviewed}</div><div class="label" style="margin-top:.5rem">${totalLearned} cards introduced</div></div>
    </div>

    <h2>Activity</h2>
    <p style="color:var(--fg-muted); font-size:.9rem">A year of reviews. Each cell is one day; darker = more cards reviewed.</p>
    ${heatmapHtml}

    <h2 style="margin-top:2rem">Per-deck</h2>
    ${deckRows.filter(Boolean).length === 0
      ? `<p style="color:var(--fg-muted)">No decks yet.</p>`
      : `<div class="unit-list">${deckRows.filter(Boolean).map(perDeckHtml).join("")}</div>`
    }

    <h2 style="margin-top:2rem">Backup</h2>
    <p style="color:var(--fg-muted); font-size:.9rem">Browsers occasionally clear localStorage. Save a backup if your progress matters to you.</p>
    <div style="display:flex; gap:.5rem; flex-wrap:wrap">
      <button class="btn" id="export-btn">Download JSON backup</button>
      <label class="btn" style="cursor:pointer">
        Restore from backup
        <input type="file" accept="application/json" id="import-file" hidden />
      </label>
      <button class="btn btn-ghost" id="clear-btn">Erase all my data</button>
    </div>
    <div id="restore-msg" style="margin-top:.5rem;font-size:.85rem"></div>
  `);

  ctx.root.querySelector("#export-btn").addEventListener("click", () => {
    const blob = new Blob([ctx.storage.exportAll()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashcards-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  ctx.root.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = ctx.root.querySelector("#restore-msg");
    try {
      const text = await file.text();
      ctx.storage.importAll(text);
      msg.style.color = "var(--good)";
      msg.textContent = "Restored. Reload the page to see updated stats.";
    } catch (err) {
      msg.style.color = "var(--bad)";
      msg.textContent = `Couldn't restore: ${err.message}`;
    }
  });

  ctx.root.querySelector("#clear-btn").addEventListener("click", () => {
    if (confirm("This wipes ALL your progress, settings, and imported decks. Sure?")) {
      ctx.storage.resetAll();
      ctx.navigate("/");
    }
  });
}

function perDeckHtml({ entry, due, learned }) {
  return `
    <a class="unit-row" href="#/deck/${encodeURIComponent(entry.id)}" style="text-decoration:none;color:inherit">
      <div>
        <div class="name">${escape(entry.meta.name)}</div>
        <div class="blurb">${due} due · ${learned} learned · ${entry.cardCount} total</div>
      </div>
      <div class="progress"><span style="width:${entry.cardCount === 0 ? 0 : Math.round(learned / entry.cardCount * 100)}%"></span></div>
      <div class="count">${learned} / ${entry.cardCount}</div>
    </a>
  `;
}

function computeStreak(history) {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (history[key] && history[key].reviewed > 0) streak += 1;
    else if (i === 0) continue; // grace period for "haven't started today yet"
    else break;
  }
  return streak;
}

function lastNDays(history, n) {
  let total = 0;
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (history[key]) total += history[key].reviewed;
  }
  return total;
}

function renderHeatmap(history) {
  const cells = [];
  const now = new Date();
  // 53 weeks of 7 days = 371 cells. Render Mon-first.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let w = 52; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      // Move back to start of weeks-ago, then forward d days.
      date.setDate(today.getDate() - (w * 7) - (today.getDay() - d));
      if (date > today) {
        cells.push(`<div class="cell" style="visibility:hidden"></div>`);
        continue;
      }
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const count = (history[key] || {}).reviewed || 0;
      const level = count === 0 ? 0 : count < 5 ? 1 : count < 20 ? 2 : count < 50 ? 3 : 4;
      cells.push(`<div class="cell" data-level="${level}" title="${key}: ${count} reviews"></div>`);
    }
  }
  return `<div class="heatmap" role="img" aria-label="Review activity over the past year">${cells.join("")}</div>`;
}
