import { inputData, opt } from './containers/app.js';
import {
  convertPageWarn,
  DebugData,
  evalStats,
  layoutDataTables, ocrAll, pageMetricsArr, visInstructions,
} from './containers/dataContainer.js';
import { ImageCache, ImageWrapper } from './containers/imageContainer.js';
import { loadBuiltInFontsRaw, loadChiSimFont } from './fontContainerMain.js';
import { runFontOptimization } from './fontEval.js';
import { calcFontMetricsFromPages } from './fontStatistics.js';
import { gs } from './generalWorkerMain.js';
import { PageMetrics } from './objects/pageMetricsObjects.js';

/**
 *
 * @param {OcrPage} pageA
 * @param {OcrPage} pageB
 * @param {number} n
 * @param  {Parameters<import('./worker/compareOCRModule.js').compareOCRPageImp>[0]['options']} options
 * node-canvas does not currently work in worker threads.
 * See: https://github.com/Automattic/node-canvas/issues/1394
 * Therefore, we need this wrapper function that detects Node.js and runs the function in the main thread.
 * Additionally, this function adds arguments to the function call that are not available in the worker thread.
 */
export const compareOCRPage = async (pageA, pageB, n, options) => {
  const func = typeof process !== 'undefined' ? (await import('./worker/compareOCRModule.js')).compareOCRPageImp : gs.scheduler.compareOCRPageImp;
  const binaryImage = await ImageCache.getBinary(n);
  const pageMetricsObj = pageMetricsArr[n];
  return func({
    pageA, pageB, binaryImage, pageMetricsObj, options,
  });
};

/**
 *  Calculate what arguments to use with Tesseract `recognize` function relating to rotation.
 *
 * @param {number} n - Page number to recognize.
 */
