// This file contains utility functions for calculating statistics using Opentype.js font objects.
// The only import/dependency this file should have (aside from importing misc utility functions) should be fontObjects.js.

import { getPrevLine } from './objects/ocrObjects.js';
import { quantile } from './miscUtils.js';
import { fontAll } from './fontContainer.js';

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
 * @returns {Promise<number>} A promise that resolves to the calculated font size.
 *
 * Note: When calculating font size from x-height, `text` should be set to "o" rather than "x".
 * Despite the name, what Tesseract (and this application) are actually calculating is closer to "o" than "x".
 */
async function getFontSize(fontOpentype, heightActual, text) {
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
 * @returns {Promise<number|null>} A promise that resolves to the calculated font size.
 *
 */
async function calcWordFontSizePrecise(wordArr, fontOpentype, nonLatin = false) {
  if (wordArr[0].chars && wordArr[0].chars.length > 0) {
    const charArr = wordArr.map((x) => x.chars).flat();
    const charArrFiltered = nonLatin ? charArr.filter((x) => x && (x.bbox.bottom - x.bbox.top) > 5) : charArr.filter((x) => x && /[A-Za-z0-9]/.test(x.text));
    const fontSizeCharArr = await Promise.all(charArrFiltered.map((x) => getFontSize(fontOpentype, x.bbox.bottom - x.bbox.top, x.text)));
    const fontSizeCharMedian = quantile(fontSizeCharArr, 0.5);
    return fontSizeCharMedian;
  }

  const wordArrFiltered = nonLatin ? wordArr.filter((x) => x && (x.bbox.bottom - x.bbox.top) > 5) : wordArr.filter((x) => x && /[A-Za-z0-9]/.test(x.text));
  const fontSizeWordArr = await Promise.all(wordArrFiltered.map((x) => getFontSize(fontOpentype, x.bbox.bottom - x.bbox.top, x.text)));
  const fontSizeWordMedian = quantile(fontSizeWordArr, 0.5);
  return fontSizeWordMedian;
}

/**
 * @typedef WordMetrics
 * @type {object}
 * @property {number} visualWidth - Width of printed characters in px (does not include left/right bearings).
 * @property {number} leftSideBearing - Width of left bearing in px.
 * @property {number} rightSideBearing - Width of right bearing in px.
 */
/**
 * @param {string} wordText
 * @param {import('opentype.js').Font} fontOpentype
 * @param {number} fontSize
 * @async
 * @return {Promise<WordMetrics>}
 */
export async function calcWordMetrics(wordText, fontOpentype, fontSize) {
  let wordWidth1 = 0;
  const wordTextArr = wordText.split('');
  for (let i = 0; i < wordTextArr.length; i++) {
    const charI = wordTextArr[i];
    const charJ = wordTextArr[i + 1];
    const glyphI = fontOpentype.charToGlyph(charI);
    if (glyphI.name === '.notdef') console.log(`Character ${charI} is not defined in font ${fontOpentype.tables.name.fontFamily.en} ${fontOpentype.tables.name.fontSubfamily.en}`);
    wordWidth1 += glyphI.advanceWidth;
    if (charJ) wordWidth1 += fontOpentype.getKerningValue(glyphI, fontOpentype.charToGlyph(charJ));
  }

  const wordLastGlyphMetrics = fontOpentype.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontOpentype.charToGlyph(wordText.substr(0, 1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing;
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing;

  const wordWidthPx = (wordWidth1 - wordRightBearing - wordLeftBearing) * (fontSize / fontOpentype.unitsPerEm);
  const wordLeftBearingPx = wordLeftBearing * (fontSize / fontOpentype.unitsPerEm);
  const wordRightBearingPx = wordRightBearing * (fontSize / fontOpentype.unitsPerEm);

  return { visualWidth: wordWidthPx, leftSideBearing: wordLeftBearingPx, rightSideBearing: wordRightBearingPx };
}

/**
 * Calculates char spacing required for the specified word to be rendered at specified width.
 *
 * @param {string} wordText -
 * @param {import('opentype.js').Font} fontOpentype
 * @param {number} fontSize -
 * @param {number} actualWidth - The actual width the word should be scaled to
 */
export async function calcCharSpacing(wordText, fontOpentype, fontSize, actualWidth) {
  if (wordText.length < 2) return 0;

  const wordWidth = (await calcWordMetrics(wordText, fontOpentype, fontSize)).visualWidth;

  const charSpacing = Math.round((actualWidth - wordWidth) / (wordText.length - 1) * 1e6) / 1e6;

  return charSpacing;
}

/**
 * Calculate font size for word.
 * Returns null for any word where the default size for the line should be used.
 * This function differs from accessing the `word.font` property in that
 * @param {OcrWord} word
 */
export const calcWordFontSize = async (word) => {
  // TODO: Figure out how to get types to work with this
  /** @type {FontContainerFont} */
  const font = fontAll.active[word.font || globalSettings.defaultFont].normal;
  const fontOpentype = await font.opentype;

  // If the user manually set a size, then use that
  if (word.size) {
    return word.size;
  // If the word is a superscript, then font size is uniquely calculated for this word
  } if (word.sup || word.dropcap) {
    return await getFontSize(fontOpentype, word.bbox.bottom - word.bbox.top, word.text);
  // If the word is a dropcap, then font size is uniquely calculated for this word
  }
  return await calcLineFontSize(word.line);
};

// Font size, unlike other characteristics (e.g. bbox and baseline), does not come purely from pixels on the input image.
// This is because different fonts will create different sized characters even when the nominal "font size" is identical.
// Therefore, the appropriate font size must be calculated using (1) the character stats from the input image and
// (2) stats regarding the font being used.
/**
* Get or calculate font size for line.
* This value will either be (1) a manually set value or (2) a value calculated using line metrics.
* @param {OcrLine} line
*/
export const calcLineFontSize = async (line) => {
  if (line._size) return line._size;

  // TODO: Add back cache when there are also functions that clear cache at appropriate times.
  // if (line._sizeCalc) return line._sizeCalc;

  // const anyChinese = line.words.filter((x) => x.lang === 'chi_sim').length > 0;

  const nonLatin = line.words[0]?.lang === 'chi_sim';

  // The font of the first word is used (if present), otherwise the default font is used.
  /** @type {FontContainerFont} */
  const font = nonLatin ? fontAll.supp.chi_sim : fontAll.active[line.words[0]?.font || globalSettings.defaultFont].normal;

  // This condition should be handled even if not expected to occur,
  // as some fonts (Chinese) are not loaded synchronously with the main application,
  // and not finding a font should not result in a crash.
  if (!font) {
    // If no font metrics are known, use the font size from the previous line.
    const linePrev = getPrevLine(line);
    if (linePrev) {
      line._sizeCalc = await calcLineFontSize(linePrev);
    // If there is no previous line, as a last resort, use a hard-coded default value.
    } else {
      line._sizeCalc = 15;
    }
    return line._sizeCalc;
  }

  const fontOpentype = await font.opentype;

  // Aggregate line-level metrics are unlikely to be correct for short lines, so calculate the size precisely.
  // This method is always used for non-Latin scripts, as the ascender/descender metrics make little sense in that context.
  if (line.words.length <= 3 || nonLatin) {
    const fontSizeCalc = await calcWordFontSizePrecise(line.words, fontOpentype, nonLatin);
    if (fontSizeCalc) {
      line._sizeCalc = fontSizeCalc;
      return line._sizeCalc;
    }
  }

  // If both ascender height and x-height height are known, calculate the font size using both and average them.
  if (line.ascHeight && line.xHeight) {
    const size1 = await getFontSize(fontOpentype, line.ascHeight, 'A');
    const size2 = await getFontSize(fontOpentype, line.xHeight, 'o');
    let sizeFinal = Math.floor((size1 + size2) / 2);

    // Averaging `size1` and `size2` is intended to smooth out small differences in calculation error.
    // However, in some cases `size1` and `size2` are so different that one is clearly wrong.
    // In this case, the font size for the previous line is calculated,
    // and averaged with whichever of `size1` and `size2` are closer.
    if (Math.max(size1, size2) / Math.min(size1, size2) > 1.2) {
      const linePrev = getPrevLine(line);
      if (linePrev) {
        const sizeLast = await calcLineFontSize(linePrev);
        if (Math.abs(sizeLast - size2) < Math.abs(sizeLast - size1)) {
          sizeFinal = Math.floor((sizeLast + size2) / 2);
        } else {
          sizeFinal = Math.floor((sizeLast + size1) / 2);
        }
      }
    }

    line._sizeCalc = sizeFinal;
  // If only x-height is known, calculate font size using x-height.
  } else if (!line.ascHeight && line.xHeight) {
    line._sizeCalc = await getFontSize(fontOpentype, line.xHeight, 'o');
  // If only ascender height is known, calculate font size using ascender height.
  } else if (line.ascHeight && !line.xHeight) {
    line._sizeCalc = await getFontSize(fontOpentype, line.ascHeight, 'A');
  } else {
    // If no font metrics are known, use the font size from the previous line.
    const linePrev = getPrevLine(line);
    if (linePrev) {
      line._sizeCalc = await calcLineFontSize(linePrev);
    // If there is no previous line, as a last resort, use a hard-coded default value.
    } else {
      line._sizeCalc = 15;
    }
  }

  return line._sizeCalc;
};
