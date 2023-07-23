import { round3, getRandomAlphanum } from "./miscUtils.js";
import { ocr } from "./ocrObjects.js";
import { createTesseractScheduler } from "../main.js";

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById("ignorePunct"));

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreCap"));

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreExtra"));

// Quick fix to get VSCode type errors to stop
// Long-term should see if there is a way to get types to work with fabric.js
var fabric = globalThis.fabric;

/**
 * Crop the image data the area containing `words` and render to the `globalThis.canvasAlt` canvas.
 * @param {Array<ocrWord>} words
 * @param {boolean} view
 */
const drawWordActual = async function(words, view = false) {

  const n = words[0].line.page.n;
  // The font/style from the first word is used for the purposes of font metrics
  const lineFontSize = await ocr.calcLineFontSize(words[0].line);
  const fontStyle =  words[0].style;
  const wordFontFamily = words[0].font || globalSettings.defaultFont;

  if (fontStyle == "small-caps") {
    ctx.font = 1000 + 'px ' + wordFontFamily + " Small Caps";
  } else {
    ctx.font = fontStyle + " " + 1000 + 'px ' + wordFontFamily;
  }

  const oMetrics = ctx.measureText("o");

  const fontObjI = await globalThis.fontObj[wordFontFamily][fontStyle];

  const fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));
  const fontBoundingBoxAscent = Math.round(Math.abs(fontObjI.ascender) * (1000 / fontObjI.unitsPerEm));

  const fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  const fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  const sinAngle = Math.sin(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));
  const cosAngle = Math.cos(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));

  const pageDims = globalThis.pageMetricsObj["dimsAll"][n];
  const shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

  const wordsBox = words.map(x => x.bbox);

  // Union of all bounding boxes
  let wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsBox.map(x => x[0]));
  wordBoxUnion[1] = Math.min(...wordsBox.map(x => x[1]));
  wordBoxUnion[2] = Math.max(...wordsBox.map(x => x[2]));
  wordBoxUnion[3] = Math.max(...wordsBox.map(x => x[3]));

  // All words are assumed to be on the same line
  const linebox = words[0].line.bbox;
  const baseline = words[0].line.baseline;

  let angleAdjXLine = 0;
  let angleAdjYLine = 0;
  if (Math.abs(globalThis.pageMetricsObj.angleAll[n] ?? 0) > 0.05) {

    const x = linebox[0];
    const y = linebox[3] + baseline[1];

    const xRot = x * cosAngle - sinAngle * y;
    const yRot = x * sinAngle + cosAngle * y;

    const angleAdjXInt = x - xRot;

    const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

    angleAdjXLine = angleAdjXInt + shiftX;
    angleAdjYLine = angleAdjYInt + shiftY;

  }

  const angleAdjXWord = Math.abs(globalThis.pageMetricsObj.angleAll[n]) >= 1 ? angleAdjXLine + (1 - cosAngle) * (wordBoxUnion[0] - linebox[0]) : angleAdjXLine;

  // If provided, we crop to the dimensions of the font (fontAsc and fontDesc) rather than the image bounding box.
  const height =  fontAsc && fontDesc ? fontAsc + fontDesc : wordBoxUnion[3] - wordBoxUnion[1] + 1;
  const cropY = fontAsc ? linebox[3] + baseline[1] - fontAsc + angleAdjYLine-1 : linebox[1];

  const imgElem = await globalThis.imageAll["binary"][n];
  const img = new fabric.Image(imgElem, {left: 0, top: 0, cropX: wordBoxUnion[0]+angleAdjXWord-1, cropY: cropY, width: wordBoxUnion[2] - wordBoxUnion[0] + 1, height: height});

  globalThis.canvasAlt.setHeight(img.height);
  globalThis.canvasAlt.setWidth(img.width);

  canvasAlt.add(img);
  canvasAlt.renderAll();

  if (view) {
    globalThis.canvasComp0.setHeight(img.height);
    globalThis.canvasComp0.setWidth(img.width);
    globalThis.canvasComp1.setHeight(img.height);
    globalThis.canvasComp1.setWidth(img.width);
    globalThis.canvasComp2.setHeight(img.height);
    globalThis.canvasComp2.setWidth(img.width);

    canvasComp0.add(img);
    canvasComp1.add(img);
    canvasComp2.add(img);
  }

  return;

}
  
/**
 * @param {ocrWord} word
 * @param {number} offsetX
 * @param {number} lineFontSize
 * @param {?string} altText
 */
