// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import fs from 'fs';
import path from 'path';
import Tesseract from 'tesseract.js';
import util from 'util';
import Worker from 'web-worker';
// Leave this comment and import here.
// This needs to be run first, and the comments prevent VSCode from moving it.
import { runFirst } from './runFirst.js';
// Leave this comment and import here.
import { ImageCache, imageUtils, ImageWrapper } from '../js/containers/imageContainer.js';
import { renderHOCR } from '../js/export/exportRenderHOCR.js';
import { runFontOptimization } from '../js/fontEval.js';

import { importOCRFiles } from '../js/import/importOCR.js';
import ocr from '../js/objects/ocrObjects.js';
import { PageMetrics } from '../js/objects/pageMetricsObjects.js';
import { convertOCRAllNode, recognizeAllPagesNode } from '../js/recognizeConvertNode.js';
import { reduceEvalMetrics } from '../js/utils/miscUtils.js';
import { compareOCR, tmpUnique } from '../js/worker/compareOCRModule.js';

import { drawDebugImages } from '../js/debug.js';
import { hocrToPDF } from '../js/export/exportPDF.js';

import {
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll, ocrAllRaw, pageMetricsArr,
  visInstructions,
} from '../js/containers/dataContainer.js';
import { fontAll } from '../js/containers/fontContainer.js';
import { loadBuiltInFontsRaw } from '../js/fontContainerMain.js';

import { LayoutDataTablePage, LayoutPage } from '../js/objects/layoutObjects.js';

import { clearData } from '../js/clear.js';
import { state } from '../js/containers/app.js';
import { gs } from '../js/containers/schedulerContainer.js';
import { writeDebugCsv } from '../js/export/exportDebugCsv.js';
import { calcFontMetricsFromPages } from '../js/fontStatistics.js';
import { initGeneralScheduler, initTesseractInWorkers } from '../js/generalWorkerMain.js';

const writeFile = util.promisify(fs.writeFile);

globalThis.Worker = Worker;

// Leave this line to prevent VSCode from removing the `runFirst` import.
globalThis.runFirst = runFirst;

let enableOpt = false;

// When `debugMode` is enabled:
// (1) Comparison images are saved as .png files.
// (2) Comparison logs are saved as .txt files.
// (3) All OCR data is dumped as .hocr files.
const debugMode = false;

const compLogs = {};

/** @type {import('canvas').CanvasRenderingContext2D} */
let ctxDebug;
if (debugMode) {
  const { createCanvas } = await import('canvas');
  const canvasAlt = createCanvas(200, 200);
  ctxDebug = canvasAlt.getContext('2d');
}

const debugDir = `${__dirname}/../../dev/debug/`;

/**
 *
 * @param {string} fileName - File name of input file, which is edited to create output path.
 */
