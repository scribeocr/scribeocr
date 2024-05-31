/* eslint-disable import/no-cycle */

// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

import Konva from './lib/konva/index.js';

import { importOCRFiles } from './js/importOCR.js';

import { imageCache, imageUtils, ImageWrapper } from './js/containers/imageContainer.js';

import { recognizeAllClick, getLangText } from './js/browser/interfaceRecognize.js';

import { handleDownload, setFormatLabel, updatePdfPagesLabel } from './js/browser/interfaceDownload.js';

import { convertOCRAllBrowser } from './js/recognizeConvertBrowser.js';

import { runFontOptimization } from './js/fontEval.js';
import {
  enableDisableFontOpt, setBuiltInFontsWorker, loadBuiltInFontsRaw, setDefaultFontAuto,
} from './js/fontContainerMain.js';
import { optimizeFontContainerAll, fontAll } from './js/containers/fontContainer.js';

import {
  fontMetricsObj, layoutAll, ocrAll, pageMetricsArr, inputDataModes,
} from './js/containers/miscContainer.js';

import { PageMetrics } from './js/objects/pageMetricsObjects.js';

import { LayoutPage } from './js/objects/layoutObjects.js';

import {
  checkCharWarn, setFontMetricsAll,
} from './js/fontStatistics.js';

import { drawDebugImages } from './js/debug.js';

import {
  getRandomAlphanum, sleep, occurrences, readTextFile, replaceObjectProperties, showHideElem,
} from './js/miscUtils.js';
import { getAllFileEntries } from './js/drag-and-drop.js';

// Functions for various UI tabs
import { selectDisplayMode, getDisplayMode } from './js/browser/interfaceView.js';

import {
  deleteSelectedWords, changeWordFontSize, changeWordFontFamily,
  adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, toggleEditButtons,
} from './js/browser/interfaceEdit.js';

import {
  deleteLayoutBoxClick, setDefaultLayoutClick, revertLayoutClick, setLayoutBoxTypeClick, setLayoutBoxInclusionRuleClick, setLayoutBoxInclusionLevelClick,
  updateDataPreview, setLayoutBoxTable, renderLayoutBoxes, toggleSelectableWords,
} from './js/browser/interfaceLayout.js';

import {
  stage, layerText, destroyWords, canvasObj,
  getCanvasWords, setCanvasWidthHeightZoom, destroyLayoutBoxes, destroyControls, renderPage,
  layerOverlay,
} from './js/browser/interfaceCanvas.js';

// Third party libraries
import Tesseract from './tess/tesseract.esm.min.js';

// Debugging functions
// import { initConvertPageWorker } from './js/convertPage.js';
import { initGeneralWorker, GeneralScheduler } from './js/generalWorkerMain.js';

// Load default settings
import { setDefaults } from './js/browser/setDefaults.js';

import ocr from './js/objects/ocrObjects.js';

import {
  printSelectedWords, downloadCanvas, evalSelectedLine, getExcludedText, downloadCurrentImage,
} from './js/browser/interfaceDebug.js';

import { df } from './js/browser/debugGlobals.js';

globalThis.df = df;

globalThis.d = () => {
  debugger;
};

// Disable mouse wheel + control to zoom by the browser.
// The application supports zooming in on the canvas,
// however when the browser zooms it results in a blurry canvas,
// as the canvas is not drawn at the appropriate resolution.
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false });

/**
 * @global
 * @type {CanvasRenderingContext2D}
 * @description - Used under the hood for generating overlap visualizations to display to user.
 */
globalThis.ctxDebug = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('g')).getContext('2d'));

const debugDownloadCanvasElem = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadCanvas'));
const debugDownloadImageElem = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadImage'));

const debugPrintWordsCanvasElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsCanvas'));
const debugPrintWordsOCRElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsOCR'));

const debugEvalLineElem = /** @type {HTMLInputElement} */(document.getElementById('debugEvalLine'));

debugPrintWordsOCRElem.addEventListener('click', () => printSelectedWords(true));
debugPrintWordsCanvasElem.addEventListener('click', () => printSelectedWords(false));

debugDownloadCanvasElem.addEventListener('click', downloadCanvas);
debugDownloadImageElem.addEventListener('click', downloadCurrentImage);

debugEvalLineElem.addEventListener('click', evalSelectedLine);

const fontAllRawReady = loadBuiltInFontsRaw().then((x) => {
  fontAll.raw = x;
  if (!fontAll.active) fontAll.active = fontAll.raw;
});

// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
const tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

/**
 * @typedef cp
 * @type {Object}
 * @property {Number} n - an ID.
 * @property {Object} backgroundOpts - an ID.
 * @property {Number} renderStatus - an ID.
 * @property {number} renderNum - an ID.
 */
