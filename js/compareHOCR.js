import { getRandomAlphanum } from "./miscUtils.js";
import ocr from "./objects/ocrObjects.js";
import { calcCharSpacing, calcWordFontSize, calcLineFontSize } from "./fontUtils.js";
import { fontAll } from "./objects/fontObjects.js";
import { pageMetrics } from "./objects/pageMetricsObjects.js";

if (globalThis.document) {
  /**
   * @global
   * @type {CanvasRenderingContext2D}
   * @description - Used under the hood for rendering text for overlap comparisons. 
   */
  globalThis.ctxAlt = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('d')).getContext('2d'));


  /**
   * @global
   * @type {CanvasRenderingContext2D}
   * @description - Used under the hood for generating overlap visualizations to display to user. 
   */
  globalThis.ctxComp1 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('e')).getContext('2d'));

  /**
   * @global
   * @type {CanvasRenderingContext2D}
   * @description - Used under the hood for generating overlap visualizations to display to user. 
   */
  globalThis.ctxComp2 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('f')).getContext('2d'));

  /**
   * @global
   * @type {CanvasRenderingContext2D}
   * @description - Used under the hood for generating overlap visualizations to display to user. 
   */
  globalThis.ctxComp0 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('h')).getContext('2d'));

} else {
  const { createCanvas, loadImage, registerFont } = await import('canvas');

  const canvasAlt = createCanvas(200, 200);
  globalThis.ctxAlt = canvasAlt.getContext('2d');

  const canvasComp0 = createCanvas(200, 200);
  globalThis.ctxComp0 = canvasComp0.getContext('2d');

  const canvaComp1 = createCanvas(200, 200);
  globalThis.ctxComp1 = canvaComp1.getContext('2d');

  const canvasComp2 = createCanvas(200, 200);
  globalThis.ctxComp2 = canvasComp2.getContext('2d');

}



const calcCtx = globalThis.ctxAlt;
const viewCtx0 = globalThis.ctxComp0;
const viewCtx1 = globalThis.ctxComp1;
const viewCtx2 = globalThis.ctxComp2;

/**
 * Crop the image data the area containing `words` and render to the `calcCtx.canvas` canvas.
 * @param {Array<ocrWord>} words
 * @param {HTMLImageElement|Promise<HTMLImageElement>} binaryImage
 * @param {pageMetrics} pageMetricsObj
 * @param {boolean} view
 */
