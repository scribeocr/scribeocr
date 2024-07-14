import {
  PageMetrics,
} from '../objects/pageMetricsObjects.js';

import { initMuPDFWorker } from '../../mupdf/mupdf-async.js';

import Tesseract from '../../tess/tesseract.esm.min.js';

import { getImageBitmap, getJpegDimensions, getPngDimensions } from '../utils/imageUtils.js';

import { setUploadFontsWorker } from '../fontContainerMain.js';
import { ocrAllRaw, pageMetricsArr } from './dataContainer.js';
import {
  FontContainerFont,
  fontAll,
  loadOpentype,
} from './fontContainer.js';

import { initTesseractInWorkers } from '../generalWorkerMain.js';
import { determineSansSerif } from '../utils/miscUtils.js';
import { gs } from './schedulerContainer.js';

function range(min, max) {
  const result = [];
  for (let i = min; i <= max; i++) {
    result.push(i);
  }
  return result;
}

/**
 *
 * @param {ImageWrapper} img
 * @returns
 */
const getDims = async (img) => {
  if (!img._dims) {
    if (img.format === 'jpeg') {
      img._dims = getJpegDimensions(img.src);
    } else {
      img._dims = getPngDimensions(img.src);
    }
  }
  return img._dims;
};

/**
 * Checks whether existing transformations need to be undone by re-rendering raw image.
 * When an existing image has an unwanted tranformation, it is re-rendered from the original source,
 * rather than attempting to unrotate/downscale/etc. the transformed image.
 *
 * @param {ImageWrapper} img
 * @param {?ImagePropertiesRequest|ImageWrapper} [props]
 * @returns
 */
const requiresUndo = (img, props) => {
  if (!props) return false;
  if (img.rotated && props.rotated === false) return true;
  if (img.upscaled && props.upscaled === false) return true;
  // This condition should only apply to PDFs.
  if (img.colorMode === 'color' && props.colorMode === 'gray' || img.colorMode === 'gray' && props.colorMode === 'color') return true;
  return false;
};

/**
 * Whether the image properties are compatible with the requested properties.
 * @param {ImageWrapper} img
 * @param {?ImagePropertiesRequest|ImageWrapper} [props]
 */
const compatible = (img, props) => {
  if (!props) return true;
  if (props.rotated === false && img.rotated === true) {
    // Requests to unrotate an image are always respected, even if the angle is very close to 0.
    // This is because the intent may be to restore the raw user-uploaded image for an export, which should always be possible.
    return false;
  } if (props.rotated === true && img.rotated === false) {
    // An unrotated image is considered compatible with a rotated request if the angle is very close to 0.
    if (Math.abs(pageMetricsArr[img.n].angle || 0) > 0.05) {
      return false;
    }
  }

  if (props.upscaled === true && img.upscaled === false || props.upscaled === false && img.upscaled === true) return false;

  // The value 'native' is used for images uploaded from the user, and is essentially a default value.
  // These cannot be considered incompatible with any color mode as the color of user-uploaded images is never edited (binarization aside).
  if (props.colorMode && props.colorMode !== img.colorMode && img.colorMode !== 'native' && img.colorMode !== 'native') return false;
  return true;
};

export const imageUtils = {
  getDims,
  requiresUndo,
  compatible,
};

let skipTextMode = false;

export class MuPDFScheduler {
  constructor(scheduler, workers) {
    this.scheduler = scheduler;
    /** @type {Array<Awaited<ReturnType<typeof initMuPDFWorker>>>} */
    this.workers = workers;
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextXML>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextXML>>}
     */
    this.pageTextXML = (args) => (this.scheduler.addJob('pageTextXML', args));
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextJSON>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageTextJSON>>}
     */
    this.pageTextJSON = (args) => (this.scheduler.addJob('pageTextJSON', args));
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.extractAllFonts>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.extractAllFonts>>}
     */
    this.extractAllFonts = (args) => (this.scheduler.addJob('extractAllFonts', args));
    /**
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.drawPageAsPNG>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.drawPageAsPNG>>}
     */
    this.drawPageAsPNG = (args) => (this.scheduler.addJob('drawPageAsPNG', args));
  }
}

