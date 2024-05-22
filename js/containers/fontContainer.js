// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

// import { createRequire } from "../node_modules";
// globalThis.require = createRequire(import.meta.url);

// Node.js case
import opentype from '../../lib/opentype.module.min.js';

if (typeof process === 'object') {
  // @ts-ignore
  globalThis.self = globalThis;
  // @ts-ignore
  const { createRequire } = await import('module');
  globalThis.require = createRequire(import.meta.url);
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  globalThis.__dirname = dirname(fileURLToPath(import.meta.url));
  // Browser worker case
} else if (globalThis.document === undefined) {
  // @ts-ignore
  globalThis.window = {};
}

/**
 * @param {string} fileName
 */
export function relToAbsPath(fileName) {
  const url = new URL(fileName, import.meta.url);
  return url.protocol === 'file:' ? url.host + url.pathname : url.href;
}

/**
   *
   * @param {string|ArrayBuffer} src
   */
const getFontAbsPath = (src) => { // eslint-disable-line no-shadow
  // Do not edit `src` if it is already an ArrayBuffer rather than a path.
  if (typeof (src) !== 'string') return src;
  // Do not edit `src` if it is already an absolute URL
  if (/^(\/|http)/i.test(src)) return src;

  // Alternative .ttf versions of the fonts are used for Node.js, as `node-canvas` does not currently (reliably) support .woff files.
  // See https://github.com/Automattic/node-canvas/issues/1737
  if (typeof process === 'object') {
    const srcTtf = src.replace(/\.\w{1,5}$/i, '.ttf');
    return relToAbsPath(`../../fonts_ttf/${srcTtf}`);
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
 * @param {string|ArrayBuffer} src - Font source
 */
export function loadFontFace(fontFamily, fontStyle, src) {
  const src1 = typeof (src) === 'string' ? `url(${src})` : src;

  const fontFace = new FontFace(fontFamily, src1, { style: fontStyle });

  // Fonts are stored in `document.fonts` for the main thread and `WorkerGlobalScope.fonts` for workers
  const fontSet = globalThis.document ? globalThis.document.fonts : globalThis.fonts;

  // As FontFace objects are added to the document fonts as a side effect,
  // they need to be kept track of and manually deleted to correctly replace.
  if (typeof (fontFaceObj[fontFamily]) === 'undefined') {
    fontFaceObj[fontFamily] = {};
  }

  // Delete font if it already exists
  if (typeof (fontFaceObj[fontFamily][fontStyle]) !== 'undefined') {
    fontSet.delete(fontFaceObj[fontFamily][fontStyle]);
  }

  // Stored font for future, so it can be deleted if needed
  fontFaceObj[fontFamily][fontStyle] = fontFace;

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
  const srcAbs = getFontAbsPath(src);
  const fontObj = await loadOpentype(srcAbs);
  return new FontContainerFont(family, style, type, srcAbs, opt, fontObj);
}

/**
 *
 * @param {string} family
 * @param {string} style
 * @param {("sans"|"serif")} type
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
export function FontContainerFont(family, style, type, src, opt, opentypeObj) {
  // As FontFace objects are included in the document FontFaceSet object,
  // they need to all have unique names.
  let fontFaceName = family;
  if (opt) fontFaceName += ' Opt';
  if (style === 'small-caps') fontFaceName += ' Small Caps';

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
  /** @type {string} */
  this.fontFaceStyle = this.style === 'italic' ? 'italic' : 'normal';
  /** @type {("sans"|"serif")} */
  this.type = type;

  if (typeof FontFace !== 'undefined') loadFontFace(this.fontFaceName, this.fontFaceStyle, this.src);
}

/**
 *
 * @param {FontContainerFamily} fontFamily
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerFamily(fontFamily, fontMetricsObj) {
  if (!globalThis.gs) throw new Error('GeneralScheduler must be defined before this function can run.');

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

  const scrNormal = getFontAbsPath(fontFamily.normal.src);
  const scrItalic = getFontAbsPath(fontFamily.italic.src);
  const scrSmallCaps = getFontAbsPath(fontFamily['small-caps'].src);

  // If there are no statistics to use for optimization, create "optimized" font by simply copying the raw font without modification.
  // This should only occur when `multiFontMode` is true, but a document contains no sans words or no serif words.
  if (!fontMetricsObj[fontMetricsType]) {
    const opentypeFontArr = await Promise.all([loadOpentype(scrNormal, null), loadOpentype(scrItalic, null), loadOpentype(scrSmallCaps, null)]);
    const normalOptFont = new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, fontFamily.normal.type, scrNormal, true, opentypeFontArr[0]);
    const italicOptFont = new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, fontFamily.italic.type, scrItalic, true, opentypeFontArr[1]);
    const smallCapsOptFont = new FontContainerFont(fontFamily['small-caps'].family, fontFamily['small-caps'].style, fontFamily['small-caps'].type, scrSmallCaps, true, opentypeFontArr[2]);
    return new FontContainerFamily(normalOptFont, italicOptFont, smallCapsOptFont);
  }

  const metricsNormal = fontMetricsObj[fontMetricsType][fontFamily.normal.style];
  const normalOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily.normal.src, fontMetricsObj: metricsNormal, style: fontFamily.normal.style })
    .then(async (x) => {
      const font = await loadOpentype(x.fontData, x.kerningPairs);
      return new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, fontFamily.normal.type, x.fontData, true, font);
    });

  const metricsItalic = fontMetricsObj[fontMetricsType][fontFamily.italic.style];
  const italicOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily.italic.src, fontMetricsObj: metricsItalic, style: fontFamily.italic.style })
    .then(async (x) => {
      const font = await loadOpentype(x.fontData, x.kerningPairs);
      return new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, fontFamily.italic.type, x.fontData, true, font);
    });

  const metricsSmallCaps = fontMetricsObj[fontMetricsType][fontFamily['small-caps'].style];
  const smallCapsOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily['small-caps'].src, fontMetricsObj: metricsSmallCaps, style: fontFamily['small-caps'].style })
    .then(async (x) => {
      const font = await loadOpentype(x.fontData, x.kerningPairs);
      return new FontContainerFont(fontFamily['small-caps'].family, fontFamily['small-caps'].style, fontFamily['small-caps'].type, x.fontData, true, font);
    });

  return new FontContainerFamily(await normalOptFont, await italicOptFont, await smallCapsOptFont);
}

/**
 *
 * @param {FontContainerFont} fontNormal
 * @param {FontContainerFont} fontItalic
 * @param {FontContainerFont} fontSmallCaps
 */
export function FontContainerFamily(fontNormal, fontItalic, fontSmallCaps) {
  /** @type {FontContainerFont} */
  this.normal = fontNormal;
  /** @type {FontContainerFont} */
  this.italic = fontItalic;
  /** @type {FontContainerFont} */
  this['small-caps'] = fontSmallCaps;
}

/**
 *
 * @param {string} family
 * @param {("sans"|"serif")} type
 * @param {string|ArrayBuffer} normalSrc
 * @param {string|ArrayBuffer} italicSrc
 * @param {string|ArrayBuffer} smallCapsSrc
 * @param {boolean} opt
 * @param {?Object.<string, number>} normalKerningPairs
 * @param {?Object.<string, number>} italicKerningPairs
 * @param {?Object.<string, number>} smallCapsKerningPairs
 */
export async function loadFontContainerFamily(family, type, normalSrc, italicSrc, smallCapsSrc, opt = false, normalKerningPairs = null, italicKerningPairs = null, smallCapsKerningPairs = null) {
  const scrNormal = getFontAbsPath(normalSrc);
  const scrItalic = getFontAbsPath(italicSrc);
  const scrSmallCaps = getFontAbsPath(smallCapsSrc);
  const opentypeFontArr = await Promise.all([loadOpentype(scrNormal, normalKerningPairs), loadOpentype(scrItalic, italicKerningPairs), loadOpentype(scrSmallCaps, smallCapsKerningPairs)]);

  const normal = new FontContainerFont(family, 'normal', type, normalSrc, opt, opentypeFontArr[0]);
  const italic = new FontContainerFont(family, 'italic', type, italicSrc, opt, opentypeFontArr[1]);
  const smallCaps = new FontContainerFont(family, 'small-caps', type, smallCapsSrc, opt, opentypeFontArr[2]);
  return new FontContainerFamily(normal, italic, smallCaps);
}

/**
 * @param {Object} params
 * @param {FontContainerFamily} params.Carlito
 * @param {FontContainerFamily} params.Century
 * @param {FontContainerFamily} params.Garamond
 * @param {FontContainerFamily} params.Palatino
 * @param {FontContainerFamily} params.NimbusRomNo9L
 * @param {FontContainerFamily} params.NimbusSans
 */
export function FontContainerAll({
  Carlito, Century, Garamond, Palatino, NimbusRomNo9L, NimbusSans,
}) {
  this.Carlito = Carlito;
  this.Century = Century;
  this.Garamond = Garamond;
  this.Palatino = Palatino;
  this.NimbusRomNo9L = NimbusRomNo9L;
  this.NimbusSans = NimbusSans;
}

/**
 * @typedef {object} fontSrc
 * @property {string|ArrayBuffer} normal
 * @property {string|ArrayBuffer} italic
 * @property {string|ArrayBuffer} smallCaps
*/

/**
 * @param {Object} src
 * @param {fontSrc} src.Carlito
 * @param {fontSrc} src.Century
 * @param {fontSrc} src.Palatino
 * @param {fontSrc} src.NimbusRomNo9L
 * @param {fontSrc} src.NimbusSans
 * @param {fontSrc} src.Garamond
 * @param {boolean} opt
 * @returns
 */
export async function loadFontContainerAll({
  Carlito, Century, NimbusRomNo9L, NimbusSans, Garamond, Palatino,
}, opt = false) {
  const CarlitoObj = await loadFontContainerFamily('Carlito', 'sans', Carlito.normal, Carlito.italic, Carlito.smallCaps, opt);
  const CenturyObj = await loadFontContainerFamily('Century', 'serif', Century.normal, Century.italic, Century.smallCaps, opt);
  const GaramondObj = await loadFontContainerFamily('Garamond', 'serif', Garamond.normal, Garamond.italic, Garamond.smallCaps, opt);
  const PalatinoObj = await loadFontContainerFamily('Palatino', 'serif', Palatino.normal, Palatino.italic, Palatino.smallCaps, opt);
  const NimbusRomNo9LObj = await loadFontContainerFamily('NimbusRomNo9L', 'serif', NimbusRomNo9L.normal, NimbusRomNo9L.italic, NimbusRomNo9L.smallCaps, opt);
  const NimbusSansObj = await loadFontContainerFamily('NimbusSans', 'sans', NimbusSans.normal, NimbusSans.italic, NimbusSans.smallCaps, opt);

  return new FontContainerAll({
    Carlito: await CarlitoObj,
    Century: await CenturyObj,
    Garamond: await GaramondObj,
    Palatino: await PalatinoObj,
    NimbusRomNo9L: await NimbusRomNo9LObj,
    NimbusSans: await NimbusSansObj,
  });
}

/**
 * Optimize all fonts.
 * @param {FontContainerAll} fontPrivate
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerAll(fontPrivate, fontMetricsObj) {
  const carlitoObj = await optimizeFontContainerFamily(fontPrivate.Carlito, fontMetricsObj);
  const centuryObj = await optimizeFontContainerFamily(fontPrivate.Century, fontMetricsObj);
  const garamondObj = await optimizeFontContainerFamily(fontPrivate.Garamond, fontMetricsObj);
  const palatinoObj = await optimizeFontContainerFamily(fontPrivate.Palatino, fontMetricsObj);
  const nimbusRomNo9LObj = await optimizeFontContainerFamily(fontPrivate.NimbusRomNo9L, fontMetricsObj);
  const nimbusSansObj = await optimizeFontContainerFamily(fontPrivate.NimbusSans, fontMetricsObj);

  return new FontContainerAll({
    Carlito: await carlitoObj,
    Century: await centuryObj,
    Garamond: await garamondObj,
    Palatino: await palatinoObj,
    NimbusRomNo9L: await nimbusRomNo9LObj,
    NimbusSans: await nimbusSansObj,
  });
}

// FontCont must contain no font data when initialized, and no data should be defined in this file.
// This is because this file is run both from the main thread and workers, and fonts are defined different ways in each.
// In the main thread, "raw" fonts are loaded from fetch requests, however in workers they are loaded from the main thread.
class FontCont {
  constructor() {
    /** @type {?FontContainerAll} */
    this.raw = null;
    /** @type {?FontContainerAll} */
    this.optInitial = null;
    /** @type {?FontContainerAll} */
    this.opt = null;
    /** @type {?FontContainerAll} */
    this.active = null;
    /** @type {?FontContainerAll} */
    this.export = null;
    this.supp = {
      /** @type {?FontContainerFont} */
      chi_sim: null,
    };
    this.defaultFontName = 'SerifDefault';
    this.serifDefaultName = 'NimbusRomNo9L';
    this.sansDefaultName = 'NimbusSans';
    /**
     * Get raw/opt/active font, and throw exception if it does not exist.
     * This method only exists for type inference purposes, as raw/opt/active may be accessed directly, but may be `null`.
     * This method should therefore only be used in cases where an exception on `null` is a desirable behavior.
     * @param {('raw'|'opt'|'active'|'optInitial')} container
     * @returns {FontContainerAll}
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
     * @param {('normal'|'italic'|'small-caps'|string)} [style='normal']
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
  }
}

export const fontAll = new FontCont();
