/* eslint-disable import/no-cycle */

// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

import { importOCR } from './js/importOCR.js';

import { renderText } from './js/exportRenderText.js';
import { renderHOCRBrowser } from './js/exportRenderHOCRBrowser.js';
import { writeDocx } from './js/exportWriteDocx.js';
import { writeXlsx } from './js/exportWriteTabular.js';

import { renderPage } from './js/browser/renderPageCanvas.js';
import coords from './js/coordinates.js';

import { recognizePage } from './js/recognizeConvert.js';
import { recognizeAllPagesBrowser, convertOCRAllBrowser } from './js/recognizeConvertBrowser.js';

import { runFontOptimization } from './js/fontEval.js';
import { fontAll, enableDisableFontOpt } from './js/fontContainer.js';
import { optimizeFontContainerAll } from './js/objects/fontObjects.js';

import { calcLineFontSize } from './js/fontUtils.js';

import { PageMetrics } from './js/objects/pageMetricsObjects.js';

import {
  checkCharWarn, setDefaultFontAuto,
} from './js/fontStatistics.js';

import { ITextWord } from './js/objects/fabricObjects.js';

import { drawDebugImages } from './js/debug.js';

import {
  getRandomAlphanum, quantile, sleep, occurrences, saveAs, loadImage, readTextFile,
} from './js/miscUtils.js';
import { getAllFileEntries } from './js/drag-and-drop.js';

// Functions for various UI tabs
import { selectDisplayMode } from './js/browser/interfaceView.js';

import {
  deleteSelectedWords, changeWordFontSize, changeWordFontFamily,
  adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, toggleEditButtons,
} from './js/browser/interfaceEdit.js';

import {
  addLayoutBoxClick, deleteLayoutBoxClick, setDefaultLayoutClick, revertLayoutClick, setLayoutBoxTypeClick, setLayoutBoxInclusionRuleClick, setLayoutBoxInclusionLevelClick,
  updateDataPreview, setLayoutBoxTable, clearLayoutBoxes, renderLayoutBoxes, enableObjectCaching, toggleSelectableWords,
} from './js/browser/interfaceLayout.js';

import { canvas, resetCanvasEventListeners } from './js/browser/interfaceCanvas.js';

import { initMuPDFWorker } from './mupdf/mupdf-async.js';

import { reorderHOCR, combineData } from './js/modifyOCR.js';

import { hocrToPDF } from './js/exportPDF.js';

// Third party libraries
import { simd } from './lib/wasm-feature-detect.js';
import Tesseract from './tess/tesseract.esm.min.js';

// Debugging functions
// import { initConvertPageWorker } from './js/convertPage.js';
import { initGeneralWorker, GeneralScheduler } from './js/generalWorkerMain.js';

// Load default settings
import { setDefaults } from './js/browser/setDefaults.js';

import ocr from './js/objects/ocrObjects.js';

import {
  printSelectedWords, downloadCanvas, evalSelectedLine, getExcludedText,
} from './js/browser/interfaceDebug.js';

import { df } from './js/browser/debugGlobals.js';

globalThis.df = df;

globalThis.d = () => {
  debugger;
};

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user.
 */
globalThis.ctxDebug = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('g')).getContext('2d'));

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user.
 */
globalThis.ctxComp0 = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('h')).getContext('2d'));

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

const debugDownloadCanvasElem = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadCanvas'));
const debugPrintWordsCanvasElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsCanvas'));
const debugPrintWordsOCRElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsOCR'));

const debugEvalLineElem = /** @type {HTMLInputElement} */(document.getElementById('debugEvalLine'));

debugPrintWordsOCRElem.addEventListener('click', () => printSelectedWords(true));
debugPrintWordsCanvasElem.addEventListener('click', () => printSelectedWords(false));

debugDownloadCanvasElem.addEventListener('click', downloadCanvas);
debugEvalLineElem.addEventListener('click', evalSelectedLine);

// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
const tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

globalThis.canvas = canvas;

// Quick fix to get VSCode type errors to stop
// Long-term should see if there is a way to get types to work with fabric.js
const { fabric } = globalThis;

// Global variables containing fonts represented as OpenType.js objects and array buffers (respectively)
let leftGlobal;

// Edit canvas.js object defaults
// Disable movement for all fabric objects
fabric.Object.prototype.hasControls = false;
fabric.Object.prototype.lockMovementX = true;
fabric.Object.prototype.lockMovementY = true;

/**
 * @typedef inputDataModes
 * @type {object}
 * @property {Boolean[]} xmlMode - an ID.
 * @property {Boolean} pdfMode - an ID.
 * @property {Boolean} imageMode - an ID.
 * @property {Boolean} resumeMode - an ID.
 * @property {Boolean} extractTextMode - an ID.
 */
/** @type {inputDataModes} */
globalThis.inputDataModes = {
  // true if OCR data exists (whether from upload or built-in engine)
  xmlMode: [],
  // true if user uploaded pdf
  pdfMode: false,
  // true if user uploaded image files (.png, .jpeg)
  imageMode: false,
  // true if user re-uploaded HOCR data created by Scribe OCR
  resumeMode: false,
  // true if stext is extracted from a PDF (rather than text layer uploaded seprately)
  extractTextMode: false,
};

// Object that keeps track of various global settings
globalThis.globalSettings = {
  defaultFont: 'SerifDefault',
};

/**
 * @typedef cp
 * @type {Object}
 * @property {Number} n - an ID.
 * @property {any} backgroundImage - an ID.
 * @property {Object} backgroundOpts - an ID.
 * @property {Number} renderStatus - an ID.
 * @property {number} renderNum - an ID.
 */
/** @type {cp} */
export const cp = {
  n: 0,
  backgroundImage: null,
  backgroundOpts: { stroke: '#3d3d3d', strokeWidth: 3 },
  renderStatus: 0,
  renderNum: 0,
};

const zone = /** @type {HTMLInputElement} */ (document.getElementById('uploadDropZone'));

const openFileInputElem = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
openFileInputElem.addEventListener('change', (event) => {
  if (event.target.files.length === 0) return;

  importFiles(event.target.files);
  // This should run after importFiles so if that function fails the dropzone is not removed
  zone.setAttribute('style', 'display:none');
});

let highlightActiveCt = 0;
zone.addEventListener('dragover', (event) => {
  event.preventDefault();
  console.log('Adding class');
  zone.classList.add('highlight');
  highlightActiveCt++;
});

zone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  // Only remove the highlight after 0.1 seconds, and only if it has not since been re-activated.
  // This avoids flickering.
  const highlightActiveCtNow = highlightActiveCt;
  setTimeout(() => {
    if (highlightActiveCtNow === highlightActiveCt) {
      zone.classList.remove('highlight');
    }
  }, 100);
});

// This is where the drop is handled.
zone.addEventListener('drop', async (event) => {
  // Prevent navigation.
  event.preventDefault();
  const items = await getAllFileEntries(event.dataTransfer.items);

  const filesPromises = await Promise.allSettled(items.map((x) => new Promise((resolve, reject) => x.file(resolve, reject))));
  const files = filesPromises.map((x) => x.value);

  if (files.length === 0) return;

  event.target.classList.remove('highlight');

  importFiles(files);

  // This should run after importFiles so if that function fails the dropzone is not removed
  zone.setAttribute('style', 'display:none');
});

/**
 * Fetches an array of URLs and runs `importFiles` on the results.
 * Intended only to be used by automated testing and not by users.
 *
 * @param {Array<string>} urls
 */
globalThis.fetchAndImportFiles = async (urls) => {
  // Ensure that the input is an array of strings
  if (!Array.isArray(urls) || !urls.every((url) => typeof url === 'string')) {
    throw new Error('Input must be an array of strings');
  }

  // Fetch all URLs and convert the responses to Blobs
  const blobPromises = urls.map((url) => fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.blob().then((blob) => ({ blob, url }));
  }));

  // Wait for all fetches to complete
  const blobsAndUrls = await Promise.all(blobPromises);

  // Extract file name from URL and convert Blobs to File objects
  const files = blobsAndUrls.map(({ blob, url }) => {
    const fileName = url.split('/').pop();
    return new File([blob], fileName, { type: blob.type });
  });

  // Call the existing importFiles function with the file array
  importFiles(files);

  zone.setAttribute('style', 'display:none');
};

/**
 *
 * @param {string} innerHTML - HTML content of warning/error message.
 * @param {boolean} error - Whether this is an error message (red) or warning message (yellow)
 * @param {string} parentElemId - ID of element to insert new message element within
 */
export function insertAlertMessage(innerHTML, error = true, parentElemId = 'alertDiv', visible = true) {
  const warningSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi flex-shrink-0 me-2" viewBox=" 0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
</svg>`;

  const errorSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi flex-shrink-0 me-2" viewBox=" 0 0 16 16">
  <path
    d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
  <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
</svg>`;

  const chosenSVG = error ? errorSVG : warningSVG;

  const htmlDiv = document.createElement('div');
  const id = `alertDiv${getRandomAlphanum(5)}`;
  htmlDiv.setAttribute('id', id);

  if (!visible) {
    htmlDiv.setAttribute('style', 'display:none');
  }

  htmlDiv.innerHTML = `<div class="alert alert-dismissible ${error ? 'alert-danger' : 'alert-warning'} d-flex align-items-center show fade mb-1">
  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  ${chosenSVG}
  <div class="mb-0"> ${innerHTML} </div>
</div>`;

  document.getElementById(parentElemId)?.appendChild(htmlDiv);

  return htmlDiv;
}

// Content that should be run once, after all dependencies are done loading are done loading
globalThis.runOnLoad = function () {
  const debugEngineVersionElem = /** @type {HTMLInputElement} */(document.getElementById('debugEngineVersion'));

  // Detect whether SIMD instructions are supported
  simd().then(async (x) => {
    globalSettings.simdSupport = x;
    // Show error message if SIMD support is not present
    if (x) {
      debugEngineVersionElem.innerText = 'Enabled';
    } else {
      const warningHTML = 'Fast (SIMD-enabled) version of Tesseract not supported on your device. Tesseract LSTM recognition may be slow. <a href="http://docs.scribeocr.com/faq.html#what-devices-support-the-built-in-ocr-engine" target="_blank" class="alert-link">Learn more.</a>';
      insertAlertMessage(warningHTML, false);
      debugEngineVersionElem.innerText = 'Disabled';
    }
  });
};

const pageNumElem = /** @type {HTMLInputElement} */(document.getElementById('pageNum'));

globalThis.bsCollapse = new bootstrap.Collapse(document.getElementById('collapseRange'), { toggle: false });

// Add various event listners to HTML elements
const nextElem = /** @type {HTMLInputElement} */(document.getElementById('next'));
const prevElem = /** @type {HTMLInputElement} */(document.getElementById('prev'));

nextElem.addEventListener('click', () => displayPage(cp.n + 1));
prevElem.addEventListener('click', () => displayPage(cp.n - 1));

// const rangeLeftMarginElem = /** @type {HTMLInputElement} */(document.getElementById('rangeLeftMargin'));

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
colorModeElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });

const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
showDebugVisElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });

const showDebugLegendElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugLegend'));
showDebugLegendElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });

showDebugLegendElem.addEventListener('input', () => {
  const legendCanvasParentDivElem = /** @type {HTMLDivElement} */(document.getElementById('legendCanvasParentDiv'));
  if (!showDebugLegendElem.checked) {
    showHideElem(legendCanvasParentDivElem, false);
  } else {
    showHideElem(legendCanvasParentDivElem, true);
  }
  setCanvasWidthHeightZoom(globalThis.state.imgDims, false);
});

const selectDebugVisElem = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));
selectDebugVisElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });

const createGroundTruthElem = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));
createGroundTruthElem.addEventListener('click', createGroundTruthClick);

const ocrQualityElem = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));

const enableRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableRecognition'));

const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));

const enableEvalElem = /** @type {HTMLInputElement} */(document.getElementById('enableEval'));

/**
 * Adds or removes CSS attribute `display:none` for HTML element.
 * @param {HTMLElement} elem
 * @param {boolean} show
 */
export const showHideElem = (elem, show = true) => {
  const styleCurrent = elem?.getAttribute('style');
  let styleNew = styleCurrent?.replace(/;?display\s*:\s*\w+/, '') || '';
  if (!show) styleNew += ';display:none;';

  elem?.setAttribute('style', styleNew);
};

enableEvalElem.addEventListener('click', () => showHideElem(document.getElementById('nav-eval-tab'), enableEvalElem.checked));

const enableLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

enableAdvancedRecognitionElem.addEventListener('click', () => {
  showHideElem(document.getElementById('advancedRecognitionOptions'), enableAdvancedRecognitionElem.checked);
  showHideElem(document.getElementById('basicRecognitionOptions'), !enableAdvancedRecognitionElem.checked);
});

export const enableRecognitionClick = () => showHideElem(document.getElementById('nav-recognize-tab'), enableRecognitionElem.checked);

enableRecognitionElem.addEventListener('click', enableRecognitionClick);

enableLayoutElem.addEventListener('click', () => showHideElem(document.getElementById('nav-layout-tab'), enableLayoutElem.checked));

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!enableLayoutElem.checked) enableLayoutElem.click();

  showHideElem(formatLabelOptionXlsxElem, enableXlsxExportElem.checked);

  updateDataPreview();
};

enableXlsxExportElem.addEventListener('click', enableXlsxExportClick);

const enableEnginesElem = /** @type {HTMLInputElement} */(document.getElementById('enableExtraEngines'));

enableEnginesElem.addEventListener('click', () => showHideElem(document.getElementById('engineCol'), enableEnginesElem.checked));

const addOverlayCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('addOverlayCheckbox'));
const standardizeCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('standardizeCheckbox'));

const uploadOCRNameElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRName'));
const uploadOCRFileElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRFile'));

const uploadOCRButtonElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRButton'));
uploadOCRButtonElem.addEventListener('click', importOCRFilesSupp);

// const uploadOCRLabelElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRLabel'));
const uploadOCRDataElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRData'));

uploadOCRDataElem.addEventListener('show.bs.collapse', () => {
  if (!uploadOCRNameElem.value) {
    uploadOCRNameElem.value = `OCR Data ${displayLabelOptionsElem.childElementCount + 1}`;
  }
});

document.getElementById('fontMinus')?.addEventListener('click', () => { changeWordFontSize('minus'); });
document.getElementById('fontPlus')?.addEventListener('click', () => { changeWordFontSize('plus'); });
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
fontSizeElem.addEventListener('change', () => { changeWordFontSize(fontSizeElem.value); });
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
wordFontElem.addEventListener('change', () => { changeWordFontFamily(wordFontElem.value); });

// document.getElementById('editBoundingBox').addEventListener('click', toggleBoundingBoxesSelectedWords);
document.getElementById('editBaseline')?.addEventListener('click', adjustBaseline);

const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
rangeBaselineElem.addEventListener('input', () => { adjustBaselineRange(rangeBaselineElem.value); });
rangeBaselineElem.addEventListener('mouseup', () => { adjustBaselineRangeChange(rangeBaselineElem.value); });

document.getElementById('deleteWord')?.addEventListener('click', deleteSelectedWords);

document.getElementById('addWord')?.addEventListener('click', addWordClick);
document.getElementById('reset')?.addEventListener('click', clearFiles);

const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));
optimizeFontElem.addEventListener('click', () => { optimizeFontClick(optimizeFontElem.checked); });

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
confThreshHighElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });
confThreshMedElem.addEventListener('change', () => { renderPageQueue(cp.n, false); });

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
// const autoMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoMarginCheckbox'));
// const showMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('showMarginCheckbox'));
autoRotateCheckboxElem.addEventListener('click', () => { renderPageQueue(cp.n, false); });
// autoMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(cp.n, false) });
// showMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(cp.n, false) });
document.getElementById('showBoundingBoxes')?.addEventListener('click', () => { renderPageQueue(cp.n, false); });

const displayLabelOptionsElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));
const displayLabelTextElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));
displayLabelOptionsElem.addEventListener('click', (e) => { if (e.target.className !== 'dropdown-item') return; setCurrentHOCR(e.target.innerHTML); });

const downloadElem = /** @type {HTMLInputElement} */(document.getElementById('download'));
downloadElem.addEventListener('click', handleDownload);
document.getElementById('pdfPagesLabel')?.addEventListener('click', updatePdfPagesLabel);

const formatLabelOptionPDFElem = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionPDF'));
const formatLabelOptionHOCRElem = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionHOCR'));
const formatLabelOptionTextElem = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionText'));
const formatLabelOptionDocxElem = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionDocx'));
const formatLabelOptionXlsxElem = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionXlsx'));

formatLabelOptionPDFElem.addEventListener('click', () => { setFormatLabel('pdf'); });
formatLabelOptionHOCRElem.addEventListener('click', () => { setFormatLabel('hocr'); });
formatLabelOptionTextElem.addEventListener('click', () => { setFormatLabel('text'); });
formatLabelOptionDocxElem.addEventListener('click', () => { setFormatLabel('docx'); });
formatLabelOptionXlsxElem.addEventListener('click', () => { setFormatLabel('xlsx'); });

document.getElementById('oemLabelOptionLstm')?.addEventListener('click', () => { setOemLabel('lstm'); });
document.getElementById('oemLabelOptionLegacy')?.addEventListener('click', () => { setOemLabel('legacy'); });
document.getElementById('oemLabelOptionCombined')?.addEventListener('click', () => { setOemLabel('combined'); });

document.getElementById('psmLabelOption3')?.addEventListener('click', () => { setPsmLabel('3'); });
document.getElementById('psmLabelOption4')?.addEventListener('click', () => { setPsmLabel('4'); });

document.getElementById('buildLabelOptionDefault')?.addEventListener('click', () => { setBuildLabel('default'); });
document.getElementById('buildLabelOptionVanilla')?.addEventListener('click', () => { setBuildLabel('vanilla'); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));
showConflictsElem.addEventListener('input', () => {
  if (!showConflictsElem.checked) {
    document.getElementById('debugCanvasParentDiv')?.setAttribute('style', 'display:none');
  } else {
    showDebugImages();
  }
  setCanvasWidthHeightZoom(globalThis.state.imgDims, false);
});

const recognizeAllElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));
recognizeAllElem.addEventListener('click', () => {
  globalThis.state.recognizeAllPromise = recognizeAllClick();
});

const recognizeAreaElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));
recognizeAreaElem.addEventListener('click', () => recognizeAreaClick(false));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
recognizeWordElem.addEventListener('click', () => recognizeAreaClick(true));

const debugPrintCoordsElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintCoords'));
debugPrintCoordsElem.addEventListener('click', () => recognizeAreaClick(true, true));

const addLayoutBoxElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBox'));
const addLayoutBoxTypeOrderElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeOrder'));
const addLayoutBoxTypeExcludeElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeExclude'));
const addLayoutBoxTypeDataColumnElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeDataColumn'));

addLayoutBoxElem.addEventListener('click', () => addLayoutBoxClick());
addLayoutBoxTypeOrderElem.addEventListener('click', () => addLayoutBoxClick('order'));
addLayoutBoxTypeExcludeElem.addEventListener('click', () => addLayoutBoxClick('exclude'));
addLayoutBoxTypeDataColumnElem.addEventListener('click', () => addLayoutBoxClick('dataColumn'));

const deleteLayoutBoxElem = /** @type {HTMLInputElement} */(document.getElementById('deleteLayoutBox'));
deleteLayoutBoxElem.addEventListener('click', () => deleteLayoutBoxClick());

const setDefaultLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('setDefaultLayout'));
setDefaultLayoutElem.addEventListener('click', () => setDefaultLayoutClick());

const revertLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('revertLayout'));
revertLayoutElem.addEventListener('click', () => revertLayoutClick());

const setLayoutBoxTypeOrderElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTypeOrder'));
const setLayoutBoxTypeExcludeElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTypeExclude'));
const setLayoutBoxTypeDataColumnElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTypeDataColumn'));

setLayoutBoxTypeOrderElem.addEventListener('click', () => setLayoutBoxTypeClick('order'));
setLayoutBoxTypeExcludeElem.addEventListener('click', () => setLayoutBoxTypeClick('exclude'));
setLayoutBoxTypeDataColumnElem.addEventListener('click', () => setLayoutBoxTypeClick('dataColumn'));

const setLayoutBoxInclusionRuleMajorityElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));
const setLayoutBoxInclusionRuleLeftElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));
setLayoutBoxInclusionRuleMajorityElem.addEventListener('click', () => setLayoutBoxInclusionRuleClick('majority'));
setLayoutBoxInclusionRuleLeftElem.addEventListener('click', () => setLayoutBoxInclusionRuleClick('left'));

const setLayoutBoxInclusionLevelWordElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));
const setLayoutBoxInclusionLevelLineElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));
setLayoutBoxInclusionLevelWordElem.addEventListener('click', () => setLayoutBoxInclusionLevelClick('word'));
setLayoutBoxInclusionLevelLineElem.addEventListener('click', () => setLayoutBoxInclusionLevelClick('line'));

const setLayoutBoxTableElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTable'));
setLayoutBoxTableElem.addEventListener('change', () => { setLayoutBoxTable(setLayoutBoxTableElem.value); });

const showExcludedTextElem = /** @type {HTMLInputElement} */(document.getElementById('showExcludedText'));
showExcludedTextElem.addEventListener('click', () => getExcludedText());

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));
ignorePunctElem.addEventListener('change', () => { renderPageQueue(cp.n, true); });

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));
ignoreCapElem.addEventListener('change', () => { renderPageQueue(cp.n, true); });

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreExtra'));
ignoreExtraElem.addEventListener('change', () => { renderPageQueue(cp.n, true); });

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));

const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
pdfPageMinElem.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
pdfPageMaxElem.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pageCountElem = /** @type {HTMLInputElement} */(document.getElementById('pageCount'));
const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

pageNumElem.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    displayPage(parseInt(pageNumElem.value) - 1);
  }
});

const reflowCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('reflowCheckbox'));
const pageBreaksCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('pageBreaksCheckbox'));

// If "Reflow Text" is turned off, then pages will automatically have line breaks between them
reflowCheckboxElem.addEventListener('click', (event) => {
  if (event.target.checked) {
    pageBreaksCheckboxElem.disabled = false;
  } else {
    pageBreaksCheckboxElem.disabled = true;
    pageBreaksCheckboxElem.checked = true;
  }
});

const docxReflowCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxReflowCheckbox'));
const docxPageBreaksCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxPageBreaksCheckbox'));

// If "Reflow Text" is turned off, then pages will automatically have line breaks between them
docxReflowCheckboxElem.addEventListener('click', (event) => {
  if (event.target.checked) {
    docxPageBreaksCheckboxElem.disabled = false;
  } else {
    docxPageBreaksCheckboxElem.disabled = true;
    docxPageBreaksCheckboxElem.checked = true;
  }
});

const matchCountElem = /** @type {HTMLInputElement} */(document.getElementById('matchCount'));
const matchCurrentElem = /** @type {HTMLInputElement} */(document.getElementById('matchCurrent'));
const prevMatchElem = /** @type {HTMLInputElement} */(document.getElementById('prevMatch'));
const nextMatchElem = /** @type {HTMLInputElement} */(document.getElementById('nextMatch'));
prevMatchElem.addEventListener('click', () => prevMatchClick());
nextMatchElem.addEventListener('click', () => nextMatchClick());

function prevMatchClick() {
  if (cp.n === 0) return;
  const lastPage = search.matches.slice(0, cp.n)?.findLastIndex((x) => x > 0);
  if (lastPage > -1) displayPage(lastPage);
}

function nextMatchClick() {
  const nextPageOffset = search.matches.slice(cp.n + 1)?.findIndex((x) => x > 0);
  if (nextPageOffset > -1) displayPage(cp.n + nextPageOffset + 1);
}

const editFindElem = /** @type {HTMLInputElement} */(document.getElementById('editFind'));
editFindElem.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    const val = editFindElem.value.trim();
    findTextClick(val);
  }
});

function findTextClick(text) {
  search.search = text.trim();
  // Start by highlighting the matches in the current page
  highlightcp(text);
  if (search.search) {
    // TODO: If extractTextAll takes any non-trivial amount of time to run,
    // this should use a promise so it cannot be run twice if the user presses enter twice.
    if (!search.init) {
      extractTextAll();
      search.init = true;
    }
    findAllMatches(search.search);
  } else {
    search.matches = [];
    search.total = 0;
  }

  matchCurrentElem.textContent = calcMatchNumber(cp.n);
  matchCountElem.textContent = String(search.total);
}

/**
 * @typedef find
 * @type {object}
 * @property {string[]} text - Array with text contents of each page
 * @property {string} search - Search string
 * @property {number[]} matches - Array with number of matches on each page
 * @property {boolean} init - Whether find object has been initiated
 * @property {number} total - Total number of matches

 */
/** @type {find} */
export const search = {
  text: [],
  search: '',
  matches: [],
  init: false,
  total: 0,
};

// Highlight words that include substring in the current page
function highlightcp(text) {
  const selectedObjects = window.canvas.getObjects();
  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    // Using the presence of a wordID property to indicate this object represents an OCR word
    if (selectedObjects[i]?.wordID) {
      const textI = selectedObjects[i].text;
      if (text.trim() && textI.toLowerCase().includes(text.toLowerCase())) {
        selectedObjects[i].textBackgroundColor = '#4278f550';
        selectedObjects[i].dirty = true;
      } else if (selectedObjects[i].textBackgroundColor) {
        selectedObjects[i].textBackgroundColor = '';
        selectedObjects[i].dirty = true;
      }
    }
  }

  canvas.renderAll();
}

function findAllMatches(text) {
  let total = 0;
  const matches = [];
  const maxValue = globalThis.imageAll.nativeSrc.length;
  for (let i = 0; i < maxValue; i++) {
    const n = occurrences(search.text[i], text);
    matches[i] = n;
    total += n;
  }
  search.matches = matches;
  search.total = total;
}

// Updates data used for "Find" feature on current page
// Should be called after any edits are made, before moving to a different page
function updateFindStats() {
  if (!globalThis.ocrAll.active[cp.n]) {
    search.text[cp.n] = '';
    return;
  }

  // Re-extract text from XML
  search.text[cp.n] = ocr.getPageText(globalThis.ocrAll.active[cp.n]);

  if (search.search) {
    // Count matches in current page
    search.matches[cp.n] = occurrences(search.text[cp.n], search.search);
    // Calculate total number of matches
    search.total = search.matches.reduce((partialSum, a) => partialSum + a, 0);

    matchCurrentElem.textContent = calcMatchNumber(cp.n);
    matchCountElem.textContent = String(search.total);
  }
}

// Extract text from XML for every page
// We do this once (and then perform incremental updates) to avoid having to parse XML
// with every search.
function extractTextAll() {
  const maxValue = globalThis.ocrAll.active.length;

  for (let g = 0; g < maxValue; g++) {
    search.text[g] = ocr.getPageText(globalThis.ocrAll.active[g]);
  }
}

// Returns string showing index of match(es) found on current page.
function calcMatchNumber(n) {
  const matchN = search.matches?.[n];
  if (!matchN) {
    return '-';
  }
  // Sum of matches on all previous pages
  const matchPrev = search.matches.slice(0, n).reduce((a, b) => a + b, 0);

  if (matchN === 1) {
    return String(matchPrev + 1);
  }
  return `${String(matchPrev + 1)}-${String(matchPrev + 1 + (matchN - 1))}`;
}

