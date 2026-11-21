import { AlertTriangle, RotateCcw, X } from 'lucide-react';

/** A friendly error box with an optional Retry button. */
export default function ErrorBanner({ message, onRetry, onDismiss, className = '' }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm ${className}`}
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" />
      <p className="flex-1 text-ink">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium transition hover:bg-panel2"
        >
          <RotateCcw size={13} /> Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-mute hover:text-ink">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