const drawWordActual = async function(words, binaryImage, pageMetricsObj, view = false) {

  const n = words[0].line.page.n;
  // The font/style from the first word is used for the purposes of font metrics
  const lineFontSize = await calcLineFontSize(words[0].line);
  const fontStyle =  words[0].style;
  const wordFontFamily = words[0].font || globalSettings.defaultFont;

  const fontI = /**@type {fontContainerFont} */  (fontAll[wordFontFamily][fontStyle]);
  const fontOpentypeI = await fontI.opentype;
  calcCtx.font = fontI.fontFaceStyle + " " + 1000 + "px " + fontI.fontFaceName;

  const oMetrics = calcCtx.measureText("o");

  const fontBoundingBoxDescent = Math.round(Math.abs(fontOpentypeI.descender) * (1000 / fontOpentypeI.unitsPerEm));
  const fontBoundingBoxAscent = Math.round(Math.abs(fontOpentypeI.ascender) * (1000 / fontOpentypeI.unitsPerEm));

  const fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  const fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  const sinAngle = Math.sin(pageMetricsObj.angle * (Math.PI / 180));
  const cosAngle = Math.cos(pageMetricsObj.angle * (Math.PI / 180));

  const pageDims = pageMetricsObj.dims;
  const shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

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
  if (Math.abs(pageMetricsObj.angle ?? 0) > 0.05) {

    const x = linebox[0];
    const y = linebox[3] + baseline[1];

    const xRot = x * cosAngle - sinAngle * y;
    const yRot = x * sinAngle + cosAngle * y;

    const angleAdjXInt = x - xRot;

    const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

    angleAdjXLine = angleAdjXInt + shiftX;
    angleAdjYLine = angleAdjYInt + shiftY;

  }

  const angleAdjXWord = Math.abs(pageMetricsObj.angle) >= 1 ? angleAdjXLine + (1 - cosAngle) * (wordBoxUnion[0] - linebox[0]) : angleAdjXLine;

  // We crop to the dimensions of the font (fontAsc and fontDesc) rather than the image bounding box.
  const height =  fontAsc && fontDesc ? fontAsc + fontDesc : wordBoxUnion[3] - wordBoxUnion[1] + 1;
  const width = wordBoxUnion[2] - wordBoxUnion[0] + 1;

  const cropY = linebox[3] + baseline[1] - fontAsc - 1;
  const cropYAdj = cropY + angleAdjYLine;

  const imgElem = await binaryImage;

  if (!imgElem) throw new Error('Binary image is not defined for the requested page.');


  calcCtx.canvas.height = height;
  calcCtx.canvas.width = width;

  calcCtx.drawImage(imgElem, wordBoxUnion[0]+angleAdjXWord-1, cropYAdj, width, height, 0, 0, width, height);


  if (view) {

    viewCtx0.canvas.height = height;
    viewCtx0.canvas.width = width;
    viewCtx1.canvas.height = height;
    viewCtx1.canvas.width = width;
    viewCtx2.canvas.height = height;
    viewCtx2.canvas.width = width;

    viewCtx0.drawImage(imgElem, wordBoxUnion[0]+angleAdjXWord-1, cropYAdj, width, height, 0, 0, width, height);
    viewCtx1.drawImage(imgElem, wordBoxUnion[0]+angleAdjXWord-1, cropYAdj, width, height, 0, 0, width, height);
    viewCtx2.drawImage(imgElem, wordBoxUnion[0]+angleAdjXWord-1, cropYAdj, width, height, 0, 0, width, height);
  }

  return cropY;

}

/**
 * Lightweight function for drawing text onto canvas with correct spacing/kerning without using Fabric.js.
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {string} font 
 * @param {string} style 
 * @param {number} size 
 * @param {number} boxWidth 
 * @param {number} left 
 * @param {number} bottom 
 * @param {string} fillStyle 
 */
const printWordOnCanvas = async (ctx, text, font, style, size, boxWidth, left = 0, bottom = 0, fillStyle = "black") => {

  const fontI = /**@type {fontContainerFont} */  (fontAll[font][style]);
  const fontOpentypeI = await fontI.opentype;

  ctx.font = fontI.fontFaceStyle + " " + size + "px " + fontI.fontFaceName;
  
  ctx.fillStyle = fillStyle;

  ctx.textBaseline = "alphabetic";

  const wordTextArr = text.split("");

  const charSpacing = await calcCharSpacing(text, font, style, size, boxWidth);

  let leftI = left;
  for(let i=0; i<wordTextArr.length; i++) {
    ctx.fillText(wordTextArr[i], leftI, bottom);

    if (i + 1 < wordTextArr.length) {
      const advance = fontOpentypeI.charToGlyph(wordTextArr[i]).advanceWidth  * (size / fontOpentypeI.unitsPerEm);
      const kern = i + 1 < wordTextArr.length ? fontOpentypeI.getKerningValue(fontOpentypeI.charToGlyph(wordTextArr[i]), fontOpentypeI.charToGlyph(wordTextArr[i+1])) * (size / fontOpentypeI.unitsPerEm) || 0 : 0;
      leftI += advance;
      leftI += kern;
      leftI += charSpacing;
    }
  }
}

  
/**
 * Print word on `ctxCanvas`.
 * 
 * @param {ocrWord} word
 * @param {number} offsetX
 * @param {number} cropY
 * @param {number} lineFontSize
 * @param {?string} altText
 * @param {?CanvasRenderingContext2D} ctxView
 */
