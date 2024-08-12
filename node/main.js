// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import fs from 'fs';
import path from 'path';

import { tmpUnique } from '../js/worker/compareOCRModule.js';
import scribe from '../module.js';

// When `debugMode` is enabled:
// (1) Comparison images are saved as .png files.
// (2) Comparison logs are saved as .txt files.
// (3) All OCR data is dumped as .hocr files.
const debugMode = false;

scribe.opt.saveDebugImages = debugMode;

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
  await scribe.utils.drawDebugImages({ ctx, compDebugArrArr, context: 'node' });
  const buffer0 = ctx.canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer0);
}

async function dumpDebugImagesAll() {
  if (!scribe.data.debug.debugImg.Combined || scribe.data.debug.debugImg.Combined.length === 0) {
    console.log('No debug images to dump.');
    return;
  }

  for (let i = 0; i < scribe.data.debug.debugImg.Combined.length; i++) {
    const filePath = `${debugDir}legacy_lstm_comp_${i}.png`;
    await writeDebugImages(ctxDebug, [scribe.data.debug.debugImg.Combined[i]], filePath);
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
  await scribe.init({
    pdf: true,
    ocr: true,
    font: true,
  });

  const robustConfMode = func === 'check' || params.robustConfMode || false;

  scribe.opt.displayMode = params.overlayMode || 'invis';
  const combineMode = robustConfMode ? 'conf' : 'data';

  const output = {};

  const debugComp = false;

  const files = [];
  if (params.pdfFile) files.push(params.pdfFile);
  if (params.ocrFile) files.push(params.ocrFile);
  await scribe.importFiles(files);

  const backgroundArg = params.pdfFile;
  const backgroundArgStem = backgroundArg ? path.basename(backgroundArg).replace(/\.\w{1,5}$/i, '') : undefined;
  const outputDir = params.outputDir || '.';

  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  // Is this comment still relevant?
  // TODO: (1) Find out why font data is not being imported correctly from .hocr files.
  // (2) Use Tesseract Legacy font data when (1) recognition is being run anyway and (2) no font metrics data exists already.
  if (robustConfMode || func === 'eval' || func === 'recognize') {
    await scribe.recognize({
      modeAdv: 'combined',
      combineMode,
    });
    if (func === 'recognize') {
      output.text = scribe.data.ocr.active.map((x) => scribe.utils.ocr.getPageText(x)).join('\n');
    }
  }

  if (func === 'check' || func === 'conf' || params.printConf) {
    const { highConf, total } = scribe.utils.calcConf(scribe.data.ocr.active);
    console.log(`Confidence: ${highConf / total} (${highConf} of ${total})`);
    if (func === 'conf') {
      scribe.terminate();
      return output;
    }
  }

  if (['overlay', 'recognize'].includes(func) && backgroundArg) {
    let outputSuffix = '';
    if (scribe.opt.displayMode === 'proof') {
      outputSuffix = '_vis';
    } else if (scribe.opt.displayMode === 'invis') {
      const resolvedInputFile = path.dirname(path.resolve(backgroundArg));
      const resolvedOutputDir = path.resolve(outputDir);
      if (resolvedInputFile === resolvedOutputDir) {
        outputSuffix = '_ocr';
      }
    }

    const outputPath = `${outputDir}/${path.basename(backgroundArg).replace(/\.\w{1,5}$/i, `${outputSuffix}.pdf`)}`;
    await scribe.download('pdf', outputPath);
  }

  if (debugComp) {
    const outputPath = `${__dirname}/../../dev/debug/${backgroundArgStem}_debug.csv`;
    scribe.utils.writeDebugCsv(scribe.data.ocr.active, outputPath);
  }

  if (debugMode) dumpDebugImagesAll();

  // Delete temp directory with fonts
  await tmpUnique.delete();

  scribe.terminate();

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
