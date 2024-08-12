/* eslint-disable import/no-cycle */

import { Collapse, Tooltip } from './lib/bootstrap.esm.bundle.min.js';
import Konva from './lib/konva/index.js';

import { recognizeAllClick } from './gui/interfaceRecognize.js';

import { handleDownloadGUI, setFormatLabel, updatePdfPagesLabel } from './gui/interfaceDownload.js';

import {
  enableDisableFontOpt,
} from './js/fontContainerMain.js';

import scribe from './module.js';

import { getAllFileEntries } from './gui/utils/dragAndDrop.js';
import { insertAlertMessage } from './gui/utils/warningMessages.js';

import { selectDisplayMode, setWordColorOpacity } from './gui/interfaceView.js';

import {
  adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange,
  changeWordFontFamily,
  changeWordFontSize,
  deleteSelectedWords,
  toggleEditButtons,
} from './gui/interfaceEdit.js';

import {
  renderLayoutBoxes,
  revertLayoutClick,
  setDefaultLayoutClick,
  setLayoutBoxInclusionLevelClick,
  setLayoutBoxInclusionRuleClick,
  toggleSelectableWords,
} from './gui/interfaceLayout.js';

import {
  layerOverlay,
  layerText,
  renderPage,
  ScribeCanvas,
  stage,
} from './gui/interfaceCanvas.js';

import {
  downloadCanvas,
  downloadCurrentImage,
  evalSelectedLine,
  printSelectedWords,
  showDebugImages,
} from './gui/interfaceDebug.js';

import { elem } from './gui/elems.js';
import {
  getLayerCenter, setCanvasWidthHeightZoom, zoomAllLayers,
} from './gui/interfaceCanvasInteraction.js';
import { compareGroundTruthClick, createGroundTruthClick } from './gui/interfaceEvaluate.js';
import { optGUI, setDefaults } from './gui/options.js';
import { ProgressBars } from './gui/utils/progressBars.js';
import { showHideElem } from './gui/utils/utils.js';
import { df } from './js/debugGlobals.js';

globalThis.df = df;

globalThis.d = () => {
  debugger;
};

export class stateGUI {
  static pageRendering = Promise.resolve(true);

  static renderIt = 0;

  static canvasDimsN = -1;

  /** @type {?Function} */
  static promiseResolve = null;

  static recognizeAllPromise = Promise.resolve();

  static layoutMode = false;

  static cp = {
    n: 0,
    backgroundOpts: { stroke: '#3d3d3d', strokeWidth: 3 },
    renderStatus: 0,
    renderNum: 0,
  };
}

/**
 *
 * @param {number} n
 * @param {string} engineName
 */
