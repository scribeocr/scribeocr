import {
  PageMetrics,
} from '../objects/pageMetricsObjects.js';

import { initMuPDFWorker } from '../../mupdf/mupdf-async.js';

import Tesseract from '../../tess/tesseract.esm.min.js';

import { getPngDimensions, getJpegDimensions } from '../imageUtils.js';

const inputModes = {
  pdf: false,
  image: false,
};

// TODO: This would be cleaner if there was an image class or object that contained both the image and properties like rotated/upscaled.
// Currently, every time an image is passed to a worker, the rotation and upscale status must be passed separately.

/**
 * @param {number} pageCount
 * @property {Array<Promise<String>>|Array<String>} nativeSrcStr - Unedited source images uploaded by user (native color, no rotation), stored as data URL (unused when user provides a PDF).
 * @property {Array<Promise<String>>|Array<String>} nativeStr - Native image (native color, rotation possible), stored as data URL.
 * @property {Array<Boolean>} nativeRotated - Whether `nativeStr` has been rotated versus source image.
 * @property {Array<Promise<String>>|Array<String>} nativeColor - Whether "native" image was rendered from PDF in color or grayscale (unused when user provides images directly).
 * @property {Array<Promise<String>>|Array<String>} binaryStr - Binary image, stored as data URL.
 * @property {Array<Boolean>} binaryRotated - Whether `binaryStr` has been rotated versus source image.
 * @property {Array<Boolean>} binaryRotated - Whether `binaryStr` has been upscaled 2x versus source image.
 *
 * All images are stored as both base-64 encoded strings (data URLs) and `ImageBitmap` objects.
 * This is because `ImageBitmap` objects have the best performance when drawing to canvas,
 * which happens frequently, both for the UI and when using the canvas API for comparison functions.
 * However, both running recognition and writing images to a PDF requires having a base-64 encoded string.
 * Even if an `ImageBitmap` is drawn to a canvas and the canvas is passed to Tesseract.js,
 * Tesseract.js simply uses the `toDataURL` method to make it a string.
 * Additionally, both mupdf and Tesseract.js currently provide images as base-64 encoded strings,
 * so having these adds no computational cost (only memory cost to keep them).
 */
export function ImageCont(pageCount) {
  /** @type {Array<Promise<String>>|Array<String>} */
  this.nativeSrcStr = Array(pageCount);
  /** @type {Array<('jpeg'|'png')>} */
  this.nativeSrcFormat = Array(pageCount);
  /** @type {Array<Promise<String>>|Array<String>} */
  this.nativeStr = Array(pageCount);
  /** @type {Array<Promise<dims>|dims>} */
  this.nativeDims = Array(pageCount);
  /** @type {Array<Promise<String>>|Array<String>} */
  this.binaryStr = Array(pageCount);
  /** @type {Array<Boolean>} */
  this.nativeRotated = Array(pageCount);
  /** @type {Array<Boolean>} */
  this.nativeUpscaled = Array(pageCount);
  /** @type {Array<Boolean>} */
  this.binaryRotated = Array(pageCount);
  /** @type {Array<Boolean>} */
  this.binaryUpscaled = Array(pageCount);
  /** @type {Array<string>} */
  this.nativeColor = Array(pageCount);
}

/**
 * Gets the dimensions of the image at index `n`, calculating them for the first time is needed.
 * @param {number} n
 * @returns {Promise<dims>}
 */
async function getDims(n) {
  if (!imageCont.imageAll.nativeDims[n]) {
    if (imageCont.imageAll.nativeSrcStr[n] && imageCont.imageAll.nativeSrcFormat[n] === 'jpeg') {
      imageCont.imageAll.nativeDims[n] = getJpegDimensions(await imageCont.imageAll.nativeSrcStr[n]);
    } else {
      imageCont.imageAll.nativeDims[n] = getPngDimensions(await imageCont.imageAll.nativeStr[n]);
    }
  }
  return imageCont.imageAll.nativeDims[n];
}

/**
 *
 * @param {number} n
 * @returns {Promise<string>}
 */
async function getBinary(n) {
  await renderImage(n, 'binary');
  return await imageCont.imageAll.binaryStr[n];
}

function clear() {
  imageCont.imageAll = new ImageCont(0);
  if (imageCont.muPDFScheduler) {
    imageCont.muPDFScheduler.scheduler.terminate();
    imageCont.muPDFScheduler = null;
  }
  inputModes.image = false;
  inputModes.pdf = false;
}

