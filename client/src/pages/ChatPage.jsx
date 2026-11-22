// AI Chat and Study Mode share this page. The only difference is the "mode" we send to
// the server (and the difficulty picker in Study Mode).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import ChatInput from '../components/ChatInput.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import Segmented from '../components/Segmented.jsx';
import Welcome from '../components/Welcome.jsx';
import { useChats } from '../context/ChatContext.jsx';
import { useChatStream } from '../hooks/useChatStream.js';
import { loadString, saveString } from '../utils/storage.js';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function ChatPage({ mode, onFeature }) {
  const { activeChat, clearMessages } = useChats();
  const isStudy = mode === 'study';

  const [difficulty, setDifficulty] = useState(() => {
    const saved = loadString('difficulty', 'Beginner');
    return LEVELS.includes(saved) ? saved : 'Beginner';
  });
  const options = useMemo(() => (isStudy ? { difficulty } : {}), [isStudy, difficulty]);
  const { streaming, send, regenerate, stop } = useChatStream({ mode, options });

  const [prefill, setPrefill] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const messages = activeChat?.messages ?? [];

  // ---- auto-scroll: follow new text, unless the student scrolled up to read ----
  const scrollRef = useRef(null);
  const stick = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    if (stick.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);
  useEffect(() => {
    stick.current = true;
    setConfirmClear(false);
  }, [activeChat?.id]);

  const handleSend = (text) => {
    stick.current = true;
    return send(text);
  };

  const changeDifficulty = (level) => {
    setDifficulty(level);
    saveString('difficulty', level);
  };

  const handleFeature = (id) => {
    if (id === 'ask') setPrefill({ text: '' }); // just focus the message box
    else onFeature(id);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    if (activeChat) clearMessages(activeChat.id);
    setConfirmClear(false);
  };

  const isEmpty = messages.length === 0;
  const lastIndex = messages.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {(isStudy || !isEmpty) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
          {isStudy ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-mute">Level</span>
              <Segmented label="Difficulty" options={LEVELS} value={difficulty} onChange={changeDifficulty} disabled={streaming} />
            </div>
          ) : (
            <p dir="auto" className="min-w-0 truncate text-sm font-medium text-mute">{activeChat?.title}</p>
          )}
          {!isEmpty && (
            <button
              type="button"
              onClick={handleClear}
              disabled={streaming}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                confirmClear ? 'bg-bad/15 text-bad' : 'text-mute hover:bg-panel2 hover:text-ink'
              }`}
            >
              <Eraser size={14} /> {confirmClear ? 'Click again to clear' : 'Clear chat'}
            </button>
          )}
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <Welcome mode={mode} onFeature={handleFeature} onPrompt={handleSend} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6" aria-live="polite">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLast={index === lastIndex}
                streaming={streaming}
                onRegenerate={regenerate}
              />
            ))}
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        onStop={stop}
        streaming={streaming}
        prefill={prefill}
        placeholder={isStudy ? 'Type a topic to learn, e.g. “Binary search trees”…' : 'Ask me anything about your studies…'}
      />
    </div>
  );
}
