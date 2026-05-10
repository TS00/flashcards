# Flashcards

A clean, fast, evidence-based flashcard app for language learners. Pure static
HTML / CSS / JavaScript — no build step, no backend, no tracking. Your study
data lives in your browser's `localStorage`.

**Live demo:** <https://ts00.github.io/flashcards/>

The bundled deck is **Spanish for South American Travelers** — about 500 cards,
sequenced for someone going from zero to ordering coffee, navigating a bus
station, and handling a clinic visit. The app itself is **language-neutral**:
drop in a JSON file and you've got a new deck.

---

## Why this exists

I'm a native English speaker heading to South America and wanted to build my
Spanish vocab in a way that actually works. The research is pretty clear:

- **The first 1,000 words cover ~85% of everyday speech.** Doubling to 2,000
  only adds about 5% more comprehension. So the first ~500–800 words are
  wildly the highest leverage thing you can do.
- **Spaced repetition beats massed practice** by a wide margin (meta-analysis
  effect size ~0.78 in the medical-ed literature) — but only if you actually
  review at expanding intervals based on recall.
- **Active recall beats recognition.** Multiple-choice quizzes feel productive
  and don't really stick. Flashcards work because you have to *generate* the
  answer before flipping.
- **Cognates first** is gold for English → Spanish. `hospital`, `taxi`,
  `importante`, `posible`, `restaurante` — you already know hundreds of
  Spanish words and don't realise it.
- **Thematic clustering > semantic clustering.** Grouping by *scene*
  (restaurant, airport, pharmacy) helps retention more than grouping by
  *category* (all body parts, all colors), because semantic neighbours
  interfere with each other in memory.

Full reading list and citations in [`RESEARCH.md`](RESEARCH.md).

---

## Features

- **SM-2 spaced repetition** — the algorithm Anki and Duolingo are built on.
  Four-button grading (Again / Hard / Good / Easy) with sensible defaults.
- **Curated Spanish deck** — ~500 cards, 16 thematic units, sequenced from
  free-points cognates → greetings → survival phrases → travel scenarios.
- **Language-neutral architecture** — every deck is a JSON file. Add your own
  by dropping a file in `decks/` and adding an entry to `decks/index.json`,
  or paste/import one from the UI.
- **Native browser TTS** — click the speaker on any card to hear the prompt
  spoken in the deck's locale (Web Speech API, no third-party service).
- **Keyboard-first** — Space to flip, `1`–`4` to grade, `s` to speak, `?` for
  help.
- **Works offline** — once loaded, it's fully client-side. Your progress lives
  in `localStorage` (export / import as JSON anytime).
- **Dark mode**, mobile-friendly layout, no tracking, no analytics, no cookies.

---

## Quick start

### Use the live version

Just go to <https://ts00.github.io/flashcards/> and pick a deck.

### Run locally

It's static files — any web server works. From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` won't work because the deck JSON
is loaded via `fetch`. Any local web server fixes that.)

### Add your own deck

1. Copy `decks/spanish-traveler.json` as a template.
2. Edit the `meta` block (id, name, locale, license) and the `cards` array.
3. Add an entry to `decks/index.json`.
4. Reload — your deck shows up on the home screen.

The schema is documented in [`decks/SCHEMA.md`](decks/SCHEMA.md).

You can also **paste a deck JSON** directly into the "Import deck" box on the
home screen — useful for trying community decks without forking the repo.

---

## How to study (a short manifesto)

1. **Do it daily.** 10–20 minutes every day beats 2 hours on Sunday by a huge
   margin. The whole point of spaced repetition is that the schedule punishes
   binges and rewards consistency.
2. **Don't aim for 100% recall.** The research-backed sweet spot is around
   85–90%. If you're never failing cards, your intervals are too short and
   you're wasting effort.
3. **Be honest with the grades.** Marking everything "Easy" feels great and
   destroys the schedule. If you hesitated for more than ~5 seconds, it's
   "Good" at best. If you guessed, it's "Again".
4. **New cards: 10–20 a day.** You'll reach 500 in 3–6 weeks at that pace,
   which is plenty for a beginner trip.
5. **Speak the words out loud.** Tap the speaker, then repeat. Pronunciation
   memory is a separate skill from recognition memory.

---

## Roadmap

Things that would be cool but aren't here yet:

- Cloze deletion / sentence cards
- Listening-only and typing-input card modes
- FSRS algorithm option (more accurate than SM-2)
- IndexedDB for very large decks
- A small CLI to generate decks from a CSV / frequency list

PRs welcome. Decks especially welcome — if you make a good one, open a PR and
we'll bundle it.

---

## License

[MIT](LICENSE). The Spanish deck content is original curation; word frequency
data was cross-referenced against the CC-BY-4.0
[`doozan/spanish_data`](https://github.com/doozan/spanish_data) corpus —
attribution preserved in `decks/spanish-traveler.json` under
`meta.attribution`.
