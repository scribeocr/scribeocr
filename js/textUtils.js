


/**
 * Calculates font size by comparing provided character height to font metrics.
 * 
 * @param {string} fontFamily - 
 * @param {string} fontStyle - 
 * @param {number} charHeightActual - Actual, measured height of character in pixels.
 * @param {string} [compChar='o'] - Character to compare `charHeightActual` against (default is 'o').
 * @returns {Promise<number>} A promise that resolves to the calculated font size.
 * 
 * Note: The default value "o" corresponds to the x-height stat better than "x" does. 
 */
export async function getFontSize(fontFamily, fontStyle, charHeightActual, compChar = "o"){

  if (/small caps$/i.test(fontFamily)) {
    fontFamily = fontFamily.replace(/\s?small\s?caps/i, "");
    fontStyle = "small-caps";
  }
  const fontObjI = await globalThis.fontObj[fontFamily][fontStyle];

  const charMetrics = fontObjI.charToGlyph(compChar).getMetrics();
  const charHeight = (charMetrics.yMax - charMetrics.yMin) * (1 / fontObjI.unitsPerEm);

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
 * @async 
 * @return {Promise<WordMetrics>} 
 */
export async function calcWordMetrics(wordText, fontFamily, fontSize, fontStyle = "normal"){

  if (/small caps$/i.test(fontFamily)) {
    fontFamily = fontFamily.replace(/\s?small\s?caps/i, "");
    fontStyle = "small-caps";
  }

  // Calculate font glyph metrics for precise positioning
  const fontObjI = await globalThis.fontObj[fontFamily][fontStyle];

  let wordWidth1 = 0;
  const wordTextArr = wordText.split("");
  for (let i=0; i<wordTextArr.length; i++) {
    const charI = wordTextArr[i];
    const charJ = wordTextArr[i+1];
    wordWidth1 += fontObjI.charToGlyph(charI).advanceWidth;
    if (charJ) wordWidth1 += fontObjI.getKerningValue(fontObjI.charToGlyph(charI),fontObjI.charToGlyph(charJ));
  }

  const wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0,1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing;
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing;

  const wordWidthPx = (wordWidth1 - wordRightBearing - wordLeftBearing) * (fontSize / fontObjI.unitsPerEm);
  const wordLeftBearingPx = wordLeftBearing * (fontSize / fontObjI.unitsPerEm);
  const wordRightBearingPx = wordRightBearing * (fontSize / fontObjI.unitsPerEm);

  return {"visualWidth": wordWidthPx, "leftSideBearing": wordLeftBearingPx, "rightSideBearing": wordRightBearingPx}

}


/**
 * Calculates char spacing required for the specified word to be rendered at specified width.
 * 
 * @param {string} wordText - 
 * @param {string} fontFamily - 
 * @param {string} fontStyle - 
 * @param {number} fontSize - 
 * @param {number} actualWidth - The actual width the word should be scaled to
 */
export async function calcCharSpacing(wordText, fontFamily, fontStyle, fontSize, actualWidth) {
  if(wordText.length < 2) return 0;

  const wordWidth = (await calcWordMetrics(wordText, fontFamily, fontSize, fontStyle))["visualWidth"];

  const charSpacing = Math.round((actualWidth - wordWidth) / (wordText.length - 1)*1e3)/1e3;

  return charSpacing;

}
