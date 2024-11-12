import scribe from '../scribe.js/scribe.js';
/* eslint-disable import/no-cycle */
import { ScribeCanvas } from './viewerCanvas.js';
import Konva from './konva/index.js';
import { initBitmapWorker } from './bitmapWorkerMain.js';
import { range } from '../scribe.js/js/utils/miscUtils.js';

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

export class BitmapScheduler {
  constructor(scheduler, workers) {
    this.scheduler = scheduler;
    /** @type {Array<Awaited<ReturnType<typeof initBitmapWorker>>>} */
    this.workers = workers;
    /**
     * @param {Parameters<typeof import('./bitmapWorker.js').getImageBitmap>} args
     * @returns {Promise<ReturnType<typeof import('./bitmapWorker.js').getImageBitmap>>}
     */
    this.pageText = (args) => (this.scheduler.addJob('pageText', args));
  }
}

export class ViewerImageCache {
  /**
   * Number of pages ahead and behind the current page to pre-render.
   */
  static cacheRenderPages = 3;

  /**
   * Number of pages ahead and behind the current page to retain in memory before deleting.
   */
  static cacheDeletePages = 5;

  /**
   * @type {Array<?Promise<InstanceType<typeof Konva.Image>>>}
   */
  static konvaImages = [];

  /** @type {Array<?ImageProperties>} */
  static konvaImagesProps = [];

  // The bitmap images are only created as needed, due to the enormous amount of memory they use.
  // Additionally, they cannot be stored as promises, as the ImageWrapper object needs to be able to be sent between threads.
  // Therefore, to avoid a race condition where the bitmap is created multiple times, a promise is stored in this array.
  // These promises will be pending while the bitmap is being created, and will resolve to true once the bitmap is created.

  /** @type {Array<?Promise<boolean>>} */
  static #nativeBitmapPromises = [];

  /** @type {Array<?Promise<boolean>>} */
  static #binaryBitmapPromises = [];

  /** @type {?Promise<BitmapScheduler>} */
  static bitmapScheduler = null;

  /**
   * Initializes the bitmap scheduler.
   * This is used to load image bitmaps in the background, since this can be slow and memory-intensive for large images.
   * @param {number} numWorkers
   * @returns
   */
  static #initBitmapScheduler = async (numWorkers = 3) => {
    const Tesseract = (await import('../scribe.js/tess/tesseract.esm.min.js')).default;
    const scheduler = await Tesseract.createScheduler();
    const workersPromiseArr = range(1, numWorkers).map(async () => {
      const w = await initBitmapWorker();
      w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
      scheduler.addWorker(w);
      return w;
    });

    const workers = await Promise.all(workersPromiseArr);

