// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

import { checkMultiFontMode } from '../fontStatistics.js';
// import opentype from "../lib/opentype.module.js";

// import { createRequire } from "../node_modules";
// globalThis.require = createRequire(import.meta.url);

// Node.js case
if (typeof process === 'object') {
  globalThis.self = globalThis;
  const { createRequire } = await import('module');
  globalThis.require = createRequire(import.meta.url);
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  globalThis.__dirname = dirname(fileURLToPath(import.meta.url));
  // Browser worker case
} else if (globalThis.document === undefined) {
  globalThis.window = {};
}

await import('../../lib/opentype.js');

// https://github.com/opentypejs/opentype.js/pull/579
// const opentype = await import("../../lib/opentype.module.js");

/**
 * @param {string} fileName
 */
export function relToAbsPath(fileName) {
  const url = new URL(fileName, import.meta.url);
  return url.protocol === 'file:' ? url.host + url.pathname : url.href;
}

/**
 * @param {string|ArrayBuffer} src
 */
async function loadOpentype(src, kerningPairs = null) {
  const font = typeof (src) === 'string' ? await opentype.load(src) : await await opentype.parse(src, { lowMemory: false });
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

  // Clear fabric.js cache to delete old metrics
  if (globalThis.fabric) fabric.util.clearFabricFontCache(fontFamily);
  if (globalThis.fabric) fabric.util.clearFabricFontCache(`${fontFamily} Small Caps`);

  return fontFace;
}

/**
 *
 * @param {string} family
 * @param {string} style
 * @param {("sans"|"serif")} type
 * @param {string|ArrayBuffer} src
 * @param {boolean} opt
 * @param {*} kerningPairs - Kerning paris to re-apply
 * @property {string} family -
 * @property {string} style -
 * @property {string|ArrayBuffer} src
 * @property {Promise<opentype.Font>} opentype -
 * @property {string} fontFaceName -
 * @property {string} fontFaceStyle -
 * @property {boolean} opt -
 * @property {string} type -
 *
 * A FontFace object is created and added to the document FontFaceSet, however this FontFace object is intentionally not included in the `fontContainerFont` object.
 * First, it is not necessary.  Setting the font on a canvas (the only reason loading a `FontFace` is needed) is done through refering `fontFaceName` and `fontFaceStyle`.
 * Second, it results in errors being thrown when used in Node.js, as `FontFace` will be undefined in this case.
 */
export function FontContainerFont(family, style, type, src, opt, kerningPairs = null) {
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
  this.src = typeof (src) === 'string' && !/^(\/|http)/i.test(src) ? relToAbsPath(`../../fonts/${src}`) : src;
  /** @type {Promise<opentype.Font>} */
  this.opentype = loadOpentype(this.src, kerningPairs);
  /** @type {string} */
  this.fontFaceName = fontFaceName;
  /** @type {string} */
  this.fontFaceStyle = this.style === 'italic' ? 'italic' : 'normal';
  /** @type {("sans"|"serif")} */
  this.type = type;

  if (typeof FontFace !== 'undefined') loadFontFace(this.fontFaceName, this.fontFaceStyle, this.src);
}

// /**
//  *
//  * @param {FontContainerFont} font
//  * @param {FontMetricsFont} fontMetrics
//  */
// async function optimizeFontContainerFont(font, fontMetrics) {

//   const fontOptObj = await globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: font.src, fontMetrics: fontMetrics, style: font.style });

//   const fontOpt = new FontContainerFont(font.family, font.style, font.type, fontOptObj.fontData, true, fontOptObj.kerningPairs);

//   return fontOpt;

// }

/**
 *
 * @param {FontContainerFamily} fontFamily
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerFamily(fontFamily, fontMetricsObj) {
  if (!globalThis.gs) throw new Error('GeneralScheduler must be defined before this function can run.');

  // When we have metrics for individual fonts families, those are used to optimize the appropriate fonts.
  // Otherwise, the "default" metric is applied to whatever font the user has selected as the default font.
  globalSettings.multiFontMode = checkMultiFontMode(fontMetricsObj);
  let fontMetricsType = 'Default';
  if (globalSettings.multiFontMode) {
    if (fontFamily.normal.type === 'sans') {
      fontMetricsType = 'SansDefault';
    } else {
      fontMetricsType = 'SerifDefault';
    }
  }

  // If there are no statistics to use for optimization, create "optimized" font by simply copying the raw font without modification.
  // This should only occur when `multiFontMode` is true, but a document contains no sans words or no serif words.
  if (!fontMetricsObj[fontMetricsType]) {
    const normalOptFont = new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, fontFamily.normal.type, fontFamily.normal.src, true, null);
    const italicOptFont = new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, fontFamily.italic.type, fontFamily.italic.src, true, null);
    const smallCapsOptFont = new FontContainerFont(fontFamily['small-caps'].family, fontFamily['small-caps'].style, fontFamily['small-caps'].type, fontFamily['small-caps'].src, true, null);
    return new FontContainerFamily(normalOptFont, italicOptFont, smallCapsOptFont);
  }

  const metricsNormal = fontMetricsObj[fontMetricsType][fontFamily.normal.style];
  const normalOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily.normal.src, fontMetricsObj: metricsNormal, style: fontFamily.normal.style })
    .then((x) => new FontContainerFont(fontFamily.normal.family, fontFamily.normal.style, fontFamily.normal.type, x.fontData, true, x.kerningPairs));

  const metricsItalic = fontMetricsObj[fontMetricsType][fontFamily.italic.style];
  const italicOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily.italic.src, fontMetricsObj: metricsItalic, style: fontFamily.italic.style })
    .then((x) => new FontContainerFont(fontFamily.italic.family, fontFamily.italic.style, fontFamily.italic.type, x.fontData, true, x.kerningPairs));

  const metricsSmallCaps = fontMetricsObj[fontMetricsType][fontFamily['small-caps'].style];
  const smallCapsOptFont = globalThis.gs.optimizeFont({ fontData: fontFamily['small-caps'].src, fontMetricsObj: metricsSmallCaps, style: fontFamily['small-caps'].style })
    .then((x) => new FontContainerFont(fontFamily['small-caps'].family, fontFamily['small-caps'].style, fontFamily['small-caps'].type, x.fontData, true, x.kerningPairs));

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
 * @param {*} normalKerningPairs
 * @param {*} italicKerningPairs
 * @param {*} smallCapsKerningPairs
 */
