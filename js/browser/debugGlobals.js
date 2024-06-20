/* eslint-disable import/no-cycle */

// This file adds various functions to a global object named `df` so they can be easily run from the console.
// This object should never be referenced in code--the functions should be imported instead.

import { fontAll } from '../containers/fontContainer.js';
import { calcLineFontSize } from '../fontUtils.js';
import { imageCache } from '../containers/imageContainer.js';
import ocr from '../objects/ocrObjects.js';
import {
  stage, layerText, layerBackground, layerOverlay, canvasObj,
} from './interfaceCanvas.js';
import {
  fontMetricsObj, pageMetricsArr, ocrAll, layoutAll, layoutDataTableAll,
} from '../containers/miscContainer.js';

/**
 *
 * @param {string} char
 * @returns
 */
const getCharMetrics = (char) => {
  const charCode = char.charCodeAt(0);
  // return fontMetricsObj[charCode];
  const height = df.fontMetricsObj.SerifDefault.normal.height[charCode];
  const width = df.fontMetricsObj.SerifDefault.normal.width[charCode];

  const charMetricsRaw = fontAll.raw[df.fontAll.serifDefaultName].normal.opentype.charToGlyph(char).getMetrics();
  const oMetricsRaw = fontAll.raw[df.fontAll.serifDefaultName].normal.opentype.charToGlyph('o').getMetrics();

  const oHeightRaw = oMetricsRaw.yMax - oMetricsRaw.yMin;
  const heightFontRaw = (charMetricsRaw.yMax - charMetricsRaw.yMin) / oHeightRaw;
  const widthFontRaw = (charMetricsRaw.xMax - charMetricsRaw.xMin) / oHeightRaw;

  const charMetrics = fontAll.active[df.fontAll.serifDefaultName].normal.opentype.charToGlyph(char).getMetrics();
  const oMetrics = fontAll.active[df.fontAll.serifDefaultName].normal.opentype.charToGlyph('o').getMetrics();

  const oHeight = oMetrics.yMax - oMetrics.yMin;
  const heightFont = (charMetrics.yMax - charMetrics.yMin) / oHeight;
  const widthFont = (charMetrics.xMax - charMetrics.xMin) / oHeight;

  return {
    height, width, heightFont, widthFont, heightFontRaw, widthFontRaw,
  };
};

// Expose functions in global object for debugging purposes.
export const df = {
  calcLineFontSize,
  canvasObj,
  fontAll,
  fontMetricsObj,
  imageCache,
  stage,
  layerText,
  layerBackground,
  layerOverlay,
  getCharMetrics,
  pageMetricsArr,
  ocr,
  ocrAll,
  layoutAll,
  layoutDataTableAll,
};
