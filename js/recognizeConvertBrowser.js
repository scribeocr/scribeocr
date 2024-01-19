import {
  renderPDFImageCache, initOCRVersion, setCurrentHOCR, calculateOverallMetrics, cp,
} from '../main.js';
import { recognizePage } from './recognizeConvert.js';
import { PageMetrics } from './objects/pageMetricsObjects.js';

export async function recognizeAllPagesBrowser(legacy = true, lstm = true, mainData = false) {
  // Render all PDF pages to PNG if needed
  if (inputDataModes.pdfMode) await renderPDFImageCache([...Array(globalThis.imageAll.native.length).keys()]);

  if (legacy) {
    const oemText = 'Tesseract Legacy';
    initOCRVersion(oemText);
    setCurrentHOCR(oemText);
  }

  if (lstm) {
    const oemText = 'Tesseract LSTM';
    initOCRVersion(oemText);
    setCurrentHOCR(oemText);
  }

  await globalThis.generalScheduler.ready;

  const inputPages = [...Array(globalThis.imageAll.native.length).keys()];
  const promiseArr = [];
  for (const x of inputPages) {
    promiseArr.push(recognizePage(globalThis.generalScheduler, x, legacy, lstm).then(async (res1) => {
      if (res1.legacy) await convertPageCallbackBrowser(res1.legacy, x, mainData, 'Tesseract Legacy');
      if (res1.lstm) await convertPageCallbackBrowser(res1.lstm, x, false, 'Tesseract LSTM');
    }));
  }

  await Promise.all(promiseArr);

  if (mainData) await calculateOverallMetrics();
}

/**
 * This function is called after running a `convertPage` (or `recognizeAndConvert`) function, updating the globals with the results.
 * This needs to be a separate function from `convertOCRPage`, given that sometimes recognition and conversion are combined by using `recognizeAndConvert`.
 *
 * @param {Object} params - Object returned by `convertPage` functions
 * @param {number} n
 * @param {boolean} mainData
 * @param {string} engineName - Name of OCR engine.
 * @returns
 */
export async function convertPageCallbackBrowser({
  pageObj, fontMetricsObj, layoutBoxes, warn,
}, n, mainData, engineName) {
  // If an OEM engine is specified, save to the appropriate object within ocrAll,
  // and only set to ocrAll.active if appropriate.  This prevents "Recognize All" from
  // overwriting the wrong output if a user switches ocrAll.active to another OCR engine
  // while the recognition job is running.
  const oemCurrent = engineName === document.getElementById('displayLabelText')?.innerHTML;

  if (engineName) globalThis.ocrAll[engineName][n] = pageObj;

  // If this is flagged as the "main" data, then save the stats.
  if (mainData) {
    globalThis.fontMetricObjsMessage[n] = fontMetricsObj;
    globalThis.convertPageWarn[n] = warn;

    // The page metrics object may have been initialized earlier through some other method (e.g. using PDF info).
    if (!globalThis.pageMetricsArr[n]) {
      globalThis.pageMetricsArr[n] = new PageMetrics(pageObj.dims);
    }

    globalThis.pageMetricsArr[n].angle = pageObj.angle;
    globalThis.pageMetricsArr[n].left = pageObj.left;
  }

  inputDataModes.xmlMode[n] = true;

  // Layout boxes are only overwritten if none exist yet for the page
  if (Object.keys(globalThis.layout[n].boxes).length === 0) globalThis.layout[n].boxes = layoutBoxes;

  // If this is the page the user has open, render it to the canvas
  if (n === cp.n && oemCurrent) displayPage(cp.n);

  globalThis.convertPageActiveProgress.increment();
}

/**
 * Convert from raw OCR data to the internal hocr format used here
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {string} ocrRaw - String containing raw OCR data for single page.
 * @param {number} n - Page number
 * @param {boolean} mainData - Whether this is the "main" data that document metrics are calculated from.
 *  For imports of user-provided data, the first data provided should be flagged as the "main" data.
 *  For Tesseract.js recognition, the Tesseract Legacy results should be flagged as the "main" data.
 * @param {("hocr"|"abbyy"|"stext")} format - Format of raw data.
 * @param {string} engineName - Name of OCR engine.
 */
async function convertOCRPageBrowser(ocrRaw, n, mainData, format, engineName) {
  let func = 'convertPageHocr';
  if (format === 'abbyy') {
    func = 'convertPageAbbyy';
  } else if (format === 'stext') {
    func = 'convertPageStext';
  }

  await globalThis.generalScheduler.ready;

  const res = (await globalThis.generalScheduler.addJob(func, { ocrStr: ocrRaw, n })).data;

  await convertPageCallbackBrowser(res, n, mainData, engineName);
}

/**
 * Convert from raw OCR data to the internal hocr format used here
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {string[]} ocrRawArr - Array with raw OCR data, with an element for each page
 * @param {boolean} mainData - Whether this is the "main" data that document metrics are calculated from.
 *  For imports of user-provided data, the first data provided should be flagged as the "main" data.
 *  For Tesseract.js recognition, the Tesseract Legacy results should be flagged as the "main" data.
 * @param {("hocr"|"abbyy"|"stext")} format - Format of raw data.
 * @param {string} engineName - Name of OCR engine.
 */
export async function convertOCRAllBrowser(ocrRawArr, mainData, format, engineName) {
  // For each page, process OCR using web worker
  const promiseArr = [];
  for (let n = 0; n < ocrRawArr.length; n++) {
    promiseArr.push(convertOCRPageBrowser(ocrRawArr[n], n, mainData, format, engineName));
  }
  await Promise.all(promiseArr);
}
