// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import { initGeneralWorker } from "../js/generalWorkerMain.js";
import { selectDefaultFontsDocument, setFontAllWorker } from "../js/fontEval.js";
import { recognizeAllPages } from "../js/recognize.js";
import { compareHOCR, tmpUnique } from "../js/worker/compareOCRModule.js";
import { renderHOCR } from "../js/exportRenderHOCR.js";
import ocr from "../js/objects/ocrObjects.js";

import fs from "fs";
import path from "path";
import util from "util";
import Worker from 'web-worker';
globalThis.Worker = Worker;
import { initMuPDFWorker } from "../mupdf/mupdf-async.js";
import { hocrToPDF } from "../js/exportPDF.js";
import { calculateOverallFontMetrics, setDefaultFontAuto } from "../js/fontStatistics.js";
import { loadFontContainerAllRaw, optimizeFontContainerAll, fontContainerAll, } from "../js/objects/fontObjects.js";
import { convertOCRAll } from "../js/convertOCR.js";

import Tesseract from '../tess/tesseract.js/src/index.js';

const { loadImage } = await import('canvas');

const fontPrivate = loadFontContainerAllRaw();


const fontAll = {
  raw: fontPrivate,
  /**@type {?fontContainerAll}*/
  opt: null,
  active: fontPrivate
}

/**
 * 
 * @param {boolean} enable 
 */
async function enableDisableFontOpt(enable) {
  const browserMode = typeof process === "undefined";

  // Create optimized font if this has not been done yet
  if (enable && !fontAll.opt) {
    fontAll.opt = await optimizeFontContainerAll(fontPrivate);
  }

  // Enable/disable optimized font
  if (enable && fontAll.opt) {
    fontAll.active = fontAll.opt;
  } else {
    fontAll.active = fontAll.raw;
  }

  // Enable/disable optimized font in workers
  if (browserMode) await setFontAllWorker(generalScheduler, fontAll);
}

// Object that keeps track of various global settings
globalThis.globalSettings = {
  defaultFont: "SerifDefault",
}

globalThis.fontMetricObjsMessage = [];
globalThis.convertPageWarn = [];

/**
 * @param {string} func
 * @param {Object} params
 * @param {string} [params.pdfFile] 
 * @param {string} [params.ocrFile]
 * @param {string} [params.outputDir] 
 * @param {boolean} [params.robustConfMode] 
 * @param {boolean} [params.printConf] 
 * 
 */
async function main(func, params) {

  let hocrStrFirst = fs.readFileSync(params.ocrFile, 'utf8');
  if (!hocrStrFirst) throw "Could not read file: " + params.ocrFile;

  const backgroundArg = params.pdfFile;
  const outputDir = params.outputDir;

  const backgroundPDF = /pdf$/i.test(backgroundArg);

  const debugMode = false;
  const robustConfMode = func == "check" || params.robustConfMode || false;
  const printConf = func == "check" || func == "conf" || params.printConf || false;

  let fileData, w;
  if (backgroundPDF) {
    w = await initMuPDFWorker();
    fileData = await fs.readFileSync(params.pdfFile);

    if (backgroundPDF) {
      const pdfDoc = await w.openDocument(fileData, "file.pdf");
      w["pdfDoc"] = pdfDoc;
    }
  }


  globalThis.pageMetricsArr = [];

  // Object that keeps track of what type of input data is present
  globalThis.inputDataModes = {
    // true if OCR data exists (whether from upload or built-in engine)
    xmlMode: undefined,
    // true if user uploaded pdf
    pdfMode: false,
    // true if user uploaded image files (.png, .jpeg)
    imageMode: false,
    // true if user re-uploaded HOCR data created by Scribe OCR
    resumeMode: false
  }

  const hocrStrAll = hocrStrFirst;

  const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
  const abbyyMode = /abbyy/i.test(node2) ? true : false;
  const format = abbyyMode ? "abbyy" : "hocr";

  let hocrStrStart = "";
  let hocrStrEnd = "";
  let hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

  if (abbyyMode) {
    hocrArrPages = hocrStrAll.split(/(?=\<page)/).slice(1);
  } else {

    // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
    inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

    if (inputDataModes.resumeMode) {
      let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
      let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
      globalThis.fontMetricsObj = JSON.parse(contentStr);

    }

    hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
    hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
    hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
    hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
    hocrStrPages = hocrStrPages.trim();

    hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
  }

  pageCountHOCR = hocrArrPages.length;
  if (backgroundPDF) pageCountImage = await w.countPages([fileData]);
  if (pageCountHOCR != pageCountImage) {
    console.log('Detected ' + pageCountHOCR + ' pages in OCR but ' + pageCountImage + " images.")
  }
  pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.layout = Array(pageCount);
  for (let i = 0; i < globalThis.layout.length; i++) {
    globalThis.layout[i] = { default: true, boxes: {} };
  }

  globalThis.ocrAll = {
    "active": Array(pageCount),
    "User Upload": Array(pageCount),
    "Tesseract Legacy": Array(pageCount),
    "Tesseract LSTM": Array(pageCount),
    "Tesseract Combined": Array(pageCount),
    "Combined": Array(pageCount),
  }

  globalThis.ocrAll.active = globalThis.ocrAll["User Upload"];

  globalThis.hocrCurrentRaw = Array(pageCount);
  for (let i = 0; i < pageCount; i++) {
    globalThis.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
  }

  const workerN = 1;
  globalThis.generalScheduler = await Tesseract.createScheduler();
  globalThis.generalScheduler["workers"] = new Array(workerN);
  for (let i = 0; i < workerN; i++) {
    const w = await initGeneralWorker();
    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    globalThis.generalScheduler.addWorker(w);
    globalThis.generalScheduler["workers"][i] = w;
  }

  await convertOCRAll(globalThis.hocrCurrentRaw, true, format, "User Upload");

  if (func == "conf" || (printConf && !robustConfMode)) {
    let wordsTotal = 0;
    let wordsHighConf = 0;
    // console.log(globalThis.hocrCurrentRaw);
    // console.log(globalThis.ocrAll.active);
    for (let i = 0; i < globalThis.ocrAll.active.length; i++) {
      const words = ocr.getPageWords(globalThis.ocrAll.active[i]);
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        wordsTotal = wordsTotal + 1;
        if (word.conf > 85) wordsHighConf = wordsHighConf + 1;
      }
    }
    console.log(`Confidence: ${wordsHighConf / wordsTotal}`);

    if (func == "conf") {
      generalScheduler.terminate();
      process.exitCode = 0;
      return;
    }
  }

  const metricsRet = calculateOverallFontMetrics(fontMetricObjsMessage, globalThis.convertPageWarn);
  globalThis.fontMetricsObj = metricsRet.fontMetrics;

  if (globalThis.fontMetricsObj) setDefaultFontAuto(globalThis.fontMetricsObj);
  await enableDisableFontOpt(true);

  // There is currently no Node.js implementation of default font selection, as this is written around drawing in the canvas API. 
  // Evaluate default fonts using up to 5 pages. 
  const fontEvalPageN = Math.min(pageCount, 5);

  const tessWorker = await Tesseract.createWorker();

  globalThis.imageAll = {
    native: Array(pageCount),
    binary: Array(pageCount),
    nativeRotated: Array(pageCount),
    binaryRotated: Array(pageCount),
  }

  // All pages are rendered for `robustConfMode`, otherwise images are only needed for font evaluation.
  const renderPageN = robustConfMode ? pageCount : fontEvalPageN;

  for (let i = 0; i < renderPageN; i++) {
    // Render to 300 dpi by default
    let dpi = 300;

    const imgWidthXml = globalThis.pageMetricsArr[i].dims.width;

    const imgWidthPdf = await w.pageWidth([i + 1, 300]);
    if (imgWidthPdf != imgWidthXml) {
      dpi = 300 * (imgWidthXml / imgWidthPdf);
    }

    // Render page from PDF as image
    globalThis.imageAll.native[i] = await w.drawPageAsPNG([i + 1, dpi, false, false]);

    // If recognition is not being run, binarize and rotate the images now.
    // If recognition is being run, this will happen at that step. 
    if (!robustConfMode) {
      // Use Tesseract to (1) binarize and (2) rotate the native image.
      const angleArg = globalThis.pageMetricsArr[i].angle * (Math.PI / 180) * -1 || 0;

      const res = await tessWorker.recognize(globalThis.imageAll.native[i], { rotateRadians: angleArg }, { imageBinary: true, imageColor: false, debug: true, text: false, hocr: false, tsv: false, blocks: false });

      const img = await loadImage(res.data.imageBinary);

      globalThis.imageAll.binary[i] = img;
      globalThis.imageAll.binaryRotated[i] = true;

    }
  }

  if (robustConfMode) {

    let wordsTotal = 0;
    let wordsHighConf = 0;

    const time2a = Date.now();
    await recognizeAllPages(true, true, false);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    // Select best default fonts
    const change = await selectDefaultFontsDocument(globalThis.ocrAll.active.slice(0, fontEvalPageN), globalThis.imageAll.binary, globalThis.imageAll.binaryRotated, fontAll);

    // Combine Tesseract Legacy and Tesseract LSTM into "Tesseract Combined"
    for (let i = 0; i < globalThis.imageAll["native"].length; i++) {

      const compOptions = {
        mode: "comb",
        ignoreCap: true,
        ignorePunct: false
      };

      const imgElem = await globalThis.imageAll["binary"][i];
      const res = await compareHOCR({
        pageA: ocrAll["Tesseract Legacy"][i], pageB: ocrAll["Tesseract LSTM"][i], binaryImage: imgElem.src,
        imageRotated: globalThis.imageAll["binaryRotated"][i], pageMetricsObj: globalThis.pageMetricsArr[i], options: compOptions
      });

      if (globalThis.debugLog === undefined) globalThis.debugLog = "";
      globalThis.debugLog += res.debugLog;

      globalThis.ocrAll["Tesseract Combined"][i] = res.page;

    }


    for (let i = 0; i < globalThis.imageAll["native"].length; i++) {

      const compOptions = {
        mode: "stats",
        supplementComp: true,
        ignoreCap: true,
        ignorePunct: false,
        tessWorker: tessWorker,
      };

      const imgElem = await globalThis.imageAll["binary"][i];

      const res = await compareHOCR({
        pageA: globalThis.ocrAll.active[i], pageB: ocrAll["Tesseract Combined"][i], binaryImage: imgElem.src,
        imageRotated: globalThis.imageAll["binaryRotated"][i], pageMetricsObj: globalThis.pageMetricsArr[i], options: compOptions
      });

      globalThis.ocrAll.active[i] = res.page;

      if (res?.metrics?.total && res?.metrics?.correct) {
        wordsTotal = wordsTotal + res.metrics.total;
        wordsHighConf = wordsHighConf + res.metrics.correct;
      }

    }

    if (printConf) console.log(`Confidence: ${wordsHighConf / wordsTotal}`);

  } else {

    // Select best default fonts
    const change = await selectDefaultFontsDocument(globalThis.ocrAll.active.slice(0, fontEvalPageN), globalThis.imageAll.binary, globalThis.imageAll.binaryRotated, fontAll);

  }

  if (func == "overlay") {
    const pdfStr = await hocrToPDF(globalThis.ocrAll.active, fontAll, 0, -1, "proof", true, false);
    const enc = new TextEncoder();
    const pdfEnc = enc.encode(pdfStr);
    const pdfOverlay = await w.openDocument(pdfEnc.buffer, "document.pdf");
    const content = backgroundPDF ? await w.overlayText([pdfOverlay, 0, -1, -1, -1]) : await w.overlayTextImage([pdfOverlay, [fileData], 0, -1, -1, -1]);
    const writeFile = util.promisify(fs.writeFile);

    const outputPath = outputDir + "/" + path.basename(backgroundArg).replace(/\.\w{1,5}$/i, "_vis.pdf");

    await writeFile(outputPath, content);
  }

  // Delete temp directory with fonts
  tmpUnique.delete();

  // Terminate all workers
  await tessWorker.terminate();
  generalScheduler.terminate();
  w.terminate();

  process.exitCode = 0;

}

export const confFunc = async (ocr_file) => {
  await main("conf", { ocrFile: ocr_file });
}

export const checkFunc = async (pdf_file, ocr_file) => {
  await main("check", { pdfFile: pdf_file, ocrFile: ocr_file });
}

export const overlayFunc = async (pdf_file, ocr_file, output_dir, options) => {
  await main("overlay", { pdfFile: pdf_file, ocrFile: ocr_file, outputDir: output_dir, robustConfMode: options?.robust || false, printConf: options?.conf || false });
}

