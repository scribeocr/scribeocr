// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import fs, { write } from 'fs';
import path from 'path';
import util from 'util';
import Worker from 'web-worker';
import Tesseract from 'tesseract.js';
import { initGeneralWorker, GeneralScheduler } from '../js/generalWorkerMain.js';
import { runFontOptimization } from '../js/fontEval.js';
import { imageCont } from '../js/imageContainer.js';

import { recognizeAllPagesNode, convertOCRAllNode } from '../js/recognizeConvertNode.js';
import { compareHOCR, tmpUnique } from '../js/worker/compareOCRModule.js';
import ocr from '../js/objects/ocrObjects.js';
import { reduceEvalMetrics } from '../js/miscUtils.js';
import { importOCR } from '../js/importOCR.js';
import { PageMetrics } from '../js/objects/pageMetricsObjects.js';

import { hocrToPDF } from '../js/exportPDF.js';
import { drawDebugImages } from '../js/debug.js';

const writeFile = util.promisify(fs.writeFile);

globalThis.Worker = Worker;

const saveCompImages = false;

/** @type {import('canvas').CanvasRenderingContext2D} */
let ctxDebug;
if (saveCompImages) {
  const { createCanvas } = await import('canvas');
  const canvasAlt = createCanvas(200, 200);
  ctxDebug = canvasAlt.getContext('2d');
}

/**
 *
 * @param {import('canvas').CanvasRenderingContext2D} ctx
 * @param {Array<Array<CompDebugNode>>} compDebugArrArr
 * @param {string} filePath
 */
async function writeDebugImages(ctx, compDebugArrArr, filePath) {
  await drawDebugImages({ ctx, compDebugArrArr, context: 'node' });
  const buffer0 = ctx.canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer0);
}

// Object that keeps track of various global settings
globalThis.globalSettings = {
  defaultFont: 'SerifDefault',
};

globalThis.convertPageWarn = [];

/** @type {Array<ReturnType<typeof import('../../scrollview-web/scrollview/ScrollView.js').ScrollView.prototype.getAll>>} */
globalThis.visInstructions = [];

/**
 * @param {string} func
 * @param {Object} params
 * @param {string} [params.pdfFile]
 * @param {string} [params.ocrFile]
 * @param {string} [params.outputDir]
 * @param {Array<string>} [params.list]
 * @param {boolean} [params.robustConfMode]
 * @param {boolean} [params.printConf]
 *
 */
