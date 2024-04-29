// Script for generating small caps fonts from standard fonts.
// This is used to generate all "small caps" variants used in ScribeOCR.
// Example use: node node/createSmallCapsFont.js fonts/Lato-Regular.woff fonts/Lato-SmallCaps.woff

import { createRequire } from 'module';

import opentype from '../lib/opentype.module.min.js';

globalThis.require = createRequire(import.meta.url);

globalThis.self = globalThis;

const args = process.argv.slice(2);

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
    const pointJ = glyph.path.commands[j];

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

// Note: Small caps are treated differently from Bold and Italic styles.
// Browsers will "fake" small caps using smaller versions of large caps.
// Unfortunately, it looks like small caps cannot be loaded as a FontFace referring
// to the same font family.  Therefore, they are instead loaded to a different font family.
// https://stackoverflow.com/questions/14527408/defining-small-caps-font-variant-with-font-face
async function createSmallCapsFont(fontData, heightSmallCaps) {
  let workingFont;
  if (typeof (fontData) === 'string') {
    workingFont = await opentype.load(fontData);
  } else {
    workingFont = opentype.parse(fontData, { lowMemory: false });
  }

  const oGlyph = workingFont.charToGlyph('o');
  const oGlyphMetrics = oGlyph.getMetrics();
  const xHeight = oGlyphMetrics.yMax - oGlyphMetrics.yMin;

  // Using "O" rather than "A" to avoid changing x-height of input font
  const OGlyph = workingFont.charToGlyph('O');
  const OGlyphMetrics = OGlyph.getMetrics();
  const ascHeight = OGlyphMetrics.yMax - OGlyphMetrics.yMin;

  const smallCapsMult = xHeight * (heightSmallCaps ?? 1) / ascHeight;
  const lower = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

  for (let i = 0; i < lower.length; i++) {
    const charLit = lower[i];
    const glyphIUpper = workingFont.charToGlyph(charLit.toUpperCase());
    const glyphI = workingFont.charToGlyph(charLit);

    glyphI.path.commands = JSON.parse(JSON.stringify(glyphIUpper.path.commands));

    const scaleCaps = (x) => x * smallCapsMult;
    transformGlyph(glyphI, scaleCaps, true, true);

    glyphI.advanceWidth = Math.round(glyphIUpper.advanceWidth * smallCapsMult);
  }

  // Remove ligatures, as these are especially problematic for small caps fonts (as small caps may be replaced by lower case ligatures)
  workingFont.tables.gsub = null;

  return workingFont;
}

const smallCapsFont = await createSmallCapsFont(args[0]);

smallCapsFont.download(args[1]);
