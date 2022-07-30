
// File summary:
// Functions to calculate font metrics and generate new fonts.

import { quantile, round6 } from "./miscUtils.js";

// import { glyphAlts } from "../fonts/glyphs.js";

import { determineSansSerif } from "./fontUtils.js";

// Calculations that are run after all files (both image and OCR) have been loaded.
export function calculateOverallFontMetrics(fontMetricObjsMessage) {

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
    document.getElementById("charInfoError")?.setAttribute("style", "");
    return;
  } else if (charGoodCt == 0 && charWarnCt > 0) {

    if (Object.keys(fontMetricsObj).length > 0) {
      optimizeFontElem.disabled = false;
    } else {
      document.getElementById("charInfoAlert")?.setAttribute("style", "");
    }
  } else {
    optimizeFontElem.disabled = false;

    // TODO: This reduce-based implementation is extremely inefficient due to allocating a ton of arrays. Should be replaced with implementation that pushes to single array. 
    fontMetricsObj = fontMetricObjsMessage.filter((x) => !["char_error", "char_warning"].includes(x?.message)).reduce((x,y) => unionFontMetrics(x,y));

    let fontMetricsOut = {};

    for (const [family, obj] of Object.entries(fontMetricsObj)) {
      fontMetricsOut[family] = {};
      fontMetricsOut[family]["obs"] = 0;
      for (const [style, obj2] of Object.entries(obj)) {
        fontMetricsOut[family][style] = calculateFontMetrics(obj2);
        fontMetricsOut[family]["obs"] = fontMetricsOut[family]["obs"] + fontMetricsOut[family][style]["obs"];
      }  
    }

    fontMetricsOut = identifyFontVariants(globalThis.fontScores, fontMetricsOut);

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
  this.variants = {};
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

// Fonts where italic "y" has an open counter where the lowest point is to the left of the tail
const min_y = ["Bookman", "Georgia"];
const min_y_regex = new RegExp(min_y.reduce((x,y) => x + '|' + y), 'i');

// Fonts where italic "k" has a closed loop
const closed_k = ["Century_Schoolbook"];
const closed_k_regex = new RegExp(closed_k.reduce((x,y) => x + '|' + y), 'i');

// Fonts where italic "v" and "w" is rounded (rather than pointy)
const rounded_vw = ["Bookman", "Century_Schoolbook", "Georgia"];
const rounded_vw_regex = new RegExp(rounded_vw.reduce((x,y) => x + '|' + y), 'i');

const serif_stem_serif_pq = ["Bookman", "Century_Schoolbook", "Courier", "Georgia", "Times"];
const serif_stem_serif_pq_regex = new RegExp(serif_stem_serif_pq.reduce((x,y) => x + '|' + y), 'i');

// While the majority of glyphs can be approximated by applying geometric transformations to a single sans and serif font,
// there are some exceptions (e.g. the lowercase "g" has 2 distinct variations).
// This function identifies variations that require switching out a glyph from the default font entirely. 
export function identifyFontVariants(fontScores, fontMetrics) {

  if (fontMetrics?.["Open Sans"]?.["normal"]) {
    const sans_g = calcTopFont(fontScores?.["Open Sans"]?.["normal"]?.["g"]);
    fontMetrics["Open Sans"]["normal"].variants["sans_g"] = single_g_regex.test(sans_g);
    const sans_1 = calcTopFont(fontScores?.["Open Sans"]?.["normal"]?.["1"]);
    fontMetrics["Open Sans"]["normal"].variants["sans_1"] = base_1_regex.test(sans_1);
  }

  if (fontMetrics?.["Libre Baskerville"]?.["italic"]) {
    const min_y = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["y"]);
    fontMetrics["Libre Baskerville"]["italic"].variants["serif_italic_y"] = min_y_regex.test(min_y);
    const closed_k = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["y"]);
    fontMetrics["Libre Baskerville"]["italic"].variants["serif_open_k"] = !closed_k_regex.test(closed_k);
  
    const rounded_v = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["v"]);
    const rounded_w = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["w"]);
    fontMetrics["Libre Baskerville"]["italic"].variants["serif_pointy_vw"] = !(rounded_vw_regex.test(rounded_v) || rounded_vw_regex.test(rounded_w));
  
    const serif_italic_p = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["p"]);
    const serif_italic_q = calcTopFont(fontScores?.["Libre Baskerville"]?.["italic"]?.["q"]);
    fontMetrics["Libre Baskerville"]["italic"].variants["serif_stem_sans_pq"] = !(serif_stem_serif_pq_regex.test(serif_italic_p) || serif_stem_serif_pq_regex.test(serif_italic_q));
  
  }

  return fontMetrics;
}

