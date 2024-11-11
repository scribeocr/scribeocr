/* eslint-disable import/no-cycle */
import { Button, Collapse, Tooltip } from './app/lib/bootstrap.esm.bundle.min.js';
import Konva from './app/lib/konva/index.js';

import { recognizeAllClick } from './app/interfaceRecognize.js';

import scribe from './scribe.js/scribe.js';

import { getAllFileEntries } from './app/utils/dragAndDrop.js';
import { insertAlertMessage } from './app/utils/warningMessages.js';

import {
  ScribeCanvas,
  stateGUI,
  optGUI,
  setWordColorOpacity,
} from './viewer/viewerCanvas.js';

import {
  downloadCanvas,
  downloadCurrentImage,
  evalSelectedLine,
  printSelectedWords,
  showDebugImages,
} from './app/interfaceDebug.js';

import { elem } from './app/elems.js';
import { updateEvalStatsGUI, createGroundTruthClick } from './app/interfaceEvaluate.js';
import { ProgressBars } from './app/utils/progressBars.js';
import { saveAs, showHideElem } from './app/utils/utils.js';
import { findText, highlightcp, search } from './viewer/viewerSearch.js';
import {
  KonvaLayout, renderLayoutBoxes, setDefaultLayout, setDefaultLayoutDataTable, setLayoutBoxInclusionLevelClick, setLayoutBoxInclusionRuleClick,
} from './viewer/viewerLayout.js';
import {
  deleteSelectedWord, modifySelectedWordFontFamily, modifySelectedWordFontSize, modifySelectedWordSmallCaps, modifySelectedWordStyle,
  modifySelectedWordSuper,
} from './viewer/viewerModifySelectedWords.js';

ScribeCanvas.enableCanvasSelection = true;
ScribeCanvas.KonvaIText.enableEditing = true;
ScribeCanvas.init(elem.canvas.canvasContainer, document.documentElement.clientWidth, document.documentElement.clientHeight);

/**
 *
 * @param {ProgressMessage} message
 */
const progressHandler = (message) => {
  if (message.type === 'convert') {
    ProgressBars.active.increment();

    const n = message.n;
    const engineName = message.info.engineName;
    // Display the page if either (1) this is the currently active OCR or (2) this is Tesseract Legacy and Tesseract LSTM is active, but does not exist yet.
    // The latter condition occurs briefly whenever recognition is run in "Quality" mode.
    const oemActive = Object.keys(scribe.data.ocr).find((key) => scribe.data.ocr[key] === scribe.data.ocr.active && key !== 'active');
    const displayOCR = engineName === oemActive || ['Tesseract Legacy', 'Tesseract LSTM'].includes(engineName) && oemActive === 'Tesseract Latest';

    if (displayOCR && stateGUI.cp.n === n) ScribeCanvas.displayPage(n);
  } else if (message.type === 'export') {
    ProgressBars.active.increment();
  } else if (message.type === 'importImage') {
    ProgressBars.active.increment();
    if (stateGUI.cp.n === message.n) {
      ScribeCanvas.displayPage(message.n);
    } else if (Math.abs(stateGUI.cp.n - message.n) < 2) {
      ScribeCanvas.renderWords(message.n);
    }
  } else if (message.type === 'importPDF') {
    ProgressBars.active.increment();
    if (stateGUI.cp.n === message.n) ScribeCanvas.displayPage(message.n);
  } else if (message.type === 'render') {
    if (ProgressBars.active === ProgressBars.download) ProgressBars.active.increment();
  }
};

// Exposing important modules for debugging and testing purposes.
// These should not be relied upon in code--import/export should be used instead.
globalThis.df = {
  scribe,
  ScribeCanvas,
};

scribe.opt.progressHandler = progressHandler;

scribe.opt.saveDebugImages = true;

scribe.opt.calcSuppFontInfo = true;

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

elem.info.usePDFTextMainCheckbox.addEventListener('click', () => {
  scribe.opt.usePDFText.native.main = elem.info.usePDFTextMainCheckbox.checked;
  scribe.opt.usePDFText.ocr.main = elem.info.usePDFTextMainCheckbox.checked;
});
scribe.opt.usePDFText.native.main = elem.info.usePDFTextMainCheckbox.checked;
scribe.opt.usePDFText.ocr.main = elem.info.usePDFTextMainCheckbox.checked;

elem.info.usePDFTextSuppCheckbox.addEventListener('click', () => {
  scribe.opt.usePDFText.native.supp = elem.info.usePDFTextMainCheckbox.checked;
  scribe.opt.usePDFText.ocr.supp = elem.info.usePDFTextMainCheckbox.checked;
});
scribe.opt.usePDFText.native.supp = elem.info.usePDFTextMainCheckbox.checked;
scribe.opt.usePDFText.ocr.supp = elem.info.usePDFTextMainCheckbox.checked;

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
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

scribe.opt.warningHandler = (x) => insertAlertMessage(x, false);
scribe.opt.errorHandler = insertAlertMessage;

// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.forEach((tooltipTriggerEl) => new Tooltip(tooltipTriggerEl));

elem.upload.openFileInput.addEventListener('change', () => {
  if (!elem.upload.openFileInput.files || elem.upload.openFileInput.files.length === 0) return;

  importFilesGUI(elem.upload.openFileInput.files);
  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (elem.upload.uploadDropZone.parentElement), false);
});

let highlightActiveCt = 0;
elem.upload.uploadDropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elem.upload.uploadDropZone.classList.add('highlight');
  highlightActiveCt++;
});

