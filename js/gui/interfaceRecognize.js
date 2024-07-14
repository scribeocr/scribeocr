/* eslint-disable import/no-cycle */

import {
  initOCRVersion,
  renderPageQueue,
  runFontOptimizationBrowser, setCurrentHOCR,
} from '../../main.js';
import { opt, state } from '../containers/app.js';
import { debugImg, ocrAll, pageMetricsArr } from '../containers/dataContainer.js';
import { imageCache } from '../containers/imageContainer.js';
import { gs } from '../containers/schedulerContainer.js';
import { loadBuiltInFontsRaw, loadChiSimFont } from '../fontContainerMain.js';
import { calcFontMetricsFromPages } from '../fontStatistics.js';
import { recognizeAllPagesBrowser } from '../recognizeConvertBrowser.js';
import { elem } from './elems.js';
import { cp } from './interfaceCanvas.js';
import { toggleEditButtons } from './interfaceEdit.js';
import { ProgressBars } from './utils/progressBars.js';
import { insertAlertMessage } from './utils/warningMessages.js';

const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));
const oemLabelTextElem = /** @type {HTMLElement} */(document.getElementById('oemLabelText'));

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));
const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));

const langLabelElem = /** @type {HTMLDivElement} */(document.getElementById('langLabel'));
langLabelElem.addEventListener('click', setLangOpt);

const langLabelTextElem = /** @type {HTMLDivElement} */(document.getElementById('langLabelText'));

const collapseLangElem = /** @type {HTMLDivElement} */(document.getElementById('collapseLang'));

const langChoiceElemArr = Array.from(collapseLangElem.querySelectorAll('.form-check-input'));

const langChoices = langChoiceElemArr.map((element) => element.id);

elem.recognize.oemLabelOptionLstm.addEventListener('click', () => { setOemLabel('lstm'); });
elem.recognize.oemLabelOptionLegacy.addEventListener('click', () => { setOemLabel('legacy'); });
elem.recognize.oemLabelOptionCombined.addEventListener('click', () => { setOemLabel('combined'); });

elem.recognize.psmLabelOption3.addEventListener('click', () => { setPsmLabel('3'); });
elem.recognize.psmLabelOption4.addEventListener('click', () => { setPsmLabel('4'); });

elem.recognize.buildLabelOptionDefault.addEventListener('click', () => {
  setBuildLabel('default');
  opt.vanillaMode = false;
});
elem.recognize.buildLabelOptionVanilla.addEventListener('click', () => {
  setBuildLabel('vanilla');
  opt.vanillaMode = true;
});

function setOemLabel(x) {
  if (x.toLowerCase() === 'lstm') {
    elem.recognize.oemLabelText.innerHTML = 'LSTM';
  } else if (x.toLowerCase() === 'legacy') {
    elem.recognize.oemLabelText.innerHTML = 'Legacy';
  } else if (x.toLowerCase() === 'combined') {
    elem.recognize.oemLabelText.innerHTML = 'Combined';
  }
}

/**
 *
 * @param {string} x
 */
function setPsmLabel(x) {
  if (x === '3') {
    elem.recognize.psmLabelText.innerHTML = 'Automatic';
  } else if (x === '4') {
    elem.recognize.psmLabelText.innerHTML = 'Single Column';
  } else if (x === '8') {
    elem.recognize.psmLabelText.innerHTML = 'Single Word';
  }
}

function setBuildLabel(x) {
  if (x.toLowerCase() === 'default') {
    elem.recognize.buildLabelText.innerHTML = 'Scribe';
  } else if (x.toLowerCase() === 'vanilla') {
    elem.recognize.buildLabelText.innerHTML = 'Vanilla';
  }
}

const langAlertElem = insertAlertMessage('Only enable languages known to be in the source document. Enabling many languages decreases performance.', false, 'alertRecognizeDiv', false);
export const enableDisablelangAlertElem = () => {
  // Enable message if more than 2 languages are selected
  const enable = langChoiceElemArr.map((x) => x.checked).reduce((x, y) => x + y, 0) > 2;

  if (enable) {
    langAlertElem.setAttribute('style', '');
  } else {
    langAlertElem.setAttribute('style', 'display:none');
  }
};

collapseLangElem.addEventListener('click', enableDisablelangAlertElem);

export function setLangOpt() {
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

  opt.langs = langArr;

  return;
}

