import { round3, replaceLigatures } from "./miscUtils.js";
import { getFontSize } from "./textUtils.js"

// Quick fix to get VSCode type errors to stop
// Long-term should see if there is a way to get types to work with fabric.js
var fabric = globalThis.fabric;

let drawWordActual = async function(words, n, fontAsc = null, fontDesc = null) {

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
  
    const imageDataActual = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];
  
    return(imageDataActual);
  
  }
  

// Calculates line font size from xml element (either ocr_line or ocrx_word) 
const calcLineFontSize = function(xmlElem) {

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
      lineFontSize = getFontSize(globalSettings.defaultFont, xHeight, "o");
    } else if (letterHeight != null) {
      letterHeight = parseFloat(letterHeight[1]);
      descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
      lineFontSize = getFontSize(globalSettings.defaultFont, letterHeight - descHeight, "A");
    }
  
    return(lineFontSize);
    
  }
  
  
  
  let drawWordRender = async function(word, offsetX = 0, lineFontSize = null, altText = null){
  
    lineFontSize = lineFontSize || calcLineFontSize(word);
  
    let wordText = altText ? replaceLigatures(altText) : replaceLigatures(word.textContent);
  
    let styleStr = word.getAttribute('style') ?? "";
    let fontSizeStr = styleStr.match(/font\-size\:\s*(\d+)/i)?.[1];
    const wordFontSize = parseFloat(fontSizeStr) || lineFontSize;
  
    const titleStr = word.getAttribute('title');
    const wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
  
    if(!wordFontSize){
      console.log("Font size not found");
      return;
    }
  
    ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
    const oMetrics = ctx.measureText("o");
  
    let fontStyle;
    if (/italic/i.test(styleStr)) {
      fontStyle = "italic";
    } else if (/small\-caps/i.test(styleStr)) {
      fontStyle = "small-caps";
    } else {
      fontStyle = "normal";
    }
  
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
  
    let wordLeftBearing = wordFirstGlyphMetrics.xMin * (lineFontSize / fontObjI.unitsPerEm);
    let wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (lineFontSize / fontObjI.unitsPerEm);
  
  
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
  
  
    const left = 0 - wordLeftBearing + offsetX;
  
    const top = fontDesc + fontAsc + 1;  
  
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
  
  }
  
  
 export async function evalWords(wordsA, wordsB, n){
  
    const lineFontSize = calcLineFontSize(wordsA[0]);
  
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
  
    // let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
    if (baseline != null) {
      baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
    } else {
      baseline = [0, 0];
    }

    canvasAlt.clear();
  
    // Draw the actual words (from the user-provided image)
    const imageDataActual = await drawWordActual([...wordsA, ...wordsB], n, fontAsc, fontDesc);

    canvasAlt.clear();
  
    // Draw the words in wordsA
    for (let i=0;i<wordsA.length;i++) {
      const word = wordsA[i];
      const wordITitleStr = word.getAttribute('title');
      const wordIBox = [...wordITitleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
      await drawWordRender(word, wordIBox[0] - wordBoxUnion[0], lineFontSize);
    }
  
    const imageDataExpectedA = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];
  
    canvasAlt.clear();
  
    // Draw the words in wordsB
    for (let i=0;i<wordsB.length;i++) {
      const word = wordsB[i].cloneNode(true);

      // Set style to whatever it is for wordsA.  This is based on the assumption that "A" is Tesseract Legacy and "B" is Tesseract LSTM (which does not have useful style info).
      word.setAttribute("style", styleStr);
      const wordITitleStr = word.getAttribute('title');
      const wordIBox = [...wordITitleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
      await drawWordRender(word, wordIBox[0] - wordBoxUnion[0], lineFontSize);
    }
  
    const imageDataExpectedB = ctxAlt.getImageData(0, 0, (wordBoxUnion[2] - wordBoxUnion[0] + 1), wordBoxUnion[3] - wordBoxUnion[1] + 1)["data"];
  
    canvasAlt.clear();
  
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
  

  // TODO: This function was written before the various other functions (drawWordRender, drawWordActual).
  // It should be edited to use these to reduce duplicative code. 
  export async function evalWord(word, n, altText = null, view = false){

    if(!word){
      console.log("Word not found");
      return;
    }
    const titleStr = word.getAttribute('title');
    const wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
  
    let wordText = altText ? replaceLigatures(altText) : replaceLigatures(word.textContent);
  
    let titleStrLine = word.parentElement.getAttribute('title');
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
      lineFontSize = getFontSize(globalSettings.defaultFont, xHeight, "o");
    } else if (letterHeight != null) {
      letterHeight = parseFloat(letterHeight[1]);
      descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
      lineFontSize = getFontSize(globalSettings.defaultFont, letterHeight - descHeight, "A");
    }
  
  
    let styleStr = word.getAttribute('style') ?? "";
    let fontSizeStr = styleStr.match(/font\-size\:\s*(\d+)/i)?.[1];
    const wordFontSize = parseFloat(fontSizeStr) || lineFontSize;
  
    if(!wordFontSize){
      console.log("Font size not found");
      return;
    }
  
    ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
    const oMetrics = ctx.measureText("o");
    let linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
    if (baseline != null) {
      baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
    } else {
      baseline = [0, 0];
    }
  
  
    let fontStyle;
    if (/italic/i.test(styleStr)) {
      fontStyle = "italic";
    } else if (/small\-caps/i.test(styleStr)) {
      fontStyle = "small-caps";
    } else {
      fontStyle = "normal";
    }
  
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
    //let kerning;
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
  
    let wordLeftBearing = wordFirstGlyphMetrics.xMin * (lineFontSize / fontObjI.unitsPerEm);
    let wordRightBearing = wordLastGlyphMetrics.rightSideBearing * (lineFontSize / fontObjI.unitsPerEm);
  
  
    let wordWidth1 = ctx.measureText(wordText).width;
    let wordWidth = wordWidth1 - wordRightBearing - wordLeftBearing + (wordText.length - 1) * kerning;
  
    let box_width = wordBox[2] - wordBox[0];
    let box_height = wordBox[3] - wordBox[1];
  
    // If kerning is off, change the kerning value for both the canvas textbox and HOCR
    if (wordText.length > 1 && Math.abs(box_width - wordWidth) > 1) {
      kerning = round3(kerning + (box_width - wordWidth) / (wordText.length - 1));
    }
  
    let fontBoundingBoxDescent = Math.round(Math.abs(fontObjI.descender) * (1000 / fontObjI.unitsPerEm));
    let fontBoundingBoxAscent = Math.round(Math.abs(fontObjI.ascender) * (1000 / fontObjI.unitsPerEm));
  
    let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
    let fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  
    const sinAngle = Math.sin(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));
    const cosAngle = Math.cos(globalThis.pageMetricsObj.angleAll[n] * (Math.PI / 180));
  
  
    const pageDims = globalThis.pageMetricsObj["dimsAll"][n];
    const shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
    const shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;
  
    let angleAdjXLine = 0;
    let angleAdjYLine = 0;
    if (Math.abs(globalThis.pageMetricsObj.angleAll[n] ?? 0) > 0.05) {
  
      const x = linebox[0];
      const y = linebox[3] + baseline[1];
  
      const xRot = x * cosAngle - sinAngle * y;
      const yRot = x * sinAngle + cosAngle * y;
  
      const angleAdjXInt = x - xRot;
      // const angleAdjYInt = y - yRot;
  
      // const angleAdjXInt = sinAngle * (linebox[3] + baseline[1]);
      const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;
  
      angleAdjXLine = angleAdjXInt + shiftX;
      angleAdjYLine = angleAdjYInt + shiftY;
  
  
    }
  
    const angleAdjXWord = Math.abs(globalThis.pageMetricsObj.angleAll[n]) >= 1 ? angleAdjXLine + (1 - cosAngle) * (wordBox[0] - linebox[0]) : angleAdjXLine;
  
    const left = 0 - wordLeftBearing;
  
    const top = fontDesc + fontAsc + 1;
  
    const imgElem = await globalThis.imageAll["binary"][n];
    const img = new fabric.Image(imgElem, {left: 0, top: 0, cropX: wordBox[0]+angleAdjXWord-1, cropY: linebox[3] + baseline[1] - fontAsc + angleAdjYLine-1, width: box_width + 1, height: fontDesc + fontAsc});
  
    globalThis.canvasAlt.setHeight(img.height);
    globalThis.canvasAlt.setWidth(img.width);
  
    canvasAlt.add(img);
  
    canvasAlt.renderAll();
  
    const scaleFactor = canvasAlt.viewportTransform[0] || 1;
    const imageDataActual = ctxAlt.getImageData(0, 0, (wordBox[2] - wordBox[0] + 1), wordBox[3] - wordBox[1] + 1)["data"];
  
    canvasAlt.clear();
  
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
    const imageDataExpected = ctxAlt.getImageData(0, 0, (wordBox[2] - wordBox[0] + 1), wordBox[3] - wordBox[1] + 1)["data"];
  
    let diff = 0;
    let total = 0;
    for(let i=0; i<imageDataActual.length; i++){
      if(imageDataActual[i] != 255 || imageDataExpected[i] != 255){
        total = total + 1;
        if(imageDataActual[i] == 255 || imageDataExpected[i] == 255) {
          diff = diff + 1;
        }  
      }
    }
  
    // Render text (in red) over image (in black)
    // Used for debugging from console
    if(view) {
      // Canvas set to display:none by default
      document.getElementById("d").setAttribute("style", "");
      canvasAlt.clear();
      canvasAlt.add(img);
      textbox.set({fill: "red"});
      await textbox.cloneAsImage(image => {
        image.set({left: left,top:top,originY:"bottom"});
    
        canvasAlt.add(image);
        canvasAlt.renderAll();
      });
      console.log(diff / total);
    }
  
    return diff / total;
  
  }
  
  
  