elem.upload.uploadDropZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  // Only remove the highlight after 0.1 seconds, and only if it has not since been re-activated.
  // This avoids flickering.
  const highlightActiveCtNow = highlightActiveCt;
  setTimeout(() => {
    if (highlightActiveCtNow === highlightActiveCt) {
      elem.upload.uploadDropZone.classList.remove('highlight');
    }
  }, 100);
});

// This is where the drop is handled.
elem.upload.uploadDropZone.addEventListener('drop', async (event) => {
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

  elem.upload.uploadDropZone.classList.remove('highlight');

  importFilesGUI(files);

  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (elem.upload.uploadDropZone.parentElement), false);
});

/**
 * Handle paste event to retrieve image from clipboard.
 * @param {ClipboardEvent} event - The paste event containing clipboard data.
 */
const handlePaste = async (event) => {
  // The event listner is on the `window` so is not deleted when the dropzone is hidden.
  if (scribe.data.pageMetrics.length > 0) return;
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;
  const items = clipboardData.items;

  const imageArr = [];
  for (const item of items) {
    if (item.type.indexOf('image') === 0) {
      const blob = item.getAsFile();
      imageArr.push(blob);
    }
  }

  if (imageArr.length > 0) {
    await importFilesGUI(imageArr);
    elem.upload.uploadDropZone.setAttribute('style', 'display:none');
  }
};

// The paste listner needs to be on the window, not the dropzone.
// Paste events are only triggered for individual elements if they are either input elements or have contenteditable set to true, neither of which are the case here.
window.addEventListener('paste', handlePaste);

/**
 * Fetches an array of URLs and runs `importFiles` on the results.
 * Intended only to be used by automated testing and not by users.
 *
 * @param {Array<string>} urls
 */
globalThis.fetchAndImportFiles = async (urls) => {
  // Call the existing importFiles function with the file array
  importFilesGUI(urls);

  elem.upload.uploadDropZone.setAttribute('style', 'display:none');
};

ScribeCanvas.keyboardShortcutCallback = (event) => {
  // When a shortcut that interacts with canvas elements is triggered,
  // any focused UI element from the nav bar are unfocused.
  // If this does not occur, then the UI will remain focused,
  // and users attempting to interact with the canvas may instead interact with the UI.
  // For example, pressing "enter" while the recognize tab is focused may trigger the "Recognize All" button.
  const activeElem = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (activeElem && elem.nav.navBar.contains(activeElem)) activeElem.blur();
};

ScribeCanvas.destroyControlsCallback = (deselect) => {
  if (deselect) {
    const open = elem.edit.collapseRangeBaselineBS._element.classList.contains('show');

    if (open) {
      elem.edit.collapseRangeBaselineBS.toggle();
      return;
    }
  }
};

/**
 * Maps from generic `KeyboardEvent` when user presses a key to the appropriate action.
 * This function is responsible for all keyboard shortcuts.
 * @param {KeyboardEvent} event - The key down event.
 */
function handleKeyboardEventGUI(event) {
  // When a shortcut that interacts with canvas elements is triggered,
  // any focused UI element from the nav bar are unfocused.
  // If this does not occur, then the UI will remain focused,
  // and users attempting to interact with the canvas may instead interact with the UI.
  // For example, pressing "enter" while the recognize tab is focused may trigger the "Recognize All" button.
  const activeElem = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (event.key === 'Escape') {
    // eslint-disable-next-line no-new
    if (elem.nav.editFindCollapse.classList.contains('show')) new Collapse(elem.nav.editFindCollapse, { toggle: true });
  }

  // If the user is typing in an input in the nav bar, do not trigger shortcuts.
  if (activeElem && elem.nav.navBar.contains(activeElem) && (activeElem instanceof HTMLInputElement || activeElem instanceof HTMLSelectElement)) return;

  if (event.ctrlKey && ['f'].includes(event.key)) {
    // eslint-disable-next-line no-new
    if (!elem.nav.editFindCollapse.classList.contains('show')) new Collapse(elem.nav.editFindCollapse, { toggle: true });
    elem.nav.editFind.focus();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
    if (activeElem && elem.nav.navBar.contains(activeElem)) activeElem.blur();
    return;
  }
}

// Add various keyboard shortcuts.
document.addEventListener('keydown', handleKeyboardEventGUI);

// Add various event listners to HTML elements
elem.nav.next.addEventListener('click', () => ScribeCanvas.displayPage(stateGUI.cp.n + 1, true, false));
elem.nav.prev.addEventListener('click', () => ScribeCanvas.displayPage(stateGUI.cp.n - 1, true, false));

elem.nav.zoomIn.addEventListener('click', () => {
  ScribeCanvas.zoom(1.1, ScribeCanvas.getStageCenter());
});

elem.nav.zoomOut.addEventListener('click', () => {
  ScribeCanvas.zoom(0.9, ScribeCanvas.getStageCenter());
});

