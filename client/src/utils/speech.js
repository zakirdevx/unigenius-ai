// Voice helpers built on the browser's own speech features (free, no extra API):
//   - SpeechRecognition  : turns your voice into text (Chrome / Edge; needs internet)
//   - speechSynthesis    : speaks text aloud with voices installed in your browser / Windows
import { loadString, saveString } from './storage.js';

const win = typeof window !== 'undefined' ? window : null;

export const hasRecognition = () => Boolean(win && (win.SpeechRecognition || win.webkitSpeechRecognition));
export const hasSynthesis = () => Boolean(win && 'speechSynthesis' in win && 'SpeechSynthesisUtterance' in win);

export const getVoiceLang = () => (loadString('voiceLang', 'en-US') === 'ur-PK' ? 'ur-PK' : 'en-US');
export const setVoiceLang = (lang) => saveString('voiceLang', lang);

// ---- phones: audio may only start after a tap. Call unlockAudio() inside the tap handler. ----
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
let sharedAudio = null;
export const isMobileDevice = () => Boolean(win && /Android|iPhone|iPad|iPod/i.test(win.navigator.userAgent || ''));

/** Unlocks sound playback for the whole session (needed on Android and iPhone). */
export function unlockAudio() {
  try {
    sharedAudio ||= new Audio();
    sharedAudio.src = SILENT;
    sharedAudio.play().catch(() => {});
    if (hasSynthesis()) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      win.speechSynthesis.speak(u);
    }
  } catch { /* ignore */ }
}

/** Asks for the microphone inside the tap (so the permission box appears), then lets go of it again. */
export async function askMicPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** Listens once. Calls onEnd(finalText) when you stop talking (text may be empty). */
export function createRecognizer({ lang, onInterim, onError, onEnd }) {
  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (event) => onError?.(event.error);
  rec.onend = () => {
    const text = finalText.trim();
    finalText = '';
    onEnd?.(text);
  };
  return rec;
}

// ---- voices ----
let voices = [];
if (hasSynthesis()) {
  const load = () => {
    voices = win.speechSynthesis.getVoices();
  };
  load();
  win.speechSynthesis.onvoiceschanged = load;
}

const MALE = /david|mark|guy|ryan|james|george|daniel|asad|christopher|eric|roger|brian|prabhat|ravi|thomas|male/i;
const FEMALE = /zira|hazel|susan|aria|jenny|libby|sonia|uzma|samantha|female|heera|catherine|linda/i;

