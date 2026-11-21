// Tests for the voice (WAV), presentation maker (validation + real .pptx) features.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPptx } from '../services/pptx.js';
import { pcmToWav } from '../services/tts.js';
import { cleanDeck, parseSlidesRequest } from '../utils/validate.js';
import { HttpError } from '../utils/errors.js';
import { buildSlides, fitSize, mix, normalizeOptions, paletteFor } from '../../client/src/utils/slideDesign.js';

test('pcmToWav writes a valid 44-byte WAV header', () => {
  const pcm = Buffer.alloc(48000); // 1 second of silence at 24 kHz, 16-bit mono
  const wav = pcmToWav(pcm, 24000);
  assert.equal(wav.length, 44 + 48000);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(40), 48000);
});

test('parseSlidesRequest validates and defaults', () => {
  const r = parseSlidesRequest({ topic: 'Machine learning', count: 10, style: 'Creative', language: 'Urdu' });
  assert.deepEqual([r.count, r.style, r.language], [10, 'Creative', 'Urdu']);
  const d = parseSlidesRequest({ topic: 'AI ethics', count: 99, style: 'x' });
  assert.deepEqual([d.count, d.style, d.language], [8, 'Academic', 'English']);
  assert.throws(() => parseSlidesRequest({ topic: 'a' }), HttpError);
});

test('cleanDeck fixes layouts, trims text and rejects empty decks', () => {
  const deck = cleanDeck({
    title: '  My   Talk ',
    themeSuggestion: 'nope',
    designTips: ['Use big fonts', '', 5],
    slides: [
      { title: 'Intro', layout: 'weird', bullets: ['a', '', 'b'], speakerNotes: 'say it', visualIdea: 'a chart' },
      { title: '', bullets: ['dropped'] },
    ],
  });
  assert.equal(deck.title, 'My Talk');
  assert.equal(deck.themeSuggestion, 'ocean');
  assert.deepEqual(deck.designTips, ['Use big fonts']);
  assert.equal(deck.slides.length, 1);
  assert.equal(deck.slides[0].layout, 'bullets');
  assert.deepEqual(deck.slides[0].bullets, ['a', 'b']);
  assert.throws(() => cleanDeck({ slides: [] }));
  assert.equal(cleanDeck({ slides: Array.from({ length: 40 }, (_, i) => ({ title: `S${i}` })) }, { maxSlides: 12 }).slides.length, 12);
});

test('buildPptx creates a real PowerPoint file with one slide per entry plus a title slide', async () => {
  const deck = cleanDeck({
    title: 'Neural Networks',
    subtitle: 'An introduction',
    slides: [
      { title: 'Agenda', layout: 'bullets', bullets: ['What is a neuron', 'Layers', 'Training'], speakerNotes: 'Welcome.', visualIdea: 'diagram' },
      { title: 'Pros and cons', layout: 'two-column', bullets: ['Accurate', 'Flexible', 'Needs data', 'Slow to train'], speakerNotes: 'n', visualIdea: 'table' },
      { title: 'Part two', layout: 'section', bullets: ['Deep dive'], speakerNotes: '', visualIdea: '' },
    ],
  });
  for (const template of ['modern', 'minimal', 'bold', 'classic', 'split', 'cards']) {
    const buf = await buildPptx(deck, { template, theme: 'rose', bulletStyle: 'numbers', textSize: 'large' });
    assert.ok(Buffer.isBuffer(buf));
    assert.equal(buf.toString('ascii', 0, 2), 'PK'); // .pptx is a zip file
    const names = buf.toString('latin1');
    for (let i = 1; i <= 4; i++) assert.ok(names.includes(`ppt/slides/slide${i}.xml`), `slide ${i} missing`);
    assert.ok(!names.includes('ppt/slides/slide5.xml'));
  }
  const urdu = await buildPptx(cleanDeck({ title: 'مصنوعی ذہانت', slides: [{ title: 'تعارف', bullets: ['پہلا نکتہ'] }] }), { template: 'cards', primary: '#112233' });
  assert.equal(urdu.toString('ascii', 0, 2), 'PK');
});

test('design options are validated and colours are mixed correctly', () => {
  const o = normalizeOptions({ template: 'nope', theme: 'rose', primary: '#abc123', accent: 'zzz', textSize: 'huge', showNumbers: false });
  assert.deepEqual([o.template, o.theme, o.primary, o.accent, o.textSize, o.showNumbers, o.showFooter], ['modern', 'rose', 'ABC123', '', 'medium', false, true]);
  assert.equal(mix('000000', 'FFFFFF', 0.5), '808080');
  assert.equal(paletteFor(normalizeOptions({ primary: 'FF0000' })).primary, 'FF0000');
});

test('fitSize shrinks long text to fit the box', () => {
  const long = Array.from({ length: 6 }, () => 'x'.repeat(150));
  assert.ok(fitSize(long, 11, 4.3, 24) < 24);
  assert.equal(fitSize(['short'], 11, 4.3, 26), 26);
});

test('every design makes a title slide plus one slide per entry', () => {
  const deck = cleanDeck({
    title: 'Topic', presenter: 'Ali', slides: [
      { title: 'A', bullets: ['one', 'two'] },
      { title: 'B', layout: 'quote', bullets: ['A great line', 'Someone'] },
      { title: 'C', layout: 'statement', bullets: ['Big idea'] },
    ],
  });
  for (const template of ['modern', 'minimal', 'bold', 'classic', 'split', 'cards']) {
    const slides = buildSlides(deck, { template });
    assert.equal(slides.length, 4);
    assert.ok(slides.every((s) => /^[0-9A-F]{6}$/.test(s.bg) && s.items.length > 0));
  }
  assert.equal(buildSlides(deck, { showNumbers: false, showFooter: false })[1].items.filter((i) => i.t === 'text' && i.size === 10).length, 0);
});
