import { round3, replaceLigatures } from "./miscUtils.js";
import { getFontSize } from "./textUtils.js"

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById("ignorePunct"));

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreCap"));

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreExtra"));

// Quick fix to get VSCode type errors to stop
// Long-term should see if there is a way to get types to work with fabric.js
var fabric = globalThis.fabric;

var parser = new DOMParser();

let drawWordActual = async function(words, n, fontAsc = null, fontDesc = null, view = false) {

  const sinAngle = Math.sin(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));
  const cosAngle = Math.cos(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));

  const pageDims = globalThis.pageMetricsObj["dimsAll"][n];
  const shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

  const wordsTitleStr = words.map((x) => x.getAttribute("title"));
  const wordsBox = wordsTitleStr.map((x) => [...x.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); }));

  // Union of all bounding boxes
  let wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsBox.map(x => x[0]));
  wordBoxUnion[1] = Math.min(...wordsBox.map(x => x[1]));
  wordBoxUnion[2] = Math.max(...wordsBox.map(x => x[2]));
  wordBoxUnion[3] = Math.max(...wordsBox.map(x => x[3]));

  // All words are assumed to be on the same line
  let titleStrLine = words[0].parentElement.getAttribute('title');

  let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
  let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
  if (baseline != null) {
    baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
  } else {
    baseline = [0, 0];
  }
  

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
  const height = fontAsc + fontDesc || wordBoxUnion[3] - wordBoxUnion[1] + 1;
  const cropY = linebox[3] + baseline[1] - fontAsc + angleAdjYLine-1 || linebox[1];

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
  

// Calculates line font size from xml element (either ocr_line or ocrx_word) 
const calcLineFontSize = async function(xmlElem) {

  if(xmlElem.className == "ocrx_word") {
    xmlElem = xmlElem.parentElement;
  }

  if(xmlElem.className != "ocr_line") {
    throw new Error('xmlElem or its parent must be ocr_line element.');
  }

  // Get line font size.  We assume all the words are on the same line.
  let titleStrLine = xmlElem.getAttribute('title');
  let lineFontSize;
  // If possible (native Tesseract HOCR) get font size using x-height.
  // If not possible (Abbyy XML) get font size using ascender height.
  let letterHeight = titleStrLine.match(/x_size\s+([\d\.\-]+)/);
  let ascHeight = titleStrLine.match(/x_ascenders\s+([\d\.\-]+)/);
  let descHeight = titleStrLine.match(/x_descenders\s+([\d\.\-]+)/);
  if (letterHeight != null && ascHeight != null && descHeight != null) {
    letterHeight = parseFloat(letterHeight[1]);
    ascHeight = parseFloat(ascHeight[1]);
    descHeight = parseFloat(descHeight[1]);
    let xHeight = letterHeight - ascHeight - descHeight;
    lineFontSize = await getFontSize(globalSettings.defaultFont, "normal", xHeight, "o");
  } else if (letterHeight != null) {
    letterHeight = parseFloat(letterHeight[1]);
    descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
    lineFontSize = await getFontSize(globalSettings.defaultFont, "normal", letterHeight - descHeight, "A");
  }

  return(lineFontSize);
  
}
  
  
  
