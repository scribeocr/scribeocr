
// File summary:
// Functions to calculate font metrics and generate new fonts.

import { quantile, round6 } from "./miscUtils.js";

import { glyphAlts } from "../fonts/glyphs.js";

import { determineSansSerif } from "./fontUtils.js";

// Creates optimized version of `font` based on metrics in `fontMetricsObj`
export async function optimizeFont(font, auxFont, fontMetricsObj, type = "normal") {

  font = await font;
  let fontData = font.toArrayBuffer();

  let workingFont = opentype.parse(fontData, { lowMemory: false });

  let fontDataAux, workingFontAux;
  if (auxFont) {
    fontDataAux = auxFont.toArrayBuffer();
    workingFontAux = opentype.parse(fontDataAux, { lowMemory: false });
  }

  if(type == "normal" && globalThis.fontVariants.sans_g && /sans/i.test(font.names.fontFamily.en)) {
    const glyphI = workingFont.charToGlyph("g");
    glyphI.path = JSON.parse(glyphAlts.sans_g_single);
  }
  if(type == "normal" && globalThis.fontVariants.sans_1 && /sans/i.test(font.names.fontFamily.en)) {
    const glyphI = workingFont.charToGlyph("1");
    glyphI.path = JSON.parse(glyphAlts.sans_1_base);
  }
  if(type == "italic" && globalThis.fontVariants.serif_italic_y && /libre/i.test(font.names.fontFamily.en)) {
    const glyphI = workingFont.charToGlyph("y");
    glyphI.path = JSON.parse(glyphAlts.serif_min_y);
  }

  let oGlyph = workingFont.charToGlyph("o").getMetrics();
  let xHeight = oGlyph.yMax - oGlyph.yMin;

  let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;

  // Define various character classes
  const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

  const upperAsc = ["1", "4", "5", "7", "A", "B", "D", "E", "F", "H", "I", "K", "L", "M", "N", "P", "R", "T", "U", "V", "W", "X", "Y", "Z"]

  const singleStemClassA = ["i", "l", "t", "I"];
  const singleStemClassB = ["f", "i", "j", "l", "t", "I", "J", "T"];

  //const workingFontRightBearingMedian = quantile(lower.map(x => workingFont.charToGlyph(x).getMetrics().rightSideBearing), 0.5);
  //console.log("workingFontRightBearingMedian: " + workingFontRightBearingMedian);

  // Adjust character width and advance
  for (const [key, value] of Object.entries(fontMetricsObj["width"])) {

    // 33 is the first latin glyph (excluding space which is 32)
    if (parseInt(key) < 33) { continue; }

    const charLit = String.fromCharCode(parseInt(key));


    // Some glyphs do not benefit from recalculating statistics, as they are commonly misidentified
    if (["."].includes(charLit)) { continue; }

    let glyphI = workingFont.charToGlyph(charLit);

    if (glyphI.name == ".notdef" || glyphI.name == "NULL") continue;

    let glyphIMetrics = glyphI.getMetrics();
    let glyphIWidth = glyphIMetrics.xMax - glyphIMetrics.xMin;
    let scaleXFactor = (value * xHeight) / glyphIWidth;


    // Left bearings are currently only changed for specific punctuation characters (overall scaling aside)
    let shiftX = 0;
    if ([";", ":", "‘", "’", "“", "”", "\""].includes(charLit)) {
      let leftBearingCorrect = Math.round(fontMetricsObj["advance"][key] * xHeight);
      if (isFinite(leftBearingCorrect)) {
        let leftBearingAct = glyphI.leftSideBearing;
        shiftX = leftBearingCorrect - leftBearingAct;

        // Reset shiftX to 0 if resulting advance would be very small or negative
        if (shiftX + glyphI.advanceWidth < workingFont.unitsPerEm * 0.05) {
          shiftX = 0;
        }

      }
    }

    // TODO: For simplicitly we assume the stem is located at the midpoint of the bounding box (0.35 for "f")
    // This is not always true (for example, "t" in Libre Baskerville).
    // Look into whether there is a low(ish) effort way of finding the visual center for real.

    let glyphICenterPoint = charLit == "f" ? 0.35 : 0.5;

    let glyphICenter = Math.max(glyphIMetrics.xMin, 0) + Math.round(glyphIWidth * glyphICenterPoint);
    let glyphIWidthQuarter = Math.round(glyphIWidth / 4);

    // Horizontal scaling is limited for certain letters with a single vertical stem.
    // This is because the bounding box for these letters is almost entirely established by the stylistic flourish.
    if (singleStemClassA.includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.1), 0.9);
      // Some fonts have significantly wider double quotes compared to the default style, so more variation is allowed
    } else if (["“", "”"].includes(charLit)) {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.5), 0.7);
    } else {
      scaleXFactor = Math.max(Math.min(scaleXFactor, 1.3), 0.7);
    }

    for (let j = 0; j < glyphI.path.commands.length; j++) {
      let pointJ = glyphI.path.commands[j];
      if (pointJ.x != null) {
        //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        if (singleStemClassB.includes(charLit)) {
          if (Math.abs(pointJ.x - glyphICenter) > glyphIWidthQuarter) {
            pointJ.x = Math.round((pointJ.x - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
          }
        } else {
          pointJ.x = Math.round(pointJ.x * scaleXFactor) + shiftX;
        }

      }
      if (pointJ.x1 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        if (singleStemClassB.includes(charLit)) {
          if (Math.abs(pointJ.x1 - glyphICenter) > glyphIWidthQuarter) {
            pointJ.x1 = Math.round((pointJ.x1 - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
          }
        } else {
          pointJ.x1 = Math.round(pointJ.x1 * scaleXFactor) + shiftX;
        }
      }
      if (pointJ.x2 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        if (singleStemClassB.includes(charLit)) {
          if (Math.abs(pointJ.x2 - glyphICenter) > glyphIWidthQuarter) {
            pointJ.x2 = Math.round((pointJ.x2 - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
          }
        } else {
          pointJ.x2 = Math.round(pointJ.x2 * scaleXFactor) + shiftX;
        }
      }


    }

    // Do not adjust advance for italic "f".
    if (key == "102" && type == "italic") continue;


    glyphIMetrics = glyphI.getMetrics();

    // To simplify calculations, no right bearings are used.
    //glyphI.advanceWidth = Math.round(scaleXFactor * glyphIWidth) + glyphIMetrics.xMin;
    glyphI.advanceWidth = glyphIMetrics.xMax;
    glyphI.leftSideBearing = glyphIMetrics.xMin;
    //glyphI.rightSideBearing = 0;


  }

  // Adjust height for capital letters
  const capsMult = xHeight * fontMetricsObj["heightCaps"] / fontAscHeight;
  for (const key of [...Array(26).keys()].map((x) => x + 65)) {

    const charLit = String.fromCharCode(key);

    let glyphI = workingFont.charToGlyph(charLit);

    for (let j = 0; j < glyphI.path.commands.length; j++) {
      let pointJ = glyphI.path.commands[j];
      if (pointJ.y != null) {
        pointJ.y = Math.round(pointJ.y * capsMult);
      }
      if (pointJ.y1 != null) {
        pointJ.y1 = Math.round(pointJ.y1 * capsMult);
      }
      if (pointJ.y2 != null) {
        pointJ.y2 = Math.round(pointJ.y2 * capsMult);
      }

    }

    if (auxFont) {
      let glyphI2 = workingFontAux.charToGlyph(charLit);
      for (let j = 0; j < glyphI2.path.commands.length; j++) {
        let pointJ = glyphI2.path.commands[j];
        if (pointJ.y != null) {
          pointJ.y = Math.round(pointJ.y * capsMult);
        }
        if (pointJ.y1 != null) {
          pointJ.y1 = Math.round(pointJ.y1 * capsMult);
        }
        if (pointJ.y2 != null) {
          pointJ.y2 = Math.round(pointJ.y2 * capsMult);
        }
      }
    }
  }

  const upperAscCodes = upperAsc.map((x) => String(x.charCodeAt(0)));
  const charHeightKeys = Object.keys(fontMetricsObj["height"]);
  const charHeightA = round6(quantile(Object.values(fontMetricsObj["height"]).filter((element, index) => upperAscCodes.includes(charHeightKeys[index])), 0.5));

  {    // TODO: Extend similar logic to apply to other descenders such as "p" and "q"
    // Adjust height of capital J (which often has a height greater than other capital letters)
    // All height from "J" above that of "A" is assumed to occur under the baseline
    const actJMult = Math.max(round6(fontMetricsObj["height"][74]) / charHeightA, 0);
    const fontJMetrics = workingFont.charToGlyph("J").getMetrics();
    const fontAMetrics = workingFont.charToGlyph("A").getMetrics();
    const fontJMult = Math.max((fontJMetrics.yMax - fontJMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin), 1);
    const actFontJMult = actJMult / fontJMult;

    if (Math.abs(1 - actFontJMult) > 0.02) {
      let glyphI = workingFont.charToGlyph("J");
      let glyphIMetrics = glyphI.getMetrics();
      const yAdj = Math.round(glyphIMetrics['yMax'] - (glyphIMetrics['yMax'] * actFontJMult));

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        let pointJ = glyphI.path.commands[j];
        if (pointJ.y != null) {
          pointJ.y = Math.round(pointJ.y * actFontJMult + yAdj);
        }
        if (pointJ.y1 != null) {
          pointJ.y1 = Math.round(pointJ.y1 * actFontJMult + yAdj);
        }
        if (pointJ.y2 != null) {
          pointJ.y2 = Math.round(pointJ.y2 * actFontJMult + yAdj);
        }

      }

    }
  }


  // Adjust height of descenders
  // All height from "p" or "q" above that of "a" is assumed to occur under the baseline
  const descAdjArr = ["g","p","q"];
  const fontAMetrics = workingFont.charToGlyph("a").getMetrics();
  const minA = fontAMetrics.yMin;
  for(let i=0;i<descAdjArr.length;i++) {
    const charI = descAdjArr[i];
    const charICode = charI.charCodeAt(0);
    const actMult = Math.max(fontMetricsObj["height"][charICode] / fontMetricsObj["height"][97], 0);
    const fontMetrics = workingFont.charToGlyph(charI).getMetrics();
    const fontMult = (fontMetrics.yMax - fontMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin);
    const actFontMult = actMult / fontMult;
    const glyphHeight = fontMetrics.yMax - fontMetrics.yMin;
    const glyphLowerStemHeight = minA - fontMetrics.yMin;
    if (Math.abs(actFontMult) > 1.02) {
      let glyphI = workingFont.charToGlyph(charI);

      // Adjust scaling factor to account for the fact that only the lower part of the stem is adjusted
      let scaleYFactor = ((actFontMult - 1) * (glyphHeight / glyphLowerStemHeight)) + 1;

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        let pointJ = glyphI.path.commands[j];
        if (pointJ.y && pointJ.y < minA) {
          pointJ.y = Math.round((pointJ.y - minA) * scaleYFactor);
        }
        if (pointJ.y1 && pointJ.y1 < minA) {
          pointJ.y1 = Math.round((pointJ.y1 - minA) * scaleYFactor);
        }
        if (pointJ.y2 && pointJ.y2 < minA) {
          pointJ.y2 = Math.round((pointJ.y2 - minA) * scaleYFactor);
        }
      }
    }
  }

  let fontKerningObj = new Object;

  // Kerning is limited to +/-10% of the em size for most pairs.  Anything beyond this is likely not correct.
  let maxKern = Math.round(workingFont.unitsPerEm * 0.1);
  let minKern = maxKern * -1;

  for (const [key, value] of Object.entries(fontMetricsObj["kerning"])) {

    // Do not adjust pair kerning for italic "ff".
    // Given the amount of overlap between these glyphs, this metric is rarely accurate. 
    if (key == "102,102" && type == "italic") continue;

    const nameFirst = key.match(/\w+/)[0];
    const nameSecond = key.match(/\w+$/)[0];

    const charFirst = String.fromCharCode(parseInt(nameFirst));
    const charSecond = String.fromCharCode(parseInt(nameSecond));

    const indexFirst = workingFont.charToGlyphIndex(charFirst);
    const indexSecond = workingFont.charToGlyphIndex(charSecond);

    let fontKern = Math.round(value * xHeight - Math.max(workingFont.glyphs.glyphs[indexSecond].leftSideBearing, 0));

    // For smart quotes, the maximum amount of kerning space allowed is doubled.
    // Unlike letters, some text will legitimately have a large space before/after curly quotes.
    // TODO: Handle quotes in a more systematic way (setting advance for quotes, or kerning for all letters,
    // rather than relying on each individual pairing.)
    if (["8220", "8216"].includes(nameFirst) || ["8221", "8217"].includes(nameSecond)) {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern * 2);

      // For pairs that commonly use ligatures ("ff", "fi", "fl") allow lower minimum
    } else if (["102,102", "102,105", "102,108"].includes(key)) {
      fontKern = Math.min(Math.max(fontKern, Math.round(minKern * 1.5)), maxKern);
    } else {
      fontKern = Math.min(Math.max(fontKern, minKern), maxKern);
    }

    fontKerningObj[indexFirst + "," + indexSecond] = fontKern;
  }


  workingFont.kerningPairs = fontKerningObj;

  // Remove GSUB table (in most Latin fonts this table is responsible for ligatures, if it is used at all).
  // The presence of ligatures (such as ﬁ and ﬂ) is not properly accounted for when setting character metrics.
  //workingFont.tables.gsub = null;


  // Quick fix due to bug in pdfkit (see note in renderPDF function)
  //workingFont.tables.name.postScriptName["en"] = workingFont.tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

  return ([workingFont, workingFontAux]);

}