const recognizeConvertCallback = (n, engineName) => {
  // Display the page if either (1) this is the currently active OCR or (2) this is Tesseract Legacy and Tesseract LSTM is active, but does not exist yet.
  // The latter condition occurs briefly whenever recognition is run in "Quality" mode.
  const oemActive = Object.keys(scribe.data.ocr).find((key) => scribe.data.ocr[key] === scribe.data.ocr.active && key !== 'active');
  const displayOCR = engineName === oemActive || ['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName) && oemActive === 'Tesseract Latest';

  if (displayOCR && stateGUI.cp.n === n) displayPage(n, true);
};

scribe.opt.recognizeConvertCallback = recognizeConvertCallback;

scribe.opt.saveDebugImages = true;

scribe.init({ font: true });

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

elem.info.omitNativeTextCheckbox.addEventListener('click', () => {
  scribe.opt.omitNativeText = elem.info.omitNativeTextCheckbox.checked;
});

elem.info.extractTextCheckbox.addEventListener('click', () => {
  scribe.opt.extractText = elem.info.extractTextCheckbox.checked;
});

elem.download.addOverlayCheckbox.addEventListener('click', () => {
  scribe.opt.addOverlay = elem.download.addOverlayCheckbox.checked;
});

elem.download.standardizePageSize.addEventListener('click', () => {
  scribe.opt.standardizePageSize = elem.download.standardizePageSize.checked;
});

elem.info.humanReadablePDF.addEventListener('click', () => {
  scribe.opt.humanReadablePDF = elem.info.humanReadablePDF.checked;
});

elem.info.intermediatePDF.addEventListener('click', () => {
  scribe.opt.intermediatePDF = elem.info.intermediatePDF.checked;
});

elem.view.displayMode.addEventListener('change', () => {
  scribe.opt.displayMode = /** @type {"invis" | "ebook" | "eval" | "proof"} */(elem.view.displayMode.value);
  if (elem.view.displayMode.value === 'eval') {
    renderPageQueue(stateGUI.cp.n);
  } else {
    selectDisplayMode(scribe.opt.displayMode);
  }
});

scribe.opt.warningHandler = (x) => insertAlertMessage(x, false);
scribe.opt.errorHandler = insertAlertMessage;

// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.forEach((tooltipTriggerEl) => new Tooltip(tooltipTriggerEl));

const zone = /** @type {HTMLInputElement} */ (document.getElementById('uploadDropZone'));

const openFileInputElem = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
openFileInputElem.addEventListener('change', () => {
  if (!openFileInputElem.files || openFileInputElem.files.length === 0) return;

  importFilesGUI(openFileInputElem.files);
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

  importFilesGUI(files);

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
  // Call the existing importFiles function with the file array
  importFilesGUI(urls);

  zone.setAttribute('style', 'display:none');
};

/**
 * Maps from generic `KeyboardEvent` when user presses a key to the appropriate action.
 * This function is responsible for all keyboard shortcuts.
 * @param {KeyboardEvent} event - The key down event.
 */
function handleKeyboardEvent(event) {
  // Zoom in shortcut
  if (event.ctrlKey && ['+', '='].includes(event.key)) {
    zoomAllLayers(1.1, getLayerCenter(layerText));
    layerText.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
    return;
  }

  // Zoom out shortcut
  if (event.ctrlKey && ['-', '_'].includes(event.key)) {
    zoomAllLayers(1.1, getLayerCenter(layerText));
    layerText.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
    return;
  }

  // Prev page shortcut
  if (event.key === 'PageUp') {
    displayPage(stateGUI.cp.n - 1);
    event.preventDefault();
    return;
  }

  // Next page shortcut
  if (event.key === 'PageDown') {
    displayPage(stateGUI.cp.n + 1);
    event.preventDefault();
    return;
  }
}

// Add various keyboard shortcuts.
document.addEventListener('keydown', handleKeyboardEvent);

// Add various event listners to HTML elements
elem.nav.next.addEventListener('click', () => displayPage(stateGUI.cp.n + 1));
elem.nav.prev.addEventListener('click', () => displayPage(stateGUI.cp.n - 1));

elem.nav.zoomIn.addEventListener('click', () => {
  zoomAllLayers(1.1, getLayerCenter(layerText));
});

elem.nav.zoomOut.addEventListener('click', () => {
  zoomAllLayers(0.9, getLayerCenter(layerText));
});

elem.view.colorMode.addEventListener('change', () => {
  scribe.opt.colorMode = /** @type {"color" | "gray" | "binary"} */ (elem.view.colorMode.value);
  renderPageQueue(stateGUI.cp.n);
});

elem.view.overlayOpacity.addEventListener('input', () => {
  scribe.opt.overlayOpacity = parseInt(elem.view.overlayOpacity.value);
  setWordColorOpacity();
  layerText.batchDraw();
});

elem.recognize.enableUpscale.addEventListener('click', () => {
  scribe.opt.enableUpscale = elem.recognize.enableUpscale.checked;
});

const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
showDebugVisElem.addEventListener('change', () => {
  scribe.opt.debugVis = showDebugVisElem.checked;
  renderPageQueue(stateGUI.cp.n);
});

elem.info.showDebugLegend.addEventListener('change', () => { renderPageQueue(stateGUI.cp.n); });

elem.info.showDebugLegend.addEventListener('input', () => {
  const legendCanvasParentDivElem = /** @type {HTMLDivElement} */(document.getElementById('legendCanvasParentDiv'));
  if (!elem.info.showDebugLegend.checked) {
    showHideElem(legendCanvasParentDivElem, false);
  } else {
    showHideElem(legendCanvasParentDivElem, true);
  }
  if (scribe.data.pageMetrics[stateGUI.cp.n]?.dims) setCanvasWidthHeightZoom(scribe.data.pageMetrics[stateGUI.cp.n].dims, false);
});

elem.info.selectDebugVis.addEventListener('change', () => { renderPageQueue(stateGUI.cp.n); });

elem.evaluate.createGroundTruth.addEventListener('click', createGroundTruthClick);

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

elem.info.enableLayout.addEventListener('click', () => {
  scribe.opt.enableLayout = elem.info.enableLayout.checked;
  showHideElem(/** @type {HTMLDivElement} */(document.getElementById('nav-layout-tab')), elem.info.enableLayout.checked);
});

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!elem.info.enableLayout.checked) elem.info.enableLayout.click();

  showHideElem(elem.download.formatLabelOptionXlsx, elem.info.enableXlsxExport.checked);
  showHideElem(elem.info.dataTableOptions, elem.info.enableXlsxExport.checked);
};