const drawWordRender = async function(word, offsetX = 0, cropY = 0, lineFontSize = 0, altText = null, ctxView = null){

  lineFontSize = lineFontSize || (await calcLineFontSize(word.line)) || 10;

  const wordText = altText ? ocr.replaceLigatures(altText) : ocr.replaceLigatures(word.text);

  const wordFontSize = (await calcWordFontSize(word)) || lineFontSize;

  if(!wordFontSize){
    console.log("Font size not found");
    return;
  }

  const wordFontFamily = word.font || globalSettings.defaultFont;

  const fontI = /**@type {fontContainerFont} */  (fontAll[wordFontFamily][word.style]);
  const fontOpentypeI = await fontI.opentype;

  // Set canvas to correct font and size
  // ctx.font = fontI.fontFaceStyle + " " + String(wordFontSize) + "px " + fontI.fontFaceName;

  // Calculate font glyph metrics for precise positioning
  const wordFirstGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontOpentypeI.unitsPerEm);

  let baselineY = word.line.bbox[3] + word.line.baseline[1];

  if (word.sup) {

    const wordboxXMid = word.bbox[0] + (word.bbox[2] - word.bbox[0]) / 2;

    const baselineYWord = word.line.bbox[3] + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox[0]);

    baselineY = baselineY - (baselineYWord - word.bbox[3]);
  
  } 

  const y = baselineY - cropY;

  const left = 1 - wordLeftBearing + offsetX;

  await printWordOnCanvas(calcCtx, wordText, wordFontFamily, word.style, wordFontSize, word.bbox[2] - word.bbox[0], left, y);

  if (ctxView) {
    await printWordOnCanvas(ctxView, wordText, wordFontFamily, word.style, wordFontSize, word.bbox[2] - word.bbox[0], left, y, "red");
  }

}
  
/**
 * Evaluate the accuracy of OCR results by comparing visually with input image.
 * Optionally, an alternative array of OCR results (for the same underlying text)
 * can be provided for comparison purposes.
 * @param {Array<ocrWord>} wordsA - Array of words  
 * @param {Array<ocrWord>} wordsB - Array of words for comparison.  Optional. 
 * @param {HTMLImageElement} binaryImage - Image to compare to
 * @param {pageMetrics} pageMetricsObj
 * @param {Object} [options]
 * @param {boolean} [options.view] - Draw results on debugging canvases
 * @param {boolean} [options.useAFontSize] - Use font size from `wordsA` when printing `wordsB`
 *   This is useful when the metrics from `wordsA` are considered systematically more reliable,
 *   such as when `wordsA` are from Tesseract Legacy and `wordsB` are from Tesseract LSTM.
 * @param {boolean} [options.useABaseline]
 */
