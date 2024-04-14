import { enableDisableFontOpt, setDefaultFontAuto } from './fontContainerMain.js';
import { optimizeFontContainerAll, fontAll } from './containers/fontContainer.js';
import { fontMetricsObj } from './containers/miscContainer.js';

/**
 *
 * @param {FontContainerFamily} font
 * @param {Array<OcrPage>} pageArr
 * @param {Array<ImageBitmap>} binaryImageArr
 * @param {Array<boolean>} binaryRotatedArr
 * @param {Array<boolean>} binaryUpscaledArr
 * @param {number} n - Number of words to compare
 */
export async function evalPageFonts(font, pageArr, binaryImageArr, binaryRotatedArr, binaryUpscaledArr, n = 500) {
  const browserMode = typeof process === 'undefined';

  let metricTotal = 0;
  let wordsTotal = 0;

  for (let i = 0; i < pageArr.length; i++) {
    if (wordsTotal > n) break;

    // The Node.js canvas package does not currently support worke threads
    // https://github.com/Automattic/node-canvas/issues/1394
    let res;
    if (!browserMode) {
      const { evalPageFont } = await import('./worker/compareOCRModule.js');

      res = await evalPageFont({
        font: font.normal.family,
        page: pageArr[i],
        binaryImage: binaryImageArr[i],
        imageRotated: binaryRotatedArr[i],
        imageUpscaled: binaryUpscaledArr[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
      });
      // Browser case
    } else {
      res = await globalThis.gs.evalPageFont({
        font: font.normal.family,
        page: pageArr[i],
        binaryImage: binaryImageArr[i],
        imageRotated: binaryRotatedArr[i],
        imageUpscaled: binaryUpscaledArr[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
      });
    }

    metricTotal += res.metricTotal;
    wordsTotal += res.wordsTotal;
  }

  return metricTotal;
}

/**
* @param {Array<OcrPage>} pageArr
* @param {Array<Promise<ImageBitmap>>} binaryImageArr
* @param {Array<boolean>} binaryRotatedArr
* @param {Array<boolean>} binaryUpscaledArr
*/
export async function evaluateFonts(pageArr, binaryImageArr, binaryRotatedArr, binaryUpscaledArr) {
  const fontActive = fontAll.get('active');

  const debug = false;

  const binaryImageArrRes = await Promise.all(binaryImageArr);

  const sansMetrics = {
    Carlito: await evalPageFonts(fontActive.Carlito, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
    NimbusSans: await evalPageFonts(fontActive.NimbusSans, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
  };

  let minKeySans = 'NimbusSans';
  let minValueSans = Number.MAX_VALUE;

  for (const [key, value] of Object.entries(sansMetrics)) {
    if (debug) console.log(`${key} metric: ${String(value)}`);
    if (value < minValueSans) {
      minValueSans = value;
      minKeySans = key;
    }
  }

  const serifMetrics = {
    Century: await evalPageFonts(fontActive.Century, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
    Palatino: await evalPageFonts(fontActive.Palatino, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
    Garamond: await evalPageFonts(fontActive.Garamond, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
    NimbusRomNo9L: await evalPageFonts(fontActive.NimbusRomNo9L, pageArr, binaryImageArrRes, binaryRotatedArr, binaryUpscaledArr),
  };

  let minKeySerif = 'NimbusRomNo9L';
  let minValueSerif = Number.MAX_VALUE;

  for (const [key, value] of Object.entries(serifMetrics)) {
    if (debug) console.log(`${key} metric: ${String(value)}`);
    if (value < minValueSerif) {
      minValueSerif = value;
      minKeySerif = key;
    }
  }

  return {
    sansMetrics,
    serifMetrics,
    minKeySans,
    minKeySerif,
  };
}

/**
 * Runs font optimization and validation. Sets `fontAll` defaults to best fonts,
 * and returns `true` if sans or serif could be improved through optimization.
 *
 * @param {Array<OcrPage>} ocrArr - Array of OCR pages to use for font optimization.
 * @param {?Array<Promise<ImageBitmap>>} imageArr - Array of binary images to use for validating optimized fonts.
 * @param {?Array<boolean>} imageRotatedArr - Array of booleans indicating whether each image in `imageArr` has been rotated.
 * @param {?Array<boolean>} imageUpscaledArr - Array of booleans indicating whether each image in `imageArr` has been upscaled.
 *
 * This function should still be run, even if no character-level OCR data is present,
 * as it is responsible for picking the correct default sans/serif font.
 * The only case where this function does nothing is when (1) there is no character-level OCR data
 * and (2) no images are provided to compare against.
 */
export async function runFontOptimization(ocrArr, imageArr, imageRotatedArr, imageUpscaledArr) {
  const browserMode = typeof process === 'undefined';

  const fontRaw = fontAll.get('raw');

  const calculateOpt = fontMetricsObj && Object.keys(fontMetricsObj).length > 0;

  let enableOptSerif = false;
  let enableOptSans = false;

  if (calculateOpt) {
    setDefaultFontAuto(fontMetricsObj);
    fontAll.optInitial = await optimizeFontContainerAll(fontRaw, fontMetricsObj);
  }

  // If image data exists, select the correct font by comparing to the image.
  if (imageArr && imageRotatedArr && imageUpscaledArr && imageArr[0]) {
    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(imageArr.length, 5);

    // Set raw font in workers
    await enableDisableFontOpt(false);

    // This step needs to happen here as all fonts must be registered before initializing the canvas.
    if (!browserMode) {
      const { initCanvasNode } = await import('./worker/compareOCRModule.js');
      await initCanvasNode();
    }

    const evalRaw = await evaluateFonts(ocrArr.slice(0, pageNum), imageArr.slice(0, pageNum),
      imageRotatedArr.slice(0, pageNum), imageUpscaledArr.slice(0, pageNum));

    if (globalThis.df) globalThis.df.evalRaw = evalRaw;

    if (calculateOpt && fontAll.optInitial) {
      // Enable optimized fonts
      await enableDisableFontOpt(true);

      const evalOpt = await evaluateFonts(ocrArr.slice(0, pageNum), imageArr.slice(0, pageNum),
        imageRotatedArr.slice(0, pageNum), imageUpscaledArr.slice(0, pageNum));

      if (globalThis.df) globalThis.df.evalOpt = evalOpt;

      // The default font for both the optimized and unoptimized versions are set to the same font.
      // This ensures that switching on/off "font optimization" does not change the font, which would be confusing.
      if (evalOpt.sansMetrics[evalOpt.minKeySans] < evalRaw.sansMetrics[evalRaw.minKeySans]) {
        fontAll.sansDefaultName = evalOpt.minKeySans;
        fontRaw.SansDefault = fontRaw[evalOpt.minKeySans];
        fontAll.optInitial.SansDefault = fontAll.optInitial[evalOpt.minKeySans];
        enableOptSans = true;
      } else {
        fontAll.sansDefaultName = evalRaw.minKeySans;
        fontRaw.SansDefault = fontRaw[evalRaw.minKeySans];
        fontAll.optInitial.SansDefault = fontAll.optInitial[evalRaw.minKeySans];
      }

      // Repeat for serif fonts
      if (evalOpt.serifMetrics[evalOpt.minKeySerif] < evalRaw.serifMetrics[evalRaw.minKeySerif]) {
        fontAll.serifDefaultName = evalOpt.minKeySerif;
        fontRaw.SerifDefault = fontRaw[evalOpt.minKeySerif];
        fontAll.optInitial.SerifDefault = fontAll.optInitial[evalOpt.minKeySerif];
        enableOptSerif = true;
      } else {
        fontAll.serifDefaultName = evalRaw.minKeySerif;
        fontRaw.SerifDefault = fontRaw[evalRaw.minKeySerif];
        fontAll.optInitial.SerifDefault = fontAll.optInitial[evalRaw.minKeySerif];
      }

      // Create final optimized font object.
      // The final optimized font is set to either the initial optimized font or the raw font depending on what fits better.
      // Make shallow copy to allow for changing individual fonts without copying the entire object.
      fontAll.opt = { ...fontAll.optInitial };

      if (!enableOptSans) {
        fontAll.opt.Carlito = fontRaw.Carlito;
        fontAll.opt.NimbusSans = fontRaw.NimbusSans;
        fontAll.opt.SansDefault = fontRaw.SansDefault;
      }

      if (!enableOptSerif) {
        fontAll.opt.Century = fontRaw.Century;
        fontAll.opt.Garamond = fontRaw.Garamond;
        fontAll.opt.NimbusRomNo9L = fontRaw.NimbusRomNo9L;
        fontAll.opt.Palatino = fontRaw.Palatino;
        fontAll.opt.SerifDefault = fontRaw.SerifDefault;
      }
    } else {
      fontAll.sansDefaultName = evalRaw.minKeySans;
      fontAll.serifDefaultName = evalRaw.minKeySerif;
      fontRaw.SansDefault = fontRaw[evalRaw.minKeySans];
      fontRaw.SerifDefault = fontRaw[evalRaw.minKeySerif];
    }
  }

  // Set final fonts in workers
  await enableDisableFontOpt(true);

  const enableOpt = enableOptSerif || enableOptSans;

  return enableOpt;
}
