export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2" role="status" aria-label="UniGenius AI is typing">
      <span className="dot h-2 w-2 rounded-full bg-brand" />
      <span className="dot h-2 w-2 rounded-full bg-brand" />
      <span className="dot h-2 w-2 rounded-full bg-brand" />
    </div>
  );
}