// Note: Small caps are treated differently from Bold and Italic styles.
// Browsers will "fake" small caps using smaller versions of large caps.
// Unfortunately, it looks like small caps cannot be loaded as a FontFace referring
// to the same font family.  Therefore, they are instead loaded to a different font family.
// https://stackoverflow.com/questions/14527408/defining-small-caps-font-variant-with-font-face
export async function createSmallCapsFont(font, heightSmallCaps, fontMetricsObj = null) {

  font = await font;
  // As input to this function is usually another font object we want to keep unchanged, saving to buffer and parsing creates a new copy. 
  let fontData = font.toArrayBuffer();
  let workingFont = opentype.parse(fontData, { lowMemory: false });

  let oGlyph = workingFont.charToGlyph("o");
  let oGlyphMetrics = oGlyph.getMetrics();
  let xHeight = oGlyphMetrics.yMax - oGlyphMetrics.yMin;
  let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;
  const smallCapsMult = xHeight * (heightSmallCaps ?? 1) / fontAscHeight;
  const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
  const singleStemClassA = ["i", "l", "t", "I"];
  const singleStemClassB = ["f", "i", "j", "l", "t", "I", "J", "T"];


  for (let i = 0; i < lower.length; i++) {
    const charLit = lower[i];
    const glyphIUpper = workingFont.charToGlyph(charLit.toUpperCase());
    const glyphI = workingFont.charToGlyph(charLit);

    glyphI.path.commands = JSON.parse(JSON.stringify(glyphIUpper.path.commands));

    //glyphI.path.commands = [...glyphIUpper.path.commands];
    for (let j = 0; j < glyphI.path.commands.length; j++) {
      let pointJ = glyphI.path.commands[j];
      if (pointJ.x != null) {
        //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x = Math.round(pointJ.x * (smallCapsMult));
      }
      if (pointJ.x1 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x1 = Math.round(pointJ.x1 * (smallCapsMult));
      }
      if (pointJ.x2 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x2 = Math.round(pointJ.x2 * (smallCapsMult));
      }

      if (pointJ.y != null) {
        //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y = Math.round(pointJ.y * (smallCapsMult));
      }
      if (pointJ.y1 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y1 = Math.round(pointJ.y1 * (smallCapsMult));
      }
      if (pointJ.y2 != null) {
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y2 = Math.round(pointJ.y2 * (smallCapsMult));
      }

    }

    glyphI.advanceWidth = Math.round(glyphIUpper.advanceWidth * smallCapsMult);

  }

  // Remove ligatures, as these are especially problematic for small caps fonts (as small caps may be replaced by lower case ligatures)
  workingFont.tables.gsub = null;

  return workingFont;

}