elem.info.enableXlsxExport.addEventListener('click', enableXlsxExportClick);

const uploadOCRNameElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRName'));
const uploadOCRFileElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRFile'));

elem.evaluate.uploadOCRButton.addEventListener('click', importFilesSuppGUI);

// const uploadOCRLabelElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRLabel'));
const uploadOCRDataElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRData'));

uploadOCRDataElem.addEventListener('show.bs.collapse', () => {
  if (!uploadOCRNameElem.value) {
    uploadOCRNameElem.value = `OCR Data ${elem.evaluate.displayLabelOptions.childElementCount + 1}`;
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

elem.info.confThreshHigh.addEventListener('change', () => {
  scribe.opt.confThreshHigh = parseInt(elem.info.confThreshHigh.value);
  renderPageQueue(stateGUI.cp.n);
});
elem.info.confThreshMed.addEventListener('change', () => {
  scribe.opt.confThreshMed = parseInt(elem.info.confThreshMed.value);
  renderPageQueue(stateGUI.cp.n);
});

elem.view.autoRotate.addEventListener('click', () => {
  scribe.opt.autoRotate = elem.view.autoRotate.checked;
  renderPageQueue(stateGUI.cp.n);
});

elem.view.outlineWords.addEventListener('click', () => { renderPageQueue(stateGUI.cp.n); });
elem.view.outlineLines.addEventListener('click', () => { renderPageQueue(stateGUI.cp.n); });
elem.view.outlinePars.addEventListener('click', () => { renderPageQueue(stateGUI.cp.n); });

elem.evaluate.displayLabelOptions.addEventListener('click', (e) => {
  // The elements this event are intended for are the individual elements of the list (not `displayLabelOptionsElem`),
  // which do not exist yet at this point in the code.
  // @ts-ignore
  if (e.target.className !== 'dropdown-item') return;
  // @ts-ignore
  setCurrentHOCR(e.target.innerHTML);
});

elem.download.download.addEventListener('click', handleDownloadGUI);
elem.download.pdfPagesLabel.addEventListener('click', updatePdfPagesLabel);

elem.download.formatLabelOptionPDF.addEventListener('click', () => { setFormatLabel('pdf'); });
elem.download.formatLabelOptionHOCR.addEventListener('click', () => { setFormatLabel('hocr'); });
elem.download.formatLabelOptionText.addEventListener('click', () => { setFormatLabel('text'); });
elem.download.formatLabelOptionDocx.addEventListener('click', () => { setFormatLabel('docx'); });
elem.download.formatLabelOptionXlsx.addEventListener('click', () => { setFormatLabel('xlsx'); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));
showConflictsElem.addEventListener('input', () => {
  if (showConflictsElem.checked) showDebugImages();
  setCanvasWidthHeightZoom(scribe.data.pageMetrics[stateGUI.cp.n].dims, showConflictsElem.checked);
});

elem.recognize.recognizeAll.addEventListener('click', () => {
  stateGUI.recognizeAllPromise = recognizeAllClick();
});

elem.edit.recognizeArea.addEventListener('click', () => (ScribeCanvas.mode = 'recognizeArea'));
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

elem.evaluate.ignorePunct.addEventListener('change', () => {
  scribe.opt.ignorePunct = elem.evaluate.ignorePunct.checked;
  renderPageQueue(stateGUI.cp.n);
});

elem.evaluate.ignoreCap.addEventListener('change', () => {
  scribe.opt.ignoreCap = elem.evaluate.ignoreCap.checked;
  renderPageQueue(stateGUI.cp.n);
});

elem.evaluate.ignoreExtra.addEventListener('change', () => {
  scribe.opt.ignoreExtra = elem.evaluate.ignoreExtra.checked;
  renderPageQueue(stateGUI.cp.n);
});

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

elem.nav.pageNum.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    displayPage(parseInt(elem.nav.pageNum.value) - 1);
  }
});