let drawWordRender = async function(word, offsetX = 0, lineFontSize = 0, altText = null, debugCanvas = null){

  lineFontSize = lineFontSize || (await calcLineFontSize(word)) || 10;

  let styleStr = word.getAttribute('style') ?? "";

  let fontStyle;
  if (/italic/i.test(styleStr)) {
    fontStyle = "italic";
  } else if (/small\-caps/i.test(styleStr)) {
    fontStyle = "small-caps";
  } else {
    fontStyle = "normal";
  }

  // let fontSizeStr = styleStr.match(/font\-size\:\s*(\d+)/i)?.[1];
  // const wordFontSize = parseFloat(fontSizeStr) || lineFontSize;
  let wordText, wordSup, wordDropCap;
  if (/\<sup\>/i.test(word.innerHTML)) {
    wordText = word.innerHTML.replace(/^\s*\<sup\>/i, "");
    wordText = wordText.replace(/\<\/sup\>\s*$/i, "");
    wordSup = true;
    wordDropCap = false;
  } else if (/\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word.innerHTML)) {
    wordText = word.innerHTML.replace(/^\s*<span class\=[\'\"]ocr_dropcap[\'\"]\>/i, "");
    wordText = wordText.replace(/\<\/span\>\s*$/i, "");
    wordSup = false;
    wordDropCap = true;
  } else {
    wordText = word.childNodes[0].nodeValue;
    wordSup = false;
    wordDropCap = false;
  }

  wordText = altText ? replaceLigatures(altText) : replaceLigatures(wordText);

  const titleStr = word.getAttribute('title');
  const wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

  let wordFontSize;
  let fontSizeStr = styleStr.match(/font\-size\:\s*(\d+)/i);
  if (fontSizeStr != null) {
    wordFontSize = parseFloat(fontSizeStr[1]);
  } else if (wordSup) {
    // All superscripts are assumed to be numbers for now
    wordFontSize = getFontSize(globalSettings.defaultFont, fontStyle, wordBox[3] - wordBox[1], "1");
  } else if (wordDropCap) {
    // Note: In addition to being taller, drop caps are often narrower than other glyphs.
    // Unfortunately, while Fabric JS (canvas library) currently supports horizontally scaling glyphs,
    // pdfkit (pdf library) does not.  This feature should be added to Scribe if pdfkit supports it
    // in the future.
    // https://github.com/foliojs/pdfkit/issues/1032
    wordFontSize = getFontSize(globalSettings.defaultFont, fontStyle, wordBox[3] - wordBox[1], wordText.slice(0, 1));
  } else {
    wordFontSize = lineFontSize;
  }

  if(!wordFontSize){
    console.log("Font size not found");
    return;
  }

  ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
  const oMetrics = ctx.measureText("o");

  let wordFontFamily = styleStr.match(/font\-family\s{0,3}\:\s{0,3}[\'\"]?([^\'\";]+)/)?.[1];
  let defaultFontFamily;
  if (wordFontFamily == null) {
    wordFontFamily = globalSettings.defaultFont;
    defaultFontFamily = true;
  } else {
    wordFontFamily = wordFontFamily.trim();
    defaultFontFamily = false;
  }

  if (fontStyle == "small-caps") {
    ctx.font = wordFontSize + 'px ' + wordFontFamily + " Small Caps";
  } else {
    ctx.font = fontStyle + " " + wordFontSize + 'px ' + wordFontFamily;
  }

  let missingKerning, kerning;
  let kerningMatch = styleStr.match(/letter-spacing\:([\d\.\-]+)/);
  if (kerningMatch == null) {
    kerning = 0;
    missingKerning = true;
  } else {
    kerning = parseFloat(kerningMatch[1]);
    missingKerning = false;
  }

  const fontObjI = await globalThis.fontObj[wordFontFamily][fontStyle];

  // Calculate font glyph metrics for precise positioning
  let wordLastGlyphMetrics = fontObjI.charToGlyph(wordText.substr(-1)).getMetrics();
  let wordFirstGlyphMetrics = fontObjI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  let wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontObjI.unitsPerEm);
  let wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (wordFontSize / fontObjI.unitsPerEm);


  let wordWidth1 = ctx.measureText(wordText).width;
  let wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing + (wordText.length - 1) * kerning;

  let box_width = wordBox[2] - wordBox[0];

  // If kerning is off, change the kerning value for both the canvas textbox and HOCR
  if (wordText.length > 1 && Math.abs(box_width - wordWidth) > 1) {
    kerning = round3(kerning + (box_width - wordWidth) / (wordText.length - 1));
  }

  let fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));
  let fontBoundingBoxAscent = Math.round(Math.abs(fontObjI.ascender) * (1000 / fontObjI.unitsPerEm));

  let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  let fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  let top;
  if (wordSup) {
    let fontDescWord = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (wordFontSize / 1000);

    let titleStrLine = word.parentElement.getAttribute('title');

    let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
    if (baseline != null) {
      baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
    } else {
      baseline = [0, 0];
    }

    const wordboxXMid = wordBox[0] + (wordBox[2] - wordBox[0]) / 2;

    const baselineY = linebox[3] + baseline[1] + baseline[0] * (wordboxXMid - linebox[0]);

    top = fontDesc + fontAsc + 1 - (baselineY - wordBox[3]) - (fontDesc - fontDescWord);  
  
  } else {
    top = fontDesc + fontAsc + 1;  
  }

  const left = 0 - wordLeftBearing + offsetX;

  // const top = fontDesc + fontAsc + 1;  

  let wordFontFamilyCanvas = fontStyle == "small-caps" ? wordFontFamily + " Small Caps" : wordFontFamily;
  let fontStyleCanvas = fontStyle == "small-caps" ? "normal" : fontStyle;

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
  
  
export async function evalWords(wordsA, wordsB, n, view = false){

  const cosAngle = Math.cos(globalThis.pageMetricsObj.angleAll[n] * -1 * (Math.PI / 180)) || 1;
  const sinAngle = Math.sin(globalThis.pageMetricsObj.angleAll[n] * -1 * (Math.PI / 180)) || 0;

  const lineFontSize = await calcLineFontSize(wordsA[0]);

  if (!lineFontSize) return [1,1];

  // The font/style from the first word is used for the purposes of font metrics
  let styleStr = wordsA[0].getAttribute('style') ?? "";

  let fontStyle;
  if (/italic/i.test(styleStr)) {
    fontStyle = "italic";
  } else if (/small\-caps/i.test(styleStr)) {
    fontStyle = "small-caps";
  } else {
    fontStyle = "normal";
  }

  let wordFontFamily = styleStr.match(/font\-family\s{0,3}\:\s{0,3}[\'\"]?([^\'\";]+)/)?.[1] || globalSettings.defaultFont;

  ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
  const oMetrics = ctx.measureText("o");

  const fontObjI = await globalThis.fontObj[wordFontFamily][fontStyle];

  let fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));
  let fontBoundingBoxAscent = Math.round(Math.abs(fontObjI.ascender) * (1000 / fontObjI.unitsPerEm));

  let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  let fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);


  const wordsATitleStr = wordsA.map((x) => x.getAttribute("title"));
  const wordsBTitleStr = wordsA.map((x) => x.getAttribute("title"));

  const wordsABox = wordsATitleStr.map((x) => [...x.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); }));
  const wordsBBox = wordsBTitleStr.map((x) => [...x.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); }));

  const wordsAllBox = [...wordsABox,...wordsBBox];

  // Union of all bounding boxes
  let wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsAllBox.map(x => x[0]));
  wordBoxUnion[1] = Math.min(...wordsAllBox.map(x => x[1]));
  wordBoxUnion[2] = Math.max(...wordsAllBox.map(x => x[2]));
  wordBoxUnion[3] = Math.max(...wordsAllBox.map(x => x[3]));
  
  // All words are assumed to be on the same line
  let titleStrLine = wordsA[0].parentElement.getAttribute('title');

  let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
  let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
  if (baseline != null) {
    baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
  } else {
    baseline = [0, 0];
  }

  // const yRot = x * sinAngle + cosAngle * y;
  // const angleAdjXIntLine = x - xRot;


  canvasAlt.clear();

  if (view) {
    // document.getElementById("e").setAttribute("style", "");
    // document.getElementById("f").setAttribute("style", "");
    canvasComp0.clear();
    canvasComp1.clear();
    canvasComp2.clear();
  }

  // Draw the actual words (from the user-provided image)
  await drawWordActual([...wordsA, ...wordsB], n, fontAsc, fontDesc, true);

  const imageDataActual = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  canvasAlt.clear();

  let debugCanvas = view ? canvasComp1 : null;

  // Draw the words in wordsA
  let x0;
  let y0;
  for (let i=0;i<wordsA.length;i++) {
    const word = wordsA[i];
    const wordITitleStr = word.getAttribute('title');
    const wordIBox = [...wordITitleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    const baselineY = linebox[3] + baseline[1] + baseline[0] * (wordIBox[0] - linebox[0]);
    if (i == 0) {
      x0 = wordIBox[0];
      y0 = baselineY;
    } 
    const x = wordIBox[0];
    const y = /\<sup\>/i.test(word.innerHTML) || /\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word.innerHTML) ? wordIBox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, lineFontSize, null, debugCanvas);
  }

  const imageDataExpectedA = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  // if (/\<sup\>/i.test(wordsA[1]?.innerHTML)) debugger;

  canvasAlt.clear();

  debugCanvas = view ? canvasComp2 : null;

  // Draw the words in wordsB
  for (let i=0;i<wordsB.length;i++) {

    // Nodes are cloned so editing does not impact the original
    // Line needs to be cloned along with word since drawWordRender function references parentElement
    const line = wordsB[i].parentElement.cloneNode(false);
    line.appendChild(wordsB[i].cloneNode(true));

    const word = line.firstChild;

    // const word = wordsB[i].cloneNode(true);

    // Set style to whatever it is for wordsA.  This is based on the assumption that "A" is Tesseract Legacy and "B" is Tesseract LSTM (which does not have useful style info).
    word.setAttribute("style", styleStr);
    const wordITitleStr = word.getAttribute('title');
    const wordIBox = [...wordITitleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    const baselineY = linebox[3] + baseline[1] + baseline[0] * (wordIBox[0] - linebox[0]);
    if (i == 0) {
      x0 = wordIBox[0];
      y0 = baselineY;
    } 
    const x = wordIBox[0];
    const y = /\<sup\>/i.test(word.innerHTML) || /\<span class\=[\'\"]ocr_dropcap[\'\"]\>/i.test(word.innerHTML) ? wordIBox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, lineFontSize, null, debugCanvas);
  }

  const imageDataExpectedB = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];

  // if (/\<sup\>/i.test(wordsB[1]?.innerHTML)) debugger;

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
    
  
// Calculate penalty for word using a collection of ad-hoc heuristics.
// This should supplement the word overlap strategy by penalizing patterns that may have plausible overlap
// but are implausible from a language perspective (e.g. "1%" being misidentified as "l%")
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
function calcOverlap(boxA, boxB) {
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

export function reorderHOCR(hocrStrA, layoutObj) {

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return hocrStrA;


  const hocrA = parser.parseFromString(hocrStrA, "text/xml");
  const hocrALines = hocrA.getElementsByClassName("ocr_line");

  const hocrNew = hocrA.firstChild.cloneNode(false);

  const priorityArr = Array(hocrALines.length);
  // 10 assumed to be lowest priority
  priorityArr.fill(10);

  for (let i = 0; i < hocrALines.length; i++) {
    const hocrALine = hocrALines[i];
    const titleStrLineA = hocrALine.getAttribute('title');
    const lineBoxA = [...titleStrLineA.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineBoxA, obj["coords"]);
      if (overlap > 0.5) {
        priorityArr[i] = obj["priority"];
      } 
    }
  }

  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j < priorityArr.length; j++) {
      if (priorityArr[j] == i) {
        hocrNew.appendChild(hocrALines[j].cloneNode(true));
      }
    }
  }

  return hocrNew.outerHTML;

}

