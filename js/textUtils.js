


export function getFontSize(font, charHeight, compChar = "o"){
  window.ctx.font = '1000px ' + font;
  // The Tesseract x-height numbers are actually closer to the height of a letter "o"
  let xMetrics = window.ctx.measureText(compChar);
  return(Math.round(1000 * (charHeight / (xMetrics.actualBoundingBoxAscent + xMetrics.actualBoundingBoxDescent))));
}


export function calcWordMetrics(wordText, fontFamily, fontSize, fontStyle = "normal"){
  window.ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  // Calculate font glyph metrics for precise positioning
  const wordLastGlyphMetrics = window.fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = window.fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(0,1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / window.fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / window.fontObj[fontFamily][fontStyle].unitsPerEm);

  const wordWidth1 = window.ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return([wordWidth,wordLeftBearing]);

}


export function calcWordWidth(wordText, fontFamily, fontSize, fontStyle = "normal"){
  window.ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  // Calculate font glyph metrics for precise positioning
  const wordLastGlyphMetrics = window.fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = window.fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(0,1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / window.fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / window.fontObj[fontFamily][fontStyle].unitsPerEm);

  const wordWidth1 = window.ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return(wordWidth);

}
