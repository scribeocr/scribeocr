// This file contains utility functions for calculating statistics using Opentype.js font objects.
// The only import/dependency this file should have (aside from importing misc utility functions) should be fontObjects.js.

import { getPrevLine } from './objects/ocrObjects.js';
import { quantile } from './miscUtils.js';
import { fontAll } from './containers/fontContainer.js';

import opentype from '../lib/opentype.module.min.js';

/**
 *
 * @param {import('opentype.js').Font} font
 * @param {Array<string>} charArr
 * @returns
 */
export async function subsetFont(font, charArr = []) {
  const glyphs = [];

  // Add the notdef glyph at the start of the subset.
  glyphs.push(font.glyphs.get(0));

  // Always add the space character.
  // The PDF writer may use space characters for spacing purposes,
  // even if no literal space characters are in the data.
  if (!charArr.includes(' ')) glyphs.push(font.charToGlyph(' '));

  charArr.forEach((x) => {
    const glyph = font.charToGlyph(x);
    if (glyph) glyphs.push(glyph);
  });

  // The relevant table is sometimes but not always in a property named `windows`.
  const namesTable = font.names.windows || font.names;

  // Create a new font with the subsetted glyphs.
  const subset = new opentype.Font({
    familyName: namesTable.postScriptName.en,
    styleName: namesTable.fontSubfamily.en,
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    glyphs,
  });

  return subset;
}

/**
 * Calculates font size by comparing provided character height to font metrics.
 *
 * @param {import('opentype.js').Font} fontOpentype
 * @param {number} heightActual - Actual, measured height of text in pixels.
 * @param {string} text - Text to compare `heightActual` against.
 *
 * Note: When calculating font size from x-height, `text` should be set to "o" rather than "x".
 * Despite the name, what Tesseract (and this application) are actually calculating is closer to "o" than "x".
 */
function getFontSize(fontOpentype, heightActual, text) {
  const textArr = text.split('');
  const charMetricsFirst = fontOpentype.charToGlyph(textArr[0]).getMetrics();
  let yMin = charMetricsFirst.yMin;
  let yMax = charMetricsFirst.yMax;

  for (let i = 1; i < textArr.length; i++) {
    const charMetrics = fontOpentype.charToGlyph(textArr[i]).getMetrics();
    if (charMetrics.yMin < yMin) yMin = charMetrics.yMin;
    if (charMetrics.yMax > yMax) yMax = charMetrics.yMax;
  }

  const textHeight = (yMax - yMin) * (1 / fontOpentype.unitsPerEm);

  return Math.round(heightActual / textHeight);
}

/**
 * Calculates font size for an array of words using the most granular bounding box available (character or word-level) rather than using line-level metrics.
 * @param {Array<OcrWord>} wordArr
 * @param {import('opentype.js').Font} fontOpentype
 * @param {Boolean} [nonLatin=false]
 *
 */
function calcWordFontSizePrecise(wordArr, fontOpentype, nonLatin = false) {
  if (wordArr[0].chars && wordArr[0].chars.length > 0) {
    const charArr = wordArr.map((x) => x.chars).flat();
    const charArrFiltered = nonLatin ? charArr.filter((x) => x && (x.bbox.bottom - x.bbox.top) > 5) : charArr.filter((x) => x && /[A-Za-z0-9]/.test(x.text));
    const fontSizeCharArr = charArrFiltered.map((x) => getFontSize(fontOpentype, x.bbox.bottom - x.bbox.top, x.text));
    const fontSizeCharMedian = quantile(fontSizeCharArr, 0.5);
    return fontSizeCharMedian;
  }

  const wordArrFiltered = nonLatin ? wordArr.filter((x) => x && (x.bbox.bottom - x.bbox.top) > 5) : wordArr.filter((x) => x && /[A-Za-z0-9]/.test(x.text));
  const fontSizeWordArr = wordArrFiltered.map((x) => getFontSize(fontOpentype, x.bbox.bottom - x.bbox.top, x.text));
  const fontSizeWordMedian = quantile(fontSizeWordArr, 0.5);
  return fontSizeWordMedian;
}

/**
 * Adds ligatures if they exist in the font.
 *
 * @param {Array<string>|string} wordText
 * @param {opentype.Font} fontOpentype
 */
export function addLigatures(wordText, fontOpentype) {
  const wordTextArr = typeof wordText === 'string' ? wordText.split('') : wordText;
  const wordCharArrOut = [];

  for (let i = 0; i < wordTextArr.length; i++) {
    const charI = wordTextArr[i];
    const charJ = wordTextArr[i + 1];

    if (charI === 'f' && charJ) {
      let charLig;
      if (charJ === 'f') {
        charLig = String.fromCharCode(64256);
      } else if (charJ === 'i') {
        charLig = String.fromCharCode(64257);
      } else if (charJ === 'l') {
        charLig = String.fromCharCode(64258);
      }
      if (charLig) {
        const glyphLig = fontOpentype.charToGlyph(charLig);
        if (glyphLig && glyphLig.name !== '.notdef') {
          wordCharArrOut.push(charLig);
          i++;
          continue;
        }
      }
    }

    wordCharArrOut.push(charI);
  }

  return wordCharArrOut;
}