export async function evalWords(wordsA, wordsB = [], binaryImage, pageMetricsObj, options = {}){

  const view = options?.view === undefined ? true : options?.view;
  const useAFontSize = options?.useAFontSize === undefined ? true : options?.useAFontSize;
  const useABaseline = options?.useABaseline === undefined ? true : options?.useABaseline;

  const n = wordsA[0].line.page.n;

  const cosAngle = Math.cos(pageMetricsObj.angle * -1 * (Math.PI / 180)) || 1;
  const sinAngle = Math.sin(pageMetricsObj.angle * -1 * (Math.PI / 180)) || 0;

  const lineFontSizeA = await calcLineFontSize(wordsA[0].line);

  if (!lineFontSizeA) return [1,1];

  let lineFontSizeB = lineFontSizeA;
  if (!useAFontSize && wordsB?.[0]) {
    const lineFontSizeBCalc = await calcLineFontSize(wordsB[0].line);
    lineFontSizeB = lineFontSizeBCalc || lineFontSizeA;
  }

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
  const baselineA = wordsA[0].line.baseline;

  calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

  if (view) {
    viewCtx0.clearRect(0, 0, viewCtx0.canvas.width, viewCtx0.canvas.height);
    viewCtx1.clearRect(0, 0, viewCtx1.canvas.width, viewCtx1.canvas.height);
    viewCtx2.clearRect(0, 0, viewCtx2.canvas.width, viewCtx2.canvas.height);
  }

  // Draw the actual words (from the user-provided image)
  const cropY = await drawWordActual([...wordsA, ...wordsB], binaryImage, pageMetricsObj, true);

  const imageDataActual = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height)["data"];

  calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
  calcCtx.fillStyle = "white";
  calcCtx.fillRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

  let ctxView = view ? viewCtx1 : null;

  // Draw the words in wordsA
  let x0;
  let y0;
  for (let i=0;i<wordsA.length;i++) {
    const word = wordsA[i];
    const wordIBox = word.bbox;
    const baselineY = linebox[3] + baselineA[1] + baselineA[0] * (wordIBox[0] - linebox[0]);
    if (i == 0) {
      x0 = wordIBox[0];
      y0 = baselineY;
    } 
    const x = wordIBox[0];
    const y = word.sup || word.dropcap ? wordIBox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, cropY, lineFontSizeA, null, ctxView);
  }

  const imageDataExpectedA = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height)["data"];

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

  const metricA = diffA/totalA;

  let metricB = 1;
  if (wordsB.length > 0) {
    const baselineB = useABaseline ? baselineA : wordsB[0].line.baseline;

    calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
    calcCtx.fillStyle = "white";
    calcCtx.fillRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
  
    ctxView = view ? viewCtx2 : null;
  
    // Draw the words in wordsB
    for (let i=0;i<wordsB.length;i++) {
  
      // Clone object so editing does not impact the original
      const word = ocr.cloneWord(wordsB[i]);
  
      // Set style to whatever it is for wordsA.  This is based on the assumption that "A" is Tesseract Legacy and "B" is Tesseract LSTM (which does not have useful style info).
      word.style = wordsA[0].style
  
      const baselineY = linebox[3] + baselineB[1] + baselineB[0] * (word.bbox[0] - linebox[0]);
      if (i == 0) {
        x0 = word.bbox[0];
        y0 = baselineY;
      } 
      const x = word.bbox[0];
      const y = word.sup || word.dropcap ? word.bbox[3] : baselineY;
  
      const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);
  
      await drawWordRender(word, offsetX, cropY, lineFontSizeB, null, ctxView);
    }
  
    const imageDataExpectedB = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height)["data"];
  
    calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
  
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

    metricB = diffB/totalB;
  
  }


  return [metricA, metricB];

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

/**
 * Checks words in pageA against words in pageB.  Edits `compTruth` and `matchTruth` attributes of words in `pageA` in place
 * and returns additional data depending on `mode`.
 * @param {ocrPage} pageA
 * @param {ocrPage} pageB
 * @param {HTMLImageElement} binaryImage
 * @param {pageMetrics} pageMetricsObj
 * @param {object} options
 * @param {string} [options.mode] - If `mode = 'stats'` stats quantifying the number of matches/mismatches are returned.
 *    If `mode = 'comb'` a new version of `pageA`, with text and confidence metrics informed by comparisons with pageB, is created. 
 * @param {string} [options.debugLabel]
 * @param {boolean} [options.supplementComp] - Whether to run additional recognition jobs for words in `pageA` not in `pageB`
 * @param {Tesseract.Scheduler} [options.tessScheduler] - Tesseract scheduler to use for recognizing text.  Only needed if `supplementComp` is true.
 * @param {boolean} [options.ignorePunct]
 * @param {boolean} [options.ignoreCap]
 * @param {number} [options.confThreshHigh]
 * @param {number} [options.confThreshMed]
 */
