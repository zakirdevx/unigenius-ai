// Renders the AI's Markdown safely. No raw HTML is allowed (no rehype-raw and no
// dangerouslySetInnerHTML), so a malicious answer cannot inject scripts.
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock.jsx';
import { isUrdu } from '../utils/text.js';

const components = {
  pre: ({ children }) => <>{children}</>,
  code({ className, children }) {
    const text = String(children).replace(/\n$/, '');
    const match = /language-([\w+#-]+)/.exec(className || '');
    if (!match && !text.includes('\n')) return <code className="inline-code">{children}</code>;
    return <CodeBlock language={match?.[1]} code={text} />;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
};

function Markdown({ children }) {
  return (
    <div className={`md ${isUrdu(children) ? 'urdu' : ''}`} dir="auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