let drawWordRender = async function(word, offsetX = 0, lineFontSize = 0, altText = null, debugCanvas = null){

  lineFontSize = lineFontSize || (await ocr.calcLineFontSize(word.line)) || 10;

  const wordText = altText ? ocr.replaceLigatures(altText) : ocr.replaceLigatures(word.text);

  const wordFontSize = (await ocr.calcWordFontSize(word)) || lineFontSize;

  if(!wordFontSize){
    console.log("Font size not found");
    return;
  }

  const wordFontFamily = word.font || globalSettings.defaultFont;

  if (word.style == "small-caps") {
    ctx.font = 1000 + 'px ' + wordFontFamily + " Small Caps";
  } else {
    ctx.font = word.style + " " + 1000 + 'px ' + wordFontFamily;
  }

  const oMetrics = ctx.measureText("o");

  if (word.style == "small-caps") {
    ctx.font = wordFontSize + 'px ' + wordFontFamily + " Small Caps";
  } else {
    ctx.font = word.style + " " + wordFontSize + 'px ' + wordFontFamily;
  }


  const fontObjI = await globalThis.fontObj[wordFontFamily][word.style];

  // Calculate font glyph metrics for precise positioning
  const wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  const wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontObjI.unitsPerEm);
  const wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (wordFontSize / fontObjI.unitsPerEm);

  const wordWidth1 = ctx.measureText(wordText).width;
  const wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing;

  const boxWidth = word.bbox[2] - word.bbox[0];

  const kerning = wordText.length > 1 ? round3((boxWidth - wordWidth) / (wordText.length - 1)) : 0;

  const fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));
  const fontBoundingBoxAscent = Math.round(Math.abs(fontObjI.ascender) * (1000 / fontObjI.unitsPerEm));

  const fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  const fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  let top;
  if (word.sup) {
    let fontDescWord = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (wordFontSize / 1000);

    const wordboxXMid = word.bbox[0] + (word.bbox[2] - word.bbox[0]) / 2;

    const baselineY = word.line.bbox[3] + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox[0]);

    top = fontDesc + fontAsc + 1 - (baselineY - word.bbox[3]) - (fontDesc - fontDescWord);  
  
  } else {
    top = fontDesc + fontAsc + 1;  
  }

  const left = 0 - wordLeftBearing + offsetX;

  let wordFontFamilyCanvas = word.style == "small-caps" ? wordFontFamily + " Small Caps" : wordFontFamily;
  let fontStyleCanvas = word.style == "small-caps" ? "normal" : word.style;

  let textbox = new fabric.IText(wordText, {
    left: 0,
    top: 0,
    fill: "black",
    fontFamily: wordFontFamilyCanvas,
    fontStyle: fontStyleCanvas,
    charSpacing: kerning * 1000 / wordFontSize,
    fontSize: wordFontSize
  });

  // Set background color to white so that blank pixels are "255" in both versions
  canvasAlt.setBackgroundColor("white");

    await textbox.cloneAsImage(image => {
    image.set({left: left,top:top,originY:"bottom"});

    canvasAlt.add(image);
    canvasAlt.renderAll();
  });

  if (debugCanvas) {
    textbox.set({fill: "red"});
    await textbox.cloneAsImage(image => {
      image.set({left: left,top:top,originY:"bottom"});
  
      debugCanvas.add(image);
      debugCanvas.renderAll();
    });
  }


}
  
/**
 * @param {Array<ocrWord>} wordsA
 * @param {Array<ocrWord>} wordsB
 * @param {number} n
 * @param {boolean} view
 */
export async function evalWords(wordsA, wordsB, n, view = false){

  const cosAngle = Math.cos(globalThis.pageMetricsObj.angleAll[n] * -1 * (Math.PI / 180)) || 1;
  const sinAngle = Math.sin(globalThis.pageMetricsObj.angleAll[n] * -1 * (Math.PI / 180)) || 0;

  const lineFontSize = await ocr.calcLineFontSize(wordsA[0].line);

  if (!lineFontSize) return [1,1];

  const wordsABox = wordsA.map(x => x.bbox);
  const wordsBBox = wordsB.map(x => x.bbox);

  const wordsAllBox = [...wordsABox,...wordsBBox];

  // Union of all bounding boxes
  let wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsAllBox.map(x => x[0]));
  wordBoxUnion[1] = Math.min(...wordsAllBox.map(x => x[1]));
  wordBoxUnion[2] = Math.max(...wordsAllBox.map(x => x[2]));
  wordBoxUnion[3] = Math.max(...wordsAllBox.map(x => x[3]));
  
  // All words are assumed to be on the same line
  const linebox = wordsA[0].line.bbox;
  const baseline = wordsA[0].line.baseline;

  canvasAlt.clear();

  if (view) {
    // document.getElementById("e").setAttribute("style", "");
    // document.getElementById("f").setAttribute("style", "");
    canvasComp0.clear();
    canvasComp1.clear();
    canvasComp2.clear();
  }

  // Draw the actual words (from the user-provided image)
  await drawWordActual([...wordsA, ...wordsB], true);

  const imageDataActual = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  canvasAlt.clear();

  let debugCanvas = view ? canvasComp1 : null;

  // Draw the words in wordsA
  let x0;
  let y0;
  for (let i=0;i<wordsA.length;i++) {
    const word = wordsA[i];
    const wordIBox = word.bbox;
    const baselineY = linebox[3] + baseline[1] + baseline[0] * (wordIBox[0] - linebox[0]);
    if (i == 0) {
      x0 = wordIBox[0];
      y0 = baselineY;
    } 
    const x = wordIBox[0];
    const y = word.sup || word.dropcap ? wordIBox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, lineFontSize, null, debugCanvas);
  }

  const imageDataExpectedA = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  canvasAlt.clear();

  debugCanvas = view ? canvasComp2 : null;

  // Draw the words in wordsB
  for (let i=0;i<wordsB.length;i++) {

    // Clone object so editing does not impact the original
    const word = ocr.cloneWord(wordsB[i]);

    // Set style to whatever it is for wordsA.  This is based on the assumption that "A" is Tesseract Legacy and "B" is Tesseract LSTM (which does not have useful style info).
    word.style = wordsA[0].style

    const baselineY = linebox[3] + baseline[1] + baseline[0] * (word.bbox[0] - linebox[0]);
    if (i == 0) {
      x0 = word.bbox[0];
      y0 = baselineY;
    } 
    const x = word.bbox[0];
    const y = word.sup || word.dropcap ? word.bbox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, lineFontSize, null, debugCanvas);
  }

  const imageDataExpectedB = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  canvasAlt.clear();

  if (imageDataActual.length != imageDataExpectedA.length) {
    console.log("Actual and expected images are different sizes");
    debugger;
  }

  let diffA = 0;
  let totalA = 0;
  for(let i=0; i<imageDataActual.length; i++){
    if(imageDataActual[i] != 255 || imageDataExpectedA[i] != 255){
      totalA = totalA + 1;
      if(imageDataActual[i] == 255 || imageDataExpectedA[i] == 255) {
        diffA = diffA + 1;
      }  
    }
  }

  let diffB = 0;
  let totalB = 0;
  for(let i=0; i<imageDataActual.length; i++){
    if(imageDataActual[i] != 255 || imageDataExpectedB[i] != 255){
      totalB = totalB + 1;
      if(imageDataActual[i] == 255 || imageDataExpectedB[i] == 255) {
        diffB = diffB + 1;
      }  
    }
  }

  return [diffA/totalA, diffB/totalB];

}
    
