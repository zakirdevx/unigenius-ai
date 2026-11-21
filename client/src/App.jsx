// The app shell: sidebar + header + the page for the current mode.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Menu, PanelLeft } from 'lucide-react';
import Sidebar, { NAV } from './components/Sidebar.jsx';
import SpeedPicker from './components/SpeedPicker.jsx';
import { useChats } from './context/ChatContext.jsx';
import ChatPage from './pages/ChatPage.jsx';
import CodePage from './pages/CodePage.jsx';
import NotesPage from './pages/NotesPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import GpaPage from './pages/GpaPage.jsx';
import SlidesPage from './pages/SlidesPage.jsx';
import VoicePage from './pages/VoicePage.jsx';
import { getHealth } from './services/api.js';

/** Warns the student if the server is off or the API key is missing (most common setup problems). */
function useServerStatus() {
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((h) => {
        if (!cancelled) setProblem(h.keyConfigured ? '' : 'The server is running but GEMINI_API_KEY is not set. Add it to server/.env and restart.');
      })
      .catch(() => {
        if (!cancelled) setProblem('Cannot reach the UniGenius server. Start UniGenius again (double-click start-unigenius-hidden.vbs, or run "npm run dev"), then refresh this page.');
      });
    return () => { cancelled = true; };
  }, []);
  return problem;
}

export default function App() {
  const { chats, activeId, activeChat, setActive, renameChat, deleteChat, storageWarning } = useChats();
  const [view, setView] = useState(() => {
    // App shortcuts (long-press the icon on Android) open a tool directly: /?view=voice
    const wanted = new URLSearchParams(window.location.search).get('view');
    return NAV.some((n) => n.id === wanted) ? wanted : 'chat';
  }); // chat | study | voice | quiz | notes | code | slides | gpa
  const [drawerOpen, setDrawerOpen] = useState(false); // phones
  const [collapsed, setCollapsed] = useState(false); // large screens
  const serverProblem = useServerStatus();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeDrawer]);

  // Opening a mode from the sidebar. Chat/Study start a fresh conversation if the open one belongs to the other mode.
  const navigate = (id) => {
    if ((id === 'chat' || id === 'study') && activeChat && activeChat.mode !== id) setActive(null);
    setView(id);
    closeDrawer();
  };

  const newChat = () => {
    setActive(null);
    if (view !== 'chat' && view !== 'study') setView('chat');
    closeDrawer();
  };

  const selectChat = (chat) => {
    setActive(chat.id);
    setView(chat.mode);
    closeDrawer();
  };

  const title = NAV.find((n) => n.id === view)?.label ?? 'UniGenius AI';

  return (
    <div className="flex h-dvh overflow-hidden bg-surface text-ink">
      <Sidebar
        view={view}
        onNavigate={navigate}
        onNewChat={newChat}
        chats={chats}
        activeId={activeId}
        onSelectChat={selectChat}
        onRename={renameChat}
        onDelete={deleteChat}
        open={drawerOpen}
        collapsed={collapsed}
        onClose={closeDrawer}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-panel/60 px-3 py-2.5 backdrop-blur">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-mute hover:bg-panel2 hover:text-ink lg:hidden">
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            className="hidden rounded-lg p-2 text-mute hover:bg-panel2 hover:text-ink lg:inline-flex"
          >
            <PanelLeft size={20} />
          </button>
          <h1 className="text-sm font-semibold">{title}</h1>
          {/* Chat and Study have the picker next to the typing box; other pages keep it here. */}
          {view !== 'chat' && view !== 'study' && (
            <div className="ms-auto">
              <SpeedPicker />
            </div>
          )}
        </header>

        {(serverProblem || storageWarning) && (
          <div role="alert" className="flex items-start gap-2 border-b border-bad/30 bg-bad/10 px-4 py-2 text-sm">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bad" />
            <span>{serverProblem || storageWarning}</span>
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto">
          {view === 'chat' && <ChatPage mode="chat" onFeature={navigate} />}
          {view === 'study' && <ChatPage mode="study" onFeature={navigate} />}
          {view === 'voice' && <VoicePage />}
          {view === 'quiz' && <QuizPage />}
          {view === 'notes' && <NotesPage />}
          {view === 'code' && <CodePage />}
          {view === 'slides' && <SlidesPage />}
          {view === 'gpa' && <GpaPage />}
        </main>
      </div>
    </div>
  );
}
