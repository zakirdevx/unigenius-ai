// Left sidebar: logo, New Chat, mode navigation, chat history and the theme toggle.
// On phones it slides in as a drawer; on large screens it can be collapsed from the header.
import { useState } from 'react';
import {
  Calculator, Check, Code, FileText, GraduationCap, ListChecks, MessageSquare, Mic, Moon, Pencil, Plus, Presentation, Sparkles, Sun, Trash2, X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export const NAV = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'study', label: 'Study Mode', icon: GraduationCap },
  { id: 'voice', label: 'Voice Tutor', icon: Mic },
  { id: 'quiz', label: 'Quiz Generator', icon: ListChecks },
  { id: 'notes', label: 'Notes Summarizer', icon: FileText },
  { id: 'code', label: 'Code Assistant', icon: Code },
  { id: 'slides', label: 'Presentation Maker', icon: Presentation },
  { id: 'gpa', label: 'GPA Calculator', icon: Calculator },
];

function HistoryItem({ chat, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const Icon = chat.mode === 'study' ? GraduationCap : MessageSquare;

  const save = () => {
    onRename(chat.id, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-panel2 px-2 py-1.5">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          dir="auto"
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="min-w-0 flex-1 rounded bg-surface px-2 py-1 text-sm outline-none"
        />
        <button type="button" onClick={save} aria-label="Save name" className="p-1 text-good"><Check size={15} /></button>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="p-1 text-mute"><X size={15} /></button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-between gap-1 rounded-lg bg-bad/10 px-3 py-2 text-sm">
        <span className="truncate">Delete this chat?</span>
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={() => onDelete(chat.id)} aria-label="Confirm delete" className="p-1 text-bad"><Check size={15} /></button>
          <button type="button" onClick={() => setConfirming(false)} aria-label="Keep chat" className="p-1 text-mute"><X size={15} /></button>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
        active ? 'bg-panel2 text-ink' : 'text-mute hover:bg-panel2 hover:text-ink'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(chat)}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
        aria-current={active ? 'true' : undefined}
      >
        <Icon size={15} className="shrink-0" />
        <span dir="auto" className="truncate">{chat.title}</span>
      </button>
      <span className="flex shrink-0 opacity-100 lg:opacity-0 lg:transition lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => { setDraft(chat.title); setEditing(true); }}
          aria-label={`Rename ${chat.title}`}
          className="rounded p-1.5 hover:text-brand"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${chat.title}`}
          className="rounded p-1.5 hover:text-bad"
        >
          <Trash2 size={14} />
        </button>
      </span>
    </div>
  );
}

export default function Sidebar({
  view, onNavigate, onNewChat, chats, activeId, onSelectChat, onRename, onDelete, open, collapsed, onClose,
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* dark backdrop behind the mobile drawer */}
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 transform flex-col border-r border-line bg-panel transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:hidden' : ''}`}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-white">
              <Sparkles size={18} />
            </span>
            <div className="leading-tight">
              <p className="font-bold tracking-tight">UniGenius <span className="gradient-text">AI</span></p>
              <p className="text-[0.7rem] text-mute">Smart Student Assistant</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-mute hover:bg-panel2 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNewChat}
            className="gradient-brand glow flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Plus size={17} /> New Chat
          </button>
        </div>

        <nav aria-label="Modes" className="mt-4 space-y-0.5 px-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={view === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                view === id ? 'bg-brand/15 text-brand' : 'text-mute hover:bg-panel2 hover:text-ink'
              }`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-mute">History</p>
          <div className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1 pb-2">
            {chats.length === 0 ? (
              <p className="px-3 py-2 text-sm text-mute">Your chats will appear here.</p>
            ) : (
              chats.map((chat) => (
                <HistoryItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeId}
                  onSelect={onSelectChat}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </div>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-mute transition hover:bg-panel2 hover:text-ink"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</span>
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
