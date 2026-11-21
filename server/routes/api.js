// All API routes in one place. The React app only ever calls these.
import { Router } from 'express';
import { config } from '../config.js';
import { chat, code } from '../controllers/chatController.js';
import { createQuiz } from '../controllers/quizController.js';
import { summarizeNotes } from '../controllers/notesController.js';
import { createSlides, downloadPptx, rewriteSlide } from '../controllers/slidesController.js';
import { speak } from '../controllers/ttsController.js';
import { aiLimiter, ttsLimiter } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import { listModels } from '../services/gemini.js';

const router = Router();

router.get('/health', (req, res) => {
  // Never returns the key itself, only whether the server is configured.
  res.json({ status: 'ok', app: 'UniGenius AI', model: config.model, keyConfigured: Boolean(config.apiKey) });
});

// Shows which Gemini models your key can use. Open http://localhost:5173/api/models
router.get('/models', async (req, res, next) => {
  try {
    res.json({ current: config.model, models: await listModels() });
  } catch (err) {
    next(err);
  }
});

router.post('/chat', aiLimiter, chat); // streams (SSE)
router.post('/code', aiLimiter, code); // streams (SSE)
router.post('/quiz', aiLimiter, createQuiz); // JSON
router.post('/tts', ttsLimiter, speak); // audio (WAV)
router.post('/slides', aiLimiter, createSlides); // JSON
router.post('/slides/rewrite', aiLimiter, rewriteSlide); // JSON (one slide)
router.post('/slides/pptx', downloadPptx); // .pptx file (no AI call)
router.post('/notes', aiLimiter, upload.single('file'), summarizeNotes); // JSON (multipart or text)

export default router;