/** @type {cp} */
export const cp = {
  n: 0,
  backgroundOpts: { stroke: '#3d3d3d', strokeWidth: 3 },
  renderStatus: 0,
  renderNum: 0,
};

const zone = /** @type {HTMLInputElement} */ (document.getElementById('uploadDropZone'));

const openFileInputElem = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
openFileInputElem.addEventListener('change', () => {
  if (!openFileInputElem.files || openFileInputElem.files.length === 0) return;

  importFiles(openFileInputElem.files);
  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (zone.parentElement), false);
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

  if (!event.dataTransfer) return;
  const items = await getAllFileEntries(event.dataTransfer.items);

  const filesPromises = await Promise.allSettled(items.map((x) => new Promise((resolve, reject) => x.file(resolve, reject))));
  const files = filesPromises.map((x) => x.value);

  if (files.length === 0) return;

  zone.classList.remove('highlight');

  importFiles(files);

  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (zone.parentElement), false);
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

const pageNumElem = /** @type {HTMLInputElement} */(document.getElementById('pageNum'));

globalThis.bsCollapse = new bootstrap.Collapse(document.getElementById('collapseRange'), { toggle: false });

// Add various event listners to HTML elements
const nextElem = /** @type {HTMLInputElement} */(document.getElementById('next'));
const prevElem = /** @type {HTMLInputElement} */(document.getElementById('prev'));

nextElem.addEventListener('click', () => displayPage(cp.n + 1));
prevElem.addEventListener('click', () => displayPage(cp.n - 1));

// const rangeLeftMarginElem = /** @type {HTMLInputElement} */(document.getElementById('rangeLeftMargin'));

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
colorModeElem.addEventListener('change', () => {
  imageCache.colorModeDefault = colorModeElem.value;
  renderPageQueue(cp.n);
});

const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
showDebugVisElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const showDebugLegendElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugLegend'));
showDebugLegendElem.addEventListener('change', () => { renderPageQueue(cp.n); });

showDebugLegendElem.addEventListener('input', () => {
  const legendCanvasParentDivElem = /** @type {HTMLDivElement} */(document.getElementById('legendCanvasParentDiv'));
  if (!showDebugLegendElem.checked) {
    showHideElem(legendCanvasParentDivElem, false);
  } else {
    showHideElem(legendCanvasParentDivElem, true);
  }
  if (pageMetricsArr[cp.n]?.dims) setCanvasWidthHeightZoom(pageMetricsArr[cp.n].dims, false);
});

const selectDebugVisElem = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));
selectDebugVisElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const createGroundTruthElem = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));
createGroundTruthElem.addEventListener('click', createGroundTruthClick);

const enableRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableRecognition'));

const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));

const enableEvalElem = /** @type {HTMLInputElement} */(document.getElementById('enableEval'));

enableEvalElem.addEventListener('click', () => showHideElem(/** @type {HTMLDivElement} */(document.getElementById('nav-eval-tab')), enableEvalElem.checked));

const enableLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

enableAdvancedRecognitionElem.addEventListener('click', () => {
  const advancedRecognitionOptions1Elem = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions1'));
  const advancedRecognitionOptions2Elem = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions2'));
  const advancedRecognitionOptions3Elem = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions3'));
  const basicRecognitionOptionsElem = /** @type {HTMLDivElement} */(document.getElementById('basicRecognitionOptions'));
  showHideElem(advancedRecognitionOptions1Elem, enableAdvancedRecognitionElem.checked);
  showHideElem(advancedRecognitionOptions2Elem, enableAdvancedRecognitionElem.checked);
  showHideElem(advancedRecognitionOptions3Elem, enableAdvancedRecognitionElem.checked);
  showHideElem(basicRecognitionOptionsElem, !enableAdvancedRecognitionElem.checked);
});

export const enableRecognitionClick = () => showHideElem(/** @type {HTMLDivElement} */(document.getElementById('nav-recognize-tab')), enableRecognitionElem.checked);

enableRecognitionElem.addEventListener('click', enableRecognitionClick);

enableLayoutElem.addEventListener('click', () => showHideElem(/** @type {HTMLDivElement} */(document.getElementById('nav-layout-tab')), enableLayoutElem.checked));

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!enableLayoutElem.checked) enableLayoutElem.click();

  showHideElem(formatLabelOptionXlsxElem, enableXlsxExportElem.checked);

  updateDataPreview();
};

enableXlsxExportElem.addEventListener('click', enableXlsxExportClick);

const addOverlayCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('addOverlayCheckbox'));
const extractTextCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('extractTextCheckbox'));
const omitNativeTextCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('omitNativeTextCheckbox'));

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

document.getElementById('addWord')?.addEventListener('click', () => (canvasObj.mode = 'addWord'));
document.getElementById('reset')?.addEventListener('click', clearFiles);

