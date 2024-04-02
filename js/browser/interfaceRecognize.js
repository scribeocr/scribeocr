/* eslint-disable import/no-cycle */

import {
  initOCRVersion, setOemLabel, initializeProgress, runFontOptimizationBrowser, setCurrentHOCR, renderPageQueue, cp,
} from '../../main.js';
import { recognizeAllPagesBrowser } from '../recognizeConvertBrowser.js';
import { toggleEditButtons } from './interfaceEdit.js';
import { loadChiSimFont } from '../fontContainerMain.js';
import { imageCont } from '../containers/imageContainer.js';
import { setFontMetricsAll } from '../fontStatistics.js';

const ocrQualityElem = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));

const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));
const oemLabelTextElem = /** @type {HTMLElement} */(document.getElementById('oemLabelText'));

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));
const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));

const langLabelElem = /** @type {HTMLDivElement} */(document.getElementById('langLabel'));
langLabelElem.addEventListener('click', getLangText);

const langLabelTextElem = /** @type {HTMLDivElement} */(document.getElementById('langLabelText'));

const langChoices = ['chi_sim', 'eng', 'fra', 'deu', 'rus', 'spa'];

function getLangText() {
  const langArr = [];
  langChoices.forEach((x) => {
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById(x));
    console.assert(langCheckboxElem, 'Expected language does not exist');
    if (langCheckboxElem && langCheckboxElem.checked) langArr.push(x);
  });

  if (langArr.length === 0) {
    langArr.push('eng');
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('eng'));
    langCheckboxElem.checked = true;
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  langLabelTextElem.innerText = `Lang: ${langArr.map((x) => capitalizeFirstLetter(x)).join('+')}`;

  // TODO: If too many language are selected, the user should be warned that this can cause issues.
  // If this is not explicit, I could see a user selecting every option "just in case".

  return langArr;
}

// This differs from hideProgress in that (1) the hide is animated rather than instant and (2) the collapse is hidden regardless
// of whether loading is complete.
function hideProgress2(id) {
  const progressCollapse = document.getElementById(id);
  if (progressCollapse.getAttribute('class') === 'collapse show') {
    (new bootstrap.Collapse(progressCollapse)).hide();

    // The collapsing animation needs to end before this can be hidden
  } else if (progressCollapse.getAttribute('class') === 'collapsing') {
    setTimeout(() => hideProgress2(id), 500);
  }
}

/**
 * @type {{[key: string]: Array<Array<CompDebugBrowser>> | undefined}}
 */
globalThis.debugImg = {};

