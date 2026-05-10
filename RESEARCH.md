# Research notes

These are the findings that shaped the app's design decisions. Sources at the
bottom.

## How many words does a beginner traveler need?

| Vocabulary size | Approx. coverage of speech | What you can do |
|---:|---:|---|
| 250 | ~60% | Greetings, numbers, ordering, "where is", "how much" |
| 500 | ~75% | Hold a halting tourist conversation; understand menus |
| **1,000** | **~85% (88% of oral speech)** | **A2 level. Most daily transactions. The sweet spot.** |
| 2,000 | ~93% | B1. Read graded readers comfortably. |
| 5,000 | ~97% | Educated native baseline. |

The first 1,000 words give you ~85% coverage; the second 1,000 only adds 5%.
That sharp diminishing-returns curve is the whole reason frequency-based
ordering matters so much for beginners. The Spanish deck targets ~500–600
words, which is where the curve is still steepest — best return on study time
for a 4–8 week trip prep window.

## What kind of words?

L2 vocabulary is acquired in a predictable order: **frequent, concrete,
basic-level, typical** words come first. Abstract / superordinate / atypical
words come later. Beginners also benefit massively from **cognates** — words
that look or sound similar across languages give them prior-knowledge anchors
on day one. English-Spanish has hundreds of free cognates (`hospital`,
`importante`, `posible`, `restaurante`, `taxi`, `aeropuerto`, …).

So the deck leans into:

- High-frequency function words (articles, pronouns, top-50 verbs, common
  prepositions and connectors)
- Concrete travel-relevant nouns (food, money, transit, lodging, body parts)
- Cognates as the very first unit, for confidence

It avoids:

- Pure abstract vocabulary the user won't use on a trip
- Conjugation tables (a deck is the wrong shape for grammar)
- Long sentences as primary cards (one concept per card)

## How to sequence them?

Two competing schools of thought:

- **Semantic clustering** — group by category (all body parts, all colors).
  Easy to organize. *Hurts retention* in the research, because semantic
  neighbours interfere with each other in memory ("eye / ear / nose / mouth"
  all blur together).
- **Thematic clustering** — group by scene/scenario (restaurant: menu, waiter,
  bill, tip, fork, knife, plate). Slightly harder to organize. *Better for
  retention* and much better for *transfer* to real conversations, because
  you've practiced the words in the configurations they actually co-occur in.

The deck uses **thematic clustering** with a frequency-aware ordering
*within* each unit. Unit order roughly tracks "what you'll need first on day
one of a trip" rather than alphabetical or strict frequency.

## Algorithm: SM-2

Of the popular spaced repetition algorithms:

- **SM-2** (1987, SuperMemo) — the foundation. Used by Anki, Duolingo, and
  basically every other vocab app for 30 years. Simple to implement,
  well-understood, evidence-based, easy to debug.
- **FSRS** (2022+) — newer, machine-learned. Outperforms SM-2 for ~99% of
  users in Anki's own testing. But: requires a forgetting model, way more
  parameters, much harder to implement well.

This app ships SM-2. It's the right call for v1: it's good enough that
millions of learners have hit fluency on it, and the implementation is ~50
lines. FSRS is on the roadmap.

### SM-2 in this app

- 4-button grading: **Again** (q=0), **Hard** (q=3), **Good** (q=4),
  **Easy** (q=5)
- Ease factor (EF) starts at 2.5, clamped to ≥1.3
- Intervals: failed → 0 days, first success → 1 day, second → 6 days,
  thereafter `interval × EF`
- A small ±5% randomization on intervals to avoid card pile-ups (Anki does
  this too)
- Daily review queue = (cards due today) + (up to N new cards), N
  user-configurable, default 15

### Target retention

The research-backed retention sweet spot is **~85–90%**, *not* 100%. If
you're never failing cards, your intervals are too short and you're wasting
review time. The default new-card rate (15/day) and SM-2 parameters target
that band.

## Card design

Per the active-recall literature:

- **One concept per card.** No two-meaning cards, no compound prompts.
- **Force retrieval, not recognition.** No multiple choice; the answer is
  hidden until the user commits.
- **Provide context.** Each card has an optional example sentence so the word
  is anchored to a usage, not floating in the void.
- **Audio matters.** Pronunciation memory is a separate skill from recognition
  memory. Web Speech API gives us native TTS for free.

## Sources

- *How Many Spanish Words Do You Need to Know to Be Fluent?* — Inklingo Blog
- *How Much Vocabulary Do You Actually Need to Be Fluent?* — Learnables
- *1000 Most Common Spanish Words List and How to Use It* — Speakada
- *What spaced repetition algorithm does Anki use?* — Anki FAQs
- *Empirical testing of the SM-2 algorithm's performance on scheduling
  overdue cards* — controlaltbackspace.org
- *What Makes a Spaced Repetition Algorithm Effective* — Mindomax
- *How is vocabulary learnt? An acquisitional sequence of L2 word knowledge*
  — White Rose Research Online
- *Natural Order of Vocabulary Acquisition* — SSRN preprint
- *Content Sequencing in Language Learning: Does It Make a Difference?* —
  Polyglossic
- *AI-Generated Flashcards — Best Practices for Maximum Retention* —
  Edugenius
- *7 Proven Active Recall Studying Examples for Better Retention* —
  freebrain.net
- Wozniak, P. *Optimization of repetition spacing in the practice of
  learning* (1990) — original SM-2 paper
