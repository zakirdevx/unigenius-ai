// Last stop for every error. Always answers with the same JSON shape:
//   { "error": { "code": "...", "message": "..." } }
import { HttpError, toFriendlyError } from '../utils/errors.js';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That API route does not exist.' } });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let friendly;
  if (err?.name === 'MulterError') {
    friendly =
      err.code === 'LIMIT_FILE_SIZE'
        ? { status: 413, code: 'FILE_TOO_LARGE', message: 'That file is too large (maximum 5 MB).' }
        : { status: 400, code: 'UPLOAD_ERROR', message: 'The file upload failed. Please try again.' };
  } else if (err?.type === 'entity.too.large') {
    friendly = { status: 413, code: 'TOO_LARGE', message: 'The request is too large.' };
  } else if (err?.type === 'entity.parse.failed') {
    friendly = { status: 400, code: 'BAD_JSON', message: 'The request body is not valid JSON.' };
  } else {
    friendly = toFriendlyError(err);
  }

  // Log only a short code, never the user's text, the API key or a stack trace.
  if (!(err instanceof HttpError)) {
    console.error(`[error] ${friendly.code} (${err?.status || err?.name || 'unknown'})`);
  }

  res.status(friendly.status).json({ error: { code: friendly.code, message: friendly.message } });
}
