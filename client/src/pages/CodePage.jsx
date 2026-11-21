// Code Assistant: explain, generate or debug code in HTML, CSS, JavaScript, Python, C++ or SQL.
import { useRef, useState } from 'react';
import { Bug, Check, Code, Copy, Lightbulb, Sparkles, Square, Wand2 } from 'lucide-react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Markdown from '../components/Markdown.jsx';
import Segmented from '../components/Segmented.jsx';
import TypingIndicator from '../components/TypingIndicator.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { useStreamText } from '../hooks/useStreamText.js';
import { copyText } from '../utils/text.js';

const LANGUAGES = ['HTML', 'CSS', 'JavaScript', 'Python', 'C++', 'SQL'];
const TASKS = [
  { value: 'explain', label: 'Explain', icon: Lightbulb },
  { value: 'generate', label: 'Generate', icon: Wand2 },
  { value: 'debug', label: 'Debug', icon: Bug },
];
const MAX = 8000;

const HINTS = {
  explain: { prompt: 'Optional: what part confuses you?', needsCode: true, needsPrompt: false, button: 'Explain code' },
  generate: { prompt: 'Describe the program you want, e.g. “a function that checks if a number is prime”', needsCode: false, needsPrompt: true, button: 'Generate code' },
  debug: { prompt: 'Optional: paste the error message or describe what goes wrong', needsCode: true, needsPrompt: false, button: 'Find the bug' },
};

export default function CodePage() {
  const [language, setLanguage] = useState('JavaScript');
  const [task, setTask] = useState('explain');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState(false);
  const outputRef = useRef(null);
  const { text, streaming, error, start, stop } = useStreamText();
  const { speed } = useSpeed();
  const hint = HINTS[task];

  const submit = (e) => {
    e.preventDefault();
    if (streaming) return;
    if (hint.needsCode && !code.trim()) return setFormError('Please paste some code first.');
    if (hint.needsPrompt && !prompt.trim()) return setFormError('Please describe what you want the code to do.');
    setFormError('');
    start('/api/code', { language, task, prompt, code, speed });
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleCopy = async () => {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const showOutput = streaming || text || error;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="gradient-brand flex h-11 w-11 items-center justify-center rounded-xl text-white">
          <Code size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Code Assistant</h1>
          <p className="text-sm text-mute">Learn how code works, write it and fix bugs step by step.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-line bg-panel p-6">
        <ErrorBanner message={formError} onDismiss={() => setFormError('')} />

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <label htmlFor="language" className="mb-2 block text-sm font-medium">Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">What do you need?</p>
            <Segmented label="Task" options={TASKS.map(({ value, label }) => ({ value, label }))} value={task} onChange={setTask} disabled={streaming} />
          </div>
        </div>

        <div>
          <label htmlFor="prompt" className="mb-2 block text-sm font-medium">
            {task === 'generate' ? 'What should the code do?' : 'Your question (optional)'}
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={MAX}
            rows={3}
            dir="auto"
            placeholder={hint.prompt}
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-mute focus:border-brand"
          />
        </div>

        {task !== 'generate' && (
          <div>
            <label htmlFor="code" className="mb-2 block text-sm font-medium">Your {language} code</label>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={MAX}
              rows={10}
              dir="ltr"
              spellCheck={false}
              placeholder={`Paste your ${language} code here…`}
              className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm outline-none transition placeholder:text-mute focus:border-brand"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {streaming ? (
            <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel2 px-5 py-3 text-sm font-semibold transition hover:bg-line">
              <Square size={15} fill="currentColor" /> Stop
            </button>
          ) : (
            <button type="submit" className="gradient-brand glow inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110">
              <Sparkles size={17} /> {hint.button}
            </button>
          )}
        </div>
      </form>

      {showOutput && (
        <div ref={outputRef} className="fade-up mt-6 rounded-2xl border border-line bg-panel p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-brand">Answer</h2>
            {text && !streaming && (
              <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mute transition hover:bg-panel2 hover:text-ink">
                {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy answer'}
              </button>
            )}
          </div>
          {streaming && !text && <TypingIndicator />}
          {text && <Markdown>{text}</Markdown>}
          <ErrorBanner className="mt-3" message={error} onRetry={!streaming ? () => start('/api/code', { language, task, prompt, code, speed }) : undefined} />
        </div>
      )}
    </div>
  );
}
