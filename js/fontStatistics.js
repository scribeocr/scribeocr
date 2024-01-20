// File summary:
// Functions to calculate font metrics and generate new fonts.

import { quantile, round6 } from './miscUtils.js';

import { FontMetricsFamily, FontMetricsRawFamily, FontMetricsFont } from './objects/fontMetricsObjects.js';

// import { glyphAlts } from "../fonts/glyphs.js";

/** @type {Array<Object.<string, FontMetricsRawFamily>>} */
globalThis.fontMetricObjsMessage = [];

/** @type {Array<Object.<string, string>>} */
globalThis.convertPageWarn = [];

/** @type {?Object.<string, FontMetricsFamily>} */
globalThis.fontMetricsObj = null;

// Sans/serif lookup for common font families
// Should be added to if additional fonts are encountered
// Fonts that should not be added (both Sans and Serif variants):
// DejaVu
const serifFonts = ['SerifDefault', 'Baskerville', 'Book', 'Cambria', 'Century_Schoolbook', 'Courier', 'Garamond', 'Georgia', 'Times'];
const sansFonts = ['SansDefault', 'Arial', 'Calibri', 'Comic', 'Franklin', 'Helvetica', 'Impact', 'Tahoma', 'Trebuchet', 'Verdana'];

const serifFontsRegex = new RegExp(serifFonts.reduce((x, y) => `${x}|${y}`), 'i');
const sansFontsRegex = new RegExp(sansFonts.reduce((x, y) => `${x}|${y}`), 'i');

/**
 * Given a font name from Tesseract/Abbyy XML, determine if it should be represented by sans font or serif font.
 *
 * @param {string} fontName - The name of the font to determine the type of. If the font name
 * is falsy, the function will return "Default".
 * @returns {string} fontFamily - The determined type of the font. Possible values are "SansDefault",
 * "SerifDefault", or "Default" (if the font type cannot be determined).
 * @throws {console.log} - Logs an error message to the console if the font is unidentified and
 * it is not the "Default Metrics Font".
 */
export function determineSansSerif(fontName) {
  let fontFamily = 'Default';
  // Font support is currently limited to 1 font for Sans and 1 font for Serif.
  if (fontName) {
    // First, test to see if "sans" or "serif" is in the name of the font
    if (/(^|\W|_)sans($|\W|_)/i.test(fontName)) {
      fontFamily = 'SansDefault';
    } else if (/(^|\W|_)serif($|\W|_)/i.test(fontName)) {
      fontFamily = 'SerifDefault';

    // If not, check against a list of known sans/serif fonts.
    // This list is almost certainly incomplete, so should be added to when new fonts are encountered.
    } else if (serifFontsRegex.test(fontName)) {
      fontFamily = 'SerifDefault';
    } else if (sansFontsRegex.test(fontName)) {
      fontFamily = 'SansDefault';
    } else if (fontName !== 'Default Metrics Font') {
      console.log(`Unidentified font in XML: ${fontName}`);
    }
  }

  return fontFamily;
}

// Checks whether `multiFontMode` should be enabled or disabled.
// Usually (including when the built-in OCR engine is used) we will have metrics for individual font families,
// which are used to optimize the appropriate fonts ("multiFontMode" is `true` in this case).
// However, it is possible for the user to upload input data with character-level positioning information
// but no font identification information for most or all words.
// If this is encountered the "default" metric is applied to the default font ("multiFontMode" is `false` in this case).
export function checkMultiFontMode(fontMetricsObj) {
  let defaultFontObs = 0;
  let namedFontObs = 0;
  if (fontMetricsObj.Default?.obs) { defaultFontObs += fontMetricsObj.Default?.obs; }
  if (fontMetricsObj.SerifDefault?.obs) { namedFontObs += fontMetricsObj.SerifDefault?.obs; }
  if (fontMetricsObj.SansDefault?.obs) { namedFontObs += fontMetricsObj.SansDefault?.obs; }

  return namedFontObs > defaultFontObs;
}

// Automatically sets the default font to whatever font is most common per globalThis.fontMetricsObj