const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));
optimizeFontElem.addEventListener('click', () => {
  // This button does nothing if the debug option optimizeFontDebugElem is enabled.
  // This approach is used rather than disabling the button, as `optimizeFontElem.disabled` is checked in other functions
  // to determine whether font optimization is enabled.
  if (optimizeFontDebugElem.checked) return;
  optimizeFontClick(optimizeFontElem.checked);
});

const optimizeFontDebugElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFontDebug'));
optimizeFontDebugElem.addEventListener('click', () => {
  if (optimizeFontDebugElem.checked) {
    optimizeFontClick(true, true);
  } else {
    optimizeFontClick(optimizeFontElem.checked);
  }
});

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
confThreshHighElem.addEventListener('change', () => { renderPageQueue(cp.n); });
confThreshMedElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
autoRotateCheckboxElem.addEventListener('click', () => { renderPageQueue(cp.n); });
document.getElementById('outlineWords')?.addEventListener('click', () => { renderPageQueue(cp.n); });
document.getElementById('outlineLines')?.addEventListener('click', () => { renderPageQueue(cp.n); });

const displayLabelOptionsElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));
const displayLabelTextElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));
displayLabelOptionsElem.addEventListener('click', () => { if (displayLabelOptionsElem.className !== 'dropdown-item') return; setCurrentHOCR(displayLabelOptionsElem.innerHTML); });

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
  if (showConflictsElem.checked) showDebugImages();
  setCanvasWidthHeightZoom(pageMetricsArr[cp.n].dims, showConflictsElem.checked);
});

const recognizeAllElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));
recognizeAllElem.addEventListener('click', () => {
  globalThis.state.recognizeAllPromise = recognizeAllClick();
});

const recognizeAreaElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));
recognizeAreaElem.addEventListener('click', () => (canvasObj.mode = 'recognizeArea'));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
recognizeWordElem.addEventListener('click', () => (canvasObj.mode = 'recognizeWord'));

const debugPrintCoordsElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintCoords'));
debugPrintCoordsElem.addEventListener('click', () => () => (canvasObj.mode = 'printCoords'));

const addLayoutBoxElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBox'));
const addLayoutBoxTypeOrderElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeOrder'));
const addLayoutBoxTypeExcludeElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeExclude'));
const addLayoutBoxTypeDataColumnElem = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeDataColumn'));

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

addLayoutBoxElem.addEventListener('click', () => {
  canvasObj.mode = { Order: 'addLayoutBoxOrder', Exclude: 'addLayoutBoxExclude', Column: 'addLayoutBoxDataColumn' }[layoutBoxTypeElem.textContent];
});
addLayoutBoxTypeOrderElem.addEventListener('click', () => (canvasObj.mode = 'addLayoutBoxOrder'));
addLayoutBoxTypeExcludeElem.addEventListener('click', () => (canvasObj.mode = 'addLayoutBoxExclude'));
addLayoutBoxTypeDataColumnElem.addEventListener('click', () => (canvasObj.mode = 'addLayoutBoxDataColumn'));

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
ignorePunctElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));
ignoreCapElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreExtra'));
ignoreExtraElem.addEventListener('change', () => { renderPageQueue(cp.n); });

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
reflowCheckboxElem.addEventListener('click', () => {
  if (reflowCheckboxElem.checked) {
    pageBreaksCheckboxElem.disabled = false;
  } else {
    pageBreaksCheckboxElem.disabled = true;
    pageBreaksCheckboxElem.checked = true;
  }
});

const docxReflowCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxReflowCheckbox'));
const docxPageBreaksCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxPageBreaksCheckbox'));

// If "Reflow Text" is turned off, then pages will automatically have line breaks between them
docxReflowCheckboxElem.addEventListener('click', () => {
  if (docxReflowCheckboxElem.checked) {
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
  const matchIdArr = ocr.getMatchingWordIds(text, ocrAll.active[cp.n]);

  getCanvasWords().forEach((wordObj) => {
    if (matchIdArr.includes(wordObj.word.id)) {
      wordObj.fillBox = true;
    } else {
      wordObj.fillBox = false;
    }
  });

  layerText.batchDraw();
}

function findAllMatches(text) {
  let total = 0;
  const matches = [];
  const maxValue = search.text.length;
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
  if (!ocrAll.active[cp.n]) {
    search.text[cp.n] = '';
    return;
  }

  // Re-extract text from XML
  search.text[cp.n] = ocr.getPageText(ocrAll.active[cp.n]);

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
  const maxValue = ocrAll.active.length;

  for (let g = 0; g < maxValue; g++) {
    search.text[g] = ocr.getPageText(ocrAll.active[g]);
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

const xlsxFilenameColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));
const xlsxPageNumberColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));
xlsxFilenameColumnElem.addEventListener('click', updateDataPreview);
xlsxPageNumberColumnElem.addEventListener('click', updateDataPreview);

