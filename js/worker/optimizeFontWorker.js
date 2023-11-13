
/**
 * @typedef {import("../fontStatistics.js").fontMetricsFont} fontMetricsFont
 */

/**
 * Rounds a number to six decimal places.
 * @param {number} x - The number to be rounded.
 * @returns {number} The rounded number.
 */
function round6(x) {
  return (Math.round(x * 1e6) / 1e6);
}

/**
 * Calculates the nth quantile of a given array of numbers.
 * @param {number[]} arr - The array of numbers.
 * @param {number} ntile - The quantile to calculate. Should be a value between 0 and 1.
 * @returns {number|null} The nth quantile value if the array is not empty; otherwise, null.
 */
function quantile(arr, ntile) {
  if (arr.length == 0) {
    return null;
  }
  let arr1 = [...arr];
  const mid = Math.floor(arr.length * ntile);

  // Using sort() will convert numbers to strings by default
  arr1.sort((a, b) => a - b);

  return arr1[mid];
};

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

  for (let j = 0; j < glyph.path.commands.length; j++) {
    let pointJ = glyph.path.commands[j];

    if (pointJ.type === 'M' || pointJ.type === 'L' || pointJ.type === 'C' || pointJ.type === 'Q') {
      if (transX) pointJ.x = func(pointJ.x);
      if (transY) pointJ.y = func(pointJ.y);
      if (pointJ.type === 'C' || pointJ.type === 'Q') {
        if (transX) pointJ.x1 = func(pointJ.x1);
        if (transY) pointJ.y1 = func(pointJ.y1);
        if (pointJ.type === 'C') {
          if (transX) pointJ.x2 = func(pointJ.x2);
          if (transY) pointJ.y2 = func(pointJ.y2);
        }
      }
    }
  }
}

/**
 * Creates optimized version of font based on metrics provided. 
 * @param {string|ArrayBuffer} fontData
 * @param {fontMetricsFont} fontMetricsObj
 * @param {string} type - 
 * @param {boolean} adjustAllLeftBearings - 
 */
