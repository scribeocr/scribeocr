import { quantile } from '../miscUtils.js';

// Defining "window" is needed due to bad browser/node detection in Opentype.js
// Can hopefully remove in future version
if (typeof process === 'object') {
  await import('../../node/require.js');
} else if (globalThis.document === undefined) {
  globalThis.window = {};
}

const opentype = await import('../../lib/opentype.module.min.js');

/**
 * Rounds a number to six decimal places.
 * @param {number} x - The number to be rounded.
 * @returns {number} The rounded number.
 */
function round6(x) {
  return (Math.round(x * 1e6) / 1e6);
}

/**
 * Function that transforms a single numeric input.
 * @callback transformFunc
 * @param {number} x - Numeric input
 */

/**
 * Apply function to all points on glyph.
 * @param {opentype.Glyph} glyph
 * @param {transformFunc} func
 * @param {boolean} transX - Transform x coordinates
 * @param {boolean} transY - Transform y coordinates
 */
function transformGlyph(glyph, func, transX = false, transY = false) {
  // All values are rounded to the nearest integer.
  // All TrueType coordinates must be integers, and while PostScript fonts do not technically need to be integers,
  // non-integers tend to cause issues in real-world use.
  const funcRound = (x) => Math.round(func(x));

  for (let j = 0; j < glyph.path.commands.length; j++) {
    const pointJ = glyph.path.commands[j];

    if (pointJ.type === 'M' || pointJ.type === 'L' || pointJ.type === 'C' || pointJ.type === 'Q') {
      if (transX) pointJ.x = funcRound(pointJ.x);
      if (transY) pointJ.y = funcRound(pointJ.y);
      if (pointJ.type === 'C' || pointJ.type === 'Q') {
        if (transX) pointJ.x1 = funcRound(pointJ.x1);
        if (transY) pointJ.y1 = funcRound(pointJ.y1);
        if (pointJ.type === 'C') {
          if (transX) pointJ.x2 = funcRound(pointJ.x2);
          if (transY) pointJ.y2 = funcRound(pointJ.y2);
        }
      }
    }
  }

  if (transX) {
    // leftSideBearing is not automatically updated by glyphIMetrics
    const glyphMetrics = glyph.getMetrics();
    glyph.leftSideBearing = glyphMetrics.xMin;

    // Apply function to advanceWidth
    glyph.advanceWidth = funcRound(glyph.advanceWidth);
  }
}

/**
 * Calculate pair kerning adjustments for font given provided metrics.
 *
 * @param {opentype.Font} font
 * @param {FontMetricsFont} fontMetricsObj
 * @param {number} xHeight
 * @param {string} style
 */
const calculateKerningPairs = (font, fontMetricsObj, xHeight, style) => {
  const fontKerningObj = {};

  // Kerning is limited to +/-10% of the em size for most pairs.  Anything beyond this is likely not correct.
  const maxKern = Math.round(font.unitsPerEm * 0.1);
  const minKern = maxKern * -1;

  for (const [key, value] of Object.entries(fontMetricsObj.kerning)) {
    // Do not adjust pair kerning for italic "ff".
    // Given the amount of overlap between these glyphs, this metric is rarely accurate.
    if (key === '102,102' && style === 'italic') continue;

    const nameFirst = key.match(/\w+/)[0];
    const nameSecond = key.match(/\w+$/)[0];

    const charFirst = String.fromCharCode(parseInt(nameFirst));
    const charSecond = String.fromCharCode(parseInt(nameSecond));

    const indexFirst = font.charToGlyphIndex(charFirst);
    const indexSecond = font.charToGlyphIndex(charSecond);

    const metricsFirst = font.glyphs.glyphs[indexFirst].getMetrics();
    const metricsSecond = font.glyphs.glyphs[indexSecond].getMetrics();

    // Calculate target (measured) space between two characters.
    // This is calculated as the average between two measurements.
    const value2 = fontMetricsObj.kerning2[key];
    const fontKern1 = Math.round(value * xHeight);
    let spaceTarget = fontKern1;
    if (value2) {
      const fontKern2 = Math.round(value2 * xHeight);
      spaceTarget = Math.round((fontKern1 + fontKern2) / 2);
    }

    // Calculate current space between these 2 glyphs (without kerning adjustments)
    const spaceCurrent = metricsFirst.rightSideBearing + metricsSecond.leftSideBearing;

    // Calculate kerning adjustment needed
    let fontKern = spaceTarget - spaceCurrent;

    // For smart quotes, the maximum amount of kerning space allowed is doubled.
    // Unlike letters, some text will legitimately have a large space before/after curly quotes.
    // TODO: Handle quotes in a more systematic way (setting advance for quotes, or kerning for all letters,
    // rather than relying on each individual pairing.)
    if (['8220', '8216'].includes(nameFirst) || ['8221', '8217'].includes(nameSecond)) {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern * 2);

      // For pairs that commonly use ligatures ("ff", "fi", "fl") allow lower minimum
    } else if (['102,102', '102,105', '102,108'].includes(key)) {
      fontKern = Math.min(Math.max(fontKern, Math.round(minKern * 1.5)), maxKern);
    } else {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern);
    }

    fontKerningObj[`${indexFirst},${indexSecond}`] = fontKern;
  }

  return fontKerningObj;
};