// Calculations that are run after all files (both image and OCR) have been loaded.
export function calculateOverallFontMetrics(fontMetricObjsMessage) {

  globalThis.fontVariants = identifyFontVariants(globalThis.fontScores);

  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.
  let charErrorCt = 0;
  let charWarnCt = 0;
  let charGoodCt = 0;
  for (const [key, obj] of Object.entries(fontMetricObjsMessage)) {
    if (obj["message"] == "char_error") {
      charErrorCt = charErrorCt + 1;
    } else if (obj["message"] == "char_warning") {
      charWarnCt = charWarnCt + 1;
    } else {
      charGoodCt = charGoodCt + 1;
    }
  }

  let fontMetricsObj = {};

  const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));

  if (charGoodCt == 0 && charErrorCt > 0) {
    document.getElementById("charInfoError").setAttribute("style", "");
    return;
  } else if (charGoodCt == 0 && charWarnCt > 0) {

    if (Object.keys(fontMetricsObj).length > 0) {
      optimizeFontElem.disabled = false;
    } else {
      document.getElementById("charInfoAlert").setAttribute("style", "");
    }
  } else {
    optimizeFontElem.disabled = false;

    // TODO: This reduce-based implementation is extremely inefficient due to allocating a ton of arrays. Should be replaced with implementation that pushes to single array. 
    fontMetricsObj = fontMetricObjsMessage.filter((x) => !["char_error", "char_warning"].includes(x?.message)).reduce((x,y) => unionFontMetrics(x,y));

    const fontMetricsOut = {};

    for (const [family, obj] of Object.entries(fontMetricsObj)) {
      fontMetricsOut[family] = {};
      fontMetricsOut[family]["obs"] = 0;
      for (const [style, obj2] of Object.entries(obj)) {
        fontMetricsOut[family][style] = calculateFontMetrics(obj2);
        fontMetricsOut[family]["obs"] = fontMetricsOut[family]["obs"] + fontMetricsOut[family][style]["obs"];
      }  
    }

    return (fontMetricsOut);
  }
}


