// Voice Tutor: the student assigns a role ("you are my physics teacher, quiz me on PN junction"),
// then talks with the AI. The AI speaks first, listens to the answer, replies aloud, and so on.
// Speech uses the browser's own features (see utils/speech.js), so nothing extra is installed.
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUp, Keyboard, MessageSquare, Mic, MicOff, PhoneOff, RotateCcw, Sparkles, X } from 'lucide-react';
import Segmented from '../components/Segmented.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { errorMessage, streamPost } from '../services/api.js';
import { loadString, saveString } from '../utils/storage.js';
import {
  askMicPermission, cleanForSpeech, createCloudSpeaker, createRecognizer, createSpeaker, createVoiceMonitor, getVoiceLang, hasRecognition, hasSynthesis,
  isMobileDevice, setVoiceLang, takeSentences, unlockAudio,
} from '../utils/speech.js';

const PRESETS = [
  {
    label: 'Physics teacher: PN junction',
    role: 'You are my physics teacher. Quiz me orally about the PN junction: depletion region, forward and reverse bias, diode behaviour. Start with easy questions and make them harder if I answer well.',
  },
  {
    label: 'Math tutor: derivatives',
    role: 'You are my patient math tutor. Ask me spoken questions about derivatives and guide me step by step when I get stuck.',
  },
  {
    label: 'Viva examiner: Generative AI',
    role: 'You are a strict but fair university viva examiner. Ask me questions about Generative AI (LLMs, prompts, transformers, hallucinations). Grade each answer out of 10.',
  },
  {
    label: 'Python interviewer',
    role: 'You are a software engineer interviewing me for a junior Python developer job. Ask one interview question at a time and give short feedback after each answer.',
  },
  {
    label: 'English speaking partner',
    role: 'You are a friendly English speaking partner. Chat with me about everyday topics and gently correct my grammar mistakes.',
  },
];

const LANGS = [
  { value: 'en-US', label: 'English' },
  { value: 'ur-PK', label: 'اردو (Urdu)' },
];

const startPrompt = (lang) =>
  'Start the session now. Briefly introduce yourself in your role, then ask your first question.' +
  (lang === 'ur-PK' ? ' Speak in Urdu (Urdu script).' : '');

const STATUS = {
  idle: 'Tap the mic to talk',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking',
};

function Toggle({ checked, onChange, title, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-panel px-4 py-3 text-left transition hover:border-brand"
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-mute">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Orb({ phase, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={STATUS[phase] || 'Voice'} data-phase={phase} className="vorb block outline-none">
      <span className="vorb-glow" />
      <span className="vorb-ring" />
      <span className="vorb-ring vorb-ring-2" />
      <span className="vorb-core" />
    </button>
  );
}

