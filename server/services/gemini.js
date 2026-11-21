// The ONLY file that talks to Google Gemini. The API key is read here on the server
// and is never sent to the browser.
import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../config.js';
import { parseJsonLoose } from '../utils/validate.js';

let client = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: config.apiKey });
  return client;
}

// Models to try, in order. If the first one is "not found" (Google retired it),
// we move to the next one and remember the one that worked.
let candidates = [config.model, ...config.fallbackModels.filter((m) => m !== config.model)];

function isModelNotFound(err) {
  const raw = String(err?.message || '').toLowerCase();
  return Number(err?.status) === 404 || raw.includes('not found') || raw.includes('is not supported');
}

function promote(model) {
  candidates = [model, ...candidates.filter((m) => m !== model)];
}

// Optional: use a DIFFERENT model for each speed picked in the app. Set any of these in
// server/.env (leave a line out to use GEMINI_MODEL for that speed):
//   GEMINI_MODEL_FAST=...   GEMINI_MODEL_MEDIUM=...   GEMINI_MODEL_HIGH=...
const ENV_KEY = { fast: 'FAST', balanced: 'MEDIUM', deep: 'HIGH' };

function modelOverride(speed) {
  return (process.env[`GEMINI_MODEL_${ENV_KEY[speed] || 'FAST'}`] || '').trim();
}

function modelsFor(speed) {
  const chosen = modelOverride(speed);
  return chosen ? [chosen, ...candidates.filter((m) => m !== chosen)] : [...candidates];
}

// "Thinking" models reason for a long time before they start answering. A study chatbot
// should answer fast, so we ask for LOW thinking. Change it in server/.env with
// GEMINI_THINKING = minimal | low | medium | high | default. If the model refuses the
// setting we automatically retry without it (and remember that).
let thinkingRejected = false;

// The speed picker in the app (Fast / Balanced / Deep thinking) maps to these levels.
const SPEED_LEVELS = { fast: 'LOW', balanced: 'MEDIUM', deep: 'HIGH' };

function thinkingConfig(speed = 'fast') {
  if (thinkingRejected) return {};
  return { thinkingConfig: { thinkingLevel: SPEED_LEVELS[speed] || 'LOW' } };
}

function isThinkingRejected(err) {
  const raw = String(err?.message || '').toLowerCase();
  return Number(err?.status) === 400 && raw.includes('thinking');
}

function toContents(messages) {
  return messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

/**
 * Streams the answer. Yields text pieces as they arrive.
 * Pass an AbortSignal to stop generation (the "Stop" button).
 */
export async function* streamReply({ messages, systemInstruction, signal, speed }) {
  let lastError;
  const t0 = Date.now();
  const models = modelsFor(speed);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    let started = false;
    try {
      const stream = await getClient().models.generateContentStream({
        model,
        contents: toContents(messages),
        config: { systemInstruction, temperature: 0.7, abortSignal: signal, ...thinkingConfig(speed) },
      });
      for await (const chunk of stream) {
        if (signal?.aborted) return;
        const text = chunk.text;
        if (text) {
          // Shown in the black window so you can see how long the model really takes.
          if (!started) console.log(`[gemini] first words after ${Date.now() - t0} ms (model ${model}, speed ${speed || 'fast'})`);
          started = true;
          yield text;
        }
      }
      if (!modelOverride(speed)) promote(model);
      return;
    } catch (err) {
      lastError = err;
      if (signal?.aborted) return;
      if (!started && !thinkingRejected && isThinkingRejected(err)) {
        thinkingRejected = true; // retry the same model without the thinking setting
        i--;
        continue;
      }
      // Only try the next model if nothing was sent yet and the model was not found.
      if (!started && isModelNotFound(err)) continue;
      throw err;
    }
  }
  throw lastError;
}

/** One-shot request that must return JSON matching `schema`. */
export async function generateJson({ prompt, systemInstruction, schema, speed }) {
  let lastError;
  const models = modelsFor(speed);
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await getClient().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: schema,
          ...thinkingConfig(speed),
        },
      });
      if (!modelOverride(speed)) promote(model);
      return parseJsonLoose(response.text);
    } catch (err) {
      lastError = err;
      if (!thinkingRejected && isThinkingRejected(err)) {
        thinkingRejected = true; // retry the same model without the thinking setting
        i--;
        continue;
      }
      if (isModelNotFound(err)) continue;
      throw err;
    }
  }
  throw lastError;
}

/** The shared Gemini client (used by the text-to-speech service). */
export const getAi = getClient;

/** Ids of models that can speak (their name contains "tts"). */
export async function listTtsModels() {
  const pager = await getClient().models.list();
  const found = [];
  for await (const m of pager) {
    const id = String(m.name || '').replace(/^models\//, '');
    if (/tts/i.test(id)) found.push(id);
  }
  return found;
}

/** Lists the models your API key can use for chat (shown at /api/models). */
export async function listModels() {
  const pager = await getClient().models.list();
  const found = [];
  for await (const m of pager) {
    const actions = m.supportedActions;
    if (Array.isArray(actions) && !actions.includes('generateContent')) continue;
    found.push({ id: String(m.name || '').replace(/^models\//, ''), name: m.displayName || '' });
  }
  return found;
}

// ---- JSON schemas (structured output) ----

export const SLIDE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    layout: { type: Type.STRING },
    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
    speakerNotes: { type: Type.STRING },
    visualIdea: { type: Type.STRING },
  },
  required: ['title', 'layout', 'bullets', 'speakerNotes', 'visualIdea'],
  propertyOrdering: ['title', 'layout', 'bullets', 'speakerNotes', 'visualIdea'],
};

export const SLIDES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    themeSuggestion: { type: Type.STRING },
    designSuggestion: { type: Type.STRING },
    designTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          layout: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          speakerNotes: { type: Type.STRING },
          visualIdea: { type: Type.STRING },
        },
        required: ['title', 'layout', 'bullets', 'speakerNotes', 'visualIdea'],
        propertyOrdering: ['title', 'layout', 'bullets', 'speakerNotes', 'visualIdea'],
      },
    },
  },
  required: ['title', 'subtitle', 'themeSuggestion', 'designSuggestion', 'designTips', 'slides'],
  propertyOrdering: ['title', 'subtitle', 'themeSuggestion', 'designSuggestion', 'designTips', 'slides'],
};

export const QUIZ_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctIndex: { type: Type.INTEGER },
      explanation: { type: Type.STRING },
    },
    required: ['question', 'options', 'correctIndex', 'explanation'],
    propertyOrdering: ['question', 'options', 'correctIndex', 'explanation'],
  },
};

export const NOTES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    detailedNotes: { type: Type.STRING },
    keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
    revisionQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'detailedNotes', 'keyTakeaways', 'revisionQuestions'],
  propertyOrdering: ['summary', 'detailedNotes', 'keyTakeaways', 'revisionQuestions'],
};
