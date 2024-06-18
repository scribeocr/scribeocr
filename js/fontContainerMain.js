import {
  FontContainerFont, loadFontsFromSource, fontAll, checkMultiFontMode, loadFont,
} from './containers/fontContainer.js';

/**
 * @param {string} fileName
 */
export function relToAbsPath(fileName) {
  const url = new URL(fileName, import.meta.url);
  return url.protocol === 'file:' ? url.host + url.pathname : url.href;
}

/**
 *
 * @param {string} src
 */
const getFontAbsPath = (src) => {
  // Do not edit `src` if it is already an absolute URL
  if (/^(\/|http)/i.test(src)) return src;

  // Alternative .ttf versions of the fonts are used for Node.js, as `node-canvas` does not currently (reliably) support .woff files.
  // See https://github.com/Automattic/node-canvas/issues/1737
  if (typeof process === 'object') {
    const srcTtf = src.replace(/\.\w{1,5}$/i, '.ttf');
    return relToAbsPath(`../fonts_ttf/${srcTtf}`);
  }

  return relToAbsPath(`../../fonts/${src}`);
};

/**
 *
 * @param {string} fileName
 */
async function fontPathToArrayBuffer(fileName) {
  const browserMode = typeof process === 'undefined';
  const absPath = getFontAbsPath(fileName);

  if (browserMode) {
    const res = await fetch(absPath);
    return res.arrayBuffer();
  }
  const fs = await import('fs');
  const res = fs.readFileSync(absPath);
  return res.buffer;
}

async function fontPathToArrayBufferAll(fileNameObj) {
  /** @type {Object<string, fontSrcBuiltIn|fontSrcUpload>} */
  const result = {};
  const resArr = Object.entries(fileNameObj).map(async (x) => {
    const [key, value] = x;
    result[key] = {
      normal: await fontPathToArrayBuffer(value.normal),
      italic: await fontPathToArrayBuffer(value.italic),
      bold: await fontPathToArrayBuffer(value.bold),
    };
    return true;
  });
  await Promise.allSettled(resArr);
  return result;
}

/**
 * Load all raw (unoptimized) fonts.  This function is where font file names are hard-coded.
 */
export async function loadBuiltInFontsRaw() {
  const srcPathObj = {
    Carlito: {
      normal: 'Carlito-Regular.woff', italic: 'Carlito-Italic.woff', bold: 'Carlito-Bold.woff',
    },
    Century: {
      normal: 'C059-Roman.woff', italic: 'C059-Italic.woff', bold: 'C059-Bold.woff',
    },
    Garamond: {
      normal: 'EBGaramond-Regular.woff', italic: 'EBGaramond-Italic.woff', bold: 'EBGaramond-Bold.woff',
    },
    Palatino: {
      normal: 'P052-Roman.woff', italic: 'P052-Italic.woff', bold: 'P052-Bold.woff',
    },
    NimbusRomNo9L: {
      normal: 'NimbusRomNo9L-Reg.woff', italic: 'NimbusRomNo9L-RegIta.woff', bold: 'NimbusRomNo9L-Med.woff',
    },
    NimbusSans: {
      normal: 'NimbusSanL-Reg.woff', italic: 'NimbusSanL-RegIta.woff', bold: 'NimbusSanL-Bol.woff',
    },
  };

  const srcObj = await fontPathToArrayBufferAll(srcPathObj);

  return loadFontsFromSource(srcObj);
}

let chiReadyRes;
let chiReady;

/**
 * Loads chi_sim font. Returns early if already loaded.
 */
export async function loadChiSimFont() {
  if (chiReady) return chiReady;

  chiReady = new Promise((resolve, reject) => {
    chiReadyRes = resolve;
  });

  fontAll.supp.chi_sim = await loadFont('NotoSansSC', 'normal', 'sans', 'NotoSansSC-Regular.ttf', false);

  chiReadyRes();

  return chiReady;
}

/**
 *
 * @param {boolean} enable
 * @param {boolean} [useInitial=false]
 * @param {boolean} [forceWorkerUpdate=false] - If true, forces the worker to update the font data even if the font data of this type is already loaded.
 *    This should be used when switching from unvalidated to validated optimized fonts.
 */
export async function enableDisableFontOpt(enable, useInitial = false, forceWorkerUpdate = false) {
  const browserMode = typeof process === 'undefined';

  // Enable/disable optimized font
  if (enable && useInitial && fontAll.optInitial) {
    fontAll.active = fontAll.optInitial;
  } else if (enable && fontAll.opt) {
    fontAll.active = fontAll.opt;
  } else {
    fontAll.active = fontAll.raw;
  }

  // Enable/disable optimized font in workers
  if (browserMode) {
    await setBuiltInFontsWorker(globalThis.generalScheduler, forceWorkerUpdate);
  } else {
    // const { setFontAll } = await import('./worker/compareOCRModule.js');
    // setFontAll(fontAll);
  }
}

let loadedBuiltInRaw = false;
let loadedBuiltInOpt = false;

/**
 *
 * @param {*} scheduler
 * @param {boolean} [force=false] - If true, forces the worker to update the font data even if the font data of this type is already loaded.
 */
