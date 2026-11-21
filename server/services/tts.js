// Natural voice: Gemini text-to-speech returns raw audio; we wrap it as a WAV file the browser can play.
import { config } from '../config.js';
import { getAi, listTtsModels } from './gemini.js';

/** Raw 16-bit mono PCM -> WAV file (adds the 44-byte header). */
export function pcmToWav(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

let models = [config.ttsModel];
let discovered = false;
const cache = new Map(); // same sentence again (e.g. pressing Listen twice) costs no quota

const isNotFound = (err) => {
  const raw = String(err?.message || '').toLowerCase();
  return Number(err?.status) === 404 || raw.includes('not found') || raw.includes('is not supported');
};

export async function synthesize(text) {
  const key = `${config.ttsVoice}|${text}`;
  if (cache.has(key)) return cache.get(key);

  let lastError;
  for (let i = 0; i < models.length; i++) {
    try {
      const response = await getAi().models.generateContent({
        model: models[i],
        contents: [{ role: 'user', parts: [{ text: `Say slowly, clearly and calmly, like a friendly teacher: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.ttsVoice } } },
        },
      });
      const part = response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw new Error('The speech model returned no audio');
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
      const wav = pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate);
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, wav);
      if (i > 0) models = [models[i], ...models.filter((_, j) => j !== i)];
      return wav;
    } catch (err) {
      lastError = err;
      if (isNotFound(err)) {
        // The configured name is wrong or retired: look for a speech model this key can use.
        if (!discovered) {
          discovered = true;
          try {
            const found = await listTtsModels();
            models = [...new Set([...models, ...found])];
          } catch { /* keep going with what we have */ }
        }
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