function dumpHOCRAll(fileName) {
  const meta = {
    'font-metrics': fontMetricsObj,
    'default-font': fontAll.defaultFontName,
    'sans-font': fontAll.sansDefaultName,
    'serif-font': fontAll.serifDefaultName,
    'enable-opt': enableOpt,
    layout: LayoutRegions.pages,
  };

  for (const [key, value] of Object.entries(ocrAll)) {
    if (key === 'active') continue;
    const hocrOut = renderHOCR(value, 0, value.length - 1, meta);
    const outputPath = `${debugDir}/${path.basename(fileName).replace(/\.\w{1,5}$/i, '')}_${key}.hocr`;
    fs.writeFileSync(outputPath, hocrOut);
  }
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

/**
 * @param {string} func
 * @param {Object} params
 * @param {string} [params.pdfFile]
 * @param {string} [params.ocrFile]
 * @param {string} [params.outputDir]
 * @param {Array<string>} [params.list]
 * @param {boolean} [params.robustConfMode]
 * @param {boolean} [params.printConf]
 * @param {"eval" | "ebook" | "proof" | "invis"} [params.overlayMode]
 *
 */
async function main(func, params) {
  await initGeneralScheduler();
  await initTesseractInWorkers({});
  const resReadyFontAllRaw = gs.setFontAllRawReady();
  await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());

  const output = {};

  const debugComp = false;

  // const hocrStrFirst = fs.readFileSync(params.ocrFile, 'utf8');
  // if (!hocrStrFirst) throw new Error(`Could not read file: ${params.ocrFile}`);

  let existingLayout = false;
  let existingLayoutDataTable = false;

  /** @type {("hocr" | "abbyy" | "stext")} */
  let ocrFormat = 'hocr';
  if (['conf', 'check', 'eval', 'overlay'].includes(func)) {
    if (params.ocrFile) {
      const ocrData = await importOCRFiles([params.ocrFile]);
      ocrAllRaw.active = ocrData.hocrRaw;
      if (ocrData.abbyyMode) ocrFormat = 'abbyy';

      if (ocrData.layoutObj) {
        for (let i = 0; i < ocrData.layoutObj.length; i++) {
          LayoutRegions.pages[i] = ocrData.layoutObj[i];
        }
        existingLayout = true;
      }

      if (ocrData.layoutDataTableObj) {
        for (let i = 0; i < ocrData.layoutDataTableObj.length; i++) {
          LayoutDataTables.pages[i] = ocrData.layoutDataTableObj[i];
        }
        existingLayoutDataTable = true;
      }
    } else {
      throw new Error(`OCR file required for function ${func} but not provided.`);
    }
  }

  const backgroundArg = params.pdfFile;
  const backgroundArgStem = backgroundArg ? path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '') : undefined;
  const outputDir = params.outputDir || '.';

  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  // Despite the argument name being `pdfFile`, this is also used for image files.
  // `backgroundPDF` is true if the input file is a PDF.
  const backgroundPDF = backgroundArg && /pdf$/i.test(backgroundArg);

  const robustConfMode = func === 'check' || params.robustConfMode || false;
  const printConf = func === 'check' || func === 'conf' || params.printConf || false;

  const pageCountHOCR = ocrAllRaw.active ? ocrAllRaw.active.length : 0;

  let fileData;
  let mupdfWorker;
  let pageCountImage;
  if (backgroundArg) {
    fileData = await fs.readFileSync(backgroundArg);

    if (backgroundPDF) {
      await ImageCache.openMainPDF(fileData, false, !params.ocrFile);
      pageCountImage = ImageCache.pageCount;
    } else {
      ImageCache.inputModes.image = true;
      ImageCache.pageCount = 1;

      pageCountImage = 1;
      const format = backgroundArg.match(/jpe?g$/i) ? 'jpeg' : 'png';

      const imgWrapper = new ImageWrapper(0, `data:image/${format};base64,${fileData.toString('base64')}`, format, 'native', false, false);

      ImageCache.nativeSrc[0] = imgWrapper;

      if (!ocrAllRaw.active || ocrAllRaw.active.length === 0) {
        const imageDims = await imageUtils.getDims(imgWrapper);
        pageMetricsArr[0] = new PageMetrics(imageDims);
      }
    }
  }

  // TODO: This message should either be deleted or narrowed to cases where both image and OCR data are expected and/or provided.
  // if (pageCountHOCR !== pageCountImage) {
  //   console.log(`Detected ${pageCountHOCR} pages in OCR but ${pageCountImage} images.`);
  // }
  state.pageCount = pageCountImage ?? pageCountHOCR;

  if (!existingLayout) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutRegions.pages[i] = new LayoutPage();
      LayoutDataTables.pages[i] = new LayoutDataTablePage();
    }
  }

  if (!existingLayoutDataTable) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutDataTables.pages[i] = new LayoutDataTablePage();
    }
  }

  ocrAll.active = Array(state.pageCount);
  ocrAll['User Upload'] = Array(state.pageCount);
  ocrAll['Tesseract Legacy'] = Array(state.pageCount);
  ocrAll['Tesseract LSTM'] = Array(state.pageCount);
  ocrAll['Tesseract Combined Temp'] = Array(state.pageCount);
  ocrAll['Tesseract Combined'] = Array(state.pageCount);
  ocrAll.Combined = Array(state.pageCount);

  ocrAll.active = ocrAll['User Upload'];

  /** @type {Array<EvalMetrics>} */
  const evalMetricsArr = [];

  if (ocrAllRaw.active && ocrAllRaw.active.length > 0) {
    await convertOCRAllNode(ocrAllRaw.active, true, ocrFormat, 'User Upload');
  }

  if (func === 'conf' || (printConf && !robustConfMode)) {
    let wordsTotal = 0;
    let wordsHighConf = 0;
    for (let i = 0; i < ocrAll.active.length; i++) {
      const words = ocr.getPageWords(ocrAll.active[i]);
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        wordsTotal += 1;
        if (word.conf > 85) wordsHighConf += 1;
      }
    }
    console.log(`Confidence: ${wordsHighConf / wordsTotal}`);

    if (func === 'conf') {
      await gs.clear();
      clearData();
      return output;
    }
  }

  // There is currently no Node.js implementation of default font selection, as this is written around drawing in the canvas API.
  // Evaluate default fonts using up to 5 pages.
  const fontEvalPageN = Math.min(state.pageCount, 5);

  const tessWorker = await Tesseract.createWorker();

  // All pages are rendered for `robustConfMode`, otherwise images are only needed for font evaluation.
  const runRecognition = robustConfMode || func === 'eval' || func === 'debug';
  const renderPageN = runRecognition ? state.pageCount : fontEvalPageN;

  if (backgroundPDF) await ImageCache.preRenderRange(0, renderPageN - 1, false);

  // If recognition is not being run, binarize and rotate the images now.
  // If recognition is being run, this will happen at that step.
  if (!runRecognition) await ImageCache.preRenderRange(0, renderPageN - 1, true);

  if (func === 'debug' && backgroundArg) {
    const writeCanvasNodeAll = (await import('../scrollview-web/src/ScrollViewNode.js')).writeCanvasNodeAll;

    await recognizeAllPagesNode(false, false, false, true);

    visInstructions.forEach((x) => {
      /** @type {typeof x} */
      const visFilter = {};
      for (const key of Object.keys(x)) {
        if (!params.list?.length || params.list.includes(key)) {
          visFilter[key] = x[key];
        }
      }
      const pageNumSuffix = visInstructions.length > 1 ? `_${x}` : '';
      const outputBase = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '')}${pageNumSuffix}`;
      writeCanvasNodeAll(visFilter, outputBase);
    });
    // Terminate all workers
    await tessWorker.terminate();
    await gs.clear();
    clearData();

    return output;
  }

  // TODO: (1) Find out why font data is not being imported correctly from .hocr files.
  // (2) Use Tesseract Legacy font data when (1) recognition is being run anyway and (2) no font metrics data exists already.
  if (robustConfMode || func === 'eval' || func === 'recognize') {
    // Render all pages since all pages are being recognized.
    await ImageCache.preRenderRange(0, state.pageCount - 1, false);

    const time2a = Date.now();
    await recognizeAllPagesNode(true, true, true);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    // This is set to Tesseract Legacy so results are consistent with the browser version, which uses Legacy data to run `selectDefaultFontsDocument`.
    // Conceptually speaking, it probably makes more sense to use LSTM as that is higher quality on average and is not "overfitted" due to being
    // used for font optimization.
    if (func === 'eval' || func === 'recognize') ocrAll.active = ocrAll['Tesseract Legacy'];

    // Combine Tesseract Legacy and Tesseract LSTM into "Tesseract Combined"
    for (let i = 0; i < ImageCache.pageCount; i++) {
      /** @type {Parameters<compareOCR>[0]['options']} */
      const compOptions = {
        mode: 'comb',
        evalConflicts: false,
      };

      const imgBinary = await ImageCache.getBinary(i);

      const res = await compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      ocrAll['Tesseract Combined Temp'][i] = res.page;
    }

    // Switching active data here for consistency with browser version.
    if (func === 'eval' || func === 'recognize') ocrAll.active = ocrAll['Tesseract Combined Temp'];
    calcFontMetricsFromPages(ocrAll['Tesseract Combined Temp']);
    enableOpt = await runFontOptimization(ocrAll['Tesseract Combined Temp']);

    output.text = '';

    // Combine Tesseract Legacy and Tesseract LSTM into "Tesseract Combined"
    for (let i = 0; i < ImageCache.pageCount; i++) {
      /** @type {Parameters<compareOCR>[0]['options']} */
      const compOptions = {
        mode: 'comb',
        ignoreCap: true,
        ignorePunct: false,
        debugLabel: debugMode ? 'abc' : undefined, // Setting any value for `debugLabel` causes the debugging images to be saved.
      };

      const imgBinary = await ImageCache.getBinary(i);

      const res = await compareOCR({
        pageA: ocrAll['Tesseract Legacy'][i],
        pageB: ocrAll['Tesseract LSTM'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      if (debugMode && res.debugImg.length > 0) {
        const filePath = `${__dirname}/../../dev/debug/legacy_lstm_comp_${i}.png`;
        await writeDebugImages(ctxDebug, [res.debugImg], filePath);
      }

      ocrAll['Tesseract Combined'][i] = res.page;

      if (func === 'recognize') output.text += ocr.getPageText(res.page);
    }
  } else {
    calcFontMetricsFromPages(ocrAll.active);
    await runFontOptimization(ocrAll.active);
  }

  if (robustConfMode || func === 'eval') {
    if (debugMode) compLogs.Combined = [];
    for (let i = 0; i < ImageCache.pageCount; i++) {
      /** @type {Parameters<compareOCR>[0]['options']} */
      const compOptions = {
        mode: 'stats',
        supplementComp: true,
        ignoreCap: true,
        ignorePunct: false,
        tessWorker,
        editConf: robustConfMode,
        debugLabel: debugMode ? 'abc' : undefined, // Setting any value for `debugLabel` causes the debugging images to be saved.
      };

      const imgBinary = await ImageCache.getBinary(i);

      // In "check" mode, the provided OCR is being compared against OCR from the built-in engine.
      // In "eval" mode, the OCR from the built-in engine is compared against provided ground truth OCR data.
      const pageA = func === 'eval' ? ocrAll['Tesseract Combined'][i] : ocrAll['User Upload'][i];
      const pageB = func === 'eval' ? ocrAll['User Upload'][i] : ocrAll['Tesseract Combined'][i];

      const res = await compareOCR({
        pageA,
        pageB,
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      ocrAll.Combined[i] = res.page;

      if (res.metrics) evalMetricsArr.push(res.metrics);
    }

    ocrAll.active = ocrAll.Combined;

    const evalMetricsDoc = reduceEvalMetrics(evalMetricsArr);

    output.evalMetrics = evalMetricsDoc;

    if (printConf) {
      console.log(`Confidence: ${evalMetricsDoc.correct / evalMetricsDoc.total} (${evalMetricsDoc.correct} of ${evalMetricsDoc.total})`);
    }
  }

  if (debugMode && backgroundArg) {
    dumpHOCRAll(backgroundArg);
  }

  if (func === 'overlay' && backgroundArg) {
    const overlayMode = params.overlayMode || 'invis';
    const pdfStr = await hocrToPDF(ocrAll.active, 0, -1, overlayMode, true, false);
    const enc = new TextEncoder();
    const pdfEnc = enc.encode(pdfStr);

    const muPDFScheduler = await ImageCache.getMuPDFScheduler(1);
    mupdfWorker = muPDFScheduler.workers[0];

    const pdfOverlay = await mupdfWorker.openDocument(pdfEnc.buffer, 'document.pdf');
    let content;
    if (backgroundPDF) {
      content = await mupdfWorker.overlayText({
        doc2: pdfOverlay,
        minpage: 0,
        maxpage: -1,
        pagewidth: -1,
        pageheight: -1,
        humanReadable: false,
        skipText: true,
      });
    } else {
      content = await mupdfWorker.overlayTextImage({
        doc2: pdfOverlay,
        imageArr: [fileData],
        minpage: 0,
        maxpage: -1,
        pagewidth: -1,
        pageheight: -1,
        humanReadable: false,
      });
    }

    // If printing a visible overlay, the file name is suffixed with "_vis" to avoid getting it mixed up with the normal file.
    // If printing an invisible overlay, the file name is suffixed with "_ocr" only if the output directory is the same as the input directory, to avoid overwriting the input file.
    // If printing an invisible overlay to a separate output directory, the file name is not suffixed.
    let outputSuffix = '';
    if (overlayMode === 'proof') {
      outputSuffix = '_vis';
    } else if (overlayMode === 'invis') {
      const resolvedInputFile = path.dirname(path.resolve(backgroundArg));
      const resolvedOutputDir = path.resolve(outputDir);
      if (resolvedInputFile === resolvedOutputDir) {
        outputSuffix = '_ocr';
      }
    }

    const outputPath = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, `${outputSuffix}.pdf`)}`;

    await writeFile(outputPath, content);
  }

  if (debugComp) {
    const csvStr = writeDebugCsv(ocrAll.active);
    const outputPath = `${__dirname}/../../dev/debug/${backgroundArgStem}_debug.csv`;
    fs.writeFileSync(outputPath, csvStr);
  }

  // Delete temp directory with fonts
  await tmpUnique.delete();

  // Terminate all workers
  await tessWorker.terminate();
  await gs.clear();
  clearData();

  return output;
}

