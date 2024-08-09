import {
  PageMetrics,
} from '../objects/pageMetricsObjects.js';

import { initMuPDFWorker } from '../../mupdf/mupdf-async.js';

import { getImageBitmap, getJpegDimensions, getPngDimensions } from '../utils/imageUtils.js';

import { setUploadFontsWorker } from '../fontContainerMain.js';
import { ocrAllRaw, pageMetricsArr } from './dataContainer.js';
import {
  FontContainerFont,
  fontAll,
  loadOpentype,
} from './fontContainer.js';

import { initTesseractInWorkers } from '../generalWorkerMain.js';
import { determineSansSerif, range } from '../utils/miscUtils.js';
import { opt } from './app.js';
import { gs } from './schedulerContainer.js';

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
 * @param {(ImageWrapper|ImageProperties)} img
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
 * @param {ImageWrapper|ImageProperties} img
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
     * @param {Parameters<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageText>[1]} args
     * @returns {Promise<ReturnType<typeof import('../../mupdf/mupdf-worker.js').mupdf.pageText>>}
     */
    this.pageText = (args) => (this.scheduler.addJob('pageText', args));
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

export class ImageWrapper {
  /**
   * @param {number} n - Page number
   * @param {string} imageStr - Base-64 encoded image string. Should start with "data:image/png" or "data:image/jpeg".
   * @param {string} colorMode - Color mode ("color", "gray", or "binary").
   * @param {boolean} rotated - Whether image has been rotated.
   * @param {boolean} upscaled - Whether image has been upscaled.
   *
   * All properties of this object must be serializable, as ImageWrapper objects are sent between threads.
   * This means that no promises can be used.
   */
  constructor(n, imageStr, colorMode, rotated = false, upscaled = false) {
    this.n = n;
    this.src = imageStr;
    const format0 = imageStr.match(/^data:image\/(png|jpeg)/)?.[1];
    if (!format0 || !['png', 'jpeg'].includes(format0)) throw new Error(`Invalid image format: ${format0}`);
    this.format = format0;
    this._dims = null;
    this.rotated = rotated;
    this.upscaled = upscaled;
    this.colorMode = colorMode;
    /** @type {?ImageBitmap} */
    this.imageBitmap = null;
  }
}

/**
 * @typedef {Object} ImageProperties
 * @property {boolean} [rotated]
 * @property {boolean} [upscaled]
 * @property {('color'|'gray'|'binary')} [colorMode]
 * @property {number} n
 */

/**
 * @typedef {Object} ImagePropertiesRequest
 * @property {?boolean} [rotated]
 * @property {?boolean} [upscaled]
 * @property {?('color'|'gray'|'binary')} [colorMode]
 */

// TODO: Either separate out the imagebitmap again or edit so it does not get sent between threads.
// Alternatively, if it is sent between threads, use it reather than making a new one.
// Actually, definitely do that last option.

export class ImageCache {
  /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
  static nativeSrc = [];

  /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
  static native = [];

  /** @type {Array<ImageWrapper|Promise<ImageWrapper>>} */
  static binary = [];

  // These arrays store the properties of the images.
  // While they are redundant with the properties stored in the ImageWrapper objects,
  // they still need to exist to determine whether the image needs to be re-rendered.
  // The imagewrappers are stored as promises, and needing to await them would break things without further changes.
  // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await#control_flow_effects_of_await
  /** @type {Array<ImageProperties>} */
  static nativeProps = [];

  /** @type {Array<ImageProperties>} */
  static binaryProps = [];

