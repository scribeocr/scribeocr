/* eslint-disable import/no-cycle */

// This file adds various functions to a global object named `df` so they can be easily run from the console.
// This object should never be referenced in code--the functions should be imported instead.

import { opt, state } from '../containers/app.js';
import {
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll,
  pageMetricsArr,
} from '../containers/dataContainer.js';
import { fontAll } from '../containers/fontContainer.js';
import { ImageCache } from '../containers/imageContainer.js';
import ocr from '../objects/ocrObjects.js';
import { calcLineFontSize, calcWordMetrics, missingGlyphs } from '../utils/fontUtils.js';
import { elem } from './elems.js';
import {
  layerBackground, layerOverlay,
  layerText,
  ScribeCanvas,
  stage,
} from './interfaceCanvas.js';

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
  calcWordMetrics,
  elem,
  fontAll,
  fontMetricsObj,
  getCharMetrics,
  ImageCache,
  layerBackground,
  layerOverlay,
  layerText,
  LayoutDataTables,
  LayoutRegions,
  missingGlyphs,
  ocr,
  ocrAll,
  opt,
  pageMetricsArr,
  ScribeCanvas,
  stage,
  state,
};