const oemLabelTextElem = /** @type {HTMLElement} */(document.getElementById('oemLabelText'));

export function setOemLabel(x) {
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
    buildLabelTextElem.innerHTML = 'Scribe';
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
  if (!ocrAll[label]) {
    ocrAll[label] = Array(globalThis.pageCount);
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

export function setCurrentHOCR(x) {
  const currentLabel = displayLabelTextElem.innerHTML.trim();
  if (!x.trim() || x === currentLabel) return;

  ocrAll.active = ocrAll[x];
  displayLabelTextElem.innerHTML = x;

  renderPageQueue(cp.n);
}

// Users may select an edit action (e.g. "Add Word", "Recognize Word", etc.) but then never follow through.
// This function cleans up any changes/event listners caused by the initial click in such cases.
const navBarElem = /** @type {HTMLDivElement} */(document.getElementById('navBar'));
navBarElem.addEventListener('click', (e) => {
  canvasObj.mode = 'select';
  globalThis.touchScrollMode = true; // Is this still used?
}, true);

// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
const navRecognizeElem = /** @type {HTMLDivElement} */(document.getElementById('nav-recognize'));
navRecognizeElem.addEventListener('hidden.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-recognize') {
    hideProgress('import-eval-progress-collapse');
    hideProgress('recognize-recognize-progress-collapse');
  }
});

const navDownloadElem = /** @type {HTMLDivElement} */(document.getElementById('nav-download'));
navDownloadElem.addEventListener('hidden.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-download') {
    hideProgress('generate-download-progress-collapse');
  }
});

const navLayoutElem = /** @type {HTMLDivElement} */(document.getElementById('nav-layout'));
navLayoutElem.addEventListener('show.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    globalThis.layoutMode = true;
    // Generally we handle drawing manually, however `autoDrawEnabled` is needed for the user to drag layout boxes.
    Konva.autoDrawEnabled = true;
    if (!layoutAll[cp.n]) return;

    toggleSelectableWords(false);
    destroyControls();
    renderLayoutBoxes();
  }
});

navLayoutElem.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    globalThis.layoutMode = false;
    Konva.autoDrawEnabled = false;
    toggleSelectableWords(true);
    destroyLayoutBoxes();
    destroyControls();
    layerOverlay.batchDraw();
  }
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
export function initializeProgress(id, maxValue, initValue = 0, alwaysUpdateUI = false, autoHide = false) {
  const progressCollapse = document.getElementById(id);

  if (!progressCollapse) throw new Error(`Progress bar with ID ${id} not found.`);

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
  const progressCollapse = /** @type {HTMLDivElement} */(document.getElementById(id));
  const classStr = progressCollapse.getAttribute('class');
  if (classStr && ['collapse show', 'collapsing'].includes(classStr)) {
    const progressBar = progressCollapse.getElementsByClassName('progress-bar')[0];
    if (parseInt(progressBar.getAttribute('aria-valuenow')) >= parseInt(progressBar.getAttribute('aria-valuemax'))) {
      progressCollapse.setAttribute('class', 'collapse');
    }
  }
}

function createGroundTruthClick() {
  if (!ocrAll['Ground Truth']) {
    ocrAll['Ground Truth'] = Array(ocrAll.active.length);
  }

  // Use whatever the current HOCR is as a starting point
  for (let i = 0; i < ocrAll.active.length; i++) {
    ocrAll['Ground Truth'][i] = structuredClone(ocrAll.active[i]);
  }

  initOCRVersion('Ground Truth');
  setCurrentHOCR('Ground Truth');

  const option = document.createElement('option');
  option.text = 'Evaluate Mode (Compare with Ground Truth)';
  option.value = 'eval';
  displayModeElem.add(option);

  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = false;

  inputDataModes.evalMode = true;

  // Calculate statistics
  compareGroundTruthClick(cp.n);
}

globalThis.evalStatsConfig = {};

globalThis.evalStats = [];