/**
 * Calculate penalty for word using ad-hoc heuristics.
 * Supplements word overlap strategy by penalizing patterns that may have plausible overlap
 * but are implausible from a language perspective (e.g. "1%" being misidentified as "l%")
 * @param {string} wordStr
 */
function penalizeWord(wordStr) {
  let penalty = 0;
  // Penalize non-numbers followed by "%"
  // This potentially penalizes valid URLs
  if (/[^0-9]%/.test(wordStr)) penalty += 0.05;

  // Penalize "ii" (virtually always a false positive)
  // If this penalty becomes an issue, a whitelist of dictionary words containing "ii" can be added
  if (/ii/.test(wordStr)) penalty += 0.05;

  // Penalize digit between two letters
  // This usually indicates a letter is being misidentified as "0" or "1"
  if (/[a-z]\d[a-z]/i.test(wordStr)) penalty += 0.05;

  // Penalize "]" at the start of word (followed by at least one other character)
  // Motivated by "J" being misidentified as "]"
  // (Overlap can be fairly strong of no actual "]" characters are present due to font optimization)
  if (/^\]./.test(wordStr)) penalty += 0.05;

  return penalty;
}


// Returns the proportion of boxA's area contained in boxB
export function calcOverlap(boxA, boxB) {
  const left = Math.max(boxA[0], boxB[0]);
  const top = Math.max(boxA[1], boxB[1]);
  const right = Math.min(boxA[2], boxB[2]);
  const bottom = Math.min(boxA[3], boxB[3]);

  const width = right - left;
  const height = bottom - top;

  if (width < 0 || height < 0) return 0;

  const areaA = (boxA[3] - boxA[1]) * (boxA[2] - boxA[0]);
  // const areaB = (boxB[3] - boxB[1]) * (boxB[2] - boxB[0]);
  const area = width * height;
  
  return area / areaA;
}

/**
 * @param {ocrPage} page
 * @param {boolean} applyExclude
 * @param {boolean} editInPlace
 */
export function reorderHOCR(page, layoutObj, applyExclude = true, editInPlace = false) {

  const pageInt = editInPlace ? page : structuredClone(page);

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return pageInt;

  const hocrALines = pageInt.lines;
  const linesNew = [];

  const priorityArr = Array(hocrALines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  priorityArr.fill(10);

  for (let i = 0; i < hocrALines.length; i++) {
    const hocrALine = hocrALines[i];
    const lineBoxA = hocrALine.bbox;

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineBoxA, obj["coords"]);
      if (overlap > 0.5) {
        if (obj["type"] == "order") {
          priorityArr[i] = obj["priority"];
        } else if (obj["type"] == "exclude" && applyExclude) {
          // Priority "11" is used to remove lines
          priorityArr[i] = 11;
        }
      } 
    }
  }

  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j < priorityArr.length; j++) {
      if (priorityArr[j] == i) {
        linesNew.push(hocrALines[j]);
      }
    }
  }

  pageInt.lines = linesNew;

  return pageInt;

}


export function getExcludedText() {

  for (let i=0; i<=globalThis.hocrCurrent.length; i++){
    const textArr = getExcludedTextPage(globalThis.hocrCurrent[i], globalThis.layout[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(x + " [Page " + String(i) + "]"));
    }
  }

}

// Get array of text that will be excluded from exports due to "exclude" layout boxes. 
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point. 

/**
 * @param {ocrPage} pageA
 */
export function getExcludedTextPage(pageA, layoutObj, applyExclude = true) {

  const excludedArr = [];

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return excludedArr;

  const priorityArr = Array(pageA.lines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  priorityArr.fill(10);

  for (let i = 0; i < pageA.lines.length; i++) {
    const lineA = pageA.lines[i];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineA.bbox, obj["coords"]);
      if (overlap > 0.5) {
        if (obj["type"] == "order") {
          priorityArr[i] = obj["priority"];
        } else if (obj["type"] == "exclude" && applyExclude) {
          const words = lineA.words;
          let text = "";
          for (let i=0; i<words.length; i++) {
            text += words[i].text + " ";
          }
          excludedArr.push(text)
        }
      } 
    }
  }

  return excludedArr;

}

/**
 * Checks words in pageA against words in pageB.  Edits `compTruth` and `matchTruth` attributes of words in `pageA` in place
 * and returns additional data depending on `mode`.
 * @param {ocrPage} pageA
 * @param {ocrPage} pageB
 * @param {string} mode - If `mode = 'stats'` stats quantifying the number of matches/mismatches are returned.
 *    If `mode = 'comb'` a new version of `pageA`, with text and confidence metrics informed by comparisons with pageB, is created. 
 * @param {string} debugLabel
 */
