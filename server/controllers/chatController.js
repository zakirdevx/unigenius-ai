// Chat, Study mode and Code Assistant all stream their answer with SSE.
import { buildSystemInstruction } from '../prompts/system.js';
import { streamReply } from '../services/gemini.js';
import { looksLikeUrdu } from '../utils/lang.js';
import { toFriendlyError } from '../utils/errors.js';
import { openSse, sendSse, closeSse } from '../utils/sse.js';
import { parseChatRequest, parseCodeRequest, parseSpeed } from '../utils/validate.js';

async function streamAnswer(res, { messages, mode, options, speed }) {
  const lastUserText = messages[messages.length - 1].text;
  const systemInstruction = buildSystemInstruction({
    mode,
    options,
    urdu: looksLikeUrdu(lastUserText),
  });

  // When the browser disconnects (Stop button / closed tab) we stop asking Gemini for more.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  openSse(res);
  try {
    for await (const piece of streamReply({ messages, systemInstruction, signal: controller.signal, speed })) {
      sendSse(res, { text: piece });
    }
    sendSse(res, { done: true });
  } catch (err) {
    if (!controller.signal.aborted) {
      const friendly = toFriendlyError(err);
      console.error(`[stream error] ${friendly.code}`);
      sendSse(res, { error: friendly.message, code: friendly.code });
    }
  } finally {
    closeSse(res);
  }
}

export async function chat(req, res, next) {
  try {
    const parsed = parseChatRequest(req.body); // throws HttpError(400) on bad input
    await streamAnswer(res, { ...parsed, speed: parseSpeed(req.body?.speed) });
  } catch (err) {
    next(err);
  }
}

export async function code(req, res, next) {
  try {
    const parsed = parseCodeRequest(req.body);
    await streamAnswer(res, { ...parsed, speed: parseSpeed(req.body?.speed) });
  } catch (err) {
    next(err);
  }
}
