
// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

// Sans/serif lookup for common font families
// Should be added to if additional fonts are encountered
// Fonts that should not be added (both Sans and Serif variants):
// DejaVu
const serifFonts = ["Baskerville", "Book", "Cambria", "Century_Schoolbook", "Courier", "Garamond", "Georgia", "Times", "Liberation Mono"];
const sansFonts = ["Arial", "Calibri", "Comic", "Franklin", "Helvetica", "Impact", "Tahoma", "Trebuchet", "Verdana"];

const serifFontsRegex = new RegExp(serifFonts.reduce((x,y) => x + '|' + y), 'i');
const sansFontsRegex = new RegExp(sansFonts.reduce((x,y) => x + '|' + y), 'i');


/**
 * Given a font name from Tesseract/Abbyy XML, determine if it should be represented by sans font or serif font.
 *
 * @param {string} fontName - The name of the font to determine the type of. If the font name 
 * is falsy, the function will return "Default".
 * @returns {string} fontFamily - The determined type of the font. Possible values are "SansDefault", 
 * "SerifDefault", or "Default" (if the font type cannot be determined).
 * @throws {console.log} - Logs an error message to the console if the font is unidentified and 
 * it is not the "Default Metrics Font".
 */
export function determineSansSerif(fontName) {

  let fontFamily = "Default";
  // Font support is currently limited to 1 font for Sans and 1 font for Serif.
  if(fontName){
    // First, test to see if "sans" or "serif" is in the name of the font
    if(/(^|\W|_)sans($|\W|_)/i.test(fontName)){
      fontFamily = "SansDefault";
    } else if (/(^|\W|_)serif($|\W|_)/i.test(fontName)) {
      fontFamily = "SerifDefault";

    // If not, check against a list of known sans/serif fonts.
    // This list is almost certainly incomplete, so should be added to when new fonts are encountered. 
    } else if (serifFontsRegex.test(fontName)) {
      fontFamily = "SerifDefault";
    } else if (sansFontsRegex.test(fontName)) {
      fontFamily = "SansDefault";
    } else if (fontName != "Default Metrics Font") {
      console.log("Unidentified font in XML: " + fontName);
    }
  }

  return fontFamily;

}


/**
 * Asynchronously loads a font family based on the provided input parameters. 
 * The function updates global font object storage with font data for normal, italic, 
 * and small-caps styles. It also attempts to load the fonts in the browser.
 *
 * @param {string} fontFamily - The name of the font family to load. Accepts either 
 * (1) "SansDefault"/"SerifDefault" or (2) the name of a font.
 * @throws Will log an error to the console if any of the font loading promises are rejected.
 * @returns {Promise<void>} A promise that resolves once all font styles have been loaded 
 * and processed, or rejects if an error occurs during the loading process.
 * @global
 */
export async function loadFontFamily(fontFamily) {

  const heightSmallCaps = 1;

  let familyStrInput = fontFamily; 
  let familyStrOutput = fontFamily; 

  // "SansDefault" and "SerifDefault" are not actually files--what gets loaded is determined by the settings.
  if (familyStrInput == "SansDefault") {
    familyStrInput = globalThis.globalSettings.defaultFontSans;
  } else if (familyStrInput == "SerifDefault") {
    familyStrInput = globalThis.globalSettings.defaultFontSerif;
  }

  if (!globalThis.fontObj) {
    globalThis.fontObj = {};
    globalThis.fontObjRaw = {};
  }
  if (!globalThis.fontObj[familyStrOutput]) {
    globalThis.fontObj[familyStrOutput] = {};
  }
  if (!globalThis.fontObjRaw[familyStrInput]) {
    globalThis.fontObjRaw[familyStrInput] = {};
  }

  // Font data can either be stored in an array or found through a URL
  const sourceItalic = globalThis.fontObjRaw[familyStrInput]["italic"] || relToAbsPath("../fonts/" + fontFiles[familyStrInput + "-italic"]);
  const sourceNormal = globalThis.fontObjRaw[familyStrInput]["normal"] || relToAbsPath("../fonts/" + fontFiles[familyStrInput]);
  const sourceSmallCaps = globalThis.fontObjRaw[familyStrInput]["small-caps"] || relToAbsPath("../fonts/" + fontFiles[familyStrInput + "-small-caps"]);

  if (!sourceItalic || !sourceNormal || !sourceSmallCaps) {
    throw new Error('No input file or data detected.'); 
  }

  globalThis.fontObj[familyStrOutput]["italic"] = loadFont(familyStrInput + "-italic", sourceItalic, true).then(async (x) => {
    if (globalThis.document) await loadFontBrowser(familyStrOutput, "italic", sourceItalic, true);
    return x;
  }, (x) => console.log(x));
  globalThis.fontObj[familyStrOutput]["normal"] = loadFont(familyStrInput, sourceNormal, true).then(async (x) => {
    if (globalThis.document) await loadFontBrowser(familyStrOutput, "normal", sourceNormal, true);
    return x;
  }, (x) => console.log(x));
  globalThis.fontObj[familyStrOutput]["small-caps"] = loadFont(familyStrInput, sourceSmallCaps, true).then(async (x) => {
    if (globalThis.document) await loadFontBrowser(familyStrOutput, "small-caps", sourceSmallCaps, true);
    return x;
  }, (x) => console.log(x));

  await Promise.allSettled([globalThis.fontObj[familyStrOutput]["normal"], globalThis.fontObj[familyStrOutput]["italic"], globalThis.fontObj[familyStrOutput]["small-caps"]]);
}