/**
 * The dimensions that each page would be, if it was rendered at 300 DPI.
 * @type {Array<dims>}
 */
const pdfDims300Arr = [];

export class ImageWrapper {
  /**
   * @param {number} n - Page number
   * @param {string} imageStr - Base-64 encoded image string.
   * @param {('jpeg'|'png')} format - Image format ("jpeg" or "png").
   * @param {string} colorMode - Color mode ("color", "gray", or "binary").
   * @param {boolean} rotated - Whether image has been rotated.
   * @param {boolean} upscaled - Whether image has been upscaled.
   *
   * All properties of this object must be serializable, as ImageWrapper objects are sent between threads.
   * This means that no promises can be used.
   */
  constructor(n, imageStr, format, colorMode, rotated = false, upscaled = false) {
    this.n = n;
    this.src = imageStr;
    this.format = format;
    this._dims = null;
    this.rotated = rotated;
    this.upscaled = upscaled;
    this.colorMode = colorMode;
    /** @type {?ImageBitmap} */
    this.imageBitmap = null;
  }
}

/**
 * @typedef {Object} ImagePropertiesRequest
 * @property {?boolean} [rotated]
 * @property {?boolean} [upscaled]
 * @property {?('color'|'gray'|'binary')} [colorMode]
 */

// TODO: Either separate out the imagebitmap again or edit so it does not get sent between threads.
// Alternatively, if it is sent between threads, use it reather than making a new one.
// Actually, definitely do that last option.

class ImageCache {
  constructor() {
    /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
    this.nativeSrc = [];
    /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
    this.native = [];
    /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
    this.binary = [];
    /** @type {?Promise<MuPDFScheduler>} */
    this.muPDFScheduler = null;
    this.pageCount = 0;
    this.inputModes = {
      pdf: false,
      image: false,
    };
    this.colorModeDefault = 'gray';
    this.cacheRenderPages = 3;
    this.cacheDeletePages = 5;
  }

  // The bitmap images are only created as needed, due to the enormous amount of memory they use.
  // Additionally, they cannot be stored as promises, as the ImageWrapper object needs to be able to be sent between threads.
  // Therefore, to avoid a race condition where the bitmap is created multiple times, a promise is stored in this array.
  // These promises will be pending while the bitmap is being created, and will resolve to true once the bitmap is created.

  /** @type {Array<?Promise<boolean>>} */
  #nativeBitmapPromises = [];

  /** @type {Array<?Promise<boolean>>} */
  #binaryBitmapPromises = [];

  /**
   * Initializes the MuPDF scheduler.
   * This is separate from the function that loads the file (`#loadFileMuPDFScheduler`),
   * as the scheduler starts loading ahead of the file being available for performance reasons.
   * @param {number} numWorkers
   * @returns
   */
  #initMuPDFScheduler = async (numWorkers = 3) => {
    const scheduler = await Tesseract.createScheduler();
    const workersPromiseArr = range(1, numWorkers).map(async () => {
      const w = await initMuPDFWorker();
      w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
      scheduler.addWorker(w);
      return w;
    });

    const workers = await Promise.all(workersPromiseArr);

