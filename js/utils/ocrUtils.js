import { opt } from '../containers/app.js';
import ocr from '../objects/ocrObjects.js';
import { calcWordMetrics } from './fontUtils.js';
import { calcBboxUnion } from './miscUtils.js';

/**
 *
 * @param {Array<OcrPage>} pages
 * @returns
 */
export const calcConf = (pages) => {
  let wordsTotal = 0;
  let wordsHighConf = 0;
  for (let i = 0; i < pages.length; i++) {
    const words = ocr.getPageWords(pages[i]);
    for (let j = 0; j < words.length; j++) {
      const word = words[j];
      wordsTotal += 1;
      if (word.conf > opt.confThreshHigh) wordsHighConf += 1;
    }
  }
  return { total: wordsTotal, highConf: wordsHighConf };
};

/**
 *
 * @param {OcrWord} word
 * @param {number} splitIndex
 * @returns
 */
export function splitOcrWord(word, splitIndex) {
  const wordA = ocr.cloneWord(word);
  const wordB = ocr.cloneWord(word);

  // Character-level metrics are often present and reliable, however may not be.
  // If a user edits the text, then the character-level metrics from the OCR engine will not match.
  // Therefore, a fallback strategy is used in this case to calculate where to split the word.
  const validCharData = word.chars && word.chars.map((x) => x.text).join('') === word.text;
  if (wordA.chars && wordB.chars) {
    wordA.chars.splice(splitIndex);
    wordB.chars.splice(0, splitIndex);
    if (validCharData) {
      wordA.bbox = calcBboxUnion(wordA.chars.map((x) => x.bbox));
      wordB.bbox = calcBboxUnion(wordB.chars.map((x) => x.bbox));
    }
  }

  // TODO: This is a quick fix; figure out how to get this math correct.
  if (!validCharData) {
    const metrics = calcWordMetrics(wordA);
    wordA.bbox.right -= metrics.advanceArr.slice(splitIndex).reduce((a, b) => a + b, 0);
    wordB.bbox.left = wordA.bbox.right;
  }

  wordA.text = wordA.text.split('').slice(0, splitIndex).join('');
  wordB.text = wordB.text.split('').slice(splitIndex).join('');

  wordA.id = `${word.id}a`;
  wordB.id = `${word.id}b`;

  return { wordA, wordB };
}

/**
 *
 * @param {Array<OcrWord>} words
 * @returns
 */
export function mergeOcrWords(words) {
  words.sort((a, b) => a.bbox.left - b.bbox.left);
  const wordA = ocr.cloneWord(words[0]);
  wordA.bbox.right = words[words.length - 1].bbox.right;
  wordA.text = words.map((x) => x.text).join('');
  if (wordA.chars) wordA.chars = words.flatMap((x) => x.chars || []);
  return wordA;
}
