
// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

import { checkMultiFontMode } from "../fontStatistics.js";
// import opentype from "../lib/opentype.module.js";

// import { createRequire } from "../node_modules";
// globalThis.require = createRequire(import.meta.url);

if(typeof process === 'object') {
  globalThis.self = globalThis;
  const { createRequire } = await import("module");
  globalThis.require = createRequire(import.meta.url);
  globalThis.__dirname = import.meta.url;  
}

// https://github.com/opentypejs/opentype.js/pull/579
const opentype = await import("../../lib/opentype.module.js");

/**
 * @param {string} fileName 
 */
export function relToAbsPath(fileName) {
  const url = new URL(fileName, import.meta.url);
  return url.protocol == "file:" ? url.host + url.pathname : url.href;
}


/**
 * @param {string|ArrayBuffer} src 
 */
async function loadOpentype(src, kerningPairs = null) {
  const font = typeof (src) == "string" ? await opentype.load(src) : await await opentype.parse(src, { lowMemory: false });
  font.tables.gsub = null
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
 * @param {("normal"|"italic")} fontStyle - Font style.  May only be "normal" or "italic",
 *   as small-caps fonts should be loaded as a "normal" variant with a different font name.
 * @param {string|ArrayBuffer} src - Font source
 */
export function loadFontFace(fontFamily, fontStyle, src) {

  const src1 = typeof (src) == "string" ? "url(" + src + ")" : src;

  const fontFace = new FontFace(fontFamily, src1, { style: fontStyle });

  // As FontFace objects are added to the document fonts as a side effect,
  // they need to be kept track of and manually deleted to correctly replace.
  if (typeof (fontFaceObj[fontFamily]) == "undefined") {
    fontFaceObj[fontFamily] = {};
  }

  // Delete font if it already exists
  if (typeof (fontFaceObj[fontFamily][fontStyle]) != "undefined") {
    document.fonts.delete(fontFaceObj[fontFamily][fontStyle]);
  }

  // Stored font for future, so it can be deleted if needed
  fontFaceObj[fontFamily][fontStyle] = fontFace;

  // Force loading to occur now
  fontFace.load();

  // Add font to document
  document.fonts.add(fontFace);

  // Clear fabric.js cache to delete old metrics
  fabric.util.clearFabricFontCache(fontFamily);
  fabric.util.clearFabricFontCache(fontFamily + " Small Caps");

  return fontFace;

}



/**
 * 
 * @param {string} family 
 * @param {("normal"|"italic"|"small-caps")} style 
 * @param {("sans"|"serif")} type 
 * @param {string|ArrayBuffer} src 
 * @param {boolean} opt 
 * @param {*} kerningPairs - Kerning paris to re-apply
 * @property {string} family - 
 * @property {("normal"|"italic"|"small-caps")} style - 
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
export function fontContainerFont(family, style, type, src, opt, kerningPairs = null) {

  // As FontFace objects are included in the document FontFaceSet object,
  // they need to all have unique names. 
  let fontFaceName = family;
  if (opt) fontFaceName = fontFaceName + " Opt";
  if (style == "small-caps") fontFaceName = fontFaceName + " Small Caps";

  /**@type {string} */
  this.family = family;
  /**@type {("normal"|"italic"|"small-caps")} */
  this.style = style;
  /**@type {boolean} */
  this.opt = false;
  /**@type {string|ArrayBuffer} */
  this.src = typeof (src) == "string" ? relToAbsPath("../../fonts/" + src) : src;
  /**@type {Promise<opentype.Font>} */
  this.opentype = loadOpentype(this.src, kerningPairs);
  /**@type {string} */
  this.fontFaceName = fontFaceName;
  /**@type {("normal"|"italic")} */
  this.fontFaceStyle = this.style == "italic" ? "italic" : "normal";
  /**@type {("sans"|"serif")} */
  this.type = type;

  if (typeof FontFace !== 'undefined') loadFontFace(this.fontFaceName, this.fontFaceStyle, this.src);
}


// /**
//  * 
//  * @param {fontContainerFont} font 
//  * @param {fontMetricsFont} fontMetrics 
//  */
// async function optimizeFontContainerFont(font, fontMetrics) {

//   const fontOptObj = await globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: font.src, fontMetrics: fontMetrics, style: font.style });

//   const fontOpt = new fontContainerFont(font.family, font.style, font.type, fontOptObj.fontData, true, fontOptObj.kerningPairs);

//   return fontOpt;

// }

/**
 * 
 * @param {fontContainerFamily} fontFamily 
 */