elem.download.xlsxFilenameColumn.addEventListener('click', () => {
  scribe.opt.xlsxFilenameColumn = elem.download.xlsxFilenameColumn.checked;
});

elem.download.xlsxPageNumberColumn.addEventListener('click', () => {
  scribe.opt.xlsxPageNumberColumn = elem.download.xlsxPageNumberColumn.checked;
});

// TODO: Make one of these swtiches impact the other, so that they can be tied to a single option in `opt`.

/**
 * @param {boolean} value
 */
const toggleReflow = (value) => {
  scribe.opt.reflow = value;
  // Keep the two reflow checkboxes in sync
  elem.download.reflowCheckbox.checked = value;
  elem.download.docxReflowCheckbox.checked = value;
  // If "Reflow Text" is turned off, then pages will automatically have line breaks between them
  if (value) {
    // elem.download.pageBreaksCheckbox.disabled = false;
    // elem.download.docxPageBreaksCheckbox.disabled = false;
  } else {
    // elem.download.pageBreaksCheckbox.disabled = true;
    // elem.download.pageBreaksCheckbox.checked = true;
    // elem.download.docxPageBreaksCheckbox.disabled = true;
    // elem.download.docxPageBreaksCheckbox.checked = true;
  }
};

elem.download.reflowCheckbox.addEventListener('click', () => {
  toggleReflow(elem.download.reflowCheckbox.checked);
});

elem.download.docxReflowCheckbox.addEventListener('click', () => {
  toggleReflow(elem.download.docxReflowCheckbox.checked);
});

elem.nav.prevMatch.addEventListener('click', () => prevMatchClick());
elem.nav.nextMatch.addEventListener('click', () => nextMatchClick());

export function toggleLayoutButtons(disable = true) {
  elem.layout.addLayoutBox.disabled = disable;
  elem.layout.setDefaultLayout.disabled = disable;
  elem.layout.revertLayout.disabled = disable;
}

export function toggleEditConfUI(disable = true) {
  // Enable confidence threshold input boxes (only used for Tesseract)
  elem.info.confThreshHigh.disabled = disable;
  elem.info.confThreshMed.disabled = disable;

  // Set threshold values if not already set
  elem.info.confThreshHigh.value = elem.info.confThreshHigh.value || '85';
  elem.info.confThreshMed.value = elem.info.confThreshMed.value || '75';
}

export function toggleRecognizeUI(disable = true) {
  elem.recognize.recognizeAll.disabled = disable;
  elem.edit.recognizeArea.disabled = disable;
  elem.evaluate.createGroundTruth.disabled = disable;
  elem.evaluate.uploadOCRButton.disabled = disable;
}

