
// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

export function deleteSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordIDI = selectedObjects[i].wordID;
    deleteHOCRWord(wordIDI);
    window.canvas.remove(selectedObjects[i]);
  }
}

function deleteHOCRWord(word_id){
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
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


export function toggleStyleSelectedWords(style){
  style = style.toLowerCase()

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  const newValue = selectedObjects[0].fontStyle.toLowerCase() == style ? false : true;
  const newValueStr = newValue ? style : "normal";

  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    updateHOCRStyleWord(wordIDI, newValueStr);
    const wordMetricsOrig = calcWordMetrics(wordI.text, wordI.fontFamily, wordI.fontSize, wordI.fontStyle, ctx);

    wordI.fontStyle = newValueStr;
    const wordMetricsNew = calcWordMetrics(wordI.text, wordI.fontFamily, wordI.fontSize, wordI.fontStyle, ctx);
    if(wordI.text.length > 1){
      const wordWidth = wordMetricsNew[0];
      const kerning = (wordI.boxWidth - wordWidth) / (wordI.text.length - 1);
      wordI.charSpacing = kerning * 1000 / wordI.fontSize;
    }
    wordI.left = wordI.left - (wordMetricsNew[1] - wordMetricsOrig[1])

  }
  window.canvas.renderAll();
}

function updateHOCRStyleWord(word_id, value){
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){

    value = value.toLowerCase();

    let styleStr = it.singleNodeValue.getAttribute("style") ?? "";
    styleStr = styleStr.replace(/font\-style[^;]*(;|$)/i,"").replace(/;$/, "");
    styleStr = styleStr.replace(/font\-variant[^;]*(;|$)/i,"").replace(/;$/, "");
    if(value == "italic"){
      styleStr = styleStr + ";font-style:italic";
    } else if(value == "small-caps"){
      styleStr = ";font-variant:small-caps";
    }

    it.singleNodeValue.setAttribute("style", styleStr);
  }
}


function updateHOCRFontWord(word_id, value){
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  if(it.singleNodeValue != null){
    // If set to "Default" the font-family style will be omitted (so the document default style is inherited)
    let styleStr = it.singleNodeValue.getAttribute("style");
    if(styleStr == null && value != "Default"){
      styleStr = "font-family:'" + value + "'";
    } else if(styleStr != null && value != "Default"){
      styleStr = styleStr.replace(/font\-family[^;]*(;|$)/i,"").replace(";$", "");
      styleStr = styleStr + ";font-family:'" + value + "'";
    } else if(styleStr != null && value == "Default"){
      styleStr = styleStr.replace(/font\-family[^;]*(;|$)/i,"").replace(";$", "");
    } else {
      styleStr = "";
    }

    it.singleNodeValue.setAttribute("style", styleStr);
  }
}


export function changeWordFontSize(fontSize){

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
    if(wordI.text.length > 1){
      const wordWidth = calcWordWidth(wordI.text, wordI.fontFamily, wordI.fontSize, wordI.fontStyle, ctx);
      const kerning = (wordI.boxWidth - wordWidth) / (wordI.text.length - 1);
      wordI.charSpacing = kerning * 1000 / wordI.fontSize;
    }

  }
  window.canvas.renderAll();
}

function updateHOCRFontSizeWord(word_id, value){
  console.log(value);
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
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


export function toggleBoundingBoxesSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    wordI.hasControls = true;
    // Only allow left/right scaling
    // This is the only type of scaling that is currently reflected in HOCR, so any other edit would just disappear
    wordI.setControlsVisibility({bl:false,br:false,mb:false,ml:true,mr:true,mt:false,tl:false,tr:false,mtr:false});

  }
}

function updateHOCRBoundingBoxWord(word_id, leftDelta, rightDelta){
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
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

export function changeWordFont(fontName){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  const fontNameCanvas = fontName == "Default" ? globalFont : fontName;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    updateHOCRFontWord(wordIDI, fontName);
    wordI.fontFamily = fontNameCanvas;
    wordI.defaultFontFamily = fontName == "Default" ? true : false;
    if(wordI.text.length > 1){
      const wordWidth = calcWordWidth(wordI.text, wordI.fontFamily, wordI.fontSize, wordI.fontStyle, ctx);
      const kerning = (wordI.boxWidth - wordWidth) / (wordI.text.length - 1);
      wordI.charSpacing = kerning * 1000 / wordI.fontSize;
    }

  }
  window.canvas.renderAll();
}



export function toggleSuperSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;
  const wordI = selectedObjects[0];
  const wordIDI = wordI.wordID;
  updateHOCRSuperWord(wordIDI, !wordI.wordSup);
  hocrAll[currentPage] = window.xmlDoc.documentElement.outerHTML;

  renderPageQueue(currentPage);
}

function updateHOCRSuperWord(word_id, value){
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
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
  let it = window.xmlDoc.evaluate("//span[@id='" + word_id + "']", window.xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
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
    objectI.set('top', objectI.topOrig + (parseInt(value) - 50));
  }

  window.canvas.requestRenderAll();

}

export function adjustBaselineRangeChange(value){
  console.log("Mouseup");
  value = parseInt(value) - 50;

  for(let i=0;i<objectsLine.length;i++){
    const wordI = objectsLine[i];
    const wordIDI = wordI.wordID;
    let it = xmlDoc.evaluate("//span[@id='" + wordIDI + "']", xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
    if(it.singleNodeValue != null){
      let titleStr = it.singleNodeValue.getAttribute("title");
      let wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
      titleStr = titleStr.replace(/bbox[^;]+/, "");

      wordBox[1] = wordBox[1] + value;
      wordBox[3] = wordBox[3] + value;

      titleStr = "bbox " + wordBox.join(" ") + ";" + titleStr;

      it.singleNodeValue.setAttribute("title", titleStr);
    }
  }

  let it = xmlDoc.evaluate("//span[@id='" + objectsLine[0].wordID + "']", xmlDoc.documentElement, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);
  let line = it.singleNodeValue.parentElement;
  let titleStrLine = line.getAttribute('title');

  let lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});

  lineBox[1] = lineBox[1] + value;
  lineBox[3] = lineBox[3] + value;

  titleStrLine = "bbox " + lineBox.join(" ") + ";" + titleStrLine;

  line.setAttribute("title", titleStrLine);

}
