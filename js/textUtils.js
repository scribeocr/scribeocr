


export function getFontSize(font, charHeight, compChar = "o", context){
  context.font = '1000px ' + font;
  // The Tesseract x-height numbers are actually closer to the height of a letter "o"
  let xMetrics = context.measureText(compChar);
  return(Math.round(1000 * (charHeight / (xMetrics.actualBoundingBoxAscent + xMetrics.actualBoundingBoxDescent))));
}


export function calcWordMetrics(wordText, fontFamily, fontSize, fontStyle = "normal", context){
  ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  // Calculate font glyph metrics for precise positioning
  const wordLastGlyphMetrics = fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(0,1)).getMetrics();

  //const wordLeftBearing = Math.max(wordFirstGlyphMetrics.leftSideBearing,0) * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  //const wordRightBearing = Math.max(wordLastGlyphMetrics.rightSideBearing,0) * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);

  const wordWidth1 = ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return([wordWidth,wordLeftBearing]);

}


export function calcWordWidth(wordText, fontFamily, fontSize, fontStyle = "normal", context){
  ctx.font = fontStyle + " " + fontSize + 'px ' + fontFamily;

  // Calculate font glyph metrics for precise positioning
  const wordLastGlyphMetrics = fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObj[fontFamily][fontStyle].charToGlyph(wordText.substr(0,1)).getMetrics();

  //const wordLeftBearing = Math.max(wordFirstGlyphMetrics.leftSideBearing,0) * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  //const wordRightBearing = Math.max(wordLastGlyphMetrics.rightSideBearing,0) * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordLeftBearing = wordFirstGlyphMetrics.leftSideBearing * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (fontSize / fontObj[fontFamily][fontStyle].unitsPerEm);

  const wordWidth1 = ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;
  return(wordWidth);

}