let skipTextMode = false;

/**
 *
 * @param {ArrayBuffer} fileData
 * @param {Boolean} [skipText=false] - Whether to skip native text when rendering PDF to image.
 * @param {Boolean} [setPageMetrics=false] - Whether global page metrics should be set using PDF.
 *  This should be `true` when no OCR data is uploaded alongside the PDF.
 * @param {Boolean} [setPageMetrics=false]
 */
async function openMainPDF(fileData, skipText = false, setPageMetrics = false, extractStext = false) {
  console.assert(!imageCont.muPDFScheduler, 'openMainPDF should not be run when imageCont.muPDFScheduler is already defined, report as bug.');
  const muPDFScheduler = await initMuPDFScheduler(fileData, 3);

  imageCont.pageCount = await muPDFScheduler.workers[0].countPages([]);

  const pageDims1 = await muPDFScheduler.workers[0].pageSizes([300]);

  pageDims1.forEach((x) => {
    pdfDims300Arr.push({ width: x[0], height: x[1] });
  });

  imageCont.imageAll = new ImageCont(imageCont.pageCount);
  inputModes.pdf = true;
  skipTextMode = skipText;
  if (setPageMetrics) {
    // For reasons that are unclear, a small number of pages have been rendered into massive files
    // so a hard-cap on resolution must be imposed.
    const pageDPI = pdfDims300Arr.map((x) => 300 * 2000 / Math.max(x.width, 2000));

    // In addition to capping the resolution, also switch the width/height
    pdfDims300Arr.forEach((x, i) => {
      const pageDims = { width: Math.round(x.width * pageDPI[i] / 300), height: Math.round(x.height * pageDPI[i] / 300) };
      globalThis.pageMetricsArr[i] = new PageMetrics(pageDims);
    });

    if (extractStext) {
      globalThis.hocrCurrentRaw = Array(imageCont.pageCount);
      const resArr = pageDPI.map(async (x, i) => {
        globalThis.hocrCurrentRaw[i] = await muPDFScheduler.pageTextXML({ page: i + 1, dpi: Math.round(x) });
      });
      await Promise.all(resArr);
    }
  }
}

export class MuPDFScheduler {
  constructor(scheduler, workers) {
    this.scheduler = scheduler;
    /** @type {Array<Awaited<ReturnType<typeof initMuPDFWorker>>>} */
    this.workers = workers;
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextXML>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextXML>>}
     */
    this.pageTextXML = async (args) => (await this.scheduler.addJob('pageTextXML', args));
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.drawPageAsPNG>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.drawPageAsPNG>>}
     */
    this.drawPageAsPNG = async (args) => (await this.scheduler.addJob('drawPageAsPNG', args));
  }
}

const pageCount = 0;

/**
 * The dimensions that each page would be, if it was rendered at 300 DPI.
 * @type {Array<dims>}
 */
const pdfDims300Arr = [];

/**
 *
 * @param {?ArrayBuffer} fileData
 * @param {number} numWorkers
 * @returns
 */
async function initMuPDFScheduler(fileData, numWorkers = 3) {
  if (imageCont.muPDFScheduler) return imageCont.muPDFScheduler;
  const scheduler = await Tesseract.createScheduler();
  const workersPromiseArr = range(1, numWorkers).map(async () => {
    const w = await initMuPDFWorker();
    // Open file if provided.
    // File is generally provided, however will be missing if images were uploaded and
    // the PDF scheduler is being created to handle a PDF download.
    if (fileData) {
      // The ArrayBuffer is transferred to the worker, so a new one must be created for each worker.
      // const fileData = await file.arrayBuffer();
      const fileDataCopy = fileData.slice(0);
      const pdfDoc = await w.openDocument(fileDataCopy, 'document.pdf');
      w.pdfDoc = pdfDoc;
    }
    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    scheduler.addWorker(w);
    return w;
  });

  const workers = await Promise.all(workersPromiseArr);

  imageCont.muPDFScheduler = new MuPDFScheduler(scheduler, workers);

  return imageCont.muPDFScheduler;
}

