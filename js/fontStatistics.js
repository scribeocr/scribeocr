// File summary:
// Functions to calculate font metrics and generate new fonts.

import {
  determineSansSerif,
  quantile,
  replaceObjectProperties,
  round6,
} from './utils/miscUtils.js';

import { FontMetricsFamily, FontMetricsFont, FontMetricsRawFamily } from './objects/fontMetricsObjects.js';

import { fontMetricsObj } from './containers/miscContainer.js';

// import { glyphAlts } from "../fonts/glyphs.js";

/** @type {Array<Object.<string, string>>} */
globalThis.convertPageWarn = [];

/**
 * Display warning/error message to user if missing character-level data.
 *
 * @param {Array<Object.<string, string>>} warnArr - Array of objects containing warning/error messages from convertPage
 * @param {function(string, boolean=): void} errorFunc - Function used to throw warning/error message.
 */
export function checkCharWarn(warnArr, errorFunc) {
  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.

  const charErrorCt = warnArr.filter((x) => x?.char === 'char_error').length;
  const charWarnCt = warnArr.filter((x) => x?.char === 'char_warning').length;
  const charGoodCt = warnArr.length - charErrorCt - charWarnCt;

  const browserMode = typeof process === 'undefined';

  // The UI warning/error messages cannot be thrown within this function,
  // as that would make this file break when imported into contexts that do not have the main UI.
  if (charGoodCt === 0 && charErrorCt > 0) {
    if (browserMode) {
      const errorHTML = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
      <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      errorFunc(errorHTML);
    } else {
      const errorText = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
      See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      errorFunc(errorText);
    }
  } if (charGoodCt === 0 && charWarnCt > 0) {
    if (browserMode) {
      const warningHTML = `No character-level OCR data detected. Font optimization features will be disabled. 
      <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      errorFunc(warningHTML, false);
    } else {
      const errorText = `No character-level OCR data detected. Font optimization features will be disabled. 
      See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      errorFunc(errorText, false);
    }
  }
}

/**
 * Combine page-level character statistics to calculate overall font metrics.
 * Run after all files (both image and OCR) have been loaded.
 *
 * @param {Array<OcrPage>} pageArr
 */
export function calcFontMetricsFromPages(pageArr) {
  const pageFontMetricsArr = pageArr.map((x) => calcFontMetricsPage(x));

  const fontMetricsRawObj = pageFontMetricsArr.reduce((x, y) => unionFontMetricsRawObj(x, y));

  /** @type {Object.<string, FontMetricsFamily>} */
  let fontMetricsOut = {};

  for (const [family, obj] of Object.entries(fontMetricsRawObj)) {
    fontMetricsOut[family] = new FontMetricsFamily();
    for (const [style, obj2] of Object.entries(obj)) {
      fontMetricsOut[family][style] = calculateFontMetrics(obj2);
      fontMetricsOut[family].obs += fontMetricsOut[family][style].obs;
    }
  }

  fontMetricsOut = identifyFontVariants(globalThis.fontScores, fontMetricsOut);

  if (Object.keys(fontMetricsOut).length > 0) replaceObjectProperties(fontMetricsObj, fontMetricsOut);
}

// The following functions are used for combining an array of page-level fontMetrics objects produced by convertPage.js into a single document-level object.

/**
 * Adds observations from `fontMetricsB` into `fontMetricsA`. Modifies `fontMetricsA` in place.
 *
 * @param {?FontMetricsRawFont} fontMetricsRawFontA
 * @param {?FontMetricsRawFont} fontMetricsRawFontB
 * @param {?number} xHeight - If specified, values from `fontMetricsRawFontB` will be normalized by dividing by `xHeight`.
 * @returns {?FontMetricsRawFont} - Returns fontMetricsFontA after modifying in place
 */
export function unionFontMetricsFont(fontMetricsRawFontA, fontMetricsRawFontB, xHeight = null) {
  // If one of the inputs is undefined, return early with the only valid object
  if (!fontMetricsRawFontA) {
    if (!fontMetricsRawFontB) return null;
    fontMetricsRawFontA = structuredClone(fontMetricsRawFontB);
    return fontMetricsRawFontA;
  }
  if (!fontMetricsRawFontB) {
    return fontMetricsRawFontA;
  }

  if (fontMetricsRawFontB?.obs) fontMetricsRawFontA.obs += fontMetricsRawFontB.obs;

  for (const [prop, obj] of Object.entries(fontMetricsRawFontB)) {
    for (const [key, value] of Object.entries(obj)) {
      if (!fontMetricsRawFontA[prop][key]) {
        fontMetricsRawFontA[prop][key] = [];
      }
      if (xHeight) {
        const valueNorm = value.map((x) => x / xHeight).filter((x) => x);
        Array.prototype.push.apply(fontMetricsRawFontA[prop][key], valueNorm);
      } else {
        Array.prototype.push.apply(fontMetricsRawFontA[prop][key], value);
      }
    }
  }
  return (fontMetricsRawFontA);
}

