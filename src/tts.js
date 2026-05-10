// Thin wrapper around the Web Speech API. Falls back to a no-op if the
// browser doesn't support speechSynthesis (e.g. some embedded webviews).

let voices = [];
let voicesLoaded = false;

function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) voicesLoaded = true;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

export function isSupported() {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

export function speak(text, { lang = "en-US", rate = 0.9, pitch = 1.0 } = {}) {
  if (!isSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything in flight

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  utter.pitch = pitch;

  if (!voicesLoaded) loadVoices();
  const match = pickVoice(lang);
  if (match) utter.voice = match;

  synth.speak(utter);
}

function pickVoice(lang) {
  if (!voices.length) return null;
  const target = lang.toLowerCase();
  // Exact match first (e.g. "es-419"), then prefix match (e.g. "es"), then default.
  let v = voices.find((v) => v.lang && v.lang.toLowerCase() === target);
  if (v) return v;
  const prefix = target.split("-")[0];
  v = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
  return v || null;
}