export async function recognizeAllClick() {
  await gs.schedulerReady;
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  const debugMode = true;

  // User can select engine directly using advanced options, or indirectly using basic options.
  let oemMode;
  if (enableAdvancedRecognitionElem.checked) {
    oemMode = oemLabelTextElem.innerHTML.toLowerCase();
  } else if (elem.recognize.ocrQuality.value === '1') {
    oemMode = 'combined';
  } else {
    oemMode = 'legacy';
    setOemLabel('legacy');
  }

  const fontPromiseArr = [];
  // Chinese requires loading a separate font.
  if (opt.langs.includes('chi_sim')) fontPromiseArr.push(loadChiSimFont());
  // Greek and Cyrillic require loading a version of the base fonts that include these characters.
  if (opt.langs.includes('rus') || opt.langs.includes('ell')) fontPromiseArr.push(loadBuiltInFontsRaw('all'));
  await Promise.all(fontPromiseArr);

  // Whether user uploaded data will be compared against in addition to both Tesseract engines
  const userUploadMode = Boolean(ocrAll['User Upload']);
  const existingOCR = Object.keys(ocrAll).filter((x) => x !== 'active').length > 0;

  // A single Tesseract engine can be used (Legacy or LSTM) or the results from both can be used and combined.
  if (oemMode === 'legacy' || oemMode === 'lstm') {
    // The last tick of the progress bar must be done after everything is finished.
    // If the progress bar finishes earlier, in addition to being misleading to users,
    // the automated browser tests wait until the progress bar fills up to conclude
    // the recognition step was successful.
    ProgressBars.recognize.show(imageCache.pageCount + 1);
    const time2a = Date.now();
    // Tesseract is used as the "main" data unless user-uploaded data exists and only the LSTM model is being run.
    // This is because Tesseract Legacy provides very strong metrics, and Abbyy often does not.
    await recognizeAllPagesBrowser(oemMode === 'legacy', oemMode === 'lstm', !(oemMode === 'lstm' && existingOCR));
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    // Metrics from the LSTM model are so inaccurate they are not worth using.
    if (oemMode === 'legacy') {
      calcFontMetricsFromPages(ocrAll['Tesseract Legacy']);
      await runFontOptimizationBrowser(ocrAll['Tesseract Legacy']);
    }
  } else if (oemMode === 'combined') {
    state.loadCount = 0;
    ProgressBars.recognize.show(imageCache.pageCount * 2 + 1);

    const time2a = Date.now();
    await recognizeAllPagesBrowser(true, true, true);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    if (debugMode) {
      debugImg.Combined = new Array(imageCache.pageCount);
      for (let i = 0; i < imageCache.pageCount; i++) {
        debugImg.Combined[i] = [];
      }
    }

    if (userUploadMode) {
      initOCRVersion('Tesseract Combined');
      setCurrentHOCR('Tesseract Combined');
      if (debugMode) {
        debugImg['Tesseract Combined'] = new Array(imageCache.pageCount);
        for (let i = 0; i < imageCache.pageCount; i++) {
          debugImg['Tesseract Combined'][i] = [];
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
    for (let i = 0; i < imageCache.pageCount; i++) {
      /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
      const compOptions1 = {
        mode: 'comb',
        evalConflicts: false,
        legacyLSTMComb: true,
      };

      const imgBinary = await imageCache.getBinary(i);

      const res1 = await gs.scheduler.compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions1,
      });

      ocrAll['Tesseract Combined Temp'][i] = res1.page;
    }

    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(imageCache.pageCount - 1, 5);
    await imageCache.preRenderRange(0, pageNum, true);
    calcFontMetricsFromPages(ocrAll['Tesseract Combined Temp']);
    await runFontOptimizationBrowser(ocrAll['Tesseract Combined Temp']);
    initOCRVersion('Combined');
    setCurrentHOCR('Combined');

    const time3a = Date.now();
    for (let i = 0; i < imageCache.pageCount; i++) {
      const tessCombinedLabel = userUploadMode ? 'Tesseract Combined' : 'Combined';

      /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
      const compOptions = {
        mode: 'comb',
        debugLabel: tessCombinedLabel,
        ignoreCap: ignoreCapElem.checked,
        ignorePunct: ignorePunctElem.checked,
        confThreshHigh: parseInt(elem.info.confThreshHigh.value),
        confThreshMed: parseInt(elem.info.confThreshMed.value),
        legacyLSTMComb: true,
      };

      const imgBinary = await imageCache.getBinary(i);

      const res = await gs.scheduler.compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      debugImg[tessCombinedLabel][i] = res.debugImg;

      ocrAll[tessCombinedLabel][i] = res.page;

      // If the user uploaded data, compare to that as we
      if (userUploadMode) {
        if (elem.recognize.combineMode.value === 'conf') {
          /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
          const compOptions2 = {
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(elem.info.confThreshHigh.value),
            confThreshMed: parseInt(elem.info.confThreshMed.value),
            editConf: true,
          };

          const res2 = await gs.scheduler.compareOCR({
            pageA: ocrAll['User Upload'][i],
            pageB: ocrAll['Tesseract Combined'][i],
            binaryImage: imgBinary,
            pageMetricsObj: pageMetricsArr[i],
            options: compOptions2,
          });

          debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        } else {
          /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
          const compOptions2 = {
            mode: 'comb',
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(elem.info.confThreshHigh.value),
            confThreshMed: parseInt(elem.info.confThreshMed.value),
          };

          const res2 = await gs.scheduler.compareOCR({
            pageA: ocrAll['User Upload'][i],
            pageB: ocrAll['Tesseract Combined'][i],
            binaryImage: imgBinary,
            pageMetricsObj: pageMetricsArr[i],
            options: compOptions2,
          });

          debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        }
      }
    }
    const time3b = Date.now();
    if (debugMode) console.log(`Comparison runtime: ${time3b - time3a} ms`);
  }

  ProgressBars.active.increment();

  renderPageQueue(cp.n);

  // Enable confidence threshold input boxes (only used for Tesseract)
  elem.info.confThreshHigh.disabled = false;
  elem.info.confThreshMed.disabled = false;

  // Set threshold values if not already set
  elem.info.confThreshHigh.value = elem.info.confThreshHigh.value || '85';
  elem.info.confThreshMed.value = elem.info.confThreshMed.value || '75';

  toggleEditButtons(false);

  return (true);
}
