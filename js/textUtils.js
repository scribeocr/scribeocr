


export function getFontSize(font, charHeight, compChar = "o"){
  window.ctx.font = '1000px ' + font;
  // The Tesseract x-height numbers are actually closer to the height of a letter "o"
  let xMetrics = window.ctx.measureText(compChar);
  return(Math.round(1000 * (charHeight / (xMetrics.actualBoundingBoxAscent + xMetrics.actualBoundingBoxDescent))));
}


export async function calcWordMetrics(wordText, fontFamily, fontSize, fontStyle = "normal"){
  window.ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  if (/small caps$/i.test(fontFamily)) {
    fontFamily = fontFamily.replace(/\s?small\s?caps/i, "");
    fontStyle = "small-caps";
  }

  // Calculate font glyph metrics for precise positioning
  const fontObjI = await window.fontObj[fontFamily][fontStyle];
  const wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0,1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / fontObjI.unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / fontObjI.unitsPerEm);

  const wordWidth1 = window.ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return([wordWidth,wordLeftBearing]);

}


export async function calcWordWidth(wordText, fontFamily, fontSize, fontStyle = "normal"){
  window.ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  if (/small caps$/i.test(fontFamily)) {
    fontFamily = fontFamily.replace(/\s?small\s?caps/i, "");
    fontStyle = "small-caps";
  }

  // Calculate font glyph metrics for precise positioning
  const fontObjI = await window.fontObj[fontFamily][fontStyle];
  const wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0,1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / fontObjI.unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / fontObjI.unitsPerEm);

  const wordWidth1 = window.ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return(wordWidth);

}

// Calculates kerning value given a word, its actual width (as measured from the scanned image), and 
export async function calcCharSpacing(wordText, fontFamily, fontStyle, fontSize, actualWidth) {
  if(wordText.length < 2) return 0;

  const fontObjI = await globalThis.fontObj[fontFamily][fontStyle];

  if (fontStyle == "small-caps") {
    ctx.font = fontSize + 'px ' + fontFamily + " Small Caps";
  } else {
    ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;
  }

  // Calculate font glyph metrics for precise positioning
  let wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  let wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  let wordLeftBearing = wordFirstGlyphMetrics.xMin * (fontSize / fontObjI.unitsPerEm);
  let wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / fontObjI.unitsPerEm);


  let wordWidth1 = ctx.measureText(wordText).width;
  let wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  const kerning = Math.round((actualWidth - wordWidth) / (wordText.length - 1)*1e3)/1e3;

  return kerning;

}