/**
 * Renders images and stores them in cache array (or returns early if the requested image already exists).
 * Contains 2 distinct image rendering steps:
 * 1. Pages are rendered from .pdf to .png [either color or grayscale] using muPDF
 * 2. Existing .png images are processed (currently rotation and/or thresholding) using Tesseract/Leptonica
 *
 * @async
 * @param {number} n - Array of page numbers to render
 * @param {string|null} [colorMode=null] - Color mode ("color", "gray", or "binary"). If null, defaults to `imageCont.colorModeDefault`.
 * @param {boolean|null} [rotate=null] - Whether to apply rotation to the images (true/false), or no preference (null).
 * @param {Object|null} [progress=null] - A progress tracking object, which should have an `increment` method.
 * @returns {Promise<void>} A promise that resolves when all the images have been processed.
 */
async function renderImage(n, colorMode = null, rotate = null, upscale = null, progress = null) {
  // Return early if there is no image data to render.
  if (!inputModes.pdf && !inputModes.image) return;

  // Return early if requested page does not exist
  if (n < 0 || n >= imageCont.imageAll.nativeStr.length) {
    // console.log(`Requested page ${n} does not exist; exiting early.`);
    return;
  }

  colorMode = colorMode || imageCont.colorModeDefault;
  const colorName = colorMode === 'binary' ? 'binary' : 'native';

  // Load non-rotated, non-binarized image (image mode)
  if (inputModes.image) {
    // Load image if either (1) it has never been loaded in the first place, or
    // (2) the current image is rotated but a non-rotated image is requested, revert to the original (user-uploaded) image.
    if ((!imageCont.imageAll.nativeStr[n] && imageCont.imageAll.nativeSrcStr[n]) || (rotate === false && imageCont.imageAll.nativeRotated[n] === true)
      || (upscale === false && imageCont.imageAll.nativeUpscaled[n] === true)) {
      imageCont.imageAll.nativeRotated[n] = false;
      imageCont.imageAll.nativeUpscaled[n] = false;
      imageCont.imageAll.nativeStr[n] = imageCont.imageAll.nativeSrcStr[n];
      if (globalThis.imageCache) delete globalThis.imageCache.native[n];
    }
  }

  // Load non-rotated, non-binarized image (pdf mode)
  if (inputModes.pdf) {
    // In pdfMode, determine whether an original/unedited version of the image needs to be obtained.
    // This can happen for 3 reasons:
    // 1. Page has not yet been rendered
    // 2. Page was previously rendered, but in different colorMode (gray vs. color)
    // 3. Page was overwritten by rotated version, but a non-rotated version is needed
    const renderNativePDF = !!((!imageCont.imageAll.nativeStr[n]
      || (colorMode !== 'binary' && imageCont.imageAll.nativeColor[n] !== colorMode)
      || rotate === false && imageCont.imageAll.nativeRotated[n] === true
      || upscale === false && imageCont.imageAll.nativeUpscaled[n] === true));

    if (renderNativePDF) {
      imageCont.imageAll.nativeColor[n] = colorMode;
      imageCont.imageAll.nativeRotated[n] = false;
      imageCont.imageAll.nativeUpscaled[n] = false;

      const pageMetrics = globalThis.pageMetricsArr[n];

      // Return if no pageMetrics object exists. This can happen during the import.
      // Eventually pageMetricsArr should be transitioned to use promises,
      // but this avoids a crash in the meantime.
      if (!pageMetrics) return;

      const targetWidth = pageMetrics.dims.width;
      const dpi = 300 * (targetWidth / pdfDims300Arr[n].width);

      if (!imageCont.muPDFScheduler) {
        console.log('Cannot render PDF page as no PDF scheduler exists; returning early.');
        return;
      }

      const color = colorMode === 'color';

      const resPromise = imageCont.muPDFScheduler.drawPageAsPNG({
        page: n + 1, dpi, color, skipText: skipTextMode,
      });

      imageCont.imageAll.nativeStr[n] = resPromise;
      if (globalThis.imageCache) delete globalThis.imageCache.native[n];
    }
  }

  // Whether binarized image needs to be rendered
  const renderBinary = colorMode === 'binary' && !imageCont.imageAll.binaryStr[n];

  // // Whether native image needs to be rendered
  // const renderNativeImage = colorMode == "gray" && imageCont.imageAll["nativeColor"][n] == "color";

  // Whether binarized image needs to be rotated (or re-rendered without rotation)
  const rotateBinary = colorMode === 'binary'
        && (rotate === true && !imageCont.imageAll.binaryRotated[n] && Math.abs(globalThis.pageMetricsArr[n].angle || 0) > 0.05
        || rotate === false && imageCont.imageAll.binaryRotated[n] === true);

  const upscaleBinary = colorMode === 'binary'
        && (upscale === true && !imageCont.imageAll.binaryUpscaled[n]
        || upscale === false && imageCont.imageAll.binaryUpscaled[n] === true);

  const processBinary = renderBinary || rotateBinary || upscaleBinary;

  // Whether native image needs to be rotated
  const rotateNative = colorName === 'native' && (rotate === true && !imageCont.imageAll.nativeRotated[n] && Math.abs(globalThis.pageMetricsArr[n].angle || 0) > 0.05);

  const upscaleNative = colorName === 'native' && (upscale === true && !imageCont.imageAll.nativeUpscaled[n]);

  const processNative = rotateNative || upscaleNative;

  // If nothing needs to be done, return early.
  if (!(processBinary || processNative)) {
    if (progress) progress.increment();
    await imageCont.imageAll.nativeStr[n];
    return;
  }

  // If no preference is specified for rotation, default to true
  const angleArg = rotate !== false ? (globalThis.pageMetricsArr[n].angle || 0) * (Math.PI / 180) * -1 || 0 : 0;

  const upscaleArg = upscale || false;

  const saveBinaryImageArg = true;
  const saveColorImageArg = processNative;

  const gs = globalThis.gs;

  const resPromise = (async () => {
    // Wait for non-rotated version before replacing with promise
    const inputImage = await Promise.resolve(imageCont.imageAll.nativeStr[n]);

    return gs.recognize({
      image: inputImage,
      options: { rotateRadians: angleArg, upscale: upscaleArg },
      output: {
        imageBinary: true, imageColor: true, debug: true, text: false, hocr: false, tsv: false, blocks: false,
      },
    });
  })();

  // Update progress bar after Tesseract is finished running.
  if (progress) {
    resPromise.then(() => {
      progress.increment();
    });
  }

  if (saveColorImageArg) {
    imageCont.imageAll.nativeRotated[n] = Boolean(angleArg);
    imageCont.imageAll.nativeUpscaled[n] = upscaleArg;
    imageCont.imageAll.nativeStr[n] = resPromise.then(async (res) => (res.imageColor));
    if (globalThis.imageCache) delete globalThis.imageCache.native[n];
  }

  if (saveBinaryImageArg) {
    imageCont.imageAll.binaryRotated[n] = Boolean(angleArg);
    imageCont.imageAll.binaryUpscaled[n] = upscaleArg;
    imageCont.imageAll.binaryStr[n] = resPromise.then(async (res) => (res.imageBinary));
    if (globalThis.imageCache) delete globalThis.imageCache.binary[n];
  }

  // Return after everything is done.
  await imageCont.imageAll.nativeStr[n];
  await imageCont.imageAll.binaryStr[n];
}