/** Picks a clear, natural MALE voice for the language ("Natural"/"Online" voices sound best). */
export function pickVoice(lang) {
  const base = lang.slice(0, 2).toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  if (matches.length === 0) return null;
  const score = (v) =>
    (MALE.test(v.name) ? 6 : 0) -
    (FEMALE.test(v.name) ? 6 : 0) +
    (/natural|online/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (/microsoft/i.test(v.name) ? 1 : 0) +
    (v.lang.toLowerCase() === lang.toLowerCase() ? 2 : 0);
  return [...matches].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Speaks sentences one after another. Short pieces are used on purpose: browsers cut off
 * very long utterances. say() can be called while it is still speaking (it queues).
 */
export function createSpeaker({ lang, rate = 0.92, onStart, onIdle }) {
  const synth = win.speechSynthesis;
  let queue = [];
  let speaking = false;
  let stopped = false;
  let current = null;

  const next = () => {
    if (stopped) return;
    const text = queue.shift();
    if (!text) {
      speaking = false;
      onIdle?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    current = utterance; // keep a reference: Chrome can drop "end" events of garbage-collected utterances
    utterance.lang = lang;
    utterance.rate = rate;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onend = next;
    utterance.onerror = next;
    speaking = true;
    onStart?.();
    synth.speak(utterance);
  };

  return {
    say(text) {
      if (stopped) return;
      const pieces = splitLong(text.trim());
      if (pieces.length === 0) return;
      queue.push(...pieces);
      if (!speaking) next();
    },
    stop() {
      stopped = true;
      queue = [];
      speaking = false;
      synth.cancel();
    },
    get busy() {
      return speaking || queue.length > 0;
    },
  };
}

/** Cuts a long sentence into pieces of at most `max` characters (at a comma or space). */
export function splitLong(text, max = 200) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf('\u060C ', max));
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** Splits streamed text into finished sentences. With flush=true the leftover is returned too. */
export function takeSentences(buffer, flush = false) {
  const sentences = [];
  let rest = buffer;
  for (;;) {
    const match = /[.!?۔؟]+["')\]]*\s+|\n+/.exec(rest); // sentence end followed by a space, or a line break
    if (!match) break;
    const end = match.index + match[0].length;
    const sentence = rest.slice(0, end).trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(end);
  }
  if (flush && rest.trim()) {
    sentences.push(rest.trim());
    rest = '';
  }
  return { sentences, rest };
}

/** Removes Markdown symbols so they are not read aloud ("hash hash star star"). */
export function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/[#*_>~|]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Natural voice from our own server (Gemini text-to-speech, male teacher voice).
 * Same interface as createSpeaker. Sentences are requested in parallel and played in order.
 * If the server cannot make audio (quota, no internet) it silently uses the browser voice instead.
 */
export function createCloudSpeaker({ lang, onStart, onIdle, onCloudFail }) {
  let queue = [];
  let playing = false;
  let stopped = false;
  let audio = null;
  let failed = false;
  let failures = 0;
  let fallback = null;
  const controllers = new Set();

  const fetchAudio = (text) => {
    const ctrl = new AbortController();
    controllers.add(ctrl);
    const timer = setTimeout(() => ctrl.abort(), 12000); // a slow voice is worse than the basic one
    return fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('tts');
        return URL.createObjectURL(await res.blob());
      })
      .finally(() => {
        clearTimeout(timer);
        controllers.delete(ctrl);
      });
  };

  const speakWithBrowser = (text) => {
    if (!hasSynthesis()) {
      playing = false;
      pump();
      return;
    }
    fallback ||= createSpeaker({
      lang,
      onStart,
      onIdle: () => {
        playing = false;
        pump();
      },
    });
    playing = true;
    fallback.say(text);
  };

  async function pump() {
    if (playing || stopped) return;
    const item = queue.shift();
    if (!item) {
      onIdle?.();
      return;
    }
    playing = true;
    let url = null;
    if (!failed && item.promise) {
      try {
        url = await item.promise;
      } catch {
        if (stopped) return;
        failures += 1;
        if (failures >= 2 && !failed) {
          failed = true;
          onCloudFail?.();
        }
      }
    }
    if (stopped) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    if (!url) {
      speakWithBrowser(item.text);
      return;
    }
    const done = () => {
      URL.revokeObjectURL(url);
      audio = null;
      playing = false;
      pump();
    };
    audio = sharedAudio || new Audio();
    audio.src = url;
    audio.onended = done;
    audio.onerror = done;
    audio.onplaying = () => onStart?.();
    audio.play().catch(done);
  }

  return {
    say(text) {
      if (stopped) return;
      for (const piece of splitLong(text.trim(), 180)) {
        queue.push({ text: piece, promise: failed ? null : fetchAudio(piece) });
        // A failed request is handled in pump(); avoid "unhandled rejection" noise for prefetches.
        queue[queue.length - 1].promise?.catch(() => {});
      }
      pump();
    },
    stop() {
      stopped = true;
      queue = [];
      controllers.forEach((c) => c.abort());
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        audio.pause();
        audio = null;
      }
      fallback?.stop();
      playing = false;
    },
    get busy() {
      return playing || queue.length > 0;
    },
  };
}

/**
 * Watches the microphone volume so the student can interrupt the AI just by talking.
 * Echo cancellation is on, so the AI's own voice from the speakers is (mostly) ignored.
 * shouldListen() says when interrupting is allowed; onVoice() is called when real speech is heard.
 */
export async function createVoiceMonitor({ shouldListen, onVoice }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
  });
  const Ctx = win.AudioContext || win.webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume?.();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  let loud = 0;
  let floor = 0.01; // slow average of the normal background / echo level
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    if (!shouldListen()) {
      loud = 0;
      floor = floor * 0.9 + rms * 0.1;
      return;
    }
    if (rms > Math.max(0.05, floor * 4)) loud += 1;
    else {
      loud = 0;
      floor = floor * 0.98 + rms * 0.02;
    }
    if (loud >= 7) { // about 0.35 seconds of real speech
      loud = 0;
      onVoice();
    }
  }, 50);

  return {
    stop() {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close?.();
    },
  };
}