  /**
   * @param {ImagePropertiesRequest} props
   * @param {ImageWrapper} inputImage
   * @param {number} n - Page number
   * @param {boolean} [binary=false]
   * @returns {ImageProperties}
   */
  static fillPropsDefault = (props, inputImage, n, binary = false) => {
    /** @type {"binary" | "color" | "gray"} */
    let colorMode = 'binary';
    if (!binary) {
      const color = props?.colorMode === 'color' || !props?.colorMode && opt.colorMode === 'color';
      colorMode = color ? 'color' : 'gray';
    }

    let pageAngle = pageMetricsArr[n].angle || 0;
    if (Math.abs(pageAngle) < 0.05) pageAngle = 0;

    // If no preference is specified for rotation, default to true.
    const rotate = props?.rotated !== false && inputImage.rotated === false;
    const angleArg = rotate ? pageAngle * (Math.PI / 180) * -1 : 0;

    // If no preference is specified for upscaling, default to false.
    const upscaleArg = props?.upscaled || false;

    const isRotated = Boolean(angleArg) || inputImage.rotated;
    const isUpscaled = upscaleArg || inputImage.upscaled;

    return {
      rotated: isRotated, upscaled: isUpscaled, colorMode, n,
    };
  };

  /** @type {?Promise<MuPDFScheduler>} */
  static muPDFScheduler = null;

  static loadCount = 0;

  static pageCount = 0;

  /**
 * The dimensions that each page would be, if it was rendered at 300 DPI.
 * @type {Array<dims>}
 */
  static pdfDims300Arr = [];

  static inputModes = {
    pdf: false,
    image: false,
  };

  static pdfContentStats = {
    /** Total number of letters in the source PDF. */
    letterCountTotal: 0,
    /** Total number of visible letters in the source PDF. */
    letterCountVis: 0,
    /** Total number of pages with 100+ letters in the source PDF. */
    pageCountTotalText: 0,
    /** Total number of pages with 100+ visible letters in the source PDF. */
    pageCountVisText: 0,
  };

  /** @type {?('text'|'ocr'|'image')} */
  static pdfType = null;

  static setPdfType = () => {
    // The PDF is considered text-native if:
    // (1) The total number of visible letters is at least 100 per page on average.
    // (2) The total number of visible letters is at least 90% of the total number of letters.
    // (3) The total number of pages with 100+ visible letters is at least half of the total number of pages.
    if (ImageCache.pdfContentStats.letterCountTotal >= ImageCache.pageCount * 100
      && ImageCache.pdfContentStats.letterCountVis >= ImageCache.pdfContentStats.letterCountTotal * 0.9
      && ImageCache.pdfContentStats.pageCountVisText >= ImageCache.pageCount / 2) {
      ImageCache.pdfType = 'text';
    // The PDF is considered ocr-native if:
    // (1) The total number of letters is at least 100 per page on average.
    // (2) The total number of letters is at least half of the total number of letters.
    } else if (ImageCache.pdfContentStats.letterCountTotal >= ImageCache.pageCount * 100
      && ImageCache.pdfContentStats.letterCountVis >= ImageCache.pageCount / 2) {
      ImageCache.pdfType = 'ocr';
    // Otherwise, the PDF is considered image-native.
    // This includes both literally image-only PDFs, as well as PDFs that have invalid encodings or other issues that prevent valid text extraction.
    } else {
      ImageCache.pdfType = 'image';
    }
  };

  static colorModeDefault = 'gray';

  static cacheRenderPages = 3;

  static cacheDeletePages = 5;

  // The bitmap images are only created as needed, due to the enormous amount of memory they use.
  // Additionally, they cannot be stored as promises, as the ImageWrapper object needs to be able to be sent between threads.
  // Therefore, to avoid a race condition where the bitmap is created multiple times, a promise is stored in this array.
  // These promises will be pending while the bitmap is being created, and will resolve to true once the bitmap is created.

  /** @type {Array<?Promise<boolean>>} */
  static #nativeBitmapPromises = [];

  /** @type {Array<?Promise<boolean>>} */
  static #binaryBitmapPromises = [];

