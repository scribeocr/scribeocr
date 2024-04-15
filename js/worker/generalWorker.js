// await import("../../tess/worker.min.js")

// import tess from "../../tess/tesseract.js/src/worker-script/browser/index.js";

import { convertPageHocr } from './convertPageHocr.js';
import { convertPageAbbyy } from './convertPageAbbyy.js';
import { convertPageStext } from './convertPageStext.js';
import { convertPageBlocks } from './convertPageBlocks.js';

import { optimizeFont } from './optimizeFontModule.js';
import { loadFontContainerAll, fontAll } from '../containers/fontContainer.js';
import {
  evalPageFont, evalPage, evalWords, compareHOCR, nudgePageFontSize, nudgePageBaseline,
} from './compareOCRModule.js';

// import Tesseract from "../../tess/tesseract.esm.min.js";
const browserMode = typeof process === 'undefined';

if (browserMode) {
  globalThis.Tesseract = (await import('../../tess/tesseract.esm.min.js')).default;
} else {
  // eslint-disable-next-line import/no-relative-packages
  globalThis.Tesseract = await import('tesseract.js/src/index.js');
}

const defaultConfigs = {
  // TODO: Add back support for multiple PSM modes.
  // There is already an advanced option in the UI that claims to switch this, but it currently does nothing.
  // tessedit_pageseg_mode: Tesseract.PSM["SINGLE_COLUMN"],
  tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  hocr_char_boxes: '1',
  // The Tesseract LSTM engine frequently identifies a bar character "|"
  // This is virtually always a false positive (usually "I").
  tessedit_char_blacklist: '|éï',
  max_page_gradient_recognize: '100',
  hocr_font_info: '1',
  // This option disables an undesirable behavior where Tesseract categorizes blobs *of any size* as noise,
  // simply because they are too rectangular.  This option should always be enabled outside of debugging purposes.
  textord_noise_area_ratio: '1',
  // Table detection appears to interfere with the layout analysis of some documents with multi-column layouts,
  // causing columns to be combined into a single line.  This should be investigated in more detail,
  // but disabling as it does not seem to improve results even when the input document is a table.
  textord_tabfind_find_tables: '0',
  // classify_enable_learning: '0',
  // classify_enable_adaptive_matcher: '0',
  // tessedit_enable_doc_dict: '0',
  // chop_enable: '0'
};

const initConfigs = {
  // load_system_dawg: '0',
  load_freq_dawg: '0',
  // load_unambig_dawg: '0',
  // load_punc_dawg: '0',
  // load_number_dawg: '0',
  // load_bigram_dawg: '0',
};

let oemCurrent = 2;
let langArrCurrent = ['eng'];

let vanillaMode_ = false;
const corePath = vanillaMode_ ? '/tess/core_vanilla/' : '/tess/core/';

// Custom build is currently only used for browser version, while the Node.js version uses the published npm package.
// If recognition capabilities are ever added for the Node.js version, then we should use the same build for consistency. .
const tessConfig = browserMode ? {
  corePath,
  workerPath: '/tess/worker.min.js',
  // langPath: '/tess/tessdata_dist',
  legacyCore: true,
  legacyLang: true,
  workerBlobURL: false,
} : { legacyCore: true, legacyLang: true };

let worker = await Tesseract.createWorker(langArrCurrent, oemCurrent, tessConfig, initConfigs);
await worker.setParameters(defaultConfigs);

/**
 * Function to change language, OEM, and vanilla mode.
 * All arguments can be set to `null` to keep the current settings.
 * This function should return early if requested settings match the current settings.
 *
 * @param {Object} param
 * @param {?Array<string>} param.langs
 * @param {?number} param.oem
 * @param {?boolean} param.vanillaMode
 */
