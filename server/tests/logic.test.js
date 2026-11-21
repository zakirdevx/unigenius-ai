// Run with:  npm test --prefix server
// These tests cover the pure logic (no internet or API key needed).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError, toFriendlyError } from '../utils/errors.js';
import { looksLikeUrdu } from '../utils/lang.js';
import {
  cleanMessages,
  parseChatRequest,
  parseCodeRequest,
  parseJsonLoose,
  parseQuizRequest,
  truncateText,
  validateNotes,
  validateQuiz,
} from '../utils/validate.js';

test('detects Urdu vs English', () => {
  assert.equal(looksLikeUrdu('پائتھون میں لوپ کیا ہوتا ہے؟'), true);
  assert.equal(looksLikeUrdu('What is a loop in Python?'), false);
  assert.equal(looksLikeUrdu('12345 ???'), false);
});

test('cleanMessages maps roles, trims history and requires a final user message', () => {
  const out = cleanMessages([
    { role: 'assistant', content: 'Hi' },
    { role: 'user', content: '  Explain RAM  ' },
  ]);
  assert.deepEqual(out, [{ role: 'user', text: 'Explain RAM' }]); // leading model turn removed
  assert.throws(() => cleanMessages([]), HttpError);
  assert.throws(() => cleanMessages([{ role: 'assistant', content: 'x' }]), HttpError);
  assert.throws(() => cleanMessages([{ role: 'user', content: 'a'.repeat(9000) }]), HttpError);
});

test('long AI answers in the history are shortened, not rejected', () => {
  const out = cleanMessages([
    { role: 'user', content: 'Explain OSI model' },
    { role: 'assistant', content: 'x'.repeat(20000) },
    { role: 'user', content: 'Thanks, now explain TCP' },
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[1].text.length, 8000);
});

test('history is limited to the last 20 messages', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  many.push({ role: 'user', content: 'last' });
  const out = cleanMessages(many);
  assert.ok(out.length <= 20);
  assert.equal(out[0].role, 'user');
  assert.equal(out[out.length - 1].text, 'last');
});

test('parseChatRequest falls back to safe defaults', () => {
  const r = parseChatRequest({ messages: [{ role: 'user', content: 'hi' }], mode: 'hack', options: { difficulty: 'x' } });
  assert.equal(r.mode, 'chat');
  assert.equal(r.options.difficulty, 'Beginner');
  assert.equal(r.options.language, 'JavaScript');
  assert.equal(r.options.task, 'explain');

  const code = parseChatRequest({
    messages: [{ role: 'user', content: 'hi' }],
    mode: 'code',
    options: { language: 'SQL', task: 'debug' },
  });
  assert.equal(code.options.language, 'SQL');
  assert.equal(code.options.task, 'debug');
});

test('role (persona) and voice options are cleaned and reach the system instruction', async () => {
  const { buildSystemInstruction } = await import('../prompts/system.js');
  const r = parseChatRequest({
    messages: [{ role: 'user', content: 'hi' }],
    options: { persona: 'You are my "physics" teacher.\nQuiz me.', voice: true },
  });
  assert.equal(r.options.voice, true);
  assert.ok(!r.options.persona.includes('"') && !r.options.persona.includes('\n'));
  const text = buildSystemInstruction({ mode: 'chat', options: r.options, urdu: false });
  assert.match(text, /ROLE-PLAY/);
  assert.match(text, /physics/);
  assert.match(text, /VOICE CONVERSATION/);
  const plain = buildSystemInstruction({ mode: 'chat', options: parseChatRequest({ messages: [{ role: 'user', content: 'hi' }] }).options });
  assert.ok(!plain.includes('ROLE-PLAY') && !plain.includes('VOICE CONVERSATION'));
  assert.equal(parseChatRequest({ messages: [{ role: 'user', content: 'x' }], options: { persona: 'a'.repeat(900) } }).options.persona.length, 600);
});

test('parseCodeRequest builds one user message', () => {
  const r = parseCodeRequest({ language: 'Python', task: 'debug', prompt: 'fix it', code: 'print(1' });
  assert.equal(r.mode, 'code');
  assert.equal(r.options.language, 'Python');
  assert.match(r.messages[0].text, /print\(1/);
  assert.throws(() => parseCodeRequest({}), HttpError);
});

test('parseQuizRequest validates topic and count', () => {
  assert.deepEqual(parseQuizRequest({ topic: 'Photosynthesis', count: 10, difficulty: 'Advanced' }), {
    topic: 'Photosynthesis',
    count: 10,
    difficulty: 'Advanced',
  });
  assert.equal(parseQuizRequest({ topic: 'Math', count: 99 }).count, 5);
  assert.throws(() => parseQuizRequest({ topic: ' ' }), HttpError);
});

test('validateQuiz keeps only well-formed questions', () => {
  const good = { question: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'Because' };
  const bad1 = { question: 'Q2?', options: ['a', 'b'], correctIndex: 0, explanation: '' };
  const bad2 = { question: 'Q3?', options: ['a', 'b', 'c', 'd'], correctIndex: 7, explanation: '' };
  assert.deepEqual(validateQuiz([good, bad1, bad2], 5), [good]);
  assert.deepEqual(validateQuiz({ questions: [good] }, 5), [good]);
  assert.throws(() => validateQuiz([bad1], 5));
  assert.equal(validateQuiz([good, good, good], 2).length, 2);
});

test('validateNotes cleans lists and rejects empty output', () => {
  const r = validateNotes({ summary: ' S ', detailedNotes: 'D', keyTakeaways: ['a', '', 3], revisionQuestions: 'nope' });
  assert.equal(r.summary, 'S');
  assert.deepEqual(r.keyTakeaways, ['a']);
  assert.deepEqual(r.revisionQuestions, []);
  assert.throws(() => validateNotes({}));
});

test('parseJsonLoose strips markdown fences', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('[1,2]'), [1, 2]);
  assert.throws(() => parseJsonLoose('not json'), SyntaxError);
});

test('truncateText cuts long text and reports it', () => {
  assert.deepEqual(truncateText('abc', 10), { text: 'abc', truncated: false });
  assert.deepEqual(truncateText('abcdef', 3), { text: 'abc', truncated: true });
});

test('toFriendlyError hides raw errors and maps common cases', () => {
  assert.equal(toFriendlyError({ status: 429, message: 'RESOURCE_EXHAUSTED' }).code, 'QUOTA');
  assert.equal(toFriendlyError({ status: 404, message: 'model not found' }).code, 'MODEL_NOT_FOUND');
  assert.equal(toFriendlyError({ status: 400, message: 'API key not valid' }).code, 'BAD_KEY');
  assert.equal(toFriendlyError(new Error('fetch failed')).code, 'NETWORK');
  const unknown = toFriendlyError(new Error('secret stack info'));
  assert.equal(unknown.code, 'SERVER_ERROR');
  assert.ok(!unknown.message.includes('secret'));
  assert.equal(toFriendlyError(new HttpError(400, 'bad')).status, 400);
});
