// A row of buttons where exactly one is selected (difficulty, question count, task...).
export default function Segmented({ options, value, onChange, label, disabled = false }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-panel2 p-1">
      {options.map((opt) => {
        const item = typeof opt === 'object' ? opt : { value: opt, label: String(opt) };
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              selected ? 'gradient-brand text-white shadow' : 'text-mute hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