function range(min, max) {
  const result = [];
  for (let i = min; i <= max; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Calls `renderImage` for all pages between `min` and `max` (inclusive).
 * Can be used to render a few pages ahead when using the interactive UI,
 * or to render all pages when using Node.js or preparing an export.
 *
 * @async
 * @param {number} min - Min page to render.
 * @param {number} max - Max page to render.
 * @param {string|null} [colorMode=null] - Color mode ("color", "gray", or "binary"). If null, defaults to `imageCont.colorModeDefault`.
 * @param {boolean|null} [rotate=null] - Whether to apply rotation to the images (true/false), or no preference (null).
 * @param {boolean|null} [upscale=null] - Whether to upscale the images (true/false), or no preference (null).
 * @param {Object|null} [progress=null] - A progress tracking object, which should have an `increment` method.
 * @returns {Promise<void>} A promise that resolves when all the images have been processed.
 */
async function renderImageRange(min, max, colorMode = null, rotate = null, upscale = null, progress = null) {
  const pagesArr = range(min, max);
  await Promise.all(pagesArr.map((n) => renderImage(n, colorMode, rotate, upscale, progress)));
}

// TODO: Add event handler so the colorModeDefault is set by the UI.

export const imageCont = {
  clear,
  inputModes,
  openMainPDF,
  pageCount,
  renderImage,
  renderImageRange,
  /** @type {('color'|'gray'|'binary')} Default color mode used by `renderImage` when missing `colorMode` argument. */
  colorModeDefault: 'gray',
  imageAll: new ImageCont(0),
  getBinary,
  getDims,
  initMuPDFScheduler,
  /** @type {?MuPDFScheduler} */
  muPDFScheduler: null,
};
