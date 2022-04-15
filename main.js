
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

import { getRandomInt, getRandomAlphanum, mean50, quantile, sleep, readOcrFile, round3 } from "./js/miscUtils.js";

import { deleteSelectedWords, toggleStyleSelectedWords, changeWordFontSize, toggleBoundingBoxesSelectedWords, changeWordFont, toggleSuperSelectedWords,
  updateHOCRWord, adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, updateHOCRBoundingBoxWord } from "./js/interfaceEdit.js";
import { changeDisplayFont, changeZoom, adjustMarginRange, adjustMarginRangeChange } from "./js/interfaceView.js";

import { initMuPDFWorker } from "./mupdf/mupdf-async.js";


// Global variables containing fonts represented as OpenType.js objects and array buffers (respectively)
var leftGlobal;





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
window.backgroundImage = null;
window.renderStatus = 0;
//window.imageAll = [];

window.xmlMode = false;
window.pdfMode = false;
window.imageMode = false;
window.resumeMode = false;

// Define canvas
window.canvas = new fabric.Canvas('c');
window.ctx = canvas.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvas.overlayVpt = false;

// Turn off (some) automatic rendering of canvas
canvas.renderOnAddRemove = false;

// Content that should be run once, after all dependencies are done loading are done loading
window.runOnLoad = function(){

  // Load fonts
  loadFontFamily("Open Sans", window.fontMetricsObj);
  loadFontFamily("Libre Baskerville", window.fontMetricsObj);

  // Detect whether SIMD instructions are supported
  wasmFeatureDetect.simd().then(async function(x){
    window.simdSupport = x;
    // Show error message if SIMD support is not present
    if(x){
      document.getElementById("debugEngineVersion").innerText = "Enabled";
    } else {
      document.getElementById("simdWarning").setAttribute("style", "");
      document.getElementById("debugEngineVersion").innerText = "Disabled";
    }
  });

  // Define path for pdf worker
  //pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdf.worker.min.js";


}

// window.mupdf = initMuPDFWorker();

// var fs = new Filer.FileSystem()
// fs.readFileSync = fs.readFile

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
document.getElementById('uploader').addEventListener('change', importFiles);

document.getElementById('colorCheckbox').addEventListener('click', () => {renderPageQueue(window.currentPage, 'screen', false)});


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

document.getElementById('deleteWord').addEventListener('click', deleteSelectedWords);

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

document.getElementById('oemLabelOptionLstm').addEventListener('click', () => {setOemLabel("lstm")});
document.getElementById('oemLabelOptionLegacy').addEventListener('click', () => {setOemLabel("legacy")});

document.getElementById('psmLabelOption3').addEventListener('click', () => {setPsmLabel("3")});
document.getElementById('psmLabelOption4').addEventListener('click', () => {setPsmLabel("4")});

document.getElementById('recognizeAll').addEventListener('click', recognizeAll);


document.getElementById('displayMode').addEventListener('change', () => {selectDisplayMode(event.target.value)});


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
    const nMax = parseInt(document.getElementById('pageCount').textContent);
    if(document.getElementById('pageNum').value <= nMax && document.getElementById('pageNum').value > 0){
      window.currentPage = document.getElementById('pageNum').value - 1;
      document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
      canvas.viewportTransform[4] = window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
      renderPageQueue(window.currentPage);

      // Render 1 page ahead and behind
      if(window.pdfMode && cacheMode){
        let cacheArr = [...Array(cachePages).keys()].map(i => i + window.currentPage + 1).filter(x => x < nMax & x >= 0);
        if(cacheArr.length > 0){
          renderPDFImageCache(cacheArr);
        }
        cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + window.currentPage - 1).filter(x => x < nMax & x >= 0);
        if(cacheArr.length > 0){
          renderPDFImageCache(cacheArr);
        }

      }
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

function setOemLabel(x){
  if(x.toLowerCase() == "lstm"){
    document.getElementById("oemLabelText").innerHTML = "LSTM";
  } else if(x.toLowerCase() == "legacy"){
    document.getElementById("oemLabelText").innerHTML = "Legacy";
  }
}

function setPsmLabel(x){
  if(x == "3"){
    document.getElementById("psmLabelText").innerHTML = "Automatic";
  } else if(x == "4"){
    document.getElementById("psmLabelText").innerHTML = "Single Column";
  }
}



// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
document.getElementById('nav-import').addEventListener('hidden.bs.collapse', function () {
  hideProgress("import-progress-collapse");
  // const progressCollapse = document.getElementById("import-progress-collapse");
  // if(progressCollapse.getAttribute("class") == "collapse show"){
  //   const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];
  //   if(loadCountHOCR == parseInt(progressBar.getAttribute("aria-valuemax"))){
  //     document.getElementById("import-progress-collapse").setAttribute("class", "collapse");
  //   }
  // }
})

