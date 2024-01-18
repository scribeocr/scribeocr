import { saveAs } from './miscUtils.js';
import { renderHOCR } from './exportRenderHOCR.js';

/**
 * @param {Array<ocrPage>} ocrData - ...
 * @param {Object.<string, fontMetricsFamily>} fontMetrics
 */
export function renderHOCRBrowser(ocrData, fontMetrics, layoutData) {
  const minValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMin')).value) - 1;
  const maxValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMax')).value);

  const hocrOut = renderHOCR(ocrData, fontMetrics, layoutData, minValue, maxValue);

  const exportParser = new DOMParser();

  const exportXML = exportParser.parseFromString(hocrOut, 'text/xml');

  let hocrInt = exportXML.documentElement.outerHTML;
  hocrInt = hocrInt.replaceAll(/xmlns\=[\'\"]{2}\s?/ig, '');

  const hocrBlob = new Blob([hocrInt], { type: 'text/plain' });

  const fileName = /** @type {HTMLInputElement} */`${(document.getElementById('downloadFileName')).value.replace(/\.\w{1,4}$/, '')}.hocr`;

  saveAs(hocrBlob, fileName);
}