function updatePdfPagesLabel() {
  const pageCount = globalThis.imageAll.nativeSrc?.length;

  let minValue = parseInt(pdfPageMinElem.value);
  let maxValue = parseInt(pdfPageMaxElem.value);

  if (!minValue || minValue < 0) minValue = 1;
  if (!maxValue || maxValue > pageCount) maxValue = pageCount;

  let pagesStr;
  if (minValue > 0 && maxValue > 0 && (minValue > 1 || maxValue < pageCount)) {
    pagesStr = ` Pages: ${minValue}–${maxValue}`;
  } else {
    pagesStr = ' Pages: All';
    minValue = 1;
    maxValue = pageCount;
  }

  pdfPageMinElem.value = minValue ? minValue.toString() : '1';
  pdfPageMaxElem.value = maxValue ? maxValue.toString() : '';
  document.getElementById('pdfPagesLabelText').innerText = pagesStr;
}

const formatLabelSVGElem = /** @type {HTMLElement} */(document.getElementById('formatLabelSVG'));
const formatLabelTextElem = /** @type {HTMLElement} */(document.getElementById('formatLabelText'));
const textOptionsElem = /** @type {HTMLElement} */(document.getElementById('textOptions'));
const pdfOptionsElem = /** @type {HTMLElement} */(document.getElementById('pdfOptions'));
const docxOptionsElem = /** @type {HTMLElement} */(document.getElementById('docxOptions'));
const xlsxOptionsElem = /** @type {HTMLElement} */(document.getElementById('xlsxOptions'));

