
// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

import { renderText } from './js/exportRenderText.js';
import { renderHOCR } from './js/exportRenderHOCR.js';

import { renderPage } from './js/renderPage.js';

import { getFontSize, calcWordWidth, calcWordMetrics } from "./js/textUtils.js"

import { optimizeFont, calculateOverallFontMetrics, createSmallCapsFont } from "./js/fontOptimize.js";
import { loadFontBrowser, loadFont, loadFontFamily } from "./js/fontUtils.js";

import { getRandomInt, getRandomAlphanum, mean50, quantile, sleep, readBlob, readTextFile, round3 } from "./js/miscUtils.js";

import { deleteSelectedWords, toggleStyleSelectedWords, changeWordFontSize, toggleBoundingBoxesSelectedWords, changeWordFont, toggleSuperSelectedWords,
  updateHOCRWord, adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, updateHOCRBoundingBoxWord } from "./js/interfaceEdit.js";
import { changeDisplayFont, changeZoom, adjustMarginRange, adjustMarginRangeChange } from "./js/interfaceView.js";

// Global variables containing fonts represented as OpenType.js objects and array buffers (respectively)
var leftGlobal;

window.canvas = new fabric.Canvas('c');
window.ctx = canvas.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvas.overlayVpt = false;

// Disable objectCaching (significant improvement to render time)
fabric.Object.prototype.objectCaching = false;
// Disable movement for all fabric objects
fabric.Object.prototype.hasControls = false;
fabric.Object.prototype.lockMovementX = true;
fabric.Object.prototype.lockMovementY = true;

fabric.IText.prototype.toObject = (function(toObject) {
  return function() {
    return fabric.util.object.extend(toObject.call(this), {
      fill_proof: this.fill_proof,
      fill_ebook: this.fill_ebook,
      wordID: this.wordID,
      boxWidth: this.boxWidth,
      defaultFontFamily: this.defaultFontFamily
    });
  };
})(fabric.IText.prototype.toObject);

// Displaying bounding boxes is useful for cases where text is correct but word segmentation is wrong
// https://stackoverflow.com/questions/51233082/draw-border-on-fabric-textbox-when-its-not-selected
var originalRender = fabric.Textbox.prototype._render;
fabric.IText.prototype._render = function(ctx) {
  originalRender.call(this, ctx);
  //Don't draw border if it is active(selected/ editing mode)
  //if (this.selected) return;
  if(this.showTextBoxBorder){
    var w = this.width,
      h = this.height,
      x = -this.width / 2,
      y = -this.height / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.closePath();
    var stroke = ctx.strokeStyle;
    ctx.strokeStyle = this.textboxBorderColor;
    ctx.stroke();
    ctx.strokeStyle = stroke;
  }
}
//fabric.IText.prototype.cacheProperties = fabric.IText.prototype.cacheProperties.concat('selected');


var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
})


window.globalFont = "Libre Baskerville";
window.currentPage = 0;



var parser = new DOMParser();

var leftAdjX;
var doc;
var backgroundImage;
var renderStatus;
var pdfDoc;
var imageAll = [];
var imageMode, pdfMode, resumeMode;

loadFontFamily("Open Sans", window.fontMetricsObj);
loadFontFamily("Libre Baskerville", window.fontMetricsObj);

var fs = new Filer.FileSystem()
fs.readFileSync = fs.readFile

const autoRotateCheckbox = document.getElementById('autoRotateCheckbox');
const autoMarginCheckbox = document.getElementById('autoMarginCheckbox');
const showMarginCheckbox = document.getElementById('showMarginCheckbox');

const upload = document.getElementById('uploader');
const canvas2 = document.getElementById('d');
const ctx2 = canvas2.getContext("2d");

window.bsCollapse = new bootstrap.Collapse(document.getElementById("collapseRange"), {toggle: false});




// Add various event listners to HTML elements
document.getElementById('next').addEventListener('click', onNextPage);
document.getElementById('prev').addEventListener('click', onPrevPage);
document.getElementById('uploader').addEventListener('change', recognize);

document.getElementById('fontMinus').addEventListener('click', () => {changeWordFontSize('minus')});
document.getElementById('fontPlus').addEventListener('click', () => {changeWordFontSize('plus')});
document.getElementById('fontSize').addEventListener('change', () => {changeWordFontSize(event.target.value)});
document.getElementById('wordFont').addEventListener('change', () => {changeWordFont(event.target.value)});


document.getElementById('styleItalic').addEventListener('click', () => {toggleStyleSelectedWords('italic')});
document.getElementById('styleSmallCaps').addEventListener('click', () => {toggleStyleSelectedWords('small-caps')});
document.getElementById('styleSuper').addEventListener('click', toggleSuperSelectedWords);

document.getElementById('editBoundingBox').addEventListener('click', toggleBoundingBoxesSelectedWords);
document.getElementById('editBaseline').addEventListener('click', adjustBaseline);

document.getElementById('rangeBaseline').addEventListener('input', () => {adjustBaselineRange(event.target.value)});
document.getElementById('rangeBaseline').addEventListener('mouseup', () => {adjustBaselineRangeChange(event.target.value)});

document.getElementById('delete').addEventListener('click', deleteSelectedWords);

document.getElementById('addWord').addEventListener('click', addWordClick);
document.getElementById('reset').addEventListener('click', clearFiles);

document.getElementById('zoomMinus').addEventListener('click', () => {changeZoom('minus')});
document.getElementById('zoomInput').addEventListener('change', () => {changeZoom(event.target.value)});
document.getElementById('zoomPlus').addEventListener('click', () => {changeZoom('plus')});

document.getElementById('displayFont').addEventListener('click', () => {changeDisplayFont(event.target.value)});
document.getElementById('optimizeFont').addEventListener('click', () => {optimizeFontClick(event.target.checked)});

document.getElementById('confThreshHigh').addEventListener('change', () => {renderPageQueue(window.currentPage, 'screen', false)});
document.getElementById('confThreshMed').addEventListener('change', () => {renderPageQueue(window.currentPage, 'screen', false)});

document.getElementById('autoRotateCheckbox').addEventListener('click', () => {renderPageQueue(window.currentPage, 'screen', false)});
document.getElementById('autoMarginCheckbox').addEventListener('click', () => {renderPageQueue(window.currentPage, 'screen', false)});
document.getElementById('showMarginCheckbox').addEventListener('click', () => {renderPageQueue(window.currentPage, 'screen', false)});
document.getElementById('showBoundingBoxes').addEventListener('click', () => {renderPageQueue(window.currentPage, 'screen', false)});

