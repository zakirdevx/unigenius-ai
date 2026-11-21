// Reads text from an uploaded PDF or TXT file that is held in memory (never saved to disk).
// Uses pdf-parse v2, whose API is a class: new PDFParse({ data }) -> getText() -> destroy().
import { HttpError } from '../utils/errors.js';

const MIN_USEFUL_CHARS = 20;

export async function extractTextFromPdf(buffer) {
  // Loaded only when a PDF is uploaded, so the server can start even where this library is not supported.
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = (result?.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < MIN_USEFUL_CHARS) {
      throw new HttpError(
        422,
        'No readable text was found in this PDF. It may be a scanned image. Try a text-based PDF or paste the text.',
        'PDF_NO_TEXT',
      );
    }
    return text;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const msg = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
    if (msg.includes('password')) {
      throw new HttpError(422, 'This PDF is password-protected. Remove the password and try again.', 'PDF_PASSWORD');
    }
    throw new HttpError(422, 'This PDF could not be read. Please try another file.', 'PDF_INVALID');
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export function extractTextFromTxt(buffer) {
  const text = buffer.toString('utf8').replace(/^﻿/, '').trim();
  if (text.length < MIN_USEFUL_CHARS) {
    throw new HttpError(422, 'The text file is empty or too short to summarise.', 'TXT_EMPTY');
  }
  return text;
}