/**
 * Adds observations from `fontMetricsB` into `fontMetricsA`. Modifies `fontMetricsA` in place.
 *
 * @param {Object.<string, FontMetricsRawFamily>} fontMetricsRawObjA
 * @param {Object.<string, FontMetricsRawFamily>} fontMetricsRawObjB
 * @returns {Object.<string, FontMetricsRawFamily>} - Returns fontMetricsObjA after modifying in place
 */
function unionFontMetricsRawObj(fontMetricsRawObjA, fontMetricsRawObjB) {
  for (const [family, obj] of Object.entries(fontMetricsRawObjB)) {
    for (const [style, obj2] of Object.entries(obj)) {
      if (Object.keys(obj2.width).length === 0) continue;
      if (!fontMetricsRawObjA[family]) {
        fontMetricsRawObjA[family] = new FontMetricsRawFamily();
      }
    }
  }

  for (const [family, obj] of Object.entries(fontMetricsRawObjA)) {
    for (const [style, obj2] of Object.entries(obj)) {
      unionFontMetricsFont(fontMetricsRawObjA?.[family]?.[style], fontMetricsRawObjB?.[family]?.[style]);
    }
  }

  return (fontMetricsRawObjA);
}

/**
 * Calculates final font statistics from individual observations.
 *
 * @param {FontMetricsRawFont} fontMetricsRawFontObj
 * @returns {FontMetricsFont} -
 */
function calculateFontMetrics(fontMetricsRawFontObj) {
  const fontMetricOut = new FontMetricsFont();

  // Take the median of each array
  for (const prop of ['width', 'height', 'kerning', 'kerning2']) {
    for (const [key, value] of Object.entries(fontMetricsRawFontObj[prop])) {
      if (value.length > 0) {
        fontMetricOut[prop][key] = round6(quantile(value, 0.5));
      }
    }
  }

  // Calculate median hight of capital letters only
  const heightCapsArr = [];
  for (const [key, value] of Object.entries(fontMetricsRawFontObj.height)) {
    if (/[A-Z]/.test(String.fromCharCode(parseInt(key)))) {
      Array.prototype.push.apply(heightCapsArr, value);
    }
  }

  fontMetricOut.heightCaps = round6(quantile(heightCapsArr, 0.5));
  fontMetricOut.obsCaps = heightCapsArr.length;

  fontMetricOut.obs = fontMetricsRawFontObj.obs;

  // Standardize all metrics be normalized by x-height
  // The raw metrics may be normalized by ascHeight (for numbers) or x-height (for all other characters).
  for (const prop of ['width', 'height', 'kerning', 'kerning2']) {
    for (const [key, value] of Object.entries(fontMetricsRawFontObj[prop])) {
      const nameFirst = key.match(/\w+/)[0];
      const charFirst = String.fromCharCode(parseInt(nameFirst));
      if (/\d/.test(charFirst)) {
        fontMetricOut[prop][key] *= fontMetricOut.heightCaps;
      }
    }
  }

  // The `kerning2` observations contain the measurement between the end of char 1 and the end of char 2.
  // Therefore, the width of char 2 must be subtracted to get a measurement comparable with `kerning`.
  for (const prop of ['kerning2']) {
    for (const [key, value] of Object.entries(fontMetricsRawFontObj[prop])) {
      if (value.length > 0) {
        const nameSecond = key.match(/\w+$/)[0];

        const widthSecond = fontMetricOut.width[nameSecond];

        fontMetricOut[prop][key] -= widthSecond;
      }
    }
  }

  return (fontMetricOut);
}

// This function is not currently used.
function parseDebugInfo(debugTxt) {
  if (!globalThis.fontScores) globalThis.fontScores = { SerifDefault: {}, SansDefault: {}, Default: {} };

  const fontLines = debugTxt.match(/Modal Font.+/g);

  if (!fontLines) return;

  // Filter statement added as this regex fails for some lines where the "letter" has multiple characters (possibly non-ASCII punctuation)
  const fontArr = fontLines.map((x) => x.match(/Modal Font: ([^;]+?); Letter: (.); Font: ([^;]+?); Score: (\d+)/)).filter((x) => x?.length === 5);

  for (let i = 0; i < fontArr.length; i++) {
    const modalFont = fontArr[i][1];
    const char = fontArr[i][2];
    const font = fontArr[i][3];
    const score = parseInt(fontArr[i][4]);
    const modalFontFamily = determineSansSerif(modalFont);
    const style = /italic/i.test(modalFont) ? 'italic' : 'normal';

    if (!globalThis.fontScores[modalFontFamily][style]) globalThis.fontScores[modalFontFamily][style] = {};
    if (!globalThis.fontScores[modalFontFamily][style][char]) globalThis.fontScores[modalFontFamily][style][char] = {};
    if (!globalThis.fontScores[modalFontFamily][style][char][font]) globalThis.fontScores[modalFontFamily][style][char][font] = 0;

    globalThis.fontScores[modalFontFamily][style][char][font] += score;
  }
}

