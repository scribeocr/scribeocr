


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