export async function compareHOCR(pageA, pageB, mode = "stats", debugLabel = "", supplementComp = false) {

  const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
  const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

  const confThreshHigh = parseInt(confThreshHighElem.value) || 85;
  const confThreshMed = parseInt(confThreshMedElem.value) || 75;

  const n = pageA.n;

  if (debugLabel && !globalThis.debugLog) globalThis.debugLog = "";
  if (debugLabel) globalThis.debugLog += "Comparing page " + String(n) + "\n";

  const hocrAOverlap = {};
  const hocrBOverlap = {};
  const hocrBOverlapAWords = {};
  const hocrACorrect = {};
  const hocrBCorrect = {};

  // Reset all comparison-related fields in input page
  ocr.getPageWords(pageA).map((x) => {
    x.compTruth = false;
    x.matchTruth = false;
  });

  // Create copy of `pageA` so original is not edited
  const pageAInt = structuredClone(pageA);

  // Reset conf in cloned page only
  ocr.getPageWords(pageAInt).map((x) => {
    x.conf = 0;
  });

  // TODO: This assumes that the lines are in a specific order, which may not always be the case. 
  //    Add a sorting step or otherwise make more robust.
  // TODO: Does this need to consider rotation?  It does not do so at present. 
  for (let i = 0; i < pageAInt.lines.length; i++) {
    const lineA = pageAInt.lines[i];
    const lineBoxA = lineA.bbox;

    for (let j = 0; j < pageB.lines.length; j++) {
      const lineB = pageB.lines[j];
      const lineBoxB = lineB.bbox;

      // If top of line A is below bottom of line B, move to next line B
      if (lineBoxA[1] > lineBoxB[3]) {
        //minLineB = minLineB + 1;
        continue;

        // If top of line B is below bottom of line A, move to next line A
        // (We assume no match is possible for any B)
      } else if (lineBoxB[1] > lineBoxA[3]) {
        continue;

        // Otherwise, there is possible overlap
      } else {

        let minWordB = 0;

        for (let k = 0; k < lineA.words.length; k++) {
          const wordA = lineA.words[k];

          // TODO: Despite the comment, this code does not actually return early.
          //    Consider how to best handle this situation--if we just add a "continue" statement
          //    some of the stats may not add up.
          // If option is set to ignore punctuation and the current "word" conly contains punctuation,
          // exit early with options that will result in the word being printed in green.
          if (ignorePunctElem.checked && !wordA.text.replace(/[\W_]/g, "")) {
            const wordAOrig = ocr.getPageWord(pageA, wordA.id);
            wordAOrig.compTruth = true;
            wordAOrig.matchTruth = true;

            wordA.compTruth = true;
            wordA.matchTruth = true;
            wordA.conf = 100;
            hocrACorrect[wordA.id] = 1;
          }

          const wordBoxA = wordA.bbox;

          // Remove 10% from all sides of bounding box
          // This prevents small overlapping (around the edges) from triggering a comparison
          const wordBoxAWidth = wordBoxA[2] - wordBoxA[0];
          const wordBoxAHeight = wordBoxA[3] - wordBoxA[1];

          const wordBoxACore = JSON.parse(JSON.stringify(wordBoxA));

          wordBoxACore[0] = wordBoxA[0] + Math.round(wordBoxAWidth * 0.1);
          wordBoxACore[2] = wordBoxA[2] - Math.round(wordBoxAWidth * 0.1);

          wordBoxACore[1] = wordBoxA[1] + Math.round(wordBoxAHeight * 0.1);
          wordBoxACore[3] = wordBoxA[3] - Math.round(wordBoxAHeight * 0.1);


          for (let l = minWordB; l < lineB.words.length; l++) {

            const wordB = lineB.words[l];
            const wordBoxB = wordB.bbox;

            // Remove 10% from all sides of ground truth bounding box
            // This prevents small overlapping (around the edges) from triggering a comparison
            const wordBoxBWidth = wordBoxB[2] - wordBoxB[0];
            const wordBoxBHeight = wordBoxB[3] - wordBoxB[1];

            const wordBoxBCore = JSON.parse(JSON.stringify(wordBoxB));

            wordBoxBCore[0] = wordBoxB[0] + Math.round(wordBoxBWidth * 0.1);
            wordBoxBCore[2] = wordBoxB[2] - Math.round(wordBoxBWidth * 0.1);

            wordBoxBCore[1] = wordBoxB[1] + Math.round(wordBoxBHeight * 0.1);
            wordBoxBCore[3] = wordBoxB[3] - Math.round(wordBoxBHeight * 0.1);

            // If left of word A is past right of word B, move to next word B
            if (wordBoxACore[0] > wordBoxBCore[2]) {
              minWordB = minWordB + 1;
              continue;

              // If left of word B is past right of word A, move to next word A
              // (We assume no match is possible for any B)
            } else if (wordBoxBCore[0] > wordBoxACore[2]) {
              break;

              // Otherwise, overlap is likely
            } else {
              // Check for overlap using word height
              if (wordBoxACore[1] > wordBoxBCore[3] || wordBoxBCore[1] > wordBoxACore[3]) {
                continue;
              }

              // Mark `wordA` as having been compared
              wordA.compTruth = true;

              let wordTextA = ocr.replaceLigatures(wordA.text);
              let wordTextB = ocr.replaceLigatures(wordB.text);
              if (ignorePunctElem.checked) {
                // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
                // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
                wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
                wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
              }
              if (ignoreCapElem.checked) {
                wordTextA = wordTextA.toLowerCase();
                wordTextB = wordTextB.toLowerCase();
              }

              hocrAOverlap[wordA.id] = 1;
              hocrBOverlap[wordB.id] = 1;

              if (!hocrBOverlapAWords[wordB.id]) hocrBOverlapAWords[wordB.id] = {};
              hocrBOverlapAWords[wordB.id][wordA.id] = 1;

              // TODO: Account for cases without 1-to-1 mapping between bounding boxes
              if (wordTextA == wordTextB) {
                const wordAOrig = ocr.getPageWord(pageA, wordA.id);
                wordAOrig.compTruth = true;
                wordAOrig.matchTruth = true;    

                wordA.compTruth = true;
                wordA.matchTruth = true;
                wordA.conf = 100;
                hocrACorrect[wordA.id] = 1;
                hocrBCorrect[wordB.id] = 1;

              } else {

                if(mode == "comb") {

                  wordA.conf = 0;
                  wordA.matchTruth = false;

                  // Check if there is a 1-to-1 comparison between words (this is usually true)
                  const oneToOne = Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxA[2]) < (wordBoxA[2] - wordBoxA[0]) * 0.1;
                
                  let twoToOne = false;
                  let wordsAArr = [];
                  let wordsBArr = [];

                  // If there is no 1-to-1 comparison, check if a 2-to-1 comparison is possible using the next word in either dataset
                  if(!oneToOne){
                    if(wordBoxA[2] < wordBoxB[2]) {
                      const wordANext = lineA.words[k+1];
                      if(wordANext) {
            
                        const wordBoxANext = wordANext.bbox;
                        if(Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxANext[2]) < (wordBoxANext[2] - wordBoxA[0]) * 0.1) {
                          twoToOne = true;
                          wordsAArr.push(wordA);
                          wordsAArr.push(wordANext);
                          wordsBArr.push(wordB);

                          wordANext.conf = 0;
                          wordANext.compTruth = true;
                          wordANext.matchTruth = false;
        
                        }
                      }
                    } else {
                      const wordBNext = lineB.words[l+1];
                      if(wordBNext) {
                        const wordBoxBNext = wordBNext.bbox;
                        if(Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxA[2] - wordBoxBNext[2]) < (wordBoxBNext[2] - wordBoxA[0]) * 0.1) {
                          twoToOne = true;
                          wordsAArr.push(wordA);
                          wordsBArr.push(wordB);
                          wordsBArr.push(wordBNext);
                        }
                      }
                    }
                  }

                
                  // Only consider switching word contents if their bounding boxes are close together
                  // This should filter off cases where 2+ words in one dataset match to 1 word in another
                  // TODO: Account for cases without 1-to-1 mapping between bounding boxes
                  if(!oneToOne && !twoToOne) {
                    if (debugLabel) globalThis.debugLog += "Skipping words due to low overlap: " + wordTextA + " [Legacy] " + wordTextB + " [LSTM]\n";
                    continue;
                  };

                  const replaceItalic = false;

                  // Automatically reject words that contain a number between two letters.
                  // Tesseract Legacy commonly identifies letters as numbers (usually 1).
                  // This does not just happen with "l"--in test documents "r" and "i" were also misidentified as "1" multiple times. 
                  const replaceNum = /[a-z]\d[a-z]/i.test(wordA.text);

                  // Automatically reject words where "ii" is between two non-"i" letters
                  // Tesseract Legacy commonly recognizes "ii" when the (actual) letter contains an accent, 
                  // while Tesseract LSTM usually recognizes the correct letter, sans the accent. 
                  // This "ii" pattern is automatically discarded, regardless of the overlap metrics, 
                  // because the overlap metrics often fail in this case. 
                  // E.g. the letter "ö" (o with umlaut) may overlap better with "ii" than "o". 
                  const replaceII = /[a-hj-z]ii[a-hj-z]/i.test(wordA.text);

                  let replaceMetrics = false;

                  let hocrAError = 0;
                  let hocrBError = 0;

                  if(oneToOne) {
                    // TODO: Figure out how to compare between small caps/non small-caps words (this is the only relevant style as it is the only style LSTM detects)
                    
                    // Clone hocrAWord and set text content equal to hocrBWord
                    const wordAClone = ocr.cloneWord(wordA);
                    wordAClone.text = wordB.text;
              
                    const hocrError = await evalWords([wordA], [wordAClone], n, Boolean(debugLabel));
              
                    hocrAError = hocrError[0] + penalizeWord(wordA.text);
                    hocrBError = hocrError[1] + penalizeWord(wordB.text);

                    // Apply ad-hoc penalties
                    hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                    if(debugLabel) {

                      const debugObj = {
                        // Raw image
                        imageRaw: globalThis.canvasComp0.toDataURL(),
                        // Image + OCR "A" overlay
                        imageA: globalThis.canvasComp1.toDataURL(),
                        // Image + OCR "B" overlay
                        imageB: globalThis.canvasComp2.toDataURL(),
                        // Raw (pixel overlap) error metric "A"
                        errorRawA: hocrError[0],
                        // Raw (pixel overlap) error metric "B"
                        errorRawB: hocrError[1],
                        // Adjusted (pixel overlap + ad-hoc penalties) error metric "A"
                        errorAdjA: hocrAError,
                        // Adjusted (pixel overlap + ad-hoc penalties) error metric "B"
                        errorAdjB: hocrBError,
                        // OCR text "A"
                        textA: wordA.text,
                        // OCR text "B"
                        textB: wordB.text
                      }

                      globalThis.debugImg[debugLabel][n].push(debugObj);

                      globalThis.debugLog += "Legacy Word: " + wordA.text + " [Error: " + String(hocrAError) + "]\n";
                      globalThis.debugLog += "LSTM Word: " + wordB.text + " [Error: " + String(hocrBError) + "]\n";  
                    }
                  } else if (twoToOne) {

                    // const hocrError = [0.1,0.1];
                    const hocrError = await evalWords(wordsAArr, wordsBArr, n, Boolean(debugLabel));

                    const wordsAText = wordsAArr.map((x) => x.text).join("");
                    const wordsBText =  wordsBArr.map((x) => x.text).join("");

                    // The option with more words has a small penalty added, as otherwise words incorrectly split will often score slightly better (due to more precise positioning)
                    hocrAError = hocrError[0] + (wordsAArr.length - 1) * 0.025 + penalizeWord(wordsAText);
                    hocrBError = hocrError[1] + (wordsBArr.length - 1) * 0.025 + penalizeWord(wordsBText);

                    // An additional penalty is added to the option with more words when (1) the text is the same in both options and (2) at least one word has no letters.
                    // This has 2 primary motivations:
                    //  1. Tesseract Legacy often splits numbers into separate words.  
                    //    For example, the "-" in a negative number may be a different word, or the digits before and after the decimal point may be split into separate words.
                    //    TODO: It may be worth investigating if this issue can be improved in the engine. 
                    //  1. Punctuation characters should not be their own word (e.g. quotes should come before/after alphanumeric characters)
                    if (wordsAText == wordsBText) {
                      if (wordsAArr.map((x) => /[a-z]/i.test(x.text)).filter((x) => !x).length > 0 || wordsBArr.map((x) => /[a-z]/i.test(x.text)).filter((x) => !x).length > 0) {
                        hocrAError = hocrAError + (wordsAArr.length - 1) * 0.05;
                        hocrBError = hocrBError + (wordsBArr.length - 1) * 0.05;    
                      }
                    }

                    // Apply ad-hoc penalties
                    hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                    if(debugLabel) {

                      const debugObj = {
                        // Raw image
                        imageRaw: globalThis.canvasComp0.toDataURL(),
                        // Image + OCR "A" overlay
                        imageA: globalThis.canvasComp1.toDataURL(),
                        // Image + OCR "B" overlay
                        imageB: globalThis.canvasComp2.toDataURL(),
                        // Raw (pixel overlap) error metric "A"
                        errorRawA: hocrError[0],
                        // Raw (pixel overlap) error metric "B"
                        errorRawB: hocrError[1],
                        // Adjusted (pixel overlap + ad-hoc penalties) error metric "A"
                        errorAdjA: hocrAError,
                        // Adjusted (pixel overlap + ad-hoc penalties) error metric "B"
                        errorAdjB: hocrBError,
                        // OCR text "A"
                        textA: wordsAArr.map((x) => x.text).join(" "),
                        // OCR text "B"
                        textB: wordsBArr.map((x) => x.text).join(" ")
                      }

                      globalThis.debugImg[debugLabel][n].push(debugObj);

                      globalThis.debugLog += "Legacy Word: " + wordsAArr.map((x) => x.text).join(" ") + " [Error: " + String(hocrAError) + "]\n";
                      globalThis.debugLog += "LSTM Word: " + wordsBArr.map((x) => x.text).join(" ") + " [Error: " + String(hocrBError) + "]\n";
                    }
  
                  }
                              
                  if(hocrBError < hocrAError) {
                    const skip = ["eg","ie"].includes(wordA.text.replace(/\W/g,""));
                    if (skip) globalThis.debugLog += "Skipping word replacement\n";

                    if(!skip){
                      if(oneToOne){
                        globalThis.debugLog += "Replacing word " + wordA.text + " with word " + wordB.text + "\n";
                        wordA.text = wordB.text;


                        // Switch to small caps/non-small caps based on style of replacement word. 
                        // This is not relevant for italics as the LSTM engine does not detect italics. 
                        if(wordB.style === "small-caps" && wordA.style !== "small-caps") {
                          wordA.style = "small-caps";
                        } else if (wordB.style !== "small-caps" && wordA.style === "small-caps") {
                          wordA.style = "normal";
                        }

                      } else {
                        const wordsBArrRep = wordsBArr.map((x) => ocr.cloneWord(x));

                        // const styleStrWordA = hocrAWord.getAttribute('style');

                        for(let i=0;i<wordsBArrRep.length;i++) {

                          // Use style from word A (assumed to be Tesseract Legacy)
                          wordsBArrRep[i].style = wordA.style;

                          // Set confidence to 0
                          wordsBArrRep[i].conf = 0;

                          wordsBArrRep[i].compTruth = true;
                          wordsBArrRep[i].matchTruth = false;

                          // Change ID to prevent duplicates
                          wordsBArrRep[i].id = wordsBArrRep[i].id + "b";

                        }

                        // Replace "A" words with "B" words
                        lineA.words.splice(k, wordsAArr.length, ...wordsBArrRep);

                        k = k + wordsBArrRep.length - 1;

                        // Move to next hocrAWord
                        break;
                      }
                      
                    }
                    
                  }
                }
              }
            }
          }
        }
      }
    }
  }


  // If `supplementComp` is enabled, we run OCR for any words in pageA without an existing comparison in pageB.
  // This ensures that every word has been checked.
  // Unlike the comparisons above, this is strictly for confidence purposes--if conflicts are identified the text is not edited.
  if (supplementComp) {
    for (let i = 0; i < pageAInt.lines.length; i++) {
      const line = pageAInt.lines[i];
      for (let j = 0; j < line.words.length; j++) {
        const word = line.words[j];
        if (!word.compTruth) {
          word.matchTruth = await checkWords([word], false);
          word.conf = word.matchTruth ? 100 : 0;
        }
      }
    }
  }

  // In addition to not making sense, the statistics below will not be properly calculated when `mode == "comb"` and errors will be thrown if attempted.
  // The core issue is that pageAInt is being actively edited `mode == "comb"`.
  // Therefore, `hocrAOverlap` ends up including words not in `pageA`, so `ocr.getPageWord(pageA, overlappingWordsA[i]);` returns `null`.
  if (mode == "comb") return ([pageAInt, {}]);


  // Note: These metrics leave open the door for some fringe edge cases.
  // For example,

  // Number of words in ground truth
  const totalCountB = ocr.getPageWords(pageB).length;

  // Number of words in candidate OCR
  const totalCountA = ocr.getPageWords(pageAInt).length;

  // Number of words in ground truth with any overlap with candidate OCR
  const overlapCountB = Object.keys(hocrBOverlap).length;

  // Number of words in candidate OCR with any overlap with ground truth
  const overlapCountA = Object.keys(hocrAOverlap).length;

  // Number of words in ground truth correctly identified by 1+ overlapping word in candidate OCR
  const correctCount = Object.keys(hocrBCorrect).length;

  // Number of words in ground truth not identified by 1+ overlapping word in candidate OCR
  const incorrectCount = overlapCountB - correctCount;


  let correctCountLowConf = 0;
  let incorrectCountHighConf = 0;
  const overlappingWordsB = Object.keys(hocrBOverlap);
  for (let i=0; i<overlappingWordsB.length; i++) {
    const wordBID = overlappingWordsB[i];


    const wordAIDs = Object.keys(hocrBOverlapAWords[wordBID]);


    let lowConfCount = 0;
    let highConfCount = 0;
    for (let j=0; j<wordAIDs.length; j++) {
      // The word comes from the original input (pageA) since we need unedited confidence metrics.
      const word = ocr.getPageWord(pageA, wordAIDs[j]);
      if (word.conf <= confThreshMed) {
        lowConfCount++;
      } else if (word.conf > confThreshHigh) {
        highConfCount++;
      }
    }

    const match = hocrBCorrect[wordBID];

    if (match && lowConfCount > 0) {
      correctCountLowConf++;
    } else if (!match && highConfCount > 0) {
      incorrectCountHighConf++
    }

  }

  const metricsRet = {
    total: totalCountB,
    correct: correctCount,
    incorrect: incorrectCount,
    missed: totalCountB - overlapCountB,
    extra: totalCountA - overlapCountA,
    correctLowConf: correctCountLowConf,
    incorrectHighConf: incorrectCountHighConf
  }
  
  return ([pageAInt, metricsRet]);
}



