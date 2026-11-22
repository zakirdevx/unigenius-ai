// Draws one slide from the design engine's instructions (utils/slideDesign.js).
// It scales with its container (cqw units), so the same component makes big previews and small thumbnails.
import { useState } from 'react';
import { H, W, imageUrl } from '../utils/slideDesign.js';

const cq = (pt) => `${((pt / 72 / W) * 100).toFixed(3)}cqw`; // font size in points -> % of slide width
const inch = (v) => `${((v / W) * 100).toFixed(3)}cqw`;
const left = (v) => `${((v / W) * 100).toFixed(3)}%`;
const top = (v) => `${((v / H) * 100).toFixed(3)}%`;
const FLEX = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

function Marker({ style, index, color }) {
  if (style === 'none') return null;
  const content = style === 'numbers' ? `${index + 1}.` : style === 'dashes' ? '–' : '●';
  return <span style={{ color, minWidth: inch(0.45), fontSize: style === 'dots' ? '0.7em' : '1em', lineHeight: style === 'dots' ? 1.9 : 1.15 }}>{content}</span>;
}

// A picture. The colour behind it is shown while it loads, and stays if the picture cannot be made.
function Picture({ it, box, show }) {
  const [failed, setFailed] = useState(false);
  const url = show ? imageUrl(it.prompt, it.seed) : '';
  return (
    <div style={{ ...box, background: `#${it.fill}`, overflow: 'hidden' }}>
      {url && !failed && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  );
}

/** `pictures={false}` skips loading images (used for the small thumbnails, so the page stays fast). */
export default function SlideView({ spec, className = '', pictures = true }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ containerType: 'inline-size' }}>
      <div
        dir={spec.rtl ? 'rtl' : 'ltr'}
        style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', background: `#${spec.bg}`,
          fontFamily: `"${spec.font}", Calibri, Arial, sans-serif`,
        }}
      >
        {spec.items.map((it, i) => {
          const box = { position: 'absolute', left: left(it.x), top: top(it.y), width: left(it.w), height: top(it.h) };
          const opacity = it.alpha == null ? 1 : it.alpha;
          if (it.t === 'image') return <Picture key={`${i}-${it.prompt}-${it.seed}`} it={it} box={box} show={pictures} />;
          if (it.t === 'rect') return <div key={i} style={{ ...box, opacity, background: `#${it.fill}`, borderRadius: it.radius ? inch(it.radius * 1.2) : 0 }} />;
          if (it.t === 'ellipse') return <div key={i} style={{ ...box, opacity, background: `#${it.fill}`, borderRadius: '50%' }} />;
          if (it.t === 'text') {
            return (
              <div key={i} style={{ ...box, display: 'flex', flexDirection: 'column', justifyContent: FLEX[it.valign] }}>
                <div style={{ textAlign: it.align, fontSize: cq(it.size), color: `#${it.color}`, fontWeight: it.bold ? 700 : 400, fontStyle: it.italic ? 'italic' : 'normal', lineHeight: 1.15, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {it.text}
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ ...box, display: 'flex', flexDirection: 'column', justifyContent: FLEX[it.valign] }}>
              <ul style={{ fontSize: cq(it.size), color: `#${it.color}`, lineHeight: 1.2, margin: 0, padding: 0, listStyle: 'none' }}>
                {it.items.map((b, k) => (
                  <li key={k} style={{ display: 'flex', marginBottom: cq(it.gapPt), textAlign: it.align }}>
                    <Marker style={it.bullet} index={k} color={`#${it.markerColor}`} />
                    <span style={{ overflowWrap: 'anywhere' }}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
