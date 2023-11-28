
// await import("../../tess/worker.min.js")

// import tess from "../../tess/tesseract.js/src/worker-script/browser/index.js";

import { convertPageAbbyy, convertPageHocr, convertPageStext } from "./convertPageModule.js";
import { optimizeFont } from "./optimizeFontModule.js";
import { loadFontContainerAll } from "../objects/fontObjects.js";
import { evalPageFont, evalPage, evalWords, compareHOCR, setFontAll, nudgePageFontSize, nudgePageBaseline } from "./compareOCRModule.js";

// import Tesseract from "../../tess/tesseract.esm.min.js";
const browserMode = typeof process === "undefined";

if (browserMode) {
  globalThis.Tesseract = (await import("../../tess/tesseract.esm.min.js")).default;
} else {
  globalThis.Tesseract = await import("tesseract.js");
}


const defaultConfigs = {
  // TODO: Add back support for multiple PSM modes.
  // There is already an advanced option in the UI that claims to switch this, but it currently does nothing. 
  tessedit_pageseg_mode: Tesseract.PSM["SINGLE_COLUMN"],
  hocr_char_boxes: '1',
  // The Tesseract LSTM engine frequently identifies a bar character "|"
  // This is virtually always a false positive (usually "I").
  tessedit_char_blacklist: "|éï",
  debug_file: "/debug.txt",
  max_page_gradient_recognize: "100",
  hocr_font_info: "1",
  // classify_enable_learning: "0",
  // classify_enable_adaptive_matcher: "0",
  // tessedit_enable_doc_dict: "0"
};


let oemCurrent = 1;

// Custom build is currently only used for browser version, while the Node.js version uses the published npm package.
// If recognition capabilities are ever added for the Node.js version, then we should use the same build for consistency. . 
const tessConfig = browserMode ? { corePath: '/tess/', workerPath: '/tess/worker.min.js', legacyCore: true, legacyLang: true, workerBlobURL: false} : {legacyCore: true, legacyLang: true};

const worker = await Tesseract.createWorker("eng", 1, tessConfig);
await worker.setParameters(defaultConfigs);

const reinitialize = async ({langs, oem}) => {
  oemCurrent = oem;
  await worker.reinitialize(langs, oem);
  await worker.setParameters(defaultConfigs);
}


/**
 * Asynchronously recognizes or processes an image based on specified options and parameters.
 * 
 * @param {Object} params - 
 * @param {ArrayBuffer} params.image - 
 * @param {Object} params.options - 
 * @param {string} params.output - 
 * @param {number} params.n - 
 * @param {?number} [params.knownAngle] - The known angle, or `null` if the angle is not known at the time of recognition.
 * @param {?string} [params.engineName] - 
 * @param {?dims} [params.pageDims] - 
 */
const recognizeAndConvert = async ({image, options, output, n, knownAngle = null, pageDims = null}) => {
  const res1 = await worker.recognize(image, options, output);

  const angle = knownAngle === null || knownAngle === undefined ? res1.data.rotateRadians * (180 / Math.PI) * -1 : knownAngle;

  const keepBold = oemCurrent == 0 ? true : false;

  const res2 = await convertPageHocr({ocrStr: res1.data.hocr, n: n, pageDims: pageDims, rotateAngle: angle, keepBold: keepBold});

  return { recognize: res1.data, convert: res2};
}

const recognize = async ({image, options, output}) => {
  const res1 = await worker.recognize(image, options, output);
  return res1.data;
}

const fontAll = {
  /**@type {?fontContainerAll}*/
  raw: null,
  /**@type {?fontContainerAll}*/
  opt: null,
  /**@type {?fontContainerAll}*/
  active: null
}

setFontAll(fontAll);
  
  
async function loadFontContainerAllWorker({CarlitoSrc, CenturySrc, NimbusRomNo9LSrc, NimbusSansSrc, opt = false}) {
  fontAll.active = await loadFontContainerAll(CarlitoSrc, CenturySrc, NimbusRomNo9LSrc, NimbusSansSrc, opt);
  return true;
}

globalThis.globalSettings = {
  simdSupport: false,
  defaultFont: "SerifDefault",
  defaultFontSans: "NimbusSanL",
  defaultFontSerif: "NimbusRomNo9L"
}

async function setGlobalSettings({globalSettings}) {
  globalThis.globalSettings = globalSettings;
}

addEventListener('message', async e => {
    const func = e.data[0];
    const args = e.data[1];
    const id = e.data[2];  

    ({
        // Convert page functions
        convertPageAbbyy,
        convertPageHocr,
        convertPageStext,

        // Optimize font functions
        optimizeFont,

        // Load font functions
        loadFontContainerAllWorker,

        // OCR comparison/evaluation functions
        evalPageFont,
        evalPage,
        evalWords,
        compareHOCR,
        nudgePageFontSize,
        nudgePageBaseline,

        // Recognition
        reinitialize,
        recognize,
        recognizeAndConvert,

        // Change state of worker
        setGlobalSettings,
      })[func](args)
        .then((x) => postMessage({data: x, id: id}));
    
  });
  