export async function compareHOCR(hocrStrA, hocrStrB, mode = "stats", n = null, debugLabel = "") {

  if (debugLabel && !globalThis.debugLog) globalThis.debugLog = "";
  if (debugLabel) globalThis.debugLog += "Comparing page " + String(n) + "\n";


  hocrStrA = hocrStrA.replace(/compCount=['"]\d+['"]/g, "");
  hocrStrA = hocrStrA.replace(/compStatus=['"]\d+['"]/g, "");

  hocrStrB = hocrStrB.replace(/compCount=['"]\d+['"]/g, "");
  hocrStrB = hocrStrB.replace(/compStatus=['"]\d+['"]/g, "");

  const hocrA = parser.parseFromString(hocrStrA, "text/xml");
  const hocrB = parser.parseFromString(hocrStrB, "text/xml");

  const hocrALines = hocrA.getElementsByClassName("ocr_line");
  const hocrBLines = hocrB.getElementsByClassName("ocr_line");

  const hocrAOverlap = {};
  const hocrBOverlap = {};
  const hocrBCorrect = {};

  //let minLineB = 0;
  for (let i = 0; i < hocrALines.length; i++) {
    const hocrALine = hocrALines[i];
    const titleStrLineA = hocrALine.getAttribute('title');
    const lineBoxA = [...titleStrLineA.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

    //for (let j = minLineB; j < hocrBLines.length; j++){
    for (let j = 0; j < hocrBLines.length; j++) {
      const hocrBLine = hocrBLines[j];
      const titleStrLineB = hocrBLine.getAttribute('title');
      const lineBoxB = [...titleStrLineB.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

      // If top of line A is below bottom of line B, move to next line B
      if (lineBoxA[1] > lineBoxB[3]) {
        //minLineB = minLineB + 1;
        continue;

        // If top of line B is below bottom of line A, move to next line A
        // (We assume no match is possible for any B)
      } else if (lineBoxB[1] > lineBoxA[3]) {
        //break;
        continue;

        // Otherwise, there is possible overlap
      } else {

        let minWordB = 0;
        const hocrAWords = hocrALine.getElementsByClassName("ocrx_word");
        const hocrBWords = hocrBLine.getElementsByClassName("ocrx_word");

        for (let k = 0; k < hocrAWords.length; k++) {
          const hocrAWord = hocrAWords[k];
          const hocrAWordID = hocrAWord.getAttribute("id");

          // If option is set to ignore punctuation and the current "word" conly contains punctuation,
          // exit early with options that will result in the word being printed in green.
          if (ignorePunctElem.checked && !hocrAWord.textContent.replace(/[\W_]/g, "")) {
            hocrAWord.setAttribute("compCount", "1");
            hocrAWord.setAttribute("compStatus", "1");
          }


          //if (j == minLineB) hocrAWord.setAttribute("compCount", "0");
          hocrAWord.setAttribute("compCount", hocrAWord.getAttribute("compCount") || "0");

          const titleStrWordA = hocrAWord.getAttribute('title');
          const wordBoxA = [...titleStrWordA.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

          // Remove 10% from all sides of bounding box
          // This prevents small overlapping (around the edges) from triggering a comparison
          const wordBoxAWidth = wordBoxA[2] - wordBoxA[0];
          const wordBoxAHeight = wordBoxA[3] - wordBoxA[1];

          const wordBoxACore = JSON.parse(JSON.stringify(wordBoxA));

          wordBoxACore[0] = wordBoxA[0] + Math.round(wordBoxAWidth * 0.1);
          wordBoxACore[2] = wordBoxA[2] - Math.round(wordBoxAWidth * 0.1);

          wordBoxACore[1] = wordBoxA[1] + Math.round(wordBoxAHeight * 0.1);
          wordBoxACore[3] = wordBoxA[3] - Math.round(wordBoxAHeight * 0.1);


          for (let l = minWordB; l < hocrBWords.length; l++) {

            const hocrBWord = hocrBWords[l];
            const hocrBWordID = hocrBWord.getAttribute("id");
            const titleStrWordB = hocrBWord.getAttribute('title');
            const wordBoxB = [...titleStrWordB.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

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

              hocrAWord.setAttribute("compCount", (parseInt(hocrAWord.getAttribute("compCount")) + 1).toString());
              let wordTextA = replaceLigatures(hocrAWord.textContent);
              let wordTextB = replaceLigatures(hocrBWord.textContent);
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

              hocrAOverlap[hocrAWordID] = 1;
              hocrBOverlap[hocrBWordID] = 1;

              // TODO: Account for cases without 1-to-1 mapping between bounding boxes
              if (wordTextA == wordTextB) {
                hocrAWord.setAttribute("compStatus", "1");
                hocrBCorrect[hocrBWordID] = 1;

                if(mode == "comb") {
                  // If the words match, add 10 points to the confidence score
                  const x_wconf = parseInt(titleStrWordA.match(/x_wconf\s+(\d+)/)?.[1]);
                  hocrAWord.setAttribute("title", titleStrWordA.replace(/(x_wconf\s+)\d+/, "x_wconf " + String(Math.max(x_wconf + 10, 100))));
                }

              } else {

                if(mode == "comb") {

                  hocrAWord.setAttribute("title", titleStrWordA.replace(/(x_wconf\s+)\d+/, "x_wconf " + String(0)));

                  // If the words do not match, set to low confidence
                  hocrAWord.setAttribute("compStatus", hocrAWord.getAttribute("compStatus") || "0");


                  // Check if there is a 1-to-1 comparison between words (this is usually true)
                  const oneToOne = Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxA[2]) < (wordBoxA[2] - wordBoxA[0]) * 0.1;
                
                  let twoToOne = false;
                  let wordsAArr = [];
                  let wordsBArr = [];

                  // If there is no 1-to-1 comparison, check if a 2-to-1 comparison is possible using the next word in either dataset
                  if(!oneToOne){
                    if(wordBoxA[2] < wordBoxB[2]) {
                      if(hocrAWord.nextSibling) {
                        const titleStrWordANext = hocrAWord.nextSibling.getAttribute('title');
                        // wordBoxB[0] = wordBoxB[0] + Math.round(wordBoxBWidth * 0.1);
                        // wordBoxB[2] = wordBoxB[2] - Math.round(wordBoxBWidth * 0.1);
            
                        // wordBoxB[1] = wordBoxB[1] + Math.round(wordBoxBHeight * 0.1);
                        // wordBoxB[3] = wordBoxB[3] - Math.round(wordBoxBHeight * 0.1);
            
                        const wordBoxANext = [...titleStrWordANext.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
                        if(Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxANext[2]) < (wordBoxANext[2] - wordBoxA[0]) * 0.1) {
                          twoToOne = true;
                          wordsAArr.push(hocrAWord);
                          wordsAArr.push(hocrAWord.nextSibling);
                          wordsBArr.push(hocrBWord);
                        }
                      }
                    } else {
                      if(hocrBWord.nextSibling) {
                        const titleStrWordBNext = hocrBWord.nextSibling.getAttribute('title');
                        const wordBoxBNext = [...titleStrWordBNext.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
                        if(Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxA[2] - wordBoxBNext[2]) < (wordBoxBNext[2] - wordBoxA[0]) * 0.1) {
                          twoToOne = true;
                          wordsAArr.push(hocrAWord);
                          wordsBArr.push(hocrBWord);
                          wordsBArr.push(hocrBWord.nextSibling);
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
                  const replaceNum = /[a-z]\d[a-z]/i.test(hocrAWord.innerHTML);

                  // Automatically reject words where "ii" is between two non-"i" letters
                  // Tesseract Legacy commonly recognizes "ii" when the (actual) letter contains an accent, 
                  // while Tesseract LSTM usually recognizes the correct letter, sans the accent. 
                  // This "ii" pattern is automatically discarded, regardless of the overlap metrics, 
                  // because the overlap metrics often fail in this case. 
                  // E.g. the letter "ö" (o with umlaut) may overlap better with "ii" than "o". 
                  const replaceII = /[a-hj-z]ii[a-hj-z]/.test(hocrAWord.innerHTML);

                  let replaceMetrics = false;

                  let hocrAError = 0;
                  let hocrBError = 0;

                  if(oneToOne) {
                    // TODO: Figure out how to compare between small caps/non small-caps words (this is the only relevant style as it is the only style LSTM detects)
                    
                    // Clone hocrAWord and set text content equal to hocrBWord
                    const line = hocrAWord.parentElement.cloneNode(false);
                    line.appendChild(hocrAWord.cloneNode(true));
              
                    const word = line.firstChild;
                    word.innerHTML = hocrBWord.innerHTML;

                    const hocrError = await evalWords([hocrAWord], [word], n, Boolean(debugLabel));
              
                    hocrAError = hocrError[0] + penalizeWord(hocrAWord.innerHTML);
                    hocrBError = hocrError[1] + penalizeWord(hocrBWord.innerHTML);

                    // Apply ad-hoc penalties
                    hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                    // hocrAError = (await evalWord(hocrAWord, n, null)) + penalizeWord(hocrAWord.innerHTML);
                    // hocrBError = (await evalWord(hocrAWord, n, hocrBWord.innerHTML)) + penalizeWord(hocrBWord.innerHTML);

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
                        textA: hocrAWord.innerHTML,
                        // OCR text "B"
                        textB: hocrBWord.innerHTML
                      }

                      globalThis.debugImg[debugLabel][n].push(debugObj);

                      globalThis.debugLog += "Legacy Word: " + hocrAWord.innerHTML + " [Error: " + String(hocrAError) + "]\n";
                      globalThis.debugLog += "LSTM Word: " + hocrBWord.innerHTML + " [Error: " + String(hocrBError) + "]\n";  
                    }
                  } else if (twoToOne) {

                    // const hocrError = [0.1,0.1];
                    const hocrError = await evalWords(wordsAArr, wordsBArr, n, Boolean(debugLabel));

                    const wordsAText = wordsAArr.map((x) => x.innerHTML).join("");
                    const wordsBText =  wordsBArr.map((x) => x.innerHTML).join("");

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
                      if (wordsAArr.map((x) => /[a-z]/i.test(x.innerHTML)).filter((x) => !x).length > 0 || wordsBArr.map((x) => /[a-z]/i.test(x.innerHTML)).filter((x) => !x).length > 0) {
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
                        textA: wordsAArr.map((x) => x.innerHTML).join(" "),
                        // OCR text "B"
                        textB: wordsBArr.map((x) => x.innerHTML).join(" ")
                      }

                      globalThis.debugImg[debugLabel][n].push(debugObj);

                      globalThis.debugLog += "Legacy Word: " + wordsAArr.map((x) => x.innerHTML).join(" ") + " [Error: " + String(hocrAError) + "]\n";
                      globalThis.debugLog += "LSTM Word: " + wordsBArr.map((x) => x.innerHTML).join(" ") + " [Error: " + String(hocrBError) + "]\n";
                    }
  
                  }
                              
                  if(hocrBError < hocrAError) {
                    const skip = ["eg","ie"].includes(hocrAWord.innerHTML.replace(/\W/g,""));
                    if (skip) globalThis.debugLog += "Skipping word replacement\n";

                    if(!skip){
                      if(oneToOne){
                        globalThis.debugLog += "Replacing word " + hocrAWord.innerHTML + " with word " + hocrBWord.innerHTML + "\n";
                        hocrAWord.innerHTML = hocrBWord.innerHTML;

                        let styleStrA = hocrAWord.getAttribute("style") ?? "";
                        let styleStrB = hocrBWord.getAttribute("style") ?? "";

                        // Switch to small caps/non-small caps based on style of replacement word. 
                        // This is not relevant for italics as the LSTM engine does not detect italics. 
                        if(/small-caps/.test(styleStrB) && !/small-caps/.test(styleStrA)) {
                          styleStrA = styleStrA.replace(/font\-style[^;]*(;|$)/i,"").replace(/;$/, "");
                          styleStrA = styleStrA.replace(/font\-variant[^;]*(;|$)/i,"").replace(/;$/, "");
                          styleStrA = styleStrA + ";font-variant:small-caps";
                          hocrAWord.setAttribute("style", styleStrA);
                        } else if (!/small-caps/.test(styleStrB) && /small-caps/.test(styleStrA)) {
                          styleStrA = styleStrA.replace(/font\-style[^;]*(;|$)/i,"").replace(/;$/, "");
                          styleStrA = styleStrA.replace(/font\-variant[^;]*(;|$)/i,"").replace(/;$/, "");
                          hocrAWord.setAttribute("style", styleStrA);
                        }

                      } else {
                        const wordsBArrRep = wordsBArr.map((x) => x.cloneNode(true));

                        const styleStrWordA = hocrAWord.getAttribute('style');

                        for(let i=0;i<wordsBArrRep.length;i++) {

                          // Use font variant from word A (assumed to be Tesseract Legacy)
                          const fontVariant = styleStrWordA?.match(/font-variant\:\w+/)?.[0];
                          if(fontVariant) {
                            const styleStrWordB = wordsBArrRep[i].getAttribute('style')?.replace(/font-variant\:\w+/, "") || "";
                            wordsBArrRep[i].setAttribute("style", styleStrWordB + ";" + fontVariant);
                          }
                          // Set confidence to 0
                          const titleStrWord = wordsBArrRep[i].getAttribute('title');
                          wordsBArrRep[i].setAttribute("title", titleStrWord.replace(/(x_wconf\s+)\d+/, "x_wconf " + String(0)));

                          // Change ID so there are no duplicates
                          wordsBArrRep[i].id = wordsBArrRep[i].id + "b";

                        }

                        // Remove all "A" nodes except for the first one, which is replaced with the "B" nodes
                        for (let i=1;i<wordsAArr.length;i++) {
                          wordsAArr[i].remove();
                        }

                        hocrAWord.replaceWith(...wordsBArrRep);
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

  if (mode == "comb") {
    return hocrA.documentElement.outerHTML;
  }
  
  // Note: These metrics leave open the door for some fringe edge cases.
  // For example,

  // Number of words in ground truth
  const totalCountB = hocrB.getElementsByClassName("ocrx_word").length;

  // Number of words in candidate OCR
  const totalCountA = hocrA.getElementsByClassName("ocrx_word").length;

  // Number of words in ground truth with any overlap with candidate OCR
  const overlapCountB = Object.keys(hocrBOverlap).length;

  // Number of words in candidate OCR with any overlap with ground truth
  const overlapCountA = Object.keys(hocrAOverlap).length;

  // Number of words in ground truth correctly identified by 1+ overlapping word in candidate OCR
  const correctCount = Object.keys(hocrBCorrect).length;

  // Number of words in ground truth not identified by 1+ overlapping word in candidate OCR
  const incorrectCount = overlapCountB - correctCount;

  const metricsRet = [totalCountB, correctCount, incorrectCount, (totalCountB - overlapCountB), (totalCountA - overlapCountA)];

  return ([hocrA, metricsRet]);
}
