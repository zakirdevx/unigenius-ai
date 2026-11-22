// Input validation. Every request body is checked here before it reaches Gemini.
import { HttpError } from './errors.js';
import { config } from '../config.js';
import { LAYOUTS, TEMPLATE_IDS, THEME_IDS } from '../../client/src/utils/slideDesign.js';
export { THEME_IDS };


const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const CODE_LANGUAGES = ['HTML', 'CSS', 'JavaScript', 'Python', 'C++', 'SQL'];
const CODE_TASKS = ['explain', 'generate', 'debug'];
const MODES = ['chat', 'study', 'code'];

const asString = (v) => (typeof v === 'string' ? v : '');

const SPEEDS = ['fast', 'balanced', 'deep'];
/** Speed picked in the app: fast (default), balanced or deep thinking. */
export const parseSpeed = (v) => (SPEEDS.includes(v) ? v : 'fast');

/** Validates the chat history and converts it to Gemini's format. */
export function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, 'Please send at least one message.');
  }

  const cleaned = messages
    .map((m) => ({
      role: m?.role === 'user' ? 'user' : 'model', // 'assistant' -> 'model'
      text: asString(m?.content).trim(),
    }))
    .filter((m) => m.text.length > 0)
    .slice(-config.maxHistoryMessages);

  if (cleaned.length === 0) throw new HttpError(400, 'Messages cannot be empty.');
  if (cleaned[cleaned.length - 1].role !== 'user') {
    throw new HttpError(400, 'The last message must come from the user.');
  }
  // Gemini expects the conversation to start with a user turn.
  while (cleaned.length > 1 && cleaned[0].role !== 'user') cleaned.shift();

  for (const m of cleaned) {
    if (m.text.length <= config.maxMessageChars) continue;
    // The student's own messages are limited. The AI's earlier long answers are only
    // context, so we shorten them instead of failing the whole conversation.
    if (m.role === 'user') {
      throw new HttpError(400, `A message is too long (limit ${config.maxMessageChars} characters).`);
    }
    m.text = m.text.slice(0, config.maxMessageChars);
  }
  return cleaned;
}

export function parseChatRequest(body = {}) {
  const mode = MODES.includes(body.mode) ? body.mode : 'chat';
  const o = body.options || {};
  const options = {
    difficulty: DIFFICULTIES.includes(o.difficulty) ? o.difficulty : 'Beginner', // Study mode
    language: CODE_LANGUAGES.includes(o.language) ? o.language : 'JavaScript', // Code mode
    task: CODE_TASKS.includes(o.task) ? o.task : 'explain', // Code mode
    persona: asString(o.persona).replace(/["\r\n]+/g, ' ').trim().slice(0, 600), // role the student assigned
    voice: o.voice === true, // short spoken-style answers
  };
  return { messages: cleanMessages(body.messages), mode, options };
}

export function parseCodeRequest(body = {}) {
  const language = CODE_LANGUAGES.includes(body.language) ? body.language : 'JavaScript';
  const task = CODE_TASKS.includes(body.task) ? body.task : 'explain';
  const prompt = asString(body.prompt).trim();
  const code = asString(body.code).trim();

  if (!prompt && !code) throw new HttpError(400, 'Please describe what you need or paste some code.');
  if (prompt.length > config.maxMessageChars || code.length > config.maxMessageChars) {
    throw new HttpError(400, `Input is too long (limit ${config.maxMessageChars} characters).`);
  }

  const parts = [`Task: ${task} (${language})`];
  if (prompt) parts.push(`Request:\n${prompt}`);
  if (code) parts.push(`Code:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\``);

  return {
    messages: [{ role: 'user', text: parts.join('\n\n') }],
    mode: 'code',
    options: { language, task },
  };
}

export function parseQuizRequest(body = {}) {
  const topic = asString(body.topic).trim();
  if (topic.length < 2) throw new HttpError(400, 'Please enter a subject or topic for the quiz.');
  if (topic.length > 300) throw new HttpError(400, 'The topic is too long (max 300 characters).');

  const count = [5, 10, 15].includes(Number(body.count)) ? Number(body.count) : 5;
  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'Beginner';
  return { topic, count, difficulty };
}

/** Checks the JSON that Gemini returned for a quiz and fixes small problems. */
export function validateQuiz(data, expectedCount) {
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list)) throw new Error('Quiz JSON is not a list');

  const questions = list
    .map((q) => ({
      question: asString(q?.question).trim(),
      options: Array.isArray(q?.options) ? q.options.map((o) => asString(o).trim()) : [],
      correctIndex: Number(q?.correctIndex),
      explanation: asString(q?.explanation).trim(),
    }))
    .filter(
      (q) =>
        q.question &&
        q.options.length === 4 &&
        q.options.every(Boolean) &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4,
    )
    .slice(0, expectedCount);

  if (questions.length === 0) throw new Error('Quiz JSON has no valid questions');
  return questions;
}