document.getElementById('nav-recognize').addEventListener('hidden.bs.collapse', function () {
  hideProgress("render-recognize-progress-collapse");
  hideProgress("recognize-recognize-progress-collapse");
  // if(document.getElementById("render-recognize-progress-collapse").getAttribute("class") == "collapse show" && loadCountHOCR == parseInt(document.getElementById("renderProgress").getAttribute("aria-valuemax"))){
  //   document.getElementById("render-recognize-progress-collapse").setAttribute("class", "collapse");
  // }
  // if(document.getElementById("recognize-recognize-progress-collapse").getAttribute("class") == "collapse show" && loadCountHOCR == parseInt(document.getElementById("recognizeProgress").getAttribute("aria-valuemax"))){
  //   document.getElementById("recognize-recognize-progress-collapse").setAttribute("class", "collapse");
  // }
})

document.getElementById('nav-download').addEventListener('hidden.bs.collapse', function () {
  hideProgress("render-download-progress-collapse");
  hideProgress("generate-download-progress-collapse");
  // if(document.getElementById("render-download-progress-collapse").getAttribute("class") == "collapse show" && loadCountHOCR == parseInt(document.getElementById("downloadProgress").getAttribute("aria-valuemax"))){
  //   document.getElementById("render-download-progress-collapse").setAttribute("class", "collapse");
  // }
  // if(document.getElementById("generate-download-progress-collapse").getAttribute("class") == "collapse show" && loadCountHOCR == parseInt(document.getElementById("downloadProgress").getAttribute("aria-valuemax"))){
  //   document.getElementById("generate-download-progress-collapse").setAttribute("class", "collapse");
  // }
})


// When the navbar is "sticky", it does not automatically widen for large canvases (when the canvas size is larger than the viewport).
// However, when the navbar is fixed, the canvas does not move out of the way of the navbar.
// Therefore, the navbar is set to fixed, and the canvas is manually moved up/down when tabs are shown/collapsed.
var tabHeightObj = {"import":66,"recognize":102,"view":117,"recognize":102,"edit":104,"layout":88,"download":104,"about":55}

document.getElementById('nav-import').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-import') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["import"] + "px";
})
document.getElementById('nav-import').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-import') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["import"] + "px";
})
document.getElementById('nav-recognize').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-recognize') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["recognize"] + "px";
})
document.getElementById('nav-recognize').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-recognize') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["recognize"] + "px";
})
document.getElementById('nav-view').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-view') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["view"] + "px";
})
document.getElementById('nav-view').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-view') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["view"] + "px";
})

document.getElementById('nav-edit').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-edit') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["edit"] + "px";
})
document.getElementById('nav-edit').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-edit') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["edit"] + "px";
})

document.getElementById('nav-layout').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-layout') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["layout"] + "px";
})
document.getElementById('nav-layout').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-layout') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["layout"] + "px";
})

document.getElementById('nav-download').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-download') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["download"] + "px";
})
document.getElementById('nav-download').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-download') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["download"] + "px";
})

document.getElementById('nav-about').addEventListener('hide.bs.collapse', function (e) {
  if(e.target.id != 'nav-about') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight - tabHeightObj["about"] + "px";
})
document.getElementById('nav-about').addEventListener('show.bs.collapse', function (e) {
  if(e.target.id != 'nav-about') return;
  let currentHeight = parseInt(document.getElementById('paddingRow').style.height.slice(0,-2));
  document.getElementById('paddingRow').style.height = currentHeight + tabHeightObj["about"] + "px";
})

function toggleEditButtons(disable = true){
  let editButtons = ["styleItalic", "styleSmallCaps", "styleSuper", "editBoundingBox", "editBaseline", "deleteWord", "addWord"];
  for(let i=0;i<editButtons.length;i++){
    document.getElementById(editButtons[i]).disabled = disable;
  }
}

function initializeProgress(id,maxValue,initValue=0){
  console.log("initValue " + initValue);
  const progressCollapse = document.getElementById(id);

  const progressCollapseObj = new bootstrap.Collapse(progressCollapse, {toggle: false});


  const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];

  progressBar.setAttribute("aria-valuenow",initValue);
  progressBar.setAttribute("style","width: " + ((initValue / maxValue) * 100) + "%");
  progressBar.setAttribute("aria-valuemax", maxValue);
  //progressCollapse.setAttribute("class", "collapse show");
  progressCollapseObj.show()

  return(progressBar);

}