export function loadFontContainerFamily(family, type, normalSrc, italicSrc, smallCapsSrc, opt = false, normalKerningPairs = null, italicKerningPairs = null, smallCapsKerningPairs = null) {
  const normal = new FontContainerFont(family, 'normal', type, normalSrc, opt, normalKerningPairs);
  const italic = new FontContainerFont(family, 'italic', type, italicSrc, opt, italicKerningPairs);
  const smallCaps = new FontContainerFont(family, 'small-caps', type, smallCapsSrc, opt, smallCapsKerningPairs);
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

  this.SansDefault = this.NimbusSans;
  this.SerifDefault = this.NimbusRomNo9L;
  this.Default = this.NimbusRomNo9L;
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
export function loadFontContainerAll({
  Carlito, Century, NimbusRomNo9L, NimbusSans, Garamond, Palatino,
}, opt = false) {
  return new FontContainerAll({
    Carlito: loadFontContainerFamily('Carlito', 'sans', Carlito.normal, Carlito.italic, Carlito.smallCaps, opt),
    Century: loadFontContainerFamily('Century', 'serif', Century.normal, Century.italic, Century.smallCaps, opt),
    Garamond: loadFontContainerFamily('Garamond', 'serif', Garamond.normal, Garamond.italic, Garamond.smallCaps, opt),
    Palatino: loadFontContainerFamily('Palatino', 'serif', Palatino.normal, Palatino.italic, Palatino.smallCaps, opt),
    NimbusRomNo9L: loadFontContainerFamily('NimbusRomNo9L', 'serif', NimbusRomNo9L.normal, NimbusRomNo9L.italic, NimbusRomNo9L.smallCaps, opt),
    NimbusSans: loadFontContainerFamily('NimbusSans', 'sans', NimbusSans.normal, NimbusSans.italic, NimbusSans.smallCaps, opt),
  });
}

/**
 * Optimize all fonts.
 * @param {FontContainerAll} fontPrivate
 * @param {Object.<string, FontMetricsFamily>} fontMetricsObj
 */
export async function optimizeFontContainerAll(fontPrivate, fontMetricsObj) {
  return new FontContainerAll({
    Carlito: await optimizeFontContainerFamily(fontPrivate.Carlito, fontMetricsObj),
    Century: await optimizeFontContainerFamily(fontPrivate.Century, fontMetricsObj),
    Garamond: await optimizeFontContainerFamily(fontPrivate.Garamond, fontMetricsObj),
    Palatino: await optimizeFontContainerFamily(fontPrivate.Palatino, fontMetricsObj),
    NimbusRomNo9L: await optimizeFontContainerFamily(fontPrivate.NimbusRomNo9L, fontMetricsObj),
    NimbusSans: await optimizeFontContainerFamily(fontPrivate.NimbusSans, fontMetricsObj),
  });
}

/**
 * Load all raw (unoptimized) fonts.  This function is where font file names are hard-coded.
 */
export function loadFontContainerAllRaw() {
  return loadFontContainerAll({
    Carlito: { normal: 'Carlito-Regular.woff', italic: 'Carlito-Italic.woff', smallCaps: 'Carlito-SmallCaps.woff' },
    Century: { normal: 'C059-Roman.woff', italic: 'C059-Italic.woff', smallCaps: 'C059-SmallCaps.woff' },
    Garamond: { normal: 'QTGaromand.woff', italic: 'QTGaromand-Italic.woff', smallCaps: 'QTGaromand-SmallCaps.woff' },
    Palatino: { normal: 'P052-Roman.woff', italic: 'P052-Italic.woff', smallCaps: 'P052-SmallCaps.woff' },
    NimbusRomNo9L: { normal: 'NimbusRomNo9L-Reg.woff', italic: 'NimbusRomNo9L-RegIta.woff', smallCaps: 'NimbusRomNo9L-RegSmallCaps.woff' },
    NimbusSans: { normal: 'NimbusSanL-Reg.woff', italic: 'NimbusSanL-RegIta.woff', smallCaps: 'NimbusSanL-RegSmallCaps.woff' },
  });
}