async function optimizeFontContainerFamily(fontFamily) {

	// When we have metrics for individual fonts families, those are used to optimize the appropriate fonts.
	// Otherwise, the "default" metric is applied to whatever font the user has selected as the default font. 
	globalSettings.multiFontMode = checkMultiFontMode(globalThis.fontMetricsObj);
  let fontMetricsType = "Default";
  if (globalSettings.multiFontMode) {
    if (fontFamily.normal.type == "sans") {
      fontMetricsType = "SansDefault" ;
    } else {
      fontMetricsType = "SerifDefault" ;
    }
  }

  const metricsNormal = globalThis.fontMetricsObj[fontMetricsType][fontFamily.normal.style];
  const normalOptFont = globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: fontFamily.normal.src, fontMetrics: metricsNormal, style: fontFamily.normal.style }).then((x) => {
    return new fontContainerFont(fontFamily.normal.family, fontFamily.normal.style, fontFamily.normal.type, x.fontData, true, x.kerningPairs);
  });

  const metricsItalic = globalThis.fontMetricsObj[fontMetricsType][fontFamily.italic.style];
  const italicOptFont = globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: fontFamily.italic.src, fontMetrics: metricsItalic, style: fontFamily.italic.style }).then((x) => {
    return new fontContainerFont(fontFamily.italic.family, fontFamily.italic.style, fontFamily.italic.type, x.fontData, true, x.kerningPairs);
  });

  const metricsSmallCaps = globalThis.fontMetricsObj[fontMetricsType][fontFamily["small-caps"].style];
  const smallCapsOptFont = globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: fontFamily["small-caps"].src, fontMetrics: metricsSmallCaps, style: fontFamily["small-caps"].style }).then((x) => {
    return new fontContainerFont(fontFamily["small-caps"].family, fontFamily["small-caps"].style, fontFamily["small-caps"].type, x.fontData, true, x.kerningPairs);
  });

  return new fontContainerFamily(await normalOptFont, await italicOptFont, await smallCapsOptFont);

}

/**
 * 
 * @param {fontContainerFont} fontNormal 
 * @param {fontContainerFont} fontItalic 
 * @param {fontContainerFont} fontSmallCaps 
 */
export function fontContainerFamily(fontNormal, fontItalic, fontSmallCaps) {
  /**@type {fontContainerFont} */
  this.normal = fontNormal;
  /**@type {fontContainerFont} */
  this.italic = fontItalic;
  /**@type {fontContainerFont} */
  this["small-caps"] = fontSmallCaps;
}

/**
 * 
 * @param {string} family 
 * @param {("sans"|"serif")} type 
 * @param {string} normalSrc 
 * @param {string} italicSrc 
 * @param {string} smallCapsSrc 
 */
function loadFontContainerFamilyRaw(family, type, normalSrc, italicSrc, smallCapsSrc) {
  const normal = new fontContainerFont(family, "normal", type, normalSrc, false);
  const italic = new fontContainerFont(family, "italic", type, italicSrc, false);
  const smallCaps = new fontContainerFont(family, "small-caps", type, smallCapsSrc, false);
  return new fontContainerFamily(normal, italic, smallCaps);
}

/**
 * 
 * @param {fontContainerFamily} fontContainerCarlito 
 * @param {fontContainerFamily} fontContainerCentury
 * @param {fontContainerFamily} fontContainerNimbusRomNo9L 
 * @param {fontContainerFamily} fontContainerNimbusSans 
 */
function fontContainerAll(fontContainerCarlito, fontContainerNimbusRomNo9L, fontContainerNimbusSans, fontContainerCentury) {
  this.Carlito = fontContainerCarlito;
  this.Century = fontContainerCentury;
  this.NimbusRomNo9L = fontContainerNimbusRomNo9L;
  this.NimbusSans = fontContainerNimbusSans;
  this.SansDefault = this.NimbusSans;
  this.SerifDefault = this.NimbusRomNo9L;
  this.Default = this.NimbusRomNo9L;
}

function loadFontContainerAllRaw() {
  const Carlito = loadFontContainerFamilyRaw("Carlito", "sans", "Carlito-Regular.woff", "Carlito-Italic.woff", "Carlito-SmallCaps.woff");
  const Century = loadFontContainerFamilyRaw("Century", "serif", "C059-Roman.woff", "C059-Italic.woff", "C059-SmallCaps.woff");
  const NimbusRomNo9L = loadFontContainerFamilyRaw("NimbusRomNo9L", "serif", "NimbusRomNo9L-Reg.woff", "NimbusRomNo9L-RegIta.woff", "NimbusRomNo9L-RegSmallCaps.woff");
  const NimbusSans = loadFontContainerFamilyRaw("NimbusSans", "sans", "NimbusSanL-Reg.woff", "NimbusSanL-RegIta.woff", "NimbusSanL-RegSmallCaps.woff");

  return new fontContainerAll(Carlito, NimbusRomNo9L, NimbusSans, Century);
}

async function loadFontContainerAllOpt() {
  const Carlito = await optimizeFontContainerFamily(fontPrivate.Carlito);
  const Century = await optimizeFontContainerFamily(fontPrivate.Century);
  const NimbusRomNo9L = await optimizeFontContainerFamily(fontPrivate.NimbusRomNo9L);
  const NimbusSans = await optimizeFontContainerFamily(fontPrivate.NimbusSans);

  return new fontContainerAll(Carlito, NimbusRomNo9L, NimbusSans, Century);
}

const fontPrivate = loadFontContainerAllRaw();

export let fontAll = fontPrivate;

/**@type {?fontContainerAll} */
let fontPrivateOpt = null;

/**
 * 
 * @param {boolean} enable 
 */
export async function enableDisableFontOpt(enable) {
  if (enable && !fontPrivateOpt) {
    fontPrivateOpt = await loadFontContainerAllOpt();
  }

  if (enable && fontPrivateOpt) {
    fontAll = await fontPrivateOpt;
  } else {
    fontAll = fontPrivate;
  }
}

