import { state } from './containers/app.js';
import {
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll,
  ocrAllRaw,
  pageMetricsArr,
} from './containers/dataContainer.js';
import { fontAll } from './containers/fontContainer.js';
import { ImageCache } from './containers/imageContainer.js';
import { replaceObjectProperties } from './utils/miscUtils.js';

export async function clearData() {
  state.pageCount = 0;
  replaceObjectProperties(ocrAll, { active: [] });
  replaceObjectProperties(ocrAllRaw, { active: [] });
  LayoutRegions.pages.length = 0;
  LayoutDataTables.pages.length = 0;
  pageMetricsArr.length = 0;
  state.convertPageWarn = [];
  await ImageCache.clear();
  // Clear optimized font data and reset fontAll to raw data.
  replaceObjectProperties(fontMetricsObj);
  fontAll.clear();
}