export const addColorModeUI = () => {
  // Color vs. grayscale is an option passed to mupdf, so can only be used with pdf inputs
  // Binary images are calculated separately by Leptonica (within Tesseract) so apply to both
  const colorModeOptions = elem.view.colorMode.children;
  while (colorModeOptions.length > 0) {
    colorModeOptions[0].remove();
  }
  if (scribe.inputData.imageMode) {
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
};

elem.recognize.combineMode.addEventListener('change', () => {
  optGUI.combineMode = /** @type {"data" | "conf"}* */(elem.recognize.combineMode.value);
});

scribe.opt.progress = ProgressBars.import;
scribe.opt.displayFunc = displayPage;

const importFilesGUI = async (files) => {
  scribe.opt.progress = ProgressBars.import;
  await scribe.importFiles(files);

  displayPage(stateGUI.cp.n, true);

  // Start loading Tesseract if it was not already loaded.
  // Tesseract is not loaded on startup, however if the user uploads data, they presumably want to run something that requires Tesseract.
  const ocrParams = { anyOk: true, vanillaMode: optGUI.vanillaMode, langs: optGUI.langs };
  scribe.init({ ocr: true, ocrParams });

  elem.nav.pageNum.value = '1';
  elem.nav.pageCount.textContent = String(scribe.inputData.pageCount);

  // Allow for downloads.
  elem.download.downloadFileName.value = scribe.inputData.defaultDownloadFileName;
  elem.download.download.disabled = false;

  if (scribe.inputData.imageMode || scribe.inputData.pdfMode) {
    toggleRecognizeUI(false);
    addColorModeUI();

    // For PDF inputs, enable "Add Text to Import PDF" option
    if (scribe.inputData.pdfMode) {
      elem.download.addOverlayCheckbox.checked = true;
      elem.download.addOverlayCheckbox.disabled = false;
    } else {
      elem.download.addOverlayCheckbox.checked = false;
      elem.download.addOverlayCheckbox.disabled = true;
    }
  }
  if (scribe.inputData.xmlMode[0] || scribe.inputData.extractTextMode) {
    elem.recognize.combineModeOptions.setAttribute('style', '');
    const oemName = 'User Upload';
    elem.evaluate.displayLabelText.innerHTML = oemName;

    toggleEditButtons(false);
    toggleLayoutButtons(false);
  }

  if (scribe.opt.enableOpt) {
    elem.view.optimizeFont.disabled = false;
    elem.view.optimizeFont.checked = true;
  }
};

// Import supplemental OCR files (from "Evaluate Accuracy" UI tab)
async function importFilesSuppGUI() {
  // TODO: Add input validation for names (e.g. unique, no illegal symbols, not named "Ground Truth" or other reserved name)
  const ocrName = uploadOCRNameElem.value;

  if (!uploadOCRFileElem.files || uploadOCRFileElem.files.length === 0) return;

  scribe.opt.progress = ProgressBars.eval;

  await scribe.importFilesSupp(uploadOCRFileElem.files, ocrName);

  elem.evaluate.displayLabelText.disabled = true;

  toggleEditButtons(false);

  uploadOCRNameElem.value = '';
  uploadOCRFileElem.value = '';
  // eslint-disable-next-line no-new
  new Collapse(uploadOCRDataElem, { toggle: true });

  updateOcrVersionGUI();

  setCurrentHOCR(ocrName);
  elem.evaluate.displayLabelText.disabled = true;
}

function prevMatchClick() {
  if (stateGUI.cp.n === 0) return;
  const lastPage = search.matches.slice(0, stateGUI.cp.n)?.findLastIndex((x) => x > 0);
  if (lastPage > -1) displayPage(lastPage);
}

function nextMatchClick() {
  const nextPageOffset = search.matches.slice(stateGUI.cp.n + 1)?.findIndex((x) => x > 0);
  if (nextPageOffset > -1) displayPage(stateGUI.cp.n + nextPageOffset + 1);
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

  elem.nav.matchCurrent.textContent = calcMatchNumber(stateGUI.cp.n);
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
  const matchIdArr = scribe.utils.ocr.getMatchingWordIds(text, scribe.data.ocr.active[stateGUI.cp.n]);

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
    const n = scribe.utils.countSubstringOccurrences(search.text[i], text);
    matches[i] = n;
    total += n;
  }
  search.matches = matches;
  search.total = total;
}