/**
 * Print confidence of Abbyy .xml file.
 *
 * @param {string} ocrFile
 */
export const conf = async (ocrFile) => (main('conf', { ocrFile }));

/**
 *
 * @param {string} pdfFile - Path to PDF file.
 * @param {string} ocrFile
 */
export const check = async (pdfFile, ocrFile) => (main('check', { pdfFile, ocrFile }));

/**
 * Evaluate internal OCR engine.
 *
 * @param {string} pdfFile - Path to PDF file.
 * @param {string} ocrFile - Path to OCR file containing ground truth.
 */
export const evalInternal = async (pdfFile, ocrFile) => (main('eval', { pdfFile, ocrFile }));

/**
 *
 * @param {string} pdfFile - Path to PDF file.
 * @param {*} ocrFile
 * @param {*} outputDir
 * @param {Object} options
 * @param {boolean} [options.robust]
 * @param {boolean} [options.conf]
 * @param {"eval" | "ebook" | "proof" | "invis"} [options.overlayMode]
 * @returns
 */
export const overlay = async (pdfFile, ocrFile, outputDir, options) => (main('overlay', {
  pdfFile, ocrFile, outputDir, robustConfMode: options?.robust || false, printConf: options?.conf || false, overlayMode: options?.overlayMode || 'invis',
}));

/**
 *
 * @param {string} pdfFile - Path to PDF file.
 * @returns
 */
export const recognize = async (pdfFile) => (main('recognize', { pdfFile }));

/**
 *
 * @param {string} pdfFile - Path to PDF file.
 * @param {*} outputDir
 * @param {*} options
 * @returns
 */
export const debug = async (pdfFile, outputDir, options) => (main('debug', {
  pdfFile, outputDir, list: options?.list,
}));