/**
 * Automatically sets the default font to whatever font is most common in the provided font metrics.
 *
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export function setDefaultFontAuto(fontMetricsObj) {
  const multiFontMode = checkMultiFontMode(fontMetricsObj);

  // Return early if the OCR data does not contain font info.
  if (!multiFontMode) return;

  // Change default font to whatever named font appears more
  if ((fontMetricsObj.SerifDefault?.obs || 0) > (fontMetricsObj.SansDefault?.obs || 0)) {
    globalThis.globalSettings.defaultFont = 'SerifDefault';
  } else {
    globalThis.globalSettings.defaultFont = 'SansDefault';
  }

  if (globalThis.generalScheduler) {
    for (let i = 0; i < globalThis.generalScheduler.workers.length; i++) {
      const worker = globalThis.generalScheduler.workers[i];
      worker.setGlobalSettings({ globalSettings: globalThis.globalSettings });
    }
  }
}

/**
 * Combine page-level character statistics to calculate overall font metrics.
 * Run after all files (both image and OCR) have been loaded.
 *
 * @param {Array<Object.<string, FontMetricsRawFamily>>} fontMetricObjsMessage
 * @param {Array<Object.<string, string>>} warnArr - Array of objects containing warning/error messages from convertPage
 * @returns {{charError: boolean, charWarn: boolean, fontMetrics: ?Object.<string, FontMetricsFamily>}} -
 */
export function calculateOverallFontMetrics(fontMetricObjsMessage, warnArr) {
  /** @type {Array<Object.<string, FontMetricsRawFamily>>} */
  const fontMetricObjsMessageFilter = [];

  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.
  let charErrorCt = 0;
  let charWarnCt = 0;
  let charGoodCt = 0;
  for (let i = 0; i < warnArr.length; i++) {
    const warn = warnArr[i]?.char;
    if (warn === 'char_error') {
      charErrorCt += 1;
    } else if (warn === 'char_warning') {
      charWarnCt += 1;
    } else {
      charGoodCt += 1;
      fontMetricObjsMessageFilter.push(fontMetricObjsMessage[i]);
    }
  }

  // The UI warning/error messages cannot be thrown within this function,
  // as that would make this file break when imported into contexts that do not have the main UI.
  if (charGoodCt == 0 && charErrorCt > 0) {
    return { charWarn: false, charError: true, fontMetrics: null };
  } if (charGoodCt == 0 && charWarnCt > 0) {
    return { charWarn: true, charError: false, fontMetrics: null };
  }

  const fontMetricsRawObj = fontMetricObjsMessageFilter.reduce((x, y) => unionFontMetricsRawObj(x, y));

  /** @type {Object.<string, FontMetricsFamily>} */
  let fontMetricsOut = {};

  for (const [family, obj] of Object.entries(fontMetricsRawObj)) {
    fontMetricsOut[family] = new FontMetricsFamily();
    for (const [style, obj2] of Object.entries(obj)) {
      fontMetricsOut[family][style] = calculateFontMetrics(obj2);
      fontMetricsOut[family].obs = fontMetricsOut[family].obs + fontMetricsOut[family][style].obs;
    }
  }

  fontMetricsOut = identifyFontVariants(globalThis.fontScores, fontMetricsOut);

  return { charWarn: false, charError: false, fontMetrics: fontMetricsOut };
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
        fontMetricOut[prop][key] = fontMetricOut[prop][key] * fontMetricOut.heightCaps;
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

        fontMetricOut[prop][key] = fontMetricOut[prop][key] - widthSecond;
      }
    }
  }

  return (fontMetricOut);
}

export function parseDebugInfo(debugTxt) {
  if (!globalThis.fontScores) globalThis.fontScores = { SerifDefault: {}, SansDefault: {}, Default: {} };

  const fontLines = debugTxt.match(/Modal Font.+/g);

  if (!fontLines) return;

  // Filter statement added as this regex fails for some lines where the "letter" has multiple characters (possibly non-ASCII punctuation)
  const fontArr = fontLines.map((x) => x.match(/Modal Font: ([^;]+?); Letter: (.); Font: ([^;]+?); Score: (\d+)/)).filter((x) => x?.length == 5);

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

    globalThis.fontScores[modalFontFamily][style][char][font] = globalThis.fontScores[modalFontFamily][style][char][font] + score;
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
