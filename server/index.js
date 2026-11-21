// Entry point: checks the configuration, then starts the server.
import { config, hasValidKeyFormat } from './config.js';
import { createApp } from './app.js';

if (!hasValidKeyFormat()) {
  console.error(
    '\n[UniGenius AI] GEMINI_API_KEY is missing.\n' +
      '  1. Copy server/.env.example to server/.env\n' +
      '  2. Paste your free key from https://aistudio.google.com into GEMINI_API_KEY\n' +
      '  3. Start the app again.\n',
  );
  process.exit(1);
}

// Never let one bad request switch the whole server off (important when presenting in class).
process.on('uncaughtException', (err) => console.error('[uncaught]', err?.message || err));
process.on('unhandledRejection', (err) => console.error('[unhandled]', err?.message || err));

const app = createApp();
app.listen(config.port, () => {
  console.log(`[UniGenius AI] API running at http://localhost:${config.port}  (model: ${config.model})`);
});