function fontMetrics(){
  this.width = {};
  this.height = {};
  this.desc = {};
  this.advance = {};
  this.kerning = {};
  this.obs = 0;
}

// The following functions are used for combining an array of page-level fontMetrics objects produced by convertPage.js into a single document-level object.
function unionSingleFontMetrics(fontMetricsA, fontMetricsB){
  // If one of the inputs is undefined, return early with the only valid object
  if(fontMetricsA && !fontMetricsB){
    return;
  } else if (!fontMetricsA && fontMetricsB){
    fontMetricsA = structuredClone(fontMetricsB);
  } 

  if(fontMetricsB?.obs) fontMetricsA.obs = fontMetricsA.obs + fontMetricsB.obs;

  for (const [prop, obj] of Object.entries(fontMetricsB)) {
    for (const [key, value] of Object.entries(obj)) {
      if(!fontMetricsA[prop][key]){
        fontMetricsA[prop][key] = [];
      }
      Array.prototype.push.apply(fontMetricsA[prop][key], value);
    }  
  }
  return(fontMetricsA);
}

// Combines font metric objects by adding the observations from fontMetricsB to fontMetricsA
function unionFontMetrics(fontMetricsA, fontMetricsB){

  for(const [family, obj] of Object.entries(fontMetricsB)){
    for(const [style, obj2] of Object.entries(obj)){
      if (Object.keys(obj2["width"]).length == 0) continue;
      if(!fontMetricsA[family]){
        fontMetricsA[family] = {};
      }
      if(!fontMetricsA[family][style]){
        fontMetricsA[family][style] = new fontMetrics();
      }
    }  
  }

  for(const [family, obj] of Object.entries(fontMetricsA)){
    for(const [style, obj2] of Object.entries(obj)){
      unionSingleFontMetrics(fontMetricsA?.[family]?.[style], fontMetricsB?.[family]?.[style]);
    }  
  }

  return(fontMetricsA);

}