const reinitialize = async ({ langs, oem, vanillaMode }) => {
  const langArr = typeof langs === 'string' ? langs.split('+') : langs;
  const changeLang = langs && JSON.stringify(langArr.sort()) !== JSON.stringify(langArrCurrent.sort());
  // oem can be 0, so using "truthy" checks does not work
  const changeOEM = oem !== null && oem !== undefined && oem !== oemCurrent;
  const changeVanilla = vanillaMode && vanillaMode !== vanillaMode_;

  if (!changeLang && !changeOEM && !changeVanilla) return;
  if (changeLang) langArrCurrent = langArr;
  if (changeOEM) oemCurrent = oem;
  if (changeVanilla) vanillaMode_ = vanillaMode;

  // The worker only needs to be re-created from scratch if the build of Tesseract being used changes.
  if (changeVanilla) {
    tessConfig.corePath = vanillaMode_ ? '/tess/core_vanilla/' : '/tess/core/';
    await worker.terminate();
    worker = await Tesseract.createWorker(langArrCurrent, oemCurrent, tessConfig, initConfigs);
  } else {
    await worker.reinitialize(langArrCurrent, oemCurrent, initConfigs);
  }

  await worker.setParameters(defaultConfigs);
};

/**
 * Asynchronously recognizes or processes an image based on specified options and parameters.
 *
 * @param {Object} params -
 * @param {ArrayBuffer} params.image -
 * @param {Object} params.options -
 * @param {Parameters<Tesseract.Worker['recognize']>[2]} params.output
 * @param {number} params.n -
 * @param {dims} params.pageDims - Original (unrotated) dimensions of input image.
 * @param {?number} [params.knownAngle] - The known angle, or `null` if the angle is not known at the time of recognition.
 * @param {?string} [params.engineName] -
 * Exported for type inference purposes, should not be imported anywhere.
 */
export const recognizeAndConvert = async ({
  image, options, output, n, knownAngle = null, pageDims,
}) => {
  const res1 = await worker.recognize(image, options, output);

  const angle = knownAngle === null || knownAngle === undefined ? (res1.data.rotateRadians || 0) * (180 / Math.PI) * -1 : knownAngle;

  const keepItalic = oemCurrent === 0;

  const ocrBlocks = /** @type {Array<import('tesseract.js').Block>} */(res1.data.blocks);

  const res2 = await convertPageBlocks({
    ocrBlocks, n, pageDims, rotateAngle: angle, keepItalic,
  });

  return { recognize: res1.data, convert: res2 };
};

/**
 * Asynchronously recognizes or processes an image based on specified options and parameters.
 *
 * @param {Object} params -
 * @param {ArrayBuffer} params.image -
 * @param {Object} params.options -
 * @param {Parameters<Tesseract.Worker['recognize']>[2]} params.output
 * @param {number} params.n -
 * @param {dims} params.pageDims - Original (unrotated) dimensions of input image.
 * @param {?number} [params.knownAngle] - The known angle, or `null` if the angle is not known at the time of recognition.
 * @param {?string} [params.engineName] -
 * Exported for type inference purposes, should not be imported anywhere.
 */