async function compareGroundTruthClick(n) {
  if (!globalThis.gs) throw new Error('GeneralScheduler must be defined before this function can run.');

  // When a document/recognition is still loading only the page statistics can be calculated
  const loadMode = !!(globalThis.loadCount && globalThis.loadCount < parseInt(globalThis.convertPageActiveProgress?.elem?.getAttribute('aria-valuemax')));

  const evalStatsConfigNew = {
    ocrActive: displayLabelTextElem.innerHTML,
    ignorePunct: ignorePunctElem.checked,
    ignoreCap: ignoreCapElem.checked,
    ignoreExtra: ignoreExtraElem.checked,
  };
  /** @type {Parameters<import('./js/generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
  const compOptions = {
    ignoreCap: ignoreCapElem.checked,
    ignorePunct: ignorePunctElem.checked,
    confThreshHigh: parseInt(confThreshHighElem.value),
    confThreshMed: parseInt(confThreshMedElem.value),
  };

  // Compare all pages if this has not been done already
  if (!loadMode && JSON.stringify(globalThis.evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || globalThis.evalStats.length === 0) {
  // Render binarized versions of images
    await imageCache.preRenderRange(0, imageCache.pageCount - 1, true);

    globalThis.evalStats = new Array(imageCache.pageCount);
    for (let i = 0; i < imageCache.pageCount; i++) {
      const imgBinary = await imageCache.getBinary(n);

      const res = await globalThis.gs.compareHOCR({
        pageA: ocrAll.active[i],
        pageB: ocrAll['Ground Truth'][i],
        binaryImage: imgBinary,
        pageMetricsObj: pageMetricsArr[i],
        options: compOptions,
      });

      // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
      // rather than the currently active OCR.
      // Assigning to "active" will overwrite whatever version the user currently has open.
      ocrAll.active[i] = res.page;

      globalThis.evalStats[i] = res.metrics;
      if (globalThis.debugLog === undefined) globalThis.debugLog = '';
      globalThis.debugLog += res.debugLog;
    }
    globalThis.evalStatsConfig = evalStatsConfigNew;
  }

  const imgBinary = await imageCache.getBinary(n);

  const res = await globalThis.gs.compareHOCR({
    pageA: ocrAll.active[n],
    pageB: ocrAll['Ground Truth'][n],
    binaryImage: imgBinary,
    pageMetricsObj: pageMetricsArr[n],
    options: compOptions,
  });

  // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
  // rather than the currently active OCR.
  // Assigning to "active" will overwrite whatever version the user currently has open.
  ocrAll.active[n] = res.page;
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

// Resets the environment.
async function clearFiles() {
  cp.n = 0;
  globalThis.pageCount = 0;
  ocrAll.active = [];
  layoutAll.length = 0;
  replaceObjectProperties(fontMetricsObj);
  pageMetricsArr.length = 0;
  globalThis.convertPageWarn = [];

  if (globalThis.binaryScheduler) {
    const bs = await globalThis.binaryScheduler;
    bs.terminate();
    globalThis.binaryScheduler = null;
  }

  imageCache.clear();

  globalThis.loadCount = 0;

  stage.clear();
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

  const ocrData = await importOCRFiles(Array.from(hocrFilesAll), false);

  const pageCountHOCR = ocrData.hocrRaw.length;

  // Enable confidence threshold input boxes (only used for Tesseract)
  if (!ocrData.abbyyMode && !ocrData.stextMode && confThreshHighElem.disabled) {
    confThreshHighElem.disabled = false;
    confThreshMedElem.disabled = false;
    confThreshHighElem.value = '85';
    confThreshMedElem.value = '75';
  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (imageCache.pageCount !== pageCountHOCR) {
    const warningHTML = `Page mismatch detected. Image data has ${imageCache.pageCount} pages while OCR data has ${pageCountHOCR} pages.`;
    insertAlertMessage(warningHTML, false);
  }

  globalThis.loadCount = 0;
  globalThis.convertPageActiveProgress = initializeProgress('import-eval-progress-collapse', pageCountHOCR, 0, false, true);

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
  if (!curFiles || curFiles.length === 0) return;

  globalThis.state.downloadReady = false;

  pageMetricsArr.length = 0;

  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  /** @type {Array<File>} */
  const imageFilesAll = [];
  /** @type {Array<File>} */
  const hocrFilesAll = [];
  /** @type {Array<File>} */
  const pdfFilesAll = [];
  /** @type {Array<File>} */
  const layoutFilesAll = [];
  /** @type {Array<File>} */
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

  inputDataModes.pdfMode = pdfFilesAll.length === 1;
  inputDataModes.imageMode = !!(imageFilesAll.length > 0 && !inputDataModes.pdfMode);
  imageCache.inputModes.image = !!(imageFilesAll.length > 0 && !inputDataModes.pdfMode);

  const xmlModeImport = hocrFilesAll.length > 0;

  // Extract text from PDF document
  // Only enabled if (1) user selects this option, (2) user uploads a PDF, and (3) user does not upload XML data.
  inputDataModes.extractTextMode = extractTextCheckboxElem.checked && inputDataModes.pdfMode && !xmlModeImport;
  const stextModeExtract = inputDataModes.extractTextMode;

  addLayoutBoxElem.disabled = false;
  deleteLayoutBoxElem.disabled = false;
  setDefaultLayoutElem.disabled = false;
  revertLayoutElem.disabled = false;

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
    if (inputDataModes.pdfMode) {
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

  // The loading bar should be initialized before anything significant runs (e.g. `imageCache.openMainPDF` to provide some visual feedback).
  // All pages of OCR data and individual images (.png or .jpeg) contribute to the import loading bar.
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  let progressMax = 0;
  if (inputDataModes.imageMode) progressMax += imageFilesAll.length;
  if (xmlModeImport) progressMax += hocrFilesAll.length;

  // Loading bars are necessary for automated testing as the tests wait for the loading bar to fill up.
  // Therefore, a dummy loading bar with a max of 1 is created even when progress is not meaningfully tracked.
  let dummyLoadingBar = false;
  if (progressMax === 0) {
    dummyLoadingBar = true;
    progressMax = 1;
  }

  globalThis.convertPageActiveProgress = initializeProgress('import-progress-collapse', progressMax, 0, false, true);

  let pageCount;
  let pageCountImage;
  let abbyyMode = false;
  let scribeMode = false;

  if (inputDataModes.pdfMode) {
    const pdfFile = pdfFilesAll[0];
    globalThis.inputFileNames = [pdfFile.name];

    const skipText = omitNativeTextCheckboxElem.checked;

    // Start loading mupdf workers as soon as possible, without waiting for `pdfFile.arrayBuffer` (which can take a while).
    imageCache.getMuPDFScheduler();

    const pdfFileData = await pdfFile.arrayBuffer();

    // If no XML data is provided, page sizes are calculated using muPDF alone
    await imageCache.openMainPDF(pdfFileData, skipText, !xmlModeImport, stextModeExtract);

    pageCountImage = imageCache.pageCount;
  } else if (inputDataModes.imageMode) {
    globalThis.inputFileNames = imageFilesAll.map((x) => x.name);
    pageCountImage = imageFilesAll.length;
  }

  let existingLayout = false;
  let existingOpt = false;
  const oemName = 'User Upload';
  let stextMode;

  if (xmlModeImport || inputDataModes.extractTextMode) {
    document.getElementById('combineModeOptions')?.setAttribute('style', '');

    initOCRVersion(oemName);
    setCurrentHOCR(oemName);

    displayLabelTextElem.innerHTML = oemName;

    let stextModeImport;
    if (xmlModeImport) {
      const ocrData = await importOCRFiles(Array.from(hocrFilesAll), true);

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
        replaceObjectProperties(fontMetricsObj, ocrData.fontMetricsObj);
        await globalThis.generalScheduler.ready;
        setDefaultFontAuto(fontMetricsObj);
      }

      if (ocrData.defaultFont) fontAll.defaultFontName = ocrData.defaultFont;

      if (ocrData.enableOpt === 'true') {
        const fontRaw = fontAll.getContainer('raw');
        fontAll.opt = await optimizeFontContainerAll(fontRaw, fontMetricsObj);
        optimizeFontElem.disabled = false;
        optimizeFontElem.checked = true;
        await enableDisableFontOpt(true);
        existingOpt = true;
      } else if (ocrData.enableOpt === 'false') {
        optimizeFontElem.disabled = true;
        optimizeFontElem.checked = false;
        existingOpt = true;
      // If font metrics are available but enableOpt is not specified, default to using them.
      } else if (ocrData.fontMetricsObj) {
        const fontRaw = fontAll.getContainer('raw');
        fontAll.opt = await optimizeFontContainerAll(fontRaw, fontMetricsObj);
        optimizeFontElem.disabled = false;
        optimizeFontElem.checked = true;
        await enableDisableFontOpt(true);
      }

      if (ocrData.sansFont) {
        fontAll.sansDefaultName = ocrData.sansFont;
      }

      if (ocrData.serifFont) {
        fontAll.serifDefaultName = ocrData.serifFont;
      }

      // Restore layout data from previous session (if applicable)
      if (ocrData.layoutObj) {
        for (let i = 0; i < ocrData.layoutObj.length; i++) {
          layoutAll[i] = ocrData.layoutObj[i];
        }
        existingLayout = true;
      }

      stextModeImport = ocrData.stextMode;
      abbyyMode = ocrData.abbyyMode;
      scribeMode = ocrData.scribeMode;
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
  if (xmlModeImport && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    if (pageCountImage !== pageCountHOCR) {
      const warningHTML = `Page mismatch detected. Image data has ${pageCountImage} pages while OCR data has ${pageCountHOCR} pages.`;
      insertAlertMessage(warningHTML, false);
    }
  }

  globalThis.pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.hocrCurrentRaw = globalThis.hocrCurrentRaw || Array(pageCount);
  globalThis.defaultLayout = {};

  if (!existingLayout) {
    for (let i = 0; i < globalThis.pageCount; i++) {
      layoutAll[i] = new LayoutPage();
    }
  }

  inputDataModes.xmlMode = new Array(globalThis.pageCount);
  if (xmlModeImport || inputDataModes.extractTextMode) {
    inputDataModes.xmlMode.fill(true);
  } else {
    inputDataModes.xmlMode.fill(false);
  }

  if (inputDataModes.pdfMode && !xmlModeImport) {
    // Render first handful of pages for pdfs so the interface starts off responsive
    // In the case of OCR data, this step is triggered elsewhere after all the data loads
    displayPage(0);
  }

  globalThis.loadCount = 0;

  if (inputDataModes.imageMode) {
    imageCache.pageCount = globalThis.pageCount;
    for (let i = 0; i < globalThis.pageCount; i++) {
    // Currently, images are loaded once at a time.
    // While this is not optimal for performance, images are required for comparison functions,
    // so switching to running async would require either (1) waiting for enough images to load before before continuing to the next step
    // or (2) switching imageAll["nativeSrcStr"], as a whole, to store promises that can be waited for.
      const imgPromise = new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = function () {
          resolve(reader.result);
        };

        reader.onerror = function (error) {
          reject(error);
        };

        reader.readAsDataURL(imageFilesAll[i]);
      });

      const imgSrc = await imgPromise;

      // Using MIME sniffing might be slightly more accurate than using the file extension,
      // however for now the file extension is used to ensure equivalent behavior between Node.js and browser versions.
      const format = imageFilesAll[i].name.match(/jpe?g$/i) ? 'jpeg' : 'png';

      const imgWrapper = new ImageWrapper(i, imgSrc, format, 'native', false, false);

      const imageDims = await imageUtils.getDims(imgWrapper);

      imageCache.nativeSrc[i] = imgWrapper;

      pageMetricsArr[i] = new PageMetrics(imageDims);
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

  if (xmlModeImport || inputDataModes.extractTextMode) {
    toggleEditButtons(false);
    /** @type {("hocr" | "abbyy" | "stext")} */
    let format = 'hocr';
    if (abbyyMode) format = 'abbyy';
    if (stextMode) format = 'stext';

    // Process HOCR using web worker, reading from file first if that has not been done already
    convertOCRAllBrowser(globalThis.hocrCurrentRaw, true, format, oemName, scribeMode).then(async () => {
      if (layoutFilesAll.length > 0) await readLayoutFile(layoutFilesAll[0]);

      // Skip this step if optimization info was already restored from a previous session.
      if (!existingOpt) {
        await checkCharWarn(globalThis.convertPageWarn, insertAlertMessage);
        setFontMetricsAll(ocrAll.active);
        await runFontOptimizationBrowser(ocrAll.active);
      }
      downloadElem.disabled = false;
      globalThis.state.downloadReady = true;
    });
  } else if (layoutFilesAll.length > 0) {
    await readLayoutFile(layoutFilesAll[0]);
  }

  if (dummyLoadingBar) globalThis.convertPageActiveProgress.increment();

  // Enable downloads now for pdf imports if no HOCR data exists
  if (inputDataModes.pdfMode && !xmlModeImport) {
    downloadElem.disabled = false;
    globalThis.state.downloadReady = true;
  }

  pageNumElem.value = '1';
  pageCountElem.textContent = String(globalThis.pageCount);

  // Start loading Tesseract if it was not already loaded.
  // Tesseract is not loaded on startup, however if the user uploads data, they presumably want to run something that requires Tesseract.
  await globalThis.initTesseractInWorkers(true);
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
    const layoutObj = /** @type {Array<LayoutPage>} */(JSON.parse(layoutStr));

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
          value.coords.left *= (pageMetricsArr[i].dims.width / width);
          value.coords.right *= (pageMetricsArr[i].dims.width / width);

          value.coords.top *= (pageMetricsArr[i].dims.height / height);
          value.coords.bottom *= (pageMetricsArr[i].dims.height / height);
        }
      }
    }

    for (let i = 0; i < layoutObj.length; i++) {
      layoutAll[i] = layoutObj[i];
    }
  } catch (e) {
    console.log('Unable to parse contents of layout file.');
    console.log(e);
  }
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
 * @property {number} canvasDimsN - Page number that the current canvas dimensions are based off of.
 */