function calculateFontMetrics(fontMetricObj){

  const fontMetricOut = new fontMetrics();

  // Take the median of each array
  for (let prop of ["width","height","desc","advance","kerning"]){
    for (let [key, value] of Object.entries(fontMetricObj[prop])) {
      if (value.length > 0) {
        fontMetricOut[prop][key] = round6(quantile(value, 0.5));
      }
    }  
  }

  // Calculate median hight of capital letters only
  const heightCapsArr = [];
  for (const [key, value] of Object.entries(fontMetricObj["height"])) {
    if (/[A-Z]/.test(String.fromCharCode(parseInt(key)))) {
      Array.prototype.push.apply(heightCapsArr, value);
    }
  }

  fontMetricOut["heightCaps"] = round6(quantile(heightCapsArr, 0.5));

  fontMetricOut["obs"] = fontMetricObj["obs"];

  return(fontMetricOut);
}


export function parseDebugInfo(debugTxt){
  if(!globalThis.fontScores) globalThis.fontScores = {"Libre Baskerville": {}, "Open Sans": {}, "Default" : {}};

  const fontLines = debugTxt.match(/Modal Font.+/g);

  if(!fontLines) return;

  // Filter statement added as this regex fails for some lines where the "letter" has multiple characters (possibly non-ASCII punctuation)
  const fontArr = fontLines.map((x) => x.match(/Modal Font: ([^;]+?); Letter: (.); Font: ([^;]+?); Score: (\d+)/)).filter((x) => x?.length == 5);

  for(let i=0;i<fontArr.length;i++){
    const modalFont = fontArr[i][1];
    const char = fontArr[i][2];
    const font = fontArr[i][3];
    const score = parseInt(fontArr[i][4]);
    const modalFontFamily = determineSansSerif(modalFont);
    const style = /italic/i.test(modalFont) ? "italic" : "normal";


    if(!globalThis.fontScores[modalFontFamily][style]) globalThis.fontScores[modalFontFamily][style] = {};
    if(!globalThis.fontScores[modalFontFamily][style][char]) globalThis.fontScores[modalFontFamily][style][char] = {};
    if(!globalThis.fontScores[modalFontFamily][style][char][font]) globalThis.fontScores[modalFontFamily][style][char][font] = 0;

    globalThis.fontScores[modalFontFamily][style][char][font] = globalThis.fontScores[modalFontFamily][style][char][font] + score;
  }
  return;
}