export async function compareHOCR(pageA, pageB, binaryImage, pageMetricsObj, options = {}) {

  const mode = options?.mode === undefined ? "stats" : options?.mode;
  const debugLabel = options?.debugLabel === undefined ? "" : options?.debugLabel;
  const supplementComp = options?.supplementComp === undefined ? false : options?.supplementComp;
  const tessScheduler = options?.tessScheduler === undefined ? null : options?.tessScheduler;
  const ignorePunct = options?.ignorePunct === undefined ? false : options?.ignorePunct;
  const ignoreCap = options?.ignoreCap === undefined ? false : options?.ignoreCap;
  const confThreshHigh = options?.confThreshHigh === undefined ? 85 : options?.confThreshHigh;
  const confThreshMed = options?.confThreshMed === undefined ? 75 : options?.confThreshMed;

  const n = pageA.n;

  let debugLog = "";

  if (debugLabel) debugLog += "Comparing page " + String(n) + "\n";

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
          if (ignorePunct && !wordA.text.replace(/[\W_]/g, "")) {
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

              // If left of word B is past right of word A, move to next word B
            } else if (wordBoxBCore[0] > wordBoxACore[2]) {
              continue;

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
              if (ignorePunct) {
                // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
                // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
                wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
                wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
              }
              if (ignoreCap) {
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
                    if (debugLabel) debugLog += "Skipping words due to low overlap: " + wordTextA + " [Legacy] " + wordTextB + " [LSTM]\n";
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
              
                    const hocrError = await evalWords([wordA], [wordAClone], binaryImage, pageMetricsObj, {view: Boolean(debugLabel)});
              
                    hocrAError = hocrError[0] + penalizeWord(wordA.text);
                    hocrBError = hocrError[1] + penalizeWord(wordB.text);

                    // Apply ad-hoc penalties
                    hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                    if(debugLabel) {

                      const debugObj = {
                        // Raw image
                        imageRaw: viewCtx0.canvas.toDataURL(),
                        // Image + OCR "A" overlay
                        imageA: viewCtx1.canvas.toDataURL(),
                        // Image + OCR "B" overlay
                        imageB: viewCtx2.canvas.toDataURL(),
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

                      debugLog += "Legacy Word: " + wordA.text + " [Error: " + String(hocrAError) + "]\n";
                      debugLog += "LSTM Word: " + wordB.text + " [Error: " + String(hocrBError) + "]\n";  
                    }
                  } else if (twoToOne) {

                    // const hocrError = [0.1,0.1];
                    const hocrError = await evalWords(wordsAArr, wordsBArr, binaryImage, pageMetricsObj, {view: Boolean(debugLabel)});

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
                        imageRaw: viewCtx0.canvas.toDataURL(),
                        // Image + OCR "A" overlay
                        imageA: viewCtx1.canvas.toDataURL(),
                        // Image + OCR "B" overlay
                        imageB: viewCtx2.canvas.toDataURL(),
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

                      debugLog += "Legacy Word: " + wordsAArr.map((x) => x.text).join(" ") + " [Error: " + String(hocrAError) + "]\n";
                      debugLog += "LSTM Word: " + wordsBArr.map((x) => x.text).join(" ") + " [Error: " + String(hocrBError) + "]\n";
                    }
  
                  }
                              
                  if(hocrBError < hocrAError) {
                    const skip = ["eg","ie"].includes(wordA.text.replace(/\W/g,""));
                    if (skip) debugLog += "Skipping word replacement\n";

                    if(!skip){
                      if(oneToOne){
                        debugLog += "Replacing word " + wordA.text + " with word " + wordB.text + "\n";
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
          word.matchTruth = await checkWords([word], binaryImage, pageMetricsObj, tessScheduler, {ignorePunct: ignorePunct, view: false});
          word.conf = word.matchTruth ? 100 : 0;
        }
      }
    }
  }

  // In addition to not making sense, the statistics below will not be properly calculated when `mode == "comb"` and errors will be thrown if attempted.
  // The core issue is that pageAInt is being actively edited `mode == "comb"`.
  // Therefore, `hocrAOverlap` ends up including words not in `pageA`, so `ocr.getPageWord(pageA, overlappingWordsA[i]);` returns `null`.
  if (mode == "comb") return {page: pageAInt, metrics: {}, debugLog: debugLog};;

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

  return {page: pageAInt, metrics: metricsRet, debugLog: debugLog};

}



