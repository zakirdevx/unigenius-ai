// The message box: grows as you type, Enter sends, Shift+Enter adds a new line.
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import SpeedPicker from './SpeedPicker.jsx';
import { createRecognizer, getVoiceLang, hasRecognition } from '../utils/speech.js';

const MAX_CHARS = 8000;

export default function ChatInput({ onSend, onStop, streaming, placeholder, prefill }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recRef = useRef(null);
  const baseRef = useRef('');

  // Voice typing: speak and the words appear in the box (Chrome / Edge).
  const toggleMic = () => {
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    setMicError('');
    baseRef.current = value;
    let failure = '';
    const rec = createRecognizer({
      lang: getVoiceLang(),
      onInterim: (text) => setValue((baseRef.current ? `${baseRef.current} ` : '') + text),
      onError: (code) => { failure = code; },
      onEnd: (text) => {
        recRef.current = null;
        setListening(false);
        if (text) setValue((baseRef.current ? `${baseRef.current} ` : '') + text);
        if (failure === 'not-allowed' || failure === 'service-not-allowed') setMicError('Microphone is blocked. Allow it from the lock icon in the address bar.');
        else if (failure === 'network') setMicError('Voice typing needs an internet connection.');
        else if (failure === 'audio-capture') setMicError('No microphone found.');
      },
    });
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  // Let the parent put text into the box (e.g. from a suggestion chip) without sending it.
  useEffect(() => {
    if (prefill) {
      setValue(prefill.text || '');
      ref.current?.focus();
    }
  }, [prefill]);

  // Auto-grow the textarea up to a maximum height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    if (streaming || !value.trim()) return;
    if (onSend(value)) setValue('');
  };

  const onKeyDown = (e) => {
    // isComposing: do not send while an input method (IME) is still choosing characters.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const nearLimit = value.length > MAX_CHARS * 0.9;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-4 sm:px-4">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-panel p-2 shadow-lg transition focus-within:border-brand">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_CHARS}
          dir="auto"
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] text-ink outline-none placeholder:text-mute"
        />
        {hasRecognition() && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? 'Stop voice typing' : 'Type with your voice'}
            title={listening ? 'Stop voice typing' : 'Type with your voice'}
            aria-pressed={listening}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              listening ? 'animate-pulse border-bad bg-bad/10 text-bad' : 'border-line bg-panel2 text-mute hover:text-ink'
            }`}
          >
            <Mic size={17} />
          </button>
        )}
        <div className="flex h-10 shrink-0 items-center">
          <SpeedPicker direction="up" compact />
        </div>
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-panel2 text-ink transition hover:bg-line"
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send message"
            title="Send (Enter)"
            className="gradient-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition enabled:hover:brightness-110 disabled:opacity-40"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
      <p className={`mt-2 text-center text-xs ${nearLimit || micError ? 'text-bad' : 'text-mute'}`}>
        {micError ? micError : nearLimit
          ? `${value.length} / ${MAX_CHARS} characters`
          : 'Enter to send · Shift+Enter for a new line · AI can make mistakes, so double-check important facts.'}
      </p>
    </div>
  );
}