export default function VoicePage() {
  const { speed } = useSpeed();
  const [stage, setStage] = useState('setup'); // setup | live
  const [role, setRole] = useState(PRESETS[0].role);
  const [lang, setLang] = useState(getVoiceLang);
  const [phase, setPhase] = useState('idle'); // idle | listening | thinking | speaking
  const [lines, setLines] = useState([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [typed, setTyped] = useState('');
  const [natural, setNatural] = useState(() => loadString('voiceNatural', '1') === '1'); // server voice
  const mobile = isMobileDevice(); // phones share one microphone, so speaking-to-interrupt is only for computers
  const [barge, setBarge] = useState(() => !mobile && loadString('voiceBarge2', '1') === '1'); // interrupt by speaking
  const [muted, setMuted] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showType, setShowType] = useState(false);
  const [notice, setNotice] = useState('');
  const endRef = useRef(null);

  // All "live" values sit in one ref so timers and speech callbacks never see stale state.
  const s = useRef({
    active: false, mode: 'idle', rec: null, speaker: null, abort: null, history: [],
    turn: 0, empty: 0, paused: false, heard: false, full: '', buffer: '', streamDone: false, committed: true,
    role: '', lang: 'en-US', speed: 'fast', natural: true, monitor: null,
  });
  useEffect(() => { s.current.speed = speed; }, [speed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines, interim, phase]);

  const setMode = (m) => { s.current.mode = m; setPhase(m); };

  // ---- helpers (they only use the ref and state setters, so re-creating them each render is safe) ----
  function killRecognizer() {
    const r = s.current.rec;
    s.current.rec = null;
    try { r?.abort(); } catch { /* already stopped */ }
  }

  function commitAnswer() {
    const st = s.current;
    if (!st.committed && st.full.trim()) st.history.push({ role: 'assistant', content: st.full.trim() });
    st.committed = true;
  }

  function stopEverything() {
    const st = s.current;
    killRecognizer();
    st.speaker?.stop();
    st.abort?.abort();
    st.turn += 1; // makes every late callback of the old turn do nothing
    commitAnswer();
    setInterim('');
  }

  function stopMonitor() {
    s.current.monitor?.stop();
    s.current.monitor = null;
  }

  function fail(message, retry = false) {
    setError(message);
    setCanRetry(retry);
    setMode('idle');
  }

  function listen() {
    const st = s.current;
    if (!st.active || st.paused) return;
    if (!hasRecognition()) { setMode('idle'); return; }
    killRecognizer();
    st.heard = false;
    let failure = '';
    const rec = createRecognizer({
      lang: st.lang,
      onInterim: (text) => {
        if (st.rec !== rec) return;
        st.heard = Boolean(text);
        setInterim(text);
      },
      onError: (code) => { failure = code; },
      onEnd: (text) => {
        if (st.rec !== rec) return; // we stopped it on purpose
        st.rec = null;
        setInterim('');
        if (!st.active) return;
        if (text) { st.empty = 0; handleUser(text); return; }
        if (failure === 'not-allowed' || failure === 'service-not-allowed') {
          fail('The microphone is blocked. Click the lock icon in the address bar, allow the microphone, then tap the orb again.');
          return;
        }
        if (failure === 'audio-capture') { fail('No microphone was found. Plug one in, or type your answer below.'); return; }
        if (failure === 'network') { fail('Speech recognition needs internet (Chrome sends your voice to Google). Check your connection, or type your answer below.'); return; }
        st.empty += 1;
        if (st.empty >= 6) { st.empty = 0; st.paused = true; setMuted(true); setMode('idle'); return; } // nobody is talking: pause
        const turn = st.turn;
        setTimeout(() => { if (st.active && st.turn === turn && st.mode === 'listening' && !st.rec) listen(); }, 150);
      },
    });
    st.rec = rec;
    try {
      rec.start();
      setError('');
      setCanRetry(false);
      setMode('listening');
    } catch {
      st.rec = null;
      setMode('idle');
    }
  }

  function finishTurn(turn) {
    const st = s.current;
    if (!st.active || st.turn !== turn) return;
    setMode('idle');
    setTimeout(() => {
      if (st.active && st.turn === turn && st.mode === 'idle' && !st.rec) listen();
    }, 350);
  }

  async function ask() {
    const st = s.current;
    const turn = ++st.turn;
    const id = `a${turn}`;
    Object.assign(st, { full: '', buffer: '', streamDone: false, committed: false });

    const speakerEvents = {
      lang: st.lang,
      onStart: () => { if (st.turn === turn) setMode('speaking'); },
      onIdle: () => { if (st.turn === turn && st.streamDone) finishTurn(turn); },
    };
    let speaker = null;
    if (st.natural) {
      speaker = createCloudSpeaker({
        ...speakerEvents,
        onCloudFail: () => setNotice('The natural voice is not available right now, so the basic browser voice is used.'),
      });
    } else if (hasSynthesis()) {
      speaker = createSpeaker(speakerEvents);
    }
    st.speaker = speaker;
    const speak = (text) => {
      const clean = cleanForSpeech(text);
      if (clean && speaker) speaker.say(clean);
    };

    const ctrl = new AbortController();
    st.abort = ctrl;
    setError('');
    setCanRetry(false);
    setMode('thinking');
    setLines((l) => [...l, { id, role: 'assistant', content: '' }]);

    try {
      await streamPost(
        '/api/chat',
        {
          messages: st.history.slice(-20),
          mode: 'chat',
          speed: st.speed,
          options: { persona: st.role, voice: true },
        },
        {
          signal: ctrl.signal,
          onText: (piece) => {
            if (st.turn !== turn) return;
            st.full += piece;
            st.buffer += piece;
            setLines((l) => l.map((x) => (x.id === id ? { ...x, content: st.full } : x)));
            const { sentences, rest } = takeSentences(st.buffer);
            st.buffer = rest;
            sentences.forEach(speak);
          },
        },
      );
      if (st.turn !== turn) return;
      speak(st.buffer);
      st.buffer = '';
      commitAnswer();
      st.streamDone = true;
      if (!speaker || !speaker.busy) finishTurn(turn);
    } catch (err) {
      if (err?.name === 'AbortError' || st.turn !== turn) return;
      speaker?.stop();
      setLines((l) => l.filter((x) => !(x.id === id && !x.content)));
      fail(errorMessage(err), true);
    }
  }

  function handleUser(text) {
    const clean = text.trim();
    if (!clean) return;
    s.current.history.push({ role: 'user', content: clean });
    setLines((l) => [...l, { id: `u${Date.now()}`, role: 'user', content: clean }]);
    ask();
  }

  // ---- user actions ----
  const toggleMute = () => {
    const st = s.current;
    if (st.paused) {
      st.paused = false;
      setMuted(false);
      if (st.mode === 'idle') listen();
      return;
    }
    st.paused = true;
    setMuted(true);
    if (st.mode === 'listening') { killRecognizer(); setInterim(''); setMode('idle'); }
  };

  const onOrb = () => {
    const st = s.current;
    if (st.paused) { st.paused = false; setMuted(false); }
    if (st.mode === 'listening') {
      if (st.heard && st.rec) st.rec.stop(); // send what was said now
      else { killRecognizer(); setInterim(''); setMode('idle'); } // pause listening
      return;
    }
    if (st.mode === 'thinking' || st.mode === 'speaking') stopEverything(); // interrupt
    listen();
  };

  const retry = () => {
    setError('');
    setCanRetry(false);
    ask();
  };

  const sendTyped = (e) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    stopEverything();
    handleUser(text);
  };

  const start = async () => {
    const st = s.current;
    if (!role.trim()) return;
    unlockAudio(); // must happen inside the tap, before any waiting, or phones block the AI's voice
    const useBarge = barge && !mobile;
    setVoiceLang(lang);
    saveString('voiceNatural', natural ? '1' : '0');
    saveString('voiceBarge2', barge ? '1' : '0');
    setNotice('');
    setMuted(false);
    setShowText(false);
    setShowType(false);
    setLines([]);
    setError('');
    Object.assign(st, {
      active: true, paused: false, role: role.trim(), lang, natural, history: [{ role: 'user', content: startPrompt(lang) }], empty: 0,
    });
    setStage('live');
    if (hasRecognition() && !(await askMicPermission())) {
      setError('The microphone is blocked. Tap the lock icon in the address bar, allow the microphone, then tap the mic button. You can type your answers meanwhile.');
      st.paused = true;
      setMuted(true);
    }
    if (!st.active) return;
    if (useBarge) {
      // Speak-to-interrupt: while the AI talks, real speech from you stops it and starts listening.
      createVoiceMonitor({
        shouldListen: () => st.active && st.mode === 'speaking',
        onVoice: () => { stopEverything(); listen(); },
      })
        .then((m) => { if (st.active) st.monitor = m; else m.stop(); })
        .catch(() => setNotice('Speak-to-interrupt needs microphone permission. You can still tap the circle to interrupt.'));
    }
    ask(); // the AI speaks first
  };

  const end = () => {
    s.current.active = false;
    s.current.paused = false;
    stopEverything();
    stopMonitor();
    setMode('idle');
    setStage('setup');
  };

  // Stop the microphone and the voice when the student leaves this page.
  useEffect(() => () => {
    const st = s.current;
    st.active = false;
    st.monitor?.stop();
    try { st.rec?.abort(); } catch { /* ignore */ }
    st.speaker?.stop();
    st.abort?.abort();
  }, []);

  // ---------------- setup screen ----------------
  if (stage === 'setup') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-8">
        <div className="text-center">
          <div className="gradient-brand glow fade-up mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white">
            <Mic size={30} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Voice <span className="gradient-text">Tutor</span>
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-mute">
            Give the AI a role, then just talk. It asks you questions out loud, listens to your answers and replies, like a real teacher.
          </p>
        </div>

        {!hasRecognition() && (
          <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" />
            <span>Your browser cannot hear your voice. Open this page in Google Chrome or Microsoft Edge. You can still type your answers.</span>
          </div>
        )}

        <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-mute">Pick a role</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setRole(p.role)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                role === p.role ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel text-mute hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label htmlFor="role" className="mb-2 mt-5 block text-xs font-semibold uppercase tracking-wider text-mute">
          Or write your own role
        </label>
        <textarea
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value.slice(0, 600))}
          rows={4}
          dir="auto"
          placeholder="Example: You are my chemistry teacher. Ask me questions about the periodic table."
          className="w-full resize-none rounded-xl border border-line bg-panel p-3 text-[0.95rem] outline-none transition placeholder:text-mute focus:border-brand"
        />
        <p className="mt-1 text-right text-xs text-mute">{role.length} / 600</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-mute">Speak in</span>
          <Segmented label="Language" options={LANGS} value={lang} onChange={setLang} />
        </div>

        <div className="mt-5 space-y-2">
          <Toggle
            checked={natural}
            onChange={setNatural}
            title="Natural male teacher voice"
            hint="Clear, slow and easy to understand. Much better Urdu. Falls back to the browser voice if unavailable."
          />
          {mobile ? (
            <p className="rounded-xl border border-line bg-panel px-4 py-3 text-xs text-mute">
              On a phone, tap the glowing circle to interrupt the AI. (Phones can only use the microphone for one thing at a time.)
            </p>
          ) : (
            <Toggle
              checked={barge}
              onChange={setBarge}
              title="Interrupt by speaking"
              hint="Just start talking while the AI speaks, like a real conversation. Headphones work best."
            />
          )}
        </div>

        <button
          type="button"
          onClick={start}
          disabled={!role.trim()}
          className="gradient-brand glow mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          <Mic size={18} /> Start talking
        </button>
        <p className="mt-3 text-center text-xs text-mute">
          Chrome or Edge, internet and microphone permission needed. Allow the microphone when the browser asks.
        </p>
      </div>
    );
  }

  // ---------------- live conversation (full screen, like a call) ----------------
  const lastAi = [...lines].reverse().find((l) => l.role === 'assistant')?.content || '';
  const shownPhase = muted && phase === 'idle' ? 'muted' : phase;
  const label = muted && phase === 'idle' ? 'Mic is off. Tap the mic to talk' : phase === 'speaking' && barge && !mobile ? 'Speaking… just talk to interrupt' : phase === 'speaking' && mobile ? 'Speaking… tap the circle to interrupt' : STATUS[phase];
  const caption = phase === 'listening' ? interim : lastAi.length > 260 ? `…${lastAi.slice(-260)}` : lastAi;

  return (
    <div className="vscreen fixed inset-0 z-[60] flex flex-col text-white" role="dialog" aria-label="Voice conversation">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <p dir="auto" className="min-w-0 truncate text-sm text-white/60" title={role}>{role}</p>
        <button type="button" onClick={() => setShowText((v) => !v)} aria-pressed={showText} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/20">
          <MessageSquare size={14} /> {showText ? 'Hide text' : 'Show text'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <Orb phase={shownPhase} onClick={onOrb} />
        <p className="text-base font-medium text-white/90" aria-live="polite">{label}</p>
        <p dir="auto" className={`line-clamp-4 min-h-[4.5rem] max-w-xl text-lg leading-relaxed ${phase === 'listening' ? 'text-white' : 'text-white/55'}`}>{caption}</p>
      </div>

      <div className="px-4 pb-6">
        {notice && !error && <p className="mb-3 text-center text-xs text-white/60">{notice}</p>}
        {error && (
          <div role="alert" className="mx-auto mb-4 flex max-w-lg items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-left text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" />
            <span className="flex-1">{error}</span>
            {canRetry && (
              <button type="button" onClick={retry} className="inline-flex items-center gap-1 text-violet-200 hover:underline">
                <RotateCcw size={14} /> Retry
              </button>
            )}
          </div>
        )}

        {showType && (
          <form onSubmit={sendTyped} className="mx-auto mb-4 flex max-w-lg items-center gap-2 rounded-full bg-white/10 p-1.5 pl-4">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              dir="auto"
              maxLength={2000}
              autoFocus
              placeholder="Type instead of talking…"
              aria-label="Type your answer"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
            <button type="submit" disabled={!typed.trim()} aria-label="Send typed answer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0b0a1f] disabled:opacity-40">
              <ArrowUp size={16} />
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-5">
          <button type="button" onClick={toggleMute} data-on={!muted} aria-label={muted ? 'Turn microphone on' : 'Turn microphone off'} className="vbtn">
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button type="button" onClick={() => setShowType((v) => !v)} data-on={showType} aria-label="Type instead" className="vbtn">
            <Keyboard size={22} />
          </button>
          <button type="button" onClick={end} aria-label="End conversation" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400 active:scale-95">
            <PhoneOff size={22} />
          </button>
        </div>
      </div>

      {showText && (
        <div className="absolute inset-x-0 bottom-0 top-14 z-10 flex flex-col rounded-t-3xl bg-[#0d0c26]/97 backdrop-blur">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-sm font-semibold">Conversation</p>
            <button type="button" onClick={() => setShowText(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"><X size={16} /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-8" aria-live="polite">
            {lines.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div dir="auto" className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-violet-600 px-4 py-2.5 text-[0.95rem]">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500"><Sparkles size={16} /></div>
                  <p dir="auto" className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-white/90">{m.content || '…'}</p>
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </div>
  );
}
