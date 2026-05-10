# Deck format

A deck is a single JSON file. Schema:

```json
{
  "meta": {
    "id": "spanish-traveler",
    "name": "Spanish for South American Travelers",
    "description": "~500 words and phrases sequenced for a beginner trip.",
    "version": "1.0.0",
    "frontLang": "es",
    "frontLocale": "es-419",
    "backLang": "en",
    "license": "MIT",
    "attribution": "Word frequency cross-referenced against doozan/spanish_data (CC-BY-4.0).",
    "ttsRate": 0.85
  },
  "units": [
    { "id": "u01-cognates", "name": "1 · Free wins (cognates)", "blurb": "Words you basically already know." },
    { "id": "u02-greetings", "name": "2 · Greetings & politeness", "blurb": "" }
  ],
  "cards": [
    {
      "id": "es-hospital",
      "front": "el hospital",
      "back": "the hospital",
      "unit": "u01-cognates",
      "pos": "noun",
      "tags": ["cognate", "health"],
      "exampleFront": "El hospital está cerca.",
      "exampleBack": "The hospital is nearby.",
      "ttsText": "el hospital"
    }
  ]
}
```

## Field reference

### `meta`

| Field          | Required | Description |
|----------------|:--------:|---|
| `id`           | yes      | URL-safe slug, unique across all decks. |
| `name`         | yes      | Human-readable deck name. |
| `description`  |          | One-paragraph description shown on the home screen. |
| `version`      |          | Semver string. Used to detect deck updates. |
| `frontLang`    | yes      | BCP-47 language tag for the prompt side (e.g. `es`, `fr`, `ja`). |
| `frontLocale`  |          | More specific locale for TTS (e.g. `es-419` for Latin American Spanish). Falls back to `frontLang` if absent. |
| `backLang`     | yes      | BCP-47 language tag for the answer side. |
| `license`      |          | License of the deck content. |
| `attribution`  |          | Free-text attribution / sources. |
| `ttsRate`      |          | Speech rate 0.1–10. Default 0.9. |

### `units`

Optional. If present, cards reference units by `unit` id. The home screen
shows progress per unit. Units render in array order.

### `cards`

| Field          | Required | Description |
|----------------|:--------:|---|
| `id`           | yes      | Unique within the deck. Stable IDs let progress survive deck updates. |
| `front`        | yes      | Prompt shown first. |
| `back`         | yes      | Answer revealed on flip. |
| `unit`         |          | Unit id (must match a `units[].id`). |
| `pos`          |          | Part of speech (`noun`, `verb`, `adj`, `phrase`, …) — shown as a small label. |
| `tags`         |          | Array of free-text tags for filtering. |
| `exampleFront` |          | Example sentence in the front language. |
| `exampleBack`  |          | Translation of the example. |
| `ttsText`      |          | What to speak when the speaker is tapped. Defaults to `front`. |
| `notes`        |          | Long-form note shown below the card. |

## Validation

The app does light validation at load time and shows a clear error if a deck
is malformed. There's no JSON Schema file shipped, but every field above is
plain string / array — no funny business.

## Tips for deck authors

- **One concept per card.** Don't put two meanings on the back; make two cards.
- **Tag what you can.** Tags drive future features (review-by-tag, etc.) and
  cost nothing now.
- **Use `exampleFront` and `exampleBack` liberally.** Example sentences
  dramatically improve transfer to real-world use.
- **Sequence by unit.** Frequency-weighted within unit, scenario-themed across
  units.
- **Stable card `id`s.** If you change a card's `id`, learners lose their
  progress on it. Treat `id`s as a contract.