function calcTopFont(fontScoresChar) {
  if(!fontScoresChar) return "";

  const fonts = Object.keys(fontScoresChar);
  let maxScore = 0;
  let maxScoreFont = "";
  for(let i=0;i<fonts.length;i++){
    const font = fonts[i];
    const score = fontScoresChar[font];
    if(score > maxScore) {
      maxScore = score;
      maxScoreFont = font;
    }
  }
  return maxScoreFont;
}


// Sans fonts with "1" without horizontal base: Arial, Helvetica, Impact, Trebuchet.  All serif fonts are included.
const base_1 = ["Calibri", "Comic", "Franklin", "Tahoma", "Verdana", "Baskerville", "Book", "Cambria", "Century_Schoolbook", "Courier", "Garamond", "Georgia", "Times"];
const base_1_regex = new RegExp(base_1.reduce((x,y) => x + '|' + y), 'i');

// Fonts with double "g" are: Calibri, Franklin, Trebuchet
const single_g = ["Arial", "Comic", "DejaVu", "Helvetica", "Impact", "Tahoma", "Verdana"];
const single_g_regex = new RegExp(single_g.reduce((x,y) => x + '|' + y), 'i');

// Fonts where cursive "y" has an open counter where the lowest point is to the left of the tail
const min_y = ["Bookman", "Georgia"];
const min_y_regex = new RegExp(min_y.reduce((x,y) => x + '|' + y), 'i');

// While the majority of glyphs can be approximated by applying geometric transformations to a single sans and serif font,
// there are some exceptions (e.g. the lowercase "g" has 2 distinct variations).
// This function identifies variations that require switching out a glyph from the default font entirely. 
export function identifyFontVariants(fontScores) {
  const variants = {};

  const sans_g = calcTopFont(fontScores?.["Open Sans"]?.["normal"]?.["g"]);
  variants["sans_g"] = single_g_regex.test(sans_g);
  const sans_1 = calcTopFont(fontScores?.["Open Sans"]?.["normal"]?.["1"]);
  variants["sans_1"] = base_1_regex.test(sans_1);
  const min_y = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["y"]);
  variants["serif_italic_y"] = min_y_regex.test(min_y);

  return variants;
}

