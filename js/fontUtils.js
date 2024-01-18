// This file contains utility functions for calculating statistics using Opentype.js font objects.
// The only import/dependency this file should have (aside from importing misc utility functions) should be fontObjects.js.

import { getPrevLine } from './objects/ocrObjects.js';

/**
 * Calculates font size by comparing provided character height to font metrics.
 *
 * @param {fontContainerFont} font
 * @param {number} charHeightActual - Actual, measured height of character in pixels.
 * @param {string} [compChar='o'] - Character to compare `charHeightActual` against (default is 'o').
 * @returns {Promise<number>} A promise that resolves to the calculated font size.
 *
 * Note: The default value "o" corresponds to the x-height stat better than "x" does.
 */
async function getFontSize(font, charHeightActual, compChar = 'o') {
  const fontOpentypeI = await font.opentype;

  const charMetrics = fontOpentypeI.charToGlyph(compChar).getMetrics();
  const charHeight = (charMetrics.yMax - charMetrics.yMin) * (1 / fontOpentypeI.unitsPerEm);

  return Math.round(charHeightActual / charHeight);
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
 * @param {fontContainerFont} font
 * @param {number} fontSize
 * @async
 * @return {Promise<WordMetrics>}
 */
export async function calcWordMetrics(wordText, font, fontSize) {
  // // Calculate font glyph metrics for precise positioning
  const fontOpentypeI = await font.opentype;

  let wordWidth1 = 0;
  const wordTextArr = wordText.split('');
  for (let i = 0; i < wordTextArr.length; i++) {
    const charI = wordTextArr[i];
    const charJ = wordTextArr[i + 1];
    const glyphI = fontOpentypeI.charToGlyph(charI);
    if (glyphI.name == '.notdef') console.log(`Character ${charI} is not defined in font ${font.family} ${font.style}`);
    wordWidth1 += glyphI.advanceWidth;
    if (charJ) wordWidth1 += fontOpentypeI.getKerningValue(glyphI, fontOpentypeI.charToGlyph(charJ));
  }

  const wordLastGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing;
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing;

  const wordWidthPx = (wordWidth1 - wordRightBearing - wordLeftBearing) * (fontSize / fontOpentypeI.unitsPerEm);
  const wordLeftBearingPx = wordLeftBearing * (fontSize / fontOpentypeI.unitsPerEm);
  const wordRightBearingPx = wordRightBearing * (fontSize / fontOpentypeI.unitsPerEm);

  return { visualWidth: wordWidthPx, leftSideBearing: wordLeftBearingPx, rightSideBearing: wordRightBearingPx };
}

/**
 * Calculates char spacing required for the specified word to be rendered at specified width.
 *
 * @param {string} wordText -
 * @param {fontContainerFont} font
 * @param {number} fontSize -
 * @param {number} actualWidth - The actual width the word should be scaled to
 */
export async function calcCharSpacing(wordText, font, fontSize, actualWidth) {
  if (wordText.length < 2) return 0;

  const wordWidth = (await calcWordMetrics(wordText, font, fontSize)).visualWidth;

  const charSpacing = Math.round((actualWidth - wordWidth) / (wordText.length - 1) * 1e6) / 1e6;

  return charSpacing;
}

/**
 * Calculate font size for word.
 * Returns null for any word where the default size for the line should be used.
 * This function differs from accessing the `word.font` property in that
 * @param {ocrWord} word
 * @param {fontContainerAll} fontContainer
 */
export const calcWordFontSize = async (word, fontContainer) => {
  // TODO: Figure out how to get types to work with this
  const font = fontContainer[word.font || globalSettings.defaultFont].normal;

  // If the user manually set a size, then use that
  if (word.size) {
    return word.size;
  // If the word is a superscript, then font size is uniquely calculated for this word
  } if (word.sup) {
    return await getFontSize(font, word.bbox[3] - word.bbox[1], 'A');
  // If the word is a dropcap, then font size is uniquely calculated for this word
  } if (word.dropcap) {
    return await getFontSize(font, word.bbox[3] - word.bbox[1], word.text.slice(0, 1));
  // Otherwise, the line font size is used
  }
  return await calcLineFontSize(word.line, fontContainer);
};

// Font size, unlike other characteristics (e.g. bbox and baseline), does not come purely from pixels on the input image.
// This is because different fonts will create different sized characters even when the nominal "font size" is identical.
// Therefore, the appropriate font size must be calculated using (1) the character stats from the input image and
// (2) stats regarding the font being used.
/**
* Get or calculate font size for line.
* This value will either be (1) a manually set value or (2) a value calculated using line metrics.
* @param {ocrLine} line
 * @param {fontContainerAll} fontContainer
*/
export const calcLineFontSize = async (line, fontContainer) => {
  if (line._size) return line._size;

  // TODO: Add back cache when there are also functions that clear cache at appropriate times.
  // if (line._sizeCalc) return line._sizeCalc;

  // The font of the first word is used (if present), otherwise the default font is used.
  const font = fontContainer[line.words[0]?.font || globalSettings.defaultFont].normal;

  // If both ascender height and x-height height are known, calculate the font size using both and average them.
  if (line.ascHeight && line.xHeight) {
    const size1 = await getFontSize(font, line.ascHeight, 'A');
    const size2 = await getFontSize(font, line.xHeight, 'o');
    let sizeFinal = Math.floor((size1 + size2) / 2);

    // Averaging `size1` and `size2` is intended to smooth out small differences in calculation error.
    // However, in some cases `size1` and `size2` are so different that one is clearly wrong.
    // In this case, the font size for the previous line is calculated,
    // and averaged with whichever of `size1` and `size2` are closer.
    if (Math.max(size1, size2) / Math.min(size1, size2) > 1.2) {
      const linePrev = getPrevLine(line);
      if (linePrev) {
        const sizeLast = await calcLineFontSize(linePrev, fontContainer);
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
    line._sizeCalc = await getFontSize(font, line.xHeight, 'o');
  // If only ascender height is known, calculate font size using ascender height.
  } else if (line.ascHeight && !line.xHeight) {
    line._sizeCalc = await getFontSize(font, line.ascHeight, 'A');
  } else {
    // If no font metrics are known, use the font size from the previous line.
    const linePrev = getPrevLine(line);
    if (linePrev) {
      line._sizeCalc = await calcLineFontSize(linePrev, fontContainer);
    // If there is no previous line, as a last resort, use a hard-coded default value.
    } else {
      line._sizeCalc = 15;
    }
  }

  return line._sizeCalc;
};
