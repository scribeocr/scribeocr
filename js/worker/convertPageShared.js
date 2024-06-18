import {
  quantile, mean50,
} from '../miscUtils.js';
import ocr from '../objects/ocrObjects.js';

// Includes all capital letters except for "J" and "Q"
export const ascCharArr = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'b', 'd', 'h', 'k', 'l', 't', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const xCharArr = ['a', 'c', 'e', 'm', 'n', 'o', 'r', 's', 'u', 'v', 'w', 'x', 'z'];

/**
 * Pass 2 iterates over all words/letters in the OCR object, and corrects style and rotation.
 * This pass should only be run for Tesseract data.
 *
 * @param {OcrPage} pageObj - Page object to apply corrections to. Edited in place.
 */
export function pass2(pageObj, rotateAngle) {
  // Re-calculate line bounding box and adjust baseline.
  // Note: this must happen before the roatation step, as that step assumes the bounding boxes are correct.
  // Data from Tesseract can omit certain characters when calculating line-level bounding boxes.
  // Therefore, the bounding box is recalculated using `ocr.updateLineBbox` (which is used by the editor).
  for (const lineObj of pageObj.lines) {
    ocr.updateLineBbox(lineObj);
  }

  // Transform bounding boxes if rotation is specified.
  // This option is used when an image is rotated before it is sent to Tesseract,
  // however the HOCR needs to be applied to the original image.
  if (Math.abs(rotateAngle) > 0.05) {
    for (let i = 0; i < pageObj.lines.length; i++) {
      ocr.rotateLine(pageObj.lines[i], rotateAngle, null, true);
    }
  }

  // Flag words that are small caps, incorrectly identified as capital letters in a normal style.
  // Unlike Abbyy, which generally identifies small caps as lowercase letters (and identifies small cap text explicitly as a formatting property),
  // Tesseract (at least the Legacy model) reports them as upper-case letters.
  for (const lineObj of pageObj.lines) {
    const smallCapsWordArr = [];
    const titleCaseArr = [];
    for (const wordObj of lineObj.words) {
      // Skip words that are already identified as small caps, however they can be used to validate other words.
      if (wordObj.style === 'smallCaps') {
        smallCapsWordArr.push(wordObj);
        continue;
      }

      // Word contains multiple capital letters, no lowercase letters, and is not already identified as small caps.
      if (!/[a-z]/.test(wordObj.text) && /[A-Z].?[A-Z]/.test(wordObj.text) && wordObj.style !== 'smallCaps' && wordObj.chars) {
        // Filter to only include letters
        const filterArr = wordObj.text.split('').map((x) => /[a-z]/i.test(x));
        const charArrSub = wordObj.chars.filter((x, y) => filterArr[y]);

        const firstLetterHeight = charArrSub[0].bbox.bottom - charArrSub[0].bbox.top;
        const otherLetterHeightArr = charArrSub.slice(1).map((x) => x.bbox.bottom - x.bbox.top);
        const otherLetterHeightMax = Math.max(...otherLetterHeightArr);
        const otherLetterHeightMin = Math.min(...otherLetterHeightArr);

        // If the first letter is significantly larger than the others, then this word would need to be in title case.
        if (firstLetterHeight > otherLetterHeightMax * 1.1) {
          // If the other letters are all around the same size, then the word is small caps.
          if ((otherLetterHeightMax / otherLetterHeightMin) < 1.15) {
            smallCapsWordArr.push(wordObj);
            titleCaseArr[smallCapsWordArr.length - 1] = true;
          }
        } else {
          // Otherwise, all the letters need to be about the same size for this to be small caps.
          const letterChars = wordObj.chars.filter((x) => /[a-z]/i.test(x.text));
          const allLetterHeightArr = letterChars.map((x) => x.bbox.bottom - x.bbox.top);
          const allLetterHeightMax = Math.max(...allLetterHeightArr);
          const allLetterHeightMin = Math.min(...allLetterHeightArr);

          if ((allLetterHeightMax / allLetterHeightMin) < 1.15) {
            smallCapsWordArr.push(wordObj);
            titleCaseArr[smallCapsWordArr.length - 1] = false;
          }
        }
      }
    }

    if (smallCapsWordArr.length >= 3) {
      const titleCaseTotal = titleCaseArr.reduce((x, y) => Number(x) + Number(y), 0);

      for (let k = 0; k < smallCapsWordArr.length; k++) {
        const wordObj = smallCapsWordArr[k];
        wordObj.style = 'smallCaps';
        if (!wordObj.chars || !titleCaseTotal) continue;

        // If title case, convert all letters after the first to lowercase.
        if (titleCaseArr[k]) {
          wordObj.chars.slice(1).forEach((x) => {
            x.text = x.text.toLowerCase();
          });
          wordObj.text = wordObj.chars.map((x) => x.text).join('');
        } else {
          // If not title case (but title case is used on this line), assume the entire word is lower case.
          // This should be refined at some point to check the actual bounding boxes,
          // however this heuristic is generally reliable.
          wordObj.chars.forEach((x) => {
            x.text = x.text.toLowerCase();
          });
          wordObj.text = wordObj.chars.map((x) => x.text).join('');
        }
      }
    }
  }

  // Split superscripts into separate words, and enable 'super' as word style for superscripts.
  // Tesseract may not split superscript footnote references into separate words, so that happens here.
  for (const lineObj of pageObj.lines) {
    for (let i = 0; i < lineObj.words.length; i++) {
      const wordObj = lineObj.words[i];
      // Skip for non-Latin languages, and when no character-level data exists.
      if (['chi_sim', 'chi_tra'].includes(wordObj.lang) || !wordObj.chars || wordObj.chars.length === 0) continue;

      // Check if any superscript is possible (word ends in number).
      const trailingNumStr = wordObj.text.match(/\d+$/)?.[0];
      if (!trailingNumStr) continue;

      // Adjust box such that top/bottom approximate those coordinates at the leftmost point
      const lineboxAdj = { ...lineObj.bbox };

      if (lineObj.baseline[0] < 0) {
        lineboxAdj.top -= (lineboxAdj.right - lineboxAdj.left) * lineObj.baseline[0];
      } else {
        lineboxAdj.bottom -= (lineboxAdj.right - lineboxAdj.left) * lineObj.baseline[0];
      }

      // Baseline point at leftmost point of the line
      const baselinePointAdj = lineObj.baseline[0] < 0 ? lineObj.baseline[1] : lineObj.baseline[1] + (lineObj.bbox.bottom - lineboxAdj.bottom);

      const expectedBaseline = (wordObj.bbox.left + (wordObj.bbox.right - wordObj.bbox.left) / 2 - lineboxAdj.left) * lineObj.baseline[0] + baselinePointAdj + lineboxAdj.bottom;
      const lineAscHeight = expectedBaseline - lineboxAdj.top;

      let baseN = 0;
      for (let j = wordObj.chars.length - 1; j >= 0; j--) {
        const charObj = wordObj.chars[j];
        if (charObj.bbox.bottom < expectedBaseline - lineAscHeight / 4) {
          baseN++;
        } else {
          break;
        }
      }

      const superN = Math.min(trailingNumStr.length, baseN);

      // If no superscript is possible, skip.
      if (superN === 0) continue;

      // If the entire word is a superscript, it does not need to be split.
      if (superN === wordObj.text.length) {
        wordObj.sup = true;
        wordObj.style = 'normal';
        continue;
      }

      // Otherwise, split the word into two words, with the second word being the superscript.
      const wordObjSup = ocr.cloneWord(wordObj);

      const charCoreArr = wordObj.chars.slice(0, wordObj.chars.length - superN);
      // Use cloned characters to avoid issues with character objects being shared in multiple words.
      // We know `wordObjSup.chars` exists as we already checked that `wordObj.chars` exists.
      const wordObjSupChars = /** @type {OcrChar[]} */ (wordObjSup.chars);

      const charSuperArr = wordObjSupChars.slice(wordObj.chars.length - superN, wordObj.chars.length);
      const textCore = charCoreArr.map((x) => x.text).join('');
      const textSuper = charSuperArr.map((x) => x.text).join('');

      // const wordObjSup = ocr.cloneWord(wordObj);

      wordObjSup.text = textSuper;
      wordObjSup.chars = charSuperArr;
      wordObjSup.style = 'normal';
      wordObjSup.sup = true;
      wordObjSup.id = `${wordObj.id}a`;
      ocr.calcWordBbox(wordObjSup);

      wordObj.text = textCore;
      wordObj.chars = charCoreArr;
      ocr.calcWordBbox(wordObj);

      lineObj.words.splice(i + 1, 0, wordObjSup);
      i++;
    }
  }
}

/**
 * Pass 3 iterates over all words/letters in the OCR object, calculating statistics and applying corrections.
 * All OCR objects (Tesseract/Abbyy/Stext) should be run through this function before returning.
 * Returns a set containing all languages detected in the OCR object.
 *
 * @param {OcrPage} pageObj - Page object to apply corrections to. Edited in place.
 */
export function pass3(pageObj) {
  /** @type {Set<string>} */
  const langSet = new Set();

  // Calculate page angle, if not already set to non-zero value.
  // If a page angle is already defined, that indicates that angle was already detected and rotation was applied in pre-processing,
  // so that should not be overwritten here (as the number would not be accurate).
  if (!pageObj.angle) {
    const angleRisePage = [];
    for (const lineObj of pageObj.lines) {
      // Only calculate baselines from lines 200px+.
      // This avoids short "lines" (e.g. page numbers) that often report wild values.
      if ((lineObj.bbox.right - lineObj.bbox.left) >= 200) {
        angleRisePage.push(lineObj.baseline[0]);
      }
    }

    const angleRiseMedian = mean50(angleRisePage) || 0;
    pageObj.angle = Math.asin(angleRiseMedian) * (180 / Math.PI);
  }

  // Loop over all glyphs, calculating statistics and applying corrections.
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

      langSet.add(wordObj.lang);

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
      if (['"', "'"].includes(letterArr[letterArr.length - 1]) && /[a-z\d][.,!?;]?['"]$/i.test(wordObj.text)) {
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

    // If ascHeight and xHeight are both known, however one is clearly wrong, delete whichever has fewer observations.
    // This commonly comes up when a line has >90% numbers, however a few (potentially misidentified) lowercase letters are present.
    // Additionally, this deletes the values that Tesseract makes up when it does not have enough data to calculate them.
    // For example, Tesseract will still report xHeight for a line that only contains capital letters.
    if (lineObj.ascHeight && lineObj.xHeight && lineObj.xHeight >= lineObj.ascHeight * 0.9) {
      if (lineAscHeightArr.length > lineXHeightArr.length) {
        lineObj.xHeight = null;
      } else {
        lineObj.ascHeight = null;
      }
    }

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
        // This adjustment requires line-level metrics to be correct, so skip in cases where the dash is (basically) the only thing on the line.
        const enoughInfo = letterArr.length > 2 || wordObj.line.words.length > 2;
        if (['-', '–', '—', '¬'].includes(letterArr[k]) && enoughInfo) {
          let charWidth = charObjArr[k].bbox.right - charObjArr[k].bbox.left;

          // If the gap between the previous character and next character is shorter than the supposed width of the dash character, use that width instead.
          // This should never occur in valid data, however can happen for Tesseract LSTM, which frequently gets character-level bounding boxes wrong.
          // When there is no next character, the right edge of the word is used instead. Word bounds are more reliable than intra-word character bounds for LSTM,
          // so the right bound of the dash should only be used in the case when it is the last character.
          if (charObjArr[k - 1]) {
            const rightBound = charObjArr[k + 1] ? charObjArr[k + 1].bbox.left : charObjArr[k].bbox.right;
            const charWidth2 = rightBound - charObjArr[k - 1].bbox.right;
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
      // Stylistic ligatures are replaced with their component letters.
      // This occurs because ligatures are added dynamically when the text is rendered, and the OCR data is assumed to not contain them.
      // Some fonts do not include stylistic ligatures, and whether they are used or not is a matter of font optimization,
      // as stylistic ligatures do not change the meaning of the text.
      wordObj.text = ocr.replaceLigatures(letterArr.join(''));
    }
  }

  return langSet;
}
