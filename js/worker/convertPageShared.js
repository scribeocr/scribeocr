import {
  quantile,
} from '../miscUtils.js';

// Includes all capital letters except for "J" and "Q"
export const ascCharArr = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'b', 'd', 'h', 'k', 'l', 't', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const xCharArr = ['a', 'c', 'e', 'm', 'n', 'o', 'r', 's', 'u', 'v', 'w', 'x', 'z'];

/**
 * Pass 2 iterates over all words/letters in the OCR object, calculating statistics and applying corrections.
 * All OCR objects (Tesseract/Abbyy/Stext) should be run through this function before returning.
 *
 * @param {Object} params
 * @param {OcrPage} params.pageObj - Page object to apply corrections to. Edited in place.
 */
export function pass2(pageObj) {
  /** @type {Object.<string, FontMetricsRawFamily>} */

  for (const lineObj of pageObj.lines) {
    /** @type {Array<number>} */
    const lineAscHeightArr = [];
    /** @type {Array<number>} */
    const lineXHeightArr = [];
    /** @type {Array<number>} */
    const lineAllHeightArr = [];

    for (const wordObj of lineObj.words) {
      const letterArr = wordObj.text.split('');
      const charObjArr = wordObj.chars;

      // This condition should not occur, however has in the past due to parsing bugs.  Skipping to avoid entire program crashing if this occurs.
      if (wordObj.chars && wordObj.chars.length !== wordObj.text.length) continue;

      // Quotes at the start of a word are assumed to be opening quotes
      if (['"', "'"].includes(letterArr[0]) && letterArr.length > 1 && /[a-z\d]/i.test(letterArr[1])) {
        if (letterArr[0] === '"') {
          letterArr[0] = '“';
          if (charObjArr) charObjArr[0].text = '“';
        } else if (letterArr[0] === "'") {
          letterArr[0] = '‘';
          if (charObjArr) charObjArr[0].text = '‘';
        }
      }

      // Quotes at the end of a word are assumed to be closing quotes
      if (['"', "'"].includes(letterArr[letterArr.length - 1]) && letterArr.length > 1 && /[a-z\d]/i.test(letterArr[letterArr.length - 2])) {
        if (letterArr[letterArr.length - 1] === '"') {
          letterArr[letterArr.length - 1] = '”';
          if (charObjArr) charObjArr[letterArr.length - 1].text = '”';
        } else if (letterArr[letterArr.length - 1] === "'") {
          letterArr[letterArr.length - 1] = '’';
          if (charObjArr) charObjArr[letterArr.length - 1].text = '’';
        }
      }

      // Single quotes between two letters are assumed to be apostrophes
      for (let k = 0; k < letterArr.length; k++) {
        if (["'"].includes(letterArr[k]) && k > 0 && k + 1 < letterArr.length && /[a-z\d]/i.test(letterArr[k + 1]) && /[a-z\d]/i.test(letterArr[k - 1])) {
          letterArr[k] = '’';
          if (charObjArr) charObjArr[k].text = '’';
        }
      }

      // Calculate statistics from character metrics, if present
      if (wordObj.chars) {
        for (let k = 0; k < letterArr.length; k++) {
          const charObj = wordObj.chars[k];

          // Do not include superscripts, dropcaps, and low-confidence words in all statistics.
          // Low-confidence words are included for font size calculations, as some lines only contain low-confidence words.
          if (wordObj.sup || wordObj.dropcap) continue;

          const contentStrLetter = letterArr[k];
          const charHeight = charObj.bbox.bottom - charObj.bbox.top;

          // Save character heights to array for font size calculations
          lineAllHeightArr.push(charHeight);
          if (ascCharArr.includes(contentStrLetter)) {
            lineAscHeightArr.push(charHeight);
          } else if (xCharArr.includes(contentStrLetter)) {
            lineXHeightArr.push(charHeight);
          }
        }
      }

      wordObj.text = letterArr.join('');
    }

    const lineAllHeight = Math.max(...lineAllHeightArr);
    const lineAscHeight = quantile(lineAscHeightArr, 0.5);
    const lineXHeight = quantile(lineXHeightArr, 0.5);

    // TODO: For Tesseract these are often already filled in by the engine.
    // While the calculated values are more reliable, we may want to defer to the Tesseract values at some point as a fallback.
    if (lineAscHeight) lineObj.ascHeight = lineAscHeight;
    if (lineXHeight) lineObj.xHeight = lineXHeight;

    // If neither ascHeight nor xHeight are known, total height is assumed to represent ascHeight, on the grounds that it is better than nothing.
    if (!lineAscHeight && !lineXHeight && lineAllHeight && Number.isFinite(lineAllHeight)) lineObj.ascHeight = lineAllHeight;

    // Replace all dash characters with a hyphen, en-dash or em-dash, depending on their width.
    // OCR engines commonly use the wrong type of dash. This is especially problematic during font optimization,
    // as it can result (for example) in a hyphen being scaled to be closer to an en-dash if the latter is more common.
    for (const wordObj of lineObj.words) {
      // Sometimes a single `ocrChar` letter object will contain multiple actual letters. Skipping to avoid entire program crashing if this occurs.
      // This generally occurs due to Tesseract returning a "character" that is actually multiple characters, so there is nothing we can do here.
      // This can also occur when there is a bug in the parser--notably when a certain unicode/HTML character code is not being unescaped propertly.
      if (wordObj.chars && wordObj.chars.length !== wordObj.text.length) continue;

      const letterArr = wordObj.text.split('');
      const charObjArr = wordObj.chars;

      // This step requires character-level metrics.
      if (!charObjArr || !wordObj.line.xHeight) continue;

      // In some documents Abbyy consistently uses "¬" rather than "-" for hyphenated words at the the end of lines, so this symbol is included.
      for (let k = 0; k < letterArr.length; k++) {
        if (['-', '–', '—', '¬'].includes(letterArr[k]) && letterArr.length > 1) {
          let charWidth = charObjArr[k].bbox.right - charObjArr[k].bbox.left;

          // If the gap between the previous character and next character is shorter than the supposed width of the dash character, use that width instead.
          // This should never occur in valid data, however can happen for Tesseract LSTM, which frequently gets character-level bounding boxes wrong.
          if (charObjArr[k - 1] && charObjArr[k + 1]) {
            const charWidth2 = charObjArr[k + 1].bbox.left - charObjArr[k - 1].bbox.right;
            charWidth = Math.min(charWidth, charWidth2);
          }

          const charWidthNorm = charWidth / wordObj.line.xHeight;
          if (charWidthNorm > 1.5) {
            letterArr[k] = '—';
            if (charObjArr) charObjArr[k].text = '—';
          } else if (charWidthNorm > 0.9) {
            letterArr[k] = '–';
            if (charObjArr) charObjArr[k].text = '–';
          } else {
            letterArr[k] = '-';
            if (charObjArr) charObjArr[k].text = '-';
          }
        }
      }
      wordObj.text = letterArr.join('');
    }
  }
}
