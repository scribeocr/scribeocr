import {
  checkMultiFontMode,
  fontAll,
  FontContainerFont,
  getFontAbsPath,
  loadFont,
  loadFontsFromSource,
  loadOpentype,
} from './containers/fontContainer.js';
import { gs } from './containers/schedulerContainer.js';

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
  const { readFileSync } = await import('node:fs');
  const res = readFileSync(absPath);
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
 * @param {('latin'|'all')} [glyphSet='latin'] - The set of glyphs to load.  'latin' includes only Latin characters, while 'all' includes Latin, Greek, and Cyrillic characters.
 *    This parameter does not matter for Node.js, which loads a `.ttf` version of the `all` set, regardless of this option.
 */
export async function loadBuiltInFontsRaw(glyphSet = 'latin') {
  // Return early if the font set is already loaded, or a superset of the requested set is loaded.
  if (fontAll.glyphSet === glyphSet || fontAll.glyphSet === 'all' && glyphSet === 'latin') return;

  fontAll.glyphSet = glyphSet;

  const srcPathObj = {
    Carlito: {
      normal: `${glyphSet}/Carlito-Regular.woff`, italic: `${glyphSet}/Carlito-Italic.woff`, bold: `${glyphSet}/Carlito-Bold.woff`,
    },
    Century: {
      normal: `${glyphSet}/C059-Roman.woff`, italic: `${glyphSet}/C059-Italic.woff`, bold: `${glyphSet}/C059-Bold.woff`,
    },
    Garamond: {
      normal: `${glyphSet}/EBGaramond-Regular.woff`, italic: `${glyphSet}/EBGaramond-Italic.woff`, bold: `${glyphSet}/EBGaramond-Bold.woff`,
    },
    Palatino: {
      normal: `${glyphSet}/P052-Roman.woff`, italic: `${glyphSet}/P052-Italic.woff`, bold: `${glyphSet}/P052-Bold.woff`,
    },
    NimbusRomNo9L: {
      normal: `${glyphSet}/NimbusRoman-Regular.woff`, italic: `${glyphSet}/NimbusRoman-Italic.woff`, bold: `${glyphSet}/NimbusRoman-Bold.woff`,
    },
    NimbusSans: {
      normal: `${glyphSet}/NimbusSans-Regular.woff`, italic: `${glyphSet}/NimbusSans-Italic.woff`, bold: `${glyphSet}/NimbusSans-Bold.woff`,
    },
  };

  const srcObj = await fontPathToArrayBufferAll(srcPathObj);

  fontAll.raw = await /** @type {FontContainer} */(/** @type {any} */(loadFontsFromSource(srcObj)));
  if (!fontAll.active || (!fontAll.active.NimbusSans.normal.opt && !fontAll.active.NimbusRomNo9L.normal.opt)) fontAll.active = fontAll.raw;

  if (typeof process === 'undefined') {
    await gs.schedulerReadyLoadFonts;
    await setBuiltInFontsWorker(gs.schedulerInner, true);
  }

  return;
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
    await setBuiltInFontsWorker(gs.schedulerInner, forceWorkerUpdate);
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

  if (gs.schedulerInner) {
    for (let i = 0; i < gs.schedulerInner.workers.length; i++) {
      const worker = gs.schedulerInner.workers[i];
      worker.setDefaultFontNameWorker({ defaultFontName: fontAll.defaultFontName });
    }
  }
}

