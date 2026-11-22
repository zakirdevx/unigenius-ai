// Presentation maker: Gemini writes the outline + slide content (JSON), the student edits it,
// then we export a .pptx. Also: "rewrite this slide" with AI.
import { BASE_SYSTEM_INSTRUCTION } from '../prompts/system.js';
import { generateJson, SLIDE_SCHEMA, SLIDES_SCHEMA } from '../services/gemini.js';
import { buildPptx } from '../services/pptx.js';
import { HttpError } from '../utils/errors.js';
import { cleanDeck, cleanSlide, parseSlidesRequest, parseSpeed } from '../utils/validate.js';
import { TEMPLATE_IDS, THEME_IDS, normalizeOptions } from '../../client/src/utils/slideDesign.js';

const SLIDES_SYSTEM =
  BASE_SYSTEM_INSTRUCTION +
  '\n\nYou are now an expert presentation coach for university students. You create clear, well structured, ' +
  'accurate presentations with short slide text (what a speaker shows) and fuller speaker notes (what a speaker says).';

const isBadOutput = (err) => err instanceof SyntaxError || String(err?.message || '').startsWith('Slides JSON');

// Designs that suit each style. Different topics get different looks (chosen from the topic text).
const STYLE_DESIGNS = {
  Academic: ['classic', 'split', 'modern'],
  Professional: ['modern', 'minimal', 'split'],
  Creative: ['cards', 'bold', 'split'],
  Minimal: ['minimal', 'classic'],
};
const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function createSlides(req, res, next) {
  try {
    const { topic, details, audience, count, style, language } = parseSlidesRequest(req.body);
    const prompt =
      `Create a ${style.toLowerCase()} presentation about: "${topic}".\n` +
      `Audience: ${audience}. Language: ${language}${language === 'Urdu' ? ' (Urdu script; keep technical terms in English)' : ''}.\n` +
      `Return exactly ${count} content slides in "slides" (do NOT include a separate title slide; "title" and "subtitle" are for the title slide).\n` +
      (details ? `Use these notes from the student as the main source:\n"""${details}"""\n` : '') +
      'Rules:\n' +
      '- Follow a logical flow: introduction / agenda, main points, example or case, summary / conclusion, and a final questions slide.\n' +
      '- "layout" is one of: "bullets" (normal), "two-column" (comparisons, pros and cons), "section" (divider slide: short title and at most one line in bullets), ' +
      '"quote" (a memorable quote or key sentence in bullets[0] and who said it in bullets[1]), "statement" (one big key message in bullets[0]). ' +
      'Use mostly "bullets"; add one or two of the other layouts where they fit, so the deck feels varied.\n' +
      '- Each normal slide has 3 to 5 short bullets (max about 15 words each). No long paragraphs on slides.\n' +
      '- "speakerNotes": 2 to 4 sentences the presenter can say for that slide.\n' +
      '- "visualIdea": one concrete suggestion for a picture, chart or diagram for that slide.\n' +
      '- "imagePrompt": a short ENGLISH description (8 to 18 words) of ONE beautiful photo or illustration that fits the slide, for an AI image generator. ' +
      'Describe a concrete scene or object (for example "close-up of glowing fibre optic cables in a dark data centre"). ' +
      'No text, no letters, no logos, no charts, no real named people. For "quote" slides use an empty string.\n' +
      '- "coverPrompt": the same kind of description for the title slide background photo, wide and atmospheric.\n' +
      `- "themeSuggestion": exactly one of ${THEME_IDS.join(', ')}, the colour that fits the topic best.\n` +
      `- "designSuggestion": exactly one of ${TEMPLATE_IDS.join(', ')}, the design that fits the topic and the ${style.toLowerCase()} style best.\n` +
      '- "designTips": 4 to 6 practical design tips for this specific presentation (colours, fonts, images, layout, delivery).\n' +
      '- Be accurate. Do not invent statistics or sources.';

    let deck;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await generateJson({
          prompt,
          systemInstruction: SLIDES_SYSTEM,
          schema: SLIDES_SCHEMA,
          speed: parseSpeed(req.body?.speed),
        });
        deck = cleanDeck(data, { maxSlides: count + 2 });
        break;
      } catch (err) {
        if (attempt === 1 || !isBadOutput(err)) throw err;
      }
    }
    // Make sure different topics do not all look the same.
    const pool = STYLE_DESIGNS[style] || TEMPLATE_IDS;
    if (!deck.designSuggestion) deck.designSuggestion = pool[hash(topic) % pool.length];
    if (!req.body?.keepTheme && THEME_IDS.length) deck.themeSuggestion = THEME_IDS.includes(deck.themeSuggestion) && hash(`${topic}x`) % 4 !== 0 ? deck.themeSuggestion : THEME_IDS[hash(topic) % THEME_IDS.length];
    res.json({ deck });
  } catch (err) {
    next(err);
  }
}

const REWRITES = {
  shorter: 'Make the slide shorter: fewer bullets (3 at most) and fewer words per bullet. Keep the key ideas.',
  simpler: 'Rewrite the slide using simpler, easier words that a first-semester student with basic English understands. Keep the meaning.',
  detailed: 'Add more useful detail: up to 5 bullets with clearer explanations, still short enough for a slide.',
  example: 'Keep the existing points but add one concrete, accurate real-world example as an extra bullet.',
  urdu: 'Translate the whole slide (title, bullets, speaker notes, visual idea) into clear, natural Urdu (Urdu script). Keep technical terms in English.',
  english: 'Translate the whole slide (title, bullets, speaker notes, visual idea) into clear, simple English.',
};

/** AI rewrite of ONE slide the student is editing. */
export async function rewriteSlide(req, res, next) {
  try {
    const action = REWRITES[req.body?.action] ? req.body.action : null;
    if (!action) throw new HttpError(400, 'Unknown rewrite action.');
    const slide = cleanSlide(req.body?.slide);
    if (!slide.title) throw new HttpError(400, 'The slide needs a title.');
    const topic = String(req.body?.topic || '').slice(0, 200);

    const prompt =
      `This is one slide of a presentation about "${topic}":\n${JSON.stringify(slide)}\n\n${REWRITES[action]}\n` +
      'Return the full improved slide as JSON with the same fields. Keep "layout" unless it no longer fits.';
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = cleanSlide(
          await generateJson({ prompt, systemInstruction: SLIDES_SYSTEM, schema: SLIDE_SCHEMA, speed: parseSpeed(req.body?.speed) }),
        );
        if (!result.title) throw new SyntaxError('empty slide');
        break;
      } catch (err) {
        if (attempt === 1 || !(err instanceof SyntaxError)) throw err;
      }
    }
    res.json({ slide: result });
  } catch (err) {
    next(err);
  }
}

/** Receives the (possibly edited) deck + design options and returns a .pptx file. */
export async function downloadPptx(req, res, next) {
  try {
    let deck;
    try {
      deck = cleanDeck(req.body?.deck);
    } catch {
      throw new HttpError(400, 'There are no slides to export.');
    }
    const buffer = await buildPptx(deck, normalizeOptions(req.body?.options));
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="presentation.pptx"',
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  } catch (err) {
    next(err);
  }
}
