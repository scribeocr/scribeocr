import { recognizePage } from './recognizeConvert.js';
import { PageMetrics } from './objects/pageMetricsObjects.js';
import { imageCont } from './imageContainer.js';

export async function recognizeAllPagesNode(legacy = true, lstm = true, mainData = false, debug = false) {
  await globalThis.generalScheduler.ready;

  const inputPages = [...Array(imageCont.imageAll.nativeStr.length).keys()];
  const promiseArr = [];
  for (const x of inputPages) {
    promiseArr.push(recognizePage(globalThis.gs, x, legacy, lstm, false, {}, debug).then(async (resArr) => {
      const res0 = await resArr[0];
      const res1 = legacy && lstm ? await resArr[1] : undefined;

      if (res0.recognize.debugVis) {
        const ScrollViewNode = (await import('../../scrollview-web/src/ScrollViewNode.js')).ScrollViewNode;
        const sv = new ScrollViewNode();
        await sv.processVisStr(res0.recognize.debugVis);
        globalThis.visInstructions[x] = sv.getAll(true);
      }

      if (res0.convert.legacy) await convertPageCallbackNode(res0.convert.legacy, x, mainData, 'Tesseract Legacy');
      if (res1 && res1.convert.lstm) await convertPageCallbackNode(res1.convert.lstm, x, false, 'Tesseract LSTM');
    }));
  }

  await Promise.all(promiseArr);
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
export async function convertPageCallbackNode({
  pageObj, fontMetricsObj, layoutBoxes, warn,
}, n, mainData, engineName) {
  if (engineName) globalThis.ocrAll[engineName][n] = pageObj;

  // If this is flagged as the "main" data, then save the stats.
  if (mainData) {
    globalThis.convertPageWarn[n] = warn;

    // The page metrics object may have been initialized earlier through some other method (e.g. using PDF info).
    if (!globalThis.pageMetricsArr[n]) {
      globalThis.pageMetricsArr[n] = new PageMetrics(pageObj.dims);
    }

    globalThis.pageMetricsArr[n].angle = pageObj.angle;
    globalThis.pageMetricsArr[n].left = pageObj.left;
  }

  // Layout boxes are only overwritten if none exist yet for the page
  if (Object.keys(globalThis.layout[n].boxes).length === 0) globalThis.layout[n].boxes = layoutBoxes;
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
async function convertOCRPageNode(ocrRaw, n, mainData, format, engineName) {
  let func = 'convertPageHocr';
  if (format === 'abbyy') {
    func = 'convertPageAbbyy';
  } else if (format === 'stext') {
    func = 'convertPageStext';
  }

  await globalThis.generalScheduler.ready;

  const res = await globalThis.generalScheduler.addJob(func, { ocrStr: ocrRaw, n });

  await convertPageCallbackNode(res, n, mainData, engineName);
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
export async function convertOCRAllNode(ocrRawArr, mainData, format, engineName) {
  // For each page, process OCR using web worker
  const promiseArr = [];
  for (let n = 0; n < ocrRawArr.length; n++) {
    promiseArr.push(convertOCRPageNode(ocrRawArr[n], n, mainData, format, engineName));
  }
  await Promise.all(promiseArr);
}