// Load font as FontFace (used for displaying on canvas)
export async function loadFontBrowser(fontFamily, fontStyle, src, overwrite = false) {

  src = await src;

  if (typeof (src) == "string") {
    src = "url(" + src + ")";
  }

  if (typeof (globalThis.fontFaceObj) == "undefined") {
    globalThis.fontFaceObj = new Object;
  }

  // Only load font if not already loaded.
  if (overwrite || !document.fonts.check(fontStyle + " 10px '" + fontFamily + "'")) {
    let newFont;
    if (fontStyle == "small-caps") {
      newFont = new FontFace(fontFamily + " Small Caps", src);
    } else {
      newFont = new FontFace(fontFamily, src, { style: fontStyle });
    }

    if (typeof (globalThis.fontFaceObj[fontFamily]) == "undefined") {
      globalThis.fontFaceObj[fontFamily] = new Object;
    }

    if (typeof (globalThis.fontFaceObj[fontFamily][fontStyle]) != "undefined") {
      document.fonts.delete(globalThis.fontFaceObj[fontFamily][fontStyle]);
    }

    globalThis.fontFaceObj[fontFamily][fontStyle] = newFont;

    await newFont.load();
    // add font to document
    document.fonts.add(newFont);
    // enable font with CSS class
    document.body.classList.add('fonts-loaded');

  }

  // Without clearing the cache FabricJS continues to use old font metrics.
  fabric.util.clearFabricFontCache(fontFamily);
  fabric.util.clearFabricFontCache(fontFamily + " Small Caps");

  return;

}

// function createSmallCapsFont(fontData, heightSmallCaps) {

//   return new Promise(function (resolve, reject) {
//     let id = globalThis.optimizeFontWorker.promiseId++;
//     globalThis.optimizeFontWorker.promises[id] = { resolve: resolve };

//     globalThis.optimizeFontWorker.postMessage({fontData: fontData, heightSmallCaps: heightSmallCaps, func: "createSmallCapsFont", id: id});

//   });

// }

// Load font as opentype.js object, call loadFontBrowser to load as FontFace
export async function loadFont(font, src, overwrite = false) {

  if (typeof (globalThis.fontObjRaw) == "undefined") {
    globalThis.fontObjRaw = {};
  }

  let styleStr = font.match(/[\-](.+)/);
  if (styleStr == null) {
    styleStr = "normal";
    // Alternative names for "Normal"
  } else {
    styleStr = styleStr[1].toLowerCase()
    if (["medium", "roman"].includes(styleStr)) {
      styleStr = "normal";
    }
  }

  const familyStr = font.match(/[^\-]+/)[0];

  if (!globalThis.fontObjRaw[familyStr]) {
    globalThis.fontObjRaw[familyStr] = new Object;
  }

  // Only load font if not already loaded
  if (overwrite || !globalThis.fontObj[familyStr][styleStr]) {
    let workingFont;

    if (typeof (src) == "string") {
      workingFont = await opentype.load(src);
    } else {
      workingFont = await opentype.parse(src, { lowMemory: false });
    }

    // Remove gsub table.  
    // If this does not occur, Opentype.js will throw an error when writing the font 
    // to a buffer for certain fonts (e.g. DM Sans), which happens during the write to PDF step. 
    // Error: lookup type 6 format 2 is not yet supported.
    workingFont.tables.gsub = null;

    return workingFont;

  }
}

// Object containing location of various font files
export const fontFiles = {
"NimbusRomNo9L": "NimbusRomNo9L-Reg.woff",
"NimbusRomNo9L-italic": "NimbusRomNo9L-RegIta.woff",
"NimbusRomNo9L-small-caps": "NimbusRomNo9L-RegSmallCaps.woff",
"NimbusSanL": "NimbusSanL-Reg.woff",
"NimbusSanL-italic": "NimbusSanL-RegIta.woff",
"NimbusSanL-small-caps": "NimbusSanL-RegSmallCaps.woff",
};

export function relToAbsPath(fileName) {
  const url = new URL(fileName, import.meta.url);
  return url.protocol == "file:" ? url.host + url.pathname : url.href;
}