/**
 * Calculates array of advance widths and kerning values for a word.
 * Numbers are in font units. Ligatures should have been added prior to this step.
 *
 * @param {Array<string>|string} wordText
 * @param {opentype.Font} fontOpentype
 */
function calcWordCharMetrics(wordText, fontOpentype) {
  const wordTextArr = typeof wordText === 'string' ? wordText.split('') : wordText;

  /** @type {Array<number>} */
  const advanceArr = [];
  /** @type {Array<number>} */
  const kerningArr = [];
  for (let i = 0; i < wordTextArr.length; i++) {
    const charI = wordTextArr[i];
    const charJ = wordTextArr[i + 1];
    const glyphI = fontOpentype.charToGlyph(charI);
    if (!glyphI || glyphI.name === '.notdef') console.log(`Character ${charI} is not defined in font ${fontOpentype.tables.name.fontFamily.en} ${fontOpentype.tables.name.fontSubfamily.en}`);
    advanceArr.push(glyphI.advanceWidth);

    if (charJ) {
      const glyphJ = fontOpentype.charToGlyph(charJ);
      const kerning = fontOpentype.getKerningValue(glyphI, glyphJ);
      kerningArr.push(kerning);
    }
  }

  return { advanceArr, kerningArr };
}

/**
 * @typedef WordMetrics
 * @type {object}
 * @property {Array<string>} charArr
 * @property {number} visualWidth - Width of printed characters in px (does not include left/right bearings).
 * @property {number} leftSideBearing - Width of left bearing in px.
 * @property {number} rightSideBearing - Width of right bearing in px.
 * @property {Array<number>} advanceArr - Array of advance widths for each character in the word in px.
 * @property {Array<number>} kerningArr - Array of kerning values for each character pair in the word in px.
 * @property {number} charSpacing - Character spacing in px.
 * @property {number} fontSize
 */
/**
 * @param {OcrWord} word
 * @param {number} [angle=0] - Angle of page rotation in degrees, used to calculate character spacing.
 *    This is only used during the PDF export, when the rotation is applied by a matrix transformation,
 *    so the text always needs to be printed as if it were horizontal.
 * @async
 * @return {WordMetrics}
 */
