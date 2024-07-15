/* eslint-disable import/no-cycle */

// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

import { Collapse, Tooltip } from './lib/bootstrap.esm.bundle.min.js';
import Konva from './lib/konva/index.js';

import { importOCRFiles } from './js/import/importOCR.js';

import { ImageCache, imageUtils, ImageWrapper } from './js/containers/imageContainer.js';

import { recognizeAllClick } from './js/gui/interfaceRecognize.js';

import { handleDownload, setFormatLabel, updatePdfPagesLabel } from './js/gui/interfaceDownload.js';

import { convertOCRAllBrowser } from './js/recognizeConvertBrowser.js';

import { fontAll } from './js/containers/fontContainer.js';
import {
  enableDisableFontOpt,
  loadBuiltInFontsRaw,
  optimizeFontContainerAll,
  setDefaultFontAuto,
} from './js/fontContainerMain.js';
import { runFontOptimization } from './js/fontEval.js';

import {
  evalStats,
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll, ocrAllRaw,
  pageMetricsArr,
} from './js/containers/dataContainer.js';

import { PageMetrics } from './js/objects/pageMetricsObjects.js';

import { LayoutDataTablePage, LayoutPage } from './js/objects/layoutObjects.js';

import {
  calcFontMetricsFromPages,
} from './js/fontStatistics.js';

import { getAllFileEntries } from './js/gui/utils/dragAndDrop.js';
import { checkCharWarn, insertAlertMessage } from './js/gui/utils/warningMessages.js';

import {
  occurrences,
  replaceObjectProperties, showHideElem,
} from './js/utils/miscUtils.js';

// Functions for various UI tabs
import { getDisplayMode, selectDisplayMode, setWordColorOpacity } from './js/gui/interfaceView.js';

import {
  adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange,
  changeWordFontFamily,
  changeWordFontSize,
  deleteSelectedWords,
  toggleEditButtons,
} from './js/gui/interfaceEdit.js';

import {
  renderLayoutBoxes,
  revertLayoutClick,
  setDefaultLayoutClick,
  setLayoutBoxInclusionLevelClick,
  setLayoutBoxInclusionRuleClick,
  toggleSelectableWords,
  updateDataPreview,
} from './js/gui/interfaceLayout.js';

import {
  cp,
  layerOverlay,
  layerText,
  renderPage,
  ScribeCanvas,
  stage,
} from './js/gui/interfaceCanvas.js';

// Third party libraries

// Debugging functions
// import { initConvertPageWorker } from './js/convertPage.js';

// Load default settings
import { setDefaults } from './js/gui/setDefaults.js';

import ocr from './js/objects/ocrObjects.js';

import {
  downloadCanvas,
  downloadCurrentImage,
  evalSelectedLine,
  printSelectedWords,
  showDebugImages,
} from './js/gui/interfaceDebug.js';

import { clearData } from './js/clear.js';
import { inputData, opt, state } from './js/containers/app.js';
import { gs } from './js/containers/schedulerContainer.js';
import { initGeneralScheduler, initTesseractInWorkers } from './js/generalWorkerMain.js';
import { df } from './js/gui/debugGlobals.js';
import { elem } from './js/gui/elems.js';
import {
  getLayerCenter, setCanvasWidthHeightZoom, zoomAllLayers,
} from './js/gui/interfaceCanvasInteraction.js';
import { ProgressBars } from './js/gui/utils/progressBars.js';

globalThis.df = df;

globalThis.d = () => {
  debugger;
};

initGeneralScheduler();

// Disable mouse wheel + control to zoom by the browser.
// The application supports zooming in on the canvas,
// however when the browser zooms it results in a blurry canvas,
// as the canvas is not drawn at the appropriate resolution.
window.addEventListener('wheel', (event) => {
  if (event.ctrlKey) {
    event.preventDefault();
  }
}, { passive: false });

elem.info.debugPrintWordsOCR.addEventListener('click', () => printSelectedWords(true));
elem.info.debugPrintWordsCanvas.addEventListener('click', () => printSelectedWords(false));

elem.info.debugDownloadCanvas.addEventListener('click', downloadCanvas);
elem.info.debugDownloadImage.addEventListener('click', downloadCurrentImage);

elem.info.debugEvalLine.addEventListener('click', evalSelectedLine);

const resReadyFontAllRaw = gs.setFontAllRawReady();
loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());

// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.forEach((tooltipTriggerEl) => new Tooltip(tooltipTriggerEl));

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

  const filesPromises = await Promise.allSettled(items.map((x) => new Promise((resolve, reject) => {
    if (x instanceof File) {
      resolve(x);
    } else {
      x.file(resolve, reject);
    }
  })));
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
    // A valid filename is necessary, as the import function uses the filename.
    if (!fileName) throw new Error(`Failed to extract file name from URL: ${url}`);
    return new File([blob], fileName, { type: blob.type });
  });

  // Call the existing importFiles function with the file array
  importFiles(files);

  zone.setAttribute('style', 'display:none');
};