// Updates data used for "Find" feature on current page
// Should be called after any edits are made, before moving to a different page
function updateFindStats() {
  if (!scribe.data.ocr.active[stateGUI.cp.n]) {
    search.text[stateGUI.cp.n] = '';
    return;
  }

  // Re-extract text from XML
  search.text[stateGUI.cp.n] = scribe.utils.ocr.getPageText(scribe.data.ocr.active[stateGUI.cp.n]);

  if (search.search) {
    // Count matches in current page
    search.matches[stateGUI.cp.n] = scribe.utils.countSubstringOccurrences(search.text[stateGUI.cp.n], search.search);
    // Calculate total number of matches
    search.total = search.matches.reduce((partialSum, a) => partialSum + a, 0);

    elem.nav.matchCurrent.textContent = calcMatchNumber(stateGUI.cp.n);
    elem.nav.matchCount.textContent = String(search.total);
  }
}

// Extract text from XML for every page
// We do this once (and then perform incremental updates) to avoid having to parse XML
// with every search.
function extractTextAll() {
  const maxValue = scribe.data.ocr.active.length;

  for (let g = 0; g < maxValue; g++) {
    search.text[g] = scribe.utils.ocr.getPageText(scribe.data.ocr.active[g]);
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

export function setCurrentHOCR(x) {
  const currentLabel = elem.evaluate.displayLabelText.innerHTML.trim();
  if (!x.trim() || x === currentLabel) return;

  scribe.data.ocr.active = scribe.data.ocr[x];
  elem.evaluate.displayLabelText.innerHTML = x;

  renderPageQueue(stateGUI.cp.n);
}

/**
 * Update the GUI dropdown menu with the latest OCR versions.
 */
export const updateOcrVersionGUI = () => {
  // Skip versions that are already in the dropdown, or are only used under the hood.
  const labelElems = elem.evaluate.displayLabelOptions.children;
  const versionsSkip = [];
  for (let i = 0; i < labelElems.length; i++) {
    versionsSkip.push(labelElems[i].innerHTML);
  }
  versionsSkip.push('Tesseract Latest');
  versionsSkip.push('Tesseract Combined Temp');
  versionsSkip.push('active');

  const ocrVersionsNew = Object.keys(scribe.data.ocr).filter((x) => !versionsSkip.includes(x));

  ocrVersionsNew.forEach((label) => {
    const option = document.createElement('a');
    option.setAttribute('class', 'dropdown-item');
    option.text = label;
    elem.evaluate.displayLabelOptions.appendChild(option);
  });

  const oemActive = Object.keys(scribe.data.ocr).find((key) => scribe.data.ocr[key] === scribe.data.ocr.active && key !== 'active');
  elem.evaluate.displayLabelText.innerHTML = oemActive;
};

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
    stateGUI.layoutMode = true;
    // Generally we handle drawing manually, however `autoDrawEnabled` is needed for the user to drag layout boxes.
    Konva.autoDrawEnabled = true;
    if (!scribe.data.layoutRegions.pages[stateGUI.cp.n]) return;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!scribe.opt.autoRotate) {
      renderPageQueue(stateGUI.cp.n);
    } else {
      toggleSelectableWords(false);
      ScribeCanvas.destroyControls();
      renderLayoutBoxes();
    }
  }
});