function calcTopFont(fontScoresChar) {
  if (!fontScoresChar) return '';

  const fonts = Object.keys(fontScoresChar);
  let maxScore = 0;
  let maxScoreFont = '';
  for (let i = 0; i < fonts.length; i++) {
    const font = fonts[i];
    const score = fontScoresChar[font];
    if (score > maxScore) {
      maxScore = score;
      maxScoreFont = font;
    }
  }
  return maxScoreFont;
}

// Sans fonts with "1" without horizontal base: Arial, Helvetica, Impact, Trebuchet.  All serif fonts are included.
const base1Arr = ['Calibri', 'Comic', 'Franklin', 'Tahoma', 'Verdana', 'Baskerville', 'Book', 'Cambria', 'Century_Schoolbook', 'Courier', 'Garamond', 'Georgia', 'Times'];
const base1Regex = new RegExp(base1Arr.reduce((x, y) => `${x}|${y}`), 'i');

// Fonts with double "g" are: Calibri, Franklin, Trebuchet
const singleGArr = ['Arial', 'Comic', 'DejaVu', 'Helvetica', 'Impact', 'Tahoma', 'Verdana'];
const singleGRegex = new RegExp(singleGArr.reduce((x, y) => `${x}|${y}`), 'i');

// Fonts where italic "y" has an open counter where the lowest point is to the left of the tail
const minYArr = ['Bookman', 'Georgia'];
const minYRegex = new RegExp(minYArr.reduce((x, y) => `${x}|${y}`), 'i');

// Fonts where italic "k" has a closed loop
const closedKArr = ['Century_Schoolbook'];
const closedKRegex = new RegExp(closedKArr.reduce((x, y) => `${x}|${y}`), 'i');

// Fonts where italic "v" and "w" is rounded (rather than pointy)
const roundedVWArr = ['Bookman', 'Century_Schoolbook', 'Georgia'];
const roundedVWRegex = new RegExp(roundedVWArr.reduce((x, y) => `${x}|${y}`), 'i');

const serifStemSerifPQArr = ['Bookman', 'Century_Schoolbook', 'Courier', 'Georgia', 'Times'];
const serifStemSerifPQRegex = new RegExp(serifStemSerifPQArr.reduce((x, y) => `${x}|${y}`), 'i');

// While the majority of glyphs can be approximated by applying geometric transformations to a single sans and serif font,
// there are some exceptions (e.g. the lowercase "g" has 2 distinct variations).
// This function identifies variations that require switching out a glyph from the default font entirely.
export function identifyFontVariants(fontScores, fontMetrics) {
  if (fontMetrics?.SansDefault?.normal) {
    const sansG = calcTopFont(fontScores?.SansDefault?.normal?.g);
    fontMetrics.SansDefault.normal.variants.sans_g = singleGRegex.test(sansG);
    const sans1 = calcTopFont(fontScores?.SansDefault?.normal?.['1']);
    fontMetrics.SansDefault.normal.variants.sans_1 = base1Regex.test(sans1);
  }

  if (fontMetrics?.SerifDefault?.italic) {
    const minY = calcTopFont(fontScores?.SerifDefault?.italic?.y);
    fontMetrics.SerifDefault.italic.variants.serif_italic_y = minYRegex.test(minY);
    const closedK = calcTopFont(fontScores?.SerifDefault?.italic?.y);
    fontMetrics.SerifDefault.italic.variants.serif_open_k = !closedKRegex.test(closedK);

    const roundedV = calcTopFont(fontScores?.SerifDefault?.italic?.v);
    const roundedW = calcTopFont(fontScores?.SerifDefault?.italic?.w);
    fontMetrics.SerifDefault.italic.variants.serif_pointy_vw = !(roundedVWRegex.test(roundedV) || roundedVWRegex.test(roundedW));

    const serifItalicP = calcTopFont(fontScores?.SerifDefault?.italic?.p);
    const serifItalicQ = calcTopFont(fontScores?.SerifDefault?.italic?.q);
    fontMetrics.SerifDefault.italic.variants.serif_stem_sans_pq = !(serifStemSerifPQRegex.test(serifItalicP) || serifStemSerifPQRegex.test(serifItalicQ));
  }

  return fontMetrics;
}

