import { inputData } from './containers/app.js';
import {
  convertPageWarn,
  fontMetricsObj,
  layoutDataTables,
  layoutRegions,
  ocrAll,
  ocrAllRaw,
  pageMetricsArr,
} from './containers/dataContainer.js';
import { fontAll } from './containers/fontContainer.js';
import { ImageCache } from './containers/imageContainer.js';
import { replaceObjectProperties } from './utils/miscUtils.js';

export function clearData() {
  inputData.pageCount = 0;
  replaceObjectProperties(ocrAll, { active: [] });
  replaceObjectProperties(ocrAllRaw, { active: [] });
  layoutRegions.pages.length = 0;
  layoutDataTables.pages.length = 0;
  pageMetricsArr.length = 0;
  convertPageWarn.length = 0;
  ImageCache.clear();
  // Clear optimized font data and reset fontAll to raw data.
  replaceObjectProperties(fontMetricsObj);
  fontAll.clear();
}