/**
 * Adds lines from a new page to an existing page.
 * Based on overlap between bounding boxes, lines may be added or combined with existing lines.
 * @param {ocrPage} pageA - New page
 * @param {ocrPage} pageB - Existing page
 * @param {boolean} replaceFontSize - Whether font size stats in the new line(s) should be replaced by font size in previous line.
 *  This option is used when the user manually adds a word, as the manually-drawn box will only roughly correspond to font size.
 */
export function combineData(pageA, pageB, replaceFontSize = false) {

  const linesNew = pageA.lines;
	const lines = pageB.lines;

	for (let i = 0; i < linesNew.length; i++) {
		const lineNew = linesNew[i];

    if (lineNew.words.length == 0) continue;

    const lineNewRot = ocr.cloneLine(lineNew);
    ocr.rotateLine(lineNewRot, globalThis.pageMetricsObj["angleAll"][currentPage.n] * -1, globalThis.pageMetricsObj["dimsAll"][currentPage.n]);



		// const sinAngle = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180));
    // const cosAngle = Math.cos(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180));

		// Identify the OCR line a bounding box is in (or closest line if no match exists)
    // (1) If the new line's bounding box has significant overlap with an existing line's bounding box, add to that line.
    // (2) If the new line's bounding box has vertical overlap with 1+ existing line's bounding box, add to the closest such line.
    // (3) Otherwise, create a new line.
		let lineI = -1;

    let match;
    let matchXOverlap = 0;
    let matchXDist = 1e6;

    let closestI = 0;
    let closestMetric = 1e6;
    let afterClosest = true;
    let yDistMin = 1e6;

		for (lineI=0; lineI<lines.length; lineI++) {
			const line = lines[lineI];

      if (line.words.length == 0) continue;

      const lineRot = ocr.cloneLine(line);
      ocr.rotateLine(lineRot, globalThis.pageMetricsObj["angleAll"][currentPage.n] * -1, globalThis.pageMetricsObj["dimsAll"][currentPage.n]);

      const left = Math.max(lineRot.bbox[0], lineNewRot.bbox[0]);
      const top = Math.max(lineRot.bbox[1], lineNewRot.bbox[1]);
      const right = Math.min(lineRot.bbox[2], lineNewRot.bbox[2]);
      const bottom = Math.min(lineRot.bbox[3], lineNewRot.bbox[3]);
    
      const width = right - left;
      const height = bottom - top;

      const yOverlap = height < 0 ? 0 : height / (lineNewRot.bbox[3] - lineNewRot.bbox[1]);

      // A majority of the new line must fall within the existing line to be considered a match
      if (yOverlap >= 0.5) {

        const xOverlap = width < 0 ? 0 : width / (lineNewRot.bbox[2] - lineNewRot.bbox[0]);
        // If the lines overlap more horizontally than any previous comparison, make this line the new working hypothesis
        if (xOverlap > matchXOverlap) {
          matchXOverlap = xOverlap;
          match = line;
        // If this line has no horizontal overlap, but no other line has either, then we check the distance to the nearest line
        } else if (xOverlap == 0 && matchXOverlap == 0) {
          const xDist = Math.min(Math.abs(lineRot.bbox[2] - lineNewRot.bbox[0]), Math.abs(lineRot.bbox[0] - lineNewRot.bbox[2]));
          // If this is the closest line (so far), make this line the new working hypothesis
          if (xDist < matchXDist) {
            matchXDist = xDist;
            match = line;
          }
        }
      // If no match has been identified, the closest non-matching line needs to be identified.
      // This allows the new line to be inserted at a location that makes sense.
      } else if (!match) {

        // An ad-hoc distance metric is used, as the standard geometric distance would likely produce worse results for multi-column layouts.
        // xDist is 0 when there is overlap between x coordinates, and otherwise equal to the distance between the x coordinates. 
        // yDist is calculated similarly, however is weighted 3x more.  The sum of xMetric and yMetric represents the total distance/penalty.
        const xOverlap = width < 0 ? 0 : width / (lineNewRot.bbox[2] - lineNewRot.bbox[0]);
        const xDist = xOverlap > 0 ? 0 : Math.min(Math.abs(lineRot.bbox[2] - lineNewRot.bbox[0]), Math.abs(lineRot.bbox[0] - lineNewRot.bbox[2]));
        const yDist = yOverlap > 0 ? 0 : Math.min(Math.abs(lineRot.bbox[3] - lineNewRot.bbox[1]), Math.abs(lineRot.bbox[1] - lineNewRot.bbox[3]));

        if (yDist < yDistMin) yDistMin = yDist;

        const totalMetric = xDist + yDist * 3;
        if (totalMetric < closestMetric) {
          closestMetric = totalMetric;
          closestI = lineI;
          afterClosest = lineNewRot[3] > lineRot[3];
        }
      }
		}

    // The selected match is rejected (and assumed to be in another column) if
    // (1) the horizontal gap between matched lines >5% the width of the entire page and
    // (2) the horizontal gap between matched lines is >2x the vertical gap to the nearest preceding/following line.
    // This is intended to eliminate cases when new words are inserted into the wrong column and/or floating element
    // (possibly on the other side of the page) just because vertical overlap exists.
    if (match && matchXOverlap == 0 && matchXDist > 2 * yDistMin && pageB.dims[1] * 0.05 < matchXDist) match = undefined;


		const wordsNew = lineNew.words;

		if (match) {

      const words = match.words;

			for (let i = 0; i < wordsNew.length; i++) {
				let wordNew = wordsNew[i];
				const wordBoxNew = wordNew.bbox;

				// Identify closest word on existing line
				let word, wordBox, wordIndex;
				let j = 0;
				do {
					wordIndex = j;
					word = words[j];
					wordBox = word.bbox;
					j = j + 1;
				} while (wordBox[2] < wordBoxNew[0] && j < words.length);

				// Replace id (which is likely duplicative) with unique id
				wordNew.id = word.id + getRandomAlphanum(3);

				// Add to page data
				// Note: Words will appear correctly on the canvas (and in the pdf) regardless of whether they are in the right order.
				// However, it is still important to get the order correct (this makes evaluation easier, improves copy/paste functionality in some pdf readers, etc.)
				if (wordBoxNew[0] > wordBox[0]) {
					words.splice(wordIndex+1, 0, wordNew);
				} else {
					words.splice(wordIndex, 0, wordNew);
				}
			}

      // Recalculate bounding box for line
      ocr.calcLineBbox(match);

		} else {

			for (let i = 0; i < wordsNew.length; i++) {
				const wordNew = wordsNew[i];

				// Replace id (which is likely duplicative) with unique id
				wordNew.id = wordNew.id + getRandomAlphanum(3);
			}

      if (replaceFontSize) {

        // If this is the first/last line on the page, assume the textbox height is the "A" height.
        // This is done because when a first/last line is added manually, it is often page numbers,
        // and is often not the same font size as other lines.
        if (lineI == 0 || lineI + 1 == lines.length) {
          lineNew.letterHeight = lineNew.bbox[3] - lineNew.bbox[1];
          lineNew.ascHeight = null;
          lineNew.descHeight = null;

          // If the new line is between two existing lines, use metrics from nearby line to determine text size
        } else {

          const closestLine = lines[closestI];
          lineNew.letterHeight = closestLine.letterHeight;
          lineNew.ascHeight = closestLine.ascHeight;
          lineNew.descHeight = closestLine.descHeight;

          // If the previous line's font size is clearly incorrect, we instead revert to assuming the textbox height is the "A" height.
          const lineHeight = lineNew.bbox[3] - lineNew.bbox[1];
          if ((lineNew.letterHeight - (lineNew.descHeight || 0)) > lineHeight * 1.5) {
            lineNew.letterHeight = lineNew.bbox[3] - lineNew.bbox[1];
            lineNew.ascHeight = null;
            lineNew.descHeight = null;
          }
        }
      }

			if (afterClosest) {
				lines.splice(lineI+1, 0, lineNew);
			} else {
				lines.splice(lineI, 0, lineNew);
			}
		}
	}

}

