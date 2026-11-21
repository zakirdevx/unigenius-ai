// Quiz generator: asks Gemini for structured JSON, validates it, returns it to the browser.
import { QUIZ_SYSTEM } from '../prompts/system.js';
import { generateJson, QUIZ_SCHEMA } from '../services/gemini.js';
import { parseQuizRequest, parseSpeed, validateQuiz } from '../utils/validate.js';

function isBadQuizOutput(err) {
  return err instanceof SyntaxError || String(err?.message || '').startsWith('Quiz JSON');
}

export async function createQuiz(req, res, next) {
  try {
    const { topic, count, difficulty } = parseQuizRequest(req.body);

    const prompt =
      `Create a ${difficulty}-level multiple-choice quiz with exactly ${count} questions about:\n"${topic}"\n\n` +
      'Rules:\n' +
      '- Each question has exactly 4 answer options.\n' +
      '- "correctIndex" is the position (0-3) of the single correct option.\n' +
      '- "explanation" explains in 1-3 sentences why the correct answer is right.\n' +
      '- Vary the position of the correct answer.\n' +
      '- If the topic is written in Urdu, write the whole quiz in Urdu.';

    let questions;
    // Models occasionally return broken JSON. We try twice before giving up.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await generateJson({
          prompt,
          systemInstruction: QUIZ_SYSTEM,
          schema: QUIZ_SCHEMA,
          speed: parseSpeed(req.body?.speed),
        });
        questions = validateQuiz(data, count);
        break;
      } catch (err) {
        if (attempt === 1 || !isBadQuizOutput(err)) throw err;
      }
    }

    res.json({ topic, difficulty, questions });
  } catch (err) {
    next(err);
  }
}