export const recognizeAndConvert2 = async ({
  image, options, output, n, pageDims, knownAngle = null,
}, id) => {
  options.upscale = false;
  // The function `worker.recognize2` returns 2 promises.
  // If both Legacy and LSTM data are requested, only the second promise will contain the LSTM data.
  // This allows the Legacy data to be used immediately, which halves the amount of delay between user
  // input and something appearing on screen.
  const resArr = await worker.recognize2(image, options, output);

  const res0 = await resArr[0];

  const angle = knownAngle === null || knownAngle === undefined ? (res0.data.rotateRadians || 0) * (180 / Math.PI) * -1 : knownAngle;

  let resLegacy;
  let resLSTM;
  if (options.lstm && options.legacy) {
    const legacyBlocks = /** @type {Array<import('tesseract.js').Block>} */(res0.data.blocks);
    resLegacy = await convertPageBlocks({
      ocrBlocks: legacyBlocks, n, pageDims, rotateAngle: angle, keepItalic: true, upscale: options.upscale,
    });
    (async () => {
      const res1 = await resArr[1];

      const lstmBlocks = /** @type {Array<import('tesseract.js').Block>} */(res1.data.blocks);
      resLSTM = await convertPageBlocks({
        ocrBlocks: lstmBlocks, n, pageDims, rotateAngle: angle, keepItalic: false, upscale: options.upscale,
      });

      const xB = { recognize: res1.data, convert: { legacy: null, lstm: resLSTM } };

      postMessage({ data: xB, id: `${id}b` });
    })();
  } else if (!options.lstm && options.legacy) {
    const legacyBlocks = /** @type {Array<import('tesseract.js').Block>} */(res0.data.blocks);
    resLegacy = await convertPageBlocks({
      ocrBlocks: legacyBlocks, n, pageDims, rotateAngle: angle, keepItalic: true, upscale: options.upscale,
    });
  } else if (options.lstm && !options.legacy) {
    const lstmBlocks = /** @type {Array<import('tesseract.js').Block>} */(res0.data.blocks);
    resLSTM = await convertPageBlocks({
      ocrBlocks: lstmBlocks, n, pageDims, rotateAngle: angle, keepItalic: false, upscale: options.upscale,
    });
  }

  const x = { recognize: res0.data, convert: { legacy: resLegacy, lstm: resLSTM } };

  postMessage({ data: x, id });

  // Both promises must resolve for the scheduler to move on, even if only one OCR engine is being run.
  if (!options.legacy || !options.lstm) postMessage({ data: null, id: `${id}b` });
};

/**
* @template {Partial<Tesseract.OutputFormats>} TO
* @param {Object} args
* @param {Parameters<Tesseract.Worker['recognize']>[0]} args.image
* @param {Parameters<Tesseract.Worker['recognize']>[1]} args.options
* @param {TO} args.output
* @returns {Promise<Tesseract.Page<TO>>}
* Exported for type inference purposes, should not be imported anywhere.
*/
export const recognize = async ({ image, options, output }) => {
  const res1 = await worker.recognize(image, options, output);
  return res1.data;
};

async function loadFontContainerAllWorker({ src, opt }) {
  if (opt) {
    fontAll.opt = await loadFontContainerAll(src, opt);
  } else {
    fontAll.raw = await loadFontContainerAll(src, opt);
  }
  return true;
}

async function setFontActiveWorker({ opt, sansDefaultName, serifDefaultName }) {
  if (opt === true) {
    fontAll.active = fontAll.opt;
  } else if (opt === false) {
    fontAll.active = fontAll.raw;
  }

  if (sansDefaultName) fontAll.sansDefaultName = sansDefaultName;
  if (serifDefaultName) fontAll.serifDefaultName = serifDefaultName;
}

globalThis.globalSettings = {
  simdSupport: false,
  defaultFont: 'SerifDefault',
  defaultFontSans: 'NimbusSanL',
  defaultFontSerif: 'NimbusRomNo9L',
};

async function setDefaultFontNameWorker({ defaultFontName }) {
  fontAll.defaultFontName = defaultFontName;
}

async function compareHOCRWrap(args) {
  args.options.tessWorker = worker;
  return await compareHOCR(args);
}

postMessage({ data: 'ready', id: 0 });

// eslint-disable-next-line no-restricted-globals
addEventListener('message', async (e) => {
  const func = e.data[0];
  const args = e.data[1];
  const id = e.data[2];

  if (func === 'recognizeAndConvert2') {
    recognizeAndConvert2(args, id);
    return;
  }

  ({
    // Convert page functions
    convertPageAbbyy,
    convertPageHocr,
    convertPageStext,
    convertPageBlocks,

    // Optimize font functions
    optimizeFont,

    // OCR comparison/evaluation functions
    evalPageFont,
    evalPage,
    evalWords,
    compareHOCR: compareHOCRWrap,
    nudgePageFontSize,
    nudgePageBaseline,

    // Recognition
    reinitialize,
    recognize,
    recognizeAndConvert,

    // Change state of worker
    loadFontContainerAllWorker,
    setFontActiveWorker,
    setDefaultFontNameWorker,
  })[func](args)
    .then((x) => postMessage({ data: x, id }));
});
