// Basic abuse protection. Also helps you stay inside the free Gemini quota.
import rateLimit from 'express-rate-limit';

const tooMany = {
  error: { code: 'RATE_LIMIT', message: 'Too many requests. Please slow down and try again in a minute.' },
};

/** Applied to every /api route. */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

/** Applied to routes that call Gemini (they cost quota). */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

/** Natural voice requests (one per spoken sentence). */
export const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});
