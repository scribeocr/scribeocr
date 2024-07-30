// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

// Node.js case
import opentype from '../../lib/opentype.module.js';
import { determineSansSerif } from '../utils/miscUtils.js';

if (typeof process === 'object') {
  // @ts-ignore
  globalThis.self = globalThis;
  // @ts-ignore
  const { createRequire } = await import('module');
  globalThis.require = createRequire(import.meta.url);
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  globalThis.__dirname = dirname(fileURLToPath(import.meta.url));
}

// Browser worker case
// else if (globalThis.window === undefined) {
//   // @ts-ignore
//   globalThis.window = {};
// }

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
export const getFontAbsPath = (src) => { // eslint-disable-line no-shadow
  // Do not edit `src` if it is already an absolute URL
  if (/^(\/|http)/i.test(src)) return src;

  // Alternative .ttf versions of the fonts are used for Node.js, as `node-canvas` does not currently (reliably) support .woff files.
  // See https://github.com/Automattic/node-canvas/issues/1737
  if (typeof process === 'object') {
    const srcStem = src.replace(/.*\//, '').replace(/\.\w{1,5}$/i, '');
    // The NotoSansSC font used for Chinese characters is shared between the browser and Node.js.
    if (/NotoSansSC/i.test(srcStem)) return relToAbsPath(`../../fonts/${src}`);
    return relToAbsPath(`../../fonts/all_ttf/${srcStem}.ttf`);
  }

  return relToAbsPath(`../../fonts/${src}`);
};

/**
 * Checks whether `multiFontMode` should be enabled or disabled.
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 *
 * Usually (including when the built-in OCR engine is used) we will have metrics for individual font families,
 * which are used to optimize the appropriate fonts ("multiFontMode" is `true` in this case).
 * However, it is possible for the user to upload input data with character-level positioning information
 * but no font identification information for most or all words.
 * If this is encountered the "default" metric is applied to the default font ("multiFontMode" is `false` in this case).
 */
export function checkMultiFontMode(fontMetricsObj) {
  let defaultFontObs = 0;
  let namedFontObs = 0;
  if (fontMetricsObj.Default?.obs) { defaultFontObs += (fontMetricsObj.Default?.obs || 0); }
  if (fontMetricsObj.SerifDefault?.obs) { namedFontObs += (fontMetricsObj.SerifDefault?.obs || 0); }
  if (fontMetricsObj.SansDefault?.obs) { namedFontObs += (fontMetricsObj.SansDefault?.obs || 0); }

  return namedFontObs > defaultFontObs;
}

/**
 * @param {string|ArrayBuffer} src
 * @param {?Object.<string, number>} [kerningPairs=null]
 */
export async function loadOpentype(src, kerningPairs = null) {
  const font = typeof (src) === 'string' ? await opentype.load(src) : await opentype.parse(src, { lowMemory: false });
  font.tables.gsub = null;
  // Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
  if (kerningPairs) font.kerningPairs = kerningPairs;
  return font;
}

const fontFaceObj = {};

/**
 * Load font as FontFace and add to the document FontFaceSet.
 * If a FontFace already exists with the same name, it is deleted and replaced.
 *
 * @param {string} fontFamily - Font family name
 * @param {string} fontStyle - Font style.  May only be "normal" or "italic",
 *   as small-caps fonts should be loaded as a "normal" variant with a different font name.
 * @param {string} fontWeight
 * @param {string|ArrayBuffer} src - Font source
 */
export function loadFontFace(fontFamily, fontStyle, fontWeight, src) {
  const src1 = typeof (src) === 'string' ? `url(${src})` : src;

  const fontFace = new FontFace(fontFamily, src1, { style: fontStyle, weight: fontWeight });

  // Fonts are stored in `document.fonts` for the main thread and `WorkerGlobalScope.fonts` for workers
  const fontSet = globalThis.document ? globalThis.document.fonts : globalThis.fonts;

  // As FontFace objects are added to the document fonts as a side effect,
  // they need to be kept track of and manually deleted to correctly replace.
  if (typeof (fontFaceObj[fontFamily]) === 'undefined') {
    fontFaceObj[fontFamily] = {};
  }

  if (typeof (fontFaceObj[fontFamily][fontStyle]) === 'undefined') {
    fontFaceObj[fontFamily][fontStyle] = {};
  }

  // Delete font if it already exists
  if (typeof (fontFaceObj[fontFamily][fontStyle][fontWeight]) !== 'undefined') {
    fontSet.delete(fontFaceObj[fontFamily][fontStyle][fontWeight]);
  }

  // Stored font for future, so it can be deleted if needed
  fontFaceObj[fontFamily][fontStyle][fontWeight] = fontFace;

  // Force loading to occur now
  fontFace.load();

  // Add font to document
  fontSet.add(fontFace);

  return fontFace;
}

/**
 * Load font from source and return a FontContainerFont object.
 * This function is used to load the Chinese font.
 * @param {string} family
 * @param {string} style
 * @param {("sans"|"serif")} type
 * @param {string|ArrayBuffer} src
 * @param {boolean} opt
 *
 */
export async function loadFont(family, style, type, src, opt) {
  const srcAbs = typeof src === 'string' ? getFontAbsPath(src) : src;
  const fontObj = await loadOpentype(srcAbs);
  return new FontContainerFont(family, style, srcAbs, opt, fontObj);
}

/**
 *
 * @param {string} family
 * @param {string} style
 * @param {string|ArrayBuffer} src
 * @param {boolean} opt
 * @param {opentype.Font} opentypeObj - Kerning paris to re-apply
 * @property {string} family -
 * @property {string} style -
 * @property {string|ArrayBuffer} src
 * @property {opentype.Font} opentype -
 * @property {string} fontFaceName -
 * @property {string} fontFaceStyle -
 * @property {boolean} opt -
 * @property {string} type -
 *
 * A FontFace object is created and added to the document FontFaceSet, however this FontFace object is intentionally not included in the `fontContainerFont` object.
 * First, it is not necessary.  Setting the font on a canvas (the only reason loading a `FontFace` is needed) is done through refering `fontFaceName` and `fontFaceStyle`.
 * Second, it results in errors being thrown when used in Node.js, as `FontFace` will be undefined in this case.
 */
export function FontContainerFont(family, style, src, opt, opentypeObj) {
  // As FontFace objects are included in the document FontFaceSet object,
  // they need to all have unique names.
  let fontFaceName = family;
  if (opt) fontFaceName += ' Opt';

  /** @type {string} */
  this.family = family;
  /** @type {string} */
  this.style = style;
  /** @type {boolean} */
  this.opt = opt;
  /** @type {string|ArrayBuffer} */
  this.src = src;
  /** @type {opentype.Font} */
  this.opentype = opentypeObj;
  /** @type {string} */
  this.fontFaceName = fontFaceName;
  /** @type {('normal'|'italic')} */
  this.fontFaceStyle = this.style === 'italic' ? 'italic' : 'normal';
  /** @type {('normal'|'bold')} */
  this.fontFaceWeight = this.style === 'bold' ? 'bold' : 'normal';
  /** @type {("sans"|"serif")} */
  this.type = determineSansSerif(this.family) === 'SansDefault' ? 'sans' : 'serif';

  if (typeof FontFace !== 'undefined') loadFontFace(this.fontFaceName, this.fontFaceStyle, this.fontFaceWeight, this.src);
}

/**
 *
 * @param {string} family
 * @param {fontSrcBuiltIn|fontSrcUpload} src
 * @param {boolean} opt
 */
export async function loadFontContainerFamily(family, src, opt = false) {
  const res = {
    normal: null, italic: null, bold: null,
  };

  const loadType = (type) => new Promise((resolve) => {
    const srcType = /** @type {string | ArrayBuffer | null} */ (src[type]);
    if (!srcType) {
      resolve(false);
      return;
    }
    const scrNormal = typeof srcType === 'string' ? getFontAbsPath(srcType) : srcType;
    loadOpentype(scrNormal).then((font) => {
      res[type] = new FontContainerFont(family, type, srcType, opt, font);
      resolve(true);
    });
  });

  Promise.allSettled([loadType('normal'), loadType('italic'), loadType('bold')]);

  return res;
}

/**
 * @param {Object<string, fontSrcBuiltIn|fontSrcUpload>} srcObj
 * @param {boolean} opt
 * @returns
 */
export async function loadFontsFromSource(srcObj, opt = false) {
  /** @type {Object<string, Promise<FontContainerFamily>>} */
  const fontObjPromise = {};
  for (const [family, src] of Object.entries(srcObj)) {
    fontObjPromise[family] = loadFontContainerFamily(family, src, opt);
  }
  /** @type {Object<string, FontContainerFamily>} */
  const fontObj = {};
  for (const [key, value] of Object.entries(fontObjPromise)) {
    fontObj[key] = await value;
  }
  return fontObj;
}

// FontCont must contain no font data when initialized, and no data should be defined in this file.
// This is because this file is run both from the main thread and workers, and fonts are defined different ways in each.
// In the main thread, "raw" fonts are loaded from fetch requests, however in workers they are loaded from the main thread.
class FontCont {
  constructor() {
    /** @type {?FontContainer} */
    this.raw = null;
    /** @type {?FontContainer} */
    this.optInitial = null;
    /** @type {?FontContainer} */
    this.opt = null;
    /** @type {?FontContainer} */
    this.active = null;
    /** @type {?FontContainer} */
    this.export = null;
    this.supp = {
      /** @type {?FontContainerFont} */
      chi_sim: null,
    };
    this.defaultFontName = 'SerifDefault';
    this.serifDefaultName = 'NimbusRomNo9L';
    this.sansDefaultName = 'NimbusSans';

    this.loadedBuiltInRawWorker = false;
    this.loadedBuiltInOptWorker = false;

    /** @type {?('latin'|'all')} */
    this.glyphSet = null;
    /**
     * Get raw/opt/active font, and throw exception if it does not exist.
     * This method only exists for type inference purposes, as raw/opt/active may be accessed directly, but may be `null`.
     * This method should therefore only be used in cases where an exception on `null` is a desirable behavior.
     * @param {('raw'|'opt'|'active'|'optInitial')} container
     * @returns {FontContainer}
     */
    this.getContainer = (container) => {
      const fontRes = this[container];
      if (!fontRes) throw new Error(`${container} font container does not exist.`);
      return fontRes;
    };

    /**
     * Gets a font object.  Unlike accessing the font containers directly,
     * this method allows for special values 'Default', 'SansDefault', and 'SerifDefault' to be used.
     *
     * @param {('Default'|'SansDefault'|'SerifDefault'|string)} family - Font family name.
     * @param {('normal'|'italic'|'bold'|string)} [style='normal']
     * @param {string} [lang='eng']
     * @param {('raw'|'opt'|'active'|'optInitial')} [container='active']
     * @returns {FontContainerFont}
     */
    this.getFont = (family, style = 'normal', lang = 'eng', container = 'active') => {
      const fontCont = this.getContainer(container);

      if (lang === 'chi_sim') {
        if (!this.supp.chi_sim) throw new Error('chi_sim font does not exist.');
        return this.supp.chi_sim;
      }

      // Option 1: If we have access to the font, use it.
      // Option 2: If we do not have access to the font, but it closely resembles a built-in font, use the built-in font.
      if (!fontCont?.[family]?.[style]) {
        if (/Times/i.test(family)) {
          family = 'NimbusRomNo9L';
        } else if (/Helvetica/i.test(family)) {
          family = 'NimbusSans';
        } else if (/Arial/i.test(family)) {
          family = 'NimbusSans';
        } else if (/Century/i.test(family)) {
          family = 'Century';
        } else if (/Palatino/i.test(family)) {
          family = 'Palatino';
        } else if (/Garamond/i.test(family)) {
          family = 'Garamond';
        } else if (/Carlito/i.test(family)) {
          family = 'Carlito';
        } else if (/Calibri/i.test(family)) {
          family = 'Carlito';
        }
      }

      // Option 3: If the font still is not identified, use the default sans/serif font.
      if (!fontCont?.[family]?.[style]) {
        family = determineSansSerif(family);
      }

      // This needs to come first as `defaultFontName` maps to either 'SerifDefault' or 'SansDefault'.
      if (family === 'Default') family = this.defaultFontName;

      if (family === 'SerifDefault') family = this.serifDefaultName;
      if (family === 'SansDefault') family = this.sansDefaultName;
      const fontRes = fontCont[family][style];
      if (!fontRes) throw new Error(`Font container does not contain ${family} (${style}).`);
      return fontRes;
    };

    /**
     *
     * @param {OcrWord} word
     * @param {('raw'|'opt'|'active'|'optInitial')} [container='active']
     */
    this.getWordFont = (word, container = 'active') => {
      const wordFontFamily = word.font || fontAll.defaultFontName;
      return this.getFont(wordFontFamily, word.style, word.lang, container);
    };

    this.clear = () => {
      this.active = this.raw;
      this.optInitial = null;
      this.opt = null;
      this.loadedBuiltInRawWorker = false;
      this.loadedBuiltInOptWorker = false;
    };
  }
}

export const fontAll = new FontCont();
