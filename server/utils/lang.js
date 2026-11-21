// Tiny helper: does this text look like Urdu / Arabic script?
// Urdu uses the Arabic Unicode blocks, so we count letters in those ranges.

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN_OR_ARABIC_LETTER = /[A-Za-z؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

export function looksLikeUrdu(text = '') {
  const letters = text.match(LATIN_OR_ARABIC_LETTER);
  if (!letters || letters.length === 0) return false;
  const arabic = text.match(ARABIC_SCRIPT) || [];
  return arabic.length / letters.length > 0.4;
}
