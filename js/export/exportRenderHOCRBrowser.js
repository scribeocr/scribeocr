import { fontMetricsObj, LayoutDataTables, LayoutRegions } from '../containers/dataContainer.js';
import { fontAll } from '../containers/fontContainer.js';
import { elem } from '../gui/elems.js';
import { saveAs } from '../utils/miscUtils.js';
import { renderHOCR } from './exportRenderHOCR.js';

/**
 * @param {Array<OcrPage>} ocrData - ...
 * @param {number} minpage - The first page to include in the document.
 * @param {number} maxpage - The last page to include in the document.
 */
export function renderHOCRBrowser(ocrData, minpage, maxpage) {
  const meta = {
    'font-metrics': fontMetricsObj,
    'default-font': fontAll.defaultFontName,
    'sans-font': fontAll.sansDefaultName,
    'serif-font': fontAll.serifDefaultName,
    'enable-opt': !elem.view.optimizeFont.disabled,
    layout: LayoutRegions.pages,
    'layout-data-table': LayoutDataTables.pages,
  };

  const hocrOut = renderHOCR(ocrData, minpage, maxpage, meta);

  const hocrBlob = new Blob([hocrOut], { type: 'text/plain' });

  const fileName = /** @type {HTMLInputElement} */`${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.hocr`;

  saveAs(hocrBlob, fileName);
}
