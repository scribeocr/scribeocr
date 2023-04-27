
// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import { calcWordMetrics } from "./textUtils.js"
import { renderPageQueue } from "../main.js"


export function deleteSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordIDI = selectedObjects[i].wordID;
    deleteHOCRWord(wordIDI);
    window.canvas.remove(selectedObjects[i]);
    canvas.renderAll();
  }
}

function deleteHOCRWord(word_id){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    let lineNode = it.singleNodeValue.parentNode;
    // If there are no other words on the line, remove the entire line.
    if(lineNode.childElementCount == 1){
      lineNode.parentNode.removeChild(lineNode);
    } else {
      lineNode.removeChild(it.singleNodeValue);
    }
  }
}


export async function toggleStyleSelectedWords(style){
  style = style.toLowerCase()

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;

  // If first word style already matches target style, disable the style.
  const enable = selectedObjects[0].fontStyle.toLowerCase() == style || style == "small-caps" && /small caps$/i.test(selectedObjects[0].fontFamily) ? false : true;
  const newValueStr = enable ? style : "normal";

  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    updateHOCRStyleWord(wordIDI, newValueStr);

    if(enable && style == "small-caps"){
        wordI.fontFamily = wordI.fontFamily.replace(/\s+small caps$/i, "") + " Small Caps";
        wordI.fontStyle = "normal";
    } else {
        wordI.fontFamily = wordI.fontFamily.replace(/\s+small caps$/i, "");
        wordI.fontStyle = newValueStr;
    }

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}

function updateHOCRStyleWord(word_id, value){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){

    value = value.toLowerCase();

    let styleStr = it.singleNodeValue.getAttribute("style") ?? "";
    styleStr = styleStr.replace(/font\-style[^;]*(;|$)/i,"").replace(/;$/, "");
    styleStr = styleStr.replace(/font\-variant[^;]*(;|$)/i,"").replace(/;$/, "");
    if(value == "italic"){
      styleStr = styleStr + ";font-style:italic";
    } else if(value == "small-caps"){
      styleStr = styleStr + ";font-variant:small-caps";
    }

    it.singleNodeValue.setAttribute("style", styleStr);
  }
}


function updateHOCRFontWord(word_id, value){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    // If set to "Default" the font-family style will be omitted (so the document default style is inherited)
    let styleStr = it.singleNodeValue.getAttribute("style");
    if(styleStr == null && value != "Default"){
      styleStr = "font-family:" + value;
    } else if(styleStr != null && value != "Default"){
      styleStr = styleStr.replace(/font\-family[^;]*(;|$)/i,"").replace(";$", "");
      styleStr = styleStr + ";font-family:" + value;
    } else if(styleStr != null && value == "Default"){
      styleStr = styleStr.replace(/font\-family[^;]*(;|$)/i,"").replace(";$", "");
    } else {
      styleStr = "";
    }

    it.singleNodeValue.setAttribute("style", styleStr);
  }
}


export async function changeWordFontSize(fontSize){

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;
  if(fontSize == "plus"){
    fontSize = parseFloat(selectedObjects[0].fontSize) + 1;
  } else if(fontSize == "minus"){
    fontSize = parseFloat(selectedObjects[0].fontSize) - 1;
  }

  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    updateHOCRFontSizeWord(wordIDI, fontSize);
    document.getElementById("fontSize").value = fontSize;
    wordI.fontSize = fontSize;

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}

function updateHOCRFontSizeWord(word_id, value){
  console.log(value);
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    // If set to "Default" the font-family style will be omitted (so the document default style is inherited)
    let styleStr = it.singleNodeValue.getAttribute("style");
    if(styleStr == null && value != "Default"){
      styleStr = "font-size:" + value + "px";
    } else if(styleStr != null && value != "Default"){
      styleStr = styleStr.replace(/font\-size[^;]*(;|$)/i,"").replace(/;(?=;|$)/, "");
      styleStr = styleStr + ";font-size:" + value + "px";
    } else if(styleStr != null && value == "Default"){
      styleStr = styleStr.replace(/font\-size[^;]*(;|$)/i,"").replace(/;(?=;|$)/, "");
    } else {
      styleStr = "";
    }

    it.singleNodeValue.setAttribute("style", styleStr);
  }
}

export function updateHOCRBoundingBoxWord(word_id, leftDelta, rightDelta){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){

    let titleStr = it.singleNodeValue.getAttribute("title");
    let wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
    titleStr = titleStr.replace(/bbox[^;]+/, "");

    wordBox[0] = wordBox[0] + leftDelta;
    wordBox[2] = wordBox[2] + rightDelta;

    titleStr = "bbox " + wordBox.join(" ") + ";" + titleStr;

    it.singleNodeValue.setAttribute("title", titleStr);
  }
}

