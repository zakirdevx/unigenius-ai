// The browser talks ONLY to our own Express server (/api/...). The Gemini key never
// reaches the browser. Chat answers arrive as Server-Sent Events (small "data:" lines).

export class ApiError extends Error {
  constructor(message, code = 'ERROR', status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const NETWORK_MESSAGE = 'Cannot reach the server. Check that it is running and that you are online, then retry.';

async function readError(res) {
  try {
    const data = await res.json();
    return new ApiError(data?.error?.message || 'The request failed.', data?.error?.code, res.status);
  } catch {
    // A 5xx answer that is not JSON comes from the dev proxy when the server is down or restarting.
    if (res.status >= 500) return new ApiError(NETWORK_MESSAGE, 'NETWORK', res.status);
    return new ApiError('The request failed. Please try again.', `HTTP_${res.status}`, res.status);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isProxyFailure = (res) => res.status >= 502 && res.status <= 504 || (res.status === 500 && !(res.headers.get('content-type') || '').includes('json'));

// If the server is just restarting or the first connection fails, try once more before showing an error.
async function doFetch(url, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, options);
      if (attempt === 0 && isProxyFailure(res)) {
        await wait(1200);
        continue;
      }
      return res;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (attempt === 0) {
        await wait(1200);
        continue;
      }
      throw new ApiError(NETWORK_MESSAGE, 'NETWORK');
    }
  }
}

/** POST JSON and stream the answer. Calls onText(piece) for each piece. */
export async function streamPost(url, body, { signal, onText }) {
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data:')) continue;
        let payload;
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (payload.error) throw new ApiError(payload.error, payload.code || 'STREAM_ERROR');
        if (payload.text) onText(payload.text);
        if (payload.done) finished = true;
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError' || err instanceof ApiError) throw err;
    throw new ApiError('The connection was interrupted. Please retry.', 'NETWORK');
  }

  if (!finished) throw new ApiError('The connection was interrupted. Please retry.', 'INTERRUPTED');
}

export async function postJson(url, body, { signal } = {}) {
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** POST JSON and receive a file (used for the .pptx download). */
export async function postBlob(url, body, { signal } = {}) {
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await readError(res);
  return res.blob();
}

export async function postForm(url, formData, { signal } = {}) {
  const res = await doFetch(url, { method: 'POST', body: formData, signal });
  if (!res.ok) throw await readError(res);
  return res.json();
}

export async function getHealth() {
  const res = await doFetch('/api/health', {});
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** Shows a friendly sentence for any error object. */
export function errorMessage(err) {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}
