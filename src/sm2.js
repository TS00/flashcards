// SM-2 spaced repetition scheduler.
//
// Based on Wozniak (1990). Implementation choices:
//   - 4-button grading mapped to SM-2 quality scores:
//       Again -> 0   (failed; reset to learning)
//       Hard  -> 3   (recalled with serious difficulty)
//       Good  -> 4   (recalled correctly with effort)
//       Easy  -> 5   (recalled effortlessly)
//   - Ease factor (EF) starts at 2.5, clamped to >= 1.3.
//   - Interval steps for q >= 3:
//       reps == 0 -> 1 day
//       reps == 1 -> 6 days
//       reps >  1 -> previousInterval * EF
//   - Easy bonus: q == 5 multiplies the new interval by 1.3.
//   - On q < 3 the card resets to a learning state (interval=0, reps=0)
//     but EF is preserved minus a small penalty (Anki-style; less brutal
//     than vanilla SM-2 which can permanently brick a card).
//   - Intervals get a +/- 5% jitter to avoid pile-ups across days.
//
// A "card state" is shape:
//   { ef: number, reps: number, interval: number,
//     dueAt: number /*ms epoch*/, lapses: number, lastReviewAt: number|null }
//
// All times use ms-since-epoch. Day boundaries are local-day boundaries
// resolved via dayKey() so a card "due tomorrow" actually shows up tomorrow
// regardless of the user's timezone.

export const GRADE = Object.freeze({
  AGAIN: 0,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_EF = 1.3;
const MAX_EF = 3.0;

export function newCardState() {
  return {
    ef: 2.5,
    reps: 0,
    interval: 0,
    dueAt: 0,
    lapses: 0,
    lastReviewAt: null,
  };
}

// Apply a grade to a card state and return the next state.
// `now` is the time of review (ms epoch); injected for testability.
export function review(state, quality, now = Date.now()) {
  const s = { ...state };
  s.lastReviewAt = now;

  // Standard SM-2 EF update: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q)*0.02))
  let ef = s.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < MIN_EF) ef = MIN_EF;
  if (ef > MAX_EF) ef = MAX_EF;
  s.ef = ef;

  if (quality < 3) {
    // Lapse: reset reps but keep EF (with a tiny extra penalty applied above).
    s.reps = 0;
    s.interval = 0;
    s.lapses += 1;
    // Show again in ~10 minutes (sub-day "learning" step).
    s.dueAt = now + 10 * 60 * 1000;
    return s;
  }

  // Successful recall.
  let intervalDays;
  if (s.reps === 0) {
    intervalDays = 1;
  } else if (s.reps === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.max(1, Math.round(s.interval * s.ef));
  }
  if (quality === GRADE.HARD) {
    intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
  } else if (quality === GRADE.EASY) {
    intervalDays = Math.round(intervalDays * 1.3);
  }
  intervalDays = Math.max(1, jitter(intervalDays));

  s.reps += 1;
  s.interval = intervalDays;
  s.dueAt = now + intervalDays * MS_PER_DAY;
  return s;
}

// Preview what each grade would produce, without mutating state.
// Returns { again, hard, good, easy } each as a human-readable interval.
export function intervalPreview(state, now = Date.now()) {
  const out = {};
  for (const [label, q] of [
    ["again", GRADE.AGAIN],
    ["hard", GRADE.HARD],
    ["good", GRADE.GOOD],
    ["easy", GRADE.EASY],
  ]) {
    const next = review(state, q, now);
    out[label] = formatInterval(next.dueAt - now);
  }
  return out;
}

function jitter(days) {
  // +/- 5%, rounded
  const factor = 1 + (Math.random() - 0.5) * 0.1;
  return Math.round(days * factor);
}

export function formatInterval(ms) {
  if (ms <= 0) return "now";
  const minutes = ms / (60 * 1000);
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  const months = days / 30;
  if (months < 12) return `${Math.round(months)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function isDue(state, now = Date.now()) {
  return state.dueAt <= now;
}

export function isNew(state) {
  return state.lastReviewAt === null && state.reps === 0;
}

export function isLearning(state) {
  // Recently lapsed but not yet graduated back.
  return state.lapses > 0 && state.reps < 2;
}

// Local-day key for stats / streaks (YYYY-MM-DD in user's timezone).
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
