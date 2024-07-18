import { inputData, opt, state } from './containers/app.js';
import {
  debugImg,
  evalStats,
  LayoutDataTables, ocrAll, pageMetricsArr, visInstructions,
} from './containers/dataContainer.js';
import { ImageCache, ImageWrapper } from './containers/imageContainer.js';
import { gs } from './containers/schedulerContainer.js';
import { loadBuiltInFontsRaw, loadChiSimFont } from './fontContainerMain.js';
import { runFontOptimization } from './fontEval.js';
import { calcFontMetricsFromPages } from './fontStatistics.js';
import { initTesseractInWorkers } from './generalWorkerMain.js';
import { PageMetrics } from './objects/pageMetricsObjects.js';

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
 * @param {GeneralScheduler} scheduler
 * @param {number} n - Page number to recognize.
 * @param {boolean} legacy -
 * @param {boolean} lstm -
 * @param {boolean} areaMode -
 * @param {Object<string, string>} tessOptions - Options to pass to Tesseract.js.
 * @param {boolean} [debugVis=false] - Generate instructions for debugging visualizations.
 */
export const recognizePage = async (scheduler, n, legacy, lstm, areaMode, tessOptions = {}, debugVis = false) => {
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
    ImageCache.binary[n] = new ImageWrapper(n, res0.recognize.imageBinary, 'png', 'binary', isRotated, upscale);
  }

  if (saveNativeImage && res0.recognize.imageColor && significantRotation) {
    ImageCache.native[n] = new ImageWrapper(n, res0.recognize.imageColor, 'png', 'native', isRotated, upscale);
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
      state.errorHandler(errorHTML);
    } else {
      const errorText = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      state.errorHandler(errorText);
    }
  } if (charGoodCt === 0 && charWarnCt > 0) {
    if (browserMode) {
      const warningHTML = `No character-level OCR data detected. Font optimization features will be disabled. 
        <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      state.warningHandler(warningHTML);
    } else {
      const errorText = `No character-level OCR data detected. Font optimization features will be disabled. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      state.warningHandler(errorText);
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

  await gs.schedulerReady;

  const res = await gs.schedulerInner.addJob(func, { ocrStr: ocrRaw, n, scribeMode });

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
  if (langSet.has('rus') || langSet.has('ell')) fontPromiseArr.push(loadBuiltInFontsRaw('all'));
  await Promise.all(fontPromiseArr);

  if (['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName)) ocrAll['Tesseract Latest'][n] = pageObj;

  if (engineName) ocrAll[engineName][n] = pageObj;

  // If this is flagged as the "main" data, then save the stats.
  if (mainData) {
    state.convertPageWarn[n] = warn;

    // The page metrics object may have been initialized earlier through some other method (e.g. using PDF info).
    if (!pageMetricsArr[n]) {
      pageMetricsArr[n] = new PageMetrics(pageObj.dims);
    }

    pageMetricsArr[n].angle = pageObj.angle;
  }

  inputData.xmlMode[n] = true;

  // Layout boxes are only overwritten if none exist yet for the page
  if (Object.keys(LayoutDataTables.pages[n].tables).length === 0) LayoutDataTables.pages[n] = dataTables;

  // Perform GUI-specific actions.

  // Display the page if either (1) this is the currently active OCR or (2) this is Tesseract Legacy and Tesseract LSTM is active, but does not exist yet.
  // The latter condition occurs briefly whenever recognition is run in "Quality" mode.
  const oemActive = Object.keys(ocrAll).find((key) => ocrAll[key] === ocrAll.active && key !== 'active');
  const displayOCR = engineName === oemActive || ['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName) && oemActive === 'Tesseract Latest';

  if (n === state.cp.n && displayOCR && state.display) state.display(state.cp.n);

  if (state.progress) state.progress.increment();
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
 */
export async function recognizeAllPages(legacy = true, lstm = true, mainData = false) {
  // Render all PDF pages to PNG if needed
  // This step should not create binarized images as they will be created by Tesseract during recognition.
  if (inputData.pdfMode) await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, false);

  if (legacy) {
    const oemText = 'Tesseract Legacy';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(state.pageCount);
    ocrAll.active = ocrAll[oemText];
  }

  if (lstm) {
    const oemText = 'Tesseract LSTM';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(state.pageCount);
    ocrAll.active = ocrAll[oemText];
  }

  // 'Tesseract Latest' includes the last version of Tesseract to run.
  // It exists only so that data can be consistently displayed during recognition,
  // should never be enabled after recognition is complete, and should never be editable by the user.
  const oemText = 'Tesseract Latest';
  if (!ocrAll[oemText]) ocrAll[oemText] = Array(state.pageCount);
  ocrAll.active = ocrAll[oemText];

  await initTesseractInWorkers({ anyOk: false, vanillaMode: opt.vanillaMode, langs: opt.langs });

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

  const scheduler = await gs.getScheduler();

  for (const x of inputPages) {
    recognizePage(scheduler, x, legacy, lstm, false, config, state.debugVis).then(async (resArr) => {
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
    await checkCharWarn(state.convertPageWarn);
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
 * @param {'legacy'|'lstm'|'combined'} oemMode
 * @returns
 */
export async function recognizeAll(oemMode) {
  await gs.schedulerReady;
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  const debugMode = typeof process === 'undefined';

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
    if (state.progress) state.progress.show(ImageCache.pageCount + 1);

    // ProgressBars.recognize.show(ImageCache.pageCount + 1);
    const time2a = Date.now();
    // Tesseract is used as the "main" data unless user-uploaded data exists and only the LSTM model is being run.
    // This is because Tesseract Legacy provides very strong metrics, and Abbyy often does not.
    await recognizeAllPages(oemMode === 'legacy', oemMode === 'lstm', !(oemMode === 'lstm' && existingOCR));
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    // Metrics from the LSTM model are so inaccurate they are not worth using.
    if (oemMode === 'legacy') {
      calcFontMetricsFromPages(ocrAll['Tesseract Legacy']);
      opt.enableOpt = await runFontOptimization(ocrAll['Tesseract Legacy']);
    }
  } else if (oemMode === 'combined') {
    // node-canvas does not currently work in worker threads.
    // See: https://github.com/Automattic/node-canvas/issues/1394
    const compareOCR = typeof process !== 'undefined' ? (await import('./worker/compareOCRModule.js')).compareOCR : gs.scheduler.compareOCR;

    // ProgressBars.recognize.show(ImageCache.pageCount * 2 + 1);
    if (state.progress) state.progress.show(ImageCache.pageCount * 2 + 1);
    const time2a = Date.now();
    await recognizeAllPages(true, true, true);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    if (debugMode) {
      debugImg.Combined = new Array(ImageCache.pageCount);
      for (let i = 0; i < ImageCache.pageCount; i++) {
        debugImg.Combined[i] = [];
      }
    }

    if (userUploadMode) {
      const oemText = 'Tesseract Combined';
      if (!ocrAll[oemText]) ocrAll[oemText] = Array(state.pageCount);
      ocrAll.active = ocrAll[oemText];

      if (debugMode) {
        debugImg['Tesseract Combined'] = new Array(ImageCache.pageCount);
        for (let i = 0; i < ImageCache.pageCount; i++) {
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
    if (!ocrAll['Tesseract Combined Temp']) ocrAll['Tesseract Combined Temp'] = Array(state.pageCount);
    for (let i = 0; i < ImageCache.pageCount; i++) {
      /** @type {Parameters<import('../js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
      const compOptions1 = {
        mode: 'comb',
        evalConflicts: false,
        legacyLSTMComb: true,
      };

      const imgBinary = await ImageCache.getBinary(i);

      const res1 = await compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions1,
      });

      ocrAll['Tesseract Combined Temp'][i] = res1.page;
    }

    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(ImageCache.pageCount - 1, 5);
    await ImageCache.preRenderRange(0, pageNum, true);
    calcFontMetricsFromPages(ocrAll['Tesseract Combined Temp']);
    opt.enableOpt = await runFontOptimization(ocrAll['Tesseract Combined Temp']);

    const oemText = 'Combined';
    if (!ocrAll[oemText]) ocrAll[oemText] = Array(state.pageCount);
    ocrAll.active = ocrAll[oemText];

    const time3a = Date.now();
    for (let i = 0; i < ImageCache.pageCount; i++) {
      const tessCombinedLabel = userUploadMode ? 'Tesseract Combined' : 'Combined';

      /** @type {Parameters<import('../js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
      const compOptions = {
        mode: 'comb',
        debugLabel: tessCombinedLabel,
        ignoreCap: opt.ignoreCap,
        ignorePunct: opt.ignorePunct,
        confThreshHigh: opt.confThreshHigh,
        confThreshMed: opt.confThreshMed,
        legacyLSTMComb: true,
      };

      const imgBinary = await ImageCache.getBinary(i);

      const res = await compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      if (debugImg[tessCombinedLabel]) debugImg[tessCombinedLabel][i] = res.debugImg;

      ocrAll[tessCombinedLabel][i] = res.page;

      // If the user uploaded data, compare to that as we
      if (userUploadMode) {
        if (opt.combineMode === 'conf') {
          /** @type {Parameters<import('../js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
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

          const res2 = await compareOCR({
            pageA: ocrAll['User Upload'][i],
            pageB: ocrAll['Tesseract Combined'][i],
            binaryImage: imgBinary,
            pageMetricsObj: pageMetricsArr[i],
            options: compOptions2,
          });

          if (debugImg.Combined) debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        } else {
          /** @type {Parameters<import('../js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
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

          const res2 = await compareOCR({
            pageA: ocrAll['User Upload'][i],
            pageB: ocrAll['Tesseract Combined'][i],
            binaryImage: imgBinary,
            pageMetricsObj: pageMetricsArr[i],
            options: compOptions2,
          });

          if (debugImg.Combined) debugImg.Combined[i] = res2.debugImg;

          ocrAll.Combined[i] = res2.page;
        }
      }
    }
    const time3b = Date.now();
    if (debugMode) console.log(`Comparison runtime: ${time3b - time3a} ms`);
  }

  if (state.progress) state.progress.increment();

  if (state.display) state.display(state.cp.n);

  return (ocrAll.active);
}

let evalStatsConfig = {};

export async function compareGroundTruth(n) {
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  // node-canvas does not currently work in worker threads.
  // See: https://github.com/Automattic/node-canvas/issues/1394
  const compareOCR = typeof process !== 'undefined' ? (await import('./worker/compareOCRModule.js')).compareOCR : gs.scheduler.compareOCR;

  const oemActive = Object.keys(ocrAll).find((key) => ocrAll[key] === ocrAll.active && key !== 'active');

  const evalStatsConfigNew = {
    ocrActive: oemActive,
    ignorePunct: opt.ignorePunct,
    ignoreCap: opt.ignoreCap,
    ignoreExtra: opt.ignoreExtra,
  };
  /** @type {Parameters<import('../js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
  const compOptions = {
    ignorePunct: opt.ignorePunct,
    ignoreCap: opt.ignoreCap,
    confThreshHigh: opt.confThreshHigh,
    confThreshMed: opt.confThreshMed,
  };

  // Compare all pages if this has not been done already
  if (JSON.stringify(evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || evalStats.length === 0) {
  // Render binarized versions of images
    await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, true);

    for (let i = 0; i < ImageCache.pageCount; i++) {
      const imgBinary = await ImageCache.getBinary(n);

      const res = await compareOCR({
        pageA: ocrAll.active[i],
        pageB: ocrAll['Ground Truth'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
      // rather than the currently active OCR.
      // Assigning to "active" will overwrite whatever version the user currently has open.
      ocrAll.active[i] = res.page;

      if (res.metrics) evalStats[i] = res.metrics;
    }
    evalStatsConfig = evalStatsConfigNew;
  }

  const imgBinary = await ImageCache.getBinary(n);

  const res = await compareOCR({
    pageA: ocrAll.active[n],
    pageB: ocrAll['Ground Truth'][n],
    binaryImage: imgBinary,
    pageMetricsObj: pageMetricsArr[n],
    options: compOptions,
  });

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
