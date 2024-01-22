// Script for standardizing font size such that the "o" character is 0.47x the em size.
// Using fonts with standardized x-heights allows for changing fonts without having to re-calculate font size every time.
// Example use: node node/standardizeFontSize.js fonts/Lato-Regular.woff fonts/Lato-Regular2.woff

import { createRequire } from 'module';

globalThis.require = createRequire(import.meta.url);

globalThis.self = globalThis;
await import('../lib/opentype.js');

const args = process.argv.slice(2);

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

async function standardizeFontSize(fontData) {
  let workingFont;
  if (typeof (fontData) === 'string') {
    workingFont = await opentype.load(fontData);
  } else {
    workingFont = opentype.parse(fontData, { lowMemory: false });
  }

  const xHeightStandard = 0.47 * workingFont.unitsPerEm;
  const oGlyph = workingFont.charToGlyph('o').getMetrics();
  const xHeight = oGlyph.yMax - oGlyph.yMin;
  const xHeightScale = xHeightStandard / xHeight;
  const scaleGlyph = (x) => x * xHeightScale;
  if (Math.abs(1 - xHeightScale) > 0.01) {
    for (const [key, value] of Object.entries(workingFont.glyphs.glyphs)) {
      transformGlyph(value, scaleGlyph, true, true);
    }
  }

  // Remove ligatures
  // workingFont.tables.gsub = null;

  return workingFont;
}

const smallCapsFont = await standardizeFontSize(args[0]);

smallCapsFont.download(args[1]);
