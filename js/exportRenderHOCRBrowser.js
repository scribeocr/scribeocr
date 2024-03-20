import { saveAs } from './miscUtils.js';
import { renderHOCR } from './exportRenderHOCR.js';

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

/**
 * @param {Array<OcrPage>} ocrData - ...
 * @param {Object.<string, FontMetricsFamily>} fontMetrics
 */
export function renderHOCRBrowser(ocrData, fontMetrics, layoutData) {
  const minValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMin')).value) - 1;
  const maxValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMax')).value) - 1;

  const hocrOut = renderHOCR(ocrData, fontMetrics, layoutData, minValue, maxValue);

  // Running through the DOMParser should automatically add nice formatting.
  // The DOMParser should not be used for anything that impacts results substantively,
  // as the Node.js version does not have access to it.
  const exportParser = new DOMParser();

  const exportXML = exportParser.parseFromString(hocrOut, 'text/xml');

  let hocrInt = exportXML.documentElement.outerHTML;
  hocrInt = hocrInt.replaceAll(/xmlns=['"]{2}\s?/ig, '');

  const hocrBlob = new Blob([hocrInt], { type: 'text/plain' });

  const fileName = /** @type {HTMLInputElement} */`${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.hocr`;

  saveAs(hocrBlob, fileName);
}
