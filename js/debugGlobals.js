/* eslint-disable import/no-cycle */

// This file adds various functions to a global object named `df` so they can be easily run from the console.
// This object should never be referenced in code--the functions should be imported instead.

import { opt, state } from './containers/app.js';
import {
  DebugData,
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll,
  ocrAllRaw,
  pageMetricsArr,
} from './containers/dataContainer.js';
import { fontAll } from './containers/fontContainer.js';
import { ImageCache } from './containers/imageContainer.js';
import ocr from './objects/ocrObjects.js';
import { calcLineFontSize, calcWordMetrics, missingGlyphs } from './utils/fontUtils.js';
import { calcConf } from './utils/ocrUtils.js';

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

// This object contains all important "under the hood" data, so is useful for debugging.
// This is not considered part of the public interface, so is not documented, and may change at any time.
// In general, this should not be used in production code, except as a hack.
// If there are non-fringe use cases, then a documented interface should be created.
export const df = {
  calcConf,
  calcLineFontSize,
  calcWordMetrics,
  DebugData,
  fontAll,
  fontMetricsObj,
  getCharMetrics,
  ImageCache,
  LayoutDataTables,
  LayoutRegions,
  missingGlyphs,
  ocr,
  ocrAll,
  ocrAllRaw,
  opt,
  pageMetricsArr,
  state,
};