    return new MuPDFScheduler(scheduler, workers);
  };

  /**
   *
   * @param {ArrayBuffer} fileData
   * @returns
   */
  #loadFileMuPDFScheduler = async (fileData) => {
    const scheduler = await this.getMuPDFScheduler();

    const workersPromiseArr = range(0, scheduler.workers.length - 1).map(async (x) => {
      const w = scheduler.workers[x];
      // The ArrayBuffer is transferred to the worker, so a new one must be created for each worker.
      // const fileData = await file.arrayBuffer();
      const fileDataCopy = fileData.slice(0);
      const pdfDoc = await w.openDocument(fileDataCopy, 'document.pdf');
      w.pdfDoc = pdfDoc;
    });

    await Promise.all(workersPromiseArr);
  };

  #renderImage = async (n, color = false) => {
    if (this.inputModes.image) {
      this.native[n] = this.nativeSrc[n];
    } else if (this.inputModes.pdf) {
      const pageMetrics = pageMetricsArr[n];

      const targetWidth = pageMetrics.dims.width;
      const dpi = 300 * (targetWidth / pdfDims300Arr[n].width);
      const muPDFScheduler = await this.getMuPDFScheduler();
      this.native[n] = muPDFScheduler.drawPageAsPNG({
        page: n + 1, dpi, color, skipText: skipTextMode,
      }).then((res) => new ImageWrapper(n, res, 'png', color ? 'color' : 'gray'));
    }
    await this.native[n];
  };

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   * @param {boolean} [saveNativeImage=true] - Whether the native image should be saved.
   */
  transformImage = async (n, props, saveNativeImage = true) => {
    const inputImage = await Promise.resolve(this.native[n]);

    let pageAngle = pageMetricsArr[n].angle || 0;
    if (Math.abs(pageAngle) < 0.05) pageAngle = 0;

    // If no preference is specified for rotation, default to true.
    const rotate = props?.rotated !== false && inputImage.rotated === false;
    const angleArg = rotate ? pageAngle * (Math.PI / 180) * -1 : 0;

    // If no preference is specified for upscaling, default to false.
    const upscaleArg = props?.upscaled || false;

    const scheduler = await gs.getScheduler();

    const resPromise = (async () => {
    // Wait for non-rotated version before replacing with promise
      if (typeof process === 'undefined') await initTesseractInWorkers({ anyOk: false });
      return scheduler.recognize({
        image: inputImage.src,
        options: { rotateRadians: angleArg, upscale: upscaleArg },
        output: {
          imageBinary: true, imageColor: saveNativeImage, debug: true, text: false, hocr: false, tsv: false, blocks: false,
        },
      });
    })();

    const isRotated = Boolean(angleArg) || inputImage.rotated;

    if (saveNativeImage) {
      this.native[n] = resPromise.then(async (res) => new ImageWrapper(n, /** @type {string} */(/** @type {unknown} */(res.imageColor)), 'png', inputImage.colorMode, isRotated, upscaleArg));
    }

    this.binary[n] = resPromise.then(async (res) => new ImageWrapper(n, /** @type {string} */(/** @type {unknown} */(res.imageBinary)), 'png', 'binary', isRotated, upscaleArg));

    if (saveNativeImage) await this.native[n];
    await this.binary[n];
  };

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  getNative = async (n, props) => {
    let nativeN = await this.native[n];
    if (!nativeN || !imageUtils.compatible(nativeN, props)) {
      // The image is rendered if either (1) it has never been loaded in the first place, or
      // (2) the current image is transformed and this needs to be undone.
      if (!nativeN || imageUtils.requiresUndo(nativeN, props)) {
        const color = props?.colorMode === 'color' || !props?.colorMode && this.colorModeDefault === 'color';
        await this.#renderImage(n, color);
        nativeN = await this.native[n];
      }
      if (!imageUtils.compatible(nativeN, props)) {
        await this.transformImage(n, props, true);
        nativeN = await this.native[n];
      }
    }
    return nativeN;
  };

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  getNativeBitmap = async (n, props) => {
    const nativeN = await this.getNative(n, props);
    if (this.#nativeBitmapPromises[n]) await this.#nativeBitmapPromises[n];
    if (!nativeN.imageBitmap) {
      const bitmapPromise = getImageBitmap(nativeN.src);

      this.#nativeBitmapPromises[n] = bitmapPromise.then(() => (true));
      nativeN.imageBitmap = await bitmapPromise;
    }
    return nativeN.imageBitmap;
  };

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  getBinary = async (n, props) => {
    let nativeN = await this.native[n];
    let binaryN = await this.binary[n];
    if (!binaryN || !imageUtils.compatible(binaryN, props)) {
      // The image is rendered if either (1) it has never been loaded in the first place, or
      // (2) the current image is transformed and this needs to be undone.
      const propsNative = { ...props };
      propsNative.colorMode = null;
      if (!nativeN || !imageUtils.requiresUndo(nativeN, propsNative)) {
        const color = props?.colorMode === 'color' || !props?.colorMode && this.colorModeDefault === 'color';
        await this.#renderImage(n, color);
        nativeN = await this.native[n];
      }

      await this.transformImage(n, props, false);
      binaryN = await this.binary[n];
    }
    return binaryN;
  };

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  getBinaryBitmap = async (n, props) => {
    const binaryN = await this.getBinary(n, props);
    if (this.#binaryBitmapPromises[n]) await this.#binaryBitmapPromises[n];
    if (!binaryN.imageBitmap) {
      const bitmapPromise = getImageBitmap(binaryN.src);

      this.#binaryBitmapPromises[n] = bitmapPromise.then(() => (true));
      binaryN.imageBitmap = await bitmapPromise;
    }
    return binaryN.imageBitmap;
  };

  /**
   * Pre-render a range of pages.
   * This is generally not required, as individual image are rendered as needed.
   * The primary use case is reducing latency in the UI by rendering images in advance.
   *
   * @param {number} min - Min page to render.
   * @param {number} max - Max page to render.
   * @param {boolean} binary - Whether to render binary images.
   * @param {?ImagePropertiesRequest} [props=null]
   * @param {?ProgressBar} [progress=null] - A progress tracking object, which should have an `increment` method.
   */
  preRenderRange = async (min, max, binary, props = null, progress = null) => {
    const pagesArr = range(min, max);
    if (binary) {
      await Promise.all(pagesArr.map((n) => this.getBinary(n, props).then(() => {
        if (progress) progress.increment();
      })));
    } else {
      await Promise.all(pagesArr.map((n) => this.getNative(n, props).then(() => {
        if (progress) progress.increment();
      })));
    }
  };

  /**
   * Pre-render ahead and behind the current page.
   * This is similar to `preRenderRange`, however has several differences:
   * (1) Starts rendering at the current page, and goes outward from there.
   * (2) Also renders image bitmaps (not just the image strings), and deletes them when they are sufficiently far away.
   * @param {number} curr
   * @param {boolean} binary
   */
  preRenderAheadBehindBrowser = async (curr, binary = false) => {
    const resArr = [];
    if (binary) {
      resArr.push(this.getBinaryBitmap(curr));
    } else {
      resArr.push(this.getNativeBitmap(curr));
    }

    // Delete images that are sufficiently far away from the current page to save memory.
    this.#cleanBitmapCache(curr);

    for (let i = 0; i <= this.cacheRenderPages; i++) {
      if (curr - i >= 0) {
        if (binary) {
          resArr.push(this.getBinaryBitmap(curr - i));
        } else {
          resArr.push(this.getNativeBitmap(curr - i));
        }
      }
      if (curr + i < this.pageCount) {
        if (binary) {
          resArr.push(this.getBinaryBitmap(curr + i));
        } else {
          resArr.push(this.getNativeBitmap(curr + i));
        }
      }
    }

    await Promise.all(resArr);
  };

  #cleanBitmapCache = (curr) => {
    // Delete images that are sufficiently far away from the current page to save memory.
    for (let i = 0; i < imageCache.pageCount; i++) {
      if (Math.abs(curr - i) > this.cacheDeletePages) {
        if (imageCache.native[i]) {
          Promise.resolve(imageCache.native[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
        if (imageCache.binary[i]) {
          Promise.resolve(imageCache.binary[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
      }
    }
  };

  clear = async () => {
    this.nativeSrc = [];
    this.native = [];
    this.binary = [];
    if (this.muPDFScheduler) {
      const muPDFScheduler = await this.muPDFScheduler;
      muPDFScheduler.scheduler.terminate();
      this.muPDFScheduler = null;
    }
    this.inputModes.image = false;
    this.inputModes.pdf = false;
    this.pageCount = 0;
  };

  /**
   * Gets the MuPDF scheduler if it exists, otherwise creates a new one.
   * @param {number} [numWorkers=3] - Number of workers to create.
   * @returns
   */
  getMuPDFScheduler = async (numWorkers = 3) => {
    if (this.muPDFScheduler) return this.muPDFScheduler;
    this.muPDFScheduler = this.#initMuPDFScheduler(numWorkers);
    return this.muPDFScheduler;
  };

  /**
   *
   * @param {ArrayBuffer} fileData
   * @param {Boolean} [skipText=false] - Whether to skip native text when rendering PDF to image.
   * @param {Boolean} [setPageMetrics=false] - Whether global page metrics should be set using PDF.
   *  This should be `true` when no OCR data is uploaded alongside the PDF.
   * @param {Boolean} [setPageMetrics=false]
   */
  openMainPDF = async (fileData, skipText = false, setPageMetrics = false, extractStext = false) => {
    const muPDFScheduler = await this.getMuPDFScheduler(3);

    await this.#loadFileMuPDFScheduler(fileData);

    this.pageCount = await muPDFScheduler.workers[0].countPages();

    const pageDims1 = await muPDFScheduler.workers[0].pageSizes([300]);

    pageDims1.forEach((x) => {
      pdfDims300Arr.push({ width: x[0], height: x[1] });
    });

    this.inputModes.pdf = true;
    skipTextMode = skipText;
    if (setPageMetrics) {
    // For reasons that are unclear, a small number of pages have been rendered into massive files
    // so a hard-cap on resolution must be imposed.
      const pageDPI = pdfDims300Arr.map((x) => 300 * 2000 / x.width, 2000);

      // In addition to capping the resolution, also switch the width/height
      pdfDims300Arr.forEach((x, i) => {
        const pageDims = { width: Math.round(x.width * pageDPI[i] / 300), height: Math.round(x.height * pageDPI[i] / 300) };
        pageMetricsArr[i] = new PageMetrics(pageDims);
      });

      // WIP: Extract fonts embedded in PDFs.
      if (false) {
        muPDFScheduler.extractAllFonts().then(async (x) => {
          globalThis.fontArr = [];
          for (let i = 0; i < x.length; i++) {
            const src = x[i].buffer;
            const fontObj = await loadOpentype(src);
            const fontNameEmbedded = fontObj.names.postScriptName.en;
            const fontFamilyEmbedded = fontObj.names?.fontFamily?.en || fontNameEmbedded.replace(/-\w+$/, '');

            // Skip bold and bold-italic fonts for now.
            if (fontNameEmbedded.match(/bold/i)) continue;

            let fontStyle = 'normal';
            if (fontNameEmbedded.match(/italic/i)) {
              fontStyle = 'italic';
            } else if (fontNameEmbedded.match(/bold/i)) {
            // Bold fonts should be enabled at some later point.
            // While we previously found that we were unable to detect bold fonts reliably,
            // when importing from PDFs, we do not need to guess.
            // fontStyle = 'bold';
            }
            const type = determineSansSerif(fontFamilyEmbedded) === 'SansDefault' ? 'sans' : 'serif';

            // mupdf replaces spaces with underscores in font names.
            const fontName = fontFamilyEmbedded.replace(/[^+]+\+/g, '').replace(/\s/g, '_');

            if (!fontAll.raw[fontName]) {
              fontAll.raw[fontName] = {};
            }

            if (!fontAll.raw[fontName][fontStyle]) {
              fontAll.raw[fontName][fontStyle] = new FontContainerFont(fontName, fontStyle, src, false, fontObj);
            }
          }

          await setUploadFontsWorker(gs.schedulerInner);
        });
      }

      if (extractStext) {
        ocrAllRaw.active = Array(this.pageCount);
        const resArr = pageDPI.map(async (x, i) => {
          // While using `pageTextJSON` would save some parsing, unfortunately that format only includes line-level granularity.
          // The XML format is the only built-in mupdf format that includes character-level granularity.
          ocrAllRaw.active[i] = await muPDFScheduler.pageTextXML({ page: i + 1, dpi: x });
        });
        await Promise.all(resArr);
      }
    }
  };
}

export const imageCache = new ImageCache();