const pageNumElem = /** @type {HTMLInputElement} */(document.getElementById('pageNum'));

// Add various event listners to HTML elements
elem.nav.next.addEventListener('click', () => displayPage(cp.n + 1));
elem.nav.prev.addEventListener('click', () => displayPage(cp.n - 1));

elem.nav.zoomIn.addEventListener('click', () => {
  zoomAllLayers(1.1, getLayerCenter(layerText));
});

elem.nav.zoomOut.addEventListener('click', () => {
  zoomAllLayers(0.9, getLayerCenter(layerText));
});

elem.view.colorMode.addEventListener('change', () => {
  ImageCache.colorModeDefault = elem.view.colorMode.value;
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

elem.info.enableLayout.addEventListener('click', () => showHideElem(/** @type {HTMLDivElement} */(document.getElementById('nav-layout-tab')), elem.info.enableLayout.checked));

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!elem.info.enableLayout.checked) elem.info.enableLayout.click();

  showHideElem(elem.download.formatLabelOptionXlsx, elem.info.enableXlsxExport.checked);
  showHideElem(elem.info.dataTableOptions, elem.info.enableXlsxExport.checked);

  updateDataPreview();
};

elem.info.enableXlsxExport.addEventListener('click', enableXlsxExportClick);

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

elem.edit.fontMinus.addEventListener('click', () => { changeWordFontSize('minus'); });
elem.edit.fontPlus.addEventListener('click', () => { changeWordFontSize('plus'); });
elem.edit.fontSize.addEventListener('change', () => { changeWordFontSize(elem.edit.fontSize.value); });
elem.edit.wordFont.addEventListener('change', () => { changeWordFontFamily(elem.edit.wordFont.value); });

// document.getElementById('editBoundingBox').addEventListener('click', toggleBoundingBoxesSelectedWords);
document.getElementById('editBaseline')?.addEventListener('click', adjustBaseline);

const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
rangeBaselineElem.addEventListener('input', () => { adjustBaselineRange(rangeBaselineElem.value); });
rangeBaselineElem.addEventListener('mouseup', () => { adjustBaselineRangeChange(rangeBaselineElem.value); });

elem.edit.deleteWord.addEventListener('click', deleteSelectedWords);

elem.edit.addWord.addEventListener('click', () => (ScribeCanvas.mode = 'addWord'));

elem.view.optimizeFont.addEventListener('click', () => {
  // This button does nothing if the debug option optimizeFontDebugElem is enabled.
  // This approach is used rather than disabling the button, as `optimizeFontElem.disabled` is checked in other functions
  // to determine whether font optimization is enabled.
  if (optimizeFontDebugElem.checked) return;
  optimizeFontClick(elem.view.optimizeFont.checked);
});

const optimizeFontDebugElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFontDebug'));
optimizeFontDebugElem.addEventListener('click', () => {
  if (optimizeFontDebugElem.checked) {
    optimizeFontClick(true, true);
  } else {
    optimizeFontClick(elem.view.optimizeFont.checked);
  }
});

elem.info.confThreshHigh.addEventListener('change', () => { renderPageQueue(cp.n); });
elem.info.confThreshMed.addEventListener('change', () => { renderPageQueue(cp.n); });

elem.view.autoRotateCheckbox.addEventListener('click', () => { renderPageQueue(cp.n); });
elem.view.outlineWords.addEventListener('click', () => { renderPageQueue(cp.n); });
elem.view.outlineLines.addEventListener('click', () => { renderPageQueue(cp.n); });

const displayLabelOptionsElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));
const displayLabelTextElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));
displayLabelOptionsElem.addEventListener('click', (e) => {
  // The elements this event are intended for are the individual elements of the list (not `displayLabelOptionsElem`),
  // which do not exist yet at this point in the code.
  // @ts-ignore
  if (e.target.className !== 'dropdown-item') return;
  // @ts-ignore
  setCurrentHOCR(e.target.innerHTML);
});

elem.download.download.addEventListener('click', handleDownload);
elem.download.pdfPagesLabel.addEventListener('click', updatePdfPagesLabel);

elem.download.formatLabelOptionPDF.addEventListener('click', () => { setFormatLabel('pdf'); });
elem.download.formatLabelOptionHOCR.addEventListener('click', () => { setFormatLabel('hocr'); });
elem.download.formatLabelOptionText.addEventListener('click', () => { setFormatLabel('text'); });
elem.download.formatLabelOptionDocx.addEventListener('click', () => { setFormatLabel('docx'); });
elem.download.formatLabelOptionXlsx.addEventListener('click', () => { setFormatLabel('xlsx'); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));
showConflictsElem.addEventListener('input', () => {
  if (showConflictsElem.checked) showDebugImages();
  setCanvasWidthHeightZoom(pageMetricsArr[cp.n].dims, showConflictsElem.checked);
});

