import { opt } from '../containers/app.js';
import ocr, { OcrPar } from '../objects/ocrObjects.js';
import { calcWordMetrics } from './fontUtils.js';
import { calcBboxUnion, quantile } from './miscUtils.js';

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

/**
 * Assigns paragraphs based on our own heuristics.
 *
 * @param {OcrPage} page
 * @param {number} angle
 */
export function assignParagraphs(page, angle) {
  let endsEarlyPrev = false;
  let startsLatePrev = false;

  let newLine = false;

  const lineLeftArr = [];
  const lineRightArr = [];
  const lineWidthArr = [];
  const lineSpaceArr = [];
  /** @type {?number} */
  let lineLeftMedian = null;
  /** @type {?number} */
  let lineRightMedian = null;
  /** @type {?number} */
  let lineWidthMedian = null;
  /** @type {?number} */
  let lineSpaceMedian = null;

  /** @type {?number} */
  let y2Prev = null;

  /** @type {Array<OcrPar>} */
  const parArr = [];

  for (let h = 0; h < page.lines.length; h++) {
    const lineObj = page.lines[h];
    if (!lineObj) continue;

    const lineBox = lineObj.bbox;

    if (y2Prev !== null) {
      lineSpaceArr.push(lineBox.bottom - y2Prev);
    }

    const sinAngle = Math.sin(angle * (Math.PI / 180));
    const cosAngle = Math.cos(angle * (Math.PI / 180));

    const x1Rot = lineBox.left * cosAngle - sinAngle * lineBox.bottom;
    const x2Rot = lineBox.right * cosAngle - sinAngle * lineBox.bottom;

    lineLeftArr.push(x1Rot);
    lineRightArr.push(x2Rot);

    lineWidthArr.push(lineBox.right - lineBox.left);

    y2Prev = lineBox.bottom;
  }

  lineLeftMedian = quantile(lineLeftArr, 0.5);

  lineRightMedian = quantile(lineRightArr, 0.5);

  lineWidthMedian = quantile(lineWidthArr, 0.5);

  lineSpaceMedian = quantile(lineSpaceArr, 0.5);

  for (let h = 0; h < page.lines.length; h++) {
    // Flag lines that end early (with >=10% of the line empty)
    const endsEarly = lineRightArr[h] < (lineRightMedian - lineWidthMedian * 0.1);
    // Flag lines that start late (with >=20% of the line empty)
    // This is intended to capture floating elements (such as titles and page numbers) and not lines that are indented.
    const startsLate = lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.2);

    // Add spaces or page breaks between lines
    if (h > 0) {
      newLine = false;
      // Add a line break if the previous line ended early
      if (endsEarlyPrev || startsLatePrev) {
        newLine = true;

        // Add a line break if there is blank space added between lines
      } else if (lineSpaceMedian && lineSpaceArr[h - 1] > (2 * lineSpaceMedian)) {
        newLine = true;

        // Add a line break if this line is indented
        // Requires (1) line to start to the right of the median line (by 2.5% of the median width) and
        // (2) line to start to the right of the previous line and the next line.
      } else if (lineLeftMedian && (h + 1) < page.lines.length && lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.025)
            && lineLeftArr[h] > lineLeftArr[h - 1] && lineLeftArr[h] > lineLeftArr[h + 1]) {
        newLine = true;
      }
    } else {
      newLine = true;
    }

    if (newLine) {
      parArr.push(new OcrPar(page, {
        left: 0, top: 0, right: 0, bottom: 0,
      }));
    }

    parArr[parArr.length - 1].lines.push(page.lines[h]);

    endsEarlyPrev = endsEarly;
    startsLatePrev = startsLate;
  }

  parArr.forEach((parObj) => {
    parObj.lines.forEach((lineObj) => {
      lineObj.par = parObj;
    });
    parObj.bbox = calcBboxUnion(parObj.lines.map((x) => x.bbox));
  });

  page.pars = parArr;
}
