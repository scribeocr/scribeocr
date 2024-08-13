// These function are used to render a word to a basic HTML Canvas element.
// This differs from the code that renders to the main viewer canvas, which uses Konva.js.

import { fontAll } from '../containers/fontContainer.js';
import { calcLineFontSize, calcWordMetrics } from '../utils/fontUtils.js';

/**
 * Crop the image data the area containing `words` and render to the `calcCtx.canvas` canvas.
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
 * @param {Array<OcrWord>} words
 * @param {ImageBitmap} imageBinaryBit
 * @param {dims} imgDims
 * @param {number} angle
 * @param {Array<CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D>} [ctxViewArr]
 */
export async function drawWordActual(ctx, words, imageBinaryBit, imgDims, angle, ctxViewArr) {
  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!ctx) throw new Error('Canvases must be defined before running this function.');

  // The font/style from the first word is used for the purposes of font metrics
  const lineFontSize = calcLineFontSize(words[0].line);

  if (!lineFontSize) {
    // This condition should not occur as checks are implemented in the code that calls this function.
    console.log('Cannot draw words as font size cannot be calculated.');
    return;
  }

  const fontI = fontAll.getWordFont(words[0]);

  const fontOpentypeI = fontI.opentype;
  ctx.font = `${fontI.fontFaceStyle} ${fontI.fontFaceWeight} ${1000}px ${fontI.fontFaceName}`;

  const oMetrics = ctx.measureText('o');

  const fontBoundingBoxDescent = Math.round(Math.abs(fontOpentypeI.descender) * (1000 / fontOpentypeI.unitsPerEm));
  const fontBoundingBoxAscent = Math.round(Math.abs(fontOpentypeI.ascender) * (1000 / fontOpentypeI.unitsPerEm));

  const fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  const fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  const shiftX = sinAngle * (imgDims.height * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((imgDims.width - shiftX) * 0.5) || 0;

  const wordsBox = words.map((x) => x.bbox);

  // Union of all bounding boxes
  const wordBoxUnion = {
    left: Math.min(...wordsBox.map((x) => x.left)),
    top: Math.min(...wordsBox.map((x) => x.top)),
    right: Math.max(...wordsBox.map((x) => x.right)),
    bottom: Math.max(...wordsBox.map((x) => x.bottom)),
  };

  // All words are assumed to be on the same line
  const linebox = words[0].line.bbox;
  const { baseline } = words[0].line;

  let angleAdjXLine = 0;
  let angleAdjYLine = 0;
  if (Math.abs(angle ?? 0) > 0.05) {
    const x = linebox.left;
    const y = linebox.bottom + baseline[1];

    const xRot = x * cosAngle - sinAngle * y;
    // const yRot = x * sinAngle + cosAngle * y;

    const angleAdjXInt = x - xRot;

    const angleAdjYInt = sinAngle * (linebox.left + angleAdjXInt / 2) * -1;

    angleAdjXLine = angleAdjXInt + shiftX;
    angleAdjYLine = angleAdjYInt + shiftY;
  }

  const angleAdjXWord = Math.abs(angle) >= 1 ? angleAdjXLine + (1 - cosAngle) * (wordBoxUnion.left - linebox.left) : angleAdjXLine;

  // We crop to the dimensions of the font (fontAsc and fontDesc) rather than the image bounding box.
  const height = fontAsc && fontDesc ? fontAsc + fontDesc : wordBoxUnion.bottom - wordBoxUnion.top + 1;
  const width = wordBoxUnion.right - wordBoxUnion.left + 1;

  const cropY = linebox.bottom + baseline[1] - fontAsc - 1;
  const cropYAdj = cropY + angleAdjYLine;

  ctx.canvas.height = height;
  ctx.canvas.width = width;

  ctx.drawImage(imageBinaryBit, wordBoxUnion.left + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);

  if (ctxViewArr && ctxViewArr.length > 0) {
    for (let i = 0; i < ctxViewArr.length; i++) {
      const ctxI = ctxViewArr[i];
      ctxI.canvas.height = height;
      ctxI.canvas.width = width;
      ctxI.drawImage(imageBinaryBit, wordBoxUnion.left + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);
    }
  }

  return cropY;
}

/**
   * Function that draws a word on a canvas.
   * This code was factored out to allow for drawing multiple times while only calculating metrics once.
   * Therefore, only the drawing code should be in this function; the metrics should be calculated elsewhere
   * and passed to this function, rather than calcualting from an `OcrWord` object.
   *
   * @param {Object} params
   * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} params.ctx
   * @param {Array<string>} params.charArr
   * @param {number} params.left
   * @param {number} params.bottom
   * @param {Array<number>} params.advanceArr - Array of pixels to advance for each character.
   *    Unlike the "advance" property of a glyph, this is the actual distance to advance on the canvas,
   *    and should include kerning and character spacing.
   * @param {FontContainerFont} params.font
   * @param {number} params.size
   * @param {boolean} params.smallCaps
   * @param {string} [params.fillStyle='black']
   */
const printWordOnCanvas = async ({
  ctx, charArr, left, bottom, advanceArr, font, size, smallCaps, fillStyle = 'black',
}) => {
  ctx.font = `${font.fontFaceStyle} ${font.fontFaceWeight} ${size}px ${font.fontFaceName}`;
  ctx.fillStyle = fillStyle;
  ctx.textBaseline = 'alphabetic';

  let leftI = left;
  for (let i = 0; i < charArr.length; i++) {
    let charI = charArr[i];

    if (smallCaps) {
      if (charI === charI.toUpperCase()) {
        ctx.font = `${font.fontFaceStyle} ${font.fontFaceWeight} ${size}px ${font.fontFaceName}`;
      } else {
        charI = charI.toUpperCase();
        ctx.font = `${font.fontFaceStyle} ${font.fontFaceWeight} ${size * font.smallCapsMult}px ${font.fontFaceName}`;
      }
    }

    ctx.fillText(charI, leftI, bottom);
    leftI += advanceArr[i];
  }
};

/**
   * Print word on `ctxCanvas`.
   *
   * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
   * @param {OcrWord} word
   * @param {number} offsetX
   * @param {number} cropY
   * @param {?CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctxView
   * @param {boolean} [imageRotated=false] -
   */
export const drawWordRender = async (ctx, word, offsetX = 0, cropY = 0, ctxView = null, imageRotated = false) => {
  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!ctx) throw new Error('Canvases must be defined before running this function.');

  const fontI = fontAll.getWordFont(word);

  let baselineY = word.line.bbox.bottom + word.line.baseline[1];

  if (word.sup) {
    const wordboxXMid = word.bbox.left + (word.bbox.right - word.bbox.left) / 2;

    const baselineYWord = word.line.bbox.bottom + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox.left);

    baselineY -= (baselineYWord - word.bbox.bottom);
  } else if (!imageRotated) {
    const wordboxXMid = word.bbox.left + (word.bbox.right - word.bbox.left) / 2;

    baselineY = word.line.bbox.bottom + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox.left);
  }

  const y = baselineY - cropY;

  const wordMetrics = calcWordMetrics(word);
  const advanceArr = wordMetrics.advanceArr;
  const kerningArr = wordMetrics.kerningArr;
  const charSpacing = wordMetrics.charSpacing;
  const wordFontSize = wordMetrics.fontSize;

  const advanceArrTotal = [];
  for (let i = 0; i < advanceArr.length; i++) {
    let leftI = 0;
    leftI += advanceArr[i] || 0;
    leftI += kerningArr[i] || 0;
    leftI += charSpacing || 0;
    advanceArrTotal.push(leftI);
  }

  let left = 1 + offsetX;
  if (word.visualCoords) left -= wordMetrics.leftSideBearing;

  await printWordOnCanvas({
    ctx, charArr: wordMetrics.charArr, left, bottom: y, advanceArr: advanceArrTotal, font: fontI, size: wordFontSize, smallCaps: word.smallCaps,
  });

  if (ctxView) {
    await printWordOnCanvas({
      ctx: ctxView, charArr: wordMetrics.charArr, left, bottom: y, advanceArr: advanceArrTotal, font: fontI, size: wordFontSize, smallCaps: word.smallCaps, fillStyle: 'red',
    });
  }
};
