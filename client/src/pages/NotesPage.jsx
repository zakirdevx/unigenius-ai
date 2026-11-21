// Notes Summarizer: upload a real .pdf / .txt file (parsed on the server) or paste text.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileText, Sparkles, Upload, X } from 'lucide-react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Markdown from '../components/Markdown.jsx';
import Segmented from '../components/Segmented.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { errorMessage, postForm, postJson } from '../services/api.js';
import { copyText, downloadText, formatBytes } from '../utils/text.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PASTE = 100000;

function checkFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.txt')) return 'Only .pdf and .txt files are supported.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_BYTES) return `That file is ${formatBytes(file.size)}. The maximum size is 5 MB.`;
  return '';
}

function toMarkdown(result, source) {
  return [
    `# Study notes: ${source}`,
    '## Short summary',
    result.summary,
    '## Detailed notes',
    result.detailedNotes,
    '## Key takeaways',
    result.keyTakeaways.map((t) => `- ${t}`).join('\n'),
    '## Revision questions',
    result.revisionQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
  ].join('\n\n');
}

function Section({ title, children }) {
  return (
    <section className="fade-up rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">{title}</h2>
      {children}
    </section>
  );
}

export default function NotesPage() {
  const { speed } = useSpeed();
  const [source, setSource] = useState('file'); // file | text
  const [file, setFile] = useState(null);
  const [fileChars, setFileChars] = useState(null);
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pickFile = async (picked) => {
    if (!picked) return;
    const problem = checkFile(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setFile(picked);
    setFileChars(null);
    // For .txt we can count characters right away. For PDFs the server counts them.
    if (picked.name.toLowerCase().endsWith('.txt')) {
      try {
        setFileChars((await picked.text()).length);
      } catch {
        /* the count is optional */
      }
    }
  };

  const summarize = async () => {
    setError('');
    if (source === 'file' && !file) return setError('Please choose a .pdf or .txt file first.');
    if (source === 'text' && text.trim().length < 20) return setError('Please paste at least a few sentences of notes.');

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let data;
      if (source === 'file') {
        const form = new FormData();
        form.append('speed', speed); // text fields must come before the file
        form.append('file', file);
        data = await postForm('/api/notes', form, { signal: controller.signal });
      } else {
        data = await postJson('/api/notes', { text, speed },{ signal: controller.signal });
      }
      setResult(data);
    } catch (err) {
      if (err?.name !== 'AbortError') setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    setFileChars(null);
    setText('');
    setError('');
  };

  // ---------------------------------------------------------------- results
  if (result) {
    const label = result.meta?.source || 'notes';
    const markdown = toMarkdown(result, label);
    const handleCopy = async () => {
      if (await copyText(markdown)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    };
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Your study notes</h1>
            <p dir="auto" className="truncate text-sm text-mute">
              {label} · {result.meta?.characters?.toLocaleString()} characters
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium transition hover:bg-panel2">
              {copied ? <Check size={15} className="text-good" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy all'}
            </button>
            <button type="button" onClick={() => downloadText('unigenius-notes.md', markdown)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium transition hover:bg-panel2">
              <Download size={15} /> Download .md
            </button>
            <button type="button" onClick={reset} className="gradient-brand inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110">
              <Sparkles size={15} /> New summary
            </button>
          </div>
        </div>

        {result.meta?.truncated && (
          <ErrorBanner message={`Your notes were very long, so only the first ${result.meta.usedCharacters.toLocaleString()} characters were summarised.`} />
        )}

        <Section title="Short summary"><Markdown>{result.summary}</Markdown></Section>
        <Section title="Detailed notes"><Markdown>{result.detailedNotes}</Markdown></Section>
        <Section title="Key takeaways">
          <ul className="space-y-2">
            {result.keyTakeaways.map((item, i) => (
              <li key={i} dir="auto" className="flex gap-2.5 text-[0.95rem]">
                <Check size={17} className="mt-1 shrink-0 text-good" /> <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Revision questions">
          <ol className="list-decimal space-y-2 ps-5 text-[0.95rem] marker:text-brand">
            {result.revisionQuestions.map((item, i) => (
              <li key={i} dir="auto">{item}</li>
            ))}
          </ol>
        </Section>
      </div>
    );
  }

  // ------------------------------------------------------------------ input
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="gradient-brand flex h-11 w-11 items-center justify-center rounded-xl text-white">
          <FileText size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes Summarizer</h1>
          <p className="text-sm text-mute">Upload a PDF or text file, or paste your notes.</p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-line bg-panel p-6">
        <Segmented
          label="Notes source"
          options={[{ value: 'file', label: 'Upload file' }, { value: 'text', label: 'Paste text' }]}
          value={source}
          onChange={(v) => { setSource(v); setError(''); }}
          disabled={loading}
        />

        <ErrorBanner message={error} onDismiss={() => setError('')} />

        {source === 'file' ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="sr-only"
              aria-label="Choose a PDF or text file"
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
                <FileText className="shrink-0 text-brand" size={24} />
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate font-medium">{file.name}</p>
                  <p className="text-sm text-mute">
                    {formatBytes(file.size)}
                    {fileChars !== null && ` · ${fileChars.toLocaleString()} characters`}
                  </p>
                </div>
                <button type="button" onClick={() => { setFile(null); setFileChars(null); }} disabled={loading} aria-label="Remove file" className="rounded-lg p-2 text-mute hover:bg-panel2 hover:text-ink">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                  dragging ? 'border-brand bg-brand/10' : 'border-line hover:border-brand hover:bg-panel2'
                }`}
              >
                <Upload size={28} className="text-brand" />
                <span className="font-medium">Click to choose a file, or drag it here</span>
                <span className="text-sm text-mute">PDF or TXT · up to 5 MB · text-based PDFs only (not scans)</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="notes-text" className="sr-only">Paste your notes</label>
            <textarea
              id="notes-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_PASTE}
              dir="auto"
              rows={10}
              placeholder="Paste your lecture notes, textbook paragraphs or any study material here…"
              className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-mute focus:border-brand"
            />
            <p className="mt-1 text-right text-xs text-mute">{text.length.toLocaleString()} / {MAX_PASTE.toLocaleString()} characters</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3" role="status" aria-label="Summarizing">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <p className="text-sm text-mute">Reading and summarising your notes… this can take 10–20 seconds.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={summarize}
            className="gradient-brand glow inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Sparkles size={17} /> Summarize notes
          </button>
        )}
      </div>
    </div>
  );
}
