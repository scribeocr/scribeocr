


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

export async function calcWordMetrics(wordText, fontFamily, fontSize, fontStyle = "normal"){
  // window.ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

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

  // const wordWidth1 = window.ctx.measureText(wordText).width;
  const wordWidth = (wordWidth1 - wordRightBearing - wordLeftBearing) * (fontSize / fontObjI.unitsPerEm);

  return {"width": wordWidth, "leftSideBearing": wordLeftBearing}

}

// Calculates char spacing required for the specified word to be rendered at a width of actualWidth
export async function calcCharSpacing(wordText, fontFamily, fontStyle, fontSize, actualWidth) {
  if(wordText.length < 2) return 0;

  const wordWidth = (await calcWordMetrics(wordText, fontFamily, fontSize, fontStyle))["width"];

  const charSpacing = Math.round((actualWidth - wordWidth) / (wordText.length - 1)*1e3)/1e3;

  return charSpacing;

}
