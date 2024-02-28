/* eslint-disable import/no-cycle */

import {
  renderPDFImageCache, initOCRVersion, setCurrentHOCR, calculateOverallPageMetrics, cp, insertAlertMessage,
} from '../main.js';
import { recognizePage } from './recognizeConvert.js';
import { PageMetrics } from './objects/pageMetricsObjects.js';
import { checkCharWarn } from './fontStatistics.js';

const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
const showDebugLegendElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugLegend'));
const selectDebugVisElem = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));

/** @type {Array<ReturnType<typeof import('../../scrollview-web/scrollview/ScrollView.js').ScrollView.prototype.getAll>>} */
globalThis.visInstructions = [];

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

  // 'Tesseract Latest' includes the last version of Tesseract to run.
  // It exists only so that data can be consistently displayed during recognition,
  // should never be enabled after recognition is complete, and should never be editable by the user.
  initOCRVersion('Tesseract Latest');
  setCurrentHOCR('Tesseract Latest');

  await globalThis.generalScheduler.ready;

  // If Legacy and LSTM are both requested, LSTM completion is tracked by a second array of promises (`promisesB`).
  // In this case, `convertPageCallbackBrowser` and `calculateOverallPageMetrics` can be run after the Legacy recognition is finished,
  // however this function only returns after all recognition is completed.
  // This provides no performance benefit in absolute terms, however halves the amount of time the user has to wait
  // before seeing the initial recognition results.
  const inputPages = [...Array(globalThis.imageAll.native.length).keys()];
  const promisesA = [];
  const resolvesA = [];
  const promisesB = [];
  const resolvesB = [];

  for (let i = 0; i < inputPages.length; i++) {
    promisesA.push(new Promise((resolve, reject) => {
      resolvesA[i] = { resolve, reject };
    }));
    promisesB.push(new Promise((resolve, reject) => {
      resolvesB[i] = { resolve, reject };
    }));
  }

  const config = {};

  for (const x of inputPages) {
    recognizePage(globalThis.gs, x, legacy, lstm, false, config, showDebugVisElem.checked).then(async (resArr) => {
      const res0 = await resArr[0];

      if (res0.recognize.debugVis) {
        const ScrollViewBrowser = (await import('../../scrollview-web/src/ScrollViewBrowser.js')).ScrollViewBrowser;
        const sv = new ScrollViewBrowser(true);
        await sv.processVisStr(res0.recognize.debugVis);
        globalThis.visInstructions[x] = sv.getAll(true);

        // Enable the select element and add the options the first time this is run.
        if (selectDebugVisElem.options.length === 1) {
          showDebugLegendElem.disabled = false;
          selectDebugVisElem.disabled = false;
          Object.keys(globalThis.visInstructions[x]).forEach((x) => {
            const opt = document.createElement('option');
            opt.value = x;
            opt.innerHTML = x;
            selectDebugVisElem.appendChild(opt);
          });
        }
      }

      if (legacy) {
        await convertPageCallbackBrowser(res0.convert.legacy, x, mainData, 'Tesseract Legacy');
        resolvesA[x].resolve();
      } else if (lstm) {
        await convertPageCallbackBrowser(res0.convert.lstm, x, false, 'Tesseract LSTM');
        resolvesA[x].resolve();
      }

      if (legacy && lstm) {
        (async () => {
          const res1 = await resArr[1];
          await convertPageCallbackBrowser(res1.convert.lstm, x, false, 'Tesseract LSTM');
          resolvesB[x].resolve();
        })();
      }
    });
  }

  await Promise.all(promisesA);

  if (mainData) {
    await checkCharWarn(globalThis.convertPageWarn, insertAlertMessage);
    await calculateOverallPageMetrics();
  }

  if (legacy && lstm) await Promise.all(promisesB);

  if (lstm) {
    const oemText = 'Tesseract LSTM';
    setCurrentHOCR(oemText);
  } else {
    const oemText = 'Tesseract Legacy';
    setCurrentHOCR(oemText);
  }
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
  pageObj, layoutBoxes, warn,
}, n, mainData, engineName) {
  if (engineName) globalThis.ocrAll[engineName][n] = pageObj;

  if (['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName)) globalThis.ocrAll['Tesseract Latest'][n] = pageObj;

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

  inputDataModes.xmlMode[n] = true;

  // Layout boxes are only overwritten if none exist yet for the page
  if (Object.keys(globalThis.layout[n].boxes).length === 0) globalThis.layout[n].boxes = layoutBoxes;

  // If this is the page the user has open, render it to the canvas
  const oemActive = document.getElementById('displayLabelText')?.innerHTML;

  // Display the page if either (1) this is the currently active OCR or (2) this is Tesseract Legacy and Tesseract LSTM is active, but does not exist yet.
  // The latter condition occurs briefly whenever recognition is run in "Quality" mode.
  const displayOCR = engineName === oemActive || ['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName) && oemActive === 'Tesseract Latest';

  if (n === cp.n && displayOCR) displayPage(cp.n);

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

  const res = await globalThis.generalScheduler.addJob(func, { ocrStr: ocrRaw, n });

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
