// Sends a message to /api/chat and writes the streamed answer into the chat store.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useChats } from '../context/ChatContext.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { errorMessage, streamPost } from '../services/api.js';
import { newId } from '../utils/text.js';

export function useChatStream({ mode, options }) {
  const store = useChats();
  const { speed } = useSpeed();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  // If the user leaves this page while an answer is streaming, stop the request.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Streams one assistant answer for `history` (its last message must be the user's). */
  const run = useCallback(
    async (chatId, history) => {
      const assistantId = newId();
      store.addMessage(chatId, { id: assistantId, role: 'assistant', content: '' });

      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      // Collect small pieces and write them every 40 ms (smoother and faster than per-word).
      let pending = '';
      let timer = null;
      const flush = () => {
        clearTimeout(timer);
        timer = null;
        if (!pending) return;
        const piece = pending;
        pending = '';
        store.appendToMessage(chatId, assistantId, piece);
      };

      try {
        await streamPost(
          '/api/chat',
          {
            messages: history.map(({ role, content }) => ({ role, content })),
            mode,
            options,
            speed,
          },
          {
            signal: controller.signal,
            onText: (piece) => {
              pending += piece;
              if (!timer) timer = setTimeout(flush, 40);
            },
          },
        );
        flush();
      } catch (err) {
        flush();
        if (err?.name === 'AbortError') {
          // The student pressed Stop: keep what was written; drop the bubble if it is still empty.
          const message = store.getChat(chatId)?.messages.find((m) => m.id === assistantId);
          if (message && !message.content) store.removeMessage(chatId, assistantId);
        } else {
          store.patchMessage(chatId, assistantId, { error: errorMessage(err) });
        }
      } finally {
        clearTimeout(timer);
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [store, mode, options, speed],
  );

  const send = useCallback(
    (text) => {
      const clean = text.trim();
      if (!clean || streaming) return false;

      let chatId = store.getActiveId();
      if (!chatId || !store.getChat(chatId)) chatId = store.createChat(mode, clean);

      store.addMessage(chatId, { id: newId(), role: 'user', content: clean });
      run(chatId, store.getChat(chatId).messages);
      return true;
    },
    [store, mode, run, streaming],
  );

  /** Regenerate the last answer, or retry after an error. */
  const regenerate = useCallback(() => {
    if (streaming) return;
    const chat = store.getChat(store.getActiveId());
    if (!chat) return;

    let lastUser = -1;
    chat.messages.forEach((m, i) => {
      if (m.role === 'user') lastUser = i;
    });
    if (lastUser < 0) return;

    store.truncateAfter(chat.id, chat.messages[lastUser].id);
    run(chat.id, chat.messages.slice(0, lastUser + 1));
  }, [store, run, streaming]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { streaming, send, regenerate, stop };
}
