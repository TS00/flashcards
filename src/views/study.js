import { html, mount, escape } from "./_dom.js";

export async function renderStudy(ctx, deckId) {
  const deck = await ctx.deckLib.loadDeck(deckId);
  const progress = ctx.storage.getDeckProgress(deck.meta.id);
  const settings = ctx.storage.getSettings();

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
  let markedAgain = 0;
  const startTime = Date.now();

  const sessionDiv = document.createElement("div");
  sessionDiv.className = "session";
  ctx.root.innerHTML = "";
  ctx.root.appendChild(sessionDiv);

  // ---- render a single card ----

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
    const progressPct = Math.round((index / total) * 100);

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

        <div class="hint" id="flip-hint"><kbd>Space</kbd> to reveal</div>
        <div class="hint" id="next-hint" hidden><kbd>Space</kbd> next · <kbd>1</kbd> mark forgot</div>
      </div>
    `;

    const cardEl = sessionDiv.querySelector("#flashcard");
    const backEl = sessionDiv.querySelector("#back");
    const flipHint = sessionDiv.querySelector("#flip-hint");
    const nextHint = sessionDiv.querySelector("#next-hint");

    const doSpeak = ctx.tts.isSupported()
      ? () => ctx.tts.speak(ttsText, { lang: ttsLang, rate: ttsRate })
      : () => {};

    function flip() {
      if (flipped) return;
      flipped = true;
      backEl.hidden = false;
      flipHint.hidden = true;
      nextHint.hidden = false;
      doSpeak();
    }

    function advance(quality) {
      if (!flipped) return;
      const next = ctx.sm2.review(state, quality);
      ctx.storage.setCardState(deck.meta.id, cardId, next);
      ctx.storage.recordReview(deck.meta.id, ctx.sm2.dayKey(), { wasNew });
      reviewed += 1;
      if (quality < 3) {
        markedAgain += 1;
        queue.push(card);
      }
      index += 1;
      render();
    }

    cardEl.addEventListener("click", () => {
      if (!flipped) flip();
      else advance(ctx.sm2.GRADE.GOOD);
    });

    const speakBtn = sessionDiv.querySelector("#speak-btn");
    if (speakBtn) {
      speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        doSpeak();
      });
    }

    sessionDiv.querySelector("#leave-btn").addEventListener("click", leave);
    cardEl.focus();

    // Expose for keyboard handler
    sessionDiv._cardActions = { flip, advance, doSpeak, isFlipped: () => flipped };
  }

  // ---- session complete ----

  function renderDone() {
    const elapsedMin = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    sessionDiv.innerHTML = html`
      <div class="session-done">
        <div class="big-num">✓</div>
        <h2>Session complete</h2>
        <p style="color:var(--fg-muted); max-width: 40ch">
          You went through <strong>${reviewed}</strong> card${reviewed === 1 ? "" : "s"}
          in <strong>${elapsedMin}</strong> minute${elapsedMin === 1 ? "" : "s"}.
          ${markedAgain > 0 ? `Marked <strong>${markedAgain}</strong> to review again.` : ""}
        </p>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
          <a class="btn btn-primary" href="#/deck/${encodeURIComponent(deck.meta.id)}/study">Another round</a>
          <a class="btn" href="#/deck/${encodeURIComponent(deck.meta.id)}">Back to deck</a>
          <a class="btn btn-ghost" href="#/stats">See stats</a>
        </div>
      </div>
    `;
    sessionDiv._cardActions = null;
  }

  function leave() {
    if (reviewed > 0) {
      if (!confirm(`Leave now? Progress on ${reviewed} card${reviewed === 1 ? "" : "s"} is saved.`)) return;
    }
    ctx.navigate(`/deck/${encodeURIComponent(deck.meta.id)}`);
  }

  // ---- keyboard ----

  function onKey(e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const actions = sessionDiv._cardActions;
    if (!actions) return;

    if (e.key === " ") {
      e.preventDefault();
      if (!actions.isFlipped()) actions.flip();
      else actions.advance(ctx.sm2.GRADE.GOOD);
    } else if (e.key === "1") {
      // Mark as forgot — only when flipped
      if (actions.isFlipped()) {
        e.preventDefault();
        actions.advance(ctx.sm2.GRADE.AGAIN);
      }
    } else if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      actions.doSpeak();
    } else if (e.key === "Escape") {
      e.preventDefault();
      leave();
    }
  }
  document.addEventListener("keydown", onKey);
  const cleanup = () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", cleanup);
  };
  window.addEventListener("hashchange", cleanup);

  render();
}