export async function setBuiltInFontsWorker(scheduler, force = false) {
  if (!fontAll.active) return;

  const opt = fontAll.active.Carlito.normal.opt || fontAll.active.NimbusRomNo9L.normal.opt;

  const loadedBuiltIn = (!opt && loadedBuiltInRaw) || (opt && loadedBuiltInOpt);

  // If the active font data is not already loaded, load it now.
  // This assumes that only one version of the raw/optimized fonts ever exist--
  // it does not check whether the current optimized font changed since it was last loaded.
  if (!loadedBuiltIn || force) {
    const resArr = [];
    for (let i = 0; i < scheduler.workers.length; i++) {
      const worker = scheduler.workers[i];
      const res = worker.loadFontsWorker({
        src: {
          Carlito: {
            normal: fontAll.active.Carlito.normal.src,
            italic: fontAll.active.Carlito.italic.src,
            bold: fontAll.active.Carlito.bold.src,
          },
          Century: {
            normal: fontAll.active.Century.normal.src,
            italic: fontAll.active.Century.italic.src,
            bold: fontAll.active.Century.bold.src,
          },
          Garamond: {
            normal: fontAll.active.Garamond.normal.src,
            italic: fontAll.active.Garamond.italic.src,
            bold: fontAll.active.Garamond.bold.src,
          },
          Palatino: {
            normal: fontAll.active.Palatino.normal.src,
            italic: fontAll.active.Palatino.italic.src,
            bold: fontAll.active.Palatino.bold.src,
          },
          NimbusRomNo9L: {
            normal: fontAll.active.NimbusRomNo9L.normal.src,
            italic: fontAll.active.NimbusRomNo9L.italic.src,
            bold: fontAll.active.NimbusRomNo9L.bold.src,
          },
          NimbusSans: {
            normal: fontAll.active.NimbusSans.normal.src,
            italic: fontAll.active.NimbusSans.italic.src,
            bold: fontAll.active.NimbusSans.bold.src,
          },
        },
        opt,
      });
      resArr.push(res);
    }
    await Promise.all(resArr);

    // Theoretically this should be changed to use promises to avoid the race condition when `setBuiltInFontsWorker` is called multiple times quickly and `loadFontsWorker` is still running.
    if (opt) {
      loadedBuiltInOpt = true;
    } else {
      loadedBuiltInRaw = true;
    }
  }

  // Set the active font in the workers to match the active font in `fontAll`
  const resArr = [];
  for (let i = 0; i < scheduler.workers.length; i++) {
    const worker = scheduler.workers[i];
    const res = worker.setFontActiveWorker({ opt, sansDefaultName: fontAll.sansDefaultName, serifDefaultName: fontAll.serifDefaultName });
    resArr.push(res);
  }
  await Promise.all(resArr);
}

/**
 *
 * @param {*} scheduler
 */
export async function setUploadFontsWorker(scheduler) {
  if (!fontAll.active) return;

  /** @type {Object<string, fontSrcBuiltIn|fontSrcUpload>} */
  const fontsUpload = {};
  for (const [key, value] of Object.entries(fontAll.active)) {
    if (!['Carlito', 'Century', 'Garamond', 'Palatino', 'NimbusRomNo9L', 'NimbusSans'].includes(key)) {
      fontsUpload[key] = {
        normal: value?.normal?.src, italic: value?.italic?.src, bold: value?.bold?.src,
      };
    }
  }

  if (Object.keys(fontsUpload).length === 0) return;

  const resArr1 = [];
  for (let i = 0; i < scheduler.workers.length; i++) {
    const worker = scheduler.workers[i];
    const res = worker.loadFontsWorker({
      src: fontsUpload,
      opt: false, // Uploaded fonts are not modified.
    });
    resArr1.push(res);
  }
  await Promise.all(resArr1);

  // Set the active font in the workers to match the active font in `fontAll`
  const resArr = [];
  const opt = fontAll.active.Carlito.normal.opt || fontAll.active.NimbusRomNo9L.normal.opt;
  for (let i = 0; i < scheduler.workers.length; i++) {
    const worker = scheduler.workers[i];
    const res = worker.setFontActiveWorker({ opt, sansDefaultName: fontAll.sansDefaultName, serifDefaultName: fontAll.serifDefaultName });
    resArr.push(res);
  }
  await Promise.all(resArr);
}

/**
 * Automatically sets the default font to whatever font is most common in the provided font metrics.
 *
 */
export function setDefaultFontAuto(fontMetricsObj) {
  const multiFontMode = checkMultiFontMode(fontMetricsObj);

  // Return early if the OCR data does not contain font info.
  if (!multiFontMode) return;

  // Change default font to whatever named font appears more
  if ((fontMetricsObj.SerifDefault?.obs || 0) > (fontMetricsObj.SansDefault?.obs || 0)) {
    fontAll.defaultFontName = 'SerifDefault';
  } else {
    fontAll.defaultFontName = 'SansDefault';
  }

  if (globalThis.generalScheduler) {
    for (let i = 0; i < globalThis.generalScheduler.workers.length; i++) {
      const worker = globalThis.generalScheduler.workers[i];
      worker.setDefaultFontNameWorker({ defaultFontName: fontAll.defaultFontName });
    }
  }
}