/** @type {state} */
globalThis.state = {
  pageRendering: Promise.resolve(true),
  renderIt: 0,
  promiseResolve: undefined,
  recognizeAllPromise: Promise.resolve(true),
  downloadReady: false,
  canvasDimsN: -1,
};

// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n) {
  let ocrData = ocrAll.active?.[n];

  // Return early if there is not enough data to render a page yet
  // (0) Necessary info is not defined yet
  const noInfo = inputDataModes.xmlMode[n] === undefined;
  // (1) No data has been imported
  const noInput = !inputDataModes.xmlMode[n] && !(inputDataModes.imageMode || inputDataModes.pdfMode);
  // (2) XML data should exist but does not (yet)
  const xmlMissing = inputDataModes.xmlMode[n]
    && (ocrData === undefined || ocrData === null || pageMetricsArr[n].dims === undefined);

  const imageMissing = false;
  const pdfMissing = false;

  if (noInfo || noInput || xmlMissing || imageMissing || pdfMissing) {
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

  if (inputDataModes.evalMode) {
    await compareGroundTruthClick(n);
    // ocrData must be re-assigned after comparing to ground truth or it will not update.
    ocrData = ocrAll.active?.[n];
  }

  destroyWords();

  // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
  // (whether by quickly changing pages or on the same page).
  // TODO: Find a better solution.
  cp.renderNum += 1;
  const renderNum = cp.renderNum;

  // The active OCR version may have changed, so this needs to be re-checked.
  if (cp.n === n && inputDataModes.xmlMode[n]) {
    renderPage(ocrData);
    if (cp.n === n && cp.renderNum === renderNum) {
      await selectDisplayMode(getDisplayMode());
    }
  } else {
    await selectDisplayMode(getDisplayMode());
  }

  globalThis.state.promiseResolve();
}

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

  working = true;

  if (inputDataModes.xmlMode[cp.n]) {
    // TODO: This is currently run whenever the page is changed.
    // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
    updateFindStats();
  }

  matchCurrentElem.textContent = calcMatchNumber(n);

  cp.n = n;
  pageNumElem.value = (cp.n + 1).toString();

  await renderPageQueue(cp.n);

  if (showConflictsElem.checked) showDebugImages();

  // Render background images ahead and behind current page to reduce delay when switching pages
  if (inputDataModes.pdfMode || inputDataModes.imageMode) imageCache.preRenderAheadBehindBrowser(n, colorModeElem.value === 'binary');

  working = false;
}