elem.view.colorMode.addEventListener('change', () => {
  scribe.opt.colorMode = /** @type {"color" | "gray" | "binary"} */ (elem.view.colorMode.value);
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.view.overlayOpacity.addEventListener('input', () => {
  scribe.opt.overlayOpacity = parseInt(elem.view.overlayOpacity.value);
  setWordColorOpacity();
  ScribeCanvas.layerText.batchDraw();
});

elem.recognize.enableUpscale.addEventListener('click', () => {
  scribe.opt.enableUpscale = elem.recognize.enableUpscale.checked;
});

elem.info.showDebugVis.addEventListener('change', () => {
  scribe.opt.debugVis = elem.info.showDebugVis.checked;
  if (scribe.opt.debugVis) {
    ScribeCanvas.displayPage(stateGUI.cp.n);
  } else {
    ScribeCanvas.destroyOverlay(false);
    ScribeCanvas.layerOverlay.batchDraw();
  }
});

elem.info.showDebugLegend.addEventListener('input', () => {
  if (!elem.info.showDebugLegend.checked) {
    showHideElem(elem.canvas.legendCanvasParentDiv, false);
  } else {
    showHideElem(elem.canvas.legendCanvasParentDiv, true);
  }
});

elem.info.debugHidePage.addEventListener('input', () => {
  const hidePage = scribe.opt.debugVis && elem.info.selectDebugVis.value !== 'None' && elem.info.debugHidePage.checked;

  if (hidePage) {
    ScribeCanvas.layerBackground.hide();
    ScribeCanvas.layerText.hide();
    ScribeCanvas.layerBackground.batchDraw();
    ScribeCanvas.layerText.batchDraw();
  } else {
    ScribeCanvas.layerBackground.show();
    ScribeCanvas.layerText.show();
    ScribeCanvas.layerBackground.batchDraw();
    ScribeCanvas.layerText.batchDraw();
  }
});

elem.info.selectDebugVis.addEventListener('change', () => { ScribeCanvas.displayPage(stateGUI.cp.n); });

elem.evaluate.createGroundTruth.addEventListener('click', createGroundTruthClick);

elem.info.enableEval.addEventListener('click', () => showHideElem(elem.info.enableEval, elem.info.enableEval.checked));

elem.info.enableAdvancedRecognition.addEventListener('click', () => {
  showHideElem(elem.recognize.advancedRecognitionOptions1, elem.info.enableAdvancedRecognition.checked);
  showHideElem(elem.recognize.advancedRecognitionOptions2, elem.info.enableAdvancedRecognition.checked);
  showHideElem(elem.recognize.advancedRecognitionOptions3, elem.info.enableAdvancedRecognition.checked);
  showHideElem(elem.recognize.basicRecognitionOptions, !elem.info.enableAdvancedRecognition.checked);
});

export const enableRecognitionClick = () => showHideElem(elem.nav.navRecognize, elem.info.enableRecognition.checked);

elem.info.enableRecognition.addEventListener('click', enableRecognitionClick);

elem.info.enableLayout.addEventListener('click', () => {
  scribe.opt.enableLayout = elem.info.enableLayout.checked;
  showHideElem(elem.nav.navLayout, elem.info.enableLayout.checked);
});

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!elem.info.enableLayout.checked) elem.info.enableLayout.click();

  showHideElem(elem.download.formatLabelOptionXlsx, elem.info.enableXlsxExport.checked);
  showHideElem(elem.info.dataTableOptions, elem.info.enableXlsxExport.checked);
};

elem.info.enableXlsxExport.addEventListener('click', enableXlsxExportClick);

elem.evaluate.uploadOCRButton.addEventListener('click', importFilesSuppGUI);

elem.evaluate.uploadOCRData.addEventListener('show.bs.collapse', () => {
  if (!elem.upload.uploadOCRName.value) {
    elem.upload.uploadOCRName.value = `OCR Data ${elem.evaluate.displayLabelOptions.childElementCount}`;
  }
});

elem.edit.styleItalic.addEventListener('click', () => { modifySelectedWordStyle('italic'); });
elem.edit.styleBold.addEventListener('click', () => { modifySelectedWordStyle('bold'); });

elem.edit.fontMinus.addEventListener('click', () => { modifySelectedWordFontSize('minus'); });
elem.edit.fontPlus.addEventListener('click', () => { modifySelectedWordFontSize('plus'); });
elem.edit.fontSize.addEventListener('change', () => { modifySelectedWordFontSize(elem.edit.fontSize.value); });
elem.edit.wordFont.addEventListener('change', () => { modifySelectedWordFontFamily(elem.edit.wordFont.value); });

elem.edit.styleSmallCaps.addEventListener('click', () => modifySelectedWordSmallCaps(elem.edit.styleSmallCaps.classList.contains('active')));
elem.edit.styleSuper.addEventListener('click', () => modifySelectedWordSuper(elem.edit.styleSuper.classList.contains('active')));

