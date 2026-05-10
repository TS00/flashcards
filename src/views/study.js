import { html, mount, escape } from "./_dom.js";

export async function renderStudy(ctx, deckId) {
  const deck = await ctx.deckLib.loadDeck(deckId);
  const progress = ctx.storage.getDeckProgress(deck.meta.id);
  const settings = ctx.storage.getSettings();

  // Build the session ONCE at start. As cards are reviewed they may become
  // due again immediately (if user pressed Again); we re-add them to the
  // tail of the session queue.
  const queue = ctx.deckLib.buildSession(deck, progress, settings);

  if (queue.length === 0) {
    mount(ctx.root, html`
      <div class="empty">
        <h2>Nothing to study</h2>
        <p>You're caught up — come back tomorrow, or bump up the daily new-card cap on the deck page.</p>
        <p><a href="#/deck/${encodeURIComponent(deck.meta.id)}">← Back to ${escape(deck.meta.name)}</a></p>
      </div>`);
    return;
  }

  const total = queue.length;
  let index = 0;
  let reviewed = 0;
  let again = 0;
  const startTime = Date.now();

  const sessionDiv = document.createElement("div");
  sessionDiv.className = "session";
  ctx.root.innerHTML = "";
  ctx.root.appendChild(sessionDiv);

  function render() {
    if (index >= queue.length) {
      renderDone();
      return;
    }
    const card = queue[index];
    const cardId = card.id;
    const state = progress.cards[cardId] || ctx.sm2.newCardState();
    const wasNew = state.lastReviewAt === null && state.reps === 0;
    let flipped = false;

    const ttsLang = deck.meta.frontLocale || deck.meta.frontLang;
    const ttsText = card.ttsText || card.front;
    const ttsRate = deck.meta.ttsRate || 0.9;

    const preview = ctx.sm2.intervalPreview(state);
    const progressPct = Math.round((index / total) * 100);
    const remaining = total - index;

    sessionDiv.innerHTML = html`
      <div class="session-header">
        <span class="locale-tag">${escape(deck.meta.name)}</span>
        <div class="progress-bar"><span style="width:${progressPct}%"></span></div>
        <span>${index + 1} / ${total}</span>
        <button class="btn btn-ghost btn-sm leave" id="leave-btn">Leave</button>
      </div>

      <div class="card" id="flashcard" role="button" tabindex="0" aria-label="Flashcard. Press space to flip.">
        ${card.pos ? `<div class="pos">${escape(card.pos)}</div>` : ""}
        ${ctx.tts.isSupported() ? `
          <button class="speak" id="speak-btn" aria-label="Speak prompt" title="Speak (S)">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>
            </svg>
          </button>` : ""}

        <div class="front-text">${escape(card.front)}</div>

        <div class="back" id="back" hidden>
          <div class="back-text">${escape(card.back)}</div>
          ${card.exampleFront ? `<div class="example">${escape(card.exampleFront)}${card.exampleBack ? `<span class="ex-back">${escape(card.exampleBack)}</span>` : ""}</div>` : ""}
          ${card.notes ? `<div class="notes">${escape(card.notes)}</div>` : ""}
        </div>

        <div class="hint" id="flip-hint">Try to recall the meaning, then press <kbd>Space</kbd> or click to reveal</div>
      </div>

      <div id="grade-row" hidden>
        <p class="grade-prompt">Did you know the answer? Be honest — pick how well you remembered.</p>
        <div class="grade-row">
          <button class="grade-btn" data-grade="0">
            <span>Again</span>
            <span class="grade-hint">Didn't know it</span>
            <span class="interval">${preview.again}</span>
            <span class="key">1</span>
          </button>
          <button class="grade-btn" data-grade="3">
            <span>Hard</span>
            <span class="grade-hint">Got it, but struggled</span>
            <span class="interval">${preview.hard}</span>
            <span class="key">2</span>
          </button>
          <button class="grade-btn" data-grade="4">
            <span>Good</span>
            <span class="grade-hint">Remembered fine</span>
            <span class="interval">${preview.good}</span>
            <span class="key">3</span>
          </button>
          <button class="grade-btn" data-grade="5">
            <span>Easy</span>
            <span class="grade-hint">Instant recall</span>
            <span class="interval">${preview.easy}</span>
            <span class="key">4</span>
          </button>
        </div>
      </div>
    `;

    const cardEl = sessionDiv.querySelector("#flashcard");
    const backEl = sessionDiv.querySelector("#back");
    const hintEl = sessionDiv.querySelector("#flip-hint");
    const gradeRow = sessionDiv.querySelector("#grade-row");
    const gradeButtons = gradeRow.querySelector(".grade-row");

    function flip() {
      if (flipped) return;
      flipped = true;
      backEl.hidden = false;
      hintEl.hidden = true;
      gradeRow.hidden = false;
    }
    cardEl.addEventListener("click", flip);
    cardEl.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      }
    });
    cardEl.focus();

    sessionDiv.querySelectorAll(".grade-btn").forEach((b) => {
      b.addEventListener("click", () => grade(parseInt(b.dataset.grade, 10)));
    });

    sessionDiv.querySelector("#leave-btn").addEventListener("click", leave);

    const speakBtn = sessionDiv.querySelector("#speak-btn");
    if (speakBtn) {
      const doSpeak = () => ctx.tts.speak(ttsText, { lang: ttsLang, rate: ttsRate });
      speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        doSpeak();
      });
      // Auto-speak on flip too — useful for ear training.
      cardEl.addEventListener("click", () => {
        if (flipped) doSpeak();
      });
    }

    function grade(quality) {
      if (!flipped) return;
      const next = ctx.sm2.review(state, quality);
      ctx.storage.setCardState(deck.meta.id, cardId, next);
      ctx.storage.recordReview(deck.meta.id, ctx.sm2.dayKey(), { wasNew });
      reviewed += 1;
      if (quality < 3) {
        again += 1;
        // Re-queue lapsed cards near the end of this session.
        queue.push(card);
      }
      index += 1;
      render();
    }
  }

  function renderDone() {
    const elapsedMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    const accuracy = reviewed === 0 ? 100 : Math.round(((reviewed - again) / reviewed) * 100);
    sessionDiv.innerHTML = html`
      <div class="session-done">
        <div class="big-num">✓</div>
        <h2>Session complete</h2>
        <p style="color:var(--fg-muted); max-width: 40ch">
          You reviewed <strong>${reviewed}</strong> card${reviewed === 1 ? "" : "s"}
          in <strong>${elapsedMin}</strong> minute${elapsedMin === 1 ? "" : "s"} —
          <strong>${accuracy}%</strong> recall.
          ${accuracy >= 95 ? "Maybe bump up the daily new-card limit." : ""}
          ${accuracy < 75 ? "Lots of misses — that's normal early on. Keep at it." : ""}
        </p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
          <a class="btn btn-primary" href="#/deck/${encodeURIComponent(deck.meta.id)}/study">Another round</a>
          <a class="btn" href="#/deck/${encodeURIComponent(deck.meta.id)}">Back to deck</a>
          <a class="btn btn-ghost" href="#/stats">See stats</a>
        </div>
      </div>
    `;
  }

  function leave() {
    if (reviewed > 0) {
      if (!confirm(`Leave now? Your progress on ${reviewed} reviewed card${reviewed === 1 ? "" : "s"} is saved.`)) return;
    }
    ctx.navigate(`/deck/${encodeURIComponent(deck.meta.id)}`);
  }

  // Keyboard shortcuts at session level.
  function onKey(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === " ") {
      const card = sessionDiv.querySelector("#flashcard");
      if (card) {
        e.preventDefault();
        card.click();
      }
    } else if (["1", "2", "3", "4"].includes(e.key)) {
      const map = { 1: 0, 2: 3, 3: 4, 4: 5 };
      const btn = sessionDiv.querySelector(`.grade-btn[data-grade="${map[e.key]}"]`);
      if (btn && !btn.closest("#grade-row").hidden) {
        e.preventDefault();
        btn.click();
      }
    } else if (e.key.toLowerCase() === "s") {
      const speak = sessionDiv.querySelector("#speak-btn");
      if (speak) {
        e.preventDefault();
        speak.click();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      leave();
    }
  }
  document.addEventListener("keydown", onKey);
  // Cleanup when leaving this view.
  const cleanup = () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", cleanup);
  };
  window.addEventListener("hashchange", cleanup);

  render();
}