async function main(func, params) {
  // const hocrStrFirst = fs.readFileSync(params.ocrFile, 'utf8');
  // if (!hocrStrFirst) throw new Error(`Could not read file: ${params.ocrFile}`);

  // Object that keeps track of what type of input data is present
  globalThis.inputDataModes = {
    // true if OCR data exists (whether from upload or built-in engine)
    xmlMode: undefined,
    // true if user uploaded pdf
    pdfMode: false,
    // true if user uploaded image files (.png, .jpeg)
    imageMode: false,
    // true if user re-uploaded HOCR data created by Scribe OCR
    resumeMode: false,
  };

  let format;
  if (['conf', 'check', 'eval', 'overlay'].includes(func)) {
    if (params.ocrFile) {
      const ocr1 = await importOCR([params.ocrFile]);
      globalThis.hocrCurrentRaw = ocr1.hocrRaw;
      format = ocr1.abbyyMode ? 'abbyy' : 'hocr';
    } else {
      throw new Error(`OCR file required for function ${func} but not provided.`);
    }
  }

  const backgroundArg = params.pdfFile;
  const outputDir = params.outputDir;

  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  const backgroundPDF = backgroundArg && /pdf$/i.test(backgroundArg);
  const backgroundImage = backgroundArg && !backgroundPDF;

  const debugMode = false;
  const robustConfMode = func === 'check' || params.robustConfMode || false;
  const printConf = func === 'check' || func === 'conf' || params.printConf || false;

  const pageCountHOCR = globalThis.hocrCurrentRaw ? globalThis.hocrCurrentRaw.length : 0;
  globalThis.pageMetricsArr = [];

  let fileData;
  let w;
  let pageCountImage;
  if (backgroundPDF || backgroundImage) {
    fileData = await fs.readFileSync(params.pdfFile);

    if (backgroundPDF) {
      await imageCont.openMainPDF(fileData);
      pageCountImage = imageCont.pageCount;
    } else {
      pageCountImage = 1;
      imageCont.imageAll.nativeStr[0] = `data:image/png;base64,${fileData.toString('base64')}`;
      if (!globalThis.hocrCurrentRaw) {
        globalThis.pageMetricsArr[0] = new PageMetrics({ height: 0, width: 0 });
      }
    }
  }

  if (pageCountHOCR !== pageCountImage) {
    console.log(`Detected ${pageCountHOCR} pages in OCR but ${pageCountImage} images.`);
  }
  const pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.layout = Array(pageCount);
  for (let i = 0; i < globalThis.layout.length; i++) {
    globalThis.layout[i] = { default: true, boxes: {} };
  }

  globalThis.ocrAll = {
    active: Array(pageCount),
    'User Upload': Array(pageCount),
    'Tesseract Legacy': Array(pageCount),
    'Tesseract LSTM': Array(pageCount),
    'Tesseract Combined Temp': Array(pageCount),
    'Tesseract Combined': Array(pageCount),
    Combined: Array(pageCount),
  };

  globalThis.ocrAll.active = globalThis.ocrAll['User Upload'];

  /** @type {Array<EvalMetrics>} */
  const evalMetricsArr = [];

  const workerN = 1;
  globalThis.generalScheduler = await Tesseract.createScheduler();
  globalThis.generalScheduler.workers = new Array(workerN);
  for (let i = 0; i < workerN; i++) {
    const w = await initGeneralWorker();
    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    globalThis.generalScheduler.addWorker(w);
    globalThis.generalScheduler.workers[i] = w;
  }

  globalThis.gs = new GeneralScheduler(globalThis.generalScheduler);

  if (globalThis.hocrCurrentRaw) await convertOCRAllNode(globalThis.hocrCurrentRaw, true, format, 'User Upload');

  if (func === 'conf' || (printConf && !robustConfMode)) {
    let wordsTotal = 0;
    let wordsHighConf = 0;
    for (let i = 0; i < globalThis.ocrAll.active.length; i++) {
      const words = ocr.getPageWords(globalThis.ocrAll.active[i]);
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        wordsTotal += 1;
        if (word.conf > 85) wordsHighConf += 1;
      }
    }
    console.log(`Confidence: ${wordsHighConf / wordsTotal}`);

    if (func === 'conf') {
      globalThis.generalScheduler.terminate();
      process.exitCode = 0;
      return;
    }
  }

  // There is currently no Node.js implementation of default font selection, as this is written around drawing in the canvas API.
  // Evaluate default fonts using up to 5 pages.
  const fontEvalPageN = Math.min(pageCount, 5);

  const tessWorker = await Tesseract.createWorker();

  // All pages are rendered for `robustConfMode`, otherwise images are only needed for font evaluation.
  const runRecognition = robustConfMode || func === 'eval' || func === 'debug';
  const renderPageN = runRecognition ? pageCount : fontEvalPageN;

  if (backgroundPDF) await imageCont.renderImageRange(0, renderPageN - 1);

  // If recognition is not being run, binarize and rotate the images now.
  // If recognition is being run, this will happen at that step.
  if (!runRecognition) await imageCont.renderImageRange(0, renderPageN - 1, 'binary');

  if (func === 'debug') {
    const writeCanvasNodeAll = (await import('../../scrollview-web/src/ScrollViewNode.js')).writeCanvasNodeAll;

    console.log('Running recognizeAllPagesNode');
    await recognizeAllPagesNode(false, false, false, true);
    console.log('Done running recognizeAllPagesNode');
    globalThis.visInstructions.forEach((x) => {
      /** @type {typeof x} */
      const visFilter = {};
      for (const key of Object.keys(x)) {
        if (!params.list?.length || params.list.includes(key)) {
          visFilter[key] = x[key];
        }
      }
      const pageNumSuffix = globalThis.visInstructions.length > 1 ? `_${x}` : '';
      const outputBase = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '')}${pageNumSuffix}`;
      writeCanvasNodeAll(visFilter, outputBase);
    });
    // Terminate all workers
    await tessWorker.terminate();
    await globalThis.generalScheduler.terminate();
    imageCont.clear();

    process.exitCode = 0;
    return;
  }

  // TODO: (1) Find out why font data is not being imported correctly from .hocr files.
  // (2) Use Tesseract Legacy font data when (1) recognition is being run anyway and (2) no font metrics data exists already.
  if (robustConfMode || func === 'eval' || func === 'recognize') {
    const time2a = Date.now();
    await recognizeAllPagesNode(true, true, true);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    // This is set to Tesseract Legacy so results are consistent with the browser version, which uses Legacy data to run `selectDefaultFontsDocument`.
    // Conceptually speaking, it probably makes more sense to use LSTM as that is higher quality on average and is not "overfitted" due to being
    // used for font optimization.
    if (func === 'eval' || func === 'recognize') globalThis.ocrAll.active = globalThis.ocrAll['Tesseract Legacy'];

    // Combine Tesseract Legacy and Tesseract LSTM into "Tesseract Combined"
    for (let i = 0; i < imageCont.imageAll.native.length; i++) {
      const compOptions = {
        mode: 'comb',
        evalConflicts: false,
      };

      const imgElem = await imageCont.imageAll.binary[i];
      const res = await compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem,
        imageRotated: imageCont.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      globalThis.ocrAll['Tesseract Combined Temp'][i] = res.page;
    }

    // Switching active data here for consistency with browser version.
    if (func === 'eval' || func === 'recognize') globalThis.ocrAll.active = globalThis.ocrAll['Tesseract Combined Temp'];
    await runFontOptimization(globalThis.ocrAll['Tesseract Combined Temp'], imageCont.imageAll.binary, imageCont.imageAll.binaryRotated);

    // Combine Tesseract Legacy and Tesseract LSTM into "Tesseract Combined"
    for (let i = 0; i < imageCont.imageAll.native.length; i++) {
      const compOptions = {
        mode: 'comb',
        ignoreCap: true,
        ignorePunct: false,
        debugLabel: saveCompImages ? 'abc' : null, // Setting any value for `debugLabel` causes the debugging images to be saved.
      };

      const imgElem = await imageCont.imageAll.binary[i];
      const res = await compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem,
        imageRotated: imageCont.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      if (globalThis.debugLog === undefined) globalThis.debugLog = '';
      globalThis.debugLog += res.debugLog;

      if (saveCompImages && res.debugImg.length > 0) {
        const filePath = `${__dirname}/../../dev/debug/legacy_lstm_comp_${i}.png`;
        await writeDebugImages(ctxDebug, [res.debugImg], filePath);
      }

      globalThis.ocrAll['Tesseract Combined'][i] = res.page;

      if (func === 'recognize') console.log(ocr.getPageText(res.page));
    }
  } else {
    await runFontOptimization(globalThis.ocrAll.active, imageCont.imageAll.binary, imageCont.imageAll.binaryRotated);
  }

  if (robustConfMode || func === 'eval') {
    for (let i = 0; i < imageCont.imageAll.nativeStr.length; i++) {
      const compOptions = {
        mode: 'stats',
        supplementComp: true,
        ignoreCap: true,
        ignorePunct: false,
        tessWorker,
      };

      const imgElem = await imageCont.imageAll.binary[i];

      // In "check" mode, the provided OCR is being compared against OCR from the built-in engine.
      // In "eval" mode, the OCR from the built-in engine is compared against provided ground truth OCR data.
      const pageA = func === 'eval' ? globalThis.ocrAll['Tesseract Combined'][i] : globalThis.ocrAll['User Upload'][i];
      const pageB = func === 'eval' ? globalThis.ocrAll['User Upload'][i] : globalThis.ocrAll['Tesseract Combined'][i];

      const res = await compareHOCR({
        pageA,
        pageB,
        binaryImage: imgElem,
        imageRotated: imageCont.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      // In robustConfMode, the comparison with Tesseract OCR should replace the original confidence metrics.
      // This is set here because `compareHOCR` (in "stats" mode) only sets the `matchTruth` attribute, but does not edit `conf`.
      if (robustConfMode) {
        ocr.getPageWords(res.page).forEach((x) => {
          x.conf = x.matchTruth ? 100 : 0;
        });
      }

      globalThis.ocrAll.active[i] = res.page;

      if (res.metrics) evalMetricsArr.push(res.metrics);
    }

    const evalMetricsDoc = reduceEvalMetrics(evalMetricsArr);

    if (func === 'eval') {
      const ignoreExtra = true;
      let metricWER;
      if (ignoreExtra) {
        metricWER = Math.round(((evalMetricsDoc.incorrect + evalMetricsDoc.missed) / evalMetricsDoc.total) * 100) / 100;
      } else {
        metricWER = Math.round(((evalMetricsDoc.incorrect + evalMetricsDoc.missed + evalMetricsDoc.extra)
        / evalMetricsDoc.total) * 100) / 100;
      }
      console.log(`Word Error Rate: ${metricWER}`);
    }

    if (printConf) {
      console.log(`Confidence: ${evalMetricsDoc.correct / evalMetricsDoc.total}`);
    }
  }

  if (func === 'overlay') {
    const pdfStr = await hocrToPDF(globalThis.ocrAll.active, 0, -1, 'proof', true, false);
    const enc = new TextEncoder();
    const pdfEnc = enc.encode(pdfStr);

    const muPDFScheduler = await imageCont.initMuPDFScheduler(null, 1);
    w = muPDFScheduler.workers[0];

    const pdfOverlay = await w.openDocument(pdfEnc.buffer, 'document.pdf');
    let content;
    if (backgroundPDF) {
      content = await w.overlayText({
        doc2: pdfOverlay,
        minpage: 0,
        maxpage: -1,
        pagewidth: -1,
        pageheight: -1,
        humanReadable: false,
        skipText: true,
      });
    } else {
      content = await w.overlayTextImage({
        doc2: pdfOverlay,
        imageArr: [fileData],
        minpage: 0,
        maxpage: -1,
        pagewidth: -1,
        pageheight: -1,
        humanReadable: false,
      });
    }

    const outputPath = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '_vis.pdf')}`;

    await writeFile(outputPath, content);
  }

  // Delete temp directory with fonts
  await tmpUnique.delete();

  // Terminate all workers
  await tessWorker.terminate();
  await globalThis.generalScheduler.terminate();
  imageCont.clear();

  process.exitCode = 0;
}

export const confFunc = async (ocrFile) => {
  await main('conf', { ocrFile });
};

export const checkFunc = async (pdfFile, ocrFile) => {
  await main('check', { pdfFile, ocrFile });
};

export const evalFunc = async (pdfFile, ocrFile) => {
  await main('eval', { pdfFile, ocrFile });
};

export const overlayFunc = async (pdfFile, ocrFile, outputDir, options) => {
  await main('overlay', {
    pdfFile, ocrFile, outputDir, robustConfMode: options?.robust || false, printConf: options?.conf || false,
  });
};

export const recognizeFunc = async (pdfFile) => {
  await main('recognize', { pdfFile });
};

export const debugFunc = async (pdfFile, outputDir, options) => {
  await main('debug', {
    pdfFile, outputDir, list: options?.list,
  });
};