/**
 *
 * @param {boolean} enable
 * @param {boolean} [useInitial=false]
 */
async function optimizeFontClick(enable, useInitial = false) {
  await enableDisableFontOpt(enable, useInitial);

  renderPageQueue(cp.n);
}

/** @type {?GeneralScheduler} */
globalThis.gs = null;

/**
 *
 * @param {boolean} anyOk - Is any Tesseract worker okay to use?
 *    If `true`, this function returns immediately if Tesseract workers are already loaded,
 *    without checking the particular language/oem settings.
 * @returns
 */
globalThis.initTesseractInWorkers = async (anyOk = false) => {
  await globalThis.generalScheduler.ready;

  if (anyOk && globalThis.generalScheduler.readyTesseract) return globalThis.generalScheduler.readyTesseract;

  let resReady;
  globalThis.generalScheduler.readyTesseract = new Promise((resolve, reject) => {
    resReady = resolve;
  });

  const vanillaMode = buildLabelTextElem.innerHTML.toLowerCase().includes('vanilla');
  const langArr = getLangText();

  // Wait for the first worker to load.
  // A behavior (likely bug) was observed where, if the workers are loaded in parallel,
  // data will be loaded over network from all workers (rather than downloading once and caching).
  const worker0 = globalThis.generalScheduler.workers[0];
  await worker0.reinitialize({ langs: langArr, vanillaMode });

  if (globalThis.generalScheduler.workers.length > 0) {
    const resArr = globalThis.generalScheduler.workers.slice(1).map((x) => x.reinitialize({ langs: langArr, vanillaMode }));
    await Promise.allSettled(resArr);
  }
  resReady(true);
  return globalThis.generalScheduler.readyTesseract;
};

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
  // A behavior (likely bug) was observed where, if the workers are loaded in parallel,
  // data will be loaded over network from all workers (rather than downloading once and caching).
  await addGeneralWorker(0);

  const resArr = Array.from({ length: workerN }, (v, k) => k).slice(1).map((i) => addGeneralWorker(i));

  await Promise.all(resArr);

  globalThis.gs = new GeneralScheduler(globalThis.generalScheduler);

  // Send raw fonts to workers after they have loaded in the main thread.
  await fontAllRawReady;
  await setBuiltInFontsWorker(globalThis.generalScheduler);

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
export async function runFontOptimizationBrowser(ocrArr) {
  const optImproved = await runFontOptimization(ocrArr);
  if (optImproved) {
    optimizeFontElem.disabled = false;
    optimizeFontElem.checked = true;
  } else {
    optimizeFontElem.disabled = true;
    optimizeFontElem.checked = false;
  }
  renderPageQueue(cp.n);
}

// Set default settings
setDefaults();
