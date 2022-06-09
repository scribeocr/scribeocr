
// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

import { createSmallCapsFont } from "./fontOptimize.js";

// Load all font styles for specified font family
export async function loadFontFamily(fontFamily) {

  const heightSmallCaps = 1;

  let familyStr;
  if (fontFamily.toLowerCase() == "open sans") {
    familyStr = "Open Sans";
  } else if (fontFamily.toLowerCase() == "libre baskerville") {
    familyStr = "Libre Baskerville";
  } else {
    familyStr = fontFamily;
  }

  if (!globalThis.fontObj) {
    globalThis.fontObj = {};
    globalThis.fontObjRaw = {};
  }
  if (!globalThis.fontObj[familyStr]) {
    globalThis.fontObj[familyStr] = {};
    globalThis.fontObjRaw[familyStr] = {};
  }

  // Font data can either be stored in an array or found through a URL
  const sourceItalic = globalThis.fontObjRaw[familyStr]["italic"] || fontFiles[familyStr + "-italic"];
  const sourceNormal = globalThis.fontObjRaw[familyStr]["normal"] || fontFiles[familyStr];

  globalThis.fontObj[familyStr]["italic"] = loadFont(familyStr + "-italic", sourceItalic, true).then(async (x) => {
    await loadFontBrowser(familyStr, "italic", sourceItalic, true);
    return x;
  });
  globalThis.fontObj[familyStr]["normal"] = loadFont(familyStr, sourceNormal, true).then(async (x) => {
    await loadFontBrowser(familyStr, "normal", sourceNormal, true);
    return x;
  });
  
  // Most fonts do not include small caps variants, so we create our own using the normal variant as a starting point. 
  globalThis.fontObj[familyStr]["small-caps"] = createSmallCapsFont(globalThis.fontObj[familyStr]["normal"], heightSmallCaps).then(async (x) => {
    globalThis.fontObjRaw[familyStr]["small-caps"] = x.toArrayBuffer();
    loadFontBrowser(familyStr, "small-caps", globalThis.fontObjRaw[familyStr]["small-caps"], true);
    return (x);
  });

  await Promise.allSettled([globalThis.fontObj[familyStr]["normal"], globalThis.fontObj[familyStr]["italic"], globalThis.fontObj[familyStr]["small-caps"]]);
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
    if (typeof (src) == "string") {
      return opentype.load(src);
    } else {
      return opentype.parse(src, { lowMemory: false });
    }
  }
  //await loadFontBrowser(familyStr, styleStr, src, overwrite = overwrite);
}

// Object containing location of various font files
var fontFiles = new Object;
fontFiles["Libre Baskerville"] = "./fonts/LibreBaskerville-Regular.woff";
fontFiles["Libre Baskerville-italic"] = "./fonts/LibreBaskerville-Italic.woff";
fontFiles["Libre Baskerville-small-caps"] = "./fonts/LibreBaskerville-Regular.woff";

fontFiles["Open Sans"] = "./fonts/OpenSans-Regular.woff";
fontFiles["Open Sans-italic"] = "./fonts/OpenSans-Italic.woff";
fontFiles["Open Sans-small-caps"] = "./fonts/OpenSans-Regular.woff";