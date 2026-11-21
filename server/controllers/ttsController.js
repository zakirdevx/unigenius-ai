// Text -> natural speech (WAV). The browser falls back to its own voice if this fails.
import { synthesize } from '../services/tts.js';
import { HttpError } from '../utils/errors.js';

export async function speak(req, res, next) {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) throw new HttpError(400, 'Nothing to say.');
    if (text.length > 500) throw new HttpError(400, 'That sentence is too long to speak.');
    const wav = await synthesize(text);
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' }).send(wav);
  } catch (err) {
    next(err);
  }
}