/**
 * Creates optimized version of font based on metrics provided.
 * @param {Object} params
 * @param {string|ArrayBuffer} params.fontData
 * @param {FontMetricsFont} params.fontMetricsObj
 * @param {string} params.style -
 * @param {boolean} [params.adjustAllLeftBearings] - Edit left bearings for all characters based on provided metrics.
 * @param {boolean} [params.standardizeSize] - Scale such that size of 'o' is 0.47x em size.
 * @param {?number} [params.targetEmSize] - If non-null, font is scaled to this em size.
 * @param {boolean} [params.transGlyphs] - Whether individual glyphs should be transformed based on provided metrics.
 *    If `false`, only font-level transformations (adjusting em size and standardizing 'o' height) are performed.
 */
export async function optimizeFont({
  fontData, fontMetricsObj, style, adjustAllLeftBearings = false, standardizeSize = false, targetEmSize = null, transGlyphs = true,
}) {
  /** @type {opentype.Font} */
  const workingFont = typeof (fontData) === 'string' ? await opentype.load(fontData) : opentype.parse(fontData, { lowMemory: false });

  // let workingFont;
  // if (typeof (fontData) == "string") {
  //   workingFont = await opentype.load(fontData);
  // } else {
  //   workingFont = opentype.parse(fontData, { lowMemory: false });
  // }

  // Remove GSUB table (in most Latin fonts this table is responsible for ligatures, if it is used at all).
  // The presence of ligatures (such as ﬁ and ﬂ) is not properly accounted for when setting character metrics.
  workingFont.tables.gsub = null;

  // Scale font to standardize x-height
  // TODO: Make this optional or move to a separate script so the default fonts can be pre-scaled.
  const xHeightStandard = 0.47 * workingFont.unitsPerEm;
  let oGlyph = workingFont.charToGlyph('o').getMetrics();
  let xHeight = oGlyph.yMax - oGlyph.yMin;
  const xHeightScale = xHeightStandard / xHeight;
  const scaleGlyph = (x) => x * xHeightScale;
  if (Math.abs(1 - xHeightScale) > 0.01) {
    if (standardizeSize) {
      for (const [key, value] of Object.entries(workingFont.glyphs.glyphs)) {
        transformGlyph(value, scaleGlyph, true, true);
      }
    } else {
      console.log("Font is not standard size ('o' 0.47x em size).  Either standardize the font ahead of time or enable `standardizeSize = true` to standardize on the fly.");
    }
  }

  if (targetEmSize && targetEmSize !== workingFont.unitsPerEm) {
    for (const [key, value] of Object.entries(workingFont.glyphs.glyphs)) {
      transformGlyph(value, (x) => x * (targetEmSize / workingFont.unitsPerEm), true, true);
    }
    workingFont.unitsPerEm = targetEmSize;
  }

  // If no glyph-level transformations are requested, return early.
  if (!transGlyphs) {
    workingFont.kerningPairs = calculateKerningPairs(workingFont, fontMetricsObj, xHeight, style);

    return { fontData: workingFont.toArrayBuffer(), kerningPairs: workingFont.kerningPairs };
  }

  // TODO: Adapt glyph substitution to work with new Nimbus fonts
  // if (style == "normal" && fontMetricsObj.variants?.sans_g && /sans/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("g");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.sans_normal_g_single);
  //   scaleGlyph(glyphI, workingFont.unitsPerEm / 2000);
  // }
  // if (style == "normal" && fontMetricsObj.variants?.sans_1 && /sans/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("1");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.sans_normal_1_base);
  //   scaleGlyph(glyphI, workingFont.unitsPerEm / 2000);
  // }
  // if (style == "italic" && fontMetricsObj.variants?.serif_italic_y && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("y");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.serif_italic_y_min);
  // }
  // if (style == "italic" && fontMetricsObj.variants?.serif_open_k && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("k");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.serif_italic_k_open);
  // }
  // if (style == "italic" && fontMetricsObj.variants?.serif_pointy_vw && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI1 = workingFont.charToGlyph("v");
  //   glyphI1.path = JSON.parse(globalThis.glyphAlts.serif_italic_v_pointed);
  //   const glyphI2 = workingFont.charToGlyph("w");
  //   glyphI2.path = JSON.parse(globalThis.glyphAlts.serif_italic_w_pointed);
  // }
  // if (style == "italic" && fontMetricsObj.variants?.serif_stem_sans_pq && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI1 = workingFont.charToGlyph("p");
  //   glyphI1.path = JSON.parse(globalThis.glyphAlts.serif_italic_p_sans_stem);
  //   const glyphI2 = workingFont.charToGlyph("q");
  //   glyphI2.path = JSON.parse(globalThis.glyphAlts.serif_italic_q_sans_stem);
  // }

  oGlyph = workingFont.charToGlyph('o').getMetrics();
  xHeight = oGlyph.yMax - oGlyph.yMin;

  const heightCapsBelievable = fontMetricsObj.obsCaps >= 10 && fontMetricsObj.heightCaps >= 1.1 && fontMetricsObj.heightCaps < 2;

  const fontAscHeight = workingFont.charToGlyph('A').getMetrics().yMax;

  // Define various character classes
  const lower = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

  const singleStemClassA = ['i', 'l', 't', 'I'];
  const singleStemClassB = ['f', 'i', 'j', 'l', 't', 'I', 'J', 'T'];

  // const workingFontRightBearingMedian = quantile(lower.map(x => workingFont.charToGlyph(x).getMetrics().rightSideBearing), 0.5);
  // console.log("workingFontRightBearingMedian: " + workingFontRightBearingMedian);

  // Adjust character width and advance
  for (const [key, value] of Object.entries(fontMetricsObj.width)) {
    // 33 is the first latin glyph (excluding space which is 32)
    if (parseInt(key) < 33) { continue; }

    const charLit = String.fromCharCode(parseInt(key));

    // Some glyphs do not benefit from recalculating statistics, as they are commonly misidentified
    if (['.'].includes(charLit)) { continue; }

    const glyphI = workingFont.charToGlyph(charLit);

    if (glyphI.name === '.notdef' || glyphI.name === 'NULL') continue;

    let glyphIMetrics = glyphI.getMetrics();
    const glyphIWidth = glyphIMetrics.xMax - glyphIMetrics.xMin;

    let scaleXFactor = (value * xHeight) / glyphIWidth;

    // TODO: For simplicitly we assume the stem is located at the midpoint of the bounding box (0.35 for "f")
    // This is not always true (for example, "t" in Libre Baskerville).
    // Look into whether there is a low(ish) effort way of finding the visual center for real.

    const glyphICenterPoint = charLit === 'f' ? 0.35 : 0.5;

    const glyphICenter = Math.max(glyphIMetrics.xMin, 0) + Math.round(glyphIWidth * glyphICenterPoint);
    const glyphIWidthQuarter = Math.round(glyphIWidth / 4);

    // Horizontal scaling is limited for certain letters with a single vertical stem.
    // This is because the bounding box for these letters is almost entirely established by the stylistic flourish.
    if (singleStemClassA.includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.1), 0.9);
      // Some fonts have significantly wider double quotes compared to the default style, so more variation is allowed
    } else if (['“', '”'].includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.5), 0.7);
    } else {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.3), 0.7);
    }

    const scaleH1 = (x) => Math.round((x - glyphICenter) * scaleXFactor) + glyphICenter;
    const scaleH2 = (x) => Math.round(x * scaleXFactor);

    if (singleStemClassB.includes(charLit) && style !== 'italic') {
      transformGlyph(glyphI, scaleH1, true, false);
    } else {
      transformGlyph(glyphI, scaleH2, true, false);
    }

    glyphIMetrics = glyphI.getMetrics();
    // leftSideBearing is not automatically updated by glyphIMetrics
    glyphI.leftSideBearing = glyphIMetrics.xMin;

    // Edit left bearings.
    // This must be done after any horizontal scaling for the calculations to be correct.
    // Left bearings are currently only changed for specific punctuation characters (overall scaling aside)
    let shiftX = 0;
    if ([';', ':', '‘', '’', '“', '”', '"'].includes(charLit) || adjustAllLeftBearings) {
      const leftBearingCorrect = 0;
      // xMin is automatically updated by getMetrics, leftSideBearing is not
      const leftBearingAct = glyphIMetrics.xMin;
      if (Number.isFinite(leftBearingCorrect) && leftBearingAct !== undefined) {
        shiftX = leftBearingCorrect - leftBearingAct;

        // Reset shiftX to 0 if resulting advance would be very small or negative
        if (shiftX + glyphI.advanceWidth < workingFont.unitsPerEm * 0.05) {
          shiftX = 0;
        }
      }
    }

    if (shiftX !== 0) {
      const shiftH = (x) => x + shiftX;
      transformGlyph(glyphI, shiftH, true, false);
      glyphIMetrics = glyphI.getMetrics();
    }

    // leftSideBearing is not automatically updated by glyphIMetrics
    glyphI.leftSideBearing = glyphIMetrics.xMin;
  }

  // Adjust height for capital letters (if heightCaps is believable)
  if (heightCapsBelievable) {
    const capsMult = xHeight * fontMetricsObj.heightCaps / fontAscHeight;
    for (const key of [...Array(26).keys()].map((x) => x + 65)) {
      const charLit = String.fromCharCode(key);

      const glyphI = workingFont.charToGlyph(charLit);

      const scaleCaps = (x) => x * capsMult;

      transformGlyph(glyphI, scaleCaps, false, true);
    }
  }

  // This purposefully does not include numbers, as those are normalized differently.
  const upperAsc = ['A', 'B', 'D', 'E', 'F', 'H', 'I', 'K', 'L', 'M', 'N', 'P', 'R', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const upperAscCodes = upperAsc.map((x) => String(x.charCodeAt(0)));
  const charHeightKeys = Object.keys(fontMetricsObj.height);
  const heightAscArr = Object.values(fontMetricsObj.height).filter((element, index) => upperAscCodes.includes(charHeightKeys[index]));

  // At least 10 observations are required to adjust from the default.
  if (heightAscArr.length >= 10) {
    const heightAscMedian0 = quantile(heightAscArr, 0.5);
    if (heightAscMedian0) {
      const charHeightA = round6(heightAscMedian0);

      // TODO: Extend similar logic to apply to other descenders such as "p" and "q"
      // Adjust height of capital J (which often has a height greater than other capital letters)
      // All height from "J" above that of "A" is assumed to occur under the baseline
      const actJMult = Math.max(round6(fontMetricsObj.height[74]) / charHeightA, 0);
      const fontJMetrics = workingFont.charToGlyph('J').getMetrics();
      const fontAMetrics = workingFont.charToGlyph('A').getMetrics();
      const fontJMult = Math.max((fontJMetrics.yMax - fontJMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin), 1);
      const actFontJMult = actJMult / fontJMult;

      if (Math.abs(1 - actFontJMult) > 0.02) {
        const glyphI = workingFont.charToGlyph('J');
        const glyphIMetrics = glyphI.getMetrics();
        const yAdj = Math.round(glyphIMetrics.yMax - (glyphIMetrics.yMax * actFontJMult));

        const transDescFunc = (x) => Math.round(x * actFontJMult + yAdj);

        transformGlyph(glyphI, transDescFunc, false, true);
      }
    }
  }

  // Adjust height of descenders
  // All height from "p" or "q" above that of "a" is assumed to occur under the baseline
  const descAdjArr = ['g', 'p', 'q'];
  const fontAMetrics = workingFont.charToGlyph('a').getMetrics();
  const minA = fontAMetrics.yMin;
  for (let i = 0; i < descAdjArr.length; i++) {
    const charI = descAdjArr[i];
    const charICode = charI.charCodeAt(0);
    const actMult = Math.max(fontMetricsObj.height[charICode] / fontMetricsObj.height[97], 0);
    const metrics = workingFont.charToGlyph(charI).getMetrics();
    const fontMult = (metrics.yMax - metrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin);
    const actFontMult = actMult / fontMult;
    const glyphHeight = metrics.yMax - metrics.yMin;
    const glyphLowerStemHeight = minA - metrics.yMin;
    const scaleYFactor = ((actFontMult - 1) * (glyphHeight / glyphLowerStemHeight)) + 1;

    const scaleYFunc = (x) => Math.round((x - minA) * scaleYFactor);

    if (Math.abs(actFontMult) > 1.02) {
      const glyphI = workingFont.charToGlyph(charI);

      // Adjust scaling factor to account for the fact that only the lower part of the stem is adjusted

      // Note: This cannot be replaced with a call to `transformGlyph`, as this code only transforms certain glyphs.

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        const pointJ = glyphI.path.commands[j];

        if (pointJ.type === 'M' || pointJ.type === 'L' || pointJ.type === 'C' || pointJ.type === 'Q') {
          if (pointJ.y < minA) pointJ.y = Math.round((pointJ.y - minA) * scaleYFactor);
          if (pointJ.type === 'C' || pointJ.type === 'Q') {
            if (pointJ.y1 < minA) pointJ.y1 = Math.round((pointJ.y1 - minA) * scaleYFactor);
            if (pointJ.type === 'C') {
              if (pointJ.y2 < minA) pointJ.y2 = Math.round((pointJ.y2 - minA) * scaleYFactor);
            }
          }
        }
      }
    }
  }

  workingFont.kerningPairs = calculateKerningPairs(workingFont, fontMetricsObj, xHeight, style);

  return { fontData: workingFont.toArrayBuffer(), kerningPairs: workingFont.kerningPairs };
}