    return new BitmapScheduler(scheduler, workers);
  };

  /**
   * Gets the bitmap scheduler if it exists, otherwise creates a new one.
   * @param {number} [numWorkers=3] - Number of workers to create.
   * @returns
   */
  static getBitmapScheduler = async (numWorkers = 3) => {
    if (ViewerImageCache.bitmapScheduler) return ViewerImageCache.bitmapScheduler;
    ViewerImageCache.bitmapScheduler = ViewerImageCache.#initBitmapScheduler(numWorkers);
    return ViewerImageCache.bitmapScheduler;
  };

  static imageStrToBitmap = async (imageStr) => {
    const bitmapScheduler = await ViewerImageCache.getBitmapScheduler();
    const res = bitmapScheduler.scheduler.addJob('getImageBitmap', [imageStr]);
    return res;
  };

  /**
   *
   * @param {number} n
   */
  static getKonvaImage = async (n) => {
    const pageDims = scribe.data.pageMetrics[n].dims;

    const backgroundImage = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinary(n) : await scribe.data.image.getNative(n);
    const image = scribe.opt.colorMode === 'binary' ? await ViewerImageCache.getBinaryBitmap(n) : await ViewerImageCache.getNativeBitmap(n);

    let rotation = 0;
    if (scribe.opt.autoRotate && !backgroundImage.rotated) {
      rotation = (scribe.data.pageMetrics[n].angle || 0) * -1;
    } else if (!scribe.opt.autoRotate && backgroundImage.rotated) {
      rotation = (scribe.data.pageMetrics[n].angle || 0);
    }

    const pageOffsetY = ScribeCanvas.getPageStop(n) ?? 30;

    const y = pageOffsetY + pageDims.height * 0.5;

    const scaleX = backgroundImage.upscaled ? 0.5 : 1;
    const scaleY = backgroundImage.upscaled ? 0.5 : 1;

    const konvaImage = new Konva.Image({
      image,
      rotation,
      scaleX,
      scaleY,
      x: pageDims.width * 0.5,
      // y: pageDims.height * 0.5,
      y,
      offsetX: image.width * 0.5,
      offsetY: image.height * 0.5,
      strokeWidth: 4,
      stroke: 'black',
    });

    const props = {
      rotated: backgroundImage.rotated,
      upscaled: backgroundImage.upscaled,
      colorMode: /** @type {'color'|'gray'|'binary'} */ (backgroundImage.colorMode),
      n,
    };

    return {
      konvaImage,
      props,
    };
  };

  /**
   *
   * @param {number} n - Page number
   * @param {ImagePropertiesRequest} [props] - Image properties needed.
   *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
   */
  static getNativeBitmap = async (n, props) => {
    const nativeN = await scribe.data.image.getNative(n, props);
    if (ViewerImageCache.#nativeBitmapPromises[n]) await ViewerImageCache.#nativeBitmapPromises[n];
    if (!nativeN.imageBitmap) {
      const bitmapPromise = ViewerImageCache.imageStrToBitmap(nativeN.src);

      ViewerImageCache.#nativeBitmapPromises[n] = bitmapPromise.then(() => (true));
      nativeN.imageBitmap = await bitmapPromise;
    }
    return nativeN.imageBitmap;
  };

  /**
     *
     * @param {number} n - Page number
     * @param {ImagePropertiesRequest} [props] - Image properties needed.
     *  Image properties should only be defined if needed, as they can require the image to be re-rendered.
     */
  static getBinaryBitmap = async (n, props) => {
    const binaryN = await scribe.data.image.getBinary(n, props);
    if (ViewerImageCache.#binaryBitmapPromises[n]) await ViewerImageCache.#binaryBitmapPromises[n];
    if (!binaryN.imageBitmap) {
      const bitmapPromise = ViewerImageCache.imageStrToBitmap(binaryN.src);

      ViewerImageCache.#binaryBitmapPromises[n] = bitmapPromise.then(() => (true));
      binaryN.imageBitmap = await bitmapPromise;
    }
    return binaryN.imageBitmap;
  };

  /**
   *
   * @param {number} n - Page number
   */
  static addKonvaImage = async (n) => {
    if (ViewerImageCache.konvaImages[n]) {
      let rerender = false;
      if (ViewerImageCache.konvaImagesProps[n]) {
        if (ViewerImageCache.konvaImagesProps[n].colorMode !== scribe.opt.colorMode) {
          rerender = true;
        } else {
          const konvaImage = await ViewerImageCache.konvaImages[n];
          let rotation = 0;
          if (scribe.opt.autoRotate && !ViewerImageCache.konvaImagesProps[n].rotated) {
            rotation = (scribe.data.pageMetrics[n].angle || 0) * -1;
          } else if (!scribe.opt.autoRotate && ViewerImageCache.konvaImagesProps[n].rotated) {
            rotation = (scribe.data.pageMetrics[n].angle || 0);
          }

          if (Math.abs(konvaImage.rotation() - rotation) > 0.01) {
            konvaImage.rotation(rotation);
            if (Math.abs(ScribeCanvas.state.cp.n - n) < 2) ScribeCanvas.layerBackground.batchDraw();
          }
        }
      }
      if (!rerender) return;
    }

    if (ScribeCanvas.getPageStop(n) === null) return;

    if (ViewerImageCache.konvaImages[n]) {
      ViewerImageCache.konvaImages[n].then((konvaImage) => {
        konvaImage.destroy();
      });
    }

    ViewerImageCache.konvaImagesProps[n] = null;
    ViewerImageCache.konvaImages[n] = ViewerImageCache.getKonvaImage(n).then((res) => {
      ViewerImageCache.konvaImagesProps[n] = res.props;
      return res.konvaImage;
    });

    ViewerImageCache.konvaImages[n].then((konvaImage) => {
      ScribeCanvas.layerBackground.add(konvaImage);
      if (ScribeCanvas.placeholderRectArr[n]) ScribeCanvas.placeholderRectArr[n].hide();
      if (Math.abs(ScribeCanvas.state.cp.n - n) < 2) ScribeCanvas.layerBackground.batchDraw();
    });
  };

  /**
   *
   * @param {number} n - Page number
   */
  static deleteKonvaImage = (n) => {
    if (!ViewerImageCache.konvaImages[n]) return;
    const konvaImagePromise = ViewerImageCache.konvaImages[n];
    ViewerImageCache.konvaImages[n] = null;
    konvaImagePromise.then((konvaImage) => {
      konvaImage.destroy();
    });
  };

  /**
     * Render the current page, and a few pages ahead and behind.
     * This is similar to `preRenderRange`, however has several differences:
     * (1) Starts rendering at the current page, and goes outward from there.
     * (2) Also renders image bitmaps (not just the image strings), and deletes them when they are sufficiently far away.
     * @param {number} curr
     */
  static renderAheadBehindBrowser = async (curr) => {
    const resArr = [];
    resArr.push(ViewerImageCache.addKonvaImage(curr));

    // Delete images that are sufficiently far away from the current page to save memory.
    ViewerImageCache.#cleanBitmapCache(curr);
    ViewerImageCache.#cleanBitmapCache2(curr);

    // Do not render the following pages when a PDF is being uploaded alongside OCR data, and the OCR dimensions are not yet available.
    // There is currently no mechanism for re-rendering at the correct dimensions.
    if (curr === 0 && scribe.data.ocr?.active?.[curr] && !scribe.data.ocr?.active?.[curr + 1] && scribe.data.pageMetrics.length > curr + 1) return;

    for (let i = 0; i <= ViewerImageCache.cacheRenderPages; i++) {
      if (curr - i >= 0) {
        resArr.push(ViewerImageCache.addKonvaImage(curr - i));
      }
      if (curr + i < scribe.data.image.loadCount) {
        resArr.push(ViewerImageCache.addKonvaImage(curr + i));
      }
    }

    await Promise.all(resArr);
  };

  static #cleanBitmapCache = (curr) => {
    // Delete images that are sufficiently far away from the current page to save memory.
    for (let i = 0; i < scribe.data.image.pageCount; i++) {
      if (Math.abs(curr - i) > ViewerImageCache.cacheDeletePages) {
        if (scribe.data.image.native[i]) {
          Promise.resolve(scribe.data.image.native[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
        if (scribe.data.image.binary[i]) {
          Promise.resolve(scribe.data.image.binary[i]).then((img) => {
            img.imageBitmap = null;
          });
        }
      }
    }
  };

  static #cleanBitmapCache2 = (curr) => {
    // Delete images that are sufficiently far away from the current page to save memory.
    for (let i = 0; i < scribe.data.image.pageCount; i++) {
      if (Math.abs(curr - i) > ViewerImageCache.cacheDeletePages) {
        if (ScribeCanvas.placeholderRectArr[i]) ScribeCanvas.placeholderRectArr[i].show();
        ViewerImageCache.deleteKonvaImage(i);
      }
    }
  };
}
