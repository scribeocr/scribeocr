// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

globalThis.d = function () {
  debugger;
}

import { renderText } from './js/exportRenderText.js';
import { renderHOCR } from './js/exportRenderHOCR.js';

import { renderPage } from './js/renderPage.js';
import { coords } from './js/coordinates.js';

import { getFontSize, calcWordWidth, calcWordMetrics } from "./js/textUtils.js"

import { optimizeFont, calculateOverallFontMetrics, parseDebugInfo } from "./js/fontOptimize.js";
import { loadFont, loadFontBrowser, loadFontFamily } from "./js/fontUtils.js";

import { getRandomAlphanum, quantile, sleep, readOcrFile, round3, replaceLigatures } from "./js/miscUtils.js";

import {
  deleteSelectedWords, toggleStyleSelectedWords, changeWordFontSize, changeWordFont, toggleSuperSelectedWords,
  updateHOCRWord, adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, updateHOCRBoundingBoxWord
} from "./js/interfaceEdit.js";

import { initMuPDFWorker } from "./mupdf/mupdf-async.js";

import { evalWords, compareHOCR } from "./js/compareHOCR.js";

import { hocrToPDF } from "./js/exportPDF.js";

// Third party libraries
import { simd } from "./lib/wasm-feature-detect.js";
import Tesseract from './tess/tesseract.es6.js';

// Debugging functions
import { searchHOCR } from "./js/debug.js"

globalThis.searchHOCR = searchHOCR;


// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
})

// Quick fix to get VSCode type errors to stop
// Long-term should see if there is a way to get types to work with fabric.js
var fabric = globalThis.fabric;

// Filtering was throwing an error when GL was enabled
// May be worth investigating down the line as GL will be faster
fabric.enableGLFiltering = false;

// Global variables containing fonts represented as OpenType.js objects and array buffers (respectively)
var leftGlobal;


// Disable objectCaching (significant improvement to render time)
fabric.Object.prototype.objectCaching = false;
// Disable movement for all fabric objects
fabric.Object.prototype.hasControls = false;
fabric.Object.prototype.lockMovementX = true;
fabric.Object.prototype.lockMovementY = true;

fabric.IText.prototype.toObject = (function (toObject) {
  return function () {
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
fabric.IText.prototype._render = function (ctx) {
  originalRender.call(this, ctx);
  //Don't draw border if it is active(selected/ editing mode)
  //if (this.selected) return;
  if (this.showTextBoxBorder) {
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


// Object that keeps track of what type of input data is present
globalThis.inputDataModes = {
  // true if OCR data exists (whether from upload or built-in engine)
  xmlMode: undefined,
  // true if user uploaded pdf
  pdfMode: false,
  // true if user uploaded image files (.png, .jpeg)
  imageMode: false,
  // true if user re-uploaded HOCR data created by Scribe OCR
  resumeMode: false
}

// Object that keeps track of various global settings
globalThis.globalSettings = {
  simdSupport: false,
  defaultFont: "Libre Baskerville"
}

// Object for data currently being displayed on the canvas
globalThis.currentPage = {
  n: 0,
  backgroundImage: null,
  backgroundOpts: {},
  leftAdjX: 0,
  renderStatus: 0,
  xmlDoc: null
}


var parser = new DOMParser();

// Define canvas
globalThis.canvas = new fabric.Canvas('c');
globalThis.ctx = canvas.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvas.overlayVpt = false;

// Turn off (some) automatic rendering of canvas
canvas.renderOnAddRemove = false;

// Content that should be run once, after all dependencies are done loading are done loading
globalThis.runOnLoad = function () {

  // globalThis.runOnLoadRun = true;

  // Load fonts
  loadFontFamily("Open Sans");
  loadFontFamily("Libre Baskerville");

  // Detect whether SIMD instructions are supported
  simd().then(async function (x) {
    globalSettings.simdSupport = x;
    // Show error message if SIMD support is not present
    if (x) {
      document.getElementById("debugEngineVersion").innerText = "Enabled";
    } else {
      document.getElementById("simdWarning").setAttribute("style", "");
      document.getElementById("debugEngineVersion").innerText = "Disabled";
    }
  });

}



// Define canvas
globalThis.canvasAlt = new fabric.Canvas('d');
globalThis.ctxAlt = canvasAlt.getContext('2d');

globalThis.canvasComp1 = new fabric.Canvas('e');
globalThis.ctxComp1 = canvasAlt.getContext('2d');

globalThis.canvasComp2 = new fabric.Canvas('f');
globalThis.ctxComp2 = canvasAlt.getContext('2d');

globalThis.canvasDebug = new fabric.Canvas('g');
globalThis.ctxDebug = canvasAlt.getContext('2d');


// // Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvasAlt.overlayVpt = false;
globalThis.canvasComp1.overlayVpt = false;
globalThis.canvasComp2.overlayVpt = false;
globalThis.canvasDebug.overlayVpt = false;

// // Turn off (some) automatic rendering of canvas
canvasAlt.renderOnAddRemove = false;
canvasComp1.renderOnAddRemove = false;
canvasComp2.renderOnAddRemove = false;
canvasDebug.renderOnAddRemove = false;

const pageNumElem = /** @type {HTMLInputElement} */(document.getElementById('pageNum'))

globalThis.bsCollapse = new bootstrap.Collapse(document.getElementById("collapseRange"), { toggle: false });

// Add various event listners to HTML elements
document.getElementById('next').addEventListener('click', onNextPage);
document.getElementById('prev').addEventListener('click', onPrevPage);

const uploaderElem = /** @type {HTMLInputElement} */(document.getElementById('uploader'));
uploaderElem.addEventListener('change', importFiles);

const colorModeElem = /** @type {HTMLInputElement} */(document.getElementById('colorMode'));
colorModeElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });

const createGroundTruthElem = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));
createGroundTruthElem.addEventListener('click', createGroundTruthClick);

const ocrQualityElem = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));


const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));

// If evaluate option is enabled, show tab and widen navbar to fit everything on the same row
enableAdvancedRecognitionElem.addEventListener('click', () => {
  if (enableAdvancedRecognitionElem.checked) {
    document.getElementById("advancedRecognitionOptions").setAttribute("style", "");
    document.getElementById("basicRecognitionOptions").setAttribute("style", "display:none");
  } else {
    document.getElementById("advancedRecognitionOptions").setAttribute("style", "display:none");
    document.getElementById("basicRecognitionOptions").setAttribute("style", "");
  }
});


const enableEvalElem = /** @type {HTMLInputElement} */(document.getElementById('enableEval'));

// If evaluate option is enabled, show tab and widen navbar to fit everything on the same row
enableEvalElem.addEventListener('click', () => {
  if (enableEvalElem.checked) {
    document.getElementById("nav-tab-container").setAttribute("class", "col-8 col-xl-7");
    document.getElementById("nav-eval-tab").setAttribute("style", "");
  } else {
    document.getElementById("nav-tab-container").setAttribute("class", "col-8 col-xl-6");
    document.getElementById("nav-eval-tab").setAttribute("style", "display:none");
  }
});

const enableEnginesElem = /** @type {HTMLInputElement} */(document.getElementById('enableExtraEngines'));
enableEnginesElem.addEventListener('click', () => {
  if (enableEnginesElem.checked) {
    document.getElementById("engineCol").setAttribute("style", "");
  } else {
    document.getElementById("engineCol").setAttribute("style", "display:none");
  }
});


const addOverlayCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('addOverlayCheckbox'));
const standardizeCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('standardizeCheckbox'));


const uploadOCRNameElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRName'));
const uploadOCRFileElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRFile'));

const uploadOCRButtonElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRButton'));
uploadOCRButtonElem.addEventListener('click', importOCRFiles);

const uploadOCRLabelElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRLabel'));
const uploadOCRDataElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRData'));

uploadOCRDataElem.addEventListener('show.bs.collapse', function () {
  if (!uploadOCRNameElem.value) {
    uploadOCRNameElem.value = "OCR Data " + (displayLabelOptionsElem.childElementCount + 1);
  }
})


document.getElementById('fontMinus').addEventListener('click', () => { changeWordFontSize('minus') });
document.getElementById('fontPlus').addEventListener('click', () => { changeWordFontSize('plus') });
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
fontSizeElem.addEventListener('change', (event) => { changeWordFontSize(fontSizeElem.value) });
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
wordFontElem.addEventListener('change', (event) => { changeWordFont(wordFontElem.value) });

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

styleItalicElem.addEventListener('click', () => { toggleStyleSelectedWords('italic') });
styleSmallCapsElem.addEventListener('click', () => { toggleStyleSelectedWords('small-caps') });
styleSuperElem.addEventListener('click', toggleSuperSelectedWords);

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

// document.getElementById('editBoundingBox').addEventListener('click', toggleBoundingBoxesSelectedWords);
document.getElementById('editBaseline').addEventListener('click', adjustBaseline);

const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
rangeBaselineElem.addEventListener('input', (event) => { adjustBaselineRange(rangeBaselineElem.value) });
rangeBaselineElem.addEventListener('mouseup', (event) => { adjustBaselineRangeChange(rangeBaselineElem.value) });

document.getElementById('deleteWord').addEventListener('click', deleteSelectedWords);

document.getElementById('addWord').addEventListener('click', addWordClick);
document.getElementById('reset').addEventListener('click', clearFiles);

document.getElementById('zoomMinus').addEventListener('click', () => { changeZoom('minus') });
const zoomInputElem = /** @type {HTMLInputElement} */(document.getElementById('zoomInput'));
zoomInputElem.addEventListener('change', (event) => { changeZoom(zoomInputElem.value) });
document.getElementById('zoomPlus').addEventListener('click', () => { changeZoom('plus') });

// const displayFontElem = /** @type {HTMLInputElement} */(document.getElementById('displayFont'));
// displayFontElem.addEventListener('change', (event) => { changeDisplayFont(displayFontElem.value) });

const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));
optimizeFontElem.addEventListener('click', (event) => { optimizeFontClick(optimizeFontElem.checked) });

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
confThreshHighElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });
confThreshMedElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });


// const binaryCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('binaryCheckbox'));

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const autoMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoMarginCheckbox'));
const showMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('showMarginCheckbox'));
autoRotateCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
autoMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
showMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
document.getElementById('showBoundingBoxes').addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });

const rangeLeftMarginElem = /** @type {HTMLInputElement} */(document.getElementById('rangeLeftMargin'));
rangeLeftMarginElem.addEventListener('input', () => { adjustMarginRange(rangeLeftMarginElem.value) });
rangeLeftMarginElem.addEventListener('mouseup', () => { adjustMarginRangeChange(rangeLeftMarginElem.value) });

const displayLabelOptionsElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));
const displayLabelTextElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));
displayLabelOptionsElem.addEventListener('click', (e) => { if (e.target.className != "dropdown-item") return; setCurrentHOCR(e.target.innerHTML) });



const downloadElem = /** @type {HTMLInputElement} */(document.getElementById('download'));
downloadElem.addEventListener('click', handleDownload);
document.getElementById('pdfPagesLabel').addEventListener('click', updatePdfPagesLabel);

document.getElementById('formatLabelOptionPDF').addEventListener('click', () => { setFormatLabel("pdf") });
document.getElementById('formatLabelOptionHOCR').addEventListener('click', () => { setFormatLabel("hocr") });
document.getElementById('formatLabelOptionText').addEventListener('click', () => { setFormatLabel("text") });

document.getElementById('oemLabelOptionLstm').addEventListener('click', () => { setOemLabel("lstm") });
document.getElementById('oemLabelOptionLegacy').addEventListener('click', () => { setOemLabel("legacy") });
document.getElementById('oemLabelOptionCombined').addEventListener('click', () => { setOemLabel("combined") });


document.getElementById('psmLabelOption3').addEventListener('click', () => { setPsmLabel("3") });
document.getElementById('psmLabelOption4').addEventListener('click', () => { setPsmLabel("4") });

document.getElementById('buildLabelOptionDefault').addEventListener('click', () => { setBuildLabel("default") });
document.getElementById('buildLabelOptionVanilla').addEventListener('click', () => { setBuildLabel("vanilla") });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));
showConflictsElem.addEventListener('input', showDebugImages);

const recognizeAllElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));
recognizeAllElem.addEventListener('click', () => {
  globalThis.state.recognizeAllPromise = recognizeAll();
});
// const recognizePageElem = /** @type {HTMLInputElement} */(document.getElementById('recognizePage'));
// recognizePageElem.addEventListener('click', () => {recognizePages(true)});

const recognizeAreaElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));
recognizeAreaElem.addEventListener('click', () => recognizeAreaClick(false));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
recognizeWordElem.addEventListener('click', () => recognizeAreaClick(true));

function displayModeClick(x) {

  if (x == "eval") {
    renderPageQueue(currentPage.n, 'screen', true);
  } else {
    selectDisplayMode(displayModeElem.value);
  }

}


const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById("ignorePunct"));
ignorePunctElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreCap"));
ignoreCapElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreExtra"));
ignoreExtraElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });


const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value) });

const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
pdfPageMinElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
pdfPageMaxElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pageCountElem = /** @type {HTMLInputElement} */(document.getElementById('pageCount'));
const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

pageNumElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    const nMax = parseInt(pageCountElem.textContent);
    const pageNum = parseInt(pageNumElem.value);
    if (pageNum <= nMax && pageNum > 0) {
      currentPage.n = pageNum - 1;
      rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
      canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
      renderPageQueue(currentPage.n);
      showDebugImages();

      // Render 1 page ahead and behind
      if ((inputDataModes.pdfMode || inputDataModes.imageMode)&& cacheMode) {
        let cacheArr = [...Array(cachePages).keys()].map(i => i + currentPage.n + 1).filter(x => x < nMax && x >= 0);
        if (cacheArr.length > 0) {
          renderPDFImageCache(cacheArr);
        }
        cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + currentPage.n - 1).filter(x => x < nMax && x >= 0);
        if (cacheArr.length > 0) {
          renderPDFImageCache(cacheArr);
        }

      }
    } else {
      pageNumElem.value = (currentPage.n + 1).toString();
    }
  }
});


function updatePdfPagesLabel() {

  let minValue = parseInt(pdfPageMinElem.value) || null;
  let maxValue = parseInt(pdfPageMaxElem.value) || null;
  let pageCount = parseInt(pageCountElem.textContent) || null;

  minValue = Math.max(minValue, 1);
  maxValue = Math.min(maxValue, pageCount);

  let pagesStr;
  if (minValue > 0 && maxValue > 0 && (minValue > 1 || maxValue < pageCount)) {
    pagesStr = " Pages: " + minValue + "–" + maxValue;
  } else {
    pagesStr = " Pages: All";
    minValue = 1;
    maxValue = pageCount;
  }

  pdfPageMinElem.value = minValue ? minValue.toString() : "1";
  pdfPageMaxElem.value = maxValue ? maxValue.toString() : "";
  document.getElementById('pdfPagesLabelText').innerText = pagesStr;

}