/** Checks the JSON that Gemini returned for the notes summary. */
export function validateNotes(data) {
  const strList = (v) => (Array.isArray(v) ? v.map((s) => asString(s).trim()).filter(Boolean) : []);
  const result = {
    summary: asString(data?.summary).trim(),
    detailedNotes: asString(data?.detailedNotes).trim(),
    keyTakeaways: strList(data?.keyTakeaways),
    revisionQuestions: strList(data?.revisionQuestions),
  };
  if (!result.summary && !result.detailedNotes) throw new Error('Notes JSON is empty');
  return result;
}

/** Gemini sometimes wraps JSON in ```json fences. Remove them and parse. */
export function parseJsonLoose(text = '') {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/** Cuts very long text and tells the caller whether it was cut. */
export function truncateText(text, maxChars = config.maxNotesChars) {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

// ---------- Presentation maker ----------
const SLIDE_COUNTS = [5, 8, 10, 12, 15];
const SLIDE_STYLES = ['Academic', 'Professional', 'Creative', 'Minimal'];

export function parseSlidesRequest(body = {}) {
  const topic = asString(body.topic).trim();
  if (topic.length < 3) throw new HttpError(400, 'Please enter the topic of your presentation.');
  if (topic.length > 300) throw new HttpError(400, 'The topic is too long (max 300 characters).');
  const details = asString(body.details).trim().slice(0, 3000);
  const audience = asString(body.audience).trim().slice(0, 100) || 'university classmates and teacher';
  return {
    topic,
    details,
    audience,
    count: SLIDE_COUNTS.includes(Number(body.count)) ? Number(body.count) : 8,
    style: SLIDE_STYLES.includes(body.style) ? body.style : 'Academic',
    language: body.language === 'Urdu' ? 'Urdu' : 'English',
  };
}

/** Cleans one slide (from Gemini or edited by the student). */
export function cleanSlide(s) {
  const str = (v, max) => asString(v).replace(/\s+/g, ' ').trim().slice(0, max);
  return {
    title: str(s?.title, 120),
    layout: LAYOUTS.includes(s?.layout) ? s.layout : 'bullets',
    bullets: (Array.isArray(s?.bullets) ? s.bullets : []).map((x) => str(x, 240)).filter(Boolean).slice(0, 8),
    speakerNotes: asString(s?.speakerNotes).trim().slice(0, 1500),
    visualIdea: str(s?.visualIdea, 300),
    imagePrompt: str(s?.imagePrompt, 200),
    imageSeed: Number.isInteger(s?.imageSeed) ? Math.abs(s.imageSeed) % 100000 : 0,
    noImage: s?.noImage === true,
  };
}

/** Cleans a presentation (from Gemini, or edited by the student) so it is safe to show and export. */
export function cleanDeck(data, { maxSlides = 25, requireSlides = true } = {}) {
  const str = (v, max) => asString(v).replace(/\s+/g, ' ').trim().slice(0, max);
  const list = (v, max, n) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

  const slides = (Array.isArray(data?.slides) ? data.slides : [])
    .map(cleanSlide)
    .filter((s) => s.title)
    .slice(0, maxSlides);

  if (requireSlides && slides.length === 0) throw new Error('Slides JSON has no slides');
  return {
    title: str(data?.title, 150) || slides[0]?.title || 'Presentation',
    subtitle: str(data?.subtitle, 200),
    presenter: str(data?.presenter, 100),
    themeSuggestion: THEME_IDS.includes(data?.themeSuggestion) ? data.themeSuggestion : 'ocean',
    designSuggestion: TEMPLATE_IDS.includes(data?.designSuggestion) ? data.designSuggestion : '',
    designTips: list(data?.designTips, 300, 8),
    coverPrompt: str(data?.coverPrompt, 200),
    coverSeed: Number.isInteger(data?.coverSeed) ? Math.abs(data.coverSeed) % 100000 : 0,
    slides,
  };
}