  /**
   * Initializes the MuPDF scheduler.
   * This is separate from the function that loads the file (`#loadFileMuPDFScheduler`),
   * as the scheduler starts loading ahead of the file being available for performance reasons.
   * @param {number} numWorkers
   * @returns
   */
  static #initMuPDFScheduler = async (numWorkers = 3) => {
    const Tesseract = typeof process === 'undefined' ? (await import('../../tess/tesseract.esm.min.js')).default : await import('tesseract.js');
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
  static #loadFileMuPDFScheduler = async (fileData) => {
    const scheduler = await ImageCache.getMuPDFScheduler();

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

  static #renderImage = async (n, color = false) => {
    if (ImageCache.inputModes.image) {
      return ImageCache.nativeSrc[n];
    } if (ImageCache.inputModes.pdf) {
      const pageMetrics = pageMetricsArr[n];
      const targetWidth = pageMetrics.dims.width;
      const dpi = 300 * (targetWidth / ImageCache.pdfDims300Arr[n].width);
      const muPDFScheduler = await ImageCache.getMuPDFScheduler();
      return muPDFScheduler.drawPageAsPNG({
        page: n + 1, dpi, color, skipText: skipTextMode,
      }).then((res) => new ImageWrapper(n, res, color ? 'color' : 'gray'));
    }
    throw new Error('No input mode set');
  };

  /**
   * @param {ImageWrapper} inputImage
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   * @param {boolean} [saveNativeImage=true] - Whether the native image should be saved.
   */
  static transformImage = async (inputImage, n, props, saveNativeImage = true) => {
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
      if (typeof process === 'undefined') await initTesseractInWorkers({ anyOk: true });
      return scheduler.recognize({
        image: inputImage.src,
        options: { rotateRadians: angleArg, upscale: upscaleArg },
        output: {
          imageBinary: true, imageColor: saveNativeImage, debug: true, text: false, hocr: false, tsv: false, blocks: false,
        },
      });
    })();

    const isRotated = Boolean(angleArg) || inputImage.rotated;

    /** @type {?Promise<ImageWrapper>} */
    let native = null;
    if (saveNativeImage) {
      native = resPromise.then(async (res) => new ImageWrapper(n, /** @type {string} */(/** @type {unknown} */(res.imageColor)), inputImage.colorMode, isRotated, upscaleArg));
    }

    const binary = resPromise.then(async (res) => new ImageWrapper(n, /** @type {string} */(/** @type {unknown} */(res.imageBinary)), 'binary', isRotated, upscaleArg));

    return { native, binary };
  };

  /**
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   * @param {boolean} [nativeOnly=true]
   */
  static getImages = (n, props, nativeOnly = true) => {
    const newNative = !ImageCache.native[n] || !imageUtils.compatible(ImageCache.nativeProps[n], props);
    const newBinary = !nativeOnly && (!ImageCache.binary[n] || !imageUtils.compatible(ImageCache.binaryProps[n], props));

    if (newNative || newBinary) {
      const renderRaw = !ImageCache.native[n] || imageUtils.requiresUndo(ImageCache.nativeProps[n], props);
      const propsRaw = {
        colorMode: opt.colorMode, rotated: false, upscaled: false, n,
      };
      const renderTransform = newBinary || !imageUtils.compatible(propsRaw, props);

      const propsNew = renderRaw ? propsRaw : JSON.parse(JSON.stringify(ImageCache.nativeProps[n]));
      propsNew.colorMode = props?.colorMode || propsNew.colorMode;
      propsNew.rotated = props?.rotated ?? propsNew.rotated;
      propsNew.upscaled = props?.upscaled ?? propsNew.upscaled;
      const propsNewBinary = JSON.parse(JSON.stringify(propsNew));
      propsNewBinary.colorMode = 'binary';

      const inputNative = ImageCache.native[n];
      ImageCache.nativeProps[n] = propsNew;
      ImageCache.binaryProps[n] = propsNewBinary;
      const res = (async () => {
        /** @type {?ImageWrapper} */
        let img1;
        if (renderRaw) {
          const color = props?.colorMode === 'color' || !props?.colorMode && opt.colorMode === 'color';
          img1 = await ImageCache.#renderImage(n, color);
        } else {
          img1 = await inputNative;
        }
        if (renderTransform) {
          return ImageCache.transformImage(img1, n, props, true);
        }
        console.assert(nativeOnly, 'Binary should not be null when binary is needed');
        return { native: img1, binary: null };
      })();

      if (renderRaw) ImageCache.native[n] = res.then((r) => r.native);
      if (renderTransform) ImageCache.binary[n] = res.then((r) => r.binary);
    }

    return { native: ImageCache.native[n], binary: ImageCache.binary[n] };
  };

  static getNative = async (n, props) => ImageCache.getImages(n, props, true).native;

  static getBinary = async (n, props) => ImageCache.getImages(n, props, false).binary;

  /**
   *
   * @param {number} n - Page number
   * @param {?ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  static getNativeBitmap = async (n, props) => {
    const nativeN = await ImageCache.getNative(n, props);
    if (ImageCache.#nativeBitmapPromises[n]) await ImageCache.#nativeBitmapPromises[n];
    if (!nativeN.imageBitmap) {
      const bitmapPromise = getImageBitmap(nativeN.src);

      ImageCache.#nativeBitmapPromises[n] = bitmapPromise.then(() => (true));
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
  static getBinaryBitmap = async (n, props) => {
    const binaryN = await ImageCache.getBinary(n, props);
    if (ImageCache.#binaryBitmapPromises[n]) await ImageCache.#binaryBitmapPromises[n];
    if (!binaryN.imageBitmap) {
      const bitmapPromise = getImageBitmap(binaryN.src);

      ImageCache.#binaryBitmapPromises[n] = bitmapPromise.then(() => (true));
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
  static preRenderRange = async (min, max, binary, props = null, progress = null) => {
    const pagesArr = range(min, max);
    if (binary) {
      await Promise.all(pagesArr.map((n) => ImageCache.getBinary(n, props).then(() => {
        if (progress) progress.increment();
      })));
    } else {
      await Promise.all(pagesArr.map((n) => ImageCache.getNative(n, props).then(() => {
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
  static preRenderAheadBehindBrowser = async (curr, binary = false) => {
    const resArr = [];
    if (binary) {
      resArr.push(ImageCache.getBinaryBitmap(curr));
    } else {
      resArr.push(ImageCache.getNativeBitmap(curr));
    }

    // Delete images that are sufficiently far away from the current page to save memory.
    ImageCache.#cleanBitmapCache(curr);

    for (let i = 0; i <= ImageCache.cacheRenderPages; i++) {
      if (curr - i >= 0) {
        if (binary) {
          resArr.push(ImageCache.getBinaryBitmap(curr - i));
        } else {
          resArr.push(ImageCache.getNativeBitmap(curr - i));
        }
      }
      if (curr + i < ImageCache.loadCount) {
        if (binary) {
          resArr.push(ImageCache.getBinaryBitmap(curr + i));
        } else {
          resArr.push(ImageCache.getNativeBitmap(curr + i));
        }
      }
    }

    await Promise.all(resArr);
  };

  static #cleanBitmapCache = (curr) => {
    // Delete images that are sufficiently far away from the current page to save memory.
    for (let i = 0; i < ImageCache.pageCount; i++) {
      if (Math.abs(curr - i) > ImageCache.cacheDeletePages) {
        if (ImageCache.native[i]) {
          Promise.resolve(ImageCache.native[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
        if (ImageCache.binary[i]) {
          Promise.resolve(ImageCache.binary[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
      }
    }
  };

  static clear = async () => {
    ImageCache.nativeSrc = [];
    ImageCache.native = [];
    ImageCache.binary = [];
    if (ImageCache.muPDFScheduler) {
      const muPDFScheduler = await ImageCache.muPDFScheduler;
      await muPDFScheduler.scheduler.terminate();
      ImageCache.muPDFScheduler = null;
    }
    ImageCache.inputModes.image = false;
    ImageCache.inputModes.pdf = false;
    ImageCache.pageCount = 0;
    ImageCache.pdfDims300Arr.length = 0;
    ImageCache.loadCount = 0;
    ImageCache.nativeProps.length = 0;
    ImageCache.binaryProps.length = 0;
    ImageCache.pdfContentStats.letterCountTotal = 0;
    ImageCache.pdfContentStats.letterCountVis = 0;
    ImageCache.pdfContentStats.pageCountTotalText = 0;
    ImageCache.pdfContentStats.pageCountVisText = 0;
  };

  /**
   * Gets the MuPDF scheduler if it exists, otherwise creates a new one.
   * @param {number} [numWorkers=3] - Number of workers to create.
   * @returns
   */
  static getMuPDFScheduler = async (numWorkers = 3) => {
    if (ImageCache.muPDFScheduler) return ImageCache.muPDFScheduler;
    ImageCache.muPDFScheduler = ImageCache.#initMuPDFScheduler(numWorkers);
    return ImageCache.muPDFScheduler;
  };

  /**
   *
   * @param {ArrayBuffer} fileData
   * @param {Boolean} [skipText=false] - Whether to skip native text when rendering PDF to image.
   * @param {Boolean} [extractStext=false]
   */
  static openMainPDF = async (fileData, skipText = false, extractStext = false) => {
    const muPDFScheduler = await ImageCache.getMuPDFScheduler(3);

    await ImageCache.#loadFileMuPDFScheduler(fileData);

    ImageCache.pageCount = await muPDFScheduler.workers[0].countPages();

    const pageDims1 = await muPDFScheduler.workers[0].pageSizes([300]);

    ImageCache.pdfDims300Arr.length = 0;
    pageDims1.forEach((x) => {
      ImageCache.pdfDims300Arr.push({ width: x[0], height: x[1] });
    });

    ImageCache.inputModes.pdf = true;
    skipTextMode = skipText;

    // Set page metrics based on PDF dimensions.
    // This is always run, even though it is overwritten almost immediately by OCR data when it is uploaded.
    // This is done to ensure that the page metrics are always set (which is necessary to prevent a crash),
    // even if (due to some edge case) metrics cannot be parsed from the OCR data for all pages.
    // For example, this was encountered using Archive.org data where the page counts of the PDFs and OCR data did not match perfectly.

    // For reasons that are unclear, a small number of pages have been rendered into massive files
    // so a hard-cap on resolution must be imposed.
    const pageDPI = ImageCache.pdfDims300Arr.map((x) => 300 * 2000 / x.width, 2000);

    // In addition to capping the resolution, also switch the width/height
    ImageCache.pdfDims300Arr.forEach((x, i) => {
      const pageDims = { width: Math.round(x.width * pageDPI[i] / 300), height: Math.round(x.height * pageDPI[i] / 300) };
      pageMetricsArr[i] = new PageMetrics(pageDims);
    });

    // WIP: Extract fonts embedded in PDFs.
    if (false) {
      muPDFScheduler.extractAllFonts().then(async (x) => {
        globalImageCache.fontArr = [];
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
      ocrAllRaw.active = Array(ImageCache.pageCount);
      const resArr = pageDPI.map(async (x, i) => {
        // While using `pageTextJSON` would save some parsing, unfortunately that format only includes line-level granularity.
        // The XML format is the only built-in mupdf format that includes character-level granularity.
        const res = await muPDFScheduler.pageText({
          page: i + 1, dpi: x, format: 'xml', calcStats: true,
        });
        ImageCache.pdfContentStats.letterCountTotal += res.letterCountTotal;
        ImageCache.pdfContentStats.letterCountVis += res.letterCountVis;
        if (res.letterCountTotal >= 100) ImageCache.pdfContentStats.pageCountTotalText++;
        if (res.letterCountVis >= 100) ImageCache.pdfContentStats.pageCountVisText++;
        ocrAllRaw.active[i] = res.content;
      });
      await Promise.all(resArr);
      ImageCache.setPdfType();
    }
  };
}
