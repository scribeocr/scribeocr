import { saveAs } from './miscUtils.js';
import { renderHOCR } from './exportRenderHOCR.js';
import { fontMetricsObj, layoutAll, layoutDataTableAll } from './containers/miscContainer.js';
import { fontAll } from './containers/fontContainer.js';

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));

/**
 * @param {Array<OcrPage>} ocrData - ...
 */
export function renderHOCRBrowser(ocrData) {
  const minValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMin')).value) - 1;
  const maxValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMax')).value) - 1;

  const meta = {
    'font-metrics': fontMetricsObj,
    'default-font': fontAll.defaultFontName,
    'sans-font': fontAll.sansDefaultName,
    'serif-font': fontAll.serifDefaultName,
    'enable-opt': !optimizeFontElem.disabled,
    layout: layoutAll,
    'layout-data-table': layoutDataTableAll,
  };

  const hocrOut = renderHOCR(ocrData, minValue, maxValue, meta);

  const hocrBlob = new Blob([hocrOut], { type: 'text/plain' });

  const fileName = /** @type {HTMLInputElement} */`${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.hocr`;

  saveAs(hocrBlob, fileName);
}