// Hides progress bar if completed
function hideProgress(id){
  const progressCollapse = document.getElementById(id);
  if(progressCollapse.getAttribute("class") == "collapse show"){
    const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];
    if(parseInt(progressBar.getAttribute("aria-valuenow")) == parseInt(progressBar.getAttribute("aria-valuemax"))){
      progressCollapse.setAttribute("class", "collapse");
    }
  }
}


async function recognizeAll(){
  //if(!window.simdSupport) return;

  loadCountHOCR = 0;

  convertPageWorker["activeProgress"] = initializeProgress("recognize-recognize-progress-collapse",imageAll.length);

  // Render all pages to PNG
  if(window.pdfMode){
      window.muPDFScheduler["activeProgress"] = initializeProgress("render-recognize-progress-collapse",imageAll.length,window.muPDFScheduler["pngRenderCount"]);
      let time1 = Date.now();
      await renderPDFImageCache([...Array(imageAll.length).keys()]);
      let time2 = Date.now();
      console.log("renderPDFImageCache runtime: " + (time2 - time1) / 1e3 + "s");
      //window.muPDFScheduler.terminate();
  }


  const oemConfig = document.getElementById("oemLabelText").innerHTML == "Legacy" ? Tesseract.OEM['TESSERACT_ONLY'] : Tesseract.OEM['LSTM_ONLY'];
  const psmConfig = document.getElementById("psmLabelText").innerHTML == "Single Column" ? Tesseract.PSM["SINGLE_COLUMN"] : Tesseract.PSM['AUTO'];

  const allConfig = {
    tessedit_ocr_engine_mode: oemConfig,
    tessedit_pageseg_mode: psmConfig,
    hocr_char_boxes: '1',
    // The Tesseract LSTM engine frequently identifies a bar character "|"
    // This is virtually always a false positive (usually "I").
    tessedit_char_blacklist: "|"
  };

  console.log(allConfig);

  let recognizeImages = async (workerN) => {
    let time1 = Date.now();
    const scheduler = Tesseract.createScheduler();

    let workerOptions;
    if(window.simdSupport){
      console.log("Using Tesseract with SIMD support (fast LSTM performance).")
      workerOptions = {corePath: './tess/tesseract-core-sse.wasm.js',workerPath:'./tess/worker.min.js'};
    } else {
      console.log("Using Tesseract without SIMD support (slow LSTM performance).")
      workerOptions = {corePath: './tess/tesseract-core.wasm.js',workerPath:'./tess/worker.min.js'};
    }

    for (let i = 0; i < workerN; i++) {
      const w = Tesseract.createWorker(workerOptions);
      await w.load();
      await w.loadLanguage('eng');
      await w.initialize('eng',oemConfig);
      await w.setParameters(allConfig);

      scheduler.addWorker(w);
    }

    window.xmlMode = true;
    const rets = await Promise.allSettled([...Array(window.imageAll.length).keys()].map((x) => (
      scheduler.addJob('recognize', window.imageAll[x].src, allConfig).then((y) => {
        convertPageWorker.postMessage([y.data.hocr, x, false]);
      })
    )));

    //console.log(rets.map(r => r.data));
    await scheduler.terminate();

    let time2 = Date.now();
    console.log("Runtime: " + (time2 - time1) / 1e3 + "s");

  }

  let workerN = Math.round((window.navigator.hardwareConcurrency || 8) / 2);
  // Use at most 6 workers.  While some systems could support many more workers in theory,
  // browser-imposed memory limits make this problematic in reality.
  workerN = Math.min(workerN, 6);
  // Do not create more workers than there are pages
  workerN = Math.min(workerN, Math.ceil(window.imageAll.length));

  console.log("Using " + workerN + " workers for OCR.")
  recognizeImages(workerN);

  // Enable confidence threshold input boxes (only used for Tesseract)
  document.getElementById('confThreshHigh').disabled = false;
  document.getElementById('confThreshMed').disabled = false;
  toggleEditButtons(false);


}




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

  let lines = xmlDoc.getElementsByClassName("ocr_line");

  // Identify the OCR line a bounding box is in (or closest line if no match exists)
  let lineI=-1;
  let match = false;
  let newLastLine = false;
  let line, lineBox, baseline, lineBottomHOCR, titleStrLine, fontSize;
  do {
    lineI = lineI + 1;
    line = lines[lineI];
    titleStrLine = line.getAttribute('title');
    lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
    baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);

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
    lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;
    if(lineTopHOCR < rectBottomCoreHOCR && lineBottomHOCR >= rectTopCoreHOCR) match = true;
    if(lineBottomHOCR < rectTopCoreHOCR && lineI + 1 == lines.length) newLastLine = true;

  } while (lineBottomHOCR < rectTopCoreHOCR && lineI + 1 < lines.length);

  // line is set to either the matched line or a nearby line
  //let line = match ? lines[lineI] : lines[Math.min(i-1,0)];

  let words = line.getElementsByClassName("ocrx_word");
  // Case when a word is being added to an existing line
  if(match){

    lineBoxChosen = lineBox;
    baselineChosen = baseline;
    titleStrLineChosen = titleStrLine;

    // Identify closest word on existing line
    let word, box;
    let i = 0;
    do {
      word = words[i];
      if (word.childNodes[0].textContent.trim() == "") continue;
      let titleStr = word.getAttribute('title') ?? "";
      box = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x);});
      i = i + 1;
    } while (box[2] < rect.left && i < words.length);

    let wordChosenID = word.getAttribute('id');
    let wordBox = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

    // Append 3 random characters to avoid conflicts without having to keep track of all words
    wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
    const wordNewStr = '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + wordBox.join(' ') + ';x_wconf 100">' + wordText + '</span>'

    const wordNew = parser.parseFromString(wordNewStr, "text/xml");

    if(i == words.length){
      word.insertAdjacentElement("afterend", wordNew.firstChild);
    } else {
      word.insertAdjacentElement("beforebegin", wordNew.firstChild);
    }

    // TODO: Update metrics of lines if a first/last word is added

  // Case when new word requires a new line be created
  } else {

    let word = line.getElementsByClassName("ocrx_word")[0];
    let wordID = word.getAttribute('id');
    wordIDNew = wordID.replace(/\w{1,5}_\w+/, "$&" + getRandomAlphanum(3).join(''));

    lineBoxChosen = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

    // If this is the first/last line on the page, assume the textbox height is the "A" height.
    // This is done because when a first/last line is added manually, it is often page numbers,
    // and is often not the same font size as other lines.
    let sizeStr;
    if(lineI == 0 | lineI + 1 == lines.length){
      sizeStr = "x_size " + Math.round(rect.height) + ";";
      baselineChosen = [0,0];

    // If the new line is between two existing lines, use metrics from nearby line to determine text size
    } else {
      let letterHeight = titleStrLine.match(/x_size\s+([\d\.\-]+)/);

      let ascHeight = titleStrLine.match(/x_ascenders\s+([\d\.\-]+)/);
      let descHeight = titleStrLine.match(/x_descenders\s+([\d\.\-]+)/);
      letterHeight = letterHeight != null ? "x_size " + letterHeight[1] : "";
      ascHeight = ascHeight != null ? "x_ascenders " + ascHeight[1] : "";
      descHeight = descHeight != null ? "x_descenders " + descHeight[1] : "";
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

      let baselineStr = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
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

    if(newLastLine){
      line.insertAdjacentElement("afterend", lineXmlNew.firstChild);
    } else {
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

  let letterHeight = titleStrLineChosen.match(/x_size\s+([\d\.\-]+)/);
  let ascHeight = titleStrLineChosen.match(/x_ascenders\s+([\d\.\-]+)/);
  let descHeight = titleStrLineChosen.match(/x_descenders\s+([\d\.\-]+)/);

  if(letterHeight != null && ascHeight != null && descHeight != null){
     letterHeight = parseFloat(letterHeight[1]);
     ascHeight =  parseFloat(ascHeight[1]);
     descHeight = parseFloat(descHeight[1]);
     let xHeight = letterHeight - ascHeight - descHeight;
     fontSize = getFontSize(window.globalFont, xHeight, "o", ctx);
   } else if(letterHeight != null){
     letterHeight = parseFloat(letterHeight[1]);
     descHeight = descHeight != null ? parseFloat(descHeight[1]) : 0;
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

    let top = lineBoxChosen[3] + baselineChosen[1] + fontDesc + angleAdjY;

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
          textInt = textInt.replace(/(^|[-–—])\'/, "$1‘");
          textInt = textInt.replace(/(^|[-–—])\"/, "$1“");
          textInt = textInt.replace(/\'(?=$|[-–—])/, "’");
          textInt = textInt.replace(/\"(?=$|[-–—])/, "”");
          textInt = textInt.replace(/([a-z])\'(?=[a-z]$)/i, "$1’");
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
    canvas.requestRenderAll();

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
  document.getElementById('recognizeAll').disabled = true;
  document.getElementById('recognizeArea').disabled = true;
  toggleEditButtons(true);

}

function getXHeight(font, size){
  let exTest = document.getElementById("exTest");
  exTest.setAttribute("style", "display:none;width:1ex;font-family:'" + font + "';font-size:" + size)
  return(getComputedStyle(exTest).width);
}


async function importFiles(){

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
    let fileExt = file.name.match(/\.([^\.]+)$/);
    fileExt = fileExt == null ? "" : fileExt[1].toLowerCase();

    if(["png","jpeg", "jpg"].includes(fileExt)){
      imageFilesAll.push(file);
      // All .gz files are assumed to be OCR data (xml) since all other file types can be compressed already
    } else if(["hocr","xml","html","gz"].includes(fileExt)){
      hocrFilesAll.push(file);
    } else if(["pdf"].includes(fileExt)){
      pdfFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  window.pdfMode = pdfFilesAll.length == 1 ? true : false;
  window.imageMode = imageFilesAll.length > 0 && !window.pdfMode ? true : false;
  window.xmlMode = hocrFilesAll.length > 0 ? true : false;


  if(window.imageMode || window.pdfMode){
    document.getElementById('recognizeAll').disabled = false;
  }

  imageFilesAll.sort();
  hocrFilesAll.sort();

  // Check that input makes sense.  Valid options are:
  // (1) N HOCR files and 0 image files
  // (1) N HOCR files and N image files
  // (1) 1 HOCR file and N image files
  if(hocrFilesAll.length > 1 && window.imageMode && hocrFilesAll.length != imageFilesAll.length){
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
  let hocrStrStart = "";
  let hocrStrEnd = "";
  let abbyyMode, hocrStrPages, hocrArrPages, pageCount, hocrAllRaw;

  if(window.pdfMode){

    // Initialize scheduler
    await initMuPDFScheduler(pdfFilesAll[0], 3);

    pageCount = await window.muPDFScheduler.addJob('countPages',[]);

  } else if(window.imageMode){
    pageCount = imageFilesAll.length;
  }

  if(window.xmlMode) {

    if(singleHOCRMode){
      const singleHOCRMode = true;
       let hocrStrAll = await readOcrFile(hocrFilesAll[0]);

       // Check whether input is Abbyy XML
       const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
       abbyyMode = /abbyy/i.test(node2) ? true : false;

       if(abbyyMode){

         hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
         hocrArrPages = hocrStrPages.split(/(?=\<page)/);
       } else {

         // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
         window.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

         if(window.resumeMode){
            let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
            let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\/?\>)/i)[1].replace(/&quot;/g, '"');
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
      if(window.imageMode && hocrArrPages.length != imageFilesAll.length){
        throw new Error('Detected ' + hocrArrPages.length + ' pages in OCR but ' + imageFilesAll.length + " image files.")
      }
      hocrAllRaw = Array(pageCount);
      for(let i=0;i<pageCount;i++){
        hocrAllRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
      }

    } else {
      const singleHOCRMode = false;
      pageCount = hocrFilesAll.length;

      // Check whether input is Abbyy XML using the first file
      let hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
      const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
      abbyyMode = /abbyy/i.test(node2) ? true : false;
    }

    // Enable confidence threshold input boxes (only used for Tesseract)
    if(!abbyyMode){
      document.getElementById('confThreshHigh').disabled = false;
      document.getElementById('confThreshMed').disabled = false;
      document.getElementById('confThreshHigh').value = 85;
      document.getElementById('confThreshMed').value = 75;
    }

  }

  window.hocrAll = Array(pageCount);
  window.imageAll = Array(pageCount);

  if(pdfMode){
    window.imageAllColor = Array(pageCount);
  }


  if(window.pdfMode && !window.xmlMode){
    renderPageQueue(0);
  }

  let imageN = -1;
  let hocrN = -1;
  let firstImg = true;

  loadCountHOCR = 0;

  // Both OCR data and individual images (.png or .jpeg) contribute to the import loading bar
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  if(window.imageMode || window.xmlMode){
    const progressMax = window.imageMode && window.xmlMode ? pageCount * 2 : pageCount;
    convertPageWorker["activeProgress"] = initializeProgress("import-progress-collapse",progressMax);
  }

  for(let i = 0; i < pageCount; i++) {

    // Note: As of Jan 22, exporting PDFs using BMP files is currently bugged in pdfKit (the colors channels can get switched)
    if(window.imageMode){

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

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        image.src = reader.result;

        imageAll[imageNi] = image;

        loadCountHOCR = loadCountHOCR + 1;
        const valueMax = parseInt(convertPageWorker["activeProgress"].getAttribute("aria-valuemax"));
        convertPageWorker["activeProgress"].setAttribute("aria-valuenow",loadCountHOCR);
        if(loadCountHOCR % 5 == 0 | loadCountHOCR == valueMax){
          convertPageWorker["activeProgress"].setAttribute("style","width: " + (loadCountHOCR / valueMax) * 100 + "%");
          if(loadCountHOCR == valueMax){
            window.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
            calculateOverallPageMetrics();
          }
        }

      }, false);

      reader.readAsDataURL(imageFilesAll[i]);

    }

    if(window.xmlMode){
      toggleEditButtons(false);
      // Process HOCR using web worker, reading from file first if that has not been done already
      if(singleHOCRMode){
        convertPageWorker.postMessage([hocrAllRaw[i], i, abbyyMode]);
      } else {
        const hocrFile = hocrFilesAll[i];
        const hocrNi = hocrN + 1;
        hocrN = hocrN + 1;
        readOcrFile(hocrFile).then((x) => convertPageWorker.postMessage([x, hocrNi]));
      }
    }

  }

  // Render first handful of pages for pdfs so the interface starts off responsive
  // In the case of OCR data, this step is triggered elsewhere after all the data loads
  if(window.pdfMode && !window.xmlMode){
    renderPDFImageCache([...Array(Math.min(pageCount,5)).keys()]);
  }

  // Enable downloads now for pdf imports if no HOCR data exists
  if(window.pdfMode && !window.xmlMode){
    document.getElementById('save2').disabled = false;
  }

  document.getElementById('pageNum').value = 1;
  document.getElementById('pageCount').textContent = pageCount;

}

// Scheduler for compressing PNG data
async function initMuPDFScheduler(file,workers=3){
  window.muPDFScheduler = Tesseract.createScheduler();
  window.muPDFScheduler["pngRenderCount"] = 0;
  for (let i = 0; i < workers; i++) {
    const w = await initMuPDFWorker();
    const fileData = await file.arrayBuffer();
    const pdfDoc = await w.openDocument(fileData,file.name);
    console.log(pdfDoc);
    w["pdfDoc"] = pdfDoc;

    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    window.muPDFScheduler.addWorker(w);
  }
}

async function renderPDFImageCache(pagesArr){

  await Promise.allSettled(pagesArr.map(async (n) => {
    const colorCheckbox = document.getElementById("colorCheckbox").checked;

    // Skip if image has already been rendered or is being rendered currently (with same colorspace currently specified)
    if(typeof(window.imageAll[n]) != "undefined" && (window.imageAllColor[n] == colorCheckbox)) return;

    // Set to defined value to avoid the same page being rendered multiple times before this function call finishes
    window.imageAll[n] = false;
    window.imageAllColor[n] = colorCheckbox;

    // If OCR data is expecting certain dimensions, render to those.
    // Otherwise, the image size is determined by renderPDFImage.
    const imgDimsArg = window.xmlMode ? window.pageMetricsObj["dimsAll"][n] : null;

    // Render to 300 dpi by default
    let dpi = 300;

    // When XML data exists, render to the size specified by that
    if(xmlMode){
      const imgWidthXml = window.pageMetricsObj["dimsAll"][n][1];
      const imgWidthPdf = await window.muPDFScheduler.addJob('pageWidth',[n+1,300]);
      if(imgWidthPdf != imgWidthXml){
        dpi = Math.round(300 * (imgWidthXml / imgWidthPdf));
      }
    }
    console.log("n+1ing job with parameters: ")
    console.log([n+1,dpi,colorCheckbox])
    return window.muPDFScheduler.addJob('drawPageAsPNG',[n+1,dpi,colorCheckbox]);
  }));

}



var backgroundOpts = new Object;
// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n, mode = "screen", loadXML = true, lineMode = false, dimsLimit = null){

  // Return if data is not loaded yet
  const imageMissing = window.imageMode && (imageAll.length == 0 || imageAll[n] == null || imageAll[n].complete != true) || window.pdfMode && (typeof(window.muPDFScheduler) == "undefined");
  const xmlMissing = window.hocrAll.length == 0 || typeof(window.hocrAll[n]) != "string";
  if(imageMissing && (window.imageMode || window.pdfMode) || xmlMissing && window.xmlMode){
    console.log("Exiting renderPageQueue early");
    return
  }

  // Parse the relevant XML (relevant for both Canvas and PDF)
  if(loadXML && window.xmlMode){
    window.xmlDoc = parser.parseFromString(window.hocrAll[n],"text/xml");
  }


  // Determine image size and canvas size
  let imgDims = null;
  let canvasDims = null;

  // In the case of a pdf with no ocr data and no cached png, no page size data exists yet.
  if(!(window.pdfMode && !window.xmlMode && (typeof(imageAll[n]) == "undefined" || imageAll[n] == false))){
    imgDims = new Array(2);
    canvasDims = new Array(2);

    // Get image dimensions from OCR data if present; otherwise get dimensions of images directly
    if(window.xmlMode){
      imgDims[1] = window.pageMetricsObj["dimsAll"][n][1];
      imgDims[0] = window.pageMetricsObj["dimsAll"][n][0];
    } else {
      imgDims[1] = window.imageAll[n].width;
      imgDims[0] = window.imageAll[n].height;
    }

    // The canvas size and image size are generally the same.
    // The exception is when rendering a pdf with the "standardize page size" option on,
    // which will scale the canvas size but not the image size.
    if(mode == "pdf" && dimsLimit[0] > 0 && dimsLimit[1] > 0){
      canvasDims[1] = dimsLimit[1];
      canvasDims[0] = dimsLimit[0];
    } else {
      canvasDims[1] = imgDims[1];
      canvasDims[0] = imgDims[0];
    }
  }

  // Calculate options for background image and overlay
  if(window.xmlMode){

    let marginPx = Math.round(canvasDims[1] * leftGlobal);
    if(autoRotateCheckbox.checked){
      backgroundOpts.angle = window.pageMetricsObj["angleAll"][n] * -1 ?? 0;
    } else {
      backgroundOpts.angle = 0;
    }

    // TODO: Create a more efficient implementation of "show margin" feature
    if(showMarginCheckbox.checked && mode == "screen"){
      canvas.viewportTransform[4] = 0;

      canvas.clear();
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

  }

  if(mode == "screen"){
    // Clear canvas if hocr data (and therefore possibly overlay text) exists
    if(window.xmlMode){
      canvas.clear()
      canvas.__eventListeners = {};
    }

    if(imgDims != null){
      let zoomFactor = Math.min(parseFloat(document.getElementById('zoomInput').value) / imgDims[1], 1);
      canvas.setHeight(imgDims[0] * zoomFactor);
      canvas.setWidth(imgDims[1] * zoomFactor);
      canvas.setZoom(zoomFactor);
    }

    window.renderStatus = 0;

    // If the input is a pdf, render the request page to png (if this has not been done already)
    const colorCheckbox = document.getElementById("colorCheckbox").checked;
    if(window.pdfMode && (typeof(imageAll[n]) == "undefined" || window.imageAllColor[n] != colorCheckbox)){
      console.log("Rendering pdf");
      imageAll[n] = false;
      window.imageAllColor[n] = colorCheckbox;
      window.muPDFScheduler.addJob('drawPageAsPNG',[n+1,300,colorCheckbox]);

    // If imageAll[n] == false, then the image is already being rendered
    // This happens when page n+1 is being automatically rendered,
    // and then the user advances to the next page before it finishes.
    } else if(imageAll[n] != false){
      console.log("Using cached image");
      window.backgroundImage = new fabric.Image(imageAll[n], {objectCaching:false});
      window.renderStatus = window.renderStatus + 1;
      selectDisplayMode(document.getElementById('displayMode').value);
    } else {
      console.log("Image already rendering");
    }

    // If there is no OCR data to render, we are done
    if(!window.xmlMode){
      return;
    }

  } else {
    window.doc.addPage({size:[canvasDims[1],canvasDims[0]],margin: 0});

    if(document.getElementById('displayMode').value != "ebook"){
      // TODO: Make everything render from pdf to png ahead of time
      window.doc.image(imageAll[n].src,leftAdjX,0,{align:'left',valign:'top'});
    }
  }

  if(mode == "screen"){
    await renderPage(canvas, null, xmlDoc, "screen", window.globalFont, lineMode, imgDims, canvasDims, window.pageMetricsObj["angleAll"][n], window.pdfMode, fontObj, leftAdjX);
    if(window.currentPage == n){
      window.renderStatus = window.renderStatus + 1;
    }
    await selectDisplayMode(document.getElementById('displayMode').value);
  } else if(window.xmlMode){
    await renderPage(canvas, doc, xmlDoc, "pdf", window.globalFont, lineMode, imgDims, canvasDims, window.pageMetricsObj["angleAll"][n], window.pdfMode, fontObj, leftAdjX);
  }

}

var cacheMode = true;
var cachePages = 3;

var working = false;
async function onPrevPage(marginAdj) {
  if (window.currentPage + 1 <= 1 || working) {
    return;
  }
  working = true;
  if(window.xmlMode){
    window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  }

  window.currentPage = window.currentPage - 1;
  document.getElementById('pageNum').value = window.currentPage + 1;

  document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;

  await renderPageQueue(window.currentPage);

  // Render 1 page back
  if(window.pdfMode && cacheMode){
    const nMax = parseInt(document.getElementById('pageCount').textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + window.currentPage - 1).filter(x => x < nMax & x >= 0);
    if(cacheArr.length > 0){
      renderPDFImageCache(cacheArr);
    }
  }


  working = false;
}


async function onNextPage() {
   if (window.currentPage + 1 >= window.hocrAll.length || working) {
     return;
   }
   working = true;
   if(window.xmlMode){
     window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
   }

  window.currentPage = window.currentPage + 1;
  document.getElementById('pageNum').value = window.currentPage + 1;

  document.getElementById("rangeLeftMargin").value = 200 + window.pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][window.currentPage] ?? 0;

  await renderPageQueue(window.currentPage);

  // Render 1 page ahead
  if(window.pdfMode && cacheMode){
    const nMax = parseInt(document.getElementById('pageCount').textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i + window.currentPage + 1).filter(x => x < nMax & x >= 0);
    if(cacheArr.length > 0){
      renderPDFImageCache(cacheArr);
    }
  }

  working = false;
}


async function optimizeFontClick(value){
  if(window.xmlMode){
    window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  }
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

  // Render all pages to PNG
  if(window.pdfMode){
    let time1 = Date.now();
    // Set pngRenderCount to only include PNG images rendered with the current color setting
    const colorCheckbox = document.getElementById("colorCheckbox").checked;
    window.muPDFScheduler["pngRenderCount"] = [...Array(imageAll.length).keys()].filter((x) => typeof(imageAll[x]) == "object" && imageAllColor[x] == colorCheckbox).length;

    window.muPDFScheduler["activeProgress"] = initializeProgress("render-download-progress-collapse",imageAll.length,window.muPDFScheduler["pngRenderCount"]);
    await renderPDFImageCache([...Array(maxValue - minValue + 1).keys()].map(i => i + minValue - 1));
    let time2 = Date.now();
    console.log("renderPDFImageCache runtime: " + (time2 - time1) / 1e3 + "s");
  }

  let standardizeSizeMode = document.getElementById("standardizeCheckbox").checked;
  let dimsLimit = new Array(maxValue - minValue + 1);
  dimsLimit.fill(0);
  if(standardizeSizeMode){
    for(let i = (minValue-1); i < maxValue; i++) {
      dimsLimit[0] = Math.max(dimsLimit[0], window.pageMetricsObj["dimsAll"][i][0]);
      dimsLimit[1] = Math.max(dimsLimit[1], window.pageMetricsObj["dimsAll"][i][1]);
    }
  }

  const downloadProgress = initializeProgress("generate-download-progress-collapse",maxValue);


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


var convertPageWorker = new Worker('js/convertPage.js');

window.fontMetricsObj = new Object;
window.pageMetricsObj = new Object;
var fontMetricObjsMessage = new Object;

var loadCountHOCR = 0;
convertPageWorker.onmessage = function(e) {
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

  // If this is the page the user has open, render it to the canvas
  if(e.data[1] == window.currentPage){
    renderPageQueue(window.currentPage);
  }

  loadCountHOCR = loadCountHOCR + 1;
  let activeProgress = convertPageWorker["activeProgress"];
  activeProgress.setAttribute("aria-valuenow",loadCountHOCR);

  const valueMax = parseInt(activeProgress.getAttribute("aria-valuemax"));

  // Update progress bar between every 1 and 5 iterations (depending on how many pages are being processed).
  // This can make the interface less jittery compared to updating after every loop.
  // The jitter issue will likely be solved if more work can be offloaded from the main thread and onto workers.
  const updateInterval = Math.min(Math.ceil(valueMax/10),5);
  if(loadCountHOCR % updateInterval == 0 | loadCountHOCR == valueMax){
    activeProgress.setAttribute("style","width: " + (loadCountHOCR / valueMax) * 100 + "%");
    if(loadCountHOCR == valueMax){
      // If resuming from a previous editing session font stats are already calculated
      if(!window.resumeMode){
          // Buttons are enabled from calculateOverallFontMetrics function in this case
          window.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
      } else {
        document.getElementById('optimizeFont').disabled = false;
        document.getElementById('save2').disabled = false;
        document.getElementById('recognizeAll').disabled = true;
      }
      calculateOverallPageMetrics();
      // Render first handful of pages for pdfs so the interface starts off responsive
      if(window.pdfMode){
        renderPDFImageCache([...Array(Math.min(valueMax,5)).keys()]);
      }

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
window.selectDisplayMode = function(x){

  if(window.xmlMode && window.pdfMode && window.renderStatus != 2) {return;}

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
  if(['invis','proof'].includes(x) && (window.imageMode || window.pdfMode)){
    canvas.setBackgroundColor("black");
    canvas.setBackgroundImage(window.backgroundImage, canvas.renderAll.bind(canvas), backgroundOpts);
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
  if(window.xmlMode){
    window.hocrAll[window.currentPage] = xmlDoc.documentElement.outerHTML;
  }
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
