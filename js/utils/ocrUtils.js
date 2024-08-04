import { opt } from '../containers/app.js';
import ocr, { OcrPar } from '../objects/ocrObjects.js';
import { calcWordMetrics } from './fontUtils.js';
import { calcBboxUnion, quantile, range } from './miscUtils.js';

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
  let bulletPrev = false;
  let letterEndPrev = false;

  // First line is always a new paragraph
  let newPar = true;
  let reason = 'first line';

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  /** @type {Array<OcrPar>} */
  const parArr = [];

  const lineLeftArr = /** @type {Array<number>} */([]);
  const lineRightArr = /** @type {Array<number>} */([]);
  const lineWidthArr = /** @type {Array<number>} */([]);
  const lineSpaceArr = /** @type {Array<number>} */([]);

  /** @type {?number} */
  let y2Prev = null;
  for (let h = 0; h < page.lines.length; h++) {
    const line = page.lines[h];
    if (!line) continue;

    lineSpaceArr.push(line.bbox.bottom - y2Prev);

    const x1Rot = line.bbox.left * cosAngle - sinAngle * line.bbox.bottom;
    const x2Rot = line.bbox.right * cosAngle - sinAngle * line.bbox.bottom;

    lineLeftArr.push(x1Rot);
    lineRightArr.push(x2Rot);

    lineWidthArr.push(line.bbox.right - line.bbox.left);

    y2Prev = line.bbox.bottom;
  }

  /**
   * Calculates expected line start and end positions based on surrounding lines.
   * If this line varies from those values, it may be the first or last line of a paragraph.
   * @param {number} lineIndex - Index of the line to calculate the expected values for.
   * @returns
   */
  const calcExpected = (lineIndex) => {
    // Ideally, we compare the current line to the next 5 lines.
    // When there are fewer than 5 lines after the current line, we add previous lines to the window.
    // Previous lines must be above the current line, and next lines must be below the current line.
    // This avoids comparing lines that are not in the same column.
    const windowSize = 5;
    const linesPrev = page.lines.slice(Math.max(0, lineIndex - windowSize), lineIndex).filter((x) => x.bbox.bottom <= page.lines[lineIndex].bbox.bottom);
    const linesNext = page.lines.slice(lineIndex + 1, lineIndex + windowSize + 1).filter((x) => x.bbox.bottom >= page.lines[lineIndex].bbox.bottom);
    const linesNextN = linesNext.length;
    const linesPrevN = Math.min(windowSize - linesNextN, linesPrev.length);

    /** @type {Array<number>} */
    const compIndices = [];
    if (linesPrevN) compIndices.push(...range(lineIndex - linesPrevN, lineIndex - 1));
    if (linesNextN) compIndices.push(...range(lineIndex + 1, lineIndex + linesNextN));
    if (!compIndices.length) return null;

    const lineLeftMedian = quantile(compIndices.map((x) => lineLeftArr[x]), 0.5);
    const lineRightMedian = quantile(compIndices.map((x) => lineRightArr[x]), 0.5);
    const lineWidthMedian = quantile(compIndices.map((x) => lineWidthArr[x]), 0.5);
    const lineSpaceMedian = quantile(compIndices.map((x) => lineSpaceArr[x]), 0.5);

    if (lineLeftMedian === null || lineRightMedian === null || lineWidthMedian === null || lineSpaceMedian === null) return null;

    return {
      lineLeftMedian, lineRightMedian, lineWidthMedian, lineSpaceMedian,
    };
  };

  for (let h = 0; h < page.lines.length; h++) {
    const line = page.lines[h];
    let endsEarlyInt = false;
    let startsLate = false;

    // Bullet points violate some heuristics, so we need to track them separately.
    // For a bullet point list, the first line *after* the line containing the bullet point appears to be indented.
    const bullet = /^([•◦▪▫●○◼◻➢]|(i+\.))/.test(line.words[0].text);
    // const bullet = bulletChars.includes(line.words[0].text.slice(0, 1));
    // This will not work with non-English alphabets.  Should be replaced with a more general solution at some point.
    const lowerStart = /[a-z]/.test(line.words[0].text.slice(0, 1));
    const letterEnd = /\w/.test(line.words[line.words.length - 1].text.slice(-1));
    // If one line ends with a non-punctuation character and the next line starts with a lowercase letter,
    // they are likely part of the same paragraph.
    // This heuristic can override some but not all other heuristics that would otherwise split the paragraph.
    const lowerConnection = lowerStart && letterEndPrev;

    if (parArr[parArr.length - 1] && parArr[parArr.length - 1].lines.length > 2) {
      // Get indices of lines in the current paragraph.
      const parLineIndices = parArr[parArr.length - 1].lines.slice(1).map((line) => page.lines.indexOf(line));
      const parLeftMedian = quantile(parLineIndices.map((x) => lineLeftArr[x]), 0.5);
      const parWidthMedian = quantile(parLineIndices.map((x) => lineWidthArr[x]), 0.5);

      const leftChangeThresh = Math.max(parWidthMedian * 0.05, 50);

      if (parLeftMedian && parWidthMedian && Math.abs(lineLeftArr[h] - parLeftMedian) > leftChangeThresh && Math.abs(lineLeftArr[h + 1] - parLeftMedian) > leftChangeThresh) {
        newPar = true;
        reason = 'left change';
      }
    }

    const expected = calcExpected(h);

    if (!expected) {
      newPar = true;
      reason = 'default value (unable to calculate)';
    } else {
      const {
        lineLeftMedian, lineRightMedian, lineWidthMedian, lineSpaceMedian,
      } = expected;

      // Note: `+1` is used to indicate some non-infinitesimal difference, as sometimes infinitesimal differences exist, which are effectively 0.

      // Line flagged as indented if both:
      // (1) line to start to the right of the median line (by 2.5% of the median width) and
      // (2) line to start to the right of the previous line and the next line.
      const indented = lineLeftMedian && (h + 1) < page.lines.length && lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.025)
      && lineLeftArr[h] > (lineLeftArr[h - 1] + 1) && lineLeftArr[h] > lineLeftArr[h + 1];

      // Weaker version of other conditions, which may be used in combination of other evidence but are not strong enough on their own.
      const indentedWeak = lineLeftArr[h] > (lineLeftArr[h - 1] + 1);
      const lineSpaceWeak = lineSpaceArr[h - 1] > 0 && lineSpaceArr[h] > 1.1 * lineSpaceArr[h - 1];

      // Flag lines that likely end early.
      // A line likely ends early if all of the following conditions are met:
      // (1) it ends at least 10% before the median line end,
      // (2) it ends at least 10% before the previous line end, and
      // (3) the first word on the next line could fit on the current line.
      // The latter condition is necessary because long words, URLs, etc. may cause the line to end early without a new paragraph.
      const lineNextFirstWord = page.lines[h + 1] && page.lines[h + 1].words[0];
      endsEarlyInt = lineRightMedian - lineRightArr[h] > (lineWidthMedian * 0.1)
        && !!lineRightArr[h - 1] && (lineRightArr[h - 1] - lineRightArr[h]) > (lineWidthMedian * 0.1)
        && lineNextFirstWord && (lineNextFirstWord.bbox.right - lineNextFirstWord.bbox.left) < (lineRightMedian - lineRightArr[h]);
      // Similarly, flag lines that start late (with >=20% of the line empty)
      // This is intended to capture floating elements (such as titles and page numbers) and not lines that are indented.
      startsLate = lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.2)
        && !!lineLeftArr[h - 1] && lineLeftArr[h] - lineLeftArr[h - 1] > (lineWidthMedian * 0.2);

      // Add a line break if the previous line ended early
      if (endsEarlyPrev && !lowerConnection && (lineSpaceWeak || indentedWeak)) {
        newPar = true;
        reason = 'prev line ends early';
      } else if (startsLatePrev && !lowerConnection) {
        newPar = true;
        reason = 'prev line starts late';

      // Add a line break if this line is indented
      } else if (indented && !bulletPrev && !lowerConnection) {
        newPar = true;
        reason = 'indentation';

      // For the second line on the page, create a new paragraph if the preceding line space is significantly larger than the median line space in the window.
      // This is necessary because the 'large space (relative)' rule only starts working on line 3.
      } else if (h === 1 && lineSpaceArr[h] > 1.5 * lineSpaceMedian) {
        newPar = true;
        reason = 'large space (first line)';
      }
    }

    // Apply additional rules that do not depend on the rolling medians.
    // Create new paragraph if the line spacing is negative, indicating the next line is part of a different column.
    // A threshold is used to prevent a small change in line spacing from creating a new paragraph.
    const lineHeight = line.bbox.bottom - line.bbox.top;
    if (lineSpaceArr[h] && lineSpaceArr[h] < (lineHeight * -1)) {
      newPar = true;
      reason = 'new column';
    }

    // Create new paragraph if the current line space is significantly larger than the preceding line space.
    if (lineSpaceArr[h - 1] > 0 && lineSpaceArr[h] > 1.5 * lineSpaceArr[h - 1]) {
      newPar = true;
      reason = 'large space (relative)';
    }

    const bbox = line.bbox;
    const bboxPrev = page.lines[h - 1]?.bbox;

    // Create new paragraph if the space between lines is >2.5x the line height.
    // Even if the space before this line is standard for the rolling window, if it is large in absolute terms, it is likely a new paragraph.
    const height = bbox.bottom - bbox.top;
    const width = bbox.right - bbox.left;
    const heightRot = height * cosAngle - sinAngle * width;
    if (lineSpaceArr[h] && lineSpaceArr[h] > 2.5 * heightRot) {
      newPar = true;
      reason = 'large space (absolute)';
    }

    // Create new paragraph if there is no horizontal or vertical overlap with the previous line.
    // The vertical overlap condition is necessary lines sometimes are improperly split in input data despite being on the same baseline.
    if (bboxPrev && (bboxPrev.right < bbox.left || bboxPrev.left > bbox.right)
        && (bboxPrev.bottom < bbox.top || bboxPrev.top > bbox.bottom)) {
      newPar = true;
      reason = 'no overlap';
    }

    if (newPar) {
      const par = new OcrPar(page, {
        left: 0, top: 0, right: 0, bottom: 0,
      });
      par.reason = reason;
      parArr.push(par);

      reason = '';
    }

    parArr[parArr.length - 1].lines.push(line);

    // The first line of a paragraph is not allowed to "end early" even if the other conditions are met.
    endsEarlyPrev = endsEarlyInt && !newPar;
    startsLatePrev = startsLate;
    bulletPrev = bullet;
    letterEndPrev = letterEnd;
    newPar = false;
  }

  parArr.forEach((parObj) => {
    parObj.lines.forEach((lineObj) => {
      lineObj.par = parObj;
    });
    parObj.bbox = calcBboxUnion(parObj.lines.map((x) => x.bbox));
  });

  page.pars = parArr;
}
