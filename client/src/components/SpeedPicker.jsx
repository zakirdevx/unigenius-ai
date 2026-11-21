// A small dropdown in the top bar: Fast / Balanced / Deep thinking.
import { useEffect, useRef, useState } from 'react';
import { Brain, Check, ChevronDown, Gauge, Zap } from 'lucide-react';
import { SPEEDS, useSpeed } from '../context/SpeedContext.jsx';

const ICONS = { fast: Zap, balanced: Gauge, deep: Brain };

// direction: which way the menu opens ("up" next to the typing box, "down" in the top bar).
// compact: a small, borderless button that fits inside the typing box.
export default function SpeedPicker({ direction = 'down', compact = false }) {
  const { speed, setSpeed } = useSpeed();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SPEEDS.find((s) => s.value === speed) || SPEEDS[0];
  const CurrentIcon = ICONS[current.value];

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Thinking speed: ${current.label}`}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-mute transition hover:bg-panel2 hover:text-ink'
            : 'inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 text-sm font-medium transition hover:border-brand'
        }
      >
        <CurrentIcon size={15} className="text-brand" />
        <span>{current.label}</span>
        <ChevronDown size={14} className={`text-mute transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Thinking speed"
          className={`fade-up absolute right-0 z-50 w-72 max-w-[85vw] overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-xl ${
            direction === 'up' ? 'bottom-full mb-2' : 'mt-2'
          }`}
        >
          {SPEEDS.map(({ value, label, hint }) => {
            const Icon = ICONS[value];
            const selected = value === speed;
            return (
              <li key={value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setSpeed(value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-panel2 ${
                    selected ? 'bg-panel2' : ''
                  }`}
                >
                  <Icon size={18} className="mt-0.5 shrink-0 text-brand" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-mute">{hint}</span>
                  </span>
                  {selected && <Check size={16} className="mt-0.5 shrink-0 text-good" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