/**
 *
 * @param {FontContainerFamilyBuiltIn} fontFamily
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerFamily(fontFamily, fontMetricsObj) {
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  // When we have metrics for individual fonts families, those are used to optimize the appropriate fonts.
  // Otherwise, the "default" metric is applied to whatever font the user has selected as the default font.
  const multiFontMode = checkMultiFontMode(fontMetricsObj);
  let fontMetricsType = 'Default';
  if (multiFontMode) {
    if (fontFamily.normal.type === 'sans') {
      fontMetricsType = 'SansDefault';
    } else {
      fontMetricsType = 'SerifDefault';
    }
  }

  const scrNormal = typeof fontFamily.normal.src === 'string' ? getFontAbsPath(fontFamily.normal.src) : fontFamily.normal.src;
  const scrItalic = typeof fontFamily.italic.src === 'string' ? getFontAbsPath(fontFamily.italic.src) : fontFamily.italic.src;
  const scrBold = typeof fontFamily.bold.src === 'string' ? getFontAbsPath(fontFamily.bold.src) : fontFamily.bold.src;

  // If there are no statistics to use for optimization, create "optimized" font by simply copying the raw font without modification.
  // This should only occur when `multiFontMode` is true, but a document contains no sans words or no serif words.
  if (!fontMetricsObj[fontMetricsType] || !fontMetricsObj[fontMetricsType][fontFamily.normal.style]) {
    const opentypeFontArr = await Promise.all([loadOpentype(scrNormal, null), loadOpentype(scrItalic, null), loadOpentype(scrBold, null)]);
    const normalOptFont = new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, scrNormal, true, opentypeFontArr[0]);
    const italicOptFont = new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, scrItalic, true, opentypeFontArr[1]);
    const boldOptFont = new FontContainerFont(fontFamily.bold.family, fontFamily.bold.style, scrBold, true, opentypeFontArr[2]);
    return {
      normal: await normalOptFont, italic: await italicOptFont, bold: await boldOptFont,
    };
  }

  const metricsNormal = fontMetricsObj[fontMetricsType][fontFamily.normal.style];
  const normalOptFont = gs.scheduler.optimizeFont({ fontData: fontFamily.normal.src, fontMetricsObj: metricsNormal, style: fontFamily.normal.style })
    .then(async (x) => {
      const font = await loadOpentype(x.fontData, x.kerningPairs);
      return new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, x.fontData, true, font);
    });

  const metricsItalic = fontMetricsObj[fontMetricsType][fontFamily.italic.style];
  /** @type {FontContainerFont|Promise<FontContainerFont>} */
  let italicOptFont;
  if (metricsItalic) {
    italicOptFont = gs.scheduler.optimizeFont({ fontData: fontFamily.italic.src, fontMetricsObj: metricsItalic, style: fontFamily.italic.style })
      .then(async (x) => {
        const font = await loadOpentype(x.fontData, x.kerningPairs);
        return new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, x.fontData, true, font);
      });
  } else {
    const font = await loadOpentype(scrItalic, null);
    italicOptFont = new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, scrItalic, true, font);
  }

  // Bold fonts are not optimized, as we currently have no accurate way to determine if characters are bold within OCR, so do not have bold metrics.
  const boldOptFont = loadOpentype(scrBold, null).then((opentypeFont) => new FontContainerFont(fontFamily.bold.family, fontFamily.bold.style, scrBold, true, opentypeFont));

  return {
    normal: await normalOptFont, italic: await italicOptFont, bold: await boldOptFont,
  };
}

/**
 * Optimize all fonts.
 * @param {Object<string, FontContainerFamilyBuiltIn>} fontPrivate
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerAll(fontPrivate, fontMetricsObj) {
  const carlitoObj = await optimizeFontContainerFamily(fontPrivate.Carlito, fontMetricsObj);
  const centuryObj = await optimizeFontContainerFamily(fontPrivate.Century, fontMetricsObj);
  const garamondObj = await optimizeFontContainerFamily(fontPrivate.Garamond, fontMetricsObj);
  const palatinoObj = await optimizeFontContainerFamily(fontPrivate.Palatino, fontMetricsObj);
  const nimbusRomNo9LObj = await optimizeFontContainerFamily(fontPrivate.NimbusRomNo9L, fontMetricsObj);
  const nimbusSansObj = await optimizeFontContainerFamily(fontPrivate.NimbusSans, fontMetricsObj);

  return {
    Carlito: await carlitoObj,
    Century: await centuryObj,
    Garamond: await garamondObj,
    Palatino: await palatinoObj,
    NimbusRomNo9L: await nimbusRomNo9LObj,
    NimbusSans: await nimbusSansObj,
  };
}