navLayoutElem.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    stateGUI.layoutMode = false;
    Konva.autoDrawEnabled = false;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!scribe.opt.autoRotate) {
      renderPageQueue(stateGUI.cp.n);
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

// Resets the environment.
async function clearFiles() {
  scribe.clear();
  clearUI();
}

async function clearUI() {
  stateGUI.cp.n = 0;

  stage.clear();
  elem.nav.pageCount.textContent = '';
  elem.nav.pageNum.value = '';
  elem.download.downloadFileName.value = '';
  elem.view.optimizeFont.checked = false;
  elem.view.optimizeFont.disabled = true;
  elem.download.download.disabled = true;
  elem.download.addOverlayCheckbox.disabled = true;
  toggleEditConfUI(true);
  toggleRecognizeUI(true);

  elem.evaluate.uploadOCRButton.disabled = true;
  toggleLayoutButtons(true);
  toggleEditButtons(true);
}

clearFiles();

// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n) {
  let ocrData = scribe.data.ocr.active?.[n];

  // Return early if there is not enough data to render a page yet
  // (0) Necessary info is not defined yet
  const noInfo = scribe.inputData.xmlMode[n] === undefined;
  // (1) No data has been imported
  const noInput = !scribe.inputData.xmlMode[n] && !(scribe.inputData.imageMode || scribe.inputData.pdfMode);
  // (2) XML data should exist but does not (yet)
  const xmlMissing = scribe.inputData.xmlMode[n]
    && (ocrData === undefined || ocrData === null || scribe.data.pageMetrics[n].dims === undefined);

  const imageMissing = false;
  const pdfMissing = false;

  if (noInfo || noInput || xmlMissing || imageMissing || pdfMissing) {
    console.log('Exiting renderPageQueue early');
    return;
  }

  const renderItI = stateGUI.renderIt + 1;
  stateGUI.renderIt = renderItI;

  // If a page is already being rendered, wait for it to complete
  await stateGUI.pageRendering;
  // If another page has been requested already, return early
  if (stateGUI.renderIt !== renderItI) return;

  stateGUI.pageRendering = new Promise((resolve, reject) => {
    stateGUI.promiseResolve = resolve;
  });

  if (scribe.inputData.evalMode) {
    await compareGroundTruthClick(n);
    // ocrData must be re-assigned after comparing to ground truth or it will not update.
    ocrData = scribe.data.ocr.active?.[n];
  }

  ScribeCanvas.destroyWords();

  // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
  // (whether by quickly changing pages or on the same page).
  // TODO: Find a better solution.
  stateGUI.cp.renderNum += 1;
  const renderNum = stateGUI.cp.renderNum;

  // The active OCR version may have changed, so this needs to be re-checked.
  if (stateGUI.cp.n === n && scribe.inputData.xmlMode[n]) {
    renderPage(ocrData);
    if (stateGUI.cp.n === n && stateGUI.cp.renderNum === renderNum) {
      await selectDisplayMode(scribe.opt.displayMode);
    }
  } else {
    await selectDisplayMode(scribe.opt.displayMode);
  }

  // @ts-ignore
  stateGUI.promiseResolve();
}

let working = false;

/**
 * Render page `n` in the UI.
 * @param {number} n
 * @param {boolean} [force=false] - Render even if another page is actively being rendered.
 * @returns
 */
export async function displayPage(n, force = false) {
  // Return early if (1) page does not exist or (2) another page is actively being rendered.
  if (Number.isNaN(n) || n < 0 || n > (scribe.inputData.pageCount - 1) || (working && !force)) {
    // Reset the value of pageNumElem (number in UI) to match the internal value of the page
    elem.nav.pageNum.value = (stateGUI.cp.n + 1).toString();
    return;
  }

  working = true;

  if (scribe.inputData.xmlMode[stateGUI.cp.n]) {
    // TODO: This is currently run whenever the page is changed.
    // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
    updateFindStats();
  }

  elem.nav.matchCurrent.textContent = calcMatchNumber(n);

  stateGUI.cp.n = n;
  elem.nav.pageNum.value = (stateGUI.cp.n + 1).toString();

  await renderPageQueue(stateGUI.cp.n);

  if (showConflictsElem.checked) showDebugImages();

  // Render background images ahead and behind current page to reduce delay when switching pages
  if (scribe.inputData.pdfMode || scribe.inputData.imageMode) scribe.data.image.preRenderAheadBehindBrowser(n, elem.view.colorMode.value === 'binary');

  working = false;
}

/**
 *
 * @param {boolean} enable
 * @param {boolean} [useInitial=false]
 */
async function optimizeFontClick(enable, useInitial = false) {
  await enableDisableFontOpt(enable, useInitial);

  renderPageQueue(stateGUI.cp.n);
}

// Set default settings
setDefaults();
