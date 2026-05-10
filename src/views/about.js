import { html, mount } from "./_dom.js";

export async function renderAbout(ctx) {
  mount(ctx.root, html`
    <div class="about">
      <h1>About Flashcards</h1>
      <p>A clean, fast, no-tracking flashcard app for language learners. The bundled deck is Spanish for South American travelers, but the engine is language-neutral — every deck is just a JSON file.</p>

      <h2>How studying works</h2>
      <p>It's straightforward spaced repetition: each card has a "next review" date that gets pushed further out every time you remember it, and reset when you forget. The four buttons after each card map to four levels of confidence:</p>
      <ul>
        <li><strong>Again</strong> — you blanked. The card comes back in ~10 minutes.</li>
        <li><strong>Hard</strong> — you got it but with effort. Interval grows slowly.</li>
        <li><strong>Good</strong> — solid recall. Interval grows normally.</li>
        <li><strong>Easy</strong> — instant. Interval grows faster.</li>
      </ul>
      <p class="muted">Be honest with the grades; the algorithm only works if the input is real. If you hesitated for more than a few seconds, it's "Good" at most. If you guessed, it's "Again".</p>

      <h2>How the deck was sequenced</h2>
      <p>The Spanish deck is split into 16 thematic units, ordered by how immediately useful each one is on a trip:</p>
      <ol>
        <li>Cognates (words you basically already know — instant confidence)</li>
        <li>Greetings &amp; politeness</li>
        <li>Survival phrases ("I don't understand", "do you speak English")</li>
        <li>Pronouns &amp; articles</li>
        <li>Numbers &amp; time</li>
        <li>Top 50 verbs</li>
        <li>Question words &amp; common adverbs</li>
        <li>Directions &amp; transit</li>
        <li>Food &amp; restaurants</li>
        <li>Lodging</li>
        <li>Money &amp; shopping</li>
        <li>Emergency &amp; health</li>
        <li>People &amp; family</li>
        <li>Common adjectives</li>
        <li>Prepositions &amp; connectors</li>
        <li>Body &amp; clothing</li>
      </ol>
      <p>Within each unit, words are roughly frequency-ordered. The decision to thematically cluster (instead of strict frequency order) is research-backed: words that co-occur in real scenarios stick better than alphabetized lists, and semantic neighbours <em>interfere</em> with each other in memory if you cram them too close together. (See <a href="https://github.com/TS00/flashcards/blob/main/RESEARCH.md" target="_blank" rel="noopener">RESEARCH.md</a> for citations.)</p>

      <h2>Adding your own deck</h2>
      <p>Two ways:</p>
      <ol>
        <li><strong>Paste it in the import box</strong> on the home screen. Stays local to your browser.</li>
        <li><strong>Fork the repo</strong>, drop a JSON file in <code>decks/</code>, add an entry to <code>decks/index.json</code>. The shape is documented in <a href="https://github.com/TS00/flashcards/blob/main/decks/SCHEMA.md" target="_blank" rel="noopener">SCHEMA.md</a>.</li>
      </ol>

      <h2>Privacy</h2>
      <p>This app runs entirely in your browser. There is no server. Your study progress, settings, and any imported decks live in <code>localStorage</code> under a single key (<code>flashcards.v1</code>). Use the Stats page to back up or wipe your data.</p>

      <h2>Source</h2>
      <p><a href="https://github.com/TS00/flashcards" target="_blank" rel="noopener">github.com/TS00/flashcards</a> — MIT licensed. PRs and deck contributions welcome.</p>
    </div>
  `);
}