/**
 *
 * @param {OcrPage} pageObj
 */
function calcFontMetricsPage(pageObj) {
  /** @type {Object.<string, FontMetricsRawFamily>} */
  const fontMetricsRawPage = {};

  for (const lineObj of pageObj.lines) {
    for (const wordObj of lineObj.words) {
      const wordFontFamily = wordObj.font || 'Default';

      // This condition should not occur, however has in the past due to parsing bugs.  Skipping to avoid entire program crashing if this occurs.
      if (wordObj.chars && wordObj.chars.length !== wordObj.text.length) continue;

      // Do not include superscripts, dropcaps, and low-confidence words in statistics for font optimization.
      if (wordObj.conf < 80 || wordObj.lang === 'chi_sim') continue;
      /** @type {Object.<string, FontMetricsRawFamily>} */
      const fontMetricsRawLine = {};

      if (wordObj.chars) {
        for (let k = 0; k < wordObj.chars.length; k++) {
          const charObj = wordObj.chars[k];

          const charHeight = charObj.bbox.bottom - charObj.bbox.top;
          const charWidth = charObj.bbox.right - charObj.bbox.left;

          // Numbers are normalized as a proportion of ascHeight, everything else is normalized as a percentage of x-height.
          // This is because x-sized characters are more common in text, however numbers are often in "lines" with only numbers,
          // so do not have any x-sized characters to compare to.
          const charNorm = /\d/.test(charObj.text) ? lineObj.ascHeight : lineObj.xHeight;

          if (!charNorm) continue;

          // Multiple characters within a single <ocrx_cinfo> tag have been observed from Tesseract (even when set to char-level output).
          // May cause future issues as this code assumes one character per <ocrx_cinfo> tag.
          const charUnicode = String(charObj.text.charCodeAt(0));

          if (!fontMetricsRawLine[wordFontFamily]) {
            fontMetricsRawLine[wordFontFamily] = new FontMetricsRawFamily();
          }

          if (!fontMetricsRawLine[wordFontFamily][wordObj.style].width[charUnicode]) {
            fontMetricsRawLine[wordFontFamily][wordObj.style].width[charUnicode] = [];
            fontMetricsRawLine[wordFontFamily][wordObj.style].height[charUnicode] = [];
          }

          fontMetricsRawLine[wordFontFamily][wordObj.style].width[charUnicode].push(charWidth / charNorm);
          fontMetricsRawLine[wordFontFamily][wordObj.style].height[charUnicode].push(charHeight / charNorm);
          fontMetricsRawLine[wordFontFamily][wordObj.style].obs += 1;

          if (k + 1 < wordObj.chars.length) {
            const charObjNext = wordObj.chars[k + 1];
            const trailingSpace = charObjNext.bbox.left - charObj.bbox.right;
            const charWidthNext = charObjNext.bbox.right - charObjNext.bbox.left;

            // Only record space between characters when text is moving forward
            // This *should* always be true, however there are some fringe cases where this assumption does not hold,
            // such as Tesseract identifying the same character twice.
            if (trailingSpace + charWidthNext > 0) {
              const bigramUnicode = `${charUnicode},${wordObj.chars[k + 1].text.charCodeAt(0)}`;

              if (!fontMetricsRawLine[wordFontFamily][wordObj.style].kerning[bigramUnicode]) {
                fontMetricsRawLine[wordFontFamily][wordObj.style].kerning[bigramUnicode] = [];
                fontMetricsRawLine[wordFontFamily][wordObj.style].kerning2[bigramUnicode] = [];
              }
              fontMetricsRawLine[wordFontFamily][wordObj.style].kerning[bigramUnicode].push(trailingSpace / charNorm);
              fontMetricsRawLine[wordFontFamily][wordObj.style].kerning2[bigramUnicode].push((trailingSpace + charWidthNext) / charNorm);
            }
          }
        }
      }

      for (const [family, obj] of Object.entries(fontMetricsRawLine)) {
        for (const [style, obj2] of Object.entries(obj)) {
          if (Object.keys(obj2.width).length === 0) continue;
          if (!fontMetricsRawPage[family]) {
            fontMetricsRawPage[family] = new FontMetricsRawFamily();
          }
        }
      }

      for (const [family, obj] of Object.entries(fontMetricsRawPage)) {
        for (const [style, obj2] of Object.entries(obj)) {
          unionFontMetricsFont(fontMetricsRawPage?.[family]?.[style], fontMetricsRawLine?.[family]?.[style]);
        }
      }
    }
  }

  return fontMetricsRawPage;
}
