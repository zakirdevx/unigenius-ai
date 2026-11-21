// A code block with a language label, syntax colours and a Copy button.
// PrismLight loads only the languages registered below, which keeps the page small.
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { useTheme } from '../context/ThemeContext.jsx';
import { copyText } from '../utils/text.js';

const LANGUAGES = { bash, c, cpp, css, java, javascript, json, jsx, markup, python, sql, typescript };
Object.entries(LANGUAGES).forEach(([name, grammar]) => SyntaxHighlighter.registerLanguage(name, grammar));

// Names the AI may use  ->  the name we registered.
const ALIASES = {
  js: 'javascript', node: 'javascript', ts: 'typescript', py: 'python', python3: 'python',
  'c++': 'cpp', cc: 'cpp', html: 'markup', xml: 'markup', svg: 'markup',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', mysql: 'sql', postgresql: 'sql', sqlite: 'sql',
};

function resolveLanguage(name = '') {
  const lower = name.toLowerCase();
  const resolved = ALIASES[lower] || lower;
  return LANGUAGES[resolved] ? resolved : 'text';
}

export default function CodeBlock({ language, code }) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const resolved = resolveLanguage(language);

  const handleCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div dir="ltr" className="my-4 overflow-hidden rounded-xl border border-line bg-panel2 text-left">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-mute">
        <span className="font-mono uppercase tracking-wide">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-line hover:text-ink"
          aria-label="Copy code"
        >
          {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={resolved}
        style={theme === 'dark' ? oneDark : oneLight}
        PreTag="div"
        customStyle={{ margin: 0, background: 'transparent', fontSize: '0.85rem', padding: '0.9rem 1rem' }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
