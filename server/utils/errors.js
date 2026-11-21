// Turns any error (our own or from the Gemini SDK) into a safe, friendly message.
// We never send stack traces or raw SDK messages to the browser.

export class HttpError extends Error {
  constructor(status, message, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toFriendlyError(err) {
  if (err instanceof HttpError) {
    return { status: err.status, code: err.code, message: err.message };
  }

  const status = Number(err?.status) || Number(err?.code) || 0;
  const raw = String(err?.message || '').toLowerCase();

  if (status === 429 || raw.includes('quota') || raw.includes('rate limit') || raw.includes('resource_exhausted')) {
    return {
      status: 429,
      code: 'QUOTA',
      message: 'The free AI quota is used up for the moment. Please wait about a minute and try again.',
    };
  }
  if (raw.includes('api key') || status === 401 || status === 403) {
    return {
      status: 502,
      code: 'BAD_KEY',
      message: 'The server could not use the Gemini API key. Check GEMINI_API_KEY in server/.env.',
    };
  }
  if (status === 404 || raw.includes('not found') || raw.includes('is not supported')) {
    return {
      status: 502,
      code: 'MODEL_NOT_FOUND',
      message: 'The AI model name was not found. Update GEMINI_MODEL in server/.env (see the README).',
    };
  }
  if (raw.includes('safety') || raw.includes('blocked') || raw.includes('prohibited')) {
    return {
      status: 422,
      code: 'BLOCKED',
      message: 'The AI could not answer that request. Please rephrase your question and try again.',
    };
  }
  if (raw.includes('fetch failed') || raw.includes('enotfound') || raw.includes('econnreset') || raw.includes('etimedout')) {
    return {
      status: 503,
      code: 'NETWORK',
      message: 'The server could not reach Google. Check your internet connection and try again.',
    };
  }
  return {
    status: 500,
    code: 'SERVER_ERROR',
    message: 'Something went wrong on the server. Please try again.',
  };
}
