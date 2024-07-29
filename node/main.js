// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import fs from 'fs';
import path from 'path';
import { runFontOptimization } from '../js/fontEval.js';

import ocr from '../js/objects/ocrObjects.js';

import { drawDebugImages } from '../js/debug.js';

import {
  DebugData,
  ocrAll,
} from '../js/containers/dataContainer.js';
import { loadBuiltInFontsRaw } from '../js/fontContainerMain.js';

import { clearData } from '../js/clear.js';
import { opt } from '../js/containers/app.js';
import { gs } from '../js/containers/schedulerContainer.js';
import { handleDownload } from '../js/export/export.js';
import { writeDebugCsv } from '../js/export/exportDebugCsv.js';
import { calcFontMetricsFromPages } from '../js/fontStatistics.js';
import { initGeneralScheduler, initTesseractInWorkers } from '../js/generalWorkerMain.js';
import { importFilesAll } from '../js/import/import.js';
import { recognizeAll } from '../js/recognizeConvert.js';
import { calcConf } from '../js/utils/ocrUtils.js';
import { tmpUnique } from '../js/worker/compareOCRModule.js';

// When `debugMode` is enabled:
// (1) Comparison images are saved as .png files.
// (2) Comparison logs are saved as .txt files.
// (3) All OCR data is dumped as .hocr files.
const debugMode = false;

opt.saveDebugImages = debugMode;

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
 * @param {import('canvas').CanvasRenderingContext2D} ctx
 * @param {Array<Array<CompDebugNode>>} compDebugArrArr
 * @param {string} filePath
 */
async function writeDebugImages(ctx, compDebugArrArr, filePath) {
  await drawDebugImages({ ctx, compDebugArrArr, context: 'node' });
  const buffer0 = ctx.canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer0);
}

async function dumpDebugImagesAll() {
  if (!DebugData.debugImg.Combined || DebugData.debugImg.Combined.length === 0) {
    console.log('No debug images to dump.');
    console.log(DebugData.debugImg);
    return;
  }

  for (let i = 0; i < DebugData.debugImg.Combined.length; i++) {
    const filePath = `${debugDir}legacy_lstm_comp_${i}.png`;
    await writeDebugImages(ctxDebug, [DebugData.debugImg.Combined[i]], filePath);
  }
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

  const robustConfMode = func === 'check' || params.robustConfMode || false;

  opt.displayMode = params.overlayMode || 'invis';
  opt.combineMode = robustConfMode ? 'conf' : 'data';

  const output = {};

  const debugComp = false;

  const files = [];
  if (params.pdfFile) files.push(params.pdfFile);
  if (params.ocrFile) files.push(params.ocrFile);
  await importFilesAll(files);

  const backgroundArg = params.pdfFile;
  const backgroundArgStem = backgroundArg ? path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '') : undefined;
  const outputDir = params.outputDir || '.';

  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  // Is this comment still relevant?
  // TODO: (1) Find out why font data is not being imported correctly from .hocr files.
  // (2) Use Tesseract Legacy font data when (1) recognition is being run anyway and (2) no font metrics data exists already.
  if (robustConfMode || func === 'eval' || func === 'recognize') {
    await recognizeAll('combined');
    if (func === 'recognize') {
      output.text = ocrAll.active.map((x) => ocr.getPageText(x)).join('\n');
    }
  } else {
    calcFontMetricsFromPages(ocrAll.active);
    await runFontOptimization(ocrAll.active);
  }

  if (func === 'check' || func === 'conf' || params.printConf) {
    const { highConf, total } = calcConf(ocrAll.active);
    console.log(`Confidence: ${highConf / total} (${highConf} of ${total})`);
    if (func === 'conf') {
      await gs.clear();
      clearData();
      return output;
    }
  }

  if (['overlay', 'recognize'].includes(func) && backgroundArg) {
    let outputSuffix = '';
    if (opt.displayMode === 'proof') {
      outputSuffix = '_vis';
    } else if (opt.displayMode === 'invis') {
      const resolvedInputFile = path.dirname(path.resolve(backgroundArg));
      const resolvedOutputDir = path.resolve(outputDir);
      if (resolvedInputFile === resolvedOutputDir) {
        outputSuffix = '_ocr';
      }
    }

    const outputPath = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, `${outputSuffix}.pdf`)}`;
    await handleDownload('pdf', outputPath);
  }

  if (debugComp) {
    const outputPath = `${__dirname}/../../dev/debug/${backgroundArgStem}_debug.csv`;
    writeDebugCsv(ocrAll.active, outputPath);
  }

  if (debugMode) dumpDebugImagesAll();

  // Delete temp directory with fonts
  await tmpUnique.delete();

  // Terminate all workers
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
 * @param {Object} options
 * @param {"eval" | "ebook" | "proof" | "invis"} [options.overlayMode]
 * @returns
 */
export const recognize = async (pdfFile, options) => (main('recognize', { pdfFile, overlayMode: options?.overlayMode || 'invis' }));

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
