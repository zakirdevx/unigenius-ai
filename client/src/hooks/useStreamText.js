// Streams one answer into local state (used by the Code Assistant page, which has no chat history).
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, streamPost } from '../services/api.js';

export function useStreamText() {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(async (url, body) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setError('');
    setStreaming(true);

    let pending = '';
    let timer = null;
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (!pending) return;
      const piece = pending;
      pending = '';
      setText((t) => t + piece);
    };

    try {
      await streamPost(url, body, {
        signal: controller.signal,
        onText: (piece) => {
          pending += piece;
          if (!timer) timer = setTimeout(flush, 40);
        },
      });
      flush();
    } catch (err) {
      flush();
      if (err?.name !== 'AbortError') setError(errorMessage(err));
    } finally {
      clearTimeout(timer);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setError('');
    setStreaming(false);
  }, []);

  return { text, streaming, error, start, stop, reset };
}