elem.recognize.recognizeAll.addEventListener('click', () => {
  state.recognizeAllPromise = recognizeAllClick();
});

const recognizeAreaElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));
recognizeAreaElem.addEventListener('click', () => (ScribeCanvas.mode = 'recognizeArea'));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
recognizeWordElem.addEventListener('click', () => (ScribeCanvas.mode = 'recognizeWord'));

const debugPrintCoordsElem = /** @type {HTMLInputElement} */(document.getElementById('debugPrintCoords'));
debugPrintCoordsElem.addEventListener('click', () => (ScribeCanvas.mode = 'printCoords'));

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

elem.layout.addLayoutBox.addEventListener('click', () => {
  ScribeCanvas.mode = { Order: 'addLayoutBoxOrder', Exclude: 'addLayoutBoxExclude', Column: 'addLayoutBoxDataTable' }[layoutBoxTypeElem.textContent];
});
elem.layout.addLayoutBoxTypeOrder.addEventListener('click', () => (ScribeCanvas.mode = 'addLayoutBoxOrder'));
elem.layout.addLayoutBoxTypeExclude.addEventListener('click', () => (ScribeCanvas.mode = 'addLayoutBoxExclude'));
elem.layout.addDataTable.addEventListener('click', () => (ScribeCanvas.mode = 'addLayoutBoxDataTable'));

elem.layout.setDefaultLayout.addEventListener('click', () => setDefaultLayoutClick());

elem.layout.revertLayout.addEventListener('click', () => revertLayoutClick());

elem.layout.setLayoutBoxInclusionRuleMajority.addEventListener('click', () => setLayoutBoxInclusionRuleClick('majority'));
elem.layout.setLayoutBoxInclusionRuleLeft.addEventListener('click', () => setLayoutBoxInclusionRuleClick('left'));

elem.layout.setLayoutBoxInclusionLevelWord.addEventListener('click', () => setLayoutBoxInclusionLevelClick('word'));
elem.layout.setLayoutBoxInclusionLevelLine.addEventListener('click', () => setLayoutBoxInclusionLevelClick('line'));

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));
ignorePunctElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));
ignoreCapElem.addEventListener('change', () => { renderPageQueue(cp.n); });

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreExtra'));
ignoreExtraElem.addEventListener('change', () => { renderPageQueue(cp.n); });

elem.download.pdfPageMin.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

elem.download.pdfPageMax.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

pageNumElem.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    displayPage(parseInt(pageNumElem.value) - 1);
  }
});

// If "Reflow Text" is turned off, then pages will automatically have line breaks between them
elem.download.reflowCheckbox.addEventListener('click', () => {
  if (elem.download.reflowCheckbox.checked) {
    elem.download.pageBreaksCheckbox.disabled = false;
  } else {
    elem.download.pageBreaksCheckbox.disabled = true;
    elem.download.pageBreaksCheckbox.checked = true;
  }
});

// If "Reflow Text" is turned off, then pages will automatically have line breaks between them
elem.download.docxReflowCheckbox.addEventListener('click', () => {
  if (elem.download.docxReflowCheckbox.checked) {
    elem.download.docxPageBreaksCheckbox.disabled = false;
  } else {
    elem.download.docxPageBreaksCheckbox.disabled = true;
    elem.download.docxPageBreaksCheckbox.checked = true;
  }
});

elem.nav.prevMatch.addEventListener('click', () => prevMatchClick());
elem.nav.nextMatch.addEventListener('click', () => nextMatchClick());

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

  elem.nav.matchCurrent.textContent = calcMatchNumber(cp.n);
  elem.nav.matchCount.textContent = String(search.total);
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

  ScribeCanvas.getKonvaWords().forEach((wordObj) => {
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

    elem.nav.matchCurrent.textContent = calcMatchNumber(cp.n);
    elem.nav.matchCount.textContent = String(search.total);
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

elem.download.xlsxFilenameColumn.addEventListener('click', updateDataPreview);
elem.download.xlsxPageNumberColumn.addEventListener('click', updateDataPreview);

/**
 * Initialize a new version of OCR data (Legacy, LSTM, etc.).
 * @param {string} label
 */
export function initOCRVersion(label) {
  // Initialize a new array on `ocrAll` if one does not already exist
  if (!ocrAll[label]) {
    ocrAll[label] = Array(state.pageCount);
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
  ScribeCanvas.mode = 'select';
}, true);

// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
const navRecognizeElem = /** @type {HTMLDivElement} */(document.getElementById('nav-recognize'));
navRecognizeElem.addEventListener('hidden.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-recognize') {
    ProgressBars.eval.hide();
    ProgressBars.recognize.hide();
  }
});