function setFormatLabel(x) {
  if (x.toLowerCase() == "pdf") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`

    document.getElementById("formatLabelText").innerHTML = "PDF";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".pdf";
  } else if (x.toLowerCase() == "hocr") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`

    document.getElementById("formatLabelText").innerHTML = "HOCR";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".hocr";
  } else if (x.toLowerCase() == "text") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`

    document.getElementById("formatLabelText").innerHTML = "Text";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".txt";

  }
}

function setOemLabel(x) {
  if (x.toLowerCase() == "lstm") {
    document.getElementById("oemLabelText").innerHTML = "LSTM";
  } else if (x.toLowerCase() == "legacy") {
    document.getElementById("oemLabelText").innerHTML = "Legacy";
  } else if (x.toLowerCase() == "combined") {
    document.getElementById("oemLabelText").innerHTML = "Combined";
  }
}

function setPsmLabel(x) {
  if (x == "3") {
    document.getElementById("psmLabelText").innerHTML = "Automatic";
  } else if (x == "4") {
    document.getElementById("psmLabelText").innerHTML = "Single Column";
  } else if (x == "8") {
    document.getElementById("psmLabelText").innerHTML = "Single Word";
  }
}

function setBuildLabel(x) {
  if (x.toLowerCase() == "default") {
    document.getElementById("buildLabelText").innerHTML = "Default";
  } else if (x.toLowerCase() == "vanilla") {
    document.getElementById("buildLabelText").innerHTML = "Vanilla";
  }
}


function addDisplayLabel(x) {
  // Exit early if option already exists
  const existingOptions = displayLabelOptionsElem.children;
  for (let i = 0; i < existingOptions.length; i++) {
    if (existingOptions[i].innerHTML == x) return;
  }
  let option = document.createElement("a");
  option.setAttribute("class", "dropdown-item");
  option.text = x;
  displayLabelOptionsElem.appendChild(option);
}

globalThis.ocrAll = {};
function setCurrentHOCR(x) {
  const currentLabel = displayLabelTextElem.innerHTML.trim();
  if (!x.trim() || x == currentLabel) return;

  if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }

  if (currentLabel) {
    if (!globalThis.ocrAll[currentLabel]) {
      globalThis.ocrAll[currentLabel] = Array(globalThis.imageAll["native"].length);
      for(let i=0;i<globalThis.imageAll["native"].length;i++) {
        globalThis.ocrAll[currentLabel][i] = {hocr:null};
      }
    }
    // globalThis.ocrAll[currentLabel]["hocr"] = globalThis.hocrCurrent;
    for(let i=0;i<globalThis.hocrCurrent.length;i++) {
      globalThis.ocrAll[currentLabel][i]["hocr"] = JSON.parse(JSON.stringify(globalThis.hocrCurrent[i]));
    }
  }
  if (!globalThis.ocrAll[x]) {
    globalThis.ocrAll[x] = Array(globalThis.imageAll["native"].length);
    for(let i=0;i<globalThis.imageAll["native"].length;i++) {
      globalThis.ocrAll[x][i] = {hocr:null};
    }
  }

  //globalThis.hocrCurrent = globalThis.ocrAll[x]["hocr"];
  globalThis.hocrCurrent = globalThis.ocrAll[x].map((y) => y["hocr"]);

  displayLabelTextElem.innerHTML = x;
  currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[currentPage.n], "text/xml");

  if (displayModeElem.value == "eval") {
    renderPageQueue(currentPage.n, 'screen', true);
  } else {
    renderPageQueue(currentPage.n, 'screen', false);
  }

}


function changeZoom(value) {
  if (currentPage.xmlDoc) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc.documentElement.outerHTML;
  }

  let currentValue = parseFloat(zoomInputElem.value);

  if (value == "minus") {
    value = currentValue - 50;
  } else if (value == "plus") {
    value = currentValue + 50;
  }

  // Set min/max values to avoid typos causing unexpected issues
  value = Math.max(value, 300);
  value = Math.min(value, 5000);

  zoomInputElem.value = value;
  renderPageQueue(currentPage.n, "screen", false);
}


function adjustMarginRange(value) {
  globalThis.canvas.viewportTransform[4] = (parseInt(value) - 200);
  globalThis.canvas.renderAll();
}


function adjustMarginRangeChange(value) {
  if (typeof (globalThis.pageMetricsObj["manAdjAll"]) == "undefined") return;
  globalThis.pageMetricsObj["manAdjAll"][currentPage.n] = (parseInt(value) - 200);
}

// Users may select an edit action (e.g. "Add Word", "Recognize Word", etc.) but then never follow through.
// This function cleans up any changes/event listners caused by the initial click in such cases.
document.getElementById('navBar').addEventListener('click', function (e) {
  newWordInit = true;
  canvas.__eventListeners = {};
}, true)


// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
document.getElementById('nav-import').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-import") return;
  hideProgress("import-progress-collapse");
})

document.getElementById('nav-recognize').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-recognize") return;
  hideProgress("import-eval-progress-collapse");
  // hideProgress("render-recognize-progress-collapse");
  hideProgress("recognize-recognize-progress-collapse");
})

document.getElementById('nav-download').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-download") return;
  // hideProgress("render-download-progress-collapse");
  // hideProgress("binary-download-progress-collapse");
  hideProgress("generate-download-progress-collapse");
})




// When the navbar is "sticky", it does not automatically widen for large canvases (when the canvas size is larger than the viewport).
// However, when the navbar is fixed, the canvas does not move out of the way of the navbar.
// Therefore, the navbar is set to fixed, and the canvas is manually moved up/down when tabs are shown/collapsed.
var tabHeightObj = { "nav-import": 66, "nav-recognize": 102, "nav-eval": 89, "nav-view": 117, "nav-edit": 104, "nav-download": 104, "nav-about": 55 }

const paddingRowElem = document.getElementById('paddingRow');

function adjustPaddingRow(e) {
  if (e.target.id != this.id) return;
  let currentHeight = parseInt(paddingRowElem.style.height.slice(0, -2));
  if (e.type == "hide.bs.collapse") {
    paddingRowElem.style.height = currentHeight - tabHeightObj[e.target.id] + "px";
  } else if (e.type == "show.bs.collapse") {
    paddingRowElem.style.height = currentHeight + tabHeightObj[e.target.id] + "px";
  }
}

for (const [key, value] of Object.entries(tabHeightObj)) {
  document.getElementById(key).addEventListener('show.bs.collapse', adjustPaddingRow);
  document.getElementById(key).addEventListener('hide.bs.collapse', adjustPaddingRow);
}


function toggleEditButtons(disable = true) {
  let editButtons = ["styleItalic", "styleSmallCaps", "styleSuper", "editBaseline", "deleteWord", "addWord"];
  for (let i = 0; i < editButtons.length; i++) {
    const editButtonElem = /** @type {HTMLInputElement} */(document.getElementById(editButtons[i]));
    editButtonElem.disabled = disable;
  }
}

function initializeProgress(id, maxValue, initValue = 0) {
  const progressCollapse = document.getElementById(id);

  const progressCollapseObj = new bootstrap.Collapse(progressCollapse, { toggle: false });

  const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];

  progressBar.setAttribute("aria-valuenow", initValue.toString());
  progressBar.setAttribute("style", "width: " + ((initValue / maxValue) * 100) + "%");
  progressBar.setAttribute("aria-valuemax", maxValue);
  progressCollapseObj.show()

  const progressObj = {"elem": progressBar, "value": initValue, "maxValue": maxValue, "increment": async function() {
    this.value++;
    if ((this.value + 1) % 5 == 0 || (this.value + 1) == this.maxValue) {
      this.elem.setAttribute("aria-valuenow", (this.value + 1).toString());
      this.elem.setAttribute("style", "width: " + ((this.value + 1) / maxValue * 100) + "%");
      await sleep(0);
    }
  }} 

  return (progressObj);

}



// Hides progress bar if completed
function hideProgress(id) {
  const progressCollapse = document.getElementById(id);
  if (progressCollapse.getAttribute("class") == "collapse show") {
    const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];
    if (parseInt(progressBar.getAttribute("aria-valuenow")) >= parseInt(progressBar.getAttribute("aria-valuemax"))) {
      progressCollapse.setAttribute("class", "collapse");
    }
  }
}


async function createTesseractScheduler(workerN, config = null) {

  const allConfig = config || getTesseractConfigs();

  // SIMD support can be manually disabled for debugging purposes.
  const disableSIMD = document.getElementById("disableSIMD").checked;

  const buildLabel = document.getElementById("buildLabelText").innerHTML;
  const buildVersion = buildLabel == "Default" ? "" : "-" + buildLabel.toLowerCase();

  let workerOptions;
  if (globalSettings.simdSupport && !disableSIMD) {
    console.log("Using Tesseract with SIMD support (fast LSTM performance).")
    workerOptions = { corePath: './tess/tesseract-core' + buildVersion + '-sse.wasm.js', workerPath: './tess/worker.min.js', langPath: "./tess/lang"};
  } else {
    console.log("Using Tesseract without SIMD support (slow LSTM performance).")
    workerOptions = { corePath: './tess/tesseract-core' + buildVersion + '.wasm.js', workerPath: './tess/worker.min.js', langPath: "./tess/lang" };
  }

  const scheduler = await Tesseract.createScheduler();

  scheduler["workers"] = [];
  for (let i = 0; i < workerN; i++) {
    const w = Tesseract.createWorker(workerOptions);
    await w.load();
    await w.loadLanguage('eng');
    await w.initialize('eng', allConfig.tessedit_ocr_engine_mode);
    await w.setParameters(allConfig);
    scheduler["workers"][i] = w;

    scheduler.addWorker(w);
  }

  // Add config object to scheduler.
  // This does not do anything directly, but allows for easily checking what options were used at a later point.
  scheduler["config"] = allConfig;

  return (scheduler);

}

function getTesseractConfigs() {
  // Get current settings as specified by user
  const oemConfig = document.getElementById("oemLabelText").innerHTML == "Legacy" ? Tesseract.OEM['TESSERACT_ONLY'] : Tesseract.OEM['LSTM_ONLY'];
  const psmConfig = document.getElementById("psmLabelText").innerHTML == "Single Column" ? Tesseract.PSM["SINGLE_COLUMN"] : Tesseract.PSM['AUTO'];

  const allConfig = {
    tessedit_ocr_engine_mode: oemConfig,
    tessedit_pageseg_mode: psmConfig,
    hocr_char_boxes: '1',
    // The Tesseract LSTM engine frequently identifies a bar character "|"
    // This is virtually always a false positive (usually "I").
    tessedit_char_blacklist: "|ﬁﬂéï",
    debug_file: "/debug.txt",
    max_page_gradient_recognize: "100",
    hocr_font_info: "1"
  };

  return (allConfig);
}

// Checks scheduler to see if user has changed settings since scheduler was created
function checkTesseractScheduler(scheduler, config = null) {
  if (!scheduler?.["config"]) return false;
  const allConfig = config || getTesseractConfigs();
  delete scheduler?.["config"].rectangle;

  if (JSON.stringify(scheduler.config) === JSON.stringify(allConfig)) return true;
  return false;

}


function createGroundTruthClick() {
  if (!globalThis.ocrAll["Ground Truth"]) {
    globalThis.ocrAll["Ground Truth"] = Array(globalThis.imageAll["native"].length);
    for(let i=0;i<globalThis.imageAll["native"].length;i++) {
      globalThis.ocrAll["Ground Truth"][i] = {hocr:null};
    }
  }

  for(let i=0;i<globalThis.hocrCurrent.length;i++) {
    globalThis.ocrAll["Ground Truth"][i]["hocr"] = JSON.parse(JSON.stringify(globalThis.hocrCurrent[i]));
  }

  // Use whatever the current HOCR is as a starting point
  // globalThis.ocrAll["Ground Truth"]["hocr"] = structuredClone(globalThis.hocrCurrent);
  addDisplayLabel("Ground Truth");
  setCurrentHOCR("Ground Truth");

  let option = document.createElement("option");
  option.text = "Evaluate Mode (Compare with Ground Truth)";
  option.value = "eval";
  displayModeElem.add(option);

  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = false;
}

globalThis.evalStatsConfig = {};

globalThis.evalStats = [];
async function compareGroundTruthClick(n) {

  // When a document/recognition is still loading only the page statistics can be calculated
  const loadMode = loadCountHOCR && loadCountHOCR < parseInt(convertPageWorker["activeProgress"]?.elem?.getAttribute("aria-valuemax")) ? true : false;

  const evalStatsConfigNew = {};
  evalStatsConfigNew["ocrActive"] = displayLabelTextElem.innerHTML;
  evalStatsConfigNew["ignorePunct"] = ignorePunctElem.checked;
  evalStatsConfigNew["ignoreCap"] = ignoreCapElem.checked;
  evalStatsConfigNew["ignoreExtra"] = ignoreExtraElem.checked;

  // Compare all pages if this has not been done already
  if (!loadMode && JSON.stringify(globalThis.evalStatsConfig) != JSON.stringify(evalStatsConfigNew) || globalThis.evalStats.length == 0) {
    globalThis.evalStats = new Array(globalThis.imageAll["native"].length);
    for (let i = 0; i < globalThis.imageAll["native"].length; i++) {
      const res = await compareHOCR(globalThis.hocrCurrent[i], globalThis.ocrAll["Ground Truth"][i]["hocr"]);
      globalThis.hocrCurrent[i] = res[0].documentElement.outerHTML;
      globalThis.evalStats[i] = res[1];
    }
    globalThis.evalStatsConfig = evalStatsConfigNew;
  }

  const res = await compareHOCR(globalThis.hocrCurrent[n], globalThis.ocrAll["Ground Truth"][n]["hocr"]);

  globalThis.hocrCurrent[n] = res[0].documentElement.outerHTML;
  globalThis.evalStats[n] = res[1];

  // Display metrics for current page
  document.getElementById("metricTotalWordsPage").innerHTML = globalThis.evalStats[n][0];
  document.getElementById("metricCorrectWordsPage").innerHTML = globalThis.evalStats[n][1];
  document.getElementById("metricIncorrectWordsPage").innerHTML = globalThis.evalStats[n][2];
  document.getElementById("metricMissedWordsPage").innerHTML = globalThis.evalStats[n][3];
  document.getElementById("metricExtraWordsPage").innerHTML = globalThis.evalStats[n][4];

  if (evalStatsConfigNew["ignoreExtra"]) {
    document.getElementById("metricWERPage").innerHTML = (Math.round(((globalThis.evalStats[n][2] + globalThis.evalStats[n][3]) / globalThis.evalStats[n][0]) * 100) / 100).toString();
  } else {
    document.getElementById("metricWERPage").innerHTML = (Math.round(((globalThis.evalStats[n][2] + globalThis.evalStats[n][3] + globalThis.evalStats[n][4]) / globalThis.evalStats[n][0]) * 100) / 100).toString();
  }

  // Calculate and display metrics for full document
  if (!loadMode) {
    let evalStatsDoc = [0, 0, 0, 0, 0]
    for (let i = 0; i < globalThis.evalStats.length; i++) {
      evalStatsDoc[0] = evalStatsDoc[0] + globalThis.evalStats[i][0];
      evalStatsDoc[1] = evalStatsDoc[1] + globalThis.evalStats[i][1];
      evalStatsDoc[2] = evalStatsDoc[2] + globalThis.evalStats[i][2];
      evalStatsDoc[3] = evalStatsDoc[3] + globalThis.evalStats[i][3];
      evalStatsDoc[4] = evalStatsDoc[4] + globalThis.evalStats[i][4];
    }

    document.getElementById("metricTotalWordsDoc").innerHTML = evalStatsDoc[0].toString();
    document.getElementById("metricCorrectWordsDoc").innerHTML = evalStatsDoc[1].toString();
    document.getElementById("metricIncorrectWordsDoc").innerHTML = evalStatsDoc[2].toString();
    document.getElementById("metricMissedWordsDoc").innerHTML = evalStatsDoc[3].toString();
    document.getElementById("metricExtraWordsDoc").innerHTML = evalStatsDoc[4].toString();

    if (evalStatsConfigNew["ignoreExtra"]) {
      document.getElementById("metricWERDoc").innerHTML = (Math.round(((evalStatsDoc[2] + evalStatsDoc[3]) / evalStatsDoc[0]) * 100) / 100).toString();
    } else {
      document.getElementById("metricWERDoc").innerHTML = (Math.round(((evalStatsDoc[2] + evalStatsDoc[3] + evalStatsDoc[4]) / evalStatsDoc[0]) * 100) / 100).toString();
    }
  } else {
    document.getElementById("metricTotalWordsDoc").innerHTML = '';
    document.getElementById("metricCorrectWordsDoc").innerHTML = '';
    document.getElementById("metricIncorrectWordsDoc").innerHTML = '';
    document.getElementById("metricMissedWordsDoc").innerHTML = '';
    document.getElementById("metricExtraWordsDoc").innerHTML = '';
    document.getElementById("metricWERDoc").innerHTML = '';
  }

  currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[n], "text/xml");

}





// Note: The coordinate arguments (left/top) refer to the HOCR coordinate space.
// This does not necessarily match either the canvas coordinate space or the Tesseract coordinate space. 
globalThis.recognizeAreaScheduler = null;
async function recognizeArea(imageCoords, wordMode = false) {

  let left = imageCoords.left;
  let top = imageCoords.top;
  let width = imageCoords.width;
  let height = imageCoords.height;

  if (inputDataModes.xmlMode[currentPage.n]) {
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
  }

  const allConfig = getTesseractConfigs();

  if (wordMode) {
    allConfig.tessedit_pageseg_mode = Tesseract.PSM["SINGLE_WORD"];
  }

  // Create new scheduler if one does not exist, or the existing scheduler was created using different settings
  if (!checkTesseractScheduler(globalThis.recognizeAreaScheduler, allConfig)) {
    if (globalThis.recognizeAreaScheduler) {
      await recognizeAreaScheduler.terminate()
      globalThis.recognizeAreaScheduler = null;
    }
    globalThis.recognizeAreaScheduler = await createTesseractScheduler(1, allConfig);
  }
  allConfig.rectangle = { left, top, width, height };

  const inputImage = await globalThis.imageAll["native"][currentPage.n];

  const res = await recognizeAreaScheduler.addJob('recognize', inputImage.src, allConfig);
  let hocrString = res.data.hocr;

  const angleArg = globalThis.imageAll.nativeRotated[currentPage.n] && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n]) > 0.05 ? globalThis.pageMetricsObj["angleAll"][currentPage.n] : 0;

  const oemText = "Tesseract " + document.getElementById("oemLabelText").innerHTML;

  const argsObj = {
    "mode": "area",
    "angle": angleArg,
    "pageDims": globalThis.pageMetricsObj.dimsAll[currentPage.n],
    "engine": oemText
  }

  convertPage([hocrString, currentPage.n, false, argsObj]);

  toggleEditButtons(false);

  return;

}


function calcWordBaseline(wordbox, linebox, baseline) {
  // Adjust box such that top/bottom approximate those coordinates at the leftmost point
  const lineboxAdj = linebox.slice();

  const wordboxXMid = wordbox[0] + (wordbox[2] - wordbox[0]) / 2;

  return (wordboxXMid - lineboxAdj[0]) * baseline[0] + baseline[1] + lineboxAdj[3];
  
}

function combineData(hocrString){

  const lines = currentPage.xmlDoc?.getElementsByClassName("ocr_line");

  const lineRegex = new RegExp(/<span class\=[\"\']ocr_line[\s\S]+?(?:\<\/span\>\s*){2}/, "ig");
  const hocrLinesArr = hocrString.match(lineRegex);

  if (!hocrLinesArr) return;

    // Otherwise, integrate the new data into the existing data
    for (let i = 0; i < hocrLinesArr.length; i++) {
      const lineNewStr = hocrLinesArr[i];
      const titleStrLine = lineNewStr.match(/title\=[\'\"]([^\'\"]+)/)?.[1];
      const lineNew = parser.parseFromString(lineNewStr, "text/xml").firstChild;
      if (![...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]) {
        return;
      }
      const lineBoxNew = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]?.slice(1, 5).map(function (x) { return parseInt(x); });
  
      // For whatever reason Tesseract sometimes returns junk data with negative coordinates.
      // In such cases, the above regex will fail to match anything.
      if (!lineBoxNew) return;
  
      const sinAngle = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180));
  
      // Identify the OCR line a bounding box is in (or closest line if no match exists)
      let lineI = -1;
      let match = false;
      let newLastLine = false;
      let lineBottomHOCR, line, lineMargin;
      do {
        lineI = lineI + 1;
        line = lines[lineI];
        const titleStrLine = line.getAttribute('title');
        const lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
        let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
  
        let boxOffsetY = 0;
        let lineBoxAdj = lineBox.slice();
        if (baseline != null) {
          baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
  
          // Adjust box such that top/bottom approximate those coordinates at the leftmost point.
          if (baseline[0] < 0) {
            lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
          } else {
            lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
          }
          //boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * baseline[0];
          boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * sinAngle;
        } else {
          baseline = [0, 0];
        }
  
        // Calculate size of margin to apply when detecting overlap (~30% of total height applied to each side)
        // This prevents a very small overlap from causing a word to be placed on an existing line
        const lineHeight = lineBoxAdj[3] - lineBoxAdj[1];
        lineMargin = Math.round(lineHeight * 0.30);
  
        let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
        lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;
  
        if ((lineTopHOCR + lineMargin) < lineBoxNew[3] && (lineBottomHOCR - lineMargin) >= lineBoxNew[1]) match = true;
        if ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 == lines.length) newLastLine = true;
  
      } while ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 < lines.length);
  
      let words = line.getElementsByClassName("ocrx_word");
      let wordsNew = lineNew.getElementsByClassName("ocrx_word");
  
      if (match) {
        // Inserting wordNew seems to remove it from the wordsNew array
        const wordsNewLen = wordsNew.length;
        for (let i = 0; i < wordsNewLen; i++) {
          let wordNew = wordsNew[0];

          let wordNewtitleStr = wordNew.getAttribute('title') ?? "";
          const wordBoxNew = [...wordNewtitleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

          // Identify closest word on existing line
          let word, wordBox;
          let j = 0;
          do {
            word = words[j];
            if (!word.childNodes[0]?.textContent.trim()) continue;
            let titleStr = word.getAttribute('title') ?? "";
            wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
            j = j + 1;
          } while (wordBox[2] < wordBoxNew[0] && j < words.length);
  
          // Replace id (which is likely duplicative) with unique id
          let wordChosenID = word.getAttribute('id');
          let wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
          wordNew.setAttribute("id", wordIDNew)
  
          // Add to page XML
          // Note: Words will appear correctly on the canvas (and in the pdf) regardless of whether they are in the right order.
          // However, it is still important to get the order correct (this makes evaluation easier, improves copy/paste functionality in some pdf readers, etc.)
          if (wordBoxNew[0] > wordBox[0]) {
            word.insertAdjacentElement("afterend", wordNew);
          } else {
            word.insertAdjacentElement("beforebegin", wordNew);
          }
        }
      } else {
        // Replace id (which is likely duplicative) with unique id
        let lineChosenID = lineNew.getAttribute('id');
        let lineIDNew = lineChosenID + getRandomAlphanum(3).join('');
        lineNew.setAttribute("id", lineIDNew);
  
        for (let i = 0; i < wordsNew.length; i++) {
          let wordNew = wordsNew[i];
  
          // Replace id (which is likely duplicative) with unique id
          let wordChosenID = wordNew.getAttribute('id');
          let wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
          wordNew.setAttribute("id", wordIDNew)
        }
  
        if (newLastLine) {
          line.insertAdjacentElement("afterend", lineNew);
        } else {
          line.insertAdjacentElement("beforebegin", lineNew);
        }
      }
    }
  
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
    
}

async function recognizeAll() {

  // User can select engine directly using advanced options, or indirectly using basic options. 
  let oemMode;
  if(enableAdvancedRecognitionElem.checked) {
    oemMode = document.getElementById("oemLabelText").innerHTML;
  } else {
    if(ocrQualityElem.value == "1") {
      oemMode = "combined";
    } else {
      oemMode = "legacy";
      setOemLabel("legacy");
    }
  }

  // A single Tesseract engine can be used (Legacy or LSTM) or the results from both can be used and combined. 
  if(oemMode == "legacy" || oemMode == "lstm") {
    await recognizePages(false, null, true);

  } else if (oemMode == "combined") {

    loadCountHOCR = 0;
    convertPageWorker["activeProgress"] = initializeProgress("recognize-recognize-progress-collapse", globalThis.imageAll["native"].length * 2);
    globalThis.fontVariantsMessage = new Array(globalThis.imageAll["native"].length);

    const config = getTesseractConfigs();
    config.tessedit_ocr_engine_mode = "0";
    await recognizePages(false, config, true, true);
    config.tessedit_ocr_engine_mode = "1";
    await recognizePages(false, config, false, true);
  
    // Whether user uploaded data will be compared against in addition to both Tesseract engines
    const userUploadMode = Boolean(globalThis.ocrAll["User Upload"]);

    const debugMode = true;

    if(debugMode) {
      globalThis.debugImg = {};
      globalThis.debugImg["Combined"] = new Array(globalThis.imageAll["native"].length);
      for(let i=0; i < globalThis.imageAll["native"].length; i++) {
        globalThis.debugImg["Combined"][i] = [];
      }
    }

    if(userUploadMode) {
      addDisplayLabel("Tesseract Combined");
      setCurrentHOCR("Tesseract Combined");  
      if (debugMode) {
        globalThis.debugImg["Tesseract Combined"] = new Array(globalThis.imageAll["native"].length);
        for(let i=0; i < globalThis.imageAll["native"].length; i++) {
          globalThis.debugImg["Tesseract Combined"][i] = [];
        }
      }
    }

    addDisplayLabel("Combined");
    setCurrentHOCR("Combined");      
    
    for(let i=0;i<globalThis.imageAll["native"].length;i++) {

      const tessCombinedLabel = userUploadMode ? "Tesseract Combined" : "Combined";

      globalThis.ocrAll[tessCombinedLabel][i]["hocr"] = await compareHOCR(ocrAll["Tesseract Legacy"][i]["hocr"], ocrAll["Tesseract LSTM"][i]["hocr"], "comb", i, tessCombinedLabel);
      globalThis.hocrCurrent[i] = ocrAll[tessCombinedLabel][i]["hocr"];

      // If the user uploaded data, compare to that as well
      if(userUploadMode) {
        globalThis.ocrAll["Combined"][i]["hocr"] = await compareHOCR(ocrAll["Tesseract Combined"][i]["hocr"], ocrAll["User Upload"][i]["hocr"], "comb", i, "Combined");
        globalThis.hocrCurrent[i] = ocrAll["Combined"][i]["hocr"];  
      }
    }  
  }

  currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[currentPage.n], "text/xml");

  renderPageQueue(currentPage.n);

  return(true);

}

async function showDebugImages() {

  if (!showConflictsElem.checked) {
    canvasDebug.clear();
    document.getElementById("g")?.setAttribute("style", "display:none");
    return;
  }

  canvasDebug.clear();
  document.getElementById("g")?.setAttribute("style", "");

  if (!globalThis.debugImg?.Combined?.[currentPage.n]) return;

  const imgArr = globalThis.debugImg.Combined[currentPage.n];

  let top = 0;
  let leftMax = 150;

  for (let i=0; i<imgArr.length; i++) {
    const img1 = imgArr[i][0];
    const img2 = imgArr[i][1];

    const imgElem1 = document.createElement('img');
    await loadImage(img1, imgElem1);
    const imgElem2 = document.createElement('img');
    await loadImage(img2, imgElem2);

    const imgFab1 = new fabric.Image(imgElem1, {left: 0, top: top});
    const imgFab2 = new fabric.Image(imgElem2, {left: imgElem1.width + 10, top: top});

    canvasDebug.add(imgFab1);
    canvasDebug.add(imgFab2);

    top += imgElem1.height + 10;
    leftMax = Math.max(leftMax, imgElem1.width + imgElem2.width + 10);
  }

  canvasDebug.setWidth(leftMax);
  canvasDebug.setHeight(top);

  canvasDebug.renderAll();
}


async function recognizePages(single = false, config = null, saveMetrics = true, comb = false) {

  const allConfig = config || getTesseractConfigs();
  let scheduler;

  if(!single){

    // When running in Legacy + LSTM combined mode, recognizePages is run twice, so the progress bar is initialized outside this function.
    if(!comb){
      loadCountHOCR = 0;

      convertPageWorker["activeProgress"] = initializeProgress("recognize-recognize-progress-collapse", globalThis.imageAll["native"].length);
  
      globalThis.fontVariantsMessage = new Array(globalThis.imageAll["native"].length);  
    globalThis.fontVariantsMessage = new Array(globalThis.imageAll["native"].length);
      globalThis.fontVariantsMessage = new Array(globalThis.imageAll["native"].length);  
    }
  
    // Render all pages to PNG
    if (inputDataModes.pdfMode) {
      await initSchedulerIfNeeded("muPDFScheduler");
  
      //muPDFScheduler["activeProgress"] = initializeProgress("render-recognize-progress-collapse", imageAll["native"].length, muPDFScheduler["pngRenderCount"]);
      let time1 = Date.now();
      await renderPDFImageCache([...Array(globalThis.imageAll["native"].length).keys()]);
      let time2 = Date.now();
      console.log("renderPDFImageCache runtime: " + (time2 - time1) / 1e3 + "s");
    }

    let workerN = Math.round((globalThis.navigator.hardwareConcurrency || 8) / 2);
    // Use at most 6 workers.  While some systems could support many more workers in theory,
    // browser-imposed memory limits make this problematic in reality.
    workerN = Math.min(workerN, 6);
    // Do not create more workers than there are pages
    workerN = Math.min(workerN, Math.ceil(globalThis.imageAll["native"].length));
  
    console.log("Using " + workerN + " workers for OCR.")
  
  
    scheduler = await createTesseractScheduler(workerN, allConfig);
  } else {
    
    // Create new scheduler if one does not exist, or the existing scheduler was created using different settings
    if (!checkTesseractScheduler(globalThis.recognizeAreaScheduler, allConfig)) {
      if (globalThis.recognizeAreaScheduler) {
        await globalThis.recognizeAreaScheduler.terminate()
        globalThis.recognizeAreaScheduler = null;
      }
      globalThis.recognizeAreaScheduler = await createTesseractScheduler(1, allConfig);
    }

    scheduler = recognizeAreaScheduler;
  }

  // OCR results from different engines are only saved separately when running recognition on an entire document. 
  // Running recognition on a single page will simply overwrite whatever data is actively displayed. 
  const oemText = "Tesseract " + (allConfig.tessedit_ocr_engine_mode == "1" ? "LSTM" : "Legacy");
  if(!single) {
    addDisplayLabel(oemText);
    setCurrentHOCR(oemText);  
  }
  const mode = single ? "page" : "full";

  let recognizeImages = async (pagesArr) => {
    let time1 = Date.now();

    const rets = await Promise.allSettled(pagesArr.map(async (x) => {

      // Whether the binary image should be rotated
      const rotate = true;
      const angleKnown = typeof (globalThis.pageMetricsObj["angleAll"]?.[x]) == "number";

      // Do not rotate an image that has already been rotated
      const rotateDegrees = rotate && Math.abs(globalThis.pageMetricsObj["angleAll"][x]) > 0.05 && !globalThis.imageAll["nativeRotated"][x] ? globalThis.pageMetricsObj["angleAll"][x] * -1 || 0 : 0;
      const rotateRadians = rotateDegrees * (Math.PI / 180);

      const inputImage = await globalThis.imageAll["native"][x];

      const maxGradient = angleKnown ? "100" : "0.01";

      // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
      const saveNativeImage = autoRotateCheckboxElem.checked && !globalThis.imageAll["nativeRotated"][x] && rotateRadians != 0;
      // const saveGreyImageArg = saveNativeImage && colorModeElem.value == "gray" ? "true" : "false";
      // const saveColorImageArg = saveNativeImage && colorModeElem.value == "color" ? "true" : "false";
      const saveColorImageArg = saveNativeImage ? "true" : "false";

      const saveBinaryImageArg = !globalThis.imageAll["binary"][x] || autoRotateCheckboxElem.checked && !globalThis.imageAll["binaryRotated"][x] && rotateRadians != 0 ? "true" : "false";

      return scheduler.addJob('recognize', inputImage.src, {angle: rotateRadians}, {max_page_gradient_recognize: maxGradient, debug_file: "/debug.txt", scribe_save_binary_rotated_image : saveBinaryImageArg, 
        scribe_save_original_rotated_image: saveColorImageArg }).then(async (y) => {

        parseDebugInfo(y.data.debug);

        if(saveBinaryImageArg == "true") {
          const image = document.createElement('img');
          image.src = y.data.imageBinary;
          globalThis.imageAll["binary"][x] = image;
  
          globalThis.imageAll["binaryRotated"][x] = Math.abs(rotateDegrees) > 0.05;
        }

        if(saveNativeImage) {
          const image = document.createElement('img');
          image.src = y.data.imageOriginal;
          globalThis.imageAll["native"][x] = image;
          globalThis.imageAll["nativeRotated"][x] = Math.abs(rotateDegrees) > 0.05;  
        }
    
        globalThis.hocrCurrentRaw[x] = y.data.hocr;

        // If the angle is already known, run once async
        if (angleKnown) {
          const argsObj = {
            "engine": oemText,
            "angle": globalThis.pageMetricsObj["angleAll"][x],
            "mode": mode,
            "saveMetrics": saveMetrics
          }

          // We wait for updateDataProgress because this is the function responsible for triggering the calculation of full-document metrics + font optimization
          // once the document is finished processing. 
          return convertPage([y.data.hocr, x, false, argsObj]).then(async () => {if(!single) await updateDataProgress(saveMetrics, comb)});
        } else {
          
          // If the angle is not already known, we wait until recognition finishes so we know the angle
          //await convertPage([y.data.hocr, x, false, argsObj]);
          // If the angle is >0.25 degree, we rerun with the known angle (which results in the image being rotated in pre-processing step)
          if (/Page Gradient/.test(y.data.debug)) {

            const rotateRadians = parseFloat(y.data.debug.match(/Page Gradient\: ([\-\d\.]+)/)?.[1]);
            const rotateDegrees = rotateRadians * (180 / Math.PI);

            // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
            const saveNativeImage = autoRotateCheckboxElem.checked && !globalThis.imageAll["nativeRotated"][x] && rotateRadians != 0;
            const saveColorImageArg = saveNativeImage ? "true" : "false";
            const saveBinaryImageArg = !globalThis.imageAll["binary"][x] || autoRotateCheckboxElem.checked && !globalThis.imageAll["binaryRotated"][x] && rotateRadians != 0 ? "true" : "false";

            globalThis.pageMetricsObj["angleAll"][x] = rotateDegrees * -1;

            //const inputImage = await globalThis.imageAll["native"][x];
            return scheduler.addJob('recognize', inputImage.src, {angle: rotateRadians}, {scribe_save_binary_rotated_image : saveBinaryImageArg, 
              scribe_save_original_rotated_image: saveColorImageArg}).then(async (y) => {

              parseDebugInfo(y.data.debug);

              if(saveBinaryImageArg == "true") {
                const image = document.createElement('img');
                image.src = y.data.imageBinary;
                globalThis.imageAll["binary"][x] = image;
        
                globalThis.imageAll["binaryRotated"][x] = Math.abs(rotateDegrees) > 0.05;
              }
      
              if(saveNativeImage) {
                const image = document.createElement('img');
                image.src = y.data.imageOriginal;
                globalThis.imageAll["native"][x] = image;
                // globalThis.imageAll["nativeColor"][x] = saveGreyImageArg == "true" ? "gray" : "color";
                globalThis.imageAll["nativeRotated"][x] = Math.abs(rotateDegrees) > 0.05;  
              }
      
              globalThis.hocrCurrentRaw[x] = y.data.hocr;
              const argsObj = {
                "engine": oemText,
                "angle": globalThis.pageMetricsObj["angleAll"][x],
                "mode": mode,
                "saveMetrics": saveMetrics
              }

              return convertPage([y.data.hocr, x, false, argsObj]).then(async () => {if(!single) await updateDataProgress(saveMetrics, comb)});
            });
          } else {

            parseDebugInfo(y.data.debug);

            const argsObj = {
              "engine": oemText,
              "mode": mode,
              "saveMetrics": saveMetrics
            }
            return convertPage([y.data.hocr, x, false, argsObj]).then(async () => {if(!single) await updateDataProgress(saveMetrics, comb)});
          }
        }
      })

    }));

    if(!single) await scheduler.terminate();

    let time2 = Date.now();
    console.log("Runtime: " + (time2 - time1) / 1e3 + "s");
  }

  // Enable confidence threshold input boxes (only used for Tesseract)
  confThreshHighElem.disabled = false;
  confThreshMedElem.disabled = false;

  // Set threshold values if not already set
  confThreshHighElem.value = confThreshHighElem.value || "85";
  confThreshMedElem.value = confThreshMedElem.value || "75";

  toggleEditButtons(false);

  const inputPages = single ? [currentPage.n] : [...Array(globalThis.imageAll["native"].length).keys()];

  await recognizeImages(inputPages);

}

var rect1;
function recognizeAreaClick(wordMode = false) {

  canvas.on('mouse:down', function (o) {
    let pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;
    rect1 = new fabric.Rect({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      width: pointer.x - origX,
      height: pointer.y - origY,
      angle: 0,
      fill: 'rgba(255,0,0,0.5)',
      transparentCorners: false
    });
    canvas.add(rect1);
    canvas.renderAll();
    canvas.on('mouse:move', function (o) {
      let pointer = canvas.getPointer(o.e);

      if (origX > pointer.x) {
        rect1.set({ left: Math.abs(pointer.x) });
      }
      if (origY > pointer.y) {
        rect1.set({ top: Math.abs(pointer.y) });
      }

      rect1.set({ width: Math.abs(origX - pointer.x) });
      rect1.set({ height: Math.abs(origY - pointer.y) });

      canvas.renderAll();
    });
  }, { once: true });

  // mouse:up:before must be used so this code runs ahead of fabric internal logic.
  // Without this changes to active selection caused by mouse movement may change rect object.
  canvas.on('mouse:up:before', async function (o) {

    if(rect1.width < 4 || rect1.height < 4) {
      canvas.remove(rect1);
      return;
    }

    const canvasCoords = {left: rect1.left, top: rect1.top, width: rect1.width, height: rect1.height};

    // TODO: Fix this to work with binary image (binary = true)
    const imageCoords = coords.canvasToImage(canvasCoords, currentPage.n, false);

    canvas.remove(rect1);

    await recognizeArea(imageCoords, wordMode);

    canvas.renderAll();
    canvas.__eventListeners = {}
  }, { once: true });

}


var newWordInit = true;

var rect, origX, origY;
function addWordClick() {
  newWordInit = false;

  canvas.on('mouse:down', function (o) {
    let pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;
    rect = new fabric.Rect({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      width: pointer.x - origX,
      height: pointer.y - origY,
      angle: 0,
      fill: 'rgba(255,0,0,0.5)',
      transparentCorners: false
    });
    canvas.add(rect);
    canvas.renderAll();

    canvas.on('mouse:move', function (o) {

      let pointer = canvas.getPointer(o.e);

      if (origX > pointer.x) {
        rect.set({ left: Math.abs(pointer.x) });
      }
      if (origY > pointer.y) {
        rect.set({ top: Math.abs(pointer.y) });
      }

      rect.set({ width: Math.abs(origX - pointer.x) });
      rect.set({ height: Math.abs(origY - pointer.y) });

      canvas.renderAll();
    });

  });

  // mouse:up:before must be used so this code runs ahead of fabric internal logic.
  // Without this changes to active selection caused by mouse movement may change rect object.
  canvas.on('mouse:up:before', async function (o) {

    canvas.__eventListeners = {}
    if (newWordInit) { return; }
    newWordInit = true;


    let fillColorHex = "#00ff7b";

    let opacity_arg, fill_arg;
    if (displayModeElem.value == "invis") {
      opacity_arg = 0;
      fill_arg = "black";
    } else if (displayModeElem.value == "ebook") {
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
    let sinAngle = 0;
    let shiftX = 0;
    let shiftY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n] ?? 0) > 0.05) {

      const rotateAngle = globalThis.pageMetricsObj["angleAll"][currentPage.n];

      const pageDims = globalThis.pageMetricsObj["dimsAll"][currentPage.n];

      sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
      const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

      shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
      shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

      const baselineY = (rect.top + rect.height) - (rect.height) / 3;

      const angleAdjYInt = (1 - cosAngle) * (baselineY - shiftY) - sinAngle * (rect.left - shiftX);
      const angleAdjXInt = sinAngle * ((baselineY - shiftY) - angleAdjYInt * 0.5);

      angleAdjXRect = angleAdjXInt + shiftX;
      angleAdjYRect = angleAdjYInt + shiftY;

    }

    // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
    let rectTopHOCR = rect.top - angleAdjYRect;
    let rectBottomHOCR = rect.top + rect.height - angleAdjYRect;

    let rectTopCoreHOCR = Math.round(rect.top + rect.height * 0.2 - angleAdjYRect);
    let rectBottomCoreHOCR = Math.round(rect.top + rect.height * 0.8 - angleAdjYRect);

    let rectLeftHOCR = rect.left - angleAdjXRect - currentPage.leftAdjX;
    let rectRightHOCR = rect.left + rect.width - angleAdjXRect - currentPage.leftAdjX;
    let rectMidHOCR = rect.left + rect.width * 0.5 - angleAdjXRect - currentPage.leftAdjX;

    let lines = currentPage.xmlDoc.getElementsByClassName("ocr_line");

    // Identify the OCR line a bounding box is in (or closest line if no match exists)
    let lineI = -1;
    let match = false;
    let newLastLine = false;
    let line, lineBox, baseline, lineBottomHOCR, titleStrLine, fontSize;
    do {
      lineI = lineI + 1;
      line = lines[lineI];
      titleStrLine = line.getAttribute('title');
      if (![...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]) {
        debugger;
      }
      lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
      baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);

      let boxOffsetY = 0;
      let lineBoxAdj = lineBox.slice();
      if (baseline != null) {
        baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });

        // Adjust box such that top/bottom approximate those coordinates at the leftmost point.
        if (baseline[0] < 0) {
          lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        } else {
          lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        }
        //boxOffsetY = (rectMidHOCR - lineBoxAdj[0]) * baseline[0];
        boxOffsetY = (rectMidHOCR - lineBoxAdj[0]) * sinAngle;
      } else {
        baseline = [0, 0];
      }

      let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
      lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;
      if (lineTopHOCR < rectBottomCoreHOCR && lineBottomHOCR >= rectTopCoreHOCR) match = true;
      if (lineBottomHOCR < rectTopCoreHOCR && lineI + 1 == lines.length) newLastLine = true;

    } while (lineBottomHOCR < rectTopCoreHOCR && lineI + 1 < lines.length);

    // line is set to either the matched line or a nearby line
    //let line = match ? lines[lineI] : lines[Math.min(i-1,0)];

    let words = line.getElementsByClassName("ocrx_word");
    // Case when a word is being added to an existing line
    if (match) {

      lineBoxChosen = lineBox;
      baselineChosen = baseline;
      titleStrLineChosen = titleStrLine;

      // Identify closest word on existing line
      let word, box;
      let i = 0;
      do {
        word = words[i];
        if (!word.childNodes[0]?.textContent.trim()) continue;
        let titleStr = word.getAttribute('title') ?? "";
        box = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
        i = i + 1;
      } while (box[2] < rect.left && i < words.length);

      let wordChosenID = word.getAttribute('id');
      let wordBox = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

      // Append 3 random characters to avoid conflicts without having to keep track of all words
      wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
      const wordNewStr = '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + wordBox.join(' ') + ';x_wconf 100">' + wordText + '</span>'

      const wordNew = parser.parseFromString(wordNewStr, "text/xml");

      if (i == words.length) {
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
      if (lineI == 0 || lineI + 1 == lines.length) {
        sizeStr = "x_size " + Math.round(rect.height) + ";";
        baselineChosen = [0, 0];

        // If the new line is between two existing lines, use metrics from nearby line to determine text size
      } else {
        let letterHeight = titleStrLine.match(/x_size\s+([\d\.\-]+)/);

        let ascHeight = titleStrLine.match(/x_ascenders\s+([\d\.\-]+)/);
        let descHeight = titleStrLine.match(/x_descenders\s+([\d\.\-]+)/);
        letterHeight = letterHeight != null ? "x_size " + letterHeight[1] : "";
        ascHeight = ascHeight != null ? "x_ascenders " + ascHeight[1] : "";
        descHeight = descHeight != null ? "x_descenders " + descHeight[1] : "";
        sizeStr = [letterHeight, ascHeight, descHeight].join(';');

        // Check if these stats are significantly different from the box the user specified
        let letterHeightFloat = parseFloat(letterHeight.match(/[\d\.\-]+/)?.[0]) || 0;
        let descHeightFloat = parseFloat(descHeight.match(/[\d\.\-]+/)?.[0]) || 0;

        if ((letterHeightFloat - descHeightFloat) > rect.height * 1.5) {
          sizeStr = "x_size " + Math.round(rect.height) + ";";
          baselineChosen = [0, 0];
        }

        let baselineStr = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
        if (baselineStr != null) {
          baselineChosen = baselineStr.slice(1, 5).map(function (x) { return parseInt(x); });
        } else {
          baselineChosen = [0, 0];
        }
      }
      titleStrLineChosen = 'bbox ' + lineBoxChosen.join(' ') + ';baseline ' + baselineChosen.join(' ') + ';' + sizeStr;

      let lineXmlNewStr = '<span class="ocr_line" title="' + titleStrLineChosen + '">';
      lineXmlNewStr = lineXmlNewStr + '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + lineBoxChosen.join(' ') + ';x_wconf 100">' + wordText + '</span>'
      lineXmlNewStr = lineXmlNewStr + "</span>"

      const lineXmlNew = parser.parseFromString(lineXmlNewStr, "text/xml");

      if (newLastLine) {
        line.insertAdjacentElement("afterend", lineXmlNew.firstChild);
      } else {
        line.insertAdjacentElement("beforebegin", lineXmlNew.firstChild);
      }
    }

    // Adjustments are recalculated using the actual bounding box (which is different from the initial one calculated above)
    let angleAdjX = 0;
    let angleAdjY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n] ?? 0) > 0.05) {
      const angleAdjXInt = sinAngle * (lineBoxChosen[3] + baselineChosen[1]);
      const angleAdjYInt = sinAngle * (lineBoxChosen[0] + angleAdjXInt / 2) * -1;

      angleAdjX = angleAdjXInt + shiftX;
      angleAdjY = angleAdjYInt + shiftY;

    }

    let letterHeight = parseFloat(titleStrLineChosen.match(/x_size\s+([\d\.\-]+)/)?.[1]);
    let ascHeight = parseFloat(titleStrLineChosen.match(/x_ascenders\s+([\d\.\-]+)/)?.[1]);
    let descHeight = parseFloat(titleStrLineChosen.match(/x_descenders\s+([\d\.\-]+)/)?.[1]);

    if (letterHeight && ascHeight && descHeight) {
      let xHeight = letterHeight - ascHeight - descHeight;
      fontSize = getFontSize(globalSettings.defaultFont, xHeight, "o", ctx);
    } else if (letterHeight) {
      fontSize = getFontSize(globalSettings.defaultFont, letterHeight, "A", ctx);
    }

    ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
    const oMetrics = ctx.measureText("o");
    const jMetrics = ctx.measureText("gjpqy");
    ctx.font = fontSize + 'px ' + globalSettings.defaultFont;

    // The function fontBoundingBoxDescent currently is not enabled by default in Firefox.
    // Can return to this simpler code if that changes.
    // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics/fontBoundingBoxDescent
    //let fontDesc = (jMetrics.fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    const fontNormal = await globalThis.fontObj[globalSettings.defaultFont]["normal"];
    //const fontItalic = await fontObj[globalSettings.defaultFont]["italic"];

    let fontBoundingBoxDescent = Math.round(Math.abs(fontNormal.descender) * (1000 / fontNormal.unitsPerEm));

    let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    let top = lineBoxChosen[3] + baselineChosen[1] + fontDesc + angleAdjY;

    let textbox = new fabric.IText(wordText, {
      left: rect.left,
      top: top,
      leftOrig: rect.left,
      topOrig: top,
      baselineAdj: 0,
      wordSup: false,
      originY: "bottom",
      fill: fill_arg,
      fill_proof: fillColorHex,
      fill_ebook: 'black',
      fontFamily: globalSettings.defaultFont,
      fontStyle: "normal",
      wordID: wordIDNew,
      //line: i,
      boxWidth: rect.width,
      defaultFontFamily: true,
      opacity: 1,
      //charSpacing: kerning * 1000 / wordFontSize
      fontSize: fontSize
    });

    textbox.hasControls = true;
    textbox.setControlsVisibility({bl:false,br:false,mb:false,ml:true,mr:true,mt:false,tl:false,tr:false,mtr:false});

    textbox.on('editing:exited', async function () {
      if (this.hasStateChanged) {
        if (document.getElementById("smartQuotes").checked && /[\'\"]/.test(this.text)) {
          let textInt = this.text;
          textInt = textInt.replace(/(^|[-–—])\'/, "$1‘");
          textInt = textInt.replace(/(^|[-–—])\"/, "$1“");
          textInt = textInt.replace(/\'(?=$|[-–—])/, "’");
          textInt = textInt.replace(/\"(?=$|[-–—])/, "”");
          textInt = textInt.replace(/([a-z])\'(?=[a-z]$)/i, "$1’");
          this.text = textInt;
        }
        const wordWidth = await calcWordWidth(this.text, this.fontFamily, this.fontSize, this.fontStyle);
        if (this.text.length > 1) {
          const kerning = round3((this.boxWidth - wordWidth) / (this.text.length - 1));
          this.charSpacing = kerning * 1000 / this.fontSize;
        }
        updateHOCRWord(this.wordID, this.text)
      }
    });
    textbox.on('selected', function () {
      const fontFamily = this.fontFamily.replace(/ Small Caps/, "");
      if (!this.defaultFontFamily && Object.keys(globalThis.fontObj).includes(fontFamily)) {
        wordFontElem.value = fontFamily;
      }
      fontSizeElem.value = this.fontSize;
      if(this.wordSup != styleSuperElem.classList.contains("active")) {
        styleSuperButton.toggle();
      }
      const italic = this.fontStyle == "italic";
      if(italic != styleItalicElem.classList.contains("active")) {
        styleItalicButton.toggle();
      }
      const smallCaps = /Small Caps/i.test(this.fontFamily);
      if(smallCaps != styleSmallCapsElem.classList.contains("active")) {
        styleSmallCapsButton.toggle();
      }
    });
    textbox.on('deselected', function () {
      wordFontElem.value = "Default";
      bsCollapse.hide();
      rangeBaselineElem.value = "100";
    });

    textbox.on('modified', async (opt) => {
      // inspect action and check if the value is what you are looking for
      if (opt.action == "scaleX") {
        const textboxWidth = opt.target.calcTextWidth()
        const wordMetrics = await calcWordMetrics(opt.target.text, opt.target.fontFamily, opt.target.fontSize, opt.target.fontStyle);
        const widthCalc = (textboxWidth - wordMetrics[1]) * opt.target.scaleX;

        let rightNow = opt.target.left + widthCalc;
        let rightOrig = opt.target.leftOrig + opt.target.boxWidth;

        updateHOCRBoundingBoxWord(opt.target.wordID, Math.round(opt.target.left - opt.target.leftOrig), Math.round(rightNow - rightOrig));
        if (opt.target.text.length > 1) {


          const widthDelta = widthCalc - opt.target.boxWidth;
          if (widthDelta != 0) {
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
    canvas.renderAll();
    canvas.__eventListeners = {}

  });
}

// Resets the environment.
var fontMetricObjsMessage, loadCountHOCR;
async function clearFiles() {

  currentPage.n = 0;

  globalThis.imageAll = {};
  globalThis.hocrCurrent = [];
  globalThis.fontMetricsObj = {};
  globalThis.pageMetricsObj = {};
  fontMetricObjsMessage = [];

  if (globalThis.binaryScheduler) {
    const bs = await globalThis.binaryScheduler;
    bs.terminate();
    globalThis.binaryScheduler = null;
  }

  if (globalThis.muPDFScheduler) {
    const ms = await globalThis.muPDFScheduler;
    globalThis.ms.terminate();
    globalThis.muPDFScheduler = null;
  }

  loadCountHOCR = 0;

  canvas.clear()
  pageCountElem.textContent = "";
  pageNumElem.value = "";
  downloadFileNameElem.value = "";
  uploaderElem.value = "";
  optimizeFontElem.checked = false;
  optimizeFontElem.disabled = true;
  downloadElem.disabled = true;
  addOverlayCheckboxElem.disabled = true;
  confThreshHighElem.disabled = true;
  confThreshMedElem.disabled = true;
  recognizeAllElem.disabled = true;
  // recognizePageElem.disabled = true;
  recognizeAreaElem.disabled = true;
  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = true;
  uploadOCRButtonElem.disabled = true;
  toggleEditButtons(true);

}

clearFiles();


// TODO: See if this can be easily combined with the main import function, since most of it is copy/paste from that
async function importOCRFiles() {
  // TODO: Add input validation for names (e.g. unique, no illegal symbols, not named "Ground Truth" or other reserved name)
  const ocrName = uploadOCRNameElem.value;
  const hocrFilesAll = uploadOCRFileElem.files;

  if (hocrFilesAll.length == 0) return;

  displayLabelTextElem.disabled = true;

  const mainData = false;

  if (mainData) {

    globalThis.pageMetricsObj["angleAll"] = [];
    globalThis.pageMetricsObj["dimsAll"] = [];
    globalThis.pageMetricsObj["leftAll"] = [];
    globalThis.pageMetricsObj["angleAdjAll"] = [];
    globalThis.pageMetricsObj["manAdjAll"] = [];
  }

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1 ? true : false;

  let hocrStrStart = "";
  let hocrStrEnd = "";
  let abbyyMode, hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

  //displayLabelTextElem.innerHTML = ocrName;

  if (singleHOCRMode) {
    const singleHOCRMode = true;
    let hocrStrAll = await readOcrFile(hocrFilesAll[0]);

    // Check whether input is Abbyy XML
    const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
    abbyyMode = /abbyy/i.test(node2) ? true : false;

    if (abbyyMode) {

      hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
      hocrArrPages = hocrStrPages.split(/(?=\<page)/);
    } else {

      if(mainData) {
        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

        if (inputDataModes.resumeMode) {
          let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
          let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
          globalThis.fontMetricsObj = JSON.parse(contentStr);
        }
      }

      hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
      hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
      hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
      hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
      hocrStrPages = hocrStrPages.trim();

      hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
    }

    pageCountHOCR = hocrArrPages.length;
    globalThis.hocrCurrentRaw = Array(pageCountHOCR);
    for (let i = 0; i < pageCountHOCR; i++) {
      globalThis.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }

  } else {
    const singleHOCRMode = false;
    pageCountHOCR = hocrFilesAll.length;

    // Check whether input is Abbyy XML using the first file
    let hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
    const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
    abbyyMode = /abbyy/i.test(node2) ? true : false;
  }

  // Enable confidence threshold input boxes (only used for Tesseract)
  if (!abbyyMode && confThreshHighElem.disabled) {
    confThreshHighElem.disabled = false;
    confThreshMedElem.disabled = false;
    confThreshHighElem.value = "85";
    confThreshMedElem.value = "75";
  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (globalThis.imageAll["native"]) {
    if (globalThis.imageAll["native"].length != pageCountHOCR) {
      document.getElementById("pageMismatchAlertTextRec").textContent = " Page mismatch detected. Image data has " + pageCountImage + " pages while OCR data has " + pageCountHOCR + " pages."
      document.getElementById("pageMismatchAlertRec").setAttribute("style", "");
    }
  }

  loadCountHOCR = 0;
  convertPageWorker["activeProgress"] = initializeProgress("import-eval-progress-collapse", pageCountHOCR);

  toggleEditButtons(false);
  for (let i = 0; i < pageCountHOCR; i++) {

    // Process HOCR using web worker, reading from file first if that has not been done already
    if (singleHOCRMode) {
      //convertPageWorker.postMessage([globalThis.hocrCurrentRaw[i], i, abbyyMode]);
      convertPage([globalThis.hocrCurrentRaw[i], i, abbyyMode]).then(() => updateDataProgress(mainData));
    } else {
      const hocrFile = hocrFilesAll[i];
      //readOcrFile(hocrFile).then((x) => convertPageWorker.postMessage([x, i]));
      readOcrFile(hocrFile).then((x) => convertPage([x, i, undefined]).then(() => updateDataProgress(mainData)));
    }

  }

  uploadOCRNameElem.value = '';
  uploadOCRFileElem.value = '';
  new bootstrap.Collapse(uploadOCRDataElem, { toggle: true })

  addDisplayLabel(ocrName);
  setCurrentHOCR(ocrName);
  displayLabelTextElem.disabled = true;

}


async function importFiles() {

  // It looks like the "load" event is not always triggered (when the page is refreshed).
  // This is a quick fix to make sure this function always runs.
  // if(!globalThis.runOnLoadRun){
  //   globalThis.runOnLoad();
  // }

  globalThis.runOnLoad();

  const curFiles = uploaderElem.files;

  if (curFiles.length == 0) return;

  globalThis.state.importDone = false;

  globalThis.pageMetricsObj = {};
  globalThis.pageMetricsObj["angleAll"] = [];
  globalThis.pageMetricsObj["dimsAll"] = [];
  globalThis.pageMetricsObj["leftAll"] = [];
  globalThis.pageMetricsObj["angleAdjAll"] = [];
  globalThis.pageMetricsObj["manAdjAll"] = [];


  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  let imageFilesAll = [];
  let hocrFilesAll = [];
  let pdfFilesAll = []
  let unsupportedFilesAll = [];
  let unsupportedExt = {};
  for (let i = 0; i < curFiles.length; i++) {
    const file = curFiles[i];
    let fileExt = file.name.match(/\.([^\.]+)$/)?.[1].toLowerCase() || "";

    if (["png", "jpeg", "jpg"].includes(fileExt)) {
      imageFilesAll.push(file);
      // All .gz files are assumed to be OCR data (xml) since all other file types can be compressed already
    } else if (["hocr", "xml", "html", "gz"].includes(fileExt)) {
      hocrFilesAll.push(file);
    } else if (["pdf"].includes(fileExt)) {
      pdfFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  inputDataModes.pdfMode = pdfFilesAll.length == 1 ? true : false;
  inputDataModes.imageMode = imageFilesAll.length > 0 && !inputDataModes.pdfMode ? true : false;

  const xmlModeImport = hocrFilesAll.length > 0 ? true : false;

  if (inputDataModes.imageMode || inputDataModes.pdfMode) {
    recognizeAllElem.disabled = false;
    // recognizePageElem.disabled = false;
    recognizeAreaElem.disabled = false;
    createGroundTruthElem.disabled = false;
    uploadOCRButtonElem.disabled = false;

    // Color vs. grayscale is an option passed to mupdf, so can only be used with pdf inputs
    // Binary images are calculated separately by Leptonica (within Tesseract) so apply to both
    const colorModeElemOptions = colorModeElem.children;
    while (colorModeElemOptions.length > 0) {
      colorModeElemOptions[0].remove();
    }
    if (inputDataModes.imageMode) {
      let option = document.createElement("option");
      option.text = "Native";
      option.value = "color";
      option.selected = true;
      colorModeElem.add(option);
    } else {
      let option = document.createElement("option");
      option.text = "Color";
      option.value = "color";
      colorModeElem.add(option);
      option = document.createElement("option");
      option.text = "Grayscale";
      option.value = "gray";
      option.selected = true;
      colorModeElem.add(option);
    }
    let option = document.createElement("option");
    option.text = "Binary";
    option.value = "binary";
    colorModeElem.add(option);

    // For PDF inputs, enable "Add Text to Import PDF" option
    if(inputDataModes.pdfMode) {
      addOverlayCheckboxElem.checked = true;
      addOverlayCheckboxElem.disabled = false;
    } else {
      addOverlayCheckboxElem.checked = false;
      addOverlayCheckboxElem.disabled = true;
    }
  }

  imageFilesAll.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
  hocrFilesAll.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

  // Check that input makes sense.  Valid options are:
  // (1) N HOCR files and 0 image files
  // (1) N HOCR files and N image files
  // (1) 1 HOCR file and N image files
  if (hocrFilesAll.length > 1 && inputDataModes.imageMode && hocrFilesAll.length != imageFilesAll.length) {
    throw new Error('Detected ' + hocrFilesAll.length + ' hocr files but ' + imageFilesAll.length + " image files.")
  }

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, "");
  downloadFileName = downloadFileName + ".pdf";
  downloadFileNameElem.value = downloadFileName;

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1 ? true : false;

  //let pageCount, hocrCurrentRaw, abbyyMode;
  let hocrStrStart = "";
  let hocrStrEnd = "";
  let abbyyMode, hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

  if (inputDataModes.pdfMode) {

    globalThis.pdfFile = pdfFilesAll[0];

    // Initialize scheduler
    await initSchedulerIfNeeded("muPDFScheduler");

    const ms = await globalThis.muPDFScheduler;

    pageCountImage = await ms.addJob('countPages', []);

    // If no XML data is provided, page sizes are calculated using muPDF alone
    if(!xmlModeImport) {
      // Confirm that 300 dpi leads to a reasonably sized image and lower dpi if not.
      const pageDims1 = (await ms.addJob('pageSizes', [300])).slice(1);

      // For reasons that are unclear, a small number of pages have been rendered into massive files
      // so a hard-cap on resolution must be imposed.
      const pageWidth1 = pageDims1.map((x) => x[0]);
      const pageDPI = pageWidth1.map((x) => Math.round(300 * 2000 / Math.max(x, 2000)));

      console.log("DPI " + String(pageDPI));

      // In addition to capping the resolution, also switch the width/height
      const pageDims = pageDims1.map((x,i) => [Math.round(x[1]*pageDPI[i]/300),Math.round(x[0]*pageDPI[i]/300)]);

      globalThis.pageMetricsObj["dimsAll"] = pageDims;

    }

  } else if (inputDataModes.imageMode) {
    pageCountImage = imageFilesAll.length;
  }

  if (xmlModeImport) {

    addDisplayLabel("User Upload");
    displayLabelTextElem.innerHTML = "User Upload";

    if (singleHOCRMode) {
      const singleHOCRMode = true;
      let hocrStrAll = await readOcrFile(hocrFilesAll[0]);

      // Check whether input is Abbyy XML
      const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
      abbyyMode = /abbyy/i.test(node2) ? true : false;

      if (abbyyMode) {

        hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
        hocrArrPages = hocrStrPages.split(/(?=\<page)/);
      } else {

        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

        if (inputDataModes.resumeMode) {
          let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
          let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
          globalThis.fontMetricsObj = JSON.parse(contentStr);

        }

        hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
        hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
        hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
        hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
        hocrStrPages = hocrStrPages.trim();

        hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
      }

      pageCountHOCR = hocrArrPages.length;
      if (inputDataModes.imageMode && hocrArrPages.length != imageFilesAll.length) {
        throw new Error('Detected ' + hocrArrPages.length + ' pages in OCR but ' + imageFilesAll.length + " image files.")
      }
      globalThis.hocrCurrentRaw = Array(pageCountHOCR);
      for (let i = 0; i < pageCountHOCR; i++) {
        globalThis.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
      }

    } else {
      const singleHOCRMode = false;
      pageCountHOCR = hocrFilesAll.length;

      // Check whether input is Abbyy XML using the first file
      let hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
      const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
      abbyyMode = /abbyy/i.test(node2) ? true : false;
    }

    // Enable confidence threshold input boxes (only used for Tesseract)
    if (!abbyyMode) {
      confThreshHighElem.disabled = false;
      confThreshMedElem.disabled = false;
      confThreshHighElem.value = "85";
      confThreshMedElem.value = "75";
    }

  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (xmlModeImport && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    if (pageCountImage != pageCountHOCR) {
      document.getElementById("pageMismatchAlertText").textContent = " Page mismatch detected. Image data has " + pageCountImage + " pages while OCR data has " + pageCountHOCR + " pages."
      document.getElementById("pageMismatchAlert").setAttribute("style", "");
    }
  }

  pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.hocrCurrent = Array(pageCount);
  globalThis.hocrCurrentRaw = globalThis.hocrCurrentRaw || Array(pageCount);

  // Global object that contains arrays with page images or related properties. 
  globalThis.imageAll = {
    // Unedited images uploaded by user (unused when user provides a PDF).
    nativeRaw: Array(pageCount),
    // Native images.  When the user uploads images directly, this contains whatever they uploaded.
    // When a user uploads a pdf, this will contain the images rendered by muPDF (either grayscale or color depending on setting).
    native: Array(pageCount),
    // Binarized image.
    binary: Array(pageCount),
    // Whether the native image was re-rendered with rotation applied. 
    nativeRotated: Array(pageCount),
    // Whether the binarized image was re-rendered with rotation applied. 
    binaryRotated: Array(pageCount),
    // [For pdf uploads only] Whether the "native" image was rendered in color or grayscale.
    nativeColor: Array(pageCount)
  }

  inputDataModes.xmlMode = new Array(pageCount);
  if (xmlModeImport) {
    inputDataModes.xmlMode.fill(true);
  } else {
    inputDataModes.xmlMode.fill(false);
  }

  if (inputDataModes.pdfMode && !xmlModeImport) {
      // Render first handful of pages for pdfs so the interface starts off responsive
      // In the case of OCR data, this step is triggered elsewhere after all the data loads
      renderPageQueue(0);
      renderPDFImageCache([...Array(Math.min(pageCount, 5)).keys()]);
  }

  let imageN = -1;
  let hocrN = -1;
  let firstImg = true;

  loadCountHOCR = 0;

  // Both OCR data and individual images (.png or .jpeg) contribute to the import loading bar
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  if (inputDataModes.imageMode || xmlModeImport) {
    const progressMax = inputDataModes.imageMode && xmlModeImport ? pageCount * 2 : pageCount;
    convertPageWorker["activeProgress"] = initializeProgress("import-progress-collapse", progressMax);
  }

  for (let i = 0; i < pageCount; i++) {

    // Note: As of Jan 22, exporting PDFs using BMP files is currently bugged in pdfKit (the colors channels can get switched)
    if (inputDataModes.imageMode) {

      const imageNi = imageN + 1;
      imageN = imageN + 1;

      const image = document.createElement('img');

      // Render to screen after first image is loaded
      if (firstImg) {
        image.onload = function () {
          renderPageQueue(0);
        }
        firstImg = false;
      }

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        image.src = reader.result;

        globalThis.imageAll["nativeRaw"][imageNi] = image;
        globalThis.imageAll["native"][imageNi] = globalThis.imageAll["nativeRaw"][imageNi];

        updateDataProgress();

      }, false);

      reader.readAsDataURL(imageFilesAll[i]);

    }

    if (xmlModeImport) {
      toggleEditButtons(false);
      // Process HOCR using web worker, reading from file first if that has not been done already
      if (singleHOCRMode) {
        //convertPageWorker.postMessage([globalThis.hocrCurrentRaw[i], i, abbyyMode]);
        convertPage([globalThis.hocrCurrentRaw[i], i, abbyyMode]).then(() => updateDataProgress());
      } else {
        const hocrFile = hocrFilesAll[i];
        // const hocrNi = hocrN + 1;
        // hocrN = hocrN + 1;
        //readOcrFile(hocrFile).then((x) => convertPageWorker.postMessage([x, hocrNi]));
        readOcrFile(hocrFile).then((x) => convertPage([x, i, undefined]).then(() => updateDataProgress()));
      }
    }

  }

  // Enable downloads now for pdf imports if no HOCR data exists
  if (inputDataModes.pdfMode && !xmlModeImport) {
    downloadElem.disabled = false;
    globalThis.state.importDone = true;
  }

  pageNumElem.value = "1";
  pageCountElem.textContent = pageCount;

}

async function initMuPDFScheduler(file, workers = 3) {
  globalThis.muPDFScheduler = await Tesseract.createScheduler();
  globalThis.muPDFScheduler["pngRenderCount"] = 0;
  globalThis.muPDFScheduler["workers"] = new Array(workers); 
  for (let i = 0; i < workers; i++) {
    const w = await initMuPDFWorker();
    if(file) {
      const fileData = await file.arrayBuffer();
      const pdfDoc = await w.openDocument(fileData, file.name);
      w["pdfDoc"] = pdfDoc;  
    }

    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    globalThis.muPDFScheduler.addWorker(w);
    globalThis.muPDFScheduler["workers"][i] = w;
  }
}

async function loadImage(url, elem) {
  return new Promise((resolve, reject) => {
    elem.onload = () => resolve(elem);
    elem.onerror = reject;
    elem.src = url;
  });
}

export async function displayImage(n, image, binary = false) {
  if (currentPage.n == n && !(colorModeElem.value == "binary" && !binary || colorModeElem.value != "binary" && binary)) {
    // currentPage.renderStatus = currentPage.renderStatus + 1;

    if (!inputDataModes.xmlMode[n]) {
      let widthRender = image.width;
      let heightRender = image.height;

      let widthDisplay = Math.min(widthRender, parseFloat(zoomInputElem.value));
      let heightDisplay = Math.min(heightRender, heightRender * (widthDisplay / widthRender));

      globalThis.canvas.clear();
      globalThis.canvas.__eventListeners = {};

      globalThis.canvas.setHeight(heightDisplay);
      globalThis.canvas.setWidth(widthDisplay);

      globalThis.canvas.setZoom(widthDisplay / widthRender);

    }

    currentPage.backgroundImage = new fabric.Image(image, { objectCaching: false });
    selectDisplayMode(displayModeElem.value);
  }
}


// Function that renders images and stores them in cache array (or returns early if the requested image already exists).
// This function contains 2 distinct image rendering steps:
// 1. Pages are rendered from .pdf to .png [either color or grayscale] using muPDF
// 1. Existing .png images are processed (currently rotation and/or thresholding) using Tesseract/Leptonica
async function renderPDFImageCache(pagesArr, rotate = null, progress = null) {

  const colorMode = colorModeElem.value;
  const colorName = colorMode == "binary" ? "binary" : "native";

  await Promise.allSettled(pagesArr.map((n) => {

    if (n < 0 || n >= globalThis.imageAll.native.length) return;

    // In imageMode, if the current image is rotated but a non-rotated image is requested, revert to the original (user-uploaded) image. 
    if(inputDataModes.imageMode && rotate == false && globalThis.imageAll["nativeRotated"][n] == true) {
      // globalThis.imageAll["nativeColor"][n] = "color";
      globalThis.imageAll["nativeRotated"][n] = false;
      globalThis.imageAll["native"][n] = globalThis.imageAll["nativeRaw"][n];
    }

    // In pdfMode, determine whether an original/unedited version of the image needs to be obtained.
    // This can happen for 3 reasons:
    // 1. Page has not yet been rendered
    // 2. Page was previously rendered, but in different colorMode (gray vs. color)
    // 3. Page was overwritten by rotated version, but a non-rotated version is needed
    const renderNativePDF = inputDataModes.pdfMode && (!globalThis.imageAll["native"][n] || 
      (colorMode != "binary" && globalThis.imageAll["nativeColor"][n] != colorMode) ||
      rotate == false && globalThis.imageAll["nativeRotated"][n] == true) ? true : false;

    // In pdfMode the page is re-rendered from the pdf
    if (renderNativePDF) {

      globalThis.imageAll["nativeColor"][n] = colorModeElem.value;
      globalThis.imageAll["nativeRotated"][n] = false;
      globalThis.imageAll["native"][n] = new Promise(async function (resolve, reject) {

        // Initialize scheduler if one does not already exist
        // This happens when the original scheduler is killed after all pages are rendered,
        // but then the user changes from color to grayscale (or vice versa).
        await initSchedulerIfNeeded("muPDFScheduler");

        const ms = await globalThis.muPDFScheduler;

        // Render to 300 dpi by default
        let dpi = 300;

        const imgWidthXml = globalThis.pageMetricsObj["dimsAll"][n][1];
        const imgWidthPdf = await ms.addJob('pageWidth', [n + 1, 300]);
        if (imgWidthPdf != imgWidthXml) {
          dpi = Math.round(300 * (imgWidthXml / imgWidthPdf));
        }

        const useColor = colorMode == "color" ? true : false;

        const res = await ms.addJob('drawPageAsPNG', [n + 1, dpi, useColor]);

        const image = document.createElement('img');
        await loadImage(res, image);

        resolve(image);

        // await displayImage(n, image);

      });
    }

    // Whether binarized image needs to be rendered
    const renderBinary = colorMode == "binary" && !globalThis.imageAll["binary"][n];

    // // Whether native image needs to be rendered
    // const renderNativeImage = colorMode == "gray" && globalThis.imageAll["nativeColor"][n] == "color";

    // Whether binarized image needs to be rotated (or re-rendered without rotation)
    const rotateBinary = colorMode == "binary" && (rotate == true && !globalThis.imageAll["binaryRotated"][n] && Math.abs(globalThis.pageMetricsObj["angleAll"][n]) > 0.05 || rotate == false && globalThis.imageAll["binaryRotated"][n] == true);

    // Whether native image needs to be rotated
    const rotateNative = colorName == "native" && (rotate == true && !globalThis.imageAll["nativeRotated"][n] && Math.abs(globalThis.pageMetricsObj["angleAll"][n]) > 0.05);

    // If nothing needs to be done, return early.
    if (!(renderBinary || rotateBinary || rotateNative )) {
      if (progress) progress.increment();
      return;
    };

    // If no preference is specified for rotation, default to true
    const angleArg = rotate != false ? globalThis.pageMetricsObj["angleAll"][n] * (Math.PI / 180) * -1 || 0 : 0;

    const saveBinaryImageArg = "true";
    // const saveGreyImageArg = colorModeElem.value == "gray" ? "true" : "false";
    // const saveColorImageArg = colorModeElem.value == "color" ? "true" : "false";  
    const saveColorImageArg = rotateNative ? "true" : "false";  

    const resPromise = (async () => {

      // Wait for non-rotated version before replacing with promise
      const inputImage = await Promise.resolve(globalThis.imageAll["native"][n]);

      const bs = await getBinaryScheduler();

      return bs.addJob("threshold", inputImage.src, { angle: angleArg }, { debug_file: "/debug.txt", max_page_gradient_recognize: "100", scribe_save_binary_rotated_image : saveBinaryImageArg, scribe_save_original_rotated_image: saveColorImageArg});

    })();

    if(saveColorImageArg == "true"){
      globalThis.imageAll["nativeRotated"][n] = Boolean(angleArg);
      globalThis.imageAll["native"][n] = resPromise.then(async (res) => {
        const image = document.createElement('img');
        await loadImage(res.data.imageOriginal, image);
        // displayImage(n, image, false);
        if (progress && saveBinaryImageArg != "true") progress.increment();
        return(image);
      });  
    }

    if(saveBinaryImageArg == "true") {
      globalThis.imageAll["binaryRotated"][n] = Boolean(angleArg);
      globalThis.imageAll["binary"][n] = resPromise.then(async (res) => {
        const image = document.createElement('img');
        await loadImage(res.data.imageBinary, image);
        if(progress) progress.increment();
        // displayImage(n, image, true);
        return(image);
      });
    }
  }));

}

currentPage.renderNum = 0;

// Global object containing information regarding the application's state
// (E.g. is a page currently rendering, is recognition currently running, etc.)
globalThis.state = {
  pageRendering : Promise.resolve(true),
  renderIt : 0,
  promiseResolve : undefined,
  recognizeAllPromise : Promise.resolve(true),
  importDone : false
}

//var backgroundOpts = {};
// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n, mode = "screen", loadXML = true, lineMode = false, dimsLimit = null) {

  // Return if data is not loaded yet
  const imageMissing = inputDataModes.imageMode && (globalThis.imageAll["native"].length == 0 || globalThis.imageAll["native"][n] == null) || inputDataModes.pdfMode && (typeof (globalThis.muPDFScheduler) == "undefined");
  const xmlMissing = globalThis.hocrCurrent.length == 0 || typeof (globalThis.hocrCurrent[n]) != "string";
  if (imageMissing && (inputDataModes.imageMode || inputDataModes.pdfMode) || xmlMissing && inputDataModes.xmlMode[n]) {
    console.log("Exiting renderPageQueue early");
    return;
  }

  const renderItI = globalThis.state.renderIt + 1;
  globalThis.state.renderIt = renderItI;

  // If a page is already being rendered, wait for it to complete
  await globalThis.state.pageRendering;
  // If another page has been requested already, return early
  if(globalThis.state.renderIt != renderItI) return;

  globalThis.state.pageRendering = new Promise(function(resolve, reject){
    globalThis.state.promiseResolve = resolve;
  });

  // Parse the relevant XML (relevant for both Canvas and PDF)
  if (loadXML && inputDataModes.xmlMode[n] && globalThis.hocrCurrent[n]) {
    // Compare selected text to ground truth in eval mode
    if (displayModeElem.value == "eval") {
      console.time();
      await compareGroundTruthClick(n);
      console.timeEnd();
    }
    currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[n], "text/xml");
  } else if (!inputDataModes.xmlMode[n]) {
    currentPage.xmlDoc = null;
  }

  // Determine image size and canvas size
  let imgDims = null;
  let canvasDims = null;

  imgDims = new Array(2);
  canvasDims = new Array(2);

  // Get image dimensions from OCR data if present; otherwise get dimensions of images directly
  if (inputDataModes.xmlMode[n] || inputDataModes.pdfMode) {
    imgDims[1] = globalThis.pageMetricsObj["dimsAll"][n][1];
    imgDims[0] = globalThis.pageMetricsObj["dimsAll"][n][0];
  } else {
    const backgroundImage = await globalThis.imageAll["native"][n];
    imgDims[1] = backgroundImage.width;
    imgDims[0] = backgroundImage.height;
  }

  // The canvas size and image size are generally the same.
  // The exception is when rendering a pdf with the "standardize page size" option on,
  // which will scale the canvas size but not the image size.
  if (mode == "pdf" && dimsLimit[0] > 0 && dimsLimit[1] > 0) {
    canvasDims[1] = dimsLimit[1];
    canvasDims[0] = dimsLimit[0];
  } else {
    canvasDims[1] = imgDims[1];
    canvasDims[0] = imgDims[0];
  }


  // Calculate options for background image and overlay
  if (inputDataModes.xmlMode[n]) {

    currentPage.backgroundOpts.originX = "center";
    currentPage.backgroundOpts.originY = "center";

    currentPage.backgroundOpts.left = imgDims[1] * 0.5;
    currentPage.backgroundOpts.top = imgDims[0] * 0.5;


    let marginPx = Math.round(canvasDims[1] * leftGlobal);
    if (autoRotateCheckboxElem.checked) {
      currentPage.backgroundOpts.angle = globalThis.pageMetricsObj["angleAll"][n] * -1 ?? 0;

    } else {
      currentPage.backgroundOpts.angle = 0;
    }

    // TODO: Create a more efficient implementation of "show margin" feature
    if (showMarginCheckboxElem.checked && mode == "screen") {
      canvas.viewportTransform[4] = 0;

      canvas.clear();

      if (imgDims != null) {
        let zoomFactor = Math.min(parseFloat(/** @type {HTMLInputElement} */(document.getElementById('zoomInput')).value) / imgDims[1], 1);
        canvas.setHeight(imgDims[0] * zoomFactor);
        canvas.setWidth(imgDims[1] * zoomFactor);
        canvas.setZoom(zoomFactor);
      }

      let marginLine = new fabric.Line([marginPx, 0, marginPx, canvasDims[0]], { stroke: 'blue', strokeWidth: 1, selectable: false, hoverCursor: 'default' });
      canvas.add(marginLine);

      let marginImage = canvas.toDataURL();
      canvas.clear();
      canvas.setOverlayImage(marginImage, canvas.renderAll.bind(canvas), {
        overlayImageLeft: 100,
        overlayImageTop: 100
      });

    }

    currentPage.leftAdjX = 0;
    if (autoMarginCheckboxElem.checked && leftGlobal != null) {

      // Adjust page to match global margin unless it would require large transformation (likely error)
      if (globalThis.pageMetricsObj["leftAll"][n] > 0 && Math.abs(marginPx - globalThis.pageMetricsObj["leftAll"][n]) < (globalThis.pageMetricsObj["dimsAll"][currentPage.n][1] / 3)) {
        currentPage.leftAdjX = marginPx - globalThis.pageMetricsObj["leftAll"][n];
      }

      if (autoRotateCheckboxElem.checked) {
        const sinAngle = Math.sin(globalThis.pageMetricsObj["angleAll"][n] * (Math.PI / 180));
        const shiftX = sinAngle * (imgDims[0] * 0.5) * -1 || 0;

        currentPage.leftAdjX = currentPage.leftAdjX - shiftX - (globalThis.pageMetricsObj["angleAdjAll"][n] || 0);
      }

      currentPage.backgroundOpts.left = imgDims[1] * 0.5 + currentPage.leftAdjX;
    } else {
      currentPage.backgroundOpts.left = imgDims[1] * 0.5;
    }

    if (mode == "screen") {
      canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
    }

  } else {
    currentPage.backgroundOpts.originX = "left";
    currentPage.backgroundOpts.originY = "top";

    currentPage.backgroundOpts.left = 0;
    currentPage.backgroundOpts.top = 0;

  }

  let renderNum;
  if (mode == "screen") {
    // Clear canvas if objects (anything but the background) exists
    if (canvas.getObjects().length) {
      canvas.clear()
      canvas.__eventListeners = {};
    }

    if (imgDims != null) {
      let zoomFactor = Math.min(parseFloat(/** @type {HTMLInputElement} */(document.getElementById('zoomInput')).value) / imgDims[1], 1);
      canvas.setHeight(imgDims[0] * zoomFactor);
      canvas.setWidth(imgDims[1] * zoomFactor);
      canvas.setZoom(zoomFactor);
    }

    currentPage.renderStatus = 0;

    // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
    // (whether by quickly changing pages or on the same page).
    // TODO: Find a better solution. 
    currentPage.renderNum = currentPage.renderNum + 1;
    renderNum = currentPage.renderNum;

    //const colorMode = colorModeElem.value;

    renderPDFImageCache([n]);
    const backgroundImage = colorModeElem.value == "binary" ? await Promise.resolve(globalThis.imageAll["binary"][n]) : await Promise.resolve(globalThis.imageAll["native"][n]);
    currentPage.backgroundImage = new fabric.Image(backgroundImage, { objectCaching: false });
    if (currentPage.n == n && currentPage.renderNum == renderNum) {
      currentPage.renderStatus = currentPage.renderStatus + 1;
      selectDisplayMode(displayModeElem.value);
    } else {
      globalThis.state.promiseResolve();
      return;
    }

  } else {
    globalThis.doc.addPage({ size: [canvasDims[1], canvasDims[0]], margin: 0 });

    if (displayModeElem.value != "ebook") {

      const backgroundImage = colorModeElem.value == "binary" ? await Promise.resolve(globalThis.imageAll["binary"][n]) : await Promise.resolve(globalThis.imageAll["native"][n]);
      globalThis.doc.image(backgroundImage.src, (currentPage.leftAdjX || 0), 0, { align: 'left', valign: 'top' });

    }
  }

  if (mode == "screen" && currentPage.n == n && inputDataModes.xmlMode[n]) {
    await renderPage(canvas, null, currentPage.xmlDoc, "screen", globalSettings.defaultFont, lineMode, imgDims, canvasDims, globalThis.pageMetricsObj["angleAll"][n], inputDataModes.pdfMode, globalThis.fontObj, currentPage.leftAdjX);
    if (currentPage.n == n && currentPage.renderNum == renderNum) {
      currentPage.renderStatus = currentPage.renderStatus + 1;
      await selectDisplayMode(displayModeElem.value);
    } 
  } else if (inputDataModes.xmlMode[n]) {
    await renderPage(canvas, globalThis.doc, currentPage.xmlDoc, "pdf", globalSettings.defaultFont, lineMode, imgDims, canvasDims, globalThis.pageMetricsObj["angleAll"][n], inputDataModes.pdfMode, globalThis.fontObj, currentPage.leftAdjX);
  }

  globalThis.state.promiseResolve();
  return;

}

var cacheMode = true;
var cachePages = 3;

var working = false;
async function onPrevPage(marginAdj) {
  if (currentPage.n + 1 <= 1 || working) {
    return;
  }
  working = true;
  if (inputDataModes.xmlMode[currentPage.n]) {
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
  }

  currentPage.n = currentPage.n - 1;
  pageNumElem.value = (currentPage.n + 1).toString();

  rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
  canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;

  await renderPageQueue(currentPage.n);

  showDebugImages();

  // Render 1 page back
  if ((inputDataModes.pdfMode || inputDataModes.imageMode)&& cacheMode) {
    const nMax = parseInt(pageCountElem.textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + currentPage.n - 1).filter(x => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
  }


  working = false;
}




async function onNextPage() {
  if (currentPage.n + 1 >= globalThis.hocrCurrent.length || working) {
    return;
  }
  working = true;
  if (inputDataModes.xmlMode[currentPage.n]) {
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
  }

  currentPage.n = currentPage.n + 1;
  pageNumElem.value = (currentPage.n + 1).toString();

  rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
  canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;

  await renderPageQueue(currentPage.n);

  showDebugImages();

  // Render 1 page ahead
  if ((inputDataModes.pdfMode || inputDataModes.imageMode)&& cacheMode) {
    const nMax = parseInt(pageCountElem.textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i + currentPage.n + 1).filter(x => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
  }

  working = false;
}


async function optimizeFontClick(value) {
  if (inputDataModes.xmlMode[currentPage.n]) {
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
  }

  // When we have metrics for individual fonts families, those are used to optimize the appropriate fonts.
  // Otherwise, the "default" metric is applied to whatever font the user has selected as the default font. 
  const metricsFontFamilies = Object.keys(globalThis.fontMetricsObj);
  // const multiFontMode = metricsFontFamilies.includes("Libre Baskerville") || metricsFontFamilies.includes("Open Sans");
  const optFontFamilies = globalSettings.multiFontMode ? metricsFontFamilies.filter((x) => !["Default","message"].includes(x)) : [globalSettings.defaultFont];

  for (let family of optFontFamilies) {
    if (value) {
      await optimizeFont2(family);
    } else {
      await loadFontFamily(family);
    }
  }

  renderPageQueue(currentPage.n);
}

async function getBinaryScheduler() {
  // Initialize scheduler if one does not already exist
  if(!globalThis.binaryScheduler) {
    const n = Math.min(Math.ceil(globalThis.imageAll["native"].length / 4), 4);
    console.log("Creating new Tesseract scheduler with " + n + " workers.")
    globalThis.binaryScheduler = createTesseractScheduler(n);
  }
  return(globalThis.binaryScheduler)
}

window["binarySchedulerInit"] = async function () {
  // Workers take a non-trivial amount of time to started so a tradeoff exists with how many to use.
  // Using 1 scheduler per 4 pages as a quick fix--have not benchmarked optimal number.
  const n = Math.min(Math.ceil(globalThis.imageAll["native"].length / 4), 4);
  return await createTesseractScheduler(n);
}

window["muPDFSchedulerInit"] = async function () {
  await initMuPDFScheduler(globalThis.pdfFile, 3);
  if (globalThis.imageAll["native"]) {
    // TODO: Fix to work with promises
    window["muPDFScheduler"]["pngRenderCount"] = 0;
    //window["muPDFScheduler"]["pngRenderCount"] = [...Array(imageAll["native"].length).keys()].filter((x) => typeof (imageAll["native"][x]) == "object" && (colorModeElem.value == "binary" || imageAll["native"]["nativeColor"][x] == colorModeElem.value)).length;
  } else {
    window["muPDFScheduler"]["pngRenderCount"] = 0;
  }

  return;
}

// Function that is invoked before a scheduler is used.
// If the scheduler already exists, resolves immediately.
// If scheduler is being created already, return promise that resolves when that is done.
// If scheduler does not exist and is not being created, initialize and return promise that resolves when done.
async function initSchedulerIfNeeded(x) {

  if(!window[x]){
    window[x] = window[x + "Init"]();
  }
  return(window[x]);
}

// Modified version of code found in FileSaver.js
globalThis.saveAs = function(blob, name, opts) {
  var a = document.createElement('a');
  name = name || blob.name || 'download';
  a.download = name;
  //a.rel = 'noopener'; // tabnabbing
  // TODO: detect chrome extensions & packaged apps
  // a.target = '_blank'
  if (typeof blob === 'string') {
    a.href = blob;
  } else {
    a.href = globalThis.URL.createObjectURL(blob);
  }
  a.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  }));
}


// TODO: Rework storage of optimized vs. non-optimized fonts to be more organized
// var fontDataOptimized, fontDataOptimizedItalic, fontDataOptimizedSmallCaps;

var fontDataOptimized = {};

export async function optimizeFont2(fontFamily) {

  const fontMetricI = globalSettings.multiFontMode ? globalThis.fontMetricsObj[fontFamily] : globalThis.fontMetricsObj["Default"];
  
  if(!fontMetricI) return;

  const fontNormal = await globalThis.fontObj[fontFamily]["normal"];
  const fontItalic = await globalThis.fontObj[fontFamily]["italic"];

  fontNormal.tables.gsub = null;
  fontItalic.tables.gsub = null;

  if(!fontDataOptimized[fontFamily]) fontDataOptimized[fontFamily] = {};

  const promiseArr = [];

  // Quick fix due to bug in pdfkit (see note in renderPDF function)
  // fontNormal.tables.name.postScriptName["en"] = fontNormal.tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

  // Optimize normal font if metrics exist to do so
  if (fontMetricI["normal"]) {

    // Italic fonts can be optimized in 2 ways.  If metrics exist for italics, then they are optimized using those (similar to normal fonts).
    // If no metrics exist for italics, then a subset of optimizations are applied using metrics from the normal variant. 
    const fontAuxArg = fontMetricI["italic"] ? null : fontItalic;
    const fontArr = await optimizeFont(fontNormal, fontAuxArg, fontMetricI["normal"]);

    fontDataOptimized[fontFamily]["normal"] = fontArr[0].toArrayBuffer();
    const kerningPairs = JSON.parse(JSON.stringify(fontArr[0].kerningPairs));
    globalThis.fontObj[fontFamily]["normal"] = loadFont(fontFamily, fontDataOptimized[fontFamily]["normal"], true).then((x) => {
      // Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
      x.kerningPairs = kerningPairs;
      return(x);
    });
    promiseArr.push(loadFontBrowser(fontFamily, "normal", fontDataOptimized[fontFamily]["normal"], true));

    if (!fontMetricI["italic"]) {
      const kerningPairs = JSON.parse(JSON.stringify(fontArr[0].kerningPairs));
      fontDataOptimized[fontFamily]["italic"] = fontArr[1].toArrayBuffer();
      globalThis.fontObj[fontFamily]["italic"] = loadFont(fontFamily + "-italic", fontDataOptimized[fontFamily]["italic"], true).then((x) => {
        // Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
        x.kerningPairs = kerningPairs;
        return(x);
      });
      promiseArr.push(loadFontBrowser(fontFamily, "italic", fontDataOptimized[fontFamily]["italic"], true));
    }
  }

  // Create small caps font using optimized "normal" font as a starting point
  //createSmallCapsFont(globalThis.fontObj["Libre Baskerville"]["normal"], "Libre Baskerville", fontMetricsObj["heightSmallCaps"] || 1, fontMetricsObj);

  // Optimize small caps if metrics exist to do so
  if (fontMetricI["small-caps"]) {
    const fontArr = await optimizeFont(globalThis.fontObj[fontFamily]["small-caps"], null, fontMetricI["small-caps"]);
    fontDataOptimized[fontFamily]["small-caps"] = fontArr[0].toArrayBuffer();
    const kerningPairs = JSON.parse(JSON.stringify(fontArr[0].kerningPairs));
    globalThis.fontObj[fontFamily]["small-caps"] = loadFont(fontFamily + "-small-caps", fontDataOptimized[fontFamily]["small-caps"], true).then((x) => {
      // Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
      x.kerningPairs = kerningPairs;
      return(x);
    });
    promiseArr.push(loadFontBrowser(fontFamily, "small-caps", fontDataOptimized[fontFamily]["small-caps"], true));

  }

  // Optimize italics if metrics exist to do so
  if (fontMetricI["italic"]) {
    const fontArr = await optimizeFont(fontItalic, null, fontMetricI["italic"], "italic");
    const kerningPairs = JSON.parse(JSON.stringify(fontArr[0].kerningPairs));
    fontDataOptimized[fontFamily]["italic"] = fontArr[0].toArrayBuffer();
    globalThis.fontObj[fontFamily]["italic"] = loadFont(fontFamily + "-italic", fontDataOptimized[fontFamily]["italic"], true).then((x) => {
      // Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
      x.kerningPairs = kerningPairs;
      return(x);
    });
    promiseArr.push(loadFontBrowser(fontFamily, "italic", fontDataOptimized[fontFamily]["italic"], true));
  }

  await Promise.allSettled(promiseArr);

}


var convertPageWorker = new Worker('js/convertPage.js');
convertPageWorker.promises = {};
convertPageWorker.promiseId = 0;


// Input array contents:
// [0] HOCR data
// [1] Page number
// [2] Abbyy mode
// [3] Object with arbitrary values to pass through to result
function convertPage(args) {

  if (args.length == 3) {
    args.push({});
  }

  return new Promise(function (resolve, reject) {
    let id = convertPageWorker.promiseId++;
    convertPageWorker.promises[id] = { resolve: resolve };

    args.push(id);

    convertPageWorker.postMessage(args);

  });

}

// Function for updating the import/recognition progress bar, and running functions after all data is loaded. 
// Should be called after every .hocr page is loaded (whether using the internal engine or uploading data),
// as well as after every image is loaded (not including .pdfs). 
async function updateDataProgress(mainData = true, combMode = false) {

  let activeProgress = convertPageWorker["activeProgress"].elem;

  loadCountHOCR = loadCountHOCR + 1;
  activeProgress.setAttribute("aria-valuenow", loadCountHOCR);

  const valueMax = parseInt(activeProgress.getAttribute("aria-valuemax"));

  // Update progress bar between every 1 and 5 iterations (depending on how many pages are being processed).
  // This can make the interface less jittery compared to updating after every loop.
  // The jitter issue will likely be solved if more work can be offloaded from the main thread and onto workers.
  const updateInterval = Math.min(Math.ceil(valueMax / 10), 5);
  if (loadCountHOCR % updateInterval == 0 || loadCountHOCR == valueMax) {
    activeProgress.setAttribute("style", "width: " + (loadCountHOCR / valueMax) * 100 + "%");
  }

  // The following block is either run after all recognition is done (when only 1 engine is being used), 
  // or after the Legacy engine is done (when Legacy + LSTM are both being run).
  // It is assumed that all Legacy recognition will finish before any LSTM recognition begins, which may change in the future. 
  if ((!combMode && loadCountHOCR == valueMax) || (combMode && loadCountHOCR == globalThis.imageAll.native.length)) {

    // Full-document stats (including font optimization) are only calulated for the "main" data, 
    // meaning that when alternative data is uploaded for comparison through the "evaluate" tab,
    // those uploads to not cause new fonts to be created. 
      // those uploads to not cause new fonts to be created. 
    // those uploads to not cause new fonts to be created. 
    if(inputDataModes.xmlMode[0] && mainData) {
      // If resuming from a previous editing session font stats are already calculated
      if (inputDataModes.resumeMode) {
        optimizeFontElem.disabled = false;
      } else {
        // Buttons are enabled from calculateOverallFontMetrics function in this case
        globalThis.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
      }

      calculateOverallPageMetrics();

      // Enable font optimization (if possible) by default
      if(optimizeFontElem.disabled == false){
        let defaultFontObs = 0;
        let namedFontObs = 0;
        if (globalThis.fontMetricsObj["Default"]?.obs) {defaultFontObs = defaultFontObs + globalThis.fontMetricsObj["Default"]?.obs};
        if (globalThis.fontMetricsObj["Libre Baskerville"]?.obs) {namedFontObs = namedFontObs + globalThis.fontMetricsObj["Libre Baskerville"]?.obs};
        if (globalThis.fontMetricsObj["Open Sans"]?.obs) {namedFontObs = namedFontObs + globalThis.fontMetricsObj["Open Sans"]?.obs};
  
        globalSettings.multiFontMode = namedFontObs > defaultFontObs ? true : false;

        // Change default font to whatever named font appears more
        if (globalSettings.multiFontMode) {
          if ((globalThis.fontMetricsObj["Libre Baskerville"]?.obs || 0) > (globalThis.fontMetricsObj["Open Sans"]?.obs || 0)) {
            globalSettings.defaultFont = "Libre Baskerville";
          } else {
            globalSettings.defaultFont = "Open Sans";
          }
        }
  
        optimizeFontElem.checked = true;
        await optimizeFontClick(optimizeFontElem.checked);
      }
    }
    if (!globalThis.state.importDone) {
      globalThis.state.importDone = true;
      downloadElem.disabled = false;
    }
    
    // Render first handful of pages for pdfs so the interface starts off responsive
    if (inputDataModes.pdfMode) {
      renderPDFImageCache([...Array(Math.min(valueMax, 5)).keys()]);
    }
  }
  
}

convertPageWorker.onmessage = function (e) {

  const n = e.data[1];
  const argsObj = e.data[2];

  // Detect if the new data needs to be combined with existing data.
  // This occurs when using "recognize area" mode on a page with existing OCR data. 
  if(argsObj["mode"] == "area") {
    const lines = currentPage.xmlDoc?.getElementsByClassName("ocr_line");
    if(lines && lines.length > 0) {
      combineData(e.data[0][0]);
      renderPageQueue(currentPage.n, 'screen', false)
      return;
    }
  }

  const oemCurrent = !argsObj["engine"] || argsObj["mode"] != "full" || argsObj["engine"] == document.getElementById("displayLabelText").innerHTML ? true : false;

  // If an OEM engine is specified, save to the appropriate object within ocrAll,
  // and only set to hocrCurrent if appropriate.  This prevents "Recognize All" from
  // overwriting the wrong output if a user switches hocrCurrent to another OCR engine
  // while the recognition job is running.
  if (argsObj["engine"] && argsObj["mode"] == "full") {
    globalThis.ocrAll[argsObj["engine"]][n]["hocr"] = e.data[0][0] || "<div class='ocr_page'></div>";
    if (oemCurrent) {
      globalThis.hocrCurrent[n] = e.data[0][0] || "<div class='ocr_page'></div>";
    }
  } else {
    globalThis.hocrCurrent[n] = e.data[0][0] || "<div class='ocr_page'></div>";
  }

  // When using the "Recognize Area" feature the XML dimensions will be smaller than the page dimensions
  if (argsObj["mode"] == "area") {
    globalThis.pageMetricsObj["dimsAll"][n] = [currentPage.backgroundImage.height, currentPage.backgroundImage.width];
    globalThis.hocrCurrent[n] = globalThis.hocrCurrent[n].replace(/bbox( \d+)+/, "bbox 0 0 " + currentPage.backgroundImage.width + " " + currentPage.backgroundImage.height);
  } else {
    globalThis.pageMetricsObj["dimsAll"][n] = e.data[0][1];
  }

  inputDataModes.xmlMode[n] = true;

  globalThis.pageMetricsObj["angleAll"][n] = e.data[0][2];
  globalThis.pageMetricsObj["leftAll"][n] = e.data[0][3];
  globalThis.pageMetricsObj["angleAdjAll"][n] = e.data[0][4];

  if(argsObj["saveMetrics"] ?? true){
    fontMetricObjsMessage[n] = e.data[0][5];
  }

  // If this is the page the user has open, render it to the canvas
  if (n == currentPage.n && oemCurrent) {
    renderPageQueue(currentPage.n);
  }

  convertPageWorker.promises[e.data[e.data.length - 1]].resolve();

}

function calculateOverallPageMetrics() {
  // It is possible for image resolution to vary page-to-page, so the left margin must be calculated
  // as a percent to remain visually identical between pages.
  let leftAllPer = new Array(globalThis.pageMetricsObj["leftAll"].length);
  for (let i = 0; i < globalThis.pageMetricsObj["leftAll"].length; i++) {
    leftAllPer[i] = globalThis.pageMetricsObj["leftAll"][i] / globalThis.pageMetricsObj["dimsAll"][i][1];
  }
  leftGlobal = quantile(leftAllPer, 0.5);
  globalThis.pageMetricsObj["manAdjAll"] = new Array(globalThis.pageMetricsObj["leftAll"].length);
  globalThis.pageMetricsObj["manAdjAll"].fill(0);

}

// Function to change the display mode
// Impacts text color and opacity, and backgound image opacity
globalThis.selectDisplayMode = function (x) {

  if (inputDataModes.xmlMode[currentPage.n] && inputDataModes.pdfMode && currentPage.renderStatus != 2) { return; }

  let opacity_arg, fill_arg;
  if (x == "invis") {
    opacity_arg = 0
    fill_arg = "fill_ebook"
  } else if (x == "ebook") {
    opacity_arg = 1
    fill_arg = "fill_ebook"
  } else if (x == "eval") {
    opacity_arg = 1
    fill_arg = "fill_eval"
  } else {
    opacity_arg = 1
    fill_arg = "fill_proof"
  }

  canvas.forEachObject(function (obj) {
    if (obj.type == "i-text") {
      obj.set("fill", obj.get(fill_arg));

      obj.set("opacity", opacity_arg);
    }
  });

  // Edit rotation for images that have already been rotated
  if (colorModeElem.value == "binary" && globalThis.imageAll["binaryRotated"][currentPage.n] || colorModeElem.value != "binary" && globalThis.imageAll["nativeRotated"][currentPage.n]) {
    // If rotation is requested, 
    if (autoRotateCheckboxElem.checked) {
      currentPage.backgroundOpts.angle = 0;
    } else {
      currentPage.backgroundOpts.angle = globalThis.pageMetricsObj["angleAll"][currentPage.n];
    }
  }

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    canvas.setBackgroundColor("white");
    //canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas));
    canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas), currentPage.backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  }

  working = false;

}

async function handleDownload() {

  downloadElem.removeEventListener('click', handleDownload);
  downloadElem.disabled = true;

  updatePdfPagesLabel();

  // Save any edits that may exist on current page
  if (inputDataModes.xmlMode[currentPage.n]) {
    if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
      globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
    }
  }
  let download_type = document.getElementById('formatLabelText').textContent.toLowerCase();

  // If recognition is currently running, wait for it to finish.
  await globalThis.state.recognizeAllPromise;

  if (download_type == "pdf") {
    const minValue = parseInt(pdfPageMinElem.value)-1;
    const maxValue = parseInt(pdfPageMaxElem.value)-1;
    const pagesArr = [...Array(maxValue - minValue + 1).keys()].map(i => i + minValue);

    let standardizeSizeMode = document.getElementById("standardizeCheckbox").checked;
    let dimsLimit = [-1,-1];
    if (standardizeSizeMode) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit[0] = Math.max(dimsLimit[0], globalThis.pageMetricsObj["dimsAll"][i][0]);
        dimsLimit[1] = Math.max(dimsLimit[1], globalThis.pageMetricsObj["dimsAll"][i][1]);
      }
    }

    // The progress bar is incremented by 1 when each page of the text overlay is completed (within hocrToPDF).
    // When images are inserted into the pdf the progress is also incremented after each image is rendered. 
    const maxValueProgress = addOverlayCheckboxElem.checked ? maxValue + 1 : (maxValue+1) * 2;

    const downloadProgress = initializeProgress("generate-download-progress-collapse", maxValueProgress);
    await sleep(0);
  
    const fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".pdf";
    let pdfBlob;

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (displayModeElem.value != "ebook") {

      const insertInputPDF = globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked;
      const rotateText = !insertInputPDF && autoRotateCheckboxElem.checked;

      // Currently makes a pdf with all pages, regardless of what the user requests 
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.
      const invisibleText = displayModeElem.value == "invis";

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images. 
      const pdfStr = await hocrToPDF(0,-1,displayModeElem.value, rotateText, [-1,-1], downloadProgress);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      await initSchedulerIfNeeded("muPDFScheduler");

      // const pdfOverlayBlob = new Blob([pdfStr], { type: 'application/octet-stream' });
      const w = globalThis.muPDFScheduler["workers"][0];
      // const fileData = await pdfOverlayBlob.arrayBuffer();
      // The file name is only used to detect the ".pdf" extension
      const pdfOverlay = await w.openDocument(pdfEnc.buffer, "document.pdf");

      let content;

      // If the input document is a .pdf and "Add Text to Import PDF" option is enabled, we insert the text into that pdf (rather than making a new one from scratch)
      if (globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked) {
        content = await w.overlayText([pdfOverlay, minValue, maxValue, dimsLimit[1], dimsLimit[0]]);

      // If the input is a series of images, those images need to be inserted into a new pdf
      } else {
        await renderPDFImageCache(pagesArr, autoRotateCheckboxElem.checked, downloadProgress);
        const imgArr1 = colorModeElem.value == "binary" ? await Promise.all(imageAll.binary): await Promise.all(imageAll.native);
        const imgArr = imgArr1.map((x) => x.src);

        content = await w.overlayTextImage([pdfOverlay, imgArr, minValue, maxValue, dimsLimit[1], dimsLimit[0]]);
      } 

  		pdfBlob = new Blob([content], { type: 'application/octet-stream' });
	    
    } else {
      const pdfStr = await hocrToPDF(minValue, maxValue, displayModeElem.value, autoRotateCheckboxElem.checked, dimsLimit, downloadProgress);
      pdfBlob = new Blob([pdfStr], { type: 'application/octet-stream' });
    }
    saveAs(pdfBlob, fileName);
  } else if (download_type == "hocr") {
    renderHOCR(globalThis.hocrCurrent, globalThis.fontMetricsObj)
  } else if (download_type == "text") {
    renderText(globalThis.hocrCurrent)
  }

  downloadElem.disabled = false;
  downloadElem.addEventListener('click', handleDownload);
}