export async function recognizeAllClick() {
  const debugMode = true;

  // User can select engine directly using advanced options, or indirectly using basic options.
  let oemMode;
  if (enableAdvancedRecognitionElem.checked) {
    oemMode = oemLabelTextElem.innerHTML.toLowerCase();
  } else if (ocrQualityElem.value === '1') {
    oemMode = 'combined';
  } else {
    oemMode = 'legacy';
    setOemLabel('legacy');
  }

  const langArr = getLangText();

  if (langArr.includes('chi_sim')) loadChiSimFont();

  // Whether user uploaded data will be compared against in addition to both Tesseract engines
  const userUploadMode = Boolean(globalThis.ocrAll['User Upload']);
  const existingOCR = Object.keys(globalThis.ocrAll).filter((x) => x !== 'active').length > 0;

  // A single Tesseract engine can be used (Legacy or LSTM) or the results from both can be used and combined.
  if (oemMode === 'legacy' || oemMode === 'lstm') {
    // The last tick of the progress bar must be done after everything is finished.
    // If the progress bar finishes earlier, in addition to being misleading to users,
    // the automated browser tests wait until the progress bar fills up to conclude
    // the recognition step was successful.
    globalThis.convertPageActiveProgress = initializeProgress('recognize-recognize-progress-collapse', imageCont.imageAll.nativeStr.length + 1, 0, true);
    const time2a = Date.now();
    // Tesseract is used as the "main" data unless user-uploaded data exists and only the LSTM model is being run.
    // This is because Tesseract Legacy provides very strong metrics, and Abbyy often does not.
    await recognizeAllPagesBrowser(oemMode === 'legacy', oemMode === 'lstm', !(oemMode === 'lstm' && existingOCR), langArr);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);
    setFontMetricsAll(globalThis.ocrAll['Tesseract Legacy']);
    if (oemMode === 'legacy') await runFontOptimizationBrowser(globalThis.ocrAll['Tesseract Legacy']);
  } else if (oemMode === 'combined') {
    globalThis.loadCount = 0;
    globalThis.convertPageActiveProgress = initializeProgress('recognize-recognize-progress-collapse', imageCont.imageAll.nativeStr.length * 2 + 1, 0, true);

    const time2a = Date.now();
    await recognizeAllPagesBrowser(true, true, true, langArr);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    if (debugMode) {
      globalThis.debugImg.Combined = new Array(imageCont.imageAll.nativeStr.length);
      for (let i = 0; i < imageCont.imageAll.nativeStr.length; i++) {
        globalThis.debugImg.Combined[i] = [];
      }
    }

    if (userUploadMode) {
      initOCRVersion('Tesseract Combined');
      setCurrentHOCR('Tesseract Combined');
      if (debugMode) {
        globalThis.debugImg['Tesseract Combined'] = new Array(imageCont.imageAll.nativeStr.length);
        for (let i = 0; i < imageCont.imageAll.nativeStr.length; i++) {
          globalThis.debugImg['Tesseract Combined'][i] = [];
        }
      }
    }

    // A new version of OCR data is created for font optimization and validation purposes.
    // This version has the bounding box and style data from the Legacy data, however uses the text from the LSTM data whenever conflicts occur.
    // Additionally, confidence is set to 0 when conflicts occur. Using this version benefits both font optimiztion and validation.
    // For optimization, using this version rather than Tesseract Legacy excludes data that conflicts with Tesseract LSTM and is therefore likely incorrect,
    // as low-confidence words are excluded when calculating overall character metrics.
    // For validation, this version is superior to both Legacy and LSTM, as it combines the more accurate bounding boxes/style data from Legacy
    // with the more accurate (on average) text data from LSTM.

    initOCRVersion('Tesseract Combined Temp');
    for (let i = 0; i < imageCont.imageAll.nativeStr.length; i++) {
      /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
      const compOptions1 = {
        mode: 'comb',
        evalConflicts: false,
        legacyLSTMComb: true,
      };

      const imgElem = await imageCont.imageAll.binaryStr[i];

      const res1 = await globalThis.gs.compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem,
        imageRotated: imageCont.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions1,
      });

      globalThis.ocrAll['Tesseract Combined Temp'][i] = res1.page;
    }

    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(imageCont.imageAll.nativeStr.length, 5);
    await imageCont.renderImageRange(0, pageNum, 'binary');
    setFontMetricsAll(globalThis.ocrAll['Tesseract Combined Temp']);
    await runFontOptimizationBrowser(globalThis.ocrAll['Tesseract Combined Temp']);
    initOCRVersion('Combined');
    setCurrentHOCR('Combined');

    const time3a = Date.now();
    for (let i = 0; i < imageCont.imageAll.nativeStr.length; i++) {
      const tessCombinedLabel = userUploadMode ? 'Tesseract Combined' : 'Combined';

      /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
      const compOptions = {
        mode: 'comb',
        debugLabel: tessCombinedLabel,
        ignoreCap: ignoreCapElem.checked,
        ignorePunct: ignorePunctElem.checked,
        confThreshHigh: parseInt(confThreshHighElem.value),
        confThreshMed: parseInt(confThreshMedElem.value),
        legacyLSTMComb: true,
      };

      const imgElem = await imageCont.imageAll.binaryStr[i];

      const res = await globalThis.gs.compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem,
        imageRotated: imageCont.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      if (globalThis.debugLog === undefined) globalThis.debugLog = '';
      globalThis.debugLog += res.debugLog;

      globalThis.debugImg[tessCombinedLabel][i] = res.debugImg;

      globalThis.ocrAll[tessCombinedLabel][i] = res.page;

      // If the user uploaded data, compare to that as we
      if (userUploadMode) {
        if (document.getElementById('combineMode')?.value === 'conf') {
          /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
          const compOptions = {
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(confThreshHighElem.value),
            confThreshMed: parseInt(confThreshMedElem.value),
            editConf: true,
          };

          const imgElem = await imageCont.imageAll.binaryStr[i];
          const res = await globalThis.gs.compareHOCR({
            pageA: globalThis.ocrAll['User Upload'][i],
            pageB: globalThis.ocrAll['Tesseract Combined'][i],
            binaryImage: imgElem,
            imageRotated: imageCont.imageAll.binaryRotated[i],
            pageMetricsObj: globalThis.pageMetricsArr[i],
            options: compOptions,
          });

          if (globalThis.debugLog === undefined) globalThis.debugLog = '';
          globalThis.debugLog += res.debugLog;

          globalThis.debugImg.Combined[i] = res.debugImg;

          globalThis.ocrAll.Combined[i] = res.page;
        } else {
          /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
          const compOptions = {
            mode: 'comb',
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(confThreshHighElem.value),
            confThreshMed: parseInt(confThreshMedElem.value),
          };

          const imgElem = await imageCont.imageAll.binaryStr[i];
          const res = await globalThis.globalThis.gs.compareHOCR({
            pageA: globalThis.ocrAll['User Upload'][i],
            pageB: globalThis.ocrAll['Tesseract Combined'][i],
            binaryImage: imgElem,
            imageRotated: imageCont.imageAll.binaryRotated[i],
            pageMetricsObj: globalThis.pageMetricsArr[i],
            options: compOptions,
          });

          if (globalThis.debugLog === undefined) globalThis.debugLog = '';
          globalThis.debugLog += res.debugLog;

          globalThis.debugImg.Combined[i] = res.debugImg;

          globalThis.ocrAll.Combined[i] = res.page;
        }
      }
    }
    const time3b = Date.now();
    if (debugMode) console.log(`Comparison runtime: ${time3b - time3a} ms`);
  }

  globalThis.convertPageActiveProgress.increment();

  hideProgress2('recognize-recognize-progress-collapse');

  renderPageQueue(cp.n);

  // Enable confidence threshold input boxes (only used for Tesseract)
  confThreshHighElem.disabled = false;
  confThreshMedElem.disabled = false;

  // Set threshold values if not already set
  confThreshHighElem.value = confThreshHighElem.value || '85';
  confThreshMedElem.value = confThreshMedElem.value || '75';

  toggleEditButtons(false);

  return (true);
}