export async function changeWordFont(fontName){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  let fontNameCanvas = fontName == "Default" ? globalSettings.defaultFont : fontName;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    fontNameCanvas = /Small Caps$/.test(wordI.fontFamily) ? fontName + " Small Caps" : fontName;
    updateHOCRFontWord(wordIDI, fontName);
    wordI.fontFamily = fontNameCanvas;
    wordI.defaultFontFamily = fontName == "Default" ? true : false;

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}


// Update word textbox on canvas following changes. 
// Whenever a user edits a word in any way (including content and font/style), 
// the position and character spacing need to be re-calculated so they still overlay with the background image. 
export async function updateWordCanvas(wordI) {

  // Re-calculate left position given potentially new left bearing
  const wordMetrics = await calcWordMetrics(wordI.text, wordI.fontFamily, wordI.fontSize, wordI.fontStyle);

  // When the user selects multiple words at the same time, the left coordinate becomes relative to the "group"
  const groupOffset = wordI?.group?.ownMatrixCache?.value[4] || 0;

  wordI.left = wordI.visualLeft - wordMetrics["leftSideBearing"] - groupOffset;

  // Re-calculate character spacing (if the word has multiple letters)
  if(wordI.text.length > 1){
    const visualWidthNew = wordMetrics["visualWidth"];
    const kerning = (wordI.visualWidth - visualWidthNew) / (wordI.text.length - 1);
    wordI.charSpacing = kerning * 1000 / wordI.fontSize;
  }

}


export function toggleSuperSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    updateHOCRSuperWord(wordIDI, !wordI.wordSup);
  }
  globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc.documentElement.outerHTML;

  renderPageQueue(currentPage.n);
}

function updateHOCRSuperWord(word_id, value){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    let inner = it.singleNodeValue.innerHTML;
    console.log(inner);
    if(/\<sup\>/i.test(inner) && !value){
      inner = inner.replace(/^\s*\<sup\>/i, "");
      inner = inner.replace(/\<\/sup\>\s*$/i, "");
    } else if(value && !/\<sup\>/i.test(inner)){
      inner = "<sup>" + inner + "</sup>";
    }
    console.log(inner);
    it.singleNodeValue.innerHTML = inner;
  }
}


// Function for updating the value of HOCR text for word with ID "word_id"
// Assumes that IDs are unique.
export function updateHOCRWord(word_id, new_text){
  let it = currentPage.xmlDoc.evaluate("//span[@id='" + word_id + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    it.singleNodeValue.firstChild.textContent = new_text;
  }
}


var objectsLine;
export function adjustBaseline(){

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;

  // For some reason the text jumps around the page when >1 word is selected
  window.canvas.setActiveObject(selectedObjects[0]);

  document.getElementById("rangeBaseline").value = 100 + selectedObjects[0].baselineAdj;
  window.bsCollapse.show();

  const lineI = selectedObjects[0].line;
  objectsLine = canvas.getObjects().filter(x => x["line"] == lineI);

  for(let i=0;i<objectsLine.length;i++){
    objectsLine[i].objectCaching = true;
    objectsLine[i].ownCaching = true;
    objectsLine[i].renderCache()
  }

}

export function adjustBaselineRange(value){
  for(let i=0;i<objectsLine.length;i++){
    const objectI = objectsLine[i];
    objectI.set('top', objectI.topOrig + (parseInt(value) - 100));
  }

  window.canvas.requestRenderAll();

}

export function adjustBaselineRangeChange(value){
  console.log("Mouseup");

  value = parseInt(value) - 100;
  let valueChange = value - objectsLine[0].baselineAdj;

  for(let i=0;i<objectsLine.length;i++){
    const wordI = objectsLine[i];
    const wordIDI = wordI.wordID;

    wordI.set('baselineAdj', value);
    let it = currentPage.xmlDoc.evaluate("//span[@id='" + wordIDI + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    if(it.singleNodeValue != null){
      let titleStr = it.singleNodeValue.getAttribute("title");
      let wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
      titleStr = titleStr.replace(/bbox[^;]+/, "");

      wordBox[1] = wordBox[1] + valueChange;
      wordBox[3] = wordBox[3] + valueChange;

      titleStr = "bbox " + wordBox.join(" ") + ";" + titleStr;

      it.singleNodeValue.setAttribute("title", titleStr);
    }
  }

  let it = currentPage.xmlDoc.evaluate("//span[@id='" + objectsLine[0].wordID + "']", currentPage.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  let line = it.singleNodeValue.parentElement;
  let titleStrLine = line.getAttribute('title');

  let lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});

  lineBox[1] = lineBox[1] + valueChange;
  lineBox[3] = lineBox[3] + valueChange;

  titleStrLine = "bbox " + lineBox.join(" ") + ";" + titleStrLine;

  line.setAttribute("title", titleStrLine);

}