async function optimizeFont(fontData, fontMetricsObj, type, adjustAllLeftBearings = false, standardizeSize = false) {

  const workingFont = typeof (fontData) == "string" ? await opentype.load(fontData) : opentype.parse(fontData, { lowMemory: false });


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
  let oGlyph = workingFont.charToGlyph("o").getMetrics();
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

  // TODO: Adapt glyph substitution to work with new Nimbus fonts
  // if (type == "normal" && fontMetricsObj.variants?.sans_g && /sans/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("g");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.sans_normal_g_single);
  //   scaleGlyph(glyphI, workingFont.unitsPerEm / 2000);
  // }
  // if (type == "normal" && fontMetricsObj.variants?.sans_1 && /sans/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("1");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.sans_normal_1_base);
  //   scaleGlyph(glyphI, workingFont.unitsPerEm / 2000);
  // }
  // if (type == "italic" && fontMetricsObj.variants?.serif_italic_y && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("y");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.serif_italic_y_min);
  // }
  // if (type == "italic" && fontMetricsObj.variants?.serif_open_k && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI = workingFont.charToGlyph("k");
  //   glyphI.path = JSON.parse(globalThis.glyphAlts.serif_italic_k_open);
  // }
  // if (type == "italic" && fontMetricsObj.variants?.serif_pointy_vw && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI1 = workingFont.charToGlyph("v");
  //   glyphI1.path = JSON.parse(globalThis.glyphAlts.serif_italic_v_pointed);
  //   const glyphI2 = workingFont.charToGlyph("w");
  //   glyphI2.path = JSON.parse(globalThis.glyphAlts.serif_italic_w_pointed);
  // }
  // if (type == "italic" && fontMetricsObj.variants?.serif_stem_sans_pq && /libre/i.test(workingFont.names.fontFamily.en)) {
  //   const glyphI1 = workingFont.charToGlyph("p");
  //   glyphI1.path = JSON.parse(globalThis.glyphAlts.serif_italic_p_sans_stem);
  //   const glyphI2 = workingFont.charToGlyph("q");
  //   glyphI2.path = JSON.parse(globalThis.glyphAlts.serif_italic_q_sans_stem);
  // }


  oGlyph = workingFont.charToGlyph("o").getMetrics();
  xHeight = oGlyph.yMax - oGlyph.yMin;

  let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;

  // Define various character classes
  const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

  const upperAsc = ["1", "4", "5", "7", "A", "B", "D", "E", "F", "H", "I", "K", "L", "M", "N", "P", "R", "T", "U", "V", "W", "X", "Y", "Z"]

  const singleStemClassA = ["i", "l", "t", "I"];
  const singleStemClassB = ["f", "i", "j", "l", "t", "I", "J", "T"];

  //const workingFontRightBearingMedian = quantile(lower.map(x => workingFont.charToGlyph(x).getMetrics().rightSideBearing), 0.5);
  //console.log("workingFontRightBearingMedian: " + workingFontRightBearingMedian);

  // Adjust character width and advance
  for (const [key, value] of Object.entries(fontMetricsObj["width"])) {

    // 33 is the first latin glyph (excluding space which is 32)
    if (parseInt(key) < 33) { continue; }

    const charLit = String.fromCharCode(parseInt(key));

    // Some glyphs do not benefit from recalculating statistics, as they are commonly misidentified
    if (["."].includes(charLit)) { continue; }

    let glyphI = workingFont.charToGlyph(charLit);

    if (glyphI.name == ".notdef" || glyphI.name == "NULL") continue;

    let glyphIMetrics = glyphI.getMetrics();
    let glyphIWidth = glyphIMetrics.xMax - glyphIMetrics.xMin;
    let scaleXFactor = (value * xHeight) / glyphIWidth;


    // Left bearings are currently only changed for specific punctuation characters (overall scaling aside)
    let shiftX = 0;    
    if ([";", ":", "‘", "’", "“", "”", "\""].includes(charLit) || adjustAllLeftBearings) {
      const leftBearingCorrect = Math.round(fontMetricsObj["advance"][key] * xHeight);
      const leftBearingAct = glyphI.leftSideBearing;
      if (isFinite(leftBearingCorrect) && leftBearingAct !== undefined) {
        
        shiftX = leftBearingCorrect - leftBearingAct;

        // Reset shiftX to 0 if resulting advance would be very small or negative
        if (shiftX + glyphI.advanceWidth < workingFont.unitsPerEm * 0.05) {
          shiftX = 0;
        }

      }
    }

    // TODO: For simplicitly we assume the stem is located at the midpoint of the bounding box (0.35 for "f")
    // This is not always true (for example, "t" in Libre Baskerville).
    // Look into whether there is a low(ish) effort way of finding the visual center for real.

    let glyphICenterPoint = charLit == "f" ? 0.35 : 0.5;

    let glyphICenter = Math.max(glyphIMetrics.xMin, 0) + Math.round(glyphIWidth * glyphICenterPoint);
    let glyphIWidthQuarter = Math.round(glyphIWidth / 4);

    // Horizontal scaling is limited for certain letters with a single vertical stem.
    // This is because the bounding box for these letters is almost entirely established by the stylistic flourish.
    if (singleStemClassA.includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.1), 0.9);
      // Some fonts have significantly wider double quotes compared to the default style, so more variation is allowed
    } else if (["“", "”"].includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.5), 0.7);
    } else {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.3), 0.7);
    }

    const scaleH1 = (x) => Math.round((x - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
    const scaleH2 = (x) => Math.round(x * scaleXFactor) + shiftX;

    if (singleStemClassB.includes(charLit) && type != "italic") {
      transformGlyph(glyphI, scaleH1, true, false);
    } else {
      transformGlyph(glyphI, scaleH2, true, false);
    }

    glyphIMetrics = glyphI.getMetrics();

    // To simplify calculations, no right bearings are used.
    //glyphI.advanceWidth = Math.round(scaleXFactor * glyphIWidth) + glyphIMetrics.xMin;
    glyphI.advanceWidth = glyphIMetrics.xMax;
    glyphI.leftSideBearing = glyphIMetrics.xMin;
    //glyphI.rightSideBearing = 0;


  }

  // Adjust height for capital letters (if heightCaps is believable)
  if (fontMetricsObj["heightCaps"] >= 1.1) {
    const capsMult = xHeight * fontMetricsObj["heightCaps"] / fontAscHeight;
    for (const key of [...Array(26).keys()].map((x) => x + 65)) {
  
      const charLit = String.fromCharCode(key);
  
      let glyphI = workingFont.charToGlyph(charLit);

      const scaleCaps = (x) => x * capsMult;

      transformGlyph(glyphI, scaleCaps, false, true);

    }  
  }

  const upperAscCodes = upperAsc.map((x) => String(x.charCodeAt(0)));
  const charHeightKeys = Object.keys(fontMetricsObj["height"]);
  const charHeightA = round6(quantile(Object.values(fontMetricsObj["height"]).filter((element, index) => upperAscCodes.includes(charHeightKeys[index])), 0.5));

  {    // TODO: Extend similar logic to apply to other descenders such as "p" and "q"
    // Adjust height of capital J (which often has a height greater than other capital letters)
    // All height from "J" above that of "A" is assumed to occur under the baseline
    const actJMult = Math.max(round6(fontMetricsObj["height"][74]) / charHeightA, 0);
    const fontJMetrics = workingFont.charToGlyph("J").getMetrics();
    const fontAMetrics = workingFont.charToGlyph("A").getMetrics();
    const fontJMult = Math.max((fontJMetrics.yMax - fontJMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin), 1);
    const actFontJMult = actJMult / fontJMult;

    if (Math.abs(1 - actFontJMult) > 0.02) {
      const glyphI = workingFont.charToGlyph("J");
      const glyphIMetrics = glyphI.getMetrics();
      const yAdj = Math.round(glyphIMetrics['yMax'] - (glyphIMetrics['yMax'] * actFontJMult));

      const transDescFunc = (x) => Math.round(x * actFontJMult + yAdj);

      transformGlyph(glyphI, transDescFunc, false, true);

    }
  }


  // Adjust height of descenders
  // All height from "p" or "q" above that of "a" is assumed to occur under the baseline
  const descAdjArr = ["g", "p", "q"];
  const fontAMetrics = workingFont.charToGlyph("a").getMetrics();
  const minA = fontAMetrics.yMin;
  for (let i = 0; i < descAdjArr.length; i++) {
    const charI = descAdjArr[i];
    const charICode = charI.charCodeAt(0);
    const actMult = Math.max(fontMetricsObj["height"][charICode] / fontMetricsObj["height"][97], 0);
    const metrics = workingFont.charToGlyph(charI).getMetrics();
    const fontMult = (metrics.yMax - metrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin);
    const actFontMult = actMult / fontMult;
    const glyphHeight = metrics.yMax - metrics.yMin;
    const glyphLowerStemHeight = minA - metrics.yMin;
    const scaleYFactor = ((actFontMult - 1) * (glyphHeight / glyphLowerStemHeight)) + 1;

    const scaleYFunc = (x) => Math.round((x - minA) * scaleYFactor);

    if (Math.abs(actFontMult) > 1.02) {
      let glyphI = workingFont.charToGlyph(charI);
      
      // Adjust scaling factor to account for the fact that only the lower part of the stem is adjusted
      
      // Note: This cannot be replaced with a call to `transformGlyph`, as this code only transforms certain glyphs. 

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        let pointJ = glyphI.path.commands[j];

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

  let fontKerningObj = new Object;

  // Kerning is limited to +/-10% of the em size for most pairs.  Anything beyond this is likely not correct.
  let maxKern = Math.round(workingFont.unitsPerEm * 0.1);
  let minKern = maxKern * -1;

  for (const [key, value] of Object.entries(fontMetricsObj.kerning)) {

    // Do not adjust pair kerning for italic "ff".
    // Given the amount of overlap between these glyphs, this metric is rarely accurate. 
    if (key == "102,102" && type == "italic") continue;

    const nameFirst = key.match(/\w+/)[0];
    const nameSecond = key.match(/\w+$/)[0];

    const charFirst = String.fromCharCode(parseInt(nameFirst));
    const charSecond = String.fromCharCode(parseInt(nameSecond));

    const indexFirst = workingFont.charToGlyphIndex(charFirst);
    const indexSecond = workingFont.charToGlyphIndex(charSecond);

    let fontKern = Math.round(value * xHeight - Math.max(workingFont.glyphs.glyphs[indexSecond].leftSideBearing, 0));

    // For smart quotes, the maximum amount of kerning space allowed is doubled.
    // Unlike letters, some text will legitimately have a large space before/after curly quotes.
    // TODO: Handle quotes in a more systematic way (setting advance for quotes, or kerning for all letters,
    // rather than relying on each individual pairing.)
    if (["8220", "8216"].includes(nameFirst) || ["8221", "8217"].includes(nameSecond)) {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern * 2);

      // For pairs that commonly use ligatures ("ff", "fi", "fl") allow lower minimum
    } else if (["102,102", "102,105", "102,108"].includes(key)) {
      fontKern = Math.min(Math.max(fontKern, Math.round(minKern * 1.5)), maxKern);
    } else {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern);
    }

    fontKerningObj[indexFirst + "," + indexSecond] = fontKern;
  }


  workingFont.kerningPairs = fontKerningObj;

  // Quick fix due to bug in pdfkit (see note in renderPDF function)
  //workingFont.tables.name.postScriptName["en"] = workingFont.tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

  return workingFont;

}

addEventListener('message', async (e) => {

  // Defining "window" is needed due to bad browser/node detection in Opentype.js
  // Can hopefully remove in future version
  if (typeof process === "undefined") {
    globalThis.window = {};
  } else {
    await import("../../node/require.js");
  }

  await import('../../lib/opentype.js');

  
  // const { glyphAlts } = await import('../fonts/glyphs.js');
  // globalThis.glyphAlts = glyphAlts;
  
  const fontData = e.data[1].fontData;
  const metrics = e.data[1].fontMetrics;
  const style = e.data[1].style;
  const adjustAllLeftBearings = e.data[1].adjustAllLeftBearings;
  const heightSmallCaps = e.data[1].heightSmallCaps;
  const func = e.data[0];

  // Ability to create small caps fonts on the fly was removed, as we currently only support 2 fonts, so there is no need.
  // This should be restored if the ability to use user-uploaded fonts is added in the future. 
  if (func == "createSmallCapsFont") {
    // const font = await createSmallCapsFont(fontData, heightSmallCaps);
    // const fontBuffer = font.toArrayBuffer();
    // return postMessage({ fontData: fontBuffer, id: e.data[2] }, [fontBuffer]);
  } else {
    const font = await optimizeFont(fontData, metrics, style, adjustAllLeftBearings);
    const fontBuffer = font.toArrayBuffer();
    return postMessage({ fontData: fontBuffer, kerningPairs: font.kerningPairs, id: e.data[2] }, [fontBuffer]);
  }

});