export const calcRecognizeRotateArgs = async (n, areaMode) => {
  // Whether the binary image should be rotated internally by Tesseract
  // This should always be true (Tesseract results are horrible without auto-rotate) but kept as a variable for debugging purposes.
  const rotate = true;

  // Whether the rotated images should be saved, overwriting any non-rotated images.
  const autoRotate = true;

  // Threshold (in radians) under which page angle is considered to be effectively 0.
  const angleThresh = 0.0008726646;

  const angle = pageMetricsArr[n]?.angle;

  // Whether the page angle is already known (or needs to be detected)
  const angleKnown = typeof (angle) === 'number';

  const nativeN = await ImageCache.getNative(n);

  // Calculate additional rotation to apply to page.  Rotation should not be applied if page has already been rotated.
  const rotateDegrees = rotate && angle && Math.abs(angle || 0) > 0.05 && !nativeN.rotated ? angle * -1 : 0;
  const rotateRadians = rotateDegrees * (Math.PI / 180);

  let saveNativeImage = false;
  let saveBinaryImageArg = false;

  // Images are not saved when using "recognize area" as these intermediate images are cropped.
  if (!areaMode) {
    const binaryN = await ImageCache.binary[n];
    // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
    if (autoRotate && !nativeN.rotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveNativeImage = true;
    if (!binaryN || autoRotate && !binaryN.rotated && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveBinaryImageArg = true;
  }

  return {
    angleThresh,
    angleKnown,
    rotateRadians,
    saveNativeImage,
    saveBinaryImageArg,
  };
};

/**
 * Run recognition on a page and save the results, including OCR data and (possibly) auto-rotated images, to the appropriate global array.
 *
 * @param {number} n - Page number to recognize.
 * @param {boolean} legacy -
 * @param {boolean} lstm -
 * @param {boolean} areaMode -
 * @param {Object<string, string>} tessOptions - Options to pass to Tesseract.js.
 * @param {boolean} [debugVis=false] - Generate instructions for debugging visualizations.
 */
export const recognizePage = async (n, legacy, lstm, areaMode, tessOptions = {}, debugVis = false) => {
  const {
    angleThresh, angleKnown, rotateRadians, saveNativeImage, saveBinaryImageArg,
  } = await calcRecognizeRotateArgs(n, areaMode);

  const nativeN = await ImageCache.getNative(n);

  if (!nativeN) throw new Error(`No image source found for page ${n}`);

  const config = {
    ...{
      rotateRadians, rotateAuto: !angleKnown, legacy, lstm,
    },
    ...tessOptions,
  };

  const pageDims = pageMetricsArr[n].dims;

  // If `legacy` and `lstm` are both `false`, recognition is not run, but layout analysis is.
  // This combination of options would be set for debug mode, where the point of running Tesseract
  // is to get debugging images for layout analysis rather than get text.
  const runRecognition = legacy || lstm;

  const scheduler = await gs.getGeneralScheduler();

  const resArr = await scheduler.recognizeAndConvert2({
    image: nativeN.src,
    options: config,
    output: {
      // text, blocks, hocr, and tsv must all be `false` to disable recognition
      text: runRecognition,
      blocks: runRecognition,
      hocr: runRecognition,
      tsv: runRecognition,
      layoutBlocks: !runRecognition,
      imageBinary: saveBinaryImageArg,
      imageColor: saveNativeImage,
      debug: true,
      debugVis,
    },
    n,
    knownAngle: pageMetricsArr[n].angle,
    pageDims,
  });

  const res0 = await resArr[0];

  // const printDebug = true;
  // if (printDebug && typeof process === 'undefined') {
  //   if (legacy && lstm) {
  //     resArr[1].then((res1) => {
  //       console.log(res1.recognize.debug);
  //     });
  //   } else {
  //     console.log(res0.recognize.debug);
  //   }
  // }

  // parseDebugInfo(res0.recognize.debug);

  if (!angleKnown) pageMetricsArr[n].angle = (res0.recognize.rotateRadians || 0) * (180 / Math.PI) * -1;

  // An image is rotated if either the source was rotated or rotation was applied by Tesseract.
  const isRotated = Boolean(res0.recognize.rotateRadians || 0) || nativeN.rotated;

  // Images from Tesseract should not overwrite the existing images in the case where rotateAuto is true,
  // but no significant rotation was actually detected.
  const significantRotation = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;

  const upscale = tessOptions.upscale || false;
  if (saveBinaryImageArg && res0.recognize.imageBinary && (significantRotation || !ImageCache.binary[n])) {
    ImageCache.binary[n] = new ImageWrapper(n, res0.recognize.imageBinary, 'binary', isRotated, upscale);
  }

  if (saveNativeImage && res0.recognize.imageColor && significantRotation) {
    ImageCache.native[n] = new ImageWrapper(n, res0.recognize.imageColor, 'native', isRotated, upscale);
  }

  return resArr;
};

/**
 * Display warning/error message to user if missing character-level data.
 *
 * @param {Array<Object.<string, string>>} warnArr - Array of objects containing warning/error messages from convertPage
 */
export function checkCharWarn(warnArr) {
  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.

  const charErrorCt = warnArr.filter((x) => x?.char === 'char_error').length;
  const charWarnCt = warnArr.filter((x) => x?.char === 'char_warning').length;
  const charGoodCt = warnArr.length - charErrorCt - charWarnCt;

  const browserMode = typeof process === 'undefined';

  // The UI warning/error messages cannot be thrown within this function,
  // as that would make this file break when imported into contexts that do not have the main UI.
  if (charGoodCt === 0 && charErrorCt > 0) {
    if (browserMode) {
      const errorHTML = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
        <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      opt.errorHandler(errorHTML);
    } else {
      const errorText = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      opt.errorHandler(errorText);
    }
  } if (charGoodCt === 0 && charWarnCt > 0) {
    if (browserMode) {
      const warningHTML = `No character-level OCR data detected. Font optimization features will be disabled. 
        <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      opt.warningHandler(warningHTML);
    } else {
      const errorText = `No character-level OCR data detected. Font optimization features will be disabled. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      opt.warningHandler(errorText);
    }
  }
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
 * @param {("hocr"|"abbyy"|"stext"|"blocks")} format - Format of raw data.
 * @param {string} engineName - Name of OCR engine.
 * @param {boolean} [scribeMode=false] - Whether this is HOCR data from this program.
 */
async function convertOCRPage(ocrRaw, n, mainData, format, engineName, scribeMode = false) {
  let func = 'convertPageHocr';
  if (format === 'abbyy') {
    func = 'convertPageAbbyy';
  } else if (format === 'stext') {
    func = 'convertPageStext';
  } else if (format === 'blocks') {
    func = 'convertPageBlocks';
  }

  // Imports are always run in workers in actual use, however for debugging purposes they can be run in the main thread.
  let res;
  const parallel = true;
  if (parallel) {
    await gs.getGeneralScheduler();
    res = await gs.schedulerInner.addJob(func, { ocrStr: ocrRaw, n, scribeMode });
  } else if (func === 'convertPageHocr') {
    res = await import('./import/convertPageHocr.js').then((m) => m.convertPageHocr({ ocrStr: ocrRaw, n, scribeMode }));
  } else if (func === 'convertPageAbbyy') {
    res = await import('./import/convertPageAbbyy.js').then((m) => m.convertPageAbbyy({ ocrStr: ocrRaw, n, scribeMode }));
  } else if (func === 'convertPageStext') {
    res = await import('./import/convertPageStext.js').then((m) => m.convertPageStext({ ocrStr: ocrRaw, n, scribeMode }));
  } else if (func === 'convertPageBlocks') {
    res = await import('./import/convertPageBlocks.js').then((m) => m.convertPageBlocks({ ocrStr: ocrRaw, n, scribeMode }));
  }

  await convertPageCallback(res, n, mainData, engineName);
}

/**
 * This function is called after running a `convertPage` (or `recognizeAndConvert`) function, updating the globals with the results.
 * This needs to be a separate function from `convertOCRPage`, given that sometimes recognition and conversion are combined by using `recognizeAndConvert`.
 *
 * @param {Awaited<ReturnType<typeof import('./worker/generalWorker.js').recognizeAndConvert>>['convert']} params
 * @param {number} n
 * @param {boolean} mainData
 * @param {string} engineName - Name of OCR engine.
 * @returns
 */
export async function convertPageCallback({
  pageObj, dataTables, warn, langSet,
}, n, mainData, engineName) {
  const fontPromiseArr = [];
  if (langSet.has('chi_sim')) fontPromiseArr.push(loadChiSimFont());
  if (langSet.has('rus') || langSet.has('ukr') || langSet.has('ell')) fontPromiseArr.push(loadBuiltInFontsRaw('all'));
  await Promise.all(fontPromiseArr);

  if (['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName)) ocrAll['Tesseract Latest'][n] = pageObj;

  if (engineName) ocrAll[engineName][n] = pageObj;

  // If this is flagged as the "main" data, then save the stats.
  if (mainData) {
    convertPageWarn[n] = warn;

    // The main OCR data is always preferred for setting page metrics.
    // This matters when the user uploads their own data, as the images are expected to be rendered at the same resolution as the OCR data.
    if (pageObj.dims.height && pageObj.dims.width) pageMetricsArr[n] = new PageMetrics(pageObj.dims);

    pageMetricsArr[n].angle = pageObj.angle;
  }

  inputData.xmlMode[n] = true;

  // Layout boxes are only overwritten if none exist yet for the page
  if (Object.keys(layoutDataTables.pages[n].tables).length === 0) layoutDataTables.pages[n] = dataTables;

  opt.progressHandler({ n, type: 'convert', info: { engineName } });
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
 * @param {boolean} [scribeMode=false] - Whether this is HOCR data from this program.
 */
export async function convertOCRAll(ocrRawArr, mainData, format, engineName, scribeMode) {
  // For each page, process OCR using web worker
  const promiseArr = [];
  for (let n = 0; n < ocrRawArr.length; n++) {
    promiseArr.push(convertOCRPage(ocrRawArr[n], n, mainData, format, engineName, scribeMode));
  }
  await Promise.all(promiseArr);
}

/**
 *
 * @param {boolean} legacy
 * @param {boolean} lstm
 * @param {boolean} mainData
 * @param {Array<string>} [langs=['eng']]
 * @param {boolean} [vanillaMode=false]
 */
export async function recognizeAllPages(legacy = true, lstm = true, mainData = false, langs = ['eng'], vanillaMode = false) {
  // Render all PDF pages to PNG if needed
  // This step should not create binarized images as they will be created by Tesseract during recognition.
  if (inputData.pdfMode) await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, false);

  if (legacy) {
    const oemText = 'Tesseract Legacy';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(inputData.pageCount);
    ocrAll.active = ocrAll[oemText];
  }

  if (lstm) {
    const oemText = 'Tesseract LSTM';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(inputData.pageCount);
    ocrAll.active = ocrAll[oemText];
  }

  // 'Tesseract Latest' includes the last version of Tesseract to run.
  // It exists only so that data can be consistently displayed during recognition,
  // should never be enabled after recognition is complete, and should never be editable by the user.
  {
    const oemText = 'Tesseract Latest';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(inputData.pageCount);
    ocrAll.active = ocrAll[oemText];
  }

  await gs.initTesseract({ anyOk: false, vanillaMode, langs });

  // If Legacy and LSTM are both requested, LSTM completion is tracked by a second array of promises (`promisesB`).
  // In this case, `convertPageCallbackBrowser` can be run after the Legacy recognition is finished,
  // however this function only returns after all recognition is completed.
  // This provides no performance benefit in absolute terms, however halves the amount of time the user has to wait
  // before seeing the initial recognition results.
  const inputPages = [...Array(ImageCache.pageCount).keys()];
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

  // Upscaling is enabled only for image data, and only if the user has explicitly enabled it.
  // For PDF data, if upscaling is desired, that should be handled by rendering the PDF at a higher resolution.
  // const upscale = inputData.imageMode && elem.recognize.enableUpscale.checked;
  const upscale = inputData.imageMode && opt.enableUpscale;

  const config = { upscale };

  for (const x of inputPages) {
    recognizePage(x, legacy, lstm, false, config, opt.debugVis).then(async (resArr) => {
      const res0 = await resArr[0];

      if (res0.recognize.debugVis) {
        const { ScrollView } = await import('../scrollview-web/scrollview/ScrollView.js');
        const sv = new ScrollView(true);
        await sv.processVisStr(res0.recognize.debugVis);
        visInstructions[x] = await sv.getAll(true);
      }

      if (legacy) {
        await convertPageCallback(res0.convert.legacy, x, mainData, 'Tesseract Legacy');
        resolvesA[x].resolve();
      } else if (lstm) {
        await convertPageCallback(res0.convert.lstm, x, false, 'Tesseract LSTM');
        resolvesA[x].resolve();
      }

      if (legacy && lstm) {
        (async () => {
          const res1 = await resArr[1];
          await convertPageCallback(res1.convert.lstm, x, false, 'Tesseract LSTM');
          resolvesB[x].resolve();
        })();
      }
    });
  }

  await Promise.all(promisesA);

  if (mainData) {
    await checkCharWarn(convertPageWarn);
  }

  if (legacy && lstm) await Promise.all(promisesB);

  if (lstm) {
    const oemText = 'Tesseract LSTM';
    ocrAll.active = ocrAll[oemText];
  } else {
    const oemText = 'Tesseract Legacy';
    ocrAll.active = ocrAll[oemText];
  }
}

/**
 *
 * @param {Object} options
 * @param {'speed'|'quality'} [options.mode='quality'] - Recognition mode.
 * @param {Array<string>} [options.langs=['eng']] - Language(s) in document.
 * @param {'lstm'|'legacy'|'combined'} [options.modeAdv='combined'] - Alternative method of setting recognition mode.
 * @param {'conf'|'data'} [options.combineMode='data'] - Method of combining OCR results. Used if OCR data already exists.
 * @param {boolean} [options.vanillaMode=false] - Whether to use the vanilla Tesseract.js model.
 *
 */
export async function recognize(options = {}) {
  await gs.getGeneralScheduler();

  const combineMode = options && options.combineMode ? options.combineMode : 'data';
  const vanillaMode = options && options.vanillaMode !== undefined ? options.vanillaMode : false;

  const langs = options && options.langs ? options.langs : ['eng'];
  let oemMode = 'combined';
  if (options && options.modeAdv) {
    oemMode = options.modeAdv;
  } else if (options && options.mode) {
    oemMode = options.mode === 'speed' ? 'lstm' : 'legacy';
  }

  const fontPromiseArr = [];
  // Chinese requires loading a separate font.
  if (langs.includes('chi_sim')) fontPromiseArr.push(loadChiSimFont());
  // Greek and Cyrillic require loading a version of the base fonts that include these characters.
  if (langs.includes('rus') || langs.includes('ukr') || langs.includes('ell')) fontPromiseArr.push(loadBuiltInFontsRaw('all'));
  await Promise.all(fontPromiseArr);

  // Whether user uploaded data will be compared against in addition to both Tesseract engines
  const userUploadMode = Boolean(ocrAll['User Upload']);
  const existingOCR = Object.keys(ocrAll).filter((x) => x !== 'active').length > 0;

  // A single Tesseract engine can be used (Legacy or LSTM) or the results from both can be used and combined.
  if (oemMode === 'legacy' || oemMode === 'lstm') {
    // Tesseract is used as the "main" data unless user-uploaded data exists and only the LSTM model is being run.
    // This is because Tesseract Legacy provides very strong metrics, and Abbyy often does not.
    await recognizeAllPages(oemMode === 'legacy', oemMode === 'lstm', !(oemMode === 'lstm' && existingOCR), langs, vanillaMode);

    // Metrics from the LSTM model are so inaccurate they are not worth using.
    if (oemMode === 'legacy') {
      calcFontMetricsFromPages(ocrAll['Tesseract Legacy']);
      opt.enableOpt = await runFontOptimization(ocrAll['Tesseract Legacy']);
    }
  } else if (oemMode === 'combined') {
    await recognizeAllPages(true, true, true, langs, vanillaMode);

    if (opt.saveDebugImages) {
      DebugData.debugImg.Combined = new Array(ImageCache.pageCount);
      for (let i = 0; i < ImageCache.pageCount; i++) {
        DebugData.debugImg.Combined[i] = [];
      }
    }

    if (userUploadMode) {
      const oemText = 'Tesseract Combined';
      if (!ocrAll[oemText]) ocrAll[oemText] = Array(inputData.pageCount);
      ocrAll.active = ocrAll[oemText];

      if (opt.saveDebugImages) {
        DebugData.debugImg['Tesseract Combined'] = new Array(ImageCache.pageCount);
        for (let i = 0; i < ImageCache.pageCount; i++) {
          DebugData.debugImg['Tesseract Combined'][i] = [];
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
    if (!ocrAll['Tesseract Combined Temp']) ocrAll['Tesseract Combined Temp'] = Array(inputData.pageCount);
    for (let i = 0; i < ImageCache.pageCount; i++) {
      /** @type {Parameters<typeof compareOCRPage>[3]} */
      const compOptions1 = {
        mode: 'comb',
        evalConflicts: false,
        legacyLSTMComb: true,
      };

      const res1 = await compareOCRPage(ocrAll['Tesseract Legacy'][i], ocrAll['Tesseract LSTM'][i], i, compOptions1);

      ocrAll['Tesseract Combined Temp'][i] = res1.page;
    }

    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(ImageCache.pageCount - 1, 5);
    await ImageCache.preRenderRange(0, pageNum, true);
    calcFontMetricsFromPages(ocrAll['Tesseract Combined Temp']);
    opt.enableOpt = await runFontOptimization(ocrAll['Tesseract Combined Temp']);

    const oemText = 'Combined';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(inputData.pageCount);
    ocrAll.active = ocrAll[oemText];

    const comparePageI = async (i) => {
      const tessCombinedLabel = userUploadMode ? 'Tesseract Combined' : 'Combined';

      /** @type {Parameters<typeof compareOCRPage>[3]} */
      const compOptions = {
        mode: 'comb',
        debugLabel: tessCombinedLabel,
        ignoreCap: opt.ignoreCap,
        ignorePunct: opt.ignorePunct,
        confThreshHigh: opt.confThreshHigh,
        confThreshMed: opt.confThreshMed,
        legacyLSTMComb: true,
      };

      const res = await compareOCRPage(ocrAll['Tesseract Legacy'][i], ocrAll['Tesseract LSTM'][i], i, compOptions);

      if (DebugData.debugImg[tessCombinedLabel]) DebugData.debugImg[tessCombinedLabel][i] = res.debugImg;

      ocrAll[tessCombinedLabel][i] = res.page;

      // If the user uploaded data, compare to that as we
      if (userUploadMode) {
        if (combineMode === 'conf') {
          /** @type {Parameters<typeof compareOCRPage>[3]} */
          const compOptions2 = {
            debugLabel: 'Combined',
            supplementComp: true,
            // The `tessScheduler` property must be defined manually for Node.js, which runs this function in the main thread.
            // In the browser, this is run in a worker, and the Tesseract module is defined automatically there.
            tessScheduler: typeof process !== 'undefined' ? gs.schedulerInner : undefined,
            ignoreCap: opt.ignoreCap,
            ignorePunct: opt.ignorePunct,
            confThreshHigh: opt.confThreshHigh,
            confThreshMed: opt.confThreshMed,
            editConf: true,
          };

          const res2 = await compareOCRPage(ocrAll['User Upload'][i], ocrAll['Tesseract Combined'][i], i, compOptions2);

          if (DebugData.debugImg.Combined) DebugData.debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        } else {
          /** @type {Parameters<typeof compareOCRPage>[3]} */
          const compOptions2 = {
            mode: 'comb',
            debugLabel: 'Combined',
            supplementComp: true,
            // The `tessScheduler` property must be defined manually for Node.js, which runs this function in the main thread.
            // In the browser, this is run in a worker, and the Tesseract module is defined automatically there.
            tessScheduler: typeof process !== 'undefined' ? gs.schedulerInner : undefined,
            ignoreCap: opt.ignoreCap,
            ignorePunct: opt.ignorePunct,
            confThreshHigh: opt.confThreshHigh,
            confThreshMed: opt.confThreshMed,
          };

          const res2 = await compareOCRPage(ocrAll['User Upload'][i], ocrAll['Tesseract Combined'][i], i, compOptions2);

          if (DebugData.debugImg.Combined) DebugData.debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        }
      }
    };

    if (typeof process === 'undefined') {
      const indices = [...Array(ImageCache.pageCount).keys()];
      const compPromises = indices.map(async (i) => comparePageI(i));
      await Promise.allSettled(compPromises);
    } else {
      // This needs to be run one at a time in Node.js, as this is run in the main thread,
      // and there is no mechanism for queuing jobs, so side effects will interfere with each other.
      for (let i = 0; i < ImageCache.pageCount; i++) {
        await comparePageI(i);
      }
    }
  }

  return (ocrAll.active);
}

let evalStatsConfig = {
  /** @type {string|undefined} */
  ocrActive: undefined,
  ignorePunct: opt.ignorePunct,
  ignoreCap: opt.ignoreCap,
  ignoreExtra: opt.ignoreExtra,
};

// TODO: What this set of functions does makes no sense.
// Specifically, after comparing to ground truth for all pages, ground truth is then compared to the current page.
// However, the page should be re-compared after making edits to the OCR data, not upon loading the page.
// With the current strategy, edits would only be implemented if the user changes pages and then changes back again.
// Also, this is not clean to add to the interface, as it only makes sense in the context of the GUI.
// Consider splitting into compareGroundTruthPage and compareGroundTruth functions.
// ALternatively, do we even need this in the interface? We already have compareOCRPage, so the building blocks are there.
// There does need to be some easy way to benchmark OCR data however, so we may need this.
export async function compareGroundTruth(n) {
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  const oemActive = Object.keys(ocrAll).find((key) => ocrAll[key] === ocrAll.active && key !== 'active');

  const evalStatsConfigNew = {
    ocrActive: oemActive,
    ignorePunct: opt.ignorePunct,
    ignoreCap: opt.ignoreCap,
    ignoreExtra: opt.ignoreExtra,
  };
  /** @type {Parameters<typeof compareOCRPage>[3]} */
  const compOptions = {
    ignorePunct: opt.ignorePunct,
    ignoreCap: opt.ignoreCap,
    confThreshHigh: opt.confThreshHigh,
    confThreshMed: opt.confThreshMed,
  };

  // Compare all pages if this has not been done already with the current settings
  if (JSON.stringify(evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || evalStats.length === 0) {
    // Render binarized versions of images
    await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, true);

    for (let i = 0; i < ImageCache.pageCount; i++) {
      const res = await compareOCRPage(ocrAll.active[i], ocrAll['Ground Truth'][i], i, compOptions);

      // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
      // rather than the currently active OCR.
      // Assigning to "active" will overwrite whatever version the user currently has open.
      ocrAll.active[i] = res.page;

      if (res.metrics) evalStats[i] = res.metrics;
    }

    evalStatsConfig = evalStatsConfigNew;
  }

  const res = await compareOCRPage(ocrAll.active[n], ocrAll['Ground Truth'][n], n, compOptions);

  // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
  // rather than the currently active OCR.
  // Assigning to "active" will overwrite whatever version the user currently has open.
  ocrAll.active[n] = res.page;

  if (res.metrics) evalStats[n] = res.metrics;
}

export const calcEvalStatsDoc = () => {
  const evalStatsDoc = {
    total: 0,
    correct: 0,
    incorrect: 0,
    missed: 0,
    extra: 0,
    correctLowConf: 0,
    incorrectHighConf: 0,
  };

  for (let i = 0; i < evalStats.length; i++) {
    evalStatsDoc.total += evalStats[i].total;
    evalStatsDoc.correct += evalStats[i].correct;
    evalStatsDoc.incorrect += evalStats[i].incorrect;
    evalStatsDoc.missed += evalStats[i].missed;
    evalStatsDoc.extra += evalStats[i].extra;
    evalStatsDoc.correctLowConf += evalStats[i].correctLowConf;
    evalStatsDoc.incorrectHighConf += evalStats[i].incorrectHighConf;
  }
  return evalStatsDoc;
};