document.getElementById('rangeLeftMargin').addEventListener('input', () => {adjustMarginRange(event.target.value)});
document.getElementById('rangeLeftMargin').addEventListener('mouseup', () => {adjustMarginRangeChange(event.target.value)});

document.getElementById('save2').addEventListener('click', handleDownload);
document.getElementById('pdfPagesLabel').addEventListener('click', updatePdfPagesLabel);

document.getElementById('formatLabelOptionPDF').addEventListener('click', () => {setFormatLabel("pdf")});
document.getElementById('formatLabelOptionHOCR').addEventListener('click', () => {setFormatLabel("hocr")});
document.getElementById('formatLabelOptionText').addEventListener('click', () => {setFormatLabel("text")});

document.getElementById('displayMode').addEventListener('change', () => {selectDisplayMode(event.target.value, backgroundOpts)});


document.getElementById('pdfPageMin').addEventListener('keyup', function(event){
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});
document.getElementById('pdfPageMax').addEventListener('keyup', function(event){
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

document.getElementById('pageNum').addEventListener('keyup', function(event){
  if (event.keyCode === 13) {
    if(document.getElementById('pageNum').value <= parseInt(document.getElementById('pageCount').textContent) && document.getElementById('pageNum').value > 0){
      window.currentPage = document.getElementById('pageNum').value - 1;
      document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
      canvas.viewportTransform[4] = window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
      renderPageQueue(window.currentPage);

    } else {
      document.getElementById('pageNum').value = window.currentPage + 1;
    }
  }
});


function updatePdfPagesLabel(){
  let minValue = parseInt(document.getElementById('pdfPageMin').value);
  let maxValue = parseInt(document.getElementById('pdfPageMax').value);
  let pageCount = parseInt(document.getElementById('pageCount').textContent);

  minValue = Math.max(minValue, 1);
  maxValue = Math.min(maxValue, pageCount);

  let pagesStr;
  if(minValue > 0 && maxValue > 0 && (minValue > 1 || maxValue < pageCount)){
    pagesStr = " Pages: " + minValue + "–" + maxValue;
  } else {
    pagesStr = " Pages: All";
    minValue = 1;
    maxValue = pageCount;
  }

  document.getElementById('pdfPageMin').value = isFinite(minValue) ? minValue : 1;
  document.getElementById('pdfPageMax').value = isFinite(maxValue) ? maxValue : "";
  document.getElementById('pdfPagesLabelText').innerText = pagesStr;

}


function setFormatLabel(x){
  if(x.toLowerCase() == "pdf"){
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`

    document.getElementById("formatLabelText").innerHTML = "PDF";
    document.getElementById("downloadFileName").value = document.getElementById("downloadFileName").value.replace(/\.\w{1,4}$/, "") + ".pdf";
  } else if(x.toLowerCase() == "hocr"){
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`

    document.getElementById("formatLabelText").innerHTML = "HOCR";
    document.getElementById("downloadFileName").value = document.getElementById("downloadFileName").value.replace(/\.\w{1,4}$/, "") + ".hocr";
  } else if(x.toLowerCase() == "text"){
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`

    document.getElementById("formatLabelText").innerHTML = "Text";
    document.getElementById("downloadFileName").value = document.getElementById("downloadFileName").value.replace(/\.\w{1,4}$/, "") + ".txt";

  }
}

// When the navbar is "sticky", it does not automatically widen for large canvases (when the canvas size is larger than the viewport).
// However, when the navbar is fixed, the canvas does not move out of the way of the navbar.
// Therefore, the navbar is set to fixed, and the canvas is manually moved up/down when tabs are shown/collapsed.
var tabHeightObj = {"import":66,"view":117,"edit":104,"layout":88,"download":104,"about":55}

document.getElementById('nav-import').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["import"] + "px";
})
document.getElementById('nav-import').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["import"] + "px";
})

document.getElementById('nav-view').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["view"] + "px";
})
document.getElementById('nav-view').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["view"] + "px";
})

document.getElementById('nav-edit').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["edit"] + "px";
})
document.getElementById('nav-edit').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["edit"] + "px";
})

document.getElementById('nav-layout').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["layout"] + "px";
})
document.getElementById('nav-layout').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["layout"] + "px";
})

document.getElementById('nav-download').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["download"] + "px";
})
document.getElementById('nav-download').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["download"] + "px";
})

document.getElementById('nav-about').addEventListener('hide.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["about"] + "px";
})
document.getElementById('nav-about').addEventListener('show.bs.collapse', function () {
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["about"] + "px";
})


var newWordInit = true;


var rect, origX, origY;
function addWordClick(){
  newWordInit = false;

  let isDown = false;
  let isMoved = false;

  canvas.on('mouse:down', function(o){
      isDown = true;
      let pointer = canvas.getPointer(o.e);
      origX = pointer.x;
      origY = pointer.y;
      rect = new fabric.Rect({
          left: origX,
          top: origY,
          originX: 'left',
          originY: 'top',
          width: pointer.x-origX,
          height: pointer.y-origY,
          angle: 0,
          fill: 'rgba(255,0,0,0.5)',
          transparentCorners: false
      });
      canvas.add(rect);
  });

  canvas.on('mouse:move', function(o){
      if (!isDown) return;
      isMoved = true;
      let pointer = canvas.getPointer(o.e);

      if(origX>pointer.x){
          rect.set({ left: Math.abs(pointer.x) });
      }
      if(origY>pointer.y){
          rect.set({ top: Math.abs(pointer.y) });
      }

      rect.set({ width: Math.abs(origX - pointer.x) });
      rect.set({ height: Math.abs(origY - pointer.y) });


      canvas.renderAll();
  });

  canvas.on('mouse:up:before', function(o){
    if(newWordInit){return;}
    if (!isMoved) return;
    newWordInit = true;
    canvas.__eventListeners = {}
    isDown = false;

    let fillColorHex = "#00ff7b";

    let opacity_arg, fill_arg;
    if(document.getElementById('displayMode').value == "invis"){
      opacity_arg = 0;
      fill_arg = "black";
    } else if(document.getElementById('displayMode').value == "ebook") {
      opacity_arg = 1;
      fill_arg = "black";
    } else {
      opacity_arg = 1;
      fill_arg = fillColorHex;
    }

    let lines = xmlDoc.getElementsByClassName("ocr_line");

  let lineBoxChosen, baselineChosen, titleStrLineChosen, wordIDNew;
  let wordText = "A";
  // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
  let angleAdjXRect = 0;
  let angleAdjYRect = 0;
  if(autoRotateCheckbox.checked && Math.abs(window.pageMetricsObj["angleAll"][window.currentPage] ?? 0) > 0.05){
    angleAdjXRect = Math.sin(window.pageMetricsObj["angleAll"][window.currentPage] * (Math.PI / 180)) * (rect.top + rect.height * 0.5);
    angleAdjYRect = Math.sin(window.pageMetricsObj["angleAll"][window.currentPage] * (Math.PI / 180)) * (rect.left + angleAdjXRect /2) * -1;
  }

  // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
  let rectTopHOCR = rect.top - angleAdjYRect;
  let rectBottomHOCR = rect.top + rect.height - angleAdjYRect;

  let rectTopCoreHOCR = Math.round(rect.top + rect.height * 0.2 - angleAdjYRect);
  let rectBottomCoreHOCR = Math.round(rect.top + rect.height * 0.8 - angleAdjYRect);

  let rectLeftHOCR = rect.left - angleAdjXRect - leftAdjX;
  let rectRightHOCR = rect.left + rect.width - angleAdjXRect - leftAdjX;
  let rectMidHOCR = rect.left + rect.width * 0.5 - angleAdjXRect - leftAdjX;

  let lineChosen = -1;
  let maxBelow = -1;
  let minAbove = -1;
  for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let titleStrLine = line.getAttribute('title');
      //titleStrLineArray[i] = titleStrLine;
      let lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
      let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
      //lineBoxArr[i] = lineBox;

      let boxOffsetY = 0;

      let lineBoxAdj = lineBox.slice();
      if(baseline != null){
        baseline = baseline.slice(1,5).map(function (x) {return parseFloat(x);});

        // Adjust box such that top/bottom approximate those coordinates at the leftmost point.
        if(baseline[0] < 0){

          lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        } else {
          lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];

        }

        boxOffsetY = (rectMidHOCR - lineBoxAdj[0]) * baseline[0];

      } else {
        baseline = [0,0];
      }

      let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
      let lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;

      // If bottom of candidate line is above top of new word, move to next line
      if(lineBottomHOCR < rectTopCoreHOCR){
        maxBelow = i;
        continue;
      // If top of candidate line is above bottom of new word, this is the correct line
    } else if(lineTopHOCR < rectBottomCoreHOCR){
        lineChosen = i;
        lineBoxChosen = lineBox;
        baselineChosen = baseline;
        titleStrLineChosen = titleStrLine;
        break;
      // Otherwise, a new line needs to be created
      } else {
        minAbove = i;
        break;
      }
  }

  let top;
  let fontSize;

  if(lineChosen >= 0){
    let wordChosen = -1;
    let wordChosenID;
    let wordChosenXml;
    let words = lines[lineChosen].getElementsByClassName("ocrx_word");

    for (let i = 0; i < words.length; i++) {
      let word = words[i]

      let titleStr = word.getAttribute('title') ?? "";
      let styleStr = word.getAttribute('style') ?? "";

      if (word.childNodes[0].textContent.trim() == "") { continue; }

      let box = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);})

      if(box[2] < rect.left){
        if(i + 1 == words.length){
          wordChosen = i;
          wordChosenID = word.getAttribute('id');
          wordChosenXml = word;
          break;
        } else {
          continue;
        }
      } else {
        wordChosen = i-1;
        wordChosenID = word.getAttribute('id');
        wordChosenXml = word;
        break;
      }

      box_width = box[2] - box[0];
      let box_height = box[3] - box[1];
    }

    let wordBox = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

    // Append 3 random characters to avoid conflicts without having to keep track of all words
    wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
    const wordXmlNewStr = '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + wordBox.join(' ') + ';x_wconf 100">' + wordText + '</span>'

    const wordXmlNew = parser.parseFromString(wordXmlNewStr, "text/xml");

    if(wordChosen + 1 == words.length){
      wordChosenXml.insertAdjacentElement("afterend", wordXmlNew.firstChild);

    } else {
      wordChosenXml.insertAdjacentElement("beforebegin", wordXmlNew.firstChild);
    }

    // TODO: Update metrics of lines if a first/last word is added
    // if(wordChosen == 0 | wordChosen == words.length){
    //
    // }

  } else {
    if(maxBelow >= 0){
      let line = lines[maxBelow];
      let word = line.getElementsByClassName("ocrx_word")[0];
      let wordID = word.getAttribute('id');
      wordIDNew = wordID.replace(/(?<=_\w{1,5}_)\w+/, "$&" + getRandomAlphanum(3).join(''));
      titleStrLineChosen = line.getAttribute('title');
    } else {
      let line = lines[0];
      let word = line.getElementsByClassName("ocrx_word")[0];
      let wordID = word.getAttribute('id');
      wordIDNew = wordID.replace(/(?<=_\w{1,5}_)\w+/, "$&" + getRandomAlphanum(3).join(''));
      titleStrLineChosen = line.getAttribute('title');
    }

    lineBoxChosen = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

    // If new line is between two existing lines, use metrics from surrounding line if the textbox could plausibly be referring to the same font.
    // Otherwise, assume the textbox height is the "A" height.
    let sizeStr;
    if(maxBelow == -1 | maxBelow + 1 == lines.length){
      sizeStr = "x_size " + Math.round(rect.height) + ";";
      baselineChosen = [0,0];

    } else {
      let letterHeight = titleStrLineChosen.match(/x_size\s+[\d\.\-]+/);

      let ascHeight = titleStrLineChosen.match(/x_ascenders\s+[\d\.\-]+/);
      let descHeight = titleStrLineChosen.match(/x_descenders\s+[\d\.\-]+/);
      letterHeight = letterHeight != null ? letterHeight[0] : "";
      ascHeight = ascHeight != null ? ascHeight[0] : "";
      descHeight = descHeight != null ? descHeight[0] : "";
      sizeStr = [letterHeight,ascHeight,descHeight].join(';');

      // Check if these stats are significantly different from the box the user specified
      let letterHeightFloat = letterHeight.match(/[\d\.\-]+/);
      let descHeightFloat = descHeight.match(/[\d\.\-]+/);
      letterHeightFloat = letterHeightFloat != null ? parseFloat(letterHeightFloat[0]) : 0;
      descHeightFloat = descHeightFloat != null ? parseFloat(descHeightFloat[0]) : 0;

      if((letterHeightFloat - descHeightFloat) > rect.height * 1.5){
        sizeStr = "x_size " + Math.round(rect.height) + ";";
        baselineChosen = [0,0];

      }

      let baselineStr = titleStrLineChosen.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
      if(baselineStr != null){
        baselineChosen = baselineStr.slice(1,5).map(function (x) {return parseInt(x);});
      } else {
        baselineChosen = [0,0];
      }


    }

    titleStrLineChosen = 'bbox '+ lineBoxChosen.join(' ') + ';baseline ' + baselineChosen.join(' ') + ';' + sizeStr;


    let lineXmlNewStr = '<span class="ocr_line" title="' + titleStrLineChosen + '">';
    lineXmlNewStr = lineXmlNewStr + '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + lineBoxChosen.join(' ') + ';x_wconf 100">' + wordText + '</span>'
    lineXmlNewStr = lineXmlNewStr + "</span>"

    const lineXmlNew = parser.parseFromString(lineXmlNewStr, "text/xml");

    if(maxBelow >= 0){
      let line = lines[maxBelow];
      line.insertAdjacentElement("afterend", lineXmlNew.firstChild);
    } else {
      let line = lines[0];
      line.insertAdjacentElement("beforebegin", lineXmlNew.firstChild);
    }


  }

    // Adjustments are recalculated using the actual bounding box (which is different from the initial one calculated above)
    let angleAdjX = 0;
    let angleAdjY = 0;
    if(autoRotateCheckbox.checked && Math.abs(window.pageMetricsObj["angleAll"][window.currentPage] ?? 0) > 0.05){
      angleAdjX = Math.sin(window.pageMetricsObj["angleAll"][window.currentPage] * (Math.PI / 180)) * (lineBoxChosen[3] + baselineChosen[1]);
      angleAdjY = Math.sin(window.pageMetricsObj["angleAll"][window.currentPage] * (Math.PI / 180)) * (lineBoxChosen[0] + angleAdjX /2) * -1;
    }

    let letterHeight = titleStrLineChosen.match(/(?<=x_size\s+)[\d\.\-]+/);
    let ascHeight = titleStrLineChosen.match(/(?<=x_ascenders\s+)[\d\.\-]+/);
    let descHeight = titleStrLineChosen.match(/(?<=x_descenders\s+)[\d\.\-]+/);

    if(letterHeight != null && ascHeight != null && descHeight != null){
       letterHeight = parseFloat(letterHeight[0]);
       ascHeight =  parseFloat(ascHeight[0]);
       descHeight = parseFloat(descHeight[0]);
       let xHeight = letterHeight - ascHeight - descHeight;
       fontSize = getFontSize(window.globalFont, xHeight, "o", ctx);
     } else if(letterHeight != null){
       letterHeight = parseFloat(letterHeight[0]);
       descHeight = descHeight != null ? parseFloat(descHeight[0]) : 0;
       fontSize = getFontSize(window.globalFont, letterHeight - descHeight, "A", ctx);
     }

    ctx.font = 1000 + 'px ' + window.globalFont;
    const oMetrics = ctx.measureText("o");
    const jMetrics = ctx.measureText("gjpqy");
    ctx.font = fontSize + 'px ' + window.globalFont;

    // The function fontBoundingBoxDescent currently is not enabled by default in Firefox.
    // Can return to this simpler code if that changes.
    // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics/fontBoundingBoxDescent
    //let fontDesc = (jMetrics.fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    let fontBoundingBoxDescent = Math.round(Math.abs(fontObj[window.globalFont]["normal"].descender) * (1000 / fontObj[window.globalFont]["normal"].unitsPerEm));

    let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    top = lineBoxChosen[3] + baselineChosen[1] + fontDesc + angleAdjY;

    let textbox = new fabric.IText(wordText, { left: rect.left,
    top: top,
    leftOrig:rect.left,
    topOrig:top,
    baselineAdj:0,
    wordSup:false,

    originY: "bottom",
    fill: fill_arg,
    fill_proof: fillColorHex,
    fill_ebook: 'black',
    fontFamily: window.globalFont,
    fontStyle: "normal",
    wordID: wordIDNew,
    //line: i,
    boxWidth: rect.width,
    defaultFontFamily: true,
    opacity: 1,
    //charSpacing: kerning * 1000 / wordFontSize
    fontSize: fontSize
  });


    textbox.on('editing:exited', function() {
      if(this.hasStateChanged){
        if(document.getElementById("smartQuotes").checked && /[\'\"]/.test(this.text)){
          let textInt = this.text;
          textInt = textInt.replace(/(?<=^|[-–—])\'/, "‘");
          textInt = textInt.replace(/(?<=^|[-–—])\"/, "“");
          textInt = textInt.replace(/\'(?=$|[-–—])/, "’");
          textInt = textInt.replace(/\"(?=$|[-–—])/, "”");
          textInt = textInt.replace(/(?<=[a-z])\'(?=[a-z]$)/i, "’");
          this.text = textInt;
        }
        const wordWidth = calcWordWidth(this.text, this.fontFamily, this.fontSize, this.fontStyle);
        if(this.text.length > 1){
          const kerning = round3((this.boxWidth - wordWidth) / (this.text.length - 1));
          this.charSpacing = kerning * 1000 / this.fontSize;
        }
        updateHOCRWord(this.wordID, this.text)
      }
    });
    textbox.on('selected', function() {
      if(!this.defaultFontFamily && Object.keys(fontObj).includes(this.fontFamily)){
        document.getElementById("wordFont").value = this.fontFamily;
      }
      document.getElementById("fontSize").value = this.fontSize;

    });
    textbox.on('deselected', function() {
      document.getElementById("wordFont").value = "Default";
      //document.getElementById("collapseRange").setAttribute("class", "collapse");
      bsCollapse.hide();
      document.getElementById("rangeBaseline").value = 100;
    });

    textbox.on('modified', (opt) => {
    // inspect action and check if the value is what you are looking for
      if(opt.action == "scaleX"){
        const textboxWidth = opt.target.calcTextWidth()
        const wordMetrics = calcWordMetrics(opt.target.text, opt.target.fontFamily, opt.target.fontSize, opt.target.fontStyle);
        const widthCalc = (textboxWidth - wordMetrics[1]) * opt.target.scaleX;

        let rightNow = opt.target.left + widthCalc;
        let rightOrig = opt.target.leftOrig + opt.target.boxWidth;

        updateHOCRBoundingBoxWord(opt.target.wordID, Math.round(opt.target.left - opt.target.leftOrig),Math.round(rightNow - rightOrig));
        if(opt.target.text.length > 1){


          const widthDelta = widthCalc - opt.target.boxWidth;
          if(widthDelta != 0){
            const charSpacingDelta = (widthDelta / (opt.target.text.length - 1)) * 1000 / opt.target.fontSize;
            opt.target.charSpacing = (opt.target.charSpacing ?? 0) + charSpacingDelta;
            opt.target.scaleX = 1;
          }

        }

        opt.target.leftOrig = opt.target.left;
        opt.target.boxWidth = Math.round(rightNow - opt.target.left - wordMetrics[1]);

      }
    });

    canvas.remove(rect);
    canvas.add(textbox);


});
}


function clearFiles(){
  imageAll.length = 0;
  window.hocrAll.length = 0;
  canvas.clear()
  document.getElementById('pageCount').textContent = "";
  document.getElementById('pageNum').value = "";
  document.getElementById("downloadFileName").value = "";
  window.currentPage = 0;
  upload.value = "";
  document.getElementById('optimizeFont').checked = false;
  document.getElementById('optimizeFont').disabled = true;
  document.getElementById('save2').disabled = true;
  document.getElementById('confThreshHigh').disabled = true;
  document.getElementById('confThreshMed').disabled = true;

}

function getXHeight(font, size){
  let exTest = document.getElementById("exTest");
  exTest.setAttribute("style", "display:none;width:1ex;font-family:'" + font + "';font-size:" + size)
  return(getComputedStyle(exTest).width);
}


async function recognize(){

  const curFiles = upload.files;

  if(curFiles.length == 0) return;

  fontMetricObjsMessage["widthObjAll"] = new Array();
  fontMetricObjsMessage["heightObjAll"] = new Array();
  fontMetricObjsMessage["kerningObjAll"] = new Array();
  fontMetricObjsMessage["cutObjAll"] = new Array();
  fontMetricObjsMessage["heightSmallCapsObjAll"] = new Array();
  fontMetricObjsMessage["messageAll"] = new Object();

  window.pageMetricsObj["angleAll"] = new Array();
  window.pageMetricsObj["dimsAll"] = new Array();
  window.pageMetricsObj["leftAll"] = new Array();
  window.pageMetricsObj["angleAdjAll"] = new Array();
  window.pageMetricsObj["manAdjAll"] = new Array();


  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  let imageFilesAll = new Array();
  let hocrFilesAll = new Array();
  let pdfFilesAll = new Array()
  let unsupportedFilesAll = new Array();
  let unsupportedExt = new Object;
  for(let i=0; i<curFiles.length; i++){
    const file = curFiles[i];
    let fileExt = file.name.match(/(?<=\.)[^\.]+$/);
    fileExt = fileExt == null ? "" : fileExt[0];

    if(["png","jpeg", "jpg"].includes(fileExt)){
      imageFilesAll.push(file);
    } else if(["hocr","xml","html"].includes(fileExt)){
      hocrFilesAll.push(file);
    } else if(["pdf"].includes(fileExt)){
      pdfFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  pdfMode = pdfFilesAll.length == 1 ? true : false;
  imageMode = imageFilesAll.length > 0 && !pdfMode ? true : false;


  if(pdfMode){
    let pdfData = await readBlob(pdfFilesAll[0]);
    pdfjsLib.getDocument(pdfData).promise.then(async function(pdfDoc_) {
    pdfDoc = pdfDoc_;
    });
  }




  imageFilesAll.sort();
  hocrFilesAll.sort();

  // Check that input makes sense.  Valid options are:
  // (1) N HOCR files and 0 image files
  // (1) N HOCR files and N image files
  // (1) 1 HOCR file and N image files
  if(hocrFilesAll.length == 0){
    throw new Error('No files with ".hocr" extension detected.')
  } else if(hocrFilesAll.length > 1 && imageMode && hocrFilesAll.length != imageFilesAll.length){
    throw new Error('Detected ' + hocrFilesAll.length + ' hocr files but ' + imageFilesAll.length + " image files.")
  }

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, "");
  downloadFileName = downloadFileName + ".pdf";
  document.getElementById("downloadFileName").value = downloadFileName;

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1 ? true : false;

  //let pageCount, hocrAllRaw, abbyyMode;
  let abbyyMode, hocrStrStart, hocrStrEnd, hocrStrPages, hocrArrPages, pageCount, hocrAllRaw;
  if(singleHOCRMode){
    const singleHOCRMode = true;
     let hocrStrAll = await readTextFile(hocrFilesAll[0]);

     // Check whether input is Abbyy XML
     const node2 = hocrStrAll.match(/(?<=\>)[^\>]+/)[0];
     abbyyMode = /abbyy/i.test(node2) ? true : false;

     if(abbyyMode){
//        hocrStrStart = String.raw`<?xml version="1.0" encoding="UTF-8"?>
// <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
//     "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
// <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
//  <head>
//   <title></title>
//   <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
//   <meta name='ocr-system' content='tesseract 5.0.0-beta-20210916-12-g19cc9' />
//   <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word ocrp_wconf ocrp_lang ocrp_dir ocrp_font ocrp_fsize'/>
//  </head>
//  <body>`;
//
//         hocrStrEnd = String.raw`</body>
// </html>`;

       hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
       hocrArrPages = hocrStrPages.split(/(?=\<page)/);
     } else {

       // Enable confidence threshold input boxes (only used for Tesseract)
       document.getElementById('confThreshHigh').disabled = false;
       document.getElementById('confThreshMed').disabled = false;
       document.getElementById('confThreshHigh').value = 85;
       document.getElementById('confThreshMed').value = 75;

       // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
       resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

       if(resumeMode){
          let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
          let contentStr = fontMetricsStr.match(/(?<=content\=[\"\'])[\s\S]+?(?=[\"\']\/?\>)/i)[0].replace(/&quot;/g, '"');
          window.fontMetricsObj = JSON.parse(contentStr);

       }

       hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
       hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
       hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
       hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
       hocrStrPages = hocrStrPages.trim();

       hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
     }

         pageCount = hocrArrPages.length;
    if(imageMode && hocrArrPages.length != imageFilesAll.length){
      throw new Error('Detected ' + hocrArrPages.length + ' pages in OCR but ' + imageFilesAll.length + " image files.")
    }
    hocrAllRaw = Array(pageCount);
    for(let i=0;i<pageCount;i++){
      hocrAllRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }

  } else {
    const singleHOCRMode = false;
    pageCount = hocrFilesAll.length;
  }

  window.hocrAll = Array(pageCount);
  let imageN = -1;
  let hocrN = -1;
  let firstImg = true;

  const importProgressCollapse = document.getElementById("progress-collapse");
  importProgressCollapse.setAttribute("class", "collapse show");
  const importProgress = document.getElementById("importProgress");
  importProgress.setAttribute("aria-valuenow",0);
  loadCountHOCR = 0;
  if(imageMode){
    importProgress.setAttribute("aria-valuemax", pageCount * 2);
  } else {
    importProgress.setAttribute("aria-valuemax", pageCount);
  }


  for(let i = 0; i < pageCount; i++) {

    // Note: As of Jan 22, exporting PDFs using BMP files is currently bugged in pdfKit (the colors channels can get switched)
    if(imageMode){


      const imageNi = imageN + 1;
      imageN = imageN + 1;

      const image = document.createElement('img');

      // Render to screen after first image is loaded
      if(firstImg){
        image.onload = function(){
          renderPageQueue(0);
        }
        firstImg = false;
      }

      if(pdfMode){
        readPDF(pdfFilesAll[0], imageNi, image);
      } else {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          image.src = reader.result;

          imageAll[imageNi] = image;

          loadCountHOCR = loadCountHOCR + 1;
          const valueMax = parseInt(importProgress.getAttribute("aria-valuemax"));
          importProgress.setAttribute("aria-valuenow",loadCountHOCR);
          if(loadCountHOCR % 5 == 0 | loadCountHOCR == valueMax){
            importProgress.setAttribute("style","width: " + (loadCountHOCR / valueMax) * 100 + "%");
            if(loadCountHOCR == valueMax){
              window.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
              calculateOverallPageMetrics();
            }
          }

        }, false);

        reader.readAsDataURL(imageFilesAll[i]);

      }

    }

    // Process HOCR using web worker, reading from file first if that has not been done already
    if(singleHOCRMode){
      myWorker.postMessage([hocrAllRaw[i], i, abbyyMode]);
    } else {
      const hocrFile = hocrFilesAll[i];
      const hocrNi = hocrN + 1;
      hocrN = hocrN + 1;

      const reader = new FileReader();
      reader.addEventListener("load", () => {

      myWorker.postMessage([reader.result, hocrNi]);

      }, false);

      reader.readAsText(hocrFile);

    }


  }

  document.getElementById('pageNum').value = 1;
  document.getElementById('pageCount').textContent = pageCount;

}

var backgroundOpts = new Object;
// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n, mode = "screen", loadXML = true, lineMode = false, dimsLimit = null){

  if(window.hocrAll.length == 0 || typeof(window.hocrAll[n]) != "string" || imageMode && (imageAll.length == 0 || imageAll[n] == null || imageAll[n].complete != true) || pdfMode && (typeof(pdfDoc) == "undefined")){
    return;
  }

  if(loadXML){
    // Parse the relevant XML (relevant for both Canvas and PDF)
    window.xmlDoc = parser.parseFromString(window.hocrAll[n],"text/xml");
  }

  let defaultFont = window.globalFont ?? "Libre Baskerville";

  let imageN = imageAll[n];

  let imgDims = new Array(2);
  imgDims[1] = window.pageMetricsObj["dimsAll"][n][1];
  imgDims[0] = window.pageMetricsObj["dimsAll"][n][0];


  let canvasDims = new Array(2);
  if(mode == "pdf" && dimsLimit[0] > 0 && dimsLimit[1] > 0){
    canvasDims[1] = dimsLimit[1];
    canvasDims[0] = dimsLimit[0];
  } else {
    canvasDims[1] = window.pageMetricsObj["dimsAll"][n][1];
    canvasDims[0] = window.pageMetricsObj["dimsAll"][n][0];
  }

  // Clear canvas and set new backgound image (relevant for Canvas only)
  if(mode == "screen"){
    canvas.clear();
    canvas.__eventListeners = {};

    let zoomFactor = Math.min(parseFloat(document.getElementById('zoomInput').value) / canvasDims[1], 1);

    canvas.setHeight(canvasDims[0] * zoomFactor);
    canvas.setWidth(canvasDims[1] * zoomFactor);

    canvas.setZoom(zoomFactor);
  } else {
    window.doc.addPage({size:[canvasDims[1],canvasDims[0]],
    margins: 0});
  }

  if(autoRotateCheckbox.checked){
    backgroundOpts.angle = window.pageMetricsObj["angleAll"][n] * -1 ?? 0;
  } else {
    backgroundOpts.angle = 0;
  }

  let marginPx = Math.round(canvasDims[1] * leftGlobal);
  if(showMarginCheckbox.checked && mode == "screen"){
    canvas.viewportTransform[4] = 0;

    let marginLine = new fabric.Line([marginPx,0,marginPx,canvasDims[0]],{stroke:'blue',strokeWidth:1,selectable:false,hoverCursor:'default'});
    canvas.add(marginLine);

    let marginImage = canvas.toDataURL();
    canvas.clear();
    canvas.setOverlayImage(marginImage, canvas.renderAll.bind(canvas), {
      overlayImageLeft: 100,
      overlayImageTop: 100
    });

  }

  leftAdjX = 0;
  if(autoMarginCheckbox.checked  && leftGlobal != null){

    // Adjust page to match global margin unless it would require large transformation (likely error)
    if(window.pageMetricsObj["leftAll"][n] > 0 && Math.abs(marginPx - window.pageMetricsObj["leftAll"][n]) < (window.pageMetricsObj["dimsAll"][window.currentPage][1] / 3)){
      leftAdjX = marginPx - window.pageMetricsObj["leftAll"][n];
    }

    if(autoRotateCheckbox.checked){
      leftAdjX = leftAdjX - (window.pageMetricsObj["angleAdjAll"][n] ?? 0);
    }

    backgroundOpts.left = leftAdjX;
  } else {
    backgroundOpts.left = 0;
  }

  if(mode == "screen"){
    canvas.viewportTransform[4] = window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
  }

  renderStatus = 0;

  if(mode == "screen"){
    if(pdfMode){
      pdfDoc.getPage(n + 1).then((page) => {
              let pdfPage = page;

              const viewport1 = page.getViewport({ scale: 1 });

              const viewport = page.getViewport({ scale: imgDims[1] / viewport1.width });
              // Prepare canvas using PDF page dimensions
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              //context.rotate(45 * Math.PI / 180);
              canvas.height = viewport.height
              canvas.width = viewport.width;
              // Render PDF page into canvas context
              const renderContext = {
                  canvasContext: context,
                  viewport: viewport
              };
              const renderTask = page.render(renderContext);
              return renderTask.promise.then(() => canvas);
          }).then((x) => {
            // If a user rapidly changes pages, it is possible that the background image for
            // page n finishes loading after page n+1 is already loaded.
            if(window.currentPage != n) return;
            backgroundImage = new fabric.Image(x, {objectCaching:false});
            console.log("window.currentPage: " + window.currentPage + "; n: " + n + "; renderStatus: " + renderStatus);
            renderStatus = renderStatus + 1;

            selectDisplayMode(document.getElementById('displayMode').value, backgroundOpts);

            });


    } else if(imageMode){
      backgroundImage = new fabric.Image(imageN,{objectCaching:false});
    }
  } else {
    if(document.getElementById('displayMode').value != "ebook"){
      if(pdfMode){
        await pdfDoc.getPage(n + 1).then((page) => {
                let pdfPage = page;

                const viewport1 = page.getViewport({ scale: 1 });

                //  retina scaling
                const viewport = page.getViewport({ scale: imgDims[1] / viewport1.width });
                // Prepare canvas using PDF page dimensions
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                //context.rotate(45 * Math.PI / 180);
                canvas.height = viewport.height
                canvas.width = viewport.width;
                // Render PDF page into canvas context
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                const renderTask = page.render(renderContext);
                return renderTask.promise.then(() => canvas);
            }).then((x) => {
              let ctx2 = x.getContext('2d');
              let imgData = ctx2.getImageData(0,0,x.width,x.height).data;
              let png;
              if(document.getElementById("binarizeCheckbox").checked){
                png = UPNG.encode([imgData.buffer], x.width,x.height, 2);
              } else {
                png = UPNG.encode([imgData.buffer], x.width,x.height, 0);
              }
              if(mode == "pdf"){
                window.doc.image(png,leftAdjX,0,{align:'left',valign:'top'});
              } else {
                const image = document.createElement('img');
                image.src = png;
                imageAll[n] = image;
              }
              })

      } else if(imageMode){
        window.doc.image(imageN.src,leftAdjX,0,{align:'left',valign:'top'});
      }
    }
  }

  if(mode == "screen"){
    await renderPage(canvas, null, xmlDoc, "screen", defaultFont, lineMode, imgDims, canvasDims, window.pageMetricsObj["angleAll"][n], pdfMode, fontObj, leftAdjX);
  } else {
    await renderPage(canvas, doc, xmlDoc, "pdf", defaultFont, lineMode, imgDims, canvasDims, window.pageMetricsObj["angleAll"][n], pdfMode, fontObj, leftAdjX);
  }


  if(mode == "screen"){
    console.log("window.currentPage: " + window.currentPage + "; n: " + n + "; renderStatus: " + renderStatus);
    if(window.currentPage == n){
      renderStatus = renderStatus + 1;
    }
    await selectDisplayMode(document.getElementById('displayMode').value, backgroundOpts);
  }


}

var working = false;
async function onPrevPage(marginAdj) {
  if (window.currentPage + 1 <= 1 || working) {
    return;
  }
  working = true;
  window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  window.currentPage = window.currentPage - 1;
  document.getElementById('pageNum').value = window.currentPage + 1;

  document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;

  await renderPageQueue(window.currentPage);
  working = false;
}


async function onNextPage() {
   if (window.currentPage + 1 >= window.hocrAll.length || working) {
     return;
   }
   working = true;
   window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;

  window.currentPage = window.currentPage + 1;
  document.getElementById('pageNum').value = window.currentPage + 1;

  document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;

  await renderPageQueue(window.currentPage);
  working = false;
}


async function optimizeFontClick(value){
  window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  if(value){
    await optimizeFont2();
  } else {
    await loadFontFamily(window.globalFont, window.fontMetricsObj);

  }
  renderPageQueue(window.currentPage);
}


async function renderPDF(){

  window.doc = new PDFDocument({margin: 0,
    autoFirstPage: false});

  const stream = window.doc.pipe(blobStream());

  let fontObjData = new Object;
  //TODO: Edit so that only fonts used in the document are inserted into the PDF.
  for (const [familyKey, familyObj] of Object.entries(fontObj)) {
    if(typeof(fontObjData[familyKey]) == "undefined"){
      fontObjData[familyKey] = new Object;
    }

    //Note: pdfkit has a bug where fonts with spaces in the name create corrupted files (they open in browser but not Adobe products)
    //Taking all spaces out of font names as a quick fix--this can likely be removed down the line if patched.
    //https://github.com/foliojs/pdfkit/issues/1314

    for (const [key, value] of Object.entries(familyObj)) {
      if(key == "small-caps"){
        fontObj[familyKey][key].tables.name.postScriptName["en"] = window.globalFont + "-SmallCaps";
        fontObj[familyKey][key].tables.name.fontSubfamily["en"] = "SmallCaps";
        fontObj[familyKey][key].tables.name.postScriptName["en"] = fontObj[familyKey][key].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

        fontObjData[familyKey][key] = fontObj[familyKey][key].toArrayBuffer();
      } else if(key == "normal" && document.getElementById("optimizeFont").checked && familyKey == window.globalFont){
        fontObjData[familyKey][key] = fontDataOptimized;
      } else if(key == "italic" && document.getElementById("optimizeFont").checked && familyKey == window.globalFont){
        fontObjData[familyKey][key] = fontDataOptimizedItalic;
      } else {
        fontObj[familyKey][key].tables.name.postScriptName["en"] = fontObj[familyKey][key].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");
        fontObjData[familyKey][key] = fontObj[familyKey][key].toArrayBuffer();
      }


      window.doc.registerFont(familyKey + "-" + key, fontObjData[familyKey][key]);
    }
  }


  let minValue = parseInt(document.getElementById('pdfPageMin').value);
  let maxValue = parseInt(document.getElementById('pdfPageMax').value);


  let standardizeSizeMode = document.getElementById("standardizeCheckbox").checked;
  let dimsLimit = new Array(maxValue - minValue + 1);
  dimsLimit.fill(0);
  if(standardizeSizeMode){
    for(let i = (minValue-1); i < maxValue; i++) {
      dimsLimit[0] = Math.max(dimsLimit[0], window.pageMetricsObj["dimsAll"][i][0]);
      dimsLimit[1] = Math.max(dimsLimit[1], window.pageMetricsObj["dimsAll"][i][1]);
    }
  }

  const downloadProgress = document.getElementById("downloadProgress");
  downloadProgress.setAttribute("aria-valuenow",0);
  downloadProgress.setAttribute("style","width: " + 0 + "%");
  downloadProgress.setAttribute("aria-valuemax", maxValue);
  const downloadProgressCollapse = document.getElementById("download-progress-collapse");
  downloadProgressCollapse.setAttribute("class", "collapse show");


  let display_mode = document.getElementById('displayMode').value;

  for(let i = (minValue-1); i < maxValue; i++) {

    await renderPageQueue(i,"pdf",true, false, dimsLimit);

    // Update progress bar

    if((i+1) % 5 == 0 | (i+1) == maxValue){
      downloadProgress.setAttribute("aria-valuenow",i+1);
      downloadProgress.setAttribute("style","width: " + ((i+1) / maxValue * 100) + "%");
      await sleep(0);

    }

  }

  window.doc.end();
  stream.on('finish', function() {
    // get a blob you can do whatever you like with
    let url = stream.toBlobURL('application/pdf');
    let fileName = document.getElementById("downloadFileName").value.replace(/\.\w{1,4}$/, "") + ".pdf";

    saveAs(url, fileName);

  });

  // Quick fix to avoid issues where the last page rendered would be mistaken for the last page on screen
  renderPageQueue(window.currentPage);

}


// TODO: Rework storage of optimized vs. non-optimized fonts to be more organized
var fontDataOptimized, fontDataOptimizedItalic;

export async function optimizeFont2(){


  fontObj[window.globalFont]["normal"].tables.gsub = null;

  // Quick fix due to bug in pdfkit (see note in renderPDF function)
  fontObj[window.globalFont]["normal"].tables.name.postScriptName["en"] = fontObj[window.globalFont]["normal"].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

  let fontArr = await optimizeFont(fontObj[window.globalFont]["normal"], fontObj[window.globalFont]["italic"], window.fontMetricsObj);

  fontDataOptimized = fontArr[0].toArrayBuffer();
  await loadFont(window.globalFont, fontDataOptimized, true,true,true);

  fontDataOptimizedItalic = fontArr[1].toArrayBuffer();
  await loadFont(window.globalFont + "-italic", fontDataOptimizedItalic, true,true,true);


}


// No custom fonts currently supported--may be added back in future
// async function uploadFont(){
//   window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
//
//   const reader = new FileReader();
//   reader.addEventListener("load", () => {
//     // this will then display a text file
//     //textDiv.value = reader.result;
//     let fontData = reader.result;
//     //fontBlob = new Blob([fontData], {type:'font/ttf'});
//     //fontURL = URL.createObjectURL(fontBlob);
//     //loadAndUseFontBrowser(document.getElementById('uploadFont').files[0].name, fontURL)
//     //loadAndUseFontBrowser("uploadFont", fontData);
//     loadAndUseFont("uploadFont", fontData);
//   }, false);
//
//   reader.readAsArrayBuffer(document.getElementById('uploadFont').files[0]);
//
// }

var myWorker = new Worker('js/convertPage.js');

window.fontMetricsObj = new Object;
window.pageMetricsObj = new Object;
var fontMetricObjsMessage = new Object;

var loadCountHOCR = 0;
myWorker.onmessage = function(e) {
  window.hocrAll[e.data[1]] = e.data[0][0];
  window.pageMetricsObj["dimsAll"][e.data[1]] = e.data[0][1];
  window.pageMetricsObj["angleAll"][e.data[1]] = e.data[0][2];
  window.pageMetricsObj["leftAll"][e.data[1]] = e.data[0][3];
  window.pageMetricsObj["angleAdjAll"][e.data[1]] = e.data[0][4];
  fontMetricObjsMessage["widthObjAll"].push(e.data[0][5]);
  fontMetricObjsMessage["heightObjAll"].push(e.data[0][6]);
  fontMetricObjsMessage["heightSmallCapsObjAll"].push(e.data[0][7]);
  fontMetricObjsMessage["cutObjAll"].push(e.data[0][8]);
  fontMetricObjsMessage["kerningObjAll"].push(e.data[0][9]);
  fontMetricObjsMessage["messageAll"][e.data[1]] = e.data[0][10];

  if(canvas.isEmpty()){
    renderPageQueue(0);
  }

  loadCountHOCR = loadCountHOCR + 1;
  importProgress.setAttribute("aria-valuenow",loadCountHOCR);

  const valueMax = parseInt(importProgress.getAttribute("aria-valuemax"));

  if(loadCountHOCR % 5 == 0 | loadCountHOCR == valueMax){
    importProgress.setAttribute("style","width: " + (loadCountHOCR / valueMax) * 100 + "%");
    if(loadCountHOCR == valueMax){
      // If resuming from a previous editing session font stats are already calculated
      if(!resumeMode){
          window.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
      } else {
        document.getElementById('optimizeFont').disabled = false;
        document.getElementById('save2').disabled = false;
      }
      calculateOverallPageMetrics();
    }
  }

}

function calculateOverallPageMetrics(){
  // It is possible for image resolution to vary page-to-page, so the left margin must be calculated
  // as a percent to remain visually identical between pages.
  let leftAllPer = new Array(window.pageMetricsObj["leftAll"].length);
  for(let i=0;i<window.pageMetricsObj["leftAll"].length;i++){
    leftAllPer[i] = window.pageMetricsObj["leftAll"][i] / window.pageMetricsObj["dimsAll"][i][1];
  }
  leftGlobal = quantile(leftAllPer, 0.5);
  window.pageMetricsObj["manAdjAll"] = new Array(window.pageMetricsObj["leftAll"].length);
  window.pageMetricsObj["manAdjAll"].fill(0);

}

// Function to change the display mode
// Impacts text color and opacity, and backgound image opacity
function selectDisplayMode(x, backgroundOpts = null){

  if(pdfMode && renderStatus != 2) {return;}

  let opacity_arg, fill_arg;
  if(x == "invis"){
    opacity_arg = 0
    fill_arg = "fill_ebook"
  } else if(x == "ebook") {
    opacity_arg = 1
    fill_arg = "fill_ebook"
  } else {
    opacity_arg = 1
    fill_arg = "fill_proof"
  }

  canvas.forEachObject(function(obj) {
  if(obj.type == "i-text"){
    obj.set("fill", obj.get(fill_arg));

      obj.set("opacity", opacity_arg);
    }
  });

  // Include a background image if appropriate
  if(['invis','proof'].includes(x) && (imageMode || pdfMode)){
    canvas.setBackgroundColor("black");
    canvas.setBackgroundImage(backgroundImage, canvas.renderAll.bind(canvas), backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  }

  working = false;

}

async function handleDownload(){

  document.getElementById('save2').removeEventListener('click', handleDownload);
  document.getElementById('save2').disabled = true;

  updatePdfPagesLabel();

  // Save any edits that may exist on current page
  window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  let download_type = document.getElementById('formatLabelText').textContent.toLowerCase();
  if(download_type == "pdf"){
    await renderPDF();
  } else if(download_type == "hocr"){
    renderHOCR(window.hocrAll, window.fontMetricsObj)
  } else if(download_type == "text"){
    renderText(window.hocrAll)
  }

  document.getElementById('save2').disabled = false;
  document.getElementById('save2').addEventListener('click', handleDownload);
}