elem.edit.ligatures.addEventListener('change', () => {
  scribe.opt.ligatures = elem.edit.ligatures.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

/** @type {Array<import('./viewer/viewerWordObjects.js').KonvaOcrWord>} */
let objectsLine;

const baselineRange = 25;
export function adjustBaseline() {
  const open = elem.edit.collapseRangeBaselineBS._element.classList.contains('show');

  if (open) {
    elem.edit.collapseRangeBaselineBS.toggle();
    return;
  }

  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) {
    return;
  }

  // Only open if a word is selected.
  elem.edit.collapseRangeBaselineBS.toggle();

  elem.edit.rangeBaseline.value = String(baselineRange + selectedObjects[0].baselineAdj);

  // Unlikely identify lines using the ID of the first word on the line.
  const lineI = selectedObjects[0]?.word?.line?.words[0]?.id;

  console.assert(lineI !== undefined, 'Failed to identify line for word.');

  objectsLine = ScribeCanvas.getKonvaWords().filter((x) => x.word.line.words[0].id === lineI);
}

/**
 * Visually moves the selected line's baseline on the canvas.
 * Called when user is actively dragging the adjust baseline slider.
 *
 * @param {string | number} value - New baseline value.
 */
export function adjustBaselineRange(value) {
  const valueNum = typeof value === 'string' ? parseInt(value) : value;

  // The `topBaseline` is modified for all words, even though position is only changed for non-superscripted words.
  // This allows the properties to be accurate if the user ever switches the word to non-superscripted.
  objectsLine.forEach((objectI) => {
    objectI.topBaseline = objectI.topBaselineOrig + (valueNum - baselineRange);
    if (!objectI.word.sup) {
      objectI.yActual = objectI.topBaseline;
    }
  });

  ScribeCanvas.layerText.batchDraw();
}

/**
 * Adjusts the selected line's baseline in the canvas object and underlying OCR data.
 * Called after user releases adjust baseline slider.
 *
 * @param {string | number} value - New baseline value.
 */
export function adjustBaselineRangeChange(value) {
  const valueNum = typeof value === 'string' ? parseInt(value) : value;

  const valueNew = valueNum - baselineRange;
  const valueChange = valueNew - objectsLine[0].baselineAdj;

  for (let i = 0; i < objectsLine.length; i++) {
    const wordI = objectsLine[i];

    wordI.baselineAdj = valueNew;

    // Adjust baseline offset for line
    if (i === 0) {
      wordI.word.line.baseline[1] += valueChange;
    }
  }
}

export function toggleEditButtons(disable = true) {
  elem.edit.wordFont.disabled = disable;
  elem.edit.fontMinus.disabled = disable;
  elem.edit.fontPlus.disabled = disable;
  elem.edit.fontSize.disabled = disable;

  elem.edit.styleItalic.disabled = disable;
  elem.edit.styleBold.disabled = disable;
  elem.edit.styleSmallCaps.disabled = disable;
  elem.edit.styleSuper.disabled = disable;

  elem.edit.deleteWord.disabled = disable;
  elem.edit.recognizeWord.disabled = disable;
  elem.edit.recognizeWordDropdown.disabled = disable;
  elem.edit.editBaseline.disabled = disable;
}

elem.edit.editBaseline.addEventListener('click', adjustBaseline);

elem.edit.rangeBaseline.addEventListener('input', () => { adjustBaselineRange(elem.edit.rangeBaseline.value); });
elem.edit.rangeBaseline.addEventListener('mouseup', () => { adjustBaselineRangeChange(elem.edit.rangeBaseline.value); });

elem.edit.deleteWord.addEventListener('click', deleteSelectedWord);

elem.edit.addWord.addEventListener('click', () => (ScribeCanvas.mode = 'addWord'));

elem.view.optimizeFont.addEventListener('click', () => {
  // This button does nothing if the debug option optimizeFontDebugElem is enabled.
  // This approach is used rather than disabling the button, as `optimizeFontElem.disabled` is checked in other functions
  // to determine whether font optimization is enabled.
  if (elem.info.optimizeFontDebug.checked) return;
  optimizeFontClick(elem.view.optimizeFont.checked);
});

elem.info.optimizeFontDebug.addEventListener('click', () => {
  if (elem.info.optimizeFontDebug.checked) {
    optimizeFontClick(true, true);
  } else {
    optimizeFontClick(elem.view.optimizeFont.checked, false);
  }
});

elem.info.showIntermediateOCR.addEventListener('click', () => {
  optGUI.showInternalOCRVersions = elem.info.showIntermediateOCR.checked;
  updateOcrVersionGUI();
});

elem.info.extractPDFFonts.addEventListener('click', () => {
  scribe.opt.extractPDFFonts = elem.info.extractPDFFonts.checked;
});

elem.info.confThreshHigh.addEventListener('change', () => {
  scribe.opt.confThreshHigh = parseInt(elem.info.confThreshHigh.value);
  ScribeCanvas.displayPage(stateGUI.cp.n);
});
elem.info.confThreshMed.addEventListener('change', () => {
  scribe.opt.confThreshMed = parseInt(elem.info.confThreshMed.value);
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.view.autoRotate.addEventListener('click', () => {
  if (elem.view.autoRotate.checked) {
    scribe.opt.autoRotate = true;
  } else {
    scribe.opt.autoRotate = false;
  }
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.view.outlineWords.addEventListener('click', () => {
  optGUI.outlineWords = elem.view.outlineWords.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.view.outlineLines.addEventListener('click', () => {
  optGUI.outlineLines = elem.view.outlineLines.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.view.outlinePars.addEventListener('click', () => {
  optGUI.outlinePars = elem.view.outlinePars.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.evaluate.displayLabelOptions.addEventListener('click', (e) => {
  // The elements this event are intended for are the individual elements of the list (not `displayLabelOptionsElem`),
  // which do not exist yet at this point in the code.
  // @ts-ignore
  if (e.target.className !== 'dropdown-item') return;
  // @ts-ignore
  setCurrentHOCR(e.target.innerHTML);
});

elem.edit.smartQuotes.addEventListener('click', () => {
  ScribeCanvas.KonvaIText.smartQuotes = elem.edit.smartQuotes.checked;
});

elem.download.download.addEventListener('click', handleDownloadGUI);
elem.download.pdfPagesLabel.addEventListener('click', updatePdfPagesLabel);

elem.download.formatLabelOptionPDF.addEventListener('click', () => { setFormatLabel('pdf'); });
elem.download.formatLabelOptionHOCR.addEventListener('click', () => { setFormatLabel('hocr'); });
elem.download.formatLabelOptionText.addEventListener('click', () => { setFormatLabel('text'); });
elem.download.formatLabelOptionDocx.addEventListener('click', () => { setFormatLabel('docx'); });
elem.download.formatLabelOptionXlsx.addEventListener('click', () => { setFormatLabel('xlsx'); });

elem.info.debugConflicts.addEventListener('click', () => {
  scribe.opt.debugVis = elem.info.debugConflicts.checked;
});

elem.info.showConflicts.addEventListener('input', () => {
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.recognize.recognizeAll.addEventListener('click', () => {
  stateGUI.recognizeAllPromise = recognizeAllClick();
});

elem.edit.recognizeArea.addEventListener('click', () => (ScribeCanvas.mode = 'recognizeArea'));
elem.edit.recognizeWord.addEventListener('click', () => (ScribeCanvas.mode = 'recognizeWord'));

elem.info.debugPrintCoords.addEventListener('click', () => (ScribeCanvas.mode = 'printCoords'));

elem.layout.addLayoutBox.addEventListener('click', () => {
  ScribeCanvas.mode = { Order: 'addLayoutBoxOrder', Exclude: 'addLayoutBoxExclude', Column: 'addLayoutBoxDataTable' }[elem.layout.layoutBoxType.textContent];
});

elem.layout.addLayoutBoxTypeOrder.addEventListener('click', () => {
  ScribeCanvas.mode = 'addLayoutBoxOrder';
  elem.layout.layoutBoxType.textContent = 'Order';
});

elem.layout.addLayoutBoxTypeExclude.addEventListener('click', () => {
  ScribeCanvas.mode = 'addLayoutBoxExclude';
  elem.layout.layoutBoxType.textContent = 'Exclude';
});

function toggleSelectableWords(selectable = true) {
  const allObjects = ScribeCanvas.getKonvaWords();
  allObjects.forEach((obj) => {
    obj.listening(selectable);
  });
}

function setDefaultLayoutClick() {
  setDefaultLayout(stateGUI.cp.n);
  setDefaultLayoutDataTable(stateGUI.cp.n);
}

function revertLayoutClick() {
  scribe.data.layoutRegions.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes = structuredClone(scribe.data.layoutRegions.defaultRegions);
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].tables = structuredClone(scribe.data.layoutDataTables.defaultTables);

  ScribeCanvas.displayPage(stateGUI.cp.n);
}

elem.layout.addDataTable.addEventListener('click', () => (ScribeCanvas.mode = 'addLayoutBoxDataTable'));

elem.layout.setDefaultLayout.addEventListener('click', () => setDefaultLayoutClick());

elem.layout.revertLayout.addEventListener('click', () => revertLayoutClick());

elem.layout.setLayoutBoxInclusionRuleMajority.addEventListener('click', () => setLayoutBoxInclusionRuleClick('majority'));
elem.layout.setLayoutBoxInclusionRuleLeft.addEventListener('click', () => setLayoutBoxInclusionRuleClick('left'));

elem.layout.setLayoutBoxInclusionLevelWord.addEventListener('click', () => setLayoutBoxInclusionLevelClick('word'));
elem.layout.setLayoutBoxInclusionLevelLine.addEventListener('click', () => setLayoutBoxInclusionLevelClick('line'));

elem.evaluate.ignorePunct.addEventListener('change', () => {
  scribe.opt.ignorePunct = elem.evaluate.ignorePunct.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.evaluate.ignoreCap.addEventListener('change', () => {
  scribe.opt.ignoreCap = elem.evaluate.ignoreCap.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

elem.evaluate.ignoreExtra.addEventListener('change', () => {
  scribe.opt.ignoreExtra = elem.evaluate.ignoreExtra.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
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
    ScribeCanvas.displayPage(parseInt(elem.nav.pageNum.value) - 1, true);
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
  elem.layout.addDataTable.disabled = disable;
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

elem.recognize.updateConfOnly.addEventListener('change', () => {
  optGUI.combineMode = /** @type {"data" | "conf"}* */(elem.recognize.updateConfOnly.checked ? 'conf' : 'data');
});

ProgressBars.active = ProgressBars.import;

const importFilesGUI = async (files) => {
  ProgressBars.active = ProgressBars.import;
  ProgressBars.active.show(files.length, 0);

  await scribe.importFiles(files);

  ScribeCanvas.displayPage(stateGUI.cp.n);

  // Add fonts extracted from document to the UI
  if (scribe.inputData.pdfMode && scribe.data.font.doc && Object.keys(scribe.data.font.doc).length > 0) {
    Object.keys(scribe.data.font.doc).forEach((label) => {
      const option = document.createElement('option');
      option.value = label;
      option.text = label;
      elem.edit.wordFont.appendChild(option);
    });
  }

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

  if (scribe.inputData.xmlMode[0]) {
    updateOcrVersionGUI();
    toggleEditButtons(false);
    toggleLayoutButtons(false);
  }

  if (scribe.data.font.enableOpt) {
    elem.view.optimizeFont.disabled = false;
    elem.view.optimizeFont.checked = true;
  }

  ProgressBars.active.fill();
};

// Import supplemental OCR files (from "Evaluate Accuracy" UI tab)
async function importFilesSuppGUI() {
  // TODO: Add input validation for names (e.g. unique, no illegal symbols, not named "Ground Truth" or other reserved name)
  const ocrName = elem.upload.uploadOCRName.value;

  if (!elem.upload.uploadOCRFile.files || elem.upload.uploadOCRFile.files.length === 0) return;

  ProgressBars.active = ProgressBars.eval;
  ProgressBars.active.show(elem.upload.uploadOCRFile.files.length, 0);

  await scribe.importFilesSupp(elem.upload.uploadOCRFile.files, ocrName);

  elem.evaluate.displayLabelText.disabled = true;

  toggleEditButtons(false);

  elem.upload.uploadOCRName.value = '';
  elem.upload.uploadOCRFile.value = '';
  // eslint-disable-next-line no-new
  new Collapse(elem.evaluate.uploadOCRData, { toggle: true });

  updateOcrVersionGUI();

  setCurrentHOCR(ocrName);
  elem.evaluate.displayLabelText.disabled = true;

  ProgressBars.active.fill();
}

function prevMatchClick() {
  if (stateGUI.cp.n === 0) return;
  const lastPage = search.matches.slice(0, stateGUI.cp.n)?.findLastIndex((x) => x > 0);
  if (lastPage > -1) ScribeCanvas.displayPage(lastPage, true);
}

function nextMatchClick() {
  const nextPageOffset = search.matches.slice(stateGUI.cp.n + 1)?.findIndex((x) => x > 0);
  if (nextPageOffset > -1) ScribeCanvas.displayPage(stateGUI.cp.n + nextPageOffset + 1, true);
}

elem.nav.editFindCollapse.addEventListener('show.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'editFindCollapse') {
    stateGUI.searchMode = true;
    highlightcp(search.search);
  }
});

elem.nav.editFindCollapse.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'editFindCollapse') {
    stateGUI.searchMode = false;
    const words = ScribeCanvas.getKonvaWords();
    words.forEach((word) => word.fillBox = false);
    ScribeCanvas.layerText.batchDraw();
  }
});

elem.nav.editFind.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    const val = elem.nav.editFind.value.trim();
    if (!val) return;

    if (val === search.search) {
      if (event.shiftKey) {
        prevMatchClick();
      } else {
        nextMatchClick();
      }
    } else {
      findTextClick(val);
    }
  }
});

function findTextClick(text) {
  findText(text);
  elem.nav.matchCurrent.textContent = calcMatchNumber(stateGUI.cp.n);
  elem.nav.matchCount.textContent = String(search.total);
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

  elem.evaluate.displayLabelText.innerHTML = x;

  if (x.toLowerCase() === 'none') {
    scribe.data.ocr.active = [];
  } else {
    scribe.data.ocr.active = scribe.data.ocr[x];
  }

  ScribeCanvas.displayPage(stateGUI.cp.n);
}

/**
 * Update the GUI dropdown menu with the latest OCR versions.
 */
export const updateOcrVersionGUI = () => {
  const versionsInt = ['Tesseract Latest', 'Tesseract Combined Temp'];

  // Skip versions that are already in the dropdown, or are only used under the hood.
  const labelElems = elem.evaluate.displayLabelOptions.children;
  const versionsSkip = [];
  for (let i = 0; i < labelElems.length; i++) {
    versionsSkip.push(labelElems[i].innerHTML);
    if (!optGUI.showInternalOCRVersions && versionsInt.includes(labelElems[i].innerHTML)) {
      labelElems[i].remove();
      i--;
    }
  }

  if (!optGUI.showInternalOCRVersions) {
    for (const version of versionsInt) {
      versionsSkip.push(version);
    }
  }

  versionsSkip.push('active');

  const ocrVersionsNew = Object.keys(scribe.data.ocr).filter((x) => !versionsSkip.includes(x));

  ocrVersionsNew.forEach((label) => {
    const option = document.createElement('a');
    option.setAttribute('class', 'dropdown-item');
    option.text = label;
    elem.evaluate.displayLabelOptions.appendChild(option);
  });

  const oemActive = Object.keys(scribe.data.ocr).find((key) => scribe.data.ocr[key] === scribe.data.ocr.active && key !== 'active');
  if (oemActive) {
    elem.evaluate.displayLabelText.innerHTML = oemActive;
  } else {
    elem.evaluate.displayLabelText.innerHTML = 'None';
  }
};

// Users may select an edit action (e.g. "Add Word", "Recognize Word", etc.) but then never follow through.
// This function cleans up any changes/event listners caused by the initial click in such cases.
elem.nav.navBar.addEventListener('click', (e) => {
  ScribeCanvas.mode = 'select';
}, true);

// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
elem.nav.navRecognize.addEventListener('hidden.bs.collapse', (e) => {
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

elem.nav.navLayout.addEventListener('show.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    stateGUI.layoutMode = true;
    // Generally we handle drawing manually, however `autoDrawEnabled` is needed for the user to drag layout boxes.
    Konva.autoDrawEnabled = true;
    if (!scribe.data.layoutRegions.pages[stateGUI.cp.n]) return;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!scribe.opt.autoRotate) {
      ScribeCanvas.displayPage(stateGUI.cp.n);
    } else {
      toggleSelectableWords(false);
      ScribeCanvas.destroyControls();
      renderLayoutBoxes(stateGUI.cp.n);
    }
  }
});

elem.nav.navLayout.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    stateGUI.layoutMode = false;
    Konva.autoDrawEnabled = false;

    ScribeCanvas.destroyOverlay(false);
    ScribeCanvas.layerOverlay.batchDraw();
    setWordColorOpacity();
    ScribeCanvas.layerText.batchDraw();
    toggleSelectableWords(true);
  }
});

// Resets the environment.
async function clearFiles() {
  scribe.clear();
  clearUI();
}

async function clearUI() {
  stateGUI.cp.n = 0;

  if (ScribeCanvas.stage) ScribeCanvas.stage.clear();
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

const styleItalicButton = new Button(elem.edit.styleItalic);
const styleBoldButton = new Button(elem.edit.styleBold);
const styleSmallCapsButton = new Button(elem.edit.styleSmallCaps);
const styleSuperButton = new Button(elem.edit.styleSuper);

ScribeCanvas.KonvaOcrWord.updateUI = () => {
  const wordFirst = ScribeCanvas.CanvasSelection.getKonvaWords()[0];

  if (!wordFirst) return;

  const { fontFamilyArr, fontSizeArr } = ScribeCanvas.CanvasSelection.getWordProperties();

  if (fontFamilyArr.length === 1) {
    elem.edit.wordFont.value = String(wordFirst.fontFamilyLookup);
  } else {
    elem.edit.wordFont.value = '';
  }

  if (fontSizeArr.length === 1) {
    elem.edit.fontSize.value = String(wordFirst.fontSize);
  } else {
    elem.edit.fontSize.value = '';
  }

  if (wordFirst.word.sup !== elem.edit.styleSuper.classList.contains('active')) {
    styleSuperButton.toggle();
  }
  if (wordFirst.word.smallCaps !== elem.edit.styleSmallCaps.classList.contains('active')) {
    styleSmallCapsButton.toggle();
  }
  const italic = wordFirst.word.style === 'italic';
  if (italic !== elem.edit.styleItalic.classList.contains('active')) {
    styleItalicButton.toggle();
  }
  const bold = wordFirst.word.style === 'bold';
  if (bold !== elem.edit.styleBold.classList.contains('active')) {
    styleBoldButton.toggle();
  }
};

KonvaLayout.updateUI = () => {
  const { inclusionRuleArr, inclusionLevelArr } = ScribeCanvas.CanvasSelection.getLayoutBoxProperties();

  if (inclusionRuleArr.length === 1) {
    elem.layout.setLayoutBoxInclusionRuleMajority.checked = inclusionRuleArr[0] === 'majority';
    elem.layout.setLayoutBoxInclusionRuleLeft.checked = inclusionRuleArr[0] === 'left';
  } else {
    elem.layout.setLayoutBoxInclusionRuleMajority.checked = false;
    elem.layout.setLayoutBoxInclusionRuleLeft.checked = false;
  }

  if (inclusionLevelArr.length === 1) {
    elem.layout.setLayoutBoxInclusionLevelWord.checked = inclusionLevelArr[0] === 'word';
    elem.layout.setLayoutBoxInclusionLevelLine.checked = inclusionLevelArr[0] === 'line';
  } else {
    elem.layout.setLayoutBoxInclusionLevelWord.checked = false;
    elem.layout.setLayoutBoxInclusionLevelLine.checked = false;
  }
};

const ctxLegend = /** @type {CanvasRenderingContext2D} */ (elem.canvas.legendCanvas.getContext('2d'));

const renderDebugVis = (n) => {
  if (scribe.opt.debugVis && elem.info.selectDebugVis.value !== 'None' && scribe.data.vis[n][elem.info.selectDebugVis.value]) {
    const group = ScribeCanvas.getOverlayGroup(n);
    group.destroyChildren();

    if (!ScribeCanvas.overlayGroupsRenderIndices.includes(n)) ScribeCanvas.overlayGroupsRenderIndices.push(n);

    const pageDims = scribe.data.pageMetrics[n].dims;

    const image = scribe.data.vis[n][elem.info.selectDebugVis.value].canvas;
    const overlayImageKonva = new Konva.Image({
      image,
      scaleX: pageDims.width / image.width,
      scaleY: pageDims.height / image.height,
      x: pageDims.width * 0.5,
      y: pageDims.width * 0.5,
      offsetX: image.width * 0.5,
      offsetY: image.width * 0.5,
    });

    group.add(overlayImageKonva);

    const offscreenCanvasLegend = scribe.data.vis[n][elem.info.selectDebugVis.value].canvasLegend;
    if (offscreenCanvasLegend) {
      ctxLegend.canvas.width = offscreenCanvasLegend.width;
      ctxLegend.canvas.height = offscreenCanvasLegend.height;
      ctxLegend.drawImage(offscreenCanvasLegend, 0, 0);
    } else {
      ctxLegend.clearRect(0, 0, ctxLegend.canvas.width, ctxLegend.canvas.height);
    }

    ScribeCanvas.layerOverlay.batchDraw();
  }
};

const renderConflictVis = () => {
  if (elem.info.showConflicts.checked) showDebugImages();

  if (elem.info.showConflicts.checked) {
    const debugHeight = Math.round(document.documentElement.clientHeight * 0.3);

    elem.canvas.debugCanvasParentDiv.style.width = `${document.documentElement.clientWidth}px`;
    elem.canvas.debugCanvasParentDiv.style.height = `${debugHeight}px`;
    elem.canvas.debugCanvasParentDiv.style.top = `${document.documentElement.clientHeight - debugHeight}px`;
    elem.canvas.debugCanvasParentDiv.style.overflowY = 'scroll';
    elem.canvas.debugCanvasParentDiv.style.zIndex = '10';
    elem.canvas.debugCanvasParentDiv.style.position = 'absolute';

    showHideElem(elem.canvas.debugCanvasParentDiv, true);
  } else {
    showHideElem(elem.canvas.debugCanvasParentDiv, false);
  }
};

ScribeCanvas.displayPageCallback = () => {
  elem.nav.pageNum.value = (stateGUI.cp.n + 1).toString();

  elem.nav.matchCurrent.textContent = calcMatchNumber(stateGUI.cp.n);
  elem.nav.matchCount.textContent = String(search.total);

  renderDebugVis(stateGUI.cp.n);

  if (elem.info.showConflicts.checked) showDebugImages();

  updateEvalStatsGUI(stateGUI.cp.n);

  renderConflictVis();
};

/**
 *
 * @param {boolean} enable
 * @param {boolean} [force]
 */
async function optimizeFontClick(enable, force) {
  await scribe.enableFontOpt(enable, force);

  ScribeCanvas.displayPage(stateGUI.cp.n);
}

elem.info.downloadSourcePDF.addEventListener('click', async () => {
  const muPDFScheduler = await scribe.data.image.getMuPDFScheduler(1);
  const w = muPDFScheduler.workers[0];

  if (!w.pdfDoc) {
    console.log('No PDF document is open.');
    return;
  }

  const content = await w.write({
    doc1: w.pdfDoc, humanReadable: elem.info.humanReadablePDF.checked,
  });

  const pdfBlob = new Blob([content], { type: 'application/octet-stream' });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  saveAs(pdfBlob, fileName);
});

elem.info.downloadDebugCsv.addEventListener('click', async () => {
  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.csv`;
  scribe.utils.writeDebugCsv(scribe.data.ocr.active, fileName);
});

// Once per session, if the user opens the "Download" tab and proofreading mode is still enabled,
// the user will be prompted to change display modes before downloading.
// This is because, while printing OCR text visibly is an intended feature (it was the original purpose of this application),
// a user trying to add text to an image-based PDF may be surprised by this behavior.
const pdfAlertElem = insertAlertMessage('To generate a PDF with invisible OCR text, select View > Display Mode > OCR Mode before downloading.', false, 'alertDownloadDiv', false);
const enableDisableDownloadPDFAlert = () => {
  const enable = elem.view.displayMode.value === 'proof' && elem.download.formatLabelText.textContent === 'PDF';

  if (enable) {
    pdfAlertElem.setAttribute('style', '');
  } else {
    pdfAlertElem.setAttribute('style', 'display:none');
  }
};

function setFormatLabel(x) {
  if (x.toLowerCase() === 'pdf') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', '');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`;

    elem.download.formatLabelText.innerHTML = 'PDF';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  } else if (x.toLowerCase() === 'hocr') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`;

    elem.download.formatLabelText.innerHTML = 'HOCR';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.hocr`;
  } else if (x.toLowerCase() === 'text') {
    elem.download.textOptions.setAttribute('style', '');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`;

    elem.download.formatLabelText.innerHTML = 'Text';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.txt`;
  } else if (x.toLowerCase() === 'docx') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', '');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M5.485 6.879a.5.5 0 1 0-.97.242l1.5 6a.5.5 0 0 0 .967.01L8 9.402l1.018 3.73a.5.5 0 0 0 .967-.01l1.5-6a.5.5 0 0 0-.97-.242l-1.036 4.144-.997-3.655a.5.5 0 0 0-.964 0l-.997 3.655L5.485 6.88z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>`;

    elem.download.formatLabelText.innerHTML = 'Docx';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.docx`;
  } else if (x.toLowerCase() === 'xlsx') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', '');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V9H3V2a1 1 0 0 1 1-1h5.5v2zM3 12v-2h2v2H3zm0 1h2v2H4a1 1 0 0 1-1-1v-1zm3 2v-2h3v2H6zm4 0v-2h3v1a1 1 0 0 1-1 1h-2zm3-3h-3v-2h3v2zm-7 0v-2h3v2H6z"/>`;

    elem.download.formatLabelText.innerHTML = 'Xlsx';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.xlsx`;
  }
  enableDisableDownloadPDFAlert();
}

function updatePdfPagesLabel() {
  const pageCount = scribe.inputData.pageCount;

  let minValue = parseInt(elem.download.pdfPageMin.value);
  let maxValue = parseInt(elem.download.pdfPageMax.value);

  // Correct various invalid user inputs.
  if (!minValue || minValue < 1 || minValue > pageCount) minValue = 1;
  if (!maxValue || maxValue < 1 || maxValue > pageCount) maxValue = pageCount;
  if (minValue > maxValue) minValue = maxValue;

  let pagesStr;
  if (minValue > 1 || maxValue < pageCount) {
    pagesStr = ` Pages: ${minValue}–${maxValue}`;
  } else {
    pagesStr = ' Pages: All';
    minValue = 1;
    maxValue = pageCount;
  }

  elem.download.pdfPageMin.value = minValue ? minValue.toString() : '1';
  elem.download.pdfPageMax.value = maxValue ? maxValue.toString() : '';
  elem.download.pdfPagesLabelText.innerText = pagesStr;
}

async function handleDownloadGUI() {
  elem.download.download.removeEventListener('click', handleDownloadGUI);
  elem.download.download.disabled = true;

  // If recognition is currently running, wait for it to finish.
  await stateGUI.recognizeAllPromise;

  updatePdfPagesLabel();

  const downloadType = (/** @type {string} */ (elem.download.formatLabelText.textContent)).toLowerCase();

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;

  const minValue = parseInt(elem.download.pdfPageMin.value) - 1;
  const maxValue = parseInt(elem.download.pdfPageMax.value) - 1;

  ProgressBars.active = ProgressBars.download;
  const progressMax = downloadType === 'pdf' ? (maxValue - minValue + 1) * 3 + 1 : (maxValue - minValue + 1) + 1;
  ProgressBars.active.show(progressMax, 0);

  await scribe.download(downloadType, fileName, minValue, maxValue);

  ProgressBars.active.fill();

  elem.download.download.disabled = false;
  elem.download.download.addEventListener('click', handleDownloadGUI);
}
