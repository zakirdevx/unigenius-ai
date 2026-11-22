// One chat message. Student messages are plain text bubbles; AI messages are Markdown.
import { memo, useEffect, useRef, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles, Square, Volume2 } from 'lucide-react';
import ErrorBanner from './ErrorBanner.jsx';
import Markdown from './Markdown.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import { copyText, isUrdu } from '../utils/text.js';
import { cleanForSpeech, createCloudSpeaker, createSpeaker, takeSentences } from '../utils/speech.js';

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-mute transition hover:bg-panel2 hover:text-ink sm:px-2 sm:py-1"
    >
      {children}
    </button>
  );
}

function MessageBubble({ message, isLast, streaming, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const speakerRef = useRef(null);

  // Stop reading aloud if this message disappears (new chat, page change).
  useEffect(() => () => speakerRef.current?.stop(), []);

  const toggleListen = () => {
    if (speakerRef.current && reading) {
      speakerRef.current.stop();
      speakerRef.current = null;
      setReading(false);
      return;
    }
    window.speechSynthesis?.cancel(); // only one message is read at a time
    const lang = isUrdu(message.content) ? 'ur-PK' : 'en-US';
    const events = { lang, onIdle: () => setReading(false) };
    // Short answers use the natural server voice; long ones use the browser voice to save quota.
    const speaker = message.content.length <= 1200 ? createCloudSpeaker(events) : createSpeaker(events);
    speakerRef.current = speaker;
    setReading(true);
    takeSentences(cleanForSpeech(message.content), true).sentences.forEach((x) => speaker.say(x));
  };

  if (message.role === 'user') {
    return (
      <div className="fade-up flex justify-end">
        <div
          dir="auto"
          className={`bubble-user max-w-[85%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-base leading-relaxed sm:max-w-[75%] sm:rounded-2xl sm:rounded-br-md sm:text-[0.95rem] ${
            isUrdu(message.content) ? 'urdu' : ''
          }`}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const isThinking = streaming && isLast && !message.content && !message.error;
  const showActions = !(streaming && isLast) && message.content;

  const handleCopy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="fade-up flex gap-3">
      <div className="gradient-brand mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-white sm:flex">
        <Sparkles size={16} />
      </div>
      <div className="min-w-0 flex-1">
        {isThinking && <TypingIndicator />}
        {message.content && <Markdown>{message.content}</Markdown>}
        {message.error && (
          <ErrorBanner
            className="mt-3"
            message={message.error}
            onRetry={isLast && !streaming ? onRegenerate : undefined}
          />
        )}
        {showActions && (
          <div className="mt-2 flex items-center gap-1">
            <IconButton label="Copy response" onClick={handleCopy}>
              {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />}
              <span className="max-sm:sr-only">{copied ? 'Copied' : 'Copy'}</span>
            </IconButton>
            <IconButton label={reading ? 'Stop reading' : 'Read aloud'} onClick={toggleListen}>
              {reading ? <Square size={13} fill="currentColor" /> : <Volume2 size={14} />}
              <span className="max-sm:sr-only">{reading ? 'Stop' : 'Listen'}</span>
            </IconButton>
            {isLast && (
              <IconButton label="Regenerate response" onClick={onRegenerate}>
                <RefreshCw size={14} /> <span className="max-sm:sr-only">Regenerate</span>
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
