// Central place for all settings. Everything comes from environment variables
// (server/.env), so secrets never appear in the source code.
import 'dotenv/config';

const list = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  apiKey: (process.env.GEMINI_API_KEY || '').trim(),
  model: (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim(),
  fallbackModels: list(process.env.GEMINI_FALLBACK_MODELS),
  // Natural voice for the Voice Tutor (Gemini text-to-speech). If it is not available the app falls back to the browser voice.
  ttsModel: (process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts').trim(),
  ttsVoice: (process.env.GEMINI_TTS_VOICE || 'Charon').trim(), // Charon = calm male teacher voice

  // Safety limits (protect the free API quota and the server)
  maxMessageChars: 8000, // one chat message
  maxHistoryMessages: 20, // how many past messages are sent as context
  maxNotesChars: 60000, // text sent to Gemini for summarising
  maxUploadBytes: 5 * 1024 * 1024, // 5 MB
};

/** True when the key is missing or still the placeholder from .env.example */
export function hasValidKeyFormat() {
  return Boolean(config.apiKey) && config.apiKey !== 'paste_your_key_here';
}
