// Stores every chat (Chat + Study mode) and saves them in localStorage.
//
// A "ref" always holds the newest data, so functions can read and change it
// immediately (for example right after a new chat is created). State is used
// only to make React re-draw the screen.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loadJson, saveJson } from '../utils/storage.js';
import { makeTitle, newId } from '../utils/text.js';

const ChatContext = createContext(null);

/** Cleans old / broken data from localStorage so the app never crashes on startup. */
function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
    .map((c) => ({
      id: c.id,
      title: typeof c.title === 'string' && c.title ? c.title : 'New chat',
      mode: c.mode === 'study' ? 'study' : 'chat',
      createdAt: Number(c.createdAt) || Date.now(),
      updatedAt: Number(c.updatedAt) || Date.now(),
      messages: c.messages
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            // an assistant message with no text is a leftover from an interrupted answer
            (m.role === 'user' || m.content.length > 0 || m.error),
        )
        .map((m) => ({ id: m.id || newId(), role: m.role, content: m.content, error: m.error || undefined })),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function ChatProvider({ children }) {
  const initial = useMemo(() => sanitize(loadJson('chats', [])), []);
  const chatsRef = useRef(initial);
  const activeRef = useRef(null);
  const [chats, setChats] = useState(initial);
  const [activeId, setActiveIdState] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');

  /** Change the chat list. `fn` receives the newest list and returns the new one. */
  const commit = useCallback((fn) => {
    const next = fn(chatsRef.current);
    chatsRef.current = next;
    setChats(next);
  }, []);

  const setActive = useCallback((id) => {
    activeRef.current = id;
    setActiveIdState(id);
  }, []);

  // ---- saving to localStorage (waits 500 ms so streaming does not save on every word) ----
  const saveTimer = useRef(null);
  const persist = useCallback(() => {
    const result = saveJson('chats', chatsRef.current);
    setStorageWarning(
      result.ok
        ? ''
        : result.full
          ? 'Browser storage is full, so new messages may not be saved. Delete old chats to free space.'
          : 'Chats cannot be saved in this browser (private mode?). They will be lost when you close the page.',
    );
  }, []);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 500);
    return () => clearTimeout(saveTimer.current);
  }, [chats, persist]);

  useEffect(() => {
    // Save immediately when the tab is closed or hidden.
    const flush = () => persist();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [persist]);

  // ---- actions ----
  const getChat = useCallback((id) => chatsRef.current.find((c) => c.id === id) || null, []);
  const getActiveId = useCallback(() => activeRef.current, []);

  const createChat = useCallback(
    (mode, firstText) => {
      const now = Date.now();
      const chat = { id: newId(), title: makeTitle(firstText), mode, createdAt: now, updatedAt: now, messages: [] };
      commit((list) => [chat, ...list]);
      setActive(chat.id);
      return chat.id;
    },
    [commit, setActive],
  );

  const patchChat = useCallback(
    (id, fn) => commit((list) => list.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c))),
    [commit],
  );

  const addMessage = useCallback(
    (id, message) => patchChat(id, (c) => ({ ...c, messages: [...c.messages, message] })),
    [patchChat],
  );

  const appendToMessage = useCallback(
    (id, messageId, text) =>
      patchChat(id, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, content: m.content + text } : m)),
      })),
    [patchChat],
  );

  const patchMessage = useCallback(
    (id, messageId, patch) =>
      patchChat(id, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      })),
    [patchChat],
  );

  const removeMessage = useCallback(
    (id, messageId) => patchChat(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) })),
    [patchChat],
  );

  /** Keeps messages up to and including `messageId` (used by Regenerate / Retry). */
  const truncateAfter = useCallback(
    (id, messageId) =>
      patchChat(id, (c) => {
        const index = c.messages.findIndex((m) => m.id === messageId);
        return index < 0 ? c : { ...c, messages: c.messages.slice(0, index + 1) };
      }),
    [patchChat],
  );

  const clearMessages = useCallback((id) => patchChat(id, (c) => ({ ...c, messages: [] })), [patchChat]);

  const renameChat = useCallback(
    (id, title) => {
      const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (clean) patchChat(id, (c) => ({ ...c, title: clean }));
    },
    [patchChat],
  );

  const deleteChat = useCallback(
    (id) => {
      commit((list) => list.filter((c) => c.id !== id));
      if (activeRef.current === id) setActive(null);
    },
    [commit, setActive],
  );

  const value = useMemo(
    () => ({
      chats,
      activeId,
      activeChat: chats.find((c) => c.id === activeId) || null,
      storageWarning,
      setActive,
      getChat,
      getActiveId,
      createChat,
      addMessage,
      appendToMessage,
      patchMessage,
      removeMessage,
      truncateAfter,
      clearMessages,
      renameChat,
      deleteChat,
    }),
    [
      chats,
      activeId,
      storageWarning,
      setActive,
      getChat,
      getActiveId,
      createChat,
      addMessage,
      appendToMessage,
      patchMessage,
      removeMessage,
      truncateAfter,
      clearMessages,
      renameChat,
      deleteChat,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChats must be used inside <ChatProvider>');
  return ctx;
}