elem.download.download.addEventListener('hidden.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-download') {
    ProgressBars.download.hide();
  }
});

const navLayoutElem = /** @type {HTMLDivElement} */(document.getElementById('nav-layout'));
navLayoutElem.addEventListener('show.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    state.layoutMode = true;
    // Generally we handle drawing manually, however `autoDrawEnabled` is needed for the user to drag layout boxes.
    Konva.autoDrawEnabled = true;
    if (!LayoutRegions.pages[cp.n]) return;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!elem.view.autoRotateCheckbox.checked) {
      renderPageQueue(cp.n);
    } else {
      toggleSelectableWords(false);
      ScribeCanvas.destroyControls();
      renderLayoutBoxes();
    }
  }
});

navLayoutElem.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    state.layoutMode = false;
    Konva.autoDrawEnabled = false;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!elem.view.autoRotateCheckbox.checked) {
      renderPageQueue(cp.n);
    } else {
      toggleSelectableWords(true);
      ScribeCanvas.destroyRegions();
      ScribeCanvas.destroyLayoutDataTables();
      ScribeCanvas.destroyControls();
      setWordColorOpacity();
      layerOverlay.batchDraw();
      layerText.batchDraw();
    }
  }
});

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
  elem.view.displayMode.add(option);

  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = false;

  inputData.evalMode = true;

  // Calculate statistics
  compareGroundTruthClick(cp.n);
}

let evalStatsConfig = {};

