// Builds the Express app (no listening here, so tests can import it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import apiRoutes from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a hosting provider's proxy, so rate limits see each visitor's real address
  app.use(
    helmet({
      frameGuard: false, // allowed to be shown inside the Hugging Face Space page (see frame-ancestors below)
      // The React build is served by this same server in production mode.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'frame-ancestors': ["'self'", 'https://huggingface.co', 'https://*.huggingface.co', 'https://*.hf.space'],
          'media-src': ["'self'", 'blob:', 'data:'], // natural voice audio
          'img-src': ["'self'", 'data:', 'blob:', 'https://image.pollinations.ai'], // slide pictures
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
    }),
  );

  // Only our own React app may call the API from a browser.
  const allowedOrigins = new Set([config.clientOrigin, config.clientOrigin.replace('localhost', '127.0.0.1')]);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.has(origin)) return cb(null, true);
        cb(null, false);
      },
    }),
  );

  // 20 history messages x 8000 characters (Urdu uses 2-3 bytes per character) fits in 600 KB.
  app.use(express.json({ limit: '600kb' }));
  app.use('/api', generalLimiter, apiRoutes);
  app.use('/api', notFound);

  // Production mode: serve the built React app (after `npm run build`).
  const dist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { dotfiles: 'allow' })); // dotfiles: lets /.well-known/assetlinks.json (Android app link) be served
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
