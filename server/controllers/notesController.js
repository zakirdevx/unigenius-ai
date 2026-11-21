// Notes summariser: PDF / TXT upload (or pasted text) -> short summary, detailed notes,
// key takeaways and revision questions.
import path from 'node:path';
import { NOTES_SYSTEM } from '../prompts/system.js';
import { generateJson, NOTES_SCHEMA } from '../services/gemini.js';
import { extractTextFromPdf, extractTextFromTxt } from '../services/pdf.js';
import { HttpError } from '../utils/errors.js';
import { parseSpeed, truncateText, validateNotes } from '../utils/validate.js';

export async function summarizeNotes(req, res, next) {
  try {
    let rawText = '';
    let source = 'pasted text';

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      source = req.file.originalname;
      rawText =
        ext === '.pdf' ? await extractTextFromPdf(req.file.buffer) : extractTextFromTxt(req.file.buffer);
    } else if (typeof req.body?.text === 'string') {
      rawText = req.body.text.trim();
    }

    if (rawText.length < 20) {
      throw new HttpError(400, 'Please upload a .pdf / .txt file or paste at least a few sentences of notes.');
    }

    const { text, truncated } = truncateText(rawText);

    const prompt =
      'Summarise the following study notes. Return:\n' +
      '- summary: a short summary (3-5 sentences)\n' +
      '- detailedNotes: well-organised revision notes in Markdown (use headings and bullet points)\n' +
      '- keyTakeaways: 5-8 short key points\n' +
      '- revisionQuestions: 5-8 questions the student can use to test themselves\n\n' +
      `NOTES:\n"""\n${text}\n"""`;

    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = validateNotes(
          await generateJson({
            prompt,
            systemInstruction: NOTES_SYSTEM,
            schema: NOTES_SCHEMA,
            speed: parseSpeed(req.body?.speed),
          }),
        );
        break;
      } catch (err) {
        const badOutput = err instanceof SyntaxError || String(err?.message || '').startsWith('Notes JSON');
        if (attempt === 1 || !badOutput) throw err;
      }
    }

    res.json({
      ...result,
      meta: { source, characters: rawText.length, truncated, usedCharacters: text.length },
    });
  } catch (err) {
    next(err);
  }
}