async function compareGroundTruthClick(n) {
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  // When a document/recognition is still loading only the page statistics can be calculated
  const loadMode = !!(state.loadCount && state.loadCount < state.pageCount);

  const evalStatsConfigNew = {
    ocrActive: displayLabelTextElem.innerHTML,
    ignorePunct: ignorePunctElem.checked,
    ignoreCap: ignoreCapElem.checked,
    ignoreExtra: ignoreExtraElem.checked,
  };
  /** @type {Parameters<import('./js/generalWorkerMain.js').GeneralScheduler['compareOCR']>[0]['options']} */
  const compOptions = {
    ignoreCap: ignoreCapElem.checked,
    ignorePunct: ignorePunctElem.checked,
    confThreshHigh: parseInt(elem.info.confThreshHigh.value),
    confThreshMed: parseInt(elem.info.confThreshMed.value),
  };

  // Compare all pages if this has not been done already
  if (!loadMode && JSON.stringify(evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || evalStats.length === 0) {
  // Render binarized versions of images
    await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, true);

    for (let i = 0; i < ImageCache.pageCount; i++) {
      const imgBinary = await ImageCache.getBinary(n);

      const res = await gs.scheduler.compareOCR({
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

      if (res.metrics) evalStats[i] = res.metrics;
    }
    evalStatsConfig = evalStatsConfigNew;
  }

  const imgBinary = await ImageCache.getBinary(n);

  const res = await gs.scheduler.compareOCR({
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

  if (res.metrics) evalStats[n] = res.metrics;

  const metricTotalWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsPage'));
  const metricCorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsPage'));
  const metricIncorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsPage'));
  const metricMissedWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsPage'));
  const metricExtraWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsPage'));
  const metricCorrectLowConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsPage'));
  const metricIncorrectHighConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsPage'));

  const metricWERPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERPage'));

  // Display metrics for current page
  metricTotalWordsPageElem.innerHTML = String(evalStats[n].total);
  metricCorrectWordsPageElem.innerHTML = String(evalStats[n].correct);
  metricIncorrectWordsPageElem.innerHTML = String(evalStats[n].incorrect);
  metricMissedWordsPageElem.innerHTML = String(evalStats[n].missed);
  metricExtraWordsPageElem.innerHTML = String(evalStats[n].extra);
  metricCorrectLowConfWordsPageElem.innerHTML = String(evalStats[n].correctLowConf);
  metricIncorrectHighConfWordsPageElem.innerHTML = String(evalStats[n].incorrectHighConf);

  if (evalStatsConfigNew.ignoreExtra) {
    metricWERPageElem.innerHTML = (Math.round(((evalStats[n].incorrect + evalStats[n].missed) / evalStats[n].total) * 100) / 100).toString();
  } else {
    metricWERPageElem.innerHTML = (Math.round(((evalStats[n].incorrect + evalStats[n].missed + evalStats[n].extra)
    / evalStats[n].total) * 100) / 100).toString();
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

    for (let i = 0; i < evalStats.length; i++) {
      evalStatsDoc.total += evalStats[i].total;
      evalStatsDoc.correct += evalStats[i].correct;
      evalStatsDoc.incorrect += evalStats[i].incorrect;
      evalStatsDoc.missed += evalStats[i].missed;
      evalStatsDoc.extra += evalStats[i].extra;
      evalStatsDoc.correctLowConf += evalStats[i].correctLowConf;
      evalStatsDoc.incorrectHighConf += evalStats[i].incorrectHighConf;
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

// Resets the environment.
async function clearFiles() {
  clearData();
  clearUI();
}

async function clearUI() {
  cp.n = 0;

  state.loadCount = 0;

  stage.clear();
  elem.nav.pageCount.textContent = '';
  pageNumElem.value = '';
  elem.download.downloadFileName.value = '';
  // uploaderElem.value = "";
  elem.view.optimizeFont.checked = false;
  elem.view.optimizeFont.disabled = true;
  elem.download.download.disabled = true;
  elem.info.addOverlayCheckbox.disabled = true;
  elem.info.confThreshHigh.disabled = true;
  elem.info.confThreshMed.disabled = true;
  elem.recognize.recognizeAll.disabled = true;
  // recognizePageElem.disabled = true;
  recognizeAreaElem.disabled = true;
  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = true;
  uploadOCRButtonElem.disabled = true;
  elem.layout.addLayoutBox.disabled = true;
  elem.layout.setDefaultLayout.disabled = true;
  elem.layout.revertLayout.disabled = true;
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
  if (!ocrData.abbyyMode && !ocrData.stextMode && elem.info.confThreshHigh.disabled) {
    elem.info.confThreshHigh.disabled = false;
    elem.info.confThreshMed.disabled = false;
    elem.info.confThreshHigh.value = '85';
    elem.info.confThreshMed.value = '75';
  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (ImageCache.pageCount !== pageCountHOCR) {
    const warningHTML = `Page mismatch detected. Image data has ${ImageCache.pageCount} pages while OCR data has ${pageCountHOCR} pages.`;
    insertAlertMessage(warningHTML, false);
  }

  state.loadCount = 0;
  ProgressBars.eval.show(pageCountHOCR);

  toggleEditButtons(false);

  /** @type {("hocr" | "abbyy" | "stext")} */
  let format = 'hocr';
  if (ocrData.abbyyMode) format = 'abbyy';
  if (ocrData.stextMode) format = 'stext';

  convertOCRAllBrowser(ocrData.hocrRaw, false, format, ocrName);

  uploadOCRNameElem.value = '';
  uploadOCRFileElem.value = '';
  // eslint-disable-next-line no-new
  new Collapse(uploadOCRDataElem, { toggle: true });

  initOCRVersion(ocrName);
  setCurrentHOCR(ocrName);
  displayLabelTextElem.disabled = true;
}

state.pageCount = 0;

async function importFiles(curFiles) {
  if (!curFiles || curFiles.length === 0) return;

  state.downloadReady = false;

  pageMetricsArr.length = 0;

  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  /** @type {Array<File>} */
  const imageFilesAll = [];
  /** @type {Array<File>} */
  const hocrFilesAll = [];
  /** @type {Array<File>} */
  const pdfFilesAll = [];
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
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  imageFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));
  hocrFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));

  if (pdfFilesAll.length === 0 && imageFilesAll.length === 0 && hocrFilesAll.length === 0) {
    const errorText = 'No supported files found.';
    insertAlertMessage(errorText);
    return;
  } if (unsupportedFilesAll.length > 0) {
    const errorText = `Import includes unsupported file types: ${Object.keys(unsupportedExt).join(', ')}`;
    insertAlertMessage(errorText, false);
  } else if (pdfFilesAll.length > 0 && imageFilesAll.length > 0) {
    const errorText = 'PDF and image files cannot be imported together. Only first PDF file will be imported.';
    insertAlertMessage(errorText, false);
    pdfFilesAll.length = 1;
    imageFilesAll.length = 0;
  } else if (pdfFilesAll.length > 1) {
    const errorText = 'Multiple PDF files are not supported. Only first PDF file will be imported.';
    insertAlertMessage(errorText, false);
    pdfFilesAll.length = 1;
    imageFilesAll.length = 0;
  }

  inputData.pdfMode = pdfFilesAll.length === 1;
  inputData.imageMode = !!(imageFilesAll.length > 0 && !inputData.pdfMode);
  ImageCache.inputModes.image = !!(imageFilesAll.length > 0 && !inputData.pdfMode);

  const xmlModeImport = hocrFilesAll.length > 0;

  // Extract text from PDF document
  // Only enabled if (1) user selects this option, (2) user uploads a PDF, and (3) user does not upload XML data.
  inputData.extractTextMode = extractTextCheckboxElem.checked && inputData.pdfMode && !xmlModeImport;
  const stextModeExtract = inputData.extractTextMode;

  elem.layout.addLayoutBox.disabled = false;
  elem.layout.setDefaultLayout.disabled = false;
  elem.layout.revertLayout.disabled = false;

  if (inputData.imageMode || inputData.pdfMode) {
    elem.recognize.recognizeAll.disabled = false;
    // recognizePageElem.disabled = false;
    recognizeAreaElem.disabled = false;
    createGroundTruthElem.disabled = false;
    uploadOCRButtonElem.disabled = false;

    // Color vs. grayscale is an option passed to mupdf, so can only be used with pdf inputs
    // Binary images are calculated separately by Leptonica (within Tesseract) so apply to both
    const colorModeOptions = elem.view.colorMode.children;
    while (colorModeOptions.length > 0) {
      colorModeOptions[0].remove();
    }
    if (inputData.imageMode) {
      const option = document.createElement('option');
      option.text = 'Native';
      option.value = 'color';
      option.selected = true;
      elem.view.colorMode.add(option);
    } else {
      let option = document.createElement('option');
      option.text = 'Color';
      option.value = 'color';
      elem.view.colorMode.add(option);
      option = document.createElement('option');
      option.text = 'Grayscale';
      option.value = 'gray';
      option.selected = true;
      elem.view.colorMode.add(option);
    }
    const option = document.createElement('option');
    option.text = 'Binary';
    option.value = 'binary';
    elem.view.colorMode.add(option);

    // For PDF inputs, enable "Add Text to Import PDF" option
    if (inputData.pdfMode) {
      elem.info.addOverlayCheckbox.checked = true;
      elem.info.addOverlayCheckbox.disabled = false;
    } else {
      elem.info.addOverlayCheckbox.checked = false;
      elem.info.addOverlayCheckbox.disabled = true;
    }
  }

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, '');
  downloadFileName += '.pdf';
  elem.download.downloadFileName.value = downloadFileName;

  // The loading bar should be initialized before anything significant runs (e.g. `ImageCache.openMainPDF` to provide some visual feedback).
  // All pages of OCR data and individual images (.png or .jpeg) contribute to the import loading bar.
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  let progressMax = 0;
  if (inputData.imageMode) progressMax += imageFilesAll.length;
  if (xmlModeImport) progressMax += hocrFilesAll.length;

  // Loading bars are necessary for automated testing as the tests wait for the loading bar to fill up.
  // Therefore, a dummy loading bar with a max of 1 is created even when progress is not meaningfully tracked.
  let dummyLoadingBar = false;
  if (progressMax === 0) {
    dummyLoadingBar = true;
    progressMax = 1;
  }

  ProgressBars.import.show(progressMax);

  let pageCount;
  let pageCountImage;
  let abbyyMode = false;
  let scribeMode = false;

  if (inputData.pdfMode) {
    const pdfFile = pdfFilesAll[0];
    inputData.inputFileNames = [pdfFile.name];

    const skipText = omitNativeTextCheckboxElem.checked;

    // Start loading mupdf workers as soon as possible, without waiting for `pdfFile.arrayBuffer` (which can take a while).
    ImageCache.getMuPDFScheduler();

    const pdfFileData = await pdfFile.arrayBuffer();

    // If no XML data is provided, page sizes are calculated using muPDF alone
    await ImageCache.openMainPDF(pdfFileData, skipText, !xmlModeImport, stextModeExtract);

    pageCountImage = ImageCache.pageCount;
  } else if (inputData.imageMode) {
    inputData.inputFileNames = imageFilesAll.map((x) => x.name);
    pageCountImage = imageFilesAll.length;
  }

  let existingLayout = false;
  let existingLayoutDataTable = false;
  let existingOpt = false;
  const oemName = 'User Upload';
  let stextMode;

  if (xmlModeImport || inputData.extractTextMode) {
    document.getElementById('combineModeOptions')?.setAttribute('style', '');

    initOCRVersion(oemName);
    setCurrentHOCR(oemName);

    displayLabelTextElem.innerHTML = oemName;

    let stextModeImport;
    if (xmlModeImport) {
      const ocrData = await importOCRFiles(Array.from(hocrFilesAll), true);

      ocrAllRaw.active = ocrData.hocrRaw;
      // Subset OCR data to avoid uncaught error that occurs when there are more pages of OCR data than image data.
      // While this should be rare, it appears to be fairly common with Archive.org documents.
      // TODO: Add warning message displayed to user for this.
      if (pageCountImage && ocrAllRaw.active.length > pageCountImage) {
        console.log(`Identified ${ocrAllRaw.active.length} pages of OCR data but ${pageCountImage} pages of image/pdf data. Only first ${pageCountImage} pages will be used.`);
        ocrAllRaw.active = ocrAllRaw.active.slice(0, pageCountImage);
      }

      // Restore font metrics and optimize font from previous session (if applicable)
      if (ocrData.fontMetricsObj && Object.keys(ocrData.fontMetricsObj).length > 0) {
        existingOpt = true;

        replaceObjectProperties(fontMetricsObj, ocrData.fontMetricsObj);
        await gs.schedulerReady;
        setDefaultFontAuto(fontMetricsObj);

        // If `ocrData.enableOpt` is `false`, then the metrics are present but ignored.
        // This occurs if optimization was found to decrease accuracy for both sans and serif,
        // not simply because the user disabled optimization in the view settings.
        // If no `enableOpt` property exists but metrics are present, then optimization is enabled.
        if (ocrData.enableOpt === 'false') {
          elem.view.optimizeFont.disabled = true;
          elem.view.optimizeFont.checked = false;
        } else {
          const fontRaw = fontAll.getContainer('raw');
          if (!fontRaw) throw new Error('Raw font data not found.');
          fontAll.opt = await optimizeFontContainerAll(fontRaw, fontMetricsObj);
          elem.view.optimizeFont.disabled = false;
          elem.view.optimizeFont.checked = true;
          await enableDisableFontOpt(true);
        }
      }

      if (ocrData.defaultFont) fontAll.defaultFontName = ocrData.defaultFont;

      if (ocrData.sansFont) {
        fontAll.sansDefaultName = ocrData.sansFont;
      }

      if (ocrData.serifFont) {
        fontAll.serifDefaultName = ocrData.serifFont;
      }

      // Restore layout data from previous session (if applicable)
      if (ocrData.layoutObj) {
        for (let i = 0; i < ocrData.layoutObj.length; i++) {
          LayoutRegions.pages[i] = ocrData.layoutObj[i];
        }
        existingLayout = true;
      }

      if (ocrData.layoutDataTableObj) {
        for (let i = 0; i < ocrData.layoutDataTableObj.length; i++) {
          LayoutDataTables.pages[i] = ocrData.layoutDataTableObj[i];
        }
        existingLayoutDataTable = true;
      }

      stextModeImport = ocrData.stextMode;
      abbyyMode = ocrData.abbyyMode;
      scribeMode = ocrData.scribeMode;
    }

    // stext may be imported or extracted from an input PDF
    stextMode = stextModeExtract || stextModeImport;

    // Enable confidence threshold input boxes (only used for Tesseract)
    if (!abbyyMode && !stextMode) {
      elem.info.confThreshHigh.disabled = false;
      elem.info.confThreshMed.disabled = false;
      elem.info.confThreshHigh.value = '85';
      elem.info.confThreshMed.value = '75';
    }
  }

  const pageCountHOCR = ocrAllRaw.active?.length;

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (xmlModeImport && (inputData.imageMode || inputData.pdfMode)) {
    if (pageCountImage !== pageCountHOCR) {
      const warningHTML = `Page mismatch detected. Image data has ${pageCountImage} pages while OCR data has ${pageCountHOCR} pages.`;
      insertAlertMessage(warningHTML, false);
    }
  }

  state.pageCount = pageCountImage ?? pageCountHOCR;

  ocrAllRaw.active = ocrAllRaw.active || Array(pageCount);

  if (!existingLayout) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutRegions.pages[i] = new LayoutPage();
    }
  }

  if (!existingLayoutDataTable) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutDataTables.pages[i] = new LayoutDataTablePage();
    }
  }

  inputData.xmlMode = new Array(state.pageCount);
  if (xmlModeImport || inputData.extractTextMode) {
    inputData.xmlMode.fill(true);
  } else {
    inputData.xmlMode.fill(false);
  }

  if (inputData.pdfMode && !xmlModeImport) {
    // Render first handful of pages for pdfs so the interface starts off responsive
    // In the case of OCR data, this step is triggered elsewhere after all the data loads
    displayPage(0);
  }

  state.loadCount = 0;

  if (inputData.imageMode) {
    ImageCache.pageCount = state.pageCount;
    for (let i = 0; i < state.pageCount; i++) {
    // Currently, images are loaded once at a time.
    // While this is not optimal for performance, images are required for comparison functions,
    // so switching to running async would require either (1) waiting for enough images to load before before continuing to the next step
    // or (2) switching imageAll["nativeSrcStr"], as a whole, to store promises that can be waited for.
      ImageCache.nativeSrc[i] = new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Using MIME sniffing might be slightly more accurate than using the file extension,
        // however for now the file extension is used to ensure equivalent behavior between Node.js and browser versions.
        const format = imageFilesAll[i].name.match(/jpe?g$/i) ? 'jpeg' : 'png';

        reader.onloadend = async () => {
          const imgWrapper = new ImageWrapper(i, reader.result, format, 'native', false, false);
          const imageDims = await imageUtils.getDims(imgWrapper);
          pageMetricsArr[i] = new PageMetrics(imageDims);
          if (i === 0) displayPage(0);
          ProgressBars.import.increment();
          resolve(imgWrapper);

          if (!xmlModeImport && ProgressBars.import.value === ProgressBars.import.maxValue) {
            elem.download.download.disabled = false;
            state.downloadReady = true;
          }
        };

        reader.onerror = (error) => {
          reject(error);
        };

        reader.readAsDataURL(imageFilesAll[i]);
      });
    }
  }

  if (xmlModeImport || inputData.extractTextMode) {
    toggleEditButtons(false);
    /** @type {("hocr" | "abbyy" | "stext")} */
    let format = 'hocr';
    if (abbyyMode) format = 'abbyy';
    if (stextMode) format = 'stext';

    // Process HOCR using web worker, reading from file first if that has not been done already
    convertOCRAllBrowser(ocrAllRaw.active, true, format, oemName, scribeMode).then(async () => {
      // Skip this step if optimization info was already restored from a previous session.
      if (!existingOpt) {
        await checkCharWarn(state.convertPageWarn);
        calcFontMetricsFromPages(ocrAll.active);
        await runFontOptimizationBrowser(ocrAll.active);
      }
      elem.download.download.disabled = false;
      state.downloadReady = true;
    });
  }

  if (dummyLoadingBar) ProgressBars.active.increment();

  // Enable downloads now for pdf imports if no HOCR data exists
  if (inputData.pdfMode && !xmlModeImport) {
    elem.download.download.disabled = false;
    state.downloadReady = true;
  }

  pageNumElem.value = '1';
  elem.nav.pageCount.textContent = String(state.pageCount);

  // Start loading Tesseract if it was not already loaded.
  // Tesseract is not loaded on startup, however if the user uploads data, they presumably want to run something that requires Tesseract.
  await initTesseractInWorkers({ anyOk: true, vanillaMode: opt.vanillaMode, langs: opt.langs });
}

// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n) {
  let ocrData = ocrAll.active?.[n];

  // Return early if there is not enough data to render a page yet
  // (0) Necessary info is not defined yet
  const noInfo = inputData.xmlMode[n] === undefined;
  // (1) No data has been imported
  const noInput = !inputData.xmlMode[n] && !(inputData.imageMode || inputData.pdfMode);
  // (2) XML data should exist but does not (yet)
  const xmlMissing = inputData.xmlMode[n]
    && (ocrData === undefined || ocrData === null || pageMetricsArr[n].dims === undefined);

  const imageMissing = false;
  const pdfMissing = false;

  if (noInfo || noInput || xmlMissing || imageMissing || pdfMissing) {
    console.log('Exiting renderPageQueue early');
    return;
  }

  const renderItI = state.renderIt + 1;
  state.renderIt = renderItI;

  // If a page is already being rendered, wait for it to complete
  await state.pageRendering;
  // If another page has been requested already, return early
  if (state.renderIt !== renderItI) return;

  state.pageRendering = new Promise((resolve, reject) => {
    state.promiseResolve = resolve;
  });

  if (inputData.evalMode) {
    await compareGroundTruthClick(n);
    // ocrData must be re-assigned after comparing to ground truth or it will not update.
    ocrData = ocrAll.active?.[n];
  }

  ScribeCanvas.destroyWords();

  // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
  // (whether by quickly changing pages or on the same page).
  // TODO: Find a better solution.
  cp.renderNum += 1;
  const renderNum = cp.renderNum;

  // The active OCR version may have changed, so this needs to be re-checked.
  if (cp.n === n && inputData.xmlMode[n]) {
    renderPage(ocrData);
    if (cp.n === n && cp.renderNum === renderNum) {
      await selectDisplayMode(getDisplayMode());
    }
  } else {
    await selectDisplayMode(getDisplayMode());
  }

  // @ts-ignore
  state.promiseResolve();
}

