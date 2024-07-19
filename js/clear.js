import { state } from './containers/app.js';
import {
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll,
  ocrAllRaw,
  pageMetricsArr,
} from './containers/dataContainer.js';
import { ImageCache } from './containers/imageContainer.js';
import { replaceObjectProperties } from './utils/miscUtils.js';

export async function clearData() {
  state.pageCount = 0;
  replaceObjectProperties(ocrAll, { active: [] });
  replaceObjectProperties(ocrAllRaw, { active: [] });
  replaceObjectProperties(fontMetricsObj);
  LayoutRegions.pages.length = 0;
  LayoutDataTables.pages.length = 0;
  pageMetricsArr.length = 0;
  state.convertPageWarn = [];
  await ImageCache.clear();
}