export function setFormatLabel(x) {
  if (x.toLowerCase() === 'pdf') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', '');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`;

    formatLabelTextElem.innerHTML = 'PDF';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  } else if (x.toLowerCase() === 'hocr') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`;

    formatLabelTextElem.innerHTML = 'HOCR';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.hocr`;
  } else if (x.toLowerCase() === 'text') {
    textOptionsElem.setAttribute('style', '');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`;

    formatLabelTextElem.innerHTML = 'Text';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.txt`;
  } else if (x.toLowerCase() === 'docx') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', '');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M5.485 6.879a.5.5 0 1 0-.97.242l1.5 6a.5.5 0 0 0 .967.01L8 9.402l1.018 3.73a.5.5 0 0 0 .967-.01l1.5-6a.5.5 0 0 0-.97-.242l-1.036 4.144-.997-3.655a.5.5 0 0 0-.964 0l-.997 3.655L5.485 6.88z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>`;

    formatLabelTextElem.innerHTML = 'Docx';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.docx`;
  } else if (x.toLowerCase() === 'xlsx') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', '');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V9H3V2a1 1 0 0 1 1-1h5.5v2zM3 12v-2h2v2H3zm0 1h2v2H4a1 1 0 0 1-1-1v-1zm3 2v-2h3v2H6zm4 0v-2h3v1a1 1 0 0 1-1 1h-2zm3-3h-3v-2h3v2zm-7 0v-2h3v2H6z"/>`;

    formatLabelTextElem.innerHTML = 'Xlsx';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.xlsx`;
  }
  enableDisableDownloadPDFAlert();
}

const xlsxFilenameColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));
const xlsxPageNumberColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));
xlsxFilenameColumnElem.addEventListener('click', updateDataPreview);
xlsxPageNumberColumnElem.addEventListener('click', updateDataPreview);

const oemLabelTextElem = /** @type {HTMLElement} */(document.getElementById('oemLabelText'));

function setOemLabel(x) {
  if (x.toLowerCase() === 'lstm') {
    oemLabelTextElem.innerHTML = 'LSTM';
  } else if (x.toLowerCase() === 'legacy') {
    oemLabelTextElem.innerHTML = 'Legacy';
  } else if (x.toLowerCase() === 'combined') {
    oemLabelTextElem.innerHTML = 'Combined';
  }
}

const psmLabelTextElem = /** @type {HTMLElement} */(document.getElementById('psmLabelText'));

/**
 *
 * @param {string} x
 */
function setPsmLabel(x) {
  if (x === '3') {
    psmLabelTextElem.innerHTML = 'Automatic';
  } else if (x === '4') {
    psmLabelTextElem.innerHTML = 'Single Column';
  } else if (x === '8') {
    psmLabelTextElem.innerHTML = 'Single Word';
  }
}

const buildLabelTextElem = /** @type {HTMLElement} */(document.getElementById('buildLabelText'));

function setBuildLabel(x) {
  if (x.toLowerCase() === 'default') {
    buildLabelTextElem.innerHTML = 'Default';
  } else if (x.toLowerCase() === 'vanilla') {
    buildLabelTextElem.innerHTML = 'Vanilla';
  }
}

/**
 * Initialize a new version of OCR data (Legacy, LSTM, etc.).
 * @param {string} label
 */
export function initOCRVersion(label) {
  // Initialize a new array on `ocrAll` if one does not already exist
  if (!globalThis.ocrAll[label]) {
    globalThis.ocrAll[label] = Array(globalThis.pageCount);
  }

  // Exit early for 'Tesseract Latest'. This is used under the hood and users should not see it.
  if (label === 'Tesseract Latest') return;

  // Exit early if option already exists
  const existingOptions = displayLabelOptionsElem.children;
  for (let i = 0; i < existingOptions.length; i++) {
    if (existingOptions[i].innerHTML === label) return;
  }
  const option = document.createElement('a');
  option.setAttribute('class', 'dropdown-item');
  option.text = label;
  displayLabelOptionsElem.appendChild(option);
}

globalThis.ocrAll = { active: [] };
export function setCurrentHOCR(x) {
  const currentLabel = displayLabelTextElem.innerHTML.trim();
  if (!x.trim() || x === currentLabel) return;

  globalThis.ocrAll.active = globalThis.ocrAll[x];
  displayLabelTextElem.innerHTML = x;

  if (displayModeElem.value === 'eval') {
    renderPageQueue(cp.n, true);
  } else {
    renderPageQueue(cp.n, false);
  }
}

// Users may select an edit action (e.g. "Add Word", "Recognize Word", etc.) but then never follow through.
// This function cleans up any changes/event listners caused by the initial click in such cases.
document.getElementById('navBar')?.addEventListener('click', (e) => {
  newWordInit = true;
  resetCanvasEventListeners();
  globalThis.touchScrollMode = true;
}, true);

// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
document.getElementById('nav-recognize')?.addEventListener('hidden.bs.collapse', (e) => {
  if (!e?.target || e.target.id !== 'nav-recognize') return;
  hideProgress('import-eval-progress-collapse');
  hideProgress('recognize-recognize-progress-collapse');
});

document.getElementById('nav-download')?.addEventListener('hidden.bs.collapse', (e) => {
  if (e.target.id !== 'nav-download') return;
  hideProgress('generate-download-progress-collapse');
});

// Once per session, if the user opens the "Download" tab and proofreading mode is still enabled,
// the user will be prompted to change display modes before downloading.
// This is because, while printing OCR text visibly is an intended feature (it was the original purpose of this application),
// a user trying to add text to an image-based PDF may be surprised by this behavior.
const pdfAlertElem = insertAlertMessage('To generate a PDF with invisible OCR text, select View > Display Mode > OCR Mode before downloading.', false, 'alertDownloadDiv', false);
export const enableDisableDownloadPDFAlert = () => {
  // Alert is enabled if (1)
  const enable = displayModeElem.value === 'proof' && formatLabelTextElem.textContent === 'PDF';

  if (enable) {
    pdfAlertElem.setAttribute('style', '');
  } else {
    pdfAlertElem.setAttribute('style', 'display:none');
  }
};

document.getElementById('nav-layout')?.addEventListener('show.bs.collapse', (e) => {
  if (e.target.id != 'nav-layout') return;
  globalThis.layoutMode = true;

  if (!globalThis.layout[cp.n]) return;
  if (!fabric.Object.prototype.objectCaching) enableObjectCaching();

  toggleSelectableWords(false);

  renderLayoutBoxes(Object.keys(globalThis.layout[cp.n].boxes));
});

document.getElementById('nav-layout')?.addEventListener('hide.bs.collapse', (e) => {
  if (e.target.id != 'nav-layout') return;
  globalThis.layoutMode = false;
  toggleSelectableWords(true);
  clearLayoutBoxes();
});

/**
 *
 * @param {string} id - HTML element ID
 * @param {number} maxValue
 * @param {number} initValue
 * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
 *    If this is default, the bar is only visually updated for the every 5 values (plus the first and last).
 *    This avoids stutters when the value is incremented quickly, so should be enabled when loading is expected to be quick.
 * @param {boolean} autoHide - Automatically hide loading bar when it reaches 100%
 * @returns
 */
function initializeProgress(id, maxValue, initValue = 0, alwaysUpdateUI = false, autoHide = false) {
  const progressCollapse = document.getElementById(id);

  const progressCollapseObj = new bootstrap.Collapse(progressCollapse, { toggle: false });

  const progressBar = progressCollapse.getElementsByClassName('progress-bar')[0];

  globalThis.loadCount = initValue;
  progressBar.setAttribute('aria-valuenow', initValue.toString());
  // Visually, progress starts at 1%.  If progress starts at 0%, certain automated tests failed as that counted as "hidden".
  progressBar.setAttribute('style', `width: ${Math.max(initValue / maxValue * 100, 1)}%`);
  progressBar.setAttribute('aria-valuemax', String(maxValue));
  progressCollapseObj.show();

  const progressObj = {
    elem: progressBar,
    value: initValue,
    maxValue,
    async increment() {
      this.value++;
      if (this.value > this.maxValue) console.log('Progress bar value >100%.');
      if (alwaysUpdateUI || (this.value) % 5 === 0 || this.value === this.maxValue) {
        this.elem.setAttribute('aria-valuenow', this.value.toString());
        this.elem.setAttribute('style', `width: ${Math.max(this.value / maxValue * 100, 1)}%`);
        await sleep(0);
      }
      if (autoHide && this.value >= this.maxValue) {
      // Wait for a second to hide.
      // This is better visually, as the user has time to note that the load finished.
      // Additionally, hiding sometimes fails entirely with no delay, if the previous animation has not yet finished.
        setTimeout(() => progressCollapseObj.hide(), 1000);
      }
    },
  };

  return (progressObj);
}

// Hides progress bar if completed
function hideProgress(id) {
  const progressCollapse = document.getElementById(id);
  if (['collapse show', 'collapsing'].includes(progressCollapse.getAttribute('class'))) {
    const progressBar = progressCollapse.getElementsByClassName('progress-bar')[0];
    if (parseInt(progressBar.getAttribute('aria-valuenow')) >= parseInt(progressBar.getAttribute('aria-valuemax'))) {
      progressCollapse.setAttribute('class', 'collapse');
    }
  }
}

// This differs from hideProgress in that (1) the hide is animated rather than instant and (2) the collapse is hidden regardless
// of whether loading is complete.
function hideProgress2(id) {
  const progressCollapse = document.getElementById(id);
  if (progressCollapse.getAttribute('class') === 'collapse show') {
    (new bootstrap.Collapse(progressCollapse)).hide();

  // The collapsing animation needs to end before this can be hidden
  } else if (progressCollapse.getAttribute('class') === 'collapsing') {
    setTimeout(() => hideProgress2(id), 500);
  }
}

/**
 * @type {{[key: string]: Array<Array<CompDebugBrowser>> | undefined}}
 */
globalThis.debugImg = {};

async function recognizeAllClick() {
  const debugMode = true;

  // User can select engine directly using advanced options, or indirectly using basic options.
  let oemMode;
  if (enableAdvancedRecognitionElem.checked) {
    oemMode = oemLabelTextElem.innerHTML;
  } else if (ocrQualityElem.value === '1') {
    oemMode = 'combined';
  } else {
    oemMode = 'legacy';
    setOemLabel('legacy');
  }

  // Whether user uploaded data will be compared against in addition to both Tesseract engines
  const userUploadMode = Boolean(globalThis.ocrAll['User Upload']);
  const existingOCR = Object.keys(globalThis.ocrAll).filter((x) => x !== 'active').length > 0;

  // A single Tesseract engine can be used (Legacy or LSTM) or the results from both can be used and combined.
  if (oemMode === 'legacy' || oemMode === 'lstm') {
    globalThis.convertPageActiveProgress = initializeProgress('recognize-recognize-progress-collapse', globalThis.imageAll.native.length, 0, true);
    const time2a = Date.now();
    // Tesseract is used as the "main" data unless user-uploaded data exists and only the LSTM model is being run.
    // This is because Tesseract Legacy provides very strong metrics, and Abbyy often does not.
    await recognizeAllPagesBrowser(oemMode === 'legacy', oemMode === 'lstm', !(oemMode === 'lstm' && existingOCR));
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);
    if (oemMode === 'legacy') await runFontOptimizationBrowser(globalThis.ocrAll['Tesseract Legacy']);
  } else if (oemMode === 'combined') {
    globalThis.loadCount = 0;
    globalThis.convertPageActiveProgress = initializeProgress('recognize-recognize-progress-collapse', globalThis.imageAll.native.length * 2, 0, true);

    const time2a = Date.now();
    await recognizeAllPagesBrowser(true, true, true);
    const time2b = Date.now();
    if (debugMode) console.log(`Tesseract runtime: ${time2b - time2a} ms`);

    if (debugMode) {
      globalThis.debugImg.Combined = new Array(globalThis.imageAll.native.length);
      for (let i = 0; i < globalThis.imageAll.native.length; i++) {
        globalThis.debugImg.Combined[i] = [];
      }
    }

    if (userUploadMode) {
      initOCRVersion('Tesseract Combined');
      setCurrentHOCR('Tesseract Combined');
      if (debugMode) {
        globalThis.debugImg['Tesseract Combined'] = new Array(globalThis.imageAll.native.length);
        for (let i = 0; i < globalThis.imageAll.native.length; i++) {
          globalThis.debugImg['Tesseract Combined'][i] = [];
        }
      }
    }

    // A new version of OCR data is created for font optimization and validation purposes.
    // This version has the bounding box and style data from the Legacy data, however uses the text from the LSTM data whenever conflicts occur.
    // Additionally, confidence is set to 0 when conflicts occur. Using this version benefits both font optimiztion and validation.
    // For optimization, using this version rather than Tesseract Legacy excludes data that conflicts with Tesseract LSTM and is therefore likely incorrect,
    // as low-confidence words are excluded when calculating overall character metrics.
    // For validation, this version is superior to both Legacy and LSTM, as it combines the more accurate bounding boxes/style data from Legacy
    // with the more accurate (on average) text data from LSTM.

    initOCRVersion('Tesseract Combined Temp');
    for (let i = 0; i < globalThis.imageAll.native.length; i++) {
      const compOptions1 = {
        mode: 'comb',
        evalConflicts: false,
      };

      const imgElem = await globalThis.imageAll.binary[i];

      const res1 = await globalThis.gs.compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem.src,
        imageRotated: globalThis.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions1,
      });

      globalThis.ocrAll['Tesseract Combined Temp'][i] = res1.page;
    }

    // Evaluate default fonts using up to 5 pages.
    const pageNum = Math.min(globalThis.imageAll.native.length, 5);
    await renderPDFImageCache(Array.from({ length: pageNum }, (v, k) => k), null, null, 'binary');

    await runFontOptimizationBrowser(globalThis.ocrAll['Tesseract Combined Temp']);

    initOCRVersion('Combined');
    setCurrentHOCR('Combined');

    const time3a = Date.now();
    for (let i = 0; i < globalThis.imageAll.native.length; i++) {
      const tessCombinedLabel = userUploadMode ? 'Tesseract Combined' : 'Combined';

      const compOptions = {
        mode: 'comb',
        debugLabel: tessCombinedLabel,
        ignoreCap: ignoreCapElem.checked,
        ignorePunct: ignorePunctElem.checked,
        confThreshHigh: parseInt(confThreshHighElem.value),
        confThreshMed: parseInt(confThreshMedElem.value),
      };

      const imgElem = await globalThis.imageAll.binary[i];

      const res = await globalThis.gs.compareHOCR({
        pageA: globalThis.ocrAll['Tesseract Legacy'][i],
        pageB: globalThis.ocrAll['Tesseract LSTM'][i],
        binaryImage: imgElem.src,
        imageRotated: globalThis.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      if (globalThis.debugLog === undefined) globalThis.debugLog = '';
      globalThis.debugLog += res.debugLog;

      globalThis.debugImg[tessCombinedLabel][i] = res.debugImg;

      globalThis.ocrAll[tessCombinedLabel][i] = res.page;
      globalThis.ocrAll.active[i] = ocrAll[tessCombinedLabel][i];

      // If the user uploaded data, compare to that as we
      if (userUploadMode) {
        if (document.getElementById('combineMode')?.value === 'conf') {
          const compOptions = {
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(confThreshHighElem.value),
            confThreshMed: parseInt(confThreshMedElem.value),
          };

          const imgElem = await globalThis.imageAll.binary[i];
          const res = await globalThis.gs.compareHOCR({
            pageA: globalThis.ocrAll['User Upload'][i],
            pageB: globalThis.ocrAll['Tesseract Combined'][i],
            binaryImage: imgElem.src,
            imageRotated: globalThis.imageAll.binaryRotated[i],
            pageMetricsObj: globalThis.pageMetricsArr[i],
            options: compOptions,
          });

          if (globalThis.debugLog === undefined) globalThis.debugLog = '';
          globalThis.debugLog += res.debugLog;

          globalThis.debugImg.Combined[i] = res.debugImg;

          globalThis.ocrAll.Combined[i] = res.page;
        } else {
          const compOptions = {
            mode: 'comb',
            debugLabel: 'Combined',
            supplementComp: true,
            ignoreCap: ignoreCapElem.checked,
            ignorePunct: ignorePunctElem.checked,
            confThreshHigh: parseInt(confThreshHighElem.value),
            confThreshMed: parseInt(confThreshMedElem.value),
          };

          const imgElem = await globalThis.imageAll.binary[i];
          const res = await globalThis.globalThis.gs.compareHOCR({
            pageA: globalThis.ocrAll['User Upload'][i],
            pageB: globalThis.ocrAll['Tesseract Combined'][i],
            binaryImage: imgElem.src,
            imageRotated: globalThis.imageAll.binaryRotated[i],
            pageMetricsObj: globalThis.pageMetricsArr[i],
            options: compOptions,
          });

          if (globalThis.debugLog === undefined) globalThis.debugLog = '';
          globalThis.debugLog += res.debugLog;

          globalThis.debugImg.Combined[i] = res.debugImg;

          globalThis.ocrAll.Combined[i] = res.page;
        }

        globalThis.ocrAll.active[i] = ocrAll.Combined[i];
      }
    }
    const time3b = Date.now();
    if (debugMode) console.log(`Comparison runtime: ${time3b - time3a} ms`);
  }

  hideProgress2('recognize-recognize-progress-collapse');

  renderPageQueue(cp.n);

  // Enable confidence threshold input boxes (only used for Tesseract)
  confThreshHighElem.disabled = false;
  confThreshMedElem.disabled = false;

  // Set threshold values if not already set
  confThreshHighElem.value = confThreshHighElem.value || '85';
  confThreshMedElem.value = confThreshMedElem.value || '75';

  toggleEditButtons(false);

  return (true);
}

function createGroundTruthClick() {
  if (!globalThis.ocrAll['Ground Truth']) {
    globalThis.ocrAll['Ground Truth'] = Array(globalThis.imageAll.native.length);
  }

  for (let i = 0; i < globalThis.ocrAll.active.length; i++) {
    globalThis.ocrAll['Ground Truth'][i] = structuredClone(globalThis.ocrAll.active[i]);
  }

  // Use whatever the current HOCR is as a starting point
  // globalThis.ocrAll["Ground Truth"] = structuredClone(globalThis.ocrAll.active);
  initOCRVersion('Ground Truth');
  setCurrentHOCR('Ground Truth');

  const option = document.createElement('option');
  option.text = 'Evaluate Mode (Compare with Ground Truth)';
  option.value = 'eval';
  displayModeElem.add(option);

  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = false;
}

globalThis.evalStatsConfig = {};

globalThis.evalStats = [];

async function compareGroundTruthClick(n) {
  if (!globalThis.gs) throw new Error('GeneralScheduler must be defined before this function can run.');

  // When a document/recognition is still loading only the page statistics can be calculated
  const loadMode = !!(globalThis.loadCount && globalThis.loadCount < parseInt(globalThis.convertPageActiveProgress?.elem?.getAttribute('aria-valuemax')));

  const evalStatsConfigNew = {};
  evalStatsConfigNew.ocrActive = displayLabelTextElem.innerHTML;
  evalStatsConfigNew.ignorePunct = ignorePunctElem.checked;
  evalStatsConfigNew.ignoreCap = ignoreCapElem.checked;
  evalStatsConfigNew.ignoreExtra = ignoreExtraElem.checked;

  const compOptions = {
    ignoreCap: ignoreCapElem.checked,
    ignorePunct: ignorePunctElem.checked,
    confThreshHigh: parseInt(confThreshHighElem.value),
    confThreshMed: parseInt(confThreshMedElem.value),
  };

  // Compare all pages if this has not been done already
  if (!loadMode && JSON.stringify(globalThis.evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || globalThis.evalStats.length === 0) {
    globalThis.evalStats = new Array(globalThis.imageAll.native.length);
    for (let i = 0; i < globalThis.imageAll.native.length; i++) {
      const imgElem = await globalThis.imageAll.binary[i];

      const res = await globalThis.gs.compareHOCR({
        pageA: globalThis.ocrAll.active[i],
        pageB: globalThis.ocrAll['Ground Truth'][i],
        binaryImage: imgElem.src,
        imageRotated: globalThis.imageAll.binaryRotated[i],
        pageMetricsObj: globalThis.pageMetricsArr[i],
        options: compOptions,
      });

      globalThis.ocrAll.active[i] = res.page;

      globalThis.evalStats[i] = res.metrics;
      if (globalThis.debugLog === undefined) globalThis.debugLog = '';
      globalThis.debugLog += res.debugLog;
    }
    globalThis.evalStatsConfig = evalStatsConfigNew;
  }

  const imgElem = await globalThis.imageAll.binary[n];
  const res = await globalThis.gs.compareHOCR({
    pageA: globalThis.ocrAll.active[n],
    pageB: globalThis.ocrAll['Ground Truth'][n],
    binaryImage: imgElem.src,
    imageRotated: globalThis.imageAll.binaryRotated[n],
    pageMetricsObj: globalThis.pageMetricsArr[n],
    options: compOptions,
  });

  globalThis.ocrAll.active[n] = res.page;
  if (globalThis.debugLog === undefined) globalThis.debugLog = '';
  globalThis.debugLog += res.debugLog;

  globalThis.evalStats[n] = res.metrics;

  const metricTotalWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsPage'));
  const metricCorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsPage'));
  const metricIncorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsPage'));
  const metricMissedWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsPage'));
  const metricExtraWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsPage'));
  const metricCorrectLowConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsPage'));
  const metricIncorrectHighConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsPage'));

  const metricWERPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERPage'));

  // Display metrics for current page
  metricTotalWordsPageElem.innerHTML = globalThis.evalStats[n].total;
  metricCorrectWordsPageElem.innerHTML = globalThis.evalStats[n].correct;
  metricIncorrectWordsPageElem.innerHTML = globalThis.evalStats[n].incorrect;
  metricMissedWordsPageElem.innerHTML = globalThis.evalStats[n].missed;
  metricExtraWordsPageElem.innerHTML = globalThis.evalStats[n].extra;
  metricCorrectLowConfWordsPageElem.innerHTML = globalThis.evalStats[n].correctLowConf;
  metricIncorrectHighConfWordsPageElem.innerHTML = globalThis.evalStats[n].incorrectHighConf;

  if (evalStatsConfigNew.ignoreExtra) {
    metricWERPageElem.innerHTML = (Math.round(((globalThis.evalStats[n].incorrect + globalThis.evalStats[n].missed) / globalThis.evalStats[n].total) * 100) / 100).toString();
  } else {
    metricWERPageElem.innerHTML = (Math.round(((globalThis.evalStats[n].incorrect + globalThis.evalStats[n].missed + globalThis.evalStats[n].extra)
    / globalThis.evalStats[n].total) * 100) / 100).toString();
  }

  const metricTotalWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsDoc'));
  const metricCorrectWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsDoc'));
  const metricIncorrectWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsDoc'));
  const metricMissedWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsDoc'));
  const metricExtraWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsDoc'));
  const metricCorrectLowConfWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsDoc'));
  const metricIncorrectHighConfWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsDoc'));
  const metricWERDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERDoc'));

  // Calculate and display metrics for full document
  if (!loadMode) {
    const evalStatsDoc = {
      total: 0,
      correct: 0,
      incorrect: 0,
      missed: 0,
      extra: 0,
      correctLowConf: 0,
      incorrectHighConf: 0,
    };

    for (let i = 0; i < globalThis.evalStats.length; i++) {
      evalStatsDoc.total += globalThis.evalStats[i].total;
      evalStatsDoc.correct += globalThis.evalStats[i].correct;
      evalStatsDoc.incorrect += globalThis.evalStats[i].incorrect;
      evalStatsDoc.missed += globalThis.evalStats[i].missed;
      evalStatsDoc.extra += globalThis.evalStats[i].extra;
      evalStatsDoc.correctLowConf += globalThis.evalStats[i].correctLowConf;
      evalStatsDoc.incorrectHighConf += globalThis.evalStats[i].incorrectHighConf;
    }

    metricTotalWordsDocElem.innerHTML = evalStatsDoc.total.toString();
    metricCorrectWordsDocElem.innerHTML = evalStatsDoc.correct.toString();
    metricIncorrectWordsDocElem.innerHTML = evalStatsDoc.incorrect.toString();
    metricMissedWordsDocElem.innerHTML = evalStatsDoc.missed.toString();
    metricExtraWordsDocElem.innerHTML = evalStatsDoc.extra.toString();
    metricCorrectLowConfWordsDocElem.innerHTML = evalStatsDoc.correctLowConf.toString();
    metricIncorrectHighConfWordsDocElem.innerHTML = evalStatsDoc.incorrectHighConf.toString();

    if (evalStatsConfigNew.ignoreExtra) {
      metricWERDocElem.innerHTML = (Math.round(((evalStatsDoc.incorrect + evalStatsDoc.missed) / evalStatsDoc.total) * 100) / 100).toString();
    } else {
      metricWERDocElem.innerHTML = (Math.round(((evalStatsDoc.incorrect + evalStatsDoc.missed + evalStatsDoc.extra) / evalStatsDoc.total) * 100) / 100).toString();
    }
  } else {
    metricTotalWordsDocElem.innerHTML = '';
    metricCorrectWordsDocElem.innerHTML = '';
    metricIncorrectWordsDocElem.innerHTML = '';
    metricMissedWordsDocElem.innerHTML = '';
    metricExtraWordsDocElem.innerHTML = '';
    metricWERDocElem.innerHTML = '';
  }
}

export async function showDebugImages() {
  /** @type {Array<Array<CompDebugBrowser>>} */
  const compDebugArrArr = [];

  const compDebugArr1 = globalThis.debugImg?.['Tesseract Combined']?.[cp.n];
  const compDebugArr2 = globalThis.debugImg?.Combined?.[cp.n];
  const compDebugArr3 = globalThis.debugImg?.recognizeArea?.[cp.n];

  if (compDebugArr1 && compDebugArr1.length > 0) compDebugArrArr.push(compDebugArr1);
  if (compDebugArr2 && compDebugArr2.length > 0) compDebugArrArr.push(compDebugArr2);
  if (compDebugArr3 && compDebugArr3.length > 0) compDebugArrArr.push(compDebugArr3);

  if (compDebugArrArr.length > 0) await drawDebugImages({ ctx: globalThis.ctxDebug, compDebugArrArr, context: 'browser' });
}

globalThis.showDebugImages = showDebugImages;

let rect1;

/**
 * Recognize area selected by user in Tesseract.
 *
 * @param {boolean} [wordMode=false] - Assume selection is single word.
 * @param {boolean} [printCoordsOnly=false] - Print rect coords only, do not run recognition. Used for debugging.
 *
 * Note: This function assumes OCR data already exists, which this function is adding to.
 * Users should not be allowed to recognize a word/area before OCR data is provided by (1) upload or (2) running "recognize all".
 * Even if recognizing an page for the first time using "recognize area" did not produce an error,
 * it would still be problematic, as running "recognize all" afterwards would overwrite everything.
 */
function recognizeAreaClick(wordMode = false, printCoordsOnly = false) {
  globalThis.touchScrollMode = false;

  canvas.on('mouse:down', (o) => {
    const pointer = canvas.getPointer(o.e);
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
      transparentCorners: false,
    });
    canvas.add(rect1);
    canvas.renderAll();
    canvas.on('mouse:move', (o) => {
      const pointer = canvas.getPointer(o.e);

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
  canvas.on('mouse:up:before', async (o) => {
    globalThis.touchScrollMode = true;

    if (rect1.width < 4 || rect1.height < 4) {
      canvas.remove(rect1);
      return;
    }

    const canvasCoords = {
      left: rect1.left, top: rect1.top, width: rect1.width, height: rect1.height,
    };

    // This should always be running on a rotated image, as the recognize area button is only enabled after the angle is already known.
    const imageRotated = true;
    const canvasRotated = autoRotateCheckboxElem.checked;
    const angle = globalThis.pageMetricsArr[cp.n].angle || 0;

    const imageCoords = coords.canvasToImage(canvasCoords, imageRotated, canvasRotated, cp.n, angle);

    canvas.remove(rect1);

    if (printCoordsOnly) {
      console.log(imageCoords);
      return;
    }

    // When a user is manually selecting words to recognize, they are assumed to be in the same block.
    const psm = wordMode ? Tesseract.PSM.SINGLE_WORD : Tesseract.PSM.SINGLE_BLOCK;
    const n = cp.n;

    if (!globalThis.gs) throw new Error('GeneralScheduler must be defined before this function can run.');
    const res0 = await recognizePage(globalThis.gs, n, true, true, true, { rectangle: imageCoords, tessedit_pageseg_mode: psm });

    const resLegacy = await res0[0];
    const resLSTM = await res0[1];

    const debug = false;
    if (debug) {
      console.log(resLegacy.recognize);
    }

    const pageObjLSTM = resLSTM.convert.lstm.pageObj;
    const pageObjLegacy = resLegacy.convert.legacy.pageObj;

    const debugLabel = 'recognizeArea';

    if (debugLabel && !globalThis.debugImg[debugLabel]) {
      globalThis.debugImg[debugLabel] = new Array(globalThis.imageAll.native.length);
      for (let i = 0; i < globalThis.imageAll.native.length; i++) {
        globalThis.debugImg[debugLabel][i] = [];
      }
    }

    const compOptions = {
      mode: 'comb',
      debugLabel,
      ignoreCap: ignoreCapElem.checked,
      ignorePunct: ignorePunctElem.checked,
      confThreshHigh: parseInt(confThreshHighElem.value),
      confThreshMed: parseInt(confThreshMedElem.value),
    };

    const imgElem = await globalThis.imageAll.binary[n];

    const res = await globalThis.gs.compareHOCR({
      pageA: pageObjLegacy,
      pageB: pageObjLSTM,
      binaryImage: imgElem.src,
      imageRotated: globalThis.imageAll.binaryRotated[n],
      pageMetricsObj: globalThis.pageMetricsArr[n],
      options: compOptions,
    });

    if (globalThis.debugLog === undefined) globalThis.debugLog = '';
    globalThis.debugLog += res.debugLog;

    globalThis.debugImg[debugLabel][n].push(...res.debugImg);

    combineData(res.page, globalThis.ocrAll.active[n], globalThis.pageMetricsArr[n]);

    if (n === cp.n) displayPage(cp.n);

    canvas.renderAll();
    resetCanvasEventListeners();
  }, { once: true });
}

let newWordInit = true;

let rect; let origX; let
  origY;
function addWordClick() {
  newWordInit = false;
  globalThis.touchScrollMode = false;

  canvas.on('mouse:down', (o) => {
    const pointer = canvas.getPointer(o.e);
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
      transparentCorners: false,
    });
    canvas.add(rect);
    canvas.renderAll();

    canvas.on('mouse:move', (o) => {
      const pointer = canvas.getPointer(o.e);

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
  canvas.on('mouse:up:before', async (o) => {
    resetCanvasEventListeners();
    globalThis.touchScrollMode = true;
    if (newWordInit) { return; }
    newWordInit = true;

    const fillColorHex = '#00ff7b';

    let fillArg;
    if (displayModeElem.value === 'invis') {
      fillArg = 'black';
    } else if (displayModeElem.value === 'ebook') {
      fillArg = 'black';
    } else {
      fillArg = fillColorHex;
    }
    // const rectLeft = rect.left + (rect?.ownMatrixCache?.value[4] || 0);
    // const rectTop = rect.top + (rect?.ownMatrixCache?.value[5] || 0);
    const rectLeft = rect.left + (rect?.group?.left || 0);
    const rectTop = rect.top + (rect?.group?.top || 0);

    const wordText = 'A';
    // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
    let angleAdjXRect = 0;
    let angleAdjYRect = 0;
    let sinAngle = 0;
    let shiftX = 0;
    let shiftY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsArr[cp.n].angle ?? 0) > 0.05) {
      const rotateAngle = globalThis.pageMetricsArr[cp.n].angle || 0;

      const pageDims = globalThis.pageMetricsArr[cp.n].dims;

      sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
      const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

      shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
      shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

      const baselineY = (rectTop + rect.height) - (rect.height) / 3;

      const angleAdjYInt = (1 - cosAngle) * (baselineY - shiftY) - sinAngle * (rectLeft - shiftX);
      const angleAdjXInt = sinAngle * ((baselineY - shiftY) - angleAdjYInt * 0.5);

      angleAdjXRect = angleAdjXInt + shiftX;
      angleAdjYRect = angleAdjYInt + shiftY;
    }

    // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
    const rectTopHOCR = rectTop - angleAdjYRect;
    const rectBottomHOCR = rectTop + rect.height - angleAdjYRect;

    const rectLeftHOCR = rectLeft - angleAdjXRect;
    const rectRightHOCR = rectLeft + rect.width - angleAdjXRect;

    const wordBox = {
      left: rectLeftHOCR, top: rectTopHOCR, right: rectRightHOCR, bottom: rectBottomHOCR,
    };

    const pageObj = new ocr.OcrPage(cp.n, globalThis.ocrAll.active[cp.n].dims);
    // Arbitrary values of font statistics are used since these are replaced later
    const lineObj = new ocr.OcrLine(pageObj, wordBox, [0, 0], 10, null);
    pageObj.lines = [lineObj];
    const wordIDNew = getRandomAlphanum(10);
    const wordObj = new ocr.OcrWord(lineObj, wordText, wordBox, wordIDNew);
    lineObj.words = [wordObj];

    combineData(pageObj, globalThis.ocrAll.active[cp.n], globalThis.pageMetricsArr[cp.n], true, false);

    // Get line word was added to in main data.
    // This will have different metrics from `lineObj` when the line was combined into an existing line.
    const wordObjNew = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDNew);

    // Adjustments are recalculated using the actual bounding box (which is different from the initial one calculated above)
    let angleAdjY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsArr[cp.n].angle ?? 0) > 0.05) {
      const angleAdjXInt = sinAngle * (wordObj.line.bbox.bottom + wordObj.line.baseline[1]);
      const angleAdjYInt = sinAngle * (wordObj.line.bbox.left + angleAdjXInt / 2) * -1;

      angleAdjY = angleAdjYInt + shiftY;
    }

    const fontSize = await calcLineFontSize(wordObjNew.line, fontAll.active);

    const top = wordObjNew.line.bbox.bottom + wordObjNew.line.baseline[1] + angleAdjY;

    const textBackgroundColor = search.search && wordText.includes(search.search) ? '#4278f550' : '';

    const textbox = new ITextWord(wordText, {
      left: rectLeft,
      top,
      word: wordObjNew,
      leftOrig: rectLeft,
      topOrig: top,
      baselineAdj: 0,
      wordSup: false,
      originY: 'bottom',
      fill: fillArg,
      fill_proof: fillColorHex,
      fill_ebook: 'black',
      fontFamily: globalSettings.defaultFont,
      fontStyle: 'normal',
      fontFamilyLookup: globalSettings.defaultFont,
      fontStyleLookup: 'normal',
      fontObj: fontAll.active[globalSettings.defaultFont].normal,
      wordID: wordIDNew,
      textBackgroundColor,
      visualWidth: rect.width,
      visualLeft: rectLeft,
      visualBaseline: rect.bottom,
      defaultFontFamily: true,
      opacity: 1,
      // charSpacing: kerning * 1000 / wordFontSize
      fontSize,
    });

    canvas.remove(rect);
    canvas.add(textbox);
    canvas.renderAll();
    resetCanvasEventListeners();
  });
}

/** @type {Array<PageMetrics>} */
globalThis.pageMetricsArr = [];

// Resets the environment.
async function clearFiles() {
  cp.n = 0;
  globalThis.pageCount = 0;

  globalThis.imageAll = {};
  globalThis.ocrAll.active = [];
  globalThis.layout = [];
  globalThis.fontMetricsObj = null;
  globalThis.pageMetricsArr = [];
  globalThis.convertPageWarn = [];

  if (globalThis.binaryScheduler) {
    const bs = await globalThis.binaryScheduler;
    bs.terminate();
    globalThis.binaryScheduler = null;
  }

  if (globalThis.muPDFScheduler) {
    const ms = await globalThis.muPDFScheduler;
    ms.terminate();
    globalThis.muPDFScheduler = null;
  }

  globalThis.loadCount = 0;

  canvas.clear();
  pageCountElem.textContent = '';
  pageNumElem.value = '';
  downloadFileNameElem.value = '';
  // uploaderElem.value = "";
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
  addLayoutBoxElem.disabled = true;
  deleteLayoutBoxElem.disabled = true;
  setDefaultLayoutElem.disabled = true;
  revertLayoutElem.disabled = true;
  toggleEditButtons(true);
}

clearFiles();

// Import supplemental OCR files (from "Evaluate Accuracy" UI tab)
async function importOCRFilesSupp() {
  // TODO: Add input validation for names (e.g. unique, no illegal symbols, not named "Ground Truth" or other reserved name)
  const ocrName = uploadOCRNameElem.value;
  const hocrFilesAll = uploadOCRFileElem.files;

  if (!hocrFilesAll || hocrFilesAll.length === 0) return;

  displayLabelTextElem.disabled = true;

  const ocrData = await importOCR(Array.from(hocrFilesAll), false);

  const pageCountHOCR = ocrData.hocrRaw.length;

  // Enable confidence threshold input boxes (only used for Tesseract)
  if (!ocrData.abbyyMode && !ocrData.stextMode && confThreshHighElem.disabled) {
    confThreshHighElem.disabled = false;
    confThreshMedElem.disabled = false;
    confThreshHighElem.value = '85';
    confThreshMedElem.value = '75';
  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (globalThis.imageAll.native) {
    if (globalThis.imageAll.native.length !== pageCountHOCR) {
      const warningHTML = `Page mismatch detected. Image data has ${globalThis.imageAll.native.length} pages while OCR data has ${pageCountHOCR} pages.`;
      insertAlertMessage(warningHTML, false);
    }
  }

  globalThis.loadCount = 0;
  globalThis.convertPageActiveProgress = initializeProgress('import-eval-progress-collapse', pageCountHOCR);

  toggleEditButtons(false);

  let format = 'hocr';
  if (ocrData.abbyyMode) format = 'abbyy';
  if (ocrData.stextMode) format = 'stext';

  convertOCRAllBrowser(ocrData.hocrRaw, false, format, ocrName);

  uploadOCRNameElem.value = '';
  uploadOCRFileElem.value = '';
  new bootstrap.Collapse(uploadOCRDataElem, { toggle: true });

  initOCRVersion(ocrName);
  setCurrentHOCR(ocrName);
  displayLabelTextElem.disabled = true;
}

globalThis.pageCount = 0;

async function importFiles(curFiles) {
  // It looks like the "load" event is not always triggered (when the page is refreshed).
  // This is a quick fix to make sure this function always runs.
  // if(!globalThis.runOnLoadRun){
  //   globalThis.runOnLoad();
  // }

  globalThis.runOnLoad();

  if (!curFiles || curFiles.length === 0) return;

  globalThis.state.downloadReady = false;

  globalThis.pageMetricsArr = [];

  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  const imageFilesAll = [];
  const hocrFilesAll = [];
  const pdfFilesAll = [];
  const layoutFilesAll = [];
  const unsupportedFilesAll = [];
  const unsupportedExt = {};
  for (let i = 0; i < curFiles.length; i++) {
    const file = curFiles[i];
    const fileExt = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() || '';

    // TODO: Investigate whether other file formats are supported (without additional changes)
    // Tesseract.js definitely supports more formats, so if the .pdfs we make also support a format,
    // then we should be able to expand the list of supported types without issue.
    // Update: It looks like .bmp does not work.
    if (['png', 'jpeg', 'jpg'].includes(fileExt)) {
      imageFilesAll.push(file);
      // All .gz files are assumed to be OCR data (xml) since all other file types can be compressed already
    } else if (['hocr', 'xml', 'html', 'gz', 'stext'].includes(fileExt)) {
      hocrFilesAll.push(file);
    } else if (['pdf'].includes(fileExt)) {
      pdfFilesAll.push(file);
    } else if (['layout'].includes(fileExt)) {
      layoutFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  if (unsupportedFilesAll.length > 0) {
    const errorText = `Import includes unsupported file types: ${Object.keys(unsupportedExt).join(', ')}`;
    insertAlertMessage(errorText);
  }

  globalThis.inputDataModes.pdfMode = pdfFilesAll.length === 1;
  globalThis.inputDataModes.imageMode = !!(imageFilesAll.length > 0 && !globalThis.inputDataModes.pdfMode);

  const xmlModeImport = hocrFilesAll.length > 0;

  // Extract text from PDF document
  // Only enabled if (1) user selects this option, (2) user uploads a PDF, and (3) user does not upload XML data.
  globalThis.inputDataModes.extractTextMode = document.getElementById('extractTextCheckbox').checked && globalThis.inputDataModes.pdfMode && !xmlModeImport;

  addLayoutBoxElem.disabled = false;
  deleteLayoutBoxElem.disabled = false;
  setDefaultLayoutElem.disabled = false;
  revertLayoutElem.disabled = false;

  if (globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode) {
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
    if (globalThis.inputDataModes.imageMode) {
      const option = document.createElement('option');
      option.text = 'Native';
      option.value = 'color';
      option.selected = true;
      colorModeElem.add(option);
    } else {
      let option = document.createElement('option');
      option.text = 'Color';
      option.value = 'color';
      colorModeElem.add(option);
      option = document.createElement('option');
      option.text = 'Grayscale';
      option.value = 'gray';
      option.selected = true;
      colorModeElem.add(option);
    }
    const option = document.createElement('option');
    option.text = 'Binary';
    option.value = 'binary';
    colorModeElem.add(option);

    // For PDF inputs, enable "Add Text to Import PDF" option
    if (globalThis.inputDataModes.pdfMode) {
      addOverlayCheckboxElem.checked = true;
      addOverlayCheckboxElem.disabled = false;
    } else {
      addOverlayCheckboxElem.checked = false;
      addOverlayCheckboxElem.disabled = true;
    }
  }

  imageFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));
  hocrFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, '');
  downloadFileName += '.pdf';
  downloadFileNameElem.value = downloadFileName;

  let pageCount; let pageCountImage; let
    stextModeExtract;
  let abbyyMode = false;
  let pageDPI;

  if (globalThis.inputDataModes.pdfMode) {
    globalThis.pdfFile = pdfFilesAll[0];
    globalThis.inputFileNames = [globalThis.pdfFile.name];

    // Initialize scheduler
    await initSchedulerIfNeeded('muPDFScheduler');

    const ms = await globalThis.muPDFScheduler;

    pageCountImage = await ms.addJob('countPages', []);

    // If no XML data is provided, page sizes are calculated using muPDF alone
    if (!xmlModeImport) {
      // Confirm that 300 dpi leads to a reasonably sized image and lower dpi if not.
      const pageDims1 = (await ms.addJob('pageSizes', [300])).slice(1);

      // For reasons that are unclear, a small number of pages have been rendered into massive files
      // so a hard-cap on resolution must be imposed.
      const pageWidth1 = pageDims1.map((x) => x[0]);
      pageDPI = pageWidth1.map((x) => 300 * 2000 / Math.max(x, 2000));

      console.log(`DPI ${String(pageDPI)}`);

      // In addition to capping the resolution, also switch the width/height
      const pageDims = pageDims1.map((x, i) => [Math.round(x[1] * pageDPI[i] / 300), Math.round(x[0] * pageDPI[i] / 300)]);

      for (let i = 0; i < pageDims.length; i++) {
        globalThis.pageMetricsArr[i] = new PageMetrics({ height: pageDims[i][0], width: pageDims[i][1] });
      }
    }
  } else if (globalThis.inputDataModes.imageMode) {
    globalThis.inputFileNames = imageFilesAll.map((x) => x.name);
    pageCountImage = imageFilesAll.length;
  }

  let existingLayout = false;
  const oemName = 'User Upload';
  let stextMode;

  if (xmlModeImport || globalThis.inputDataModes.extractTextMode) {
    document.getElementById('combineModeOptions')?.setAttribute('style', '');

    initOCRVersion(oemName);
    setCurrentHOCR(oemName);

    displayLabelTextElem.innerHTML = oemName;

    let stextModeImport;
    if (xmlModeImport) {
      const ocrData = await importOCR(Array.from(hocrFilesAll), true);

      globalThis.hocrCurrentRaw = ocrData.hocrRaw;
      // Subset OCR data to avoid uncaught error that occurs when there are more pages of OCR data than image data.
      // While this should be rare, it appears to be fairly common with Archive.org documents.
      // TODO: Add warning message displayed to user for this.
      if (globalThis.hocrCurrentRaw.length > pageCountImage) {
        console.log(`Identified ${globalThis.hocrCurrentRaw.length} pages of OCR data but ${pageCountImage} pages of image/pdf data. Only first ${pageCountImage} pages will be used.`);
        globalThis.hocrCurrentRaw = globalThis.hocrCurrentRaw.slice(0, pageCountImage);
      }

      // Restore font metrics and optimize font from previous session (if applicable)
      if (ocrData.fontMetricsObj && Object.keys(ocrData.fontMetricsObj).length > 0) {
        globalThis.fontMetricsObj = ocrData.fontMetricsObj;
        setDefaultFontAuto(ocrData.fontMetricsObj);
        fontAll.opt = await optimizeFontContainerAll(fontAll.raw, globalThis.fontMetricsObj);
        optimizeFontElem.disabled = false;
        optimizeFontElem.checked = true;
        await enableDisableFontOpt(true);
      }

      // Restore layout data from previous session (if applicable)
      if (ocrData.layoutObj) {
        globalThis.layout = ocrData.layoutObj;
        existingLayout = true;
      }

      stextModeImport = ocrData.stextMode;
      abbyyMode = ocrData.abbyyMode;
    } else {
      const ms = await globalThis.muPDFScheduler;
      stextModeExtract = true;
      globalThis.hocrCurrentRaw = Array(pageCountImage);
      for (let i = 0; i < pageCountImage; i++) {
        globalThis.hocrCurrentRaw[i] = await ms.addJob('pageTextXML', [i + 1, pageDPI[i]]);
      }
    }

    // stext may be imported or extracted from an input PDF
    stextMode = stextModeExtract || stextModeImport;

    // Enable confidence threshold input boxes (only used for Tesseract)
    if (!abbyyMode && !stextMode) {
      confThreshHighElem.disabled = false;
      confThreshMedElem.disabled = false;
      confThreshHighElem.value = '85';
      confThreshMedElem.value = '75';
    }
  }

  const pageCountHOCR = globalThis.hocrCurrentRaw?.length;

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (xmlModeImport && (globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode)) {
    if (pageCountImage !== pageCountHOCR) {
      const warningHTML = `Page mismatch detected. Image data has ${pageCountImage} pages while OCR data has ${pageCountHOCR} pages.`;
      insertAlertMessage(warningHTML, false);
    }
  }

  globalThis.pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.hocrCurrentRaw = globalThis.hocrCurrentRaw || Array(pageCount);
  globalThis.defaultLayout = {};

  if (!existingLayout) {
    globalThis.layout = Array(globalThis.pageCount);
    for (let i = 0; i < globalThis.layout.length; i++) {
      globalThis.layout[i] = { default: true, boxes: {} };
    }
  }

  // Global object that contains arrays with page images or related properties.
  globalThis.imageAll = {
    // Unedited images uploaded by user (unused when user provides a PDF).
    nativeSrc: Array(globalThis.pageCount),
    // Native images.  When the user uploads images directly, this contains whatever they uploaded.
    // When a user uploads a pdf, this will contain the images rendered by muPDF (either grayscale or color depending on setting).
    native: Array(globalThis.pageCount),
    // Binarized image.
    binary: Array(globalThis.pageCount),
    // Whether the native image was re-rendered with rotation applied.
    nativeRotated: Array(globalThis.pageCount),
    // Whether the binarized image was re-rendered with rotation applied.
    binaryRotated: Array(globalThis.pageCount),
    // [For pdf uploads only] Whether the "native" image was rendered in color or grayscale.
    nativeColor: Array(globalThis.pageCount),
  };

  globalThis.inputDataModes.xmlMode = new Array(globalThis.pageCount);
  if (xmlModeImport || globalThis.inputDataModes.extractTextMode) {
    globalThis.inputDataModes.xmlMode.fill(true);
  } else {
    globalThis.inputDataModes.xmlMode.fill(false);
  }

  if (globalThis.inputDataModes.pdfMode && !xmlModeImport) {
    // Render first handful of pages for pdfs so the interface starts off responsive
    // In the case of OCR data, this step is triggered elsewhere after all the data loads
    displayPage(0);
    renderPDFImageCache([...Array(Math.min(globalThis.pageCount, 5)).keys()]);
  }

  globalThis.loadCount = 0;

  // All pages of OCR data and individual images (.png or .jpeg) contribute to the import loading bar.
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  let progressMax = 0;
  if (globalThis.inputDataModes.imageMode) progressMax += globalThis.pageCount;
  if (xmlModeImport) progressMax += globalThis.pageCount;

  // Loading bars are necessary for automated testing as the tests wait for the loading bar to fill up.
  // Therefore, a dummy loading bar with a max of 1 is created even when progress is not meaningfully tracked.
  let dummyLoadingBar = false;
  if (progressMax === 0) {
    dummyLoadingBar = true;
    progressMax = 1;
  }

  globalThis.convertPageActiveProgress = initializeProgress('import-progress-collapse', progressMax, 0, false, true);

  for (let i = 0; i < globalThis.pageCount; i++) {
    // Currently, images are loaded once at a time.
    // While this is not optimal for performance, images are required for comparison functions,
    // so switching to running async would require either (1) waiting for enough images to load before before continuing to the next step
    // or (2) switching imageAll["nativeSrc"], as a whole, to store promises that can be waited for.
    if (globalThis.inputDataModes.imageMode) {
      globalThis.imageAll.nativeSrc[i] = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = function () {
          resolve(reader.result);
        };

        reader.onerror = function (error) {
          reject(error);
        };

        reader.readAsDataURL(imageFilesAll[i]);
      });

      // globalThis.imageAll["nativeSrc"][i] = await imageFilesAll[i].arrayBuffer();

      // const src = await imageFilesAll[i].arrayBuffer();
      // const blob = new Blob([src]);
      // globalThis.imageAll["nativeSrc"][i] = URL.createObjectURL(blob);

      await renderPDFImageCache([i]);
      const imgElem = await globalThis.imageAll.native[i];
      globalThis.pageMetricsArr[i] = new PageMetrics({ height: imgElem.height, width: imgElem.width });
      globalThis.convertPageActiveProgress.increment();

      if (i === 0) displayPage(0);

      // Enable downloads now for image imports if no HOCR data exists
      // TODO: PDF downloads are currently broken when images but not OCR text exists
      if (!xmlModeImport && globalThis.convertPageActiveProgress.value === globalThis.convertPageActiveProgress.maxValue) {
        downloadElem.disabled = false;
        globalThis.state.downloadReady = true;
      }
    }
  }

  if (xmlModeImport || globalThis.inputDataModes.extractTextMode) {
    toggleEditButtons(false);
    let format = 'hocr';
    if (abbyyMode) format = 'abbyy';
    if (stextMode) format = 'stext';

    // Process HOCR using web worker, reading from file first if that has not been done already
    convertOCRAllBrowser(globalThis.hocrCurrentRaw, true, format, oemName).then(async () => {
      if (layoutFilesAll.length > 0) await readLayoutFile(layoutFilesAll[0]);
      await checkCharWarn(globalThis.convertPageWarn, insertAlertMessage);
      await calculateOverallPageMetrics();
      await runFontOptimizationBrowser(globalThis.ocrAll.active);
      downloadElem.disabled = false;
      globalThis.state.downloadReady = true;
    });
  } else if (layoutFilesAll.length > 0) {
    await readLayoutFile(layoutFilesAll[0]);
  }

  if (dummyLoadingBar) globalThis.convertPageActiveProgress.increment();

  // Enable downloads now for pdf imports if no HOCR data exists
  if (globalThis.inputDataModes.pdfMode && !xmlModeImport) {
    downloadElem.disabled = false;
    globalThis.state.downloadReady = true;
  }

  pageNumElem.value = '1';
  pageCountElem.textContent = String(globalThis.pageCount);
}

/**
 * Function to read layout files.
 * Must be run after dimensions exist in `pageMetricsArr`.
 *
 * @param {File} file
 */
async function readLayoutFile(file) {
  const layoutStr = await readTextFile(file);
  try {
    const layoutObj = JSON.parse(layoutStr);

    // Layout files may optionally provide an attribute named `system` which contains `length` and `height` used for the full page.
    // These are used to normalize the coorinates, and are necessary when the layout analysis uses a different coordinate
    // system compared to the coordinates used here.
    for (let i = 0; i < layoutObj.length; i++) {
      const layoutObjIBoxes = layoutObj[i]?.boxes;
      if (!layoutObjIBoxes) continue;
      for (const [key, value] of Object.entries(layoutObjIBoxes)) {
        const width = value?.system?.width;
        const height = value?.system?.height;
        if (width && height) {
          value.coords[0] *= (globalThis.pageMetricsArr[i].dims.width / width);
          value.coords[2] *= (globalThis.pageMetricsArr[i].dims.width / width);

          value.coords[1] *= (globalThis.pageMetricsArr[i].dims.height / height);
          value.coords[3] *= (globalThis.pageMetricsArr[i].dims.height / height);
        }
      }
    }

    globalThis.layout = layoutObj;
  } catch (e) {
    console.log('Unable to parse contents of layout file.');
    console.log(e);
  }
}

async function initMuPDFScheduler(file, workers = 3) {
  globalThis.muPDFScheduler = await Tesseract.createScheduler();
  globalThis.muPDFScheduler.pngRenderCount = 0;
  globalThis.muPDFScheduler.workers = new Array(workers);
  for (let i = 0; i < workers; i++) {
    const w = await initMuPDFWorker();
    if (file) {
      const fileData = await file.arrayBuffer();
      const pdfDoc = await w.openDocument(fileData, file.name);
      w.pdfDoc = pdfDoc;
    }

    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    globalThis.muPDFScheduler.addWorker(w);
    globalThis.muPDFScheduler.workers[i] = w;
  }
}

/**
 * Renders images and stores them in cache array (or returns early if the requested image already exists).
 * Contains 2 distinct image rendering steps:
 * 1. Pages are rendered from .pdf to .png [either color or grayscale] using muPDF
 * 2. Existing .png images are processed (currently rotation and/or thresholding) using Tesseract/Leptonica
 *
 * @async
 * @export
 * @param {number[]} pagesArr - Array of page numbers to render
 * @param {boolean|null} [rotate=null] - Whether to apply rotation to the images (true/false), or no preference (null).
 * @param {Object|null} [progress=null] - A progress tracking object, which should have an `increment` method.
 * @param {string|null} [colorMode=null] - Color mode ("color", "gray", or "binary"). If left `null`, defaults to option selected in the UI.
 * @returns {Promise<void>} A promise that resolves when all the images have been processed.
 */
export async function renderPDFImageCache(pagesArr, rotate = null, progress = null, colorMode = null) {
  colorMode = colorMode || colorModeElem.value;
  const colorName = colorMode === 'binary' ? 'binary' : 'native';

  await Promise.all(pagesArr.map((n) => {
    if (!globalThis.imageAll.native || n < 0 || n >= globalThis.imageAll.native.length) return;

    if (globalThis.inputDataModes.imageMode) {
      // Load image if either (1) it has never been loaded in the first place, or
      // (2) the current image is rotated but a non-rotated image is requested, revert to the original (user-uploaded) image.
      if ((!globalThis.imageAll.native[n] && globalThis.imageAll.nativeSrc[n]) || (rotate === false && globalThis.imageAll.nativeRotated[n] === true)) {
        globalThis.imageAll.nativeRotated[n] = false;
        globalThis.imageAll.native[n] = new Promise(async (resolve, reject) => {
          const image = document.createElement('img');
          await loadImage(globalThis.imageAll.nativeSrc[n], image);
          resolve(image);
        });
      }
    }

    // In pdfMode, determine whether an original/unedited version of the image needs to be obtained.
    // This can happen for 3 reasons:
    // 1. Page has not yet been rendered
    // 2. Page was previously rendered, but in different colorMode (gray vs. color)
    // 3. Page was overwritten by rotated version, but a non-rotated version is needed
    const renderNativePDF = !!(globalThis.inputDataModes.pdfMode && (!globalThis.imageAll.native[n]
      || (colorMode !== 'binary' && globalThis.imageAll.nativeColor[n] !== colorMode)
      || rotate === false && globalThis.imageAll.nativeRotated[n] === true));

    // In pdfMode the page is re-rendered from the pdf
    if (renderNativePDF) {
      globalThis.imageAll.nativeColor[n] = colorModeElem.value;
      globalThis.imageAll.nativeRotated[n] = false;
      globalThis.imageAll.native[n] = new Promise(async (resolve, reject) => {
        // Initialize scheduler if one does not already exist
        // This happens when the original scheduler is killed after all pages are rendered,
        // but then the user changes from color to grayscale (or vice versa).
        await initSchedulerIfNeeded('muPDFScheduler');

        const ms = await globalThis.muPDFScheduler;

        // Render to 300 dpi by default
        let dpi = 300;

        const imgWidthXml = globalThis.pageMetricsArr[n].dims.width;
        const imgWidthPdf = await ms.addJob('pageWidth', [n + 1, 300]);
        if (imgWidthPdf !== imgWidthXml) {
          dpi = 300 * (imgWidthXml / imgWidthPdf);
        }

        const useColor = colorMode === 'color';

        const skipText = document.getElementById('omitNativeTextCheckbox').checked;

        const res = await ms.addJob('drawPageAsPNG', [n + 1, dpi, useColor, skipText]);

        const image = document.createElement('img');
        await loadImage(res, image);

        resolve(image);
      });
    }

    // Whether binarized image needs to be rendered
    const renderBinary = colorMode === 'binary' && !globalThis.imageAll.binary[n];

    // // Whether native image needs to be rendered
    // const renderNativeImage = colorMode == "gray" && globalThis.imageAll["nativeColor"][n] == "color";

    // Whether binarized image needs to be rotated (or re-rendered without rotation)
    const rotateBinary = colorMode === 'binary'
      && (rotate === true && !globalThis.imageAll.binaryRotated[n] && Math.abs(globalThis.pageMetricsArr[n].angle) > 0.05 || rotate === false && globalThis.imageAll.binaryRotated[n] === true);

    // Whether native image needs to be rotated
    const rotateNative = colorName === 'native' && (rotate === true && !globalThis.imageAll.nativeRotated[n] && Math.abs(globalThis.pageMetricsArr[n].angle) > 0.05);

    // If nothing needs to be done, return early.
    if (!(renderBinary || rotateBinary || rotateNative)) {
      if (progress) progress.increment();
      return;
    }

    // If no preference is specified for rotation, default to true
    const angleArg = rotate !== false ? globalThis.pageMetricsArr[n].angle * (Math.PI / 180) * -1 || 0 : 0;

    const saveBinaryImageArg = true;
    const saveColorImageArg = rotateNative;

    const resPromise = (async () => {
      // Wait for non-rotated version before replacing with promise
      const inputImage = await Promise.resolve(globalThis.imageAll.native[n]);

      return globalThis.gs.recognize({
        image: inputImage.src,
        options: { rotateRadians: angleArg },
        output: {
          imageBinary: saveBinaryImageArg, imageColor: saveColorImageArg, debug: true, text: false, hocr: false, tsv: false, blocks: false,
        },
      });
    })();

    // Update progress bar after Tesseract is finished running.
    if (progress) {
      resPromise.then(() => {
        progress.increment();
      });
    }

    if (saveColorImageArg) {
      globalThis.imageAll.nativeRotated[n] = Boolean(angleArg);
      globalThis.imageAll.native[n] = resPromise.then(async (res) => {
        const image = document.createElement('img');
        await loadImage(res.imageColor, image);
        return (image);
      });
    }

    if (saveBinaryImageArg) {
      globalThis.imageAll.binaryRotated[n] = Boolean(angleArg);
      globalThis.imageAll.binary[n] = resPromise.then(async (res) => {
        const image = document.createElement('img');
        await loadImage(res.imageBinary, image);
        return (image);
      });
    }
  }));
}

/**
 * Global object containing information regarding the application's state
 *  (E.g. is a page currently rendering, is recognition currently running, etc.)
 * @typedef state
 * @type {object}
 * @property {Promise<boolean>} pageRendering
 * @property {number} renderIt
 * @property {any} promiseResolve
 * @property {Promise<boolean>} recognizeAllPromise
 * @property {boolean} downloadReady - whether download feature can be enabled yet
 * @property {dims} imgDims -
 * @property {number} canvasDimsN - Page number that the current canvas dimensions are based off of.
 */
/** @type {state} */
globalThis.state = {
  pageRendering: Promise.resolve(true),
  renderIt: 0,
  promiseResolve: undefined,
  recognizeAllPromise: Promise.resolve(true),
  downloadReady: false,
  imgDims: { width: 500, height: 500 },
  canvasDimsN: -1,
};

/**
 *
 * @param {dims} imgDims - Dimensions of image
 * @param {boolean} updatePosition - Whether to reset the position/zoom of the page
 */
const setCanvasWidthHeightZoom = (imgDims, updatePosition = true) => {
  const totalHeight = showConflictsElem.checked ? Math.round(document.documentElement.clientHeight * 0.7) - 1 : document.documentElement.clientHeight;

  // Re-set width/height, in case the size of the window changed since originally set.
  canvas.setHeight(totalHeight);
  canvas.setWidth(document.documentElement.clientWidth);

  // TODO: Make this more precise.
  if (updatePosition) {
    const interfaceHeight = 100;
    const bottomMarginHeight = 50;
    const targetHeight = totalHeight - interfaceHeight - bottomMarginHeight;

    const zoom = targetHeight / imgDims.height;

    canvas.viewportTransform = [zoom, 0, 0, zoom, ((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2), interfaceHeight];
  }

  if (showConflictsElem.checked) {
    const debugHeight = Math.round(document.documentElement.clientHeight * 0.3);

    const debugCanvasParentDivElem = document.getElementById('debugCanvasParentDiv');
    debugCanvasParentDivElem?.setAttribute('style', `width:${document.documentElement.clientWidth}px;height:${debugHeight}px;overflow-y:scroll`);
  }
};

// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n, loadXML = true) {
  renderPDFImageCache([n]);

  let ocrData = globalThis.ocrAll.active?.[n];

  // Return early if there is not enough data to render a page yet
  // (1) No data has been imported
  const noInput = !globalThis.inputDataModes.xmlMode[n] && !(globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode);
  // (2) XML data should exist but does not (yet)
  const xmlMissing = globalThis.inputDataModes.xmlMode[n]
    && (ocrData === undefined || ocrData === null || globalThis.pageMetricsArr[n].dims === undefined);
  // (3) Image data should exist but does not (yet)
  const imageMissing = globalThis.inputDataModes.imageMode && (!globalThis.imageAll.native || globalThis.imageAll.native.length === 0 || globalThis.imageAll.native[n] == null);
  // (4) PDF data should exist but does not (yet)
  const pdfMissing = globalThis.inputDataModes.pdfMode
    && (!globalThis.imageAll.native || globalThis.imageAll.native.length === 0 || globalThis.imageAll.native[n] == null || globalThis.pageMetricsArr[n]?.dims === undefined);

  if (noInput || xmlMissing || imageMissing || pdfMissing) {
    console.log('Exiting renderPageQueue early');
    return;
  }

  const renderItI = globalThis.state.renderIt + 1;
  globalThis.state.renderIt = renderItI;

  // If a page is already being rendered, wait for it to complete
  await globalThis.state.pageRendering;
  // If another page has been requested already, return early
  if (globalThis.state.renderIt !== renderItI) return;

  globalThis.state.pageRendering = new Promise((resolve, reject) => {
    globalThis.state.promiseResolve = resolve;
  });

  // Parse the relevant XML (relevant for both Canvas and PDF)
  if (loadXML && globalThis.inputDataModes.xmlMode[n] && ocrData) {
    // Compare selected text to ground truth in eval mode
    if (displayModeElem.value === 'eval') {
      console.time();
      await compareGroundTruthClick(n);
      // ocrData must be re-assigned after comparing to ground truth or it will not update.
      ocrData = globalThis.ocrAll.active?.[n];
      console.timeEnd();
    }
  }

  // Get image dimensions from OCR data if present; otherwise get dimensions of images directly
  let imgDims;
  if (globalThis.inputDataModes.xmlMode[n] || globalThis.inputDataModes.pdfMode) {
    imgDims = globalThis.pageMetricsArr[n].dims;
  } else {
    const backgroundImage = await globalThis.imageAll.native[n];
    imgDims = { width: backgroundImage.width, height: backgroundImage.height };
  }
  globalThis.state.imgDims = imgDims;

  // Calculate options for background image and overlay
  if (globalThis.inputDataModes.xmlMode[n]) {
    cp.backgroundOpts.originX = 'center';
    cp.backgroundOpts.originY = 'center';

    cp.backgroundOpts.left = imgDims.width * 0.5;
    cp.backgroundOpts.top = imgDims.height * 0.5;

    // let marginPx = Math.round(imgDims.width * leftGlobal);
    if (autoRotateCheckboxElem.checked) {
      cp.backgroundOpts.angle = globalThis.pageMetricsArr[n].angle * -1 ?? 0;
    } else {
      cp.backgroundOpts.angle = 0;
    }
  } else {
    cp.backgroundOpts.originX = 'left';
    cp.backgroundOpts.originY = 'top';

    cp.backgroundOpts.left = 0;
    cp.backgroundOpts.top = 0;
  }

  let renderNum;
  // Clear canvas if objects (anything but the background) exists
  if (canvas.getObjects().length) {
    canvas.clear();
    resetCanvasEventListeners();
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (globalThis.state.canvasDimsN !== n) {
    setCanvasWidthHeightZoom(imgDims);

    globalThis.state.canvasDimsN = n;
  }

  cp.renderStatus = 0;

  // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
  // (whether by quickly changing pages or on the same page).
  // TODO: Find a better solution.
  cp.renderNum += 1;
  renderNum = cp.renderNum;

  const backgroundImage = colorModeElem.value === 'binary' ? await Promise.resolve(globalThis.imageAll.binary[n]) : await Promise.resolve(globalThis.imageAll.native[n]);
  cp.backgroundImage = new fabric.Image(backgroundImage, { objectCaching: false });
  if (cp.n === n && cp.renderNum === renderNum) {
    cp.renderStatus += 1;
    selectDisplayMode(displayModeElem.value);
  } else {
    globalThis.state.promiseResolve();
    return;
  }

  // The active OCR version may have changed, so this needs to be re-checked.
  if (cp.n === n && globalThis.inputDataModes.xmlMode[n]) {
    await renderPage(canvas, ocrData, globalSettings.defaultFont, imgDims, globalThis.pageMetricsArr[n].angle, 0, fontAll);
    if (cp.n === n && cp.renderNum === renderNum) {
      cp.renderStatus += 1;
      await selectDisplayMode(displayModeElem.value);
    }
  }

  globalThis.state.promiseResolve();
}

const cacheMode = true;
const cachePages = 3;

let working = false;

// Function for navigating UI to arbitrary page.  Invoked by all UI elements that change page.
export async function displayPage(n) {
  // Return early if (1) page does not exist or (2) another page is actively being rendered.
  if (isNaN(n) || n < 0 || n > (globalThis.pageCount - 1) || working) {
    console.log('Exiting from displayPage early.');
    // Reset the value of pageNumElem (number in UI) to match the internal value of the page
    pageNumElem.value = (cp.n + 1).toString();
    return;
  }

  // The following is a quick fix for a bug, there may be a better way to do this.
  // Without this block of code, if the user is editing a word and then changes the page,
  // the changes are applied to the word with the same ID on the next page.
  // Simply running `canvas.discardActiveObject()` does not fix, as that function
  // does not wait for all code triggered by events to finish running.
  // Therefore, if the page is changed while an object is selected, we deselect all objects
  // and then wait for an arbitrary amount of time for any event-related code to run.
  if (canvas.getActiveObject()) {
    console.log('Deselecting active object before changing pages.');
    canvas.discardActiveObject();
    await sleep(10);
  }

  working = true;

  if (globalThis.inputDataModes.xmlMode[cp.n]) {
    // TODO: This is currently run whenever the page is changed.
    // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
    updateFindStats();
  }

  matchCurrentElem.textContent = calcMatchNumber(n);

  cp.n = n;
  pageNumElem.value = (cp.n + 1).toString();

  await renderPageQueue(cp.n);

  if (showConflictsElem.checked) showDebugImages();

  // Render background images 1 page ahead and behind
  const nMax = globalThis.imageAll.nativeSrc.length;
  if ((globalThis.inputDataModes.pdfMode || globalThis.inputDataModes.imageMode) && cacheMode) {
    let cacheArr = [...Array(cachePages).keys()].map((i) => i + cp.n + 1).filter((x) => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
    cacheArr = [...Array(cachePages).keys()].map((i) => i * -1 + cp.n - 1).filter((x) => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
  }

  working = false;
}

globalThis.displayPage = displayPage;

async function optimizeFontClick(value) {
  await enableDisableFontOpt(value);

  renderPageQueue(cp.n);
}

window.muPDFSchedulerInit = async function () {
  await initMuPDFScheduler(globalThis.pdfFile, 3);
  if (globalThis.imageAll.native) {
    // TODO: Fix to work with promises
    window.muPDFScheduler.pngRenderCount = 0;
  } else {
    window.muPDFScheduler.pngRenderCount = 0;
  }
};

// Function that is invoked before a scheduler is used.
// If the scheduler already exists, resolves immediately.
// If scheduler is being created already, return promise that resolves when that is done.
// If scheduler does not exist and is not being created, initialize and return promise that resolves when done.
async function initSchedulerIfNeeded(x) {
  if (!window[x]) {
    window[x] = window[`${x}Init`]().catch((x) => console.log(x));
  }
  return (window[x]);
}

/** @type {?GeneralScheduler} */
globalThis.gs = null;

export async function initGeneralScheduler() {
  // Determine number of workers to use.
  // This is the minimum of:
  //      1. The number of cores
  //      3. 6 (browser-imposed memory limits make going higher than 6 problematic, even on hardware that could support it)
  const workerN = Math.min(Math.round((globalThis.navigator.hardwareConcurrency || 8) / 2), 6);
  console.log(`Using ${workerN} workers.`);

  globalThis.generalScheduler = await Tesseract.createScheduler();
  globalThis.generalScheduler.workers = new Array(workerN);

  let resReady;
  globalThis.generalScheduler.ready = new Promise((resolve, reject) => {
    resReady = resolve;
  });

  const addGeneralWorker = async (i) => {
    const w = await initGeneralWorker();
    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    globalThis.generalScheduler.addWorker(w);
    globalThis.generalScheduler.workers[i] = w;
  };

  // Wait for the first worker to load.
  // This allows the files to be loaded only once, as they will be in the cache for workers 2+.
  await addGeneralWorker(0);

  const resArr = Array.from({ length: workerN }, (v, k) => k).slice(1).map((i) => addGeneralWorker(i));

  await Promise.all(resArr);

  globalThis.gs = new GeneralScheduler(globalThis.generalScheduler);

  resReady(true);
}

initGeneralScheduler();

/**
 * Runs font optimization and validation. Sets `fontAll` defaults to best fonts,
 * and returns `true` if sans or serif could be improved through optimization.
 *
 * @param {Array<OcrPage>} ocrArr - Array of OCR pages to use for font optimization.
 *
 * This function should still be run, even if no character-level OCR data is present,
 * as it is responsible for picking the correct default sans/serif font.
 * The only case where this function does nothing is when (1) there is no character-level OCR data
 * and (2) no images are provided to compare against.
 */
async function runFontOptimizationBrowser(ocrArr) {
  const optImproved = await runFontOptimization(ocrArr, globalThis.imageAll.binary, globalThis.imageAll.binaryRotated);
  if (optImproved) {
    optimizeFontElem.disabled = false;
    optimizeFontElem.checked = true;
  }
  renderPageQueue(cp.n);
}

/**
 * This function calculates a global left margin, which is not currently used.
 * Leaving the code for now in case this is useful in the future.
 */
export function calculateOverallPageMetrics() {
  // It is possible for image resolution to vary page-to-page, so the left margin must be calculated
  // as a percent to remain visually identical between pages.
  const leftAllPer = new Array(globalThis.pageMetricsArr.length);
  for (let i = 0; i < globalThis.pageMetricsArr.length; i++) {
    leftAllPer[i] = globalThis.pageMetricsArr[i].left / globalThis.pageMetricsArr[i].dims.width;
  }
  leftGlobal = quantile(leftAllPer, 0.5);
}

async function handleDownload() {
  downloadElem.removeEventListener('click', handleDownload);
  downloadElem.disabled = true;

  updatePdfPagesLabel();

  const downloadType = formatLabelTextElem?.textContent?.toLowerCase();

  // If recognition is currently running, wait for it to finish.
  await globalThis.state.recognizeAllPromise;

  const minValue = parseInt(pdfPageMinElem.value) - 1;
  const maxValue = parseInt(pdfPageMaxElem.value) - 1;
  const pagesArr = [...Array(maxValue - minValue + 1).keys()].map((i) => i + minValue);

  /** @type {Array<OcrPage>} */
  let hocrDownload = [];

  if (downloadType !== 'hocr' && downloadType !== 'xlsx' && enableLayoutElem.checked) {
    // Reorder HOCR elements according to layout boxes
    for (let i = minValue; i <= maxValue; i++) {
      hocrDownload.push(reorderHOCR(globalThis.ocrAll.active[i], globalThis.layout[i]));
    }
  } else {
    hocrDownload = globalThis.ocrAll.active;
  }

  if (downloadType === 'pdf') {
    const standardizeSizeMode = standardizeCheckboxElem.checked;
    const dimsLimit = { width: -1, height: -1 };
    if (standardizeSizeMode) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit.height = Math.max(dimsLimit.height, globalThis.pageMetricsArr[i].dims.height);
        dimsLimit.width = Math.max(dimsLimit.width, globalThis.pageMetricsArr[i].dims.width);
      }
    }

    const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.pdf`;
    let pdfBlob;

    const confThreshHigh = parseInt(confThreshHighElem.value) || 85;
    const confThreshMed = parseInt(confThreshMedElem.value) || 75;

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (displayModeElem.value !== 'ebook') {
      const steps = addOverlayCheckboxElem.checked ? 2 : 3;
      const downloadProgress = initializeProgress('generate-download-progress-collapse', (maxValue + 1) * steps);
      await sleep(0);

      const insertInputPDF = globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked;

      const rotateBackground = !insertInputPDF && autoRotateCheckboxElem.checked;

      const rotateText = !rotateBackground;

      // Currently makes a pdf with all pages, regardless of what the user requests
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images.
      // The `maxpage` argument must be set manually to `globalThis.pageCount-1`, as this avoids an error in the case where there is no OCR data (`hocrDownload` has length 0).
      // In all other cases, this should be equivalent to using the default argument of `-1` (which results in `hocrDownload.length` being used).
      const pdfStr = await hocrToPDF(hocrDownload, fontAll, 0, globalThis.pageCount - 1, displayModeElem.value, rotateText, rotateBackground,
        { width: -1, height: -1 }, downloadProgress, confThreshHigh, confThreshMed);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      await initSchedulerIfNeeded('muPDFScheduler');

      // const pdfOverlayBlob = new Blob([pdfStr], { type: 'application/octet-stream' });
      const w = globalThis.muPDFScheduler.workers[0];
      // const fileData = await pdfOverlayBlob.arrayBuffer();
      // The file name is only used to detect the ".pdf" extension
      const pdfOverlay = await w.openDocument(pdfEnc.buffer, 'document.pdf');

      let content;

      // If the input document is a .pdf and "Add Text to Import PDF" option is enabled, we insert the text into that pdf (rather than making a new one from scratch)
      if (globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked) {
        content = await w.overlayText([pdfOverlay, minValue, maxValue, dimsLimit.width, dimsLimit.height]);

        // Unfortunately there currently is not a real way to track progress using the w.overlayText function, as pages are incremented using C++ (webassembly).
        for (let i = minValue; i < maxValue + 1; i++) {
          downloadProgress.increment();
        }

      // If the input is a series of images, those images need to be inserted into a new pdf
      } else if (globalThis.inputDataModes.pdfMode || globalThis.inputDataModes.imageMode) {
        await renderPDFImageCache(pagesArr, autoRotateCheckboxElem.checked, downloadProgress);
        const imgArr1 = colorModeElem.value === 'binary' ? await Promise.all(globalThis.imageAll.binary) : await Promise.all(globalThis.imageAll.native);
        const imgArr = imgArr1.map((x) => x.src);
        await w.overlayTextImageStart([]);
        for (let i = minValue; i < maxValue + 1; i++) {
          await w.overlayTextImageAddPage([pdfOverlay, imgArr[i], i, dimsLimit.width, dimsLimit.height]);
          downloadProgress.increment();
        }
        content = await w.overlayTextImageEnd([]);
      // Otherwise, there is only OCR data and not image data.
      } else {
        content = await w.write([pdfOverlay, minValue, maxValue, dimsLimit.width, dimsLimit.height]);

        // Fill up progress bar to 100%
        for (let i = downloadProgress.value; i < downloadProgress.maxValue; i++) downloadProgress.increment();
      }

      pdfBlob = new Blob([content], { type: 'application/octet-stream' });
    } else {
      const downloadProgress = initializeProgress('generate-download-progress-collapse', maxValue + 1);
      await sleep(0);

      const pdfStr = await hocrToPDF(hocrDownload, fontAll, minValue, maxValue, displayModeElem.value, false, true, dimsLimit, downloadProgress, confThreshHigh, confThreshMed);

      // The PDF is still run through muPDF, even thought in eBook mode no background layer is added.
      // This is because muPDF cleans up the PDF we made in the previous step, including:
      // (1) Removing fonts that are not used (significantly reduces file size)
      // (2) Compresses PDF (significantly reduces file size)
      // (3) Fixes minor errors
      //      Being slightly outside of the PDF specification often does not impact readability,
      //      however certain picky programs (e.g. Adobe Acrobat) will throw warning messages.
      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      await initSchedulerIfNeeded('muPDFScheduler');

      const w = globalThis.muPDFScheduler.workers[0];

      // The file name is only used to detect the ".pdf" extension
      const pdf = await w.openDocument(pdfEnc.buffer, 'document.pdf');

      const content = await w.write([pdf, minValue, maxValue, dimsLimit.width, dimsLimit.height]);

      pdfBlob = new Blob([content], { type: 'application/octet-stream' });
    }
    saveAs(pdfBlob, fileName);
  } else if (downloadType === 'hocr') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);
    renderHOCRBrowser(globalThis.ocrAll.active, globalThis.fontMetricsObj, globalThis.layout);
    downloadProgress.increment();
  } else if (downloadType === 'text') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    const removeLineBreaks = reflowCheckboxElem.checked;
    const breaksBetweenPages = pageBreaksCheckboxElem.checked;

    const textStr = renderText(hocrDownload, removeLineBreaks, breaksBetweenPages);

    const textBlob = new Blob([textStr], { type: 'text/plain' });
    const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.txt`;

    saveAs(textBlob, fileName);
    downloadProgress.increment();
  } else if (downloadType === 'docx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    writeDocx(hocrDownload);
    downloadProgress.increment();
  } else if (downloadType === 'xlsx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    writeXlsx(hocrDownload);
    downloadProgress.increment();
  }

  downloadElem.disabled = false;
  downloadElem.addEventListener('click', handleDownload);
}

// Set default settings
setDefaults();