/**
 * Adds lines from a new page to an existing page.
 * Based on overlap between bounding boxes, lines may be added or combined with existing lines.
 * @param {ocrPage} pageA - New page
 * @param {ocrPage} pageB - Existing page
 * @param {pageMetrics} pageMetricsObj - Page metrics
 * @param {boolean} replaceFontSize - Whether font size stats in the new line(s) should be replaced by font size in previous line.
 *  This option is used when the user manually adds a word, as the manually-drawn box will only roughly correspond to font size.
 * @param {boolean} editWordIds - Edit word IDs in `pageB` by appending random characters to the end.
 *  As word ID values must be unique, this is useful when `pageB` may contain duplicative values.
 */
export function combineData(pageA, pageB, pageMetricsObj, replaceFontSize = false, editWordIds = true) {

  const linesNew = pageA.lines;
	const lines = pageB.lines;

	for (let i = 0; i < linesNew.length; i++) {
		const lineNew = linesNew[i];

    if (lineNew.words.length == 0) continue;

    const lineNewRot = ocr.cloneLine(lineNew);
    ocr.rotateLine(lineNewRot, pageMetricsObj.angle * -1, pageMetricsObj.dims);

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
      ocr.rotateLine(lineRot, pageMetricsObj.angle * -1, pageMetricsObj.dims);

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
    if (match && matchXOverlap == 0 && matchXDist > 2 * yDistMin && pageB.dims.width * 0.05 < matchXDist) match = undefined;


		const wordsNew = lineNew.words;

		if (match) {

      const words = match.words;

			for (let i = 0; i < wordsNew.length; i++) {
				let wordNew = wordsNew[i];
        wordNew.line = match;
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
				if (editWordIds) wordNew.id = word.id + getRandomAlphanum(3);

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
				if (editWordIds) wordNew.id = wordNew.id + getRandomAlphanum(3);
			}

      if (replaceFontSize) {

        // If this is the first/last line on the page, assume the textbox height is the "A" height.
        // This is done because when a first/last line is added manually, it is often page numbers,
        // and is often not the same font size as other lines.
        if (lineI == 0 || lineI + 1 == lines.length) {
          lineNew.ascHeight = lineNew.bbox[3] - lineNew.bbox[1];
          lineNew.xHeight = null;

          // If the new line is between two existing lines, use metrics from nearby line to determine text size
        } else {

          const closestLine = lines[closestI];
          lineNew.ascHeight = closestLine.ascHeight;
          lineNew.xHeight = closestLine.xHeight;

          // If the previous line's font size is clearly incorrect, we instead revert to assuming the textbox height is the "A" height.
          const lineHeight = lineNew.bbox[3] - lineNew.bbox[1];
          if (lineNew.ascHeight > lineHeight * 1.5) {
            lineNew.ascHeight = lineNew.bbox[3] - lineNew.bbox[1];
            lineNew.xHeight = null;
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
 * @param {HTMLImageElement} binaryImage
 * @param {pageMetrics} pageMetricsObj
 * @param {Tesseract.Scheduler} tessScheduler
 * @param {object} [options]
 * @param {boolean} [options.view] - TODO: make this functional or remove
 * @param {boolean} [options.ignorePunct]
 * @param {boolean} [options.ignoreCap]
 */
export async function checkWords(wordsA, binaryImage, pageMetricsObj, tessScheduler, options = {}){

  const view = options?.view === undefined ? false : options?.view;
  const ignorePunct = options?.ignorePunct === undefined ? false : options?.ignorePunct;
  const ignoreCap = options?.ignoreCap === undefined ? false : options?.ignoreCap;

  // Draw the actual words (from the user-provided image)
  await drawWordActual(wordsA, binaryImage, pageMetricsObj, true);

  const extraConfig = {
    tessedit_pageseg_mode: "6" // "Single block"
  }

  const inputImage = calcCtx.canvas.toDataURL();

  const res = await tessScheduler.addJob('recognize', inputImage, extraConfig);

  let wordTextA = wordsA.map((x) => x.text).join(" ");
  let wordTextB = res.data.text.trim();

  wordTextA = ocr.replaceLigatures(wordTextA);
  wordTextB = ocr.replaceLigatures(wordTextB);

  if (ignorePunct) {
    // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
    // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
    wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
    wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, "$1$2");
  }
  if (ignoreCap) {
    wordTextA = wordTextA.toLowerCase();
    wordTextB = wordTextB.toLowerCase();
  }

  console.log("Supp comparison: " + String(wordTextA == wordTextB) + " [" + wordTextA + " vs. " + wordTextB + "] for " + wordsA[0].id + " (page " + String(wordsA[0].line.page.n + 1) + ")");

  return wordTextA == wordTextB;

}


/**
 * 
 * @param {fontContainerFamily} font 
 * @param {Array<ocrPage>} pageArr
 * @param {Array<HTMLImageElement>} binaryImageArr
 * @param {number} n - Number of words to compare
 */
async function evalFontPages(font, pageArr, binaryImageArr, n = 500) {

  let metricTotal = 0;
  let wordsTotal = 0;
  
  for (let i=0; i<pageArr.length; i++) {
    if (wordsTotal > n) break;

    const ocrPage = pageArr[i];
    for (let j=0; j<ocrPage.lines.length; j++) {
      if (wordsTotal > n) break;

      const ocrLineJ = ocrPage.lines[j];

      // If the font is not set for a specific word, whether it is assumed sans/serif will be determined by the default font.
      const lineFontType = ocrLineJ.words[0].font ? fontAll[ocrLineJ.words[0].font].normal.type : fontAll.Default.normal.type;

      if (font.normal.type != lineFontType) continue;

      const ocrLineJClone = ocr.cloneLine(ocrLineJ);

      for (let i=0; i<ocrLineJClone.words.length; i++) {
        ocrLineJClone.words[i].font = font.normal.family;
      }
    
      const metricJ = await evalWords(ocrLineJClone.words, [], binaryImageArr[i], globalThis.pageMetricsArr[i]);

      metricTotal = metricTotal + (metricJ[0] * ocrLineJ.words.length);

      wordsTotal = wordsTotal + ocrLineJ.words.length;

    }
  }

  return metricTotal;

}

/**
 * @param {Array<ocrPage>} pageArr
 * @param {Array<HTMLImageElement>} binaryImageArr
 */
export async function selectDefaultFontsDocument(pageArr, binaryImageArr) {

  const fontSans = ["Carlito", "NimbusSans"];

  const metricCarlito = await evalFontPages(fontAll.Carlito, pageArr, binaryImageArr);
  const metricNimbusSans = await evalFontPages(fontAll.NimbusSans, pageArr, binaryImageArr);
  console.log("metricCarlito: " + String(metricCarlito));
  console.log("metricNimbusSans: " + String(metricNimbusSans));

  const metricCentury = await evalFontPages(fontAll.Century, pageArr, binaryImageArr);
  const metricNimbusRomNo9L = await evalFontPages(fontAll.NimbusRomNo9L, pageArr, binaryImageArr);
  console.log("metricCentury: " + String(metricCentury));
  console.log("metricNimbusRomNo9L: " + String(metricNimbusRomNo9L));

  let change = false;
  if (metricCarlito < metricNimbusSans) {
    fontAll.SansDefault = fontAll.Carlito;
    change = true;
  }

  if (metricCentury < metricNimbusRomNo9L) {
    fontAll.SerifDefault = fontAll.Century;
    change = true;
  }

  return change;

}