// Helpers for Server-Sent Events (SSE): the server keeps the HTTP response open
// and pushes small "data:" messages, which is how we stream the AI answer word by word.

export function openSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable buffering behind proxies
  res.flushHeaders?.();
}

export function sendSse(res, payload) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function closeSse(res) {
  if (!res.writableEnded) res.end();
}