export function calcWordMetrics(word, angle = 0) {
  const fontI = fontAll.getWordFont(word);
  const fontOpentype = fontI.opentype;

  const fontSize = calcWordFontSize(word);

  const charArr = addLigatures(word.text, fontOpentype);

  const { advanceArr, kerningArr } = calcWordCharMetrics(charArr, fontOpentype);

  const advanceTotal = advanceArr.reduce((a, b) => a + b, 0);
  const kerningTotal = kerningArr.reduce((a, b) => a + b, 0);

  const wordWidth1 = advanceTotal + kerningTotal;

  const wordLastGlyphMetrics = fontOpentype.charToGlyph(charArr.at(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontOpentype.charToGlyph(charArr[0]).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing || 0;
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing || 0;

  const wordWidthPx = (wordWidth1 - wordRightBearing - wordLeftBearing) * (fontSize / fontOpentype.unitsPerEm);
  const wordLeftBearingPx = wordLeftBearing * (fontSize / fontOpentype.unitsPerEm);
  const wordRightBearingPx = wordRightBearing * (fontSize / fontOpentype.unitsPerEm);

  const advanceArrPx = advanceArr.map((x) => x * (fontSize / fontOpentype.unitsPerEm));
  const kerningArrPx = kerningArr.map((x) => x * (fontSize / fontOpentype.unitsPerEm));

  let charSpacing = 0;
  if (charArr.length > 1) {
    const cosAngle = Math.cos(angle * (Math.PI / 180));
    const actualWidth = (word.bbox.right - word.bbox.left) / cosAngle;
    charSpacing = Math.round((actualWidth - wordWidthPx) / (charArr.length - 1) * 1e6) / 1e6;
  }

  return {
    visualWidth: wordWidthPx, leftSideBearing: wordLeftBearingPx, rightSideBearing: wordRightBearingPx, advanceArr: advanceArrPx, kerningArr: kerningArrPx, charSpacing, fontSize, charArr,
  };
}

/**
 * Calculate font size for word.
 * The value will be one of:
 * (1) a manually-set value for that word,
 * (2) a calculated value for superscript/dropcap words,
 * (3) the line font size,
 * (4) a hard-coded default value.
 * @param {OcrWord} word
 */
export const calcWordFontSize = (word) => {
  const font = fontAll.getWordFont(word);
  const fontOpentype = font.opentype;

  // If the user manually set a size, then use that
  if (word.size) {
    return word.size;
  // If the word is a superscript, then font size is uniquely calculated for this word
  } if (word.sup || word.dropcap) {
    return getFontSize(fontOpentype, word.bbox.bottom - word.bbox.top, word.text);
  // If the word is a dropcap, then font size is uniquely calculated for this word
  }
  const lineFontSize = calcLineFontSize(word.line);

  if (lineFontSize) return lineFontSize;

  return 12;
};

// Font size, unlike other characteristics (e.g. bbox and baseline), does not come purely from pixels on the input image.
// This is because different fonts will create different sized characters even when the nominal "font size" is identical.
// Therefore, the appropriate font size must be calculated using (1) the character stats from the input image and
// (2) stats regarding the font being used.
/**
* Get or calculate font size for line.
* This value will either be (1) a manually set value or (2) a value calculated using line metrics.
* @param {OcrLine} line
* @returns {number}
*/
export const calcLineFontSize = (line) => {
  if (line._size) return line._size;

  // TODO: Add back cache when there are also functions that clear cache at appropriate times.
  // if (line._sizeCalc) return line._sizeCalc;

  // const anyChinese = line.words.filter((x) => x.lang === 'chi_sim').length > 0;

  const nonLatin = line.words[0]?.lang === 'chi_sim';

  const font = fontAll.getWordFont(line.words[0]);

  // This condition should be handled even if not expected to occur,
  // as some fonts (Chinese) are not loaded synchronously with the main application,
  // and not finding a font should not result in a crash.
  if (!font) {
    // If no font metrics are known, use the font size from the previous line.
    const linePrev = getPrevLine(line);
    if (linePrev) {
      line._sizeCalc = calcLineFontSize(linePrev);
    // If there is no previous line, as a last resort, use a hard-coded default value.
    } else {
      line._sizeCalc = 15;
    }
    return line._sizeCalc;
  }

  const fontOpentype = font.opentype;

  // Aggregate line-level metrics are unlikely to be correct for short lines (if character data is available), so calculate the size precisely.
  // This method is always used for non-Latin scripts, as the ascender/descender metrics make little sense in that context.
  if ((line.words.length <= 3 && line.words[0].chars && line.words[0].chars.length > 0) || nonLatin) {
    const fontSizeCalc = calcWordFontSizePrecise(line.words, fontOpentype, nonLatin);
    if (fontSizeCalc) {
      line._sizeCalc = fontSizeCalc;
      return line._sizeCalc;
    }
  }

  // If both ascender height and x-height height are known, calculate the font size using both and average them.
  if (line.ascHeight && line.xHeight) {
    const size1 = getFontSize(fontOpentype, line.ascHeight, 'A');
    const size2 = getFontSize(fontOpentype, line.xHeight, 'o');
    let sizeFinal = Math.floor((size1 + size2) / 2);

    // Averaging `size1` and `size2` is intended to smooth out small differences in calculation error.
    // However, in some cases `size1` and `size2` are so different that one is clearly wrong.
    // If `size1` and `size2` are significantly different, however one is closer to the font size of the previous line,
    // then the size of the previous line is used for averaging instead.
    if (Math.max(size1, size2) / Math.min(size1, size2) > 1.2) {
      const linePrev = getPrevLine(line);
      if (linePrev) {
        const sizeLast = calcLineFontSize(linePrev);
        if (sizeLast && (Math.max(size1, sizeLast) / Math.min(size1, sizeLast) <= 1.2 || Math.max(sizeLast, size2) / Math.min(sizeLast, size2) <= 1.2)) {
          if (Math.abs(sizeLast - size2) < Math.abs(sizeLast - size1)) {
            sizeFinal = Math.floor((sizeLast + size2) / 2);
          } else {
            sizeFinal = Math.floor((sizeLast + size1) / 2);
          }
        }
      }
    }

    line._sizeCalc = sizeFinal;
  // If only x-height is known, calculate font size using x-height.
  } else if (!line.ascHeight && line.xHeight) {
    line._sizeCalc = getFontSize(fontOpentype, line.xHeight, 'o');
  // If only ascender height is known, calculate font size using ascender height.
  } else if (line.ascHeight && !line.xHeight) {
    line._sizeCalc = getFontSize(fontOpentype, line.ascHeight, 'A');
  } else {
    // If no font metrics are known, use the font size from the previous line.
    const linePrev = getPrevLine(line);
    if (linePrev) {
      line._sizeCalc = calcLineFontSize(linePrev);
    // If there is no previous line, as a last resort, use a hard-coded default value.
    } else {
      line._sizeCalc = 15;
    }
  }

  return line._sizeCalc;
};