let working = false;

/**
 * Render page `n` in the UI.
 * @param {number} n
 * @returns
 */
export async function displayPage(n) {
  // Return early if (1) page does not exist or (2) another page is actively being rendered.
  if (Number.isNaN(n) || n < 0 || n > (state.pageCount - 1) || working) {
    // Reset the value of pageNumElem (number in UI) to match the internal value of the page
    pageNumElem.value = (cp.n + 1).toString();
    return;
  }

  working = true;

  if (inputData.xmlMode[cp.n]) {
    // TODO: This is currently run whenever the page is changed.
    // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
    updateFindStats();
  }

  elem.nav.matchCurrent.textContent = calcMatchNumber(n);

  cp.n = n;
  pageNumElem.value = (cp.n + 1).toString();

  await renderPageQueue(cp.n);

  if (showConflictsElem.checked) showDebugImages();

  // Render background images ahead and behind current page to reduce delay when switching pages
  if (inputData.pdfMode || inputData.imageMode) ImageCache.preRenderAheadBehindBrowser(n, elem.view.colorMode.value === 'binary');

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
    elem.view.optimizeFont.disabled = false;
    elem.view.optimizeFont.checked = true;
  } else {
    elem.view.optimizeFont.disabled = true;
    elem.view.optimizeFont.checked = false;
  }
  renderPageQueue(cp.n);
}

// Set default settings
setDefaults();