/**
 * @param {Array<ocrWord>} wordsA
 * @param {boolean} view
 */
export async function checkWords(wordsA, view = false){

  // Draw the actual words (from the user-provided image)
  await drawWordActual(wordsA, true);

  // Create new scheduler if one does not exist
  if (!globalThis.recognizeAreaScheduler) globalThis.recognizeAreaScheduler = await createTesseractScheduler(1);

  const extraConfig = {
    tessedit_pageseg_mode: "6" // "Single block"
  }

  const inputImage = canvasAlt.toDataURL();

  const res = await recognizeAreaScheduler.addJob('recognize', inputImage, extraConfig);

  let wordTextA = wordsA.map((x) => x.text).join(" ");
  let wordTextB = res.data.text.trim();

  wordTextA = ocr.replaceLigatures(wordTextA);
  wordTextB = ocr.replaceLigatures(wordTextB);

  if (ignorePunctElem.checked) {
    // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
    // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
    wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
    wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
  }
  if (ignoreCapElem.checked) {
    wordTextA = wordTextA.toLowerCase();
    wordTextB = wordTextB.toLowerCase();
  }

  console.log("Supp comparison: " + String(wordTextA == wordTextB) + " [" + wordTextA + " vs. " + wordTextB + "] for " + wordsA[0].id + " (page " + String(wordsA[0].line.page.n + 1) + ")");

  return wordTextA == wordTextB;

}