/* eslint-disable import/no-cycle */
import { Button, Collapse, Tooltip } from './app/lib/bootstrap.esm.bundle.min.js';

import scribe from './scribe-ui/scribe.js/scribe.js';

import { insertAlertMessage } from './app/utils/warningMessages.js';

import { ScribeViewer } from './scribe-ui/viewer.js';

import { elem } from './app/elems.js';
import { ProgressBars } from './app/utils/progressBars.js';

ScribeViewer.enableCanvasSelection = true;
ScribeViewer.KonvaIText.enableEditing = true;
ScribeViewer.init(elem.canvas.canvasContainer, document.documentElement.clientWidth, document.documentElement.clientHeight);

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

    if (displayOCR && ScribeViewer.state.cp.n === n) ScribeViewer.displayPage(n);
  } else if (message.type === 'export') {
    ProgressBars.active.increment();
  } else if (message.type === 'importImage') {
    ProgressBars.active.increment();
    if (ScribeViewer.state.cp.n === message.n) {
      ScribeViewer.displayPage(message.n);
    } else if (Math.abs(ScribeViewer.state.cp.n - message.n) < 2) {
      ScribeViewer.renderWords(message.n);
    }
  } else if (message.type === 'importPDF') {
    ProgressBars.active.increment();
    if (ScribeViewer.state.cp.n === message.n) ScribeViewer.displayPage(message.n);
  } else if (message.type === 'render') {
    if (ProgressBars.active === ProgressBars.download) ProgressBars.active.increment();
  }
};

// Exposing important modules for debugging and testing purposes.
// These should not be relied upon in code--import/export should be used instead.
globalThis.df = {
  scribe,
  ScribeCanvas: ScribeViewer,
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
  scribe.opt.usePDFText.native.supp = elem.info.usePDFTextSuppCheckbox.checked;
  scribe.opt.usePDFText.ocr.supp = elem.info.usePDFTextSuppCheckbox.checked;
});
scribe.opt.usePDFText.native.supp = elem.info.usePDFTextSuppCheckbox.checked;
scribe.opt.usePDFText.ocr.supp = elem.info.usePDFTextSuppCheckbox.checked;

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
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
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
  /** @type {HTMLElement} */ (elem.upload.uploadDropZone.parentElement).style.display = 'none';
});

elem.edit.fontImport.addEventListener('change', () => {
  if (!elem.edit.fontImport.files || elem.edit.fontImport.files.length === 0) return;
  importFontsGUI(elem.edit.fontImport.files);
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
  const items = await ScribeViewer.getAllFileEntries(event.dataTransfer.items);

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
  /** @type {HTMLElement} */ (elem.upload.uploadDropZone.parentElement).style.display = 'none';
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

ScribeViewer.interactionCallback = (event) => {
  // When a shortcut that interacts with canvas elements is triggered,
  // any focused UI element from the nav bar are unfocused.
  // If this does not occur, then the UI will remain focused,
  // and users attempting to interact with the canvas may instead interact with the UI.
  // For example, pressing "enter" while the recognize tab is focused may trigger the "Recognize All" button.
  const activeElem = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (activeElem && elem.nav.navBar.contains(activeElem)) activeElem.blur();
};

ScribeViewer.destroyControlsCallback = (deselect) => {
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
elem.nav.next.addEventListener('click', () => ScribeViewer.displayPage(ScribeViewer.state.cp.n + 1, true, false));
elem.nav.prev.addEventListener('click', () => ScribeViewer.displayPage(ScribeViewer.state.cp.n - 1, true, false));

elem.nav.zoomIn.addEventListener('click', () => {
  ScribeViewer.zoom(1.1, ScribeViewer.getStageCenter());
});

elem.nav.zoomOut.addEventListener('click', () => {
  ScribeViewer.zoom(0.9, ScribeViewer.getStageCenter());
});

elem.view.colorMode.addEventListener('change', () => {
  scribe.opt.colorMode = /** @type {"color" | "gray" | "binary"} */ (elem.view.colorMode.value);
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.view.overlayOpacity.addEventListener('input', () => {
  scribe.opt.overlayOpacity = parseInt(elem.view.overlayOpacity.value);
  ScribeViewer.setWordColorOpacity();
  ScribeViewer.layerText.batchDraw();
});

elem.recognize.enableUpscale.addEventListener('click', () => {
  scribe.opt.enableUpscale = elem.recognize.enableUpscale.checked;
});

elem.info.showDebugVis.addEventListener('change', () => {
  scribe.opt.debugVis = elem.info.showDebugVis.checked;
  if (scribe.opt.debugVis) {
    ScribeViewer.displayPage(ScribeViewer.state.cp.n);
  } else {
    ScribeViewer.destroyOverlay(false);
    ScribeViewer.layerOverlay.batchDraw();
  }
});

elem.info.showDebugLegend.addEventListener('input', () => {
  if (!elem.info.showDebugLegend.checked) {
    elem.canvas.legendCanvasParentDiv.style.display = 'none';
  } else {
    elem.canvas.legendCanvasParentDiv.style.display = '';
  }
});

elem.info.debugHidePage.addEventListener('input', () => {
  const hidePage = scribe.opt.debugVis && elem.info.selectDebugVis.value !== 'None' && elem.info.debugHidePage.checked;

  if (hidePage) {
    ScribeViewer.layerBackground.hide();
    ScribeViewer.layerText.hide();
    ScribeViewer.layerBackground.batchDraw();
    ScribeViewer.layerText.batchDraw();
  } else {
    ScribeViewer.layerBackground.show();
    ScribeViewer.layerText.show();
    ScribeViewer.layerBackground.batchDraw();
    ScribeViewer.layerText.batchDraw();
  }
});

elem.info.selectDebugVis.addEventListener('change', () => { ScribeViewer.displayPage(ScribeViewer.state.cp.n); });

elem.evaluate.createGroundTruth.addEventListener('click', createGroundTruthClick);

elem.info.enableEval.addEventListener('click', () => {
  elem.nav.navEvalTab.style.display = elem.info.enableEval.checked ? '' : 'none';
});

elem.info.enableAdvancedRecognition.addEventListener('click', () => {
  elem.recognize.advancedRecognitionOptions1.style.display = elem.info.enableAdvancedRecognition.checked ? '' : 'none';
  elem.recognize.advancedRecognitionOptions2.style.display = elem.info.enableAdvancedRecognition.checked ? '' : 'none';
  elem.recognize.advancedRecognitionOptions3.style.display = elem.info.enableAdvancedRecognition.checked ? '' : 'none';
  elem.recognize.basicRecognitionOptions.style.display = !elem.info.enableAdvancedRecognition.checked ? '' : 'none';
});

export const enableRecognitionClick = () => {
  elem.nav.navRecognizeTab.style.display = elem.info.enableRecognition.checked ? '' : 'none';
};

elem.info.enableRecognition.addEventListener('click', enableRecognitionClick);

elem.info.enableLayout.addEventListener('click', () => {
  scribe.opt.enableLayout = elem.info.enableLayout.checked;
  elem.nav.navLayoutTab.style.display = elem.info.enableLayout.checked ? '' : 'none';
});

export const enableXlsxExportClick = () => {
  // Adding layouts is required for xlsx exports
  if (!elem.info.enableLayout.checked) elem.info.enableLayout.click();

  elem.download.formatLabelOptionXlsx.style.display = elem.info.enableXlsxExport.checked ? '' : 'none';
};

elem.info.enableXlsxExport.addEventListener('click', enableXlsxExportClick);

elem.evaluate.uploadOCRButton.addEventListener('click', importFilesSuppGUI);

elem.evaluate.uploadOCRData.addEventListener('show.bs.collapse', () => {
  if (!elem.upload.uploadOCRName.value) {
    elem.upload.uploadOCRName.value = `OCR Data ${elem.evaluate.displayLabelOptions.childElementCount}`;
  }
});

elem.edit.styleItalic.addEventListener('click', () => { ScribeViewer.CanvasSelection.modifySelectedWordStyle('italic'); });
elem.edit.styleBold.addEventListener('click', () => { ScribeViewer.CanvasSelection.modifySelectedWordStyle('bold'); });

elem.edit.fontMinus.addEventListener('click', () => { ScribeViewer.CanvasSelection.modifySelectedWordFontSize('minus'); });
elem.edit.fontPlus.addEventListener('click', () => { ScribeViewer.CanvasSelection.modifySelectedWordFontSize('plus'); });
elem.edit.fontSize.addEventListener('change', () => { ScribeViewer.CanvasSelection.modifySelectedWordFontSize(elem.edit.fontSize.value); });
elem.edit.wordFont.addEventListener('change', () => { ScribeViewer.CanvasSelection.modifySelectedWordFontFamily(elem.edit.wordFont.value); });

elem.edit.styleSmallCaps.addEventListener('click', () => ScribeViewer.CanvasSelection.modifySelectedWordSmallCaps(elem.edit.styleSmallCaps.classList.contains('active')));
elem.edit.styleSuper.addEventListener('click', () => ScribeViewer.CanvasSelection.modifySelectedWordSuper(elem.edit.styleSuper.classList.contains('active')));

elem.edit.ligatures.addEventListener('change', () => {
  scribe.opt.ligatures = elem.edit.ligatures.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.edit.kerning.addEventListener('change', () => {
  scribe.opt.kerning = elem.edit.kerning.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

/** @type {Array<InstanceType<typeof ScribeViewer.KonvaOcrWord>>} */
let objectsLine;

const baselineRange = 25;
export function adjustBaseline() {
  const open = elem.edit.collapseRangeBaselineBS._element.classList.contains('show');

  if (open) {
    elem.edit.collapseRangeBaselineBS.toggle();
    return;
  }

  const selectedObjects = ScribeViewer.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) {
    return;
  }

  // Only open if a word is selected.
  elem.edit.collapseRangeBaselineBS.toggle();

  elem.edit.rangeBaseline.value = String(baselineRange + selectedObjects[0].baselineAdj);

  // Unlikely identify lines using the ID of the first word on the line.
  const lineI = selectedObjects[0]?.word?.line?.words[0]?.id;

  console.assert(lineI !== undefined, 'Failed to identify line for word.');

  objectsLine = ScribeViewer.getKonvaWords().filter((x) => x.word.line.words[0].id === lineI);
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

  ScribeViewer.layerText.batchDraw();
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

elem.edit.deleteWord.addEventListener('click', ScribeViewer.CanvasSelection.deleteSelectedWord);

elem.edit.addWord.addEventListener('click', () => (ScribeViewer.mode = 'addWord'));

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
  ScribeViewer.opt.showInternalOCRVersions = elem.info.showIntermediateOCR.checked;
  updateOcrVersionGUI();
});

elem.info.extractPDFFonts.addEventListener('click', () => {
  scribe.opt.extractPDFFonts = elem.info.extractPDFFonts.checked;
});

elem.info.confThreshHigh.addEventListener('change', () => {
  scribe.opt.confThreshHigh = parseInt(elem.info.confThreshHigh.value);
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});
elem.info.confThreshMed.addEventListener('change', () => {
  scribe.opt.confThreshMed = parseInt(elem.info.confThreshMed.value);
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.view.autoRotate.addEventListener('click', () => {
  if (elem.view.autoRotate.checked) {
    scribe.opt.autoRotate = true;
  } else {
    scribe.opt.autoRotate = false;
  }
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.view.outlineWords.addEventListener('click', () => {
  ScribeViewer.opt.outlineWords = elem.view.outlineWords.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.view.outlineLines.addEventListener('click', () => {
  ScribeViewer.opt.outlineLines = elem.view.outlineLines.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.view.outlinePars.addEventListener('click', () => {
  ScribeViewer.opt.outlinePars = elem.view.outlinePars.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
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
  ScribeViewer.KonvaIText.smartQuotes = elem.edit.smartQuotes.checked;
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
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.recognize.langLabel.addEventListener('click', setLangOpt);

const langChoiceElemArr = Array.from(elem.recognize.collapseLang.querySelectorAll('.form-check-input'));

const langChoices = langChoiceElemArr.map((element) => element.id);

elem.recognize.oemLabelOptionLstm.addEventListener('click', () => { setOemLabel('lstm'); });
elem.recognize.oemLabelOptionLegacy.addEventListener('click', () => { setOemLabel('legacy'); });
elem.recognize.oemLabelOptionCombined.addEventListener('click', () => { setOemLabel('combined'); });

elem.recognize.psmLabelOption3.addEventListener('click', () => { setPsmLabel('3'); });
elem.recognize.psmLabelOption4.addEventListener('click', () => { setPsmLabel('4'); });

elem.recognize.buildLabelOptionDefault.addEventListener('click', () => {
  setBuildLabel('default');
  ScribeViewer.opt.vanillaMode = false;
});
elem.recognize.buildLabelOptionVanilla.addEventListener('click', () => {
  setBuildLabel('vanilla');
  ScribeViewer.opt.vanillaMode = true;
});

function setOemLabel(x) {
  if (x.toLowerCase() === 'lstm') {
    elem.recognize.oemLabelText.innerHTML = 'LSTM';
  } else if (x.toLowerCase() === 'legacy') {
    elem.recognize.oemLabelText.innerHTML = 'Legacy';
  } else if (x.toLowerCase() === 'combined') {
    elem.recognize.oemLabelText.innerHTML = 'Combined';
  }
}

/**
 *
 * @param {string} x
 */
function setPsmLabel(x) {
  if (x === '3') {
    elem.recognize.psmLabelText.innerHTML = 'Automatic';
  } else if (x === '4') {
    elem.recognize.psmLabelText.innerHTML = 'Single Column';
  } else if (x === '8') {
    elem.recognize.psmLabelText.innerHTML = 'Single Word';
  }
}

function setBuildLabel(x) {
  if (x.toLowerCase() === 'default') {
    elem.recognize.buildLabelText.innerHTML = 'Scribe';
  } else if (x.toLowerCase() === 'vanilla') {
    elem.recognize.buildLabelText.innerHTML = 'Vanilla';
  }
}

const langAlertElem = insertAlertMessage('Only enable languages known to be in the source document. Enabling many languages decreases performance.', false, 'alertRecognizeDiv', false);
export const enableDisablelangAlertElem = () => {
  // Enable message if more than 2 languages are selected
  const enable = langChoiceElemArr.map((x) => x.checked).reduce((x, y) => x + y, 0) > 2;

  if (enable) {
    langAlertElem.setAttribute('style', '');
  } else {
    langAlertElem.setAttribute('style', 'display:none');
  }
};

elem.recognize.collapseLang.addEventListener('click', enableDisablelangAlertElem);

export function setLangOpt() {
  /** @type {Array<string>} */
  const langArr = [];
  langChoices.forEach((x) => {
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById(x));
    console.assert(langCheckboxElem, 'Expected language does not exist');
    if (langCheckboxElem && langCheckboxElem.checked) langArr.push(x);
  });

  if (langArr.length === 0) {
    langArr.push('eng');
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('eng'));
    langCheckboxElem.checked = true;
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  elem.recognize.langLabelText.innerText = `Lang: ${langArr.map((x) => capitalizeFirstLetter(x)).join('+')}`;

  // TODO: If too many language are selected, the user should be warned that this can cause issues.
  // If this is not explicit, I could see a user selecting every option "just in case".

  ScribeViewer.opt.langs = langArr;

  return;
}

// TODO: Visualizations are added to the dropdown menu, even when they do not exist for every page.
// While this is the appropriate behavior, the user should be notified that the visualization does not exist for the current page.
async function addVisInstructionsUI() {
  const { combineOrderedArrays } = await import('./scribe-ui/scribe.js/scrollview-web/util/combine.js');
  if (!scribe.data.vis || scribe.data.vis.length === 0) return;
  const visNamesAll = scribe.data.vis.map((x) => Object.keys(x));
  if (visNamesAll.length === 0) return;
  const visNames = visNamesAll.reduce(combineOrderedArrays);

  if (visNames.length === 0) return;

  elem.info.showDebugLegend.disabled = false;
  elem.info.selectDebugVis.disabled = false;
  visNames.forEach((x) => {
    const option = document.createElement('option');
    option.value = x;
    option.innerHTML = x;
    elem.info.selectDebugVis.appendChild(option);
  });
}

/**
 * Converts a multi-line string into an object, where each line consists of a key
 * followed by a value separated by a space.
 *
 * @param {string} input - The input string, where each line contains a key and a value.
 */
const parseStringToObject = (input) => {
  /** @type {Object<string, string>} */
  const result = {};
  const lines = input.split('\n');

  lines.forEach((line) => {
    const [key, ...valueParts] = line.trim().split(' ');
    if (key) {
      const value = valueParts.join(' '); // Handle potential spaces in the value
      result[key] = value;
    }
  });

  return result;
};

export async function recognizeAllClick() {
  // User can select engine directly using advanced options, or indirectly using basic options.
  /** @type {"legacy" | "lstm" | "combined"} */
  let oemMode;
  if (elem.info.enableAdvancedRecognition.checked) {
    oemMode = /** @type {"legacy" | "lstm" | "combined"} */(elem.recognize.oemLabelText.innerHTML.toLowerCase());
  } else if (elem.recognize.ocrQuality.value === '1') {
    oemMode = 'combined';
  } else {
    oemMode = 'legacy';
    setOemLabel('legacy');
  }

  setLangOpt();

  ProgressBars.active = ProgressBars.recognize;
  const progressMax = oemMode === 'combined' ? scribe.data.image.pageCount * 2 + 1 : scribe.data.image.pageCount + 1;
  ProgressBars.active.show(progressMax, 0);

  await scribe.recognize({
    modeAdv: oemMode,
    langs: ScribeViewer.opt.langs,
    combineMode: ScribeViewer.opt.combineMode,
    vanillaMode: ScribeViewer.opt.vanillaMode,
    config: parseStringToObject(elem.recognize.tessParameters.value),
  });

  ScribeViewer.displayPage(ScribeViewer.state.cp.n);

  addVisInstructionsUI();

  ProgressBars.active.increment();

  if (scribe.data.font.enableOpt) {
    elem.view.optimizeFont.disabled = false;
    elem.view.optimizeFont.checked = true;
  }

  updateOcrVersionGUI();
  toggleEditConfUI(false);
  toggleEditButtons(false);
  toggleLayoutButtons(false);
}

elem.recognize.recognizeAll.addEventListener('click', () => {
  ScribeViewer.state.recognizeAllPromise = recognizeAllClick();
});

elem.edit.recognizeArea.addEventListener('click', () => (ScribeViewer.mode = 'recognizeArea'));
elem.edit.recognizeWord.addEventListener('click', () => (ScribeViewer.mode = 'recognizeWord'));

elem.info.debugPrintCoords.addEventListener('click', () => (ScribeViewer.mode = 'printCoords'));

elem.layout.addLayoutBox.addEventListener('click', () => {
  ScribeViewer.mode = { Order: 'addLayoutBoxOrder', Exclude: 'addLayoutBoxExclude', Column: 'addLayoutBoxDataTable' }[elem.layout.layoutBoxType.textContent];
});

elem.layout.addLayoutBoxTypeOrder.addEventListener('click', () => {
  ScribeViewer.mode = 'addLayoutBoxOrder';
  elem.layout.layoutBoxType.textContent = 'Order';
});

elem.layout.addLayoutBoxTypeExclude.addEventListener('click', () => {
  ScribeViewer.mode = 'addLayoutBoxExclude';
  elem.layout.layoutBoxType.textContent = 'Exclude';
});

function toggleSelectableWords(selectable = true) {
  const allObjects = ScribeViewer.getKonvaWords();
  allObjects.forEach((obj) => {
    obj.listening(selectable);
  });
}

elem.layout.layoutApplyPages.addEventListener('click', () => {
  let layoutApplyPagesMin = parseInt(elem.layout.layoutApplyPagesMin.value);
  let layoutApplyPagesMax = parseInt(elem.layout.layoutApplyPagesMax.value);
  layoutApplyPagesMin = Math.max(0, layoutApplyPagesMin);
  layoutApplyPagesMax = Math.min(scribe.data.pageMetrics.length - 1, layoutApplyPagesMax);

  if (!layoutApplyPagesMin || !layoutApplyPagesMax || layoutApplyPagesMin > layoutApplyPagesMax) {
    console.warn(`Invalid layout apply pages: ${layoutApplyPagesMin} ${layoutApplyPagesMax}`);
    return;
  }
  ScribeViewer.layout.applyLayoutRegions(ScribeViewer.state.cp.n, layoutApplyPagesMin, layoutApplyPagesMax);
  ScribeViewer.layout.applyLayoutDataTables(ScribeViewer.state.cp.n, layoutApplyPagesMin, layoutApplyPagesMax);
});

elem.layout.layoutApplyPagesMin.addEventListener('keyup', () => {
  let layoutApplyPagesMin = parseInt(elem.layout.layoutApplyPagesMin.value);
  let layoutApplyPagesMax = parseInt(elem.layout.layoutApplyPagesMax.value);
  layoutApplyPagesMin = Math.max(0, layoutApplyPagesMin);
  layoutApplyPagesMax = Math.min(scribe.data.pageMetrics.length - 1, layoutApplyPagesMax);

  if (!layoutApplyPagesMin || !layoutApplyPagesMax || layoutApplyPagesMin > layoutApplyPagesMax) {
    elem.layout.layoutApplyPages.disabled = true;
  } else {
    elem.layout.layoutApplyPages.disabled = false;
  }
});

elem.layout.layoutApplyPagesMax.addEventListener('keyup', () => {
  let layoutApplyPagesMin = parseInt(elem.layout.layoutApplyPagesMin.value);
  let layoutApplyPagesMax = parseInt(elem.layout.layoutApplyPagesMax.value);
  layoutApplyPagesMin = Math.max(0, layoutApplyPagesMin);
  layoutApplyPagesMax = Math.min(scribe.data.pageMetrics.length - 1, layoutApplyPagesMax);

  if (!layoutApplyPagesMin || !layoutApplyPagesMax || layoutApplyPagesMin > layoutApplyPagesMax) {
    elem.layout.layoutApplyPages.disabled = true;
  } else {
    elem.layout.layoutApplyPages.disabled = false;
  }
});

elem.layout.addDataTable.addEventListener('click', () => (ScribeViewer.mode = 'addLayoutBoxDataTable'));

elem.layout.deleteLayout.addEventListener('click', () => {
  ScribeViewer.CanvasSelection.deleteSelectedLayoutDataTable();
  ScribeViewer.CanvasSelection.deleteSelectedLayoutRegion();
});

elem.layout.setLayoutBoxInclusionRuleMajority.addEventListener('click', () => ScribeViewer.layout.setLayoutBoxInclusionRuleClick('majority'));
elem.layout.setLayoutBoxInclusionRuleLeft.addEventListener('click', () => ScribeViewer.layout.setLayoutBoxInclusionRuleClick('left'));

elem.layout.setLayoutBoxInclusionLevelWord.addEventListener('click', () => ScribeViewer.layout.setLayoutBoxInclusionLevelClick('word'));
elem.layout.setLayoutBoxInclusionLevelLine.addEventListener('click', () => ScribeViewer.layout.setLayoutBoxInclusionLevelClick('line'));

elem.evaluate.ignorePunct.addEventListener('change', () => {
  scribe.opt.ignorePunct = elem.evaluate.ignorePunct.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.evaluate.ignoreCap.addEventListener('change', () => {
  scribe.opt.ignoreCap = elem.evaluate.ignoreCap.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
});

elem.evaluate.ignoreExtra.addEventListener('change', () => {
  scribe.opt.ignoreExtra = elem.evaluate.ignoreExtra.checked;
  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
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
    ScribeViewer.displayPage(parseInt(elem.nav.pageNum.value) - 1, true);
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
  elem.layout.deleteLayout.disabled = disable;
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
  ScribeViewer.opt.combineMode = /** @type {"data" | "conf"}* */(elem.recognize.updateConfOnly.checked ? 'conf' : 'data');
});

ProgressBars.active = ProgressBars.import;

/**
 *
 * @param {Array<File> | FileList} files
 */
const importFontsGUI = async (files) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const src = await file.arrayBuffer();
    await scribe.data.font.addFontFromFile(src);
  }

  const existingFontsUI = Array.from(elem.edit.wordFont.options).map((x) => x.value);

  // Add fonts extracted to UI
  if (scribe.data.font.doc && Object.keys(scribe.data.font.doc).length > 0) {
    Object.keys(scribe.data.font.doc).forEach((label) => {
      if (existingFontsUI.includes(label)) return;
      const option = document.createElement('option');
      option.value = label;
      option.text = label;
      elem.edit.wordFont.appendChild(option);
    });
  }
};

/**
 *
 * @param {Array<File> | FileList} files
 */
const importFilesGUI = async (files) => {
  ProgressBars.active = ProgressBars.import;
  ProgressBars.active.show(files.length, 0);

  await scribe.importFiles(files);

  ScribeViewer.displayPage(ScribeViewer.state.cp.n);

  const existingFontsUI = Array.from(elem.edit.wordFont.options).map((x) => x.value);

  // Add fonts extracted from document to the UI
  if (scribe.inputData.pdfMode && scribe.data.font.doc && Object.keys(scribe.data.font.doc).length > 0) {
    Object.keys(scribe.data.font.doc).forEach((label) => {
      if (existingFontsUI.includes(label)) return;
      const option = document.createElement('option');
      option.value = label;
      option.text = label;
      elem.edit.wordFont.appendChild(option);
    });
  }

  // Start loading Tesseract if it was not already loaded.
  // Tesseract is not loaded on startup, however if the user uploads data, they presumably want to run something that requires Tesseract.
  const ocrParams = { anyOk: true, vanillaMode: ScribeViewer.opt.vanillaMode, langs: ScribeViewer.opt.langs };
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
  if (ScribeViewer.state.cp.n === 0) return;
  const lastPage = ScribeViewer.search.matches.slice(0, ScribeViewer.state.cp.n)?.findLastIndex((x) => x > 0);
  if (lastPage > -1) ScribeViewer.displayPage(lastPage, true);
}

function nextMatchClick() {
  const nextPageOffset = ScribeViewer.search.matches.slice(ScribeViewer.state.cp.n + 1)?.findIndex((x) => x > 0);
  if (nextPageOffset > -1) ScribeViewer.displayPage(ScribeViewer.state.cp.n + nextPageOffset + 1, true);
}

elem.nav.editFindCollapse.addEventListener('show.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'editFindCollapse') {
    ScribeViewer.state.searchMode = true;
    ScribeViewer.search.highlightcp(ScribeViewer.search.search);
  }
});

elem.nav.editFindCollapse.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'editFindCollapse') {
    ScribeViewer.state.searchMode = false;
    const words = ScribeViewer.getKonvaWords();
    words.forEach((word) => word.fillBox = false);
    ScribeViewer.layerText.batchDraw();
  }
});

elem.nav.editFind.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    const val = elem.nav.editFind.value.trim();
    if (!val) return;

    if (val === ScribeViewer.search.search) {
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
  ScribeViewer.search.findText(text);
  elem.nav.matchCurrent.textContent = calcMatchNumber(ScribeViewer.state.cp.n);
  elem.nav.matchCount.textContent = String(ScribeViewer.search.total);
}

// Returns string showing index of match(es) found on current page.
function calcMatchNumber(n) {
  const matchN = ScribeViewer.search.matches?.[n];
  if (!matchN) {
    return '-';
  }
  // Sum of matches on all previous pages
  const matchPrev = ScribeViewer.search.matches.slice(0, n).reduce((a, b) => a + b, 0);

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

  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
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
    if (!ScribeViewer.opt.showInternalOCRVersions && versionsInt.includes(labelElems[i].innerHTML)) {
      labelElems[i].remove();
      i--;
    }
  }

  if (!ScribeViewer.opt.showInternalOCRVersions) {
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
  ScribeViewer.mode = 'select';
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
    ScribeViewer.state.layoutMode = true;
    // Generally we handle drawing manually, however `autoDrawEnabled` is needed for the user to drag layout boxes.
    ScribeViewer.Konva.autoDrawEnabled = true;
    if (!scribe.data.layoutRegions.pages[ScribeViewer.state.cp.n]) return;

    // Auto-rotate is always enabled for layout mode, so re-render the page if it is not already rotated.
    if (!scribe.opt.autoRotate) {
      ScribeViewer.displayPage(ScribeViewer.state.cp.n);
    } else {
      toggleSelectableWords(false);
      ScribeViewer.destroyControls();
      ScribeViewer.layout.renderLayoutBoxes(ScribeViewer.state.cp.n);
    }
  }
});

elem.nav.navLayout.addEventListener('hide.bs.collapse', (e) => {
  if (e.target instanceof HTMLElement && e.target.id === 'nav-layout') {
    ScribeViewer.state.layoutMode = false;
    ScribeViewer.Konva.autoDrawEnabled = false;

    ScribeViewer.destroyOverlay(false);
    ScribeViewer.layerOverlay.batchDraw();
    ScribeViewer.setWordColorOpacity();
    ScribeViewer.layerText.batchDraw();
    toggleSelectableWords(true);
  }
});

// Resets the environment.
async function clearFiles() {
  scribe.clear();
  clearUI();
}

async function clearUI() {
  ScribeViewer.state.cp.n = 0;

  if (ScribeViewer.stage) ScribeViewer.stage.clear();
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

ScribeViewer.KonvaOcrWord.updateUI = () => {
  const wordFirst = ScribeViewer.CanvasSelection.getKonvaWords()[0];

  if (!wordFirst) return;

  const { fontFamilyArr, fontSizeArr } = ScribeViewer.CanvasSelection.getWordProperties();

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

ScribeViewer.KonvaLayout.updateUI = () => {
  const { inclusionRuleArr, inclusionLevelArr } = ScribeViewer.CanvasSelection.getLayoutBoxProperties();

  if (inclusionRuleArr.length < 1 || inclusionLevelArr.length < 1) return;

  elem.layout.setLayoutBoxInclusionRuleMajority.checked = inclusionRuleArr[0] === 'majority';
  elem.layout.setLayoutBoxInclusionRuleLeft.checked = inclusionRuleArr[0] === 'left';

  elem.layout.setLayoutBoxInclusionLevelWord.checked = inclusionLevelArr[0] === 'word';
  elem.layout.setLayoutBoxInclusionLevelLine.checked = inclusionLevelArr[0] === 'line';
};

const ctxLegend = /** @type {CanvasRenderingContext2D} */ (elem.canvas.legendCanvas.getContext('2d'));

const renderDebugVis = (n) => {
  if (scribe.opt.debugVis && elem.info.selectDebugVis.value !== 'None' && scribe.data.vis[n][elem.info.selectDebugVis.value]) {
    const group = ScribeViewer.getOverlayGroup(n);
    group.destroyChildren();

    if (!ScribeViewer.overlayGroupsRenderIndices.includes(n)) ScribeViewer.overlayGroupsRenderIndices.push(n);

    const pageDims = scribe.data.pageMetrics[n].dims;

    const image = scribe.data.vis[n][elem.info.selectDebugVis.value].canvas;
    const overlayImageKonva = new ScribeViewer.Konva.Image({
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

    ScribeViewer.layerOverlay.batchDraw();
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

    elem.canvas.debugCanvasParentDiv.style.display = '';
  } else {
    elem.canvas.debugCanvasParentDiv.style.display = 'none';
  }
};

ScribeViewer.displayPageCallback = () => {
  elem.nav.pageNum.value = (ScribeViewer.state.cp.n + 1).toString();

  elem.nav.matchCurrent.textContent = calcMatchNumber(ScribeViewer.state.cp.n);
  elem.nav.matchCount.textContent = String(ScribeViewer.search.total);

  renderDebugVis(ScribeViewer.state.cp.n);

  if (elem.info.showConflicts.checked) showDebugImages();

  updateEvalStatsGUI(ScribeViewer.state.cp.n);

  renderConflictVis();
};

/**
 *
 * @param {boolean} enable
 * @param {boolean} [force]
 */
async function optimizeFontClick(enable, force) {
  await scribe.enableFontOpt(enable, force);

  ScribeViewer.displayPage(ScribeViewer.state.cp.n);
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
  scribe.utils.saveAs(pdfBlob, fileName);
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
  await ScribeViewer.state.recognizeAllPromise;

  updatePdfPagesLabel();

  const downloadType = /** @type {("pdf" | "hocr" | "docx" | "xlsx" | "txt" | "text")} */ (/** @type {string} */ (elem.download.formatLabelText.textContent).toLowerCase());

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

async function updateEvalStatsGUI(n) {
  if (!ScribeViewer.evalStats || ScribeViewer.evalStats.length === 0) return;

  const metricTotalWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsPage'));
  const metricCorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsPage'));
  const metricIncorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsPage'));
  const metricMissedWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsPage'));
  const metricExtraWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsPage'));
  const metricCorrectLowConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsPage'));
  const metricIncorrectHighConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsPage'));

  const metricWERPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERPage'));

  // Display metrics for current page
  metricTotalWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].total);
  metricCorrectWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].correct);
  metricIncorrectWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].incorrect);
  metricMissedWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].missed);
  metricExtraWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].extra);
  metricCorrectLowConfWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].correctLowConf);
  metricIncorrectHighConfWordsPageElem.innerHTML = String(ScribeViewer.evalStats[n].incorrectHighConf);

  if (scribe.opt.ignoreExtra) {
    metricWERPageElem.innerHTML = ((ScribeViewer.evalStats[n].incorrect + ScribeViewer.evalStats[n].missed) / ScribeViewer.evalStats[n].total).toFixed(2);
  } else {
    metricWERPageElem.innerHTML = ((ScribeViewer.evalStats[n].incorrect + ScribeViewer.evalStats[n].missed + ScribeViewer.evalStats[n].extra) / ScribeViewer.evalStats[n].total).toFixed(2);
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
  const evalStatsDoc = scribe.utils.calcEvalStatsDoc(ScribeViewer.evalStats);

  metricTotalWordsDocElem.innerHTML = evalStatsDoc.total.toString();
  metricCorrectWordsDocElem.innerHTML = evalStatsDoc.correct.toString();
  metricIncorrectWordsDocElem.innerHTML = evalStatsDoc.incorrect.toString();
  metricMissedWordsDocElem.innerHTML = evalStatsDoc.missed.toString();
  metricExtraWordsDocElem.innerHTML = evalStatsDoc.extra.toString();
  metricCorrectLowConfWordsDocElem.innerHTML = evalStatsDoc.correctLowConf.toString();
  metricIncorrectHighConfWordsDocElem.innerHTML = evalStatsDoc.incorrectHighConf.toString();

  if (scribe.opt.ignoreExtra) {
    metricWERDocElem.innerHTML = ((evalStatsDoc.incorrect + evalStatsDoc.missed) / evalStatsDoc.total).toFixed(2);
  } else {
    metricWERDocElem.innerHTML = ((evalStatsDoc.incorrect + evalStatsDoc.missed + evalStatsDoc.extra) / evalStatsDoc.total).toFixed(2);
  }
}

async function createGroundTruthClick() {
  if (!scribe.data.ocr['Ground Truth']) {
    scribe.data.ocr['Ground Truth'] = Array(scribe.data.ocr.active.length);
  }

  // Use whatever the current HOCR is as a starting point
  for (let i = 0; i < scribe.data.ocr.active.length; i++) {
    scribe.data.ocr['Ground Truth'][i] = structuredClone(scribe.data.ocr.active[i]);
  }

  updateOcrVersionGUI();
  setCurrentHOCR('Ground Truth');

  const option = document.createElement('option');
  option.text = 'Evaluate Mode (Compare with Ground Truth)';
  option.value = 'eval';
  elem.view.displayMode.add(option);

  elem.evaluate.createGroundTruth.disabled = true;
  // compareGroundTruthElem.disabled = false;

  scribe.inputData.evalMode = true;

  // Calculate statistics
  await ScribeViewer.compareGroundTruth();
  updateEvalStatsGUI(ScribeViewer.state.cp.n);
}

/**
 * Print the code needed to access a specific OCR word.
 * This is useful for generating automated tests.
 * @param {OcrWord} word
 */
const printOcrWordCode = (word) => {
  if (!scribe.data.ocr.active[ScribeViewer.state.cp.n]) return;
  let i = 0;
  let j = 0;
  for (i = 0; i < scribe.data.ocr.active[ScribeViewer.state.cp.n].lines.length; i++) {
    const line = scribe.data.ocr.active[ScribeViewer.state.cp.n].lines[i];
    for (j = 0; j < line.words.length; j++) {
      if (line.words[j].id === word.id) {
        console.log(`scribe.data.ocr.active[${ScribeViewer.state.cp.n}].lines[${i}].words[${j}]`);
        return;
      }
    }
  }
};

export function printSelectedWords(printOCR = true) {
  const selectedObjects = ScribeViewer.CanvasSelection.getKonvaWords();
  if (!selectedObjects) return;
  for (let i = 0; i < selectedObjects.length; i++) {
    if (printOCR) {
      printOcrWordCode(selectedObjects[i].word);
      console.log(selectedObjects[i].word);
    } else {
      console.log(selectedObjects[i]);
    }
  }
}

const canvasDebug = /** @type {HTMLCanvasElement} */ (document.getElementById('g'));

export async function showDebugImages() {
  /** @type {Array<Array<CompDebugBrowser>>} */
  const compDebugArrArr = [];

  const compDebugArr1 = scribe.data.debug.debugImg?.['Tesseract Combined']?.[ScribeViewer.state.cp.n];
  const compDebugArr2 = scribe.data.debug.debugImg?.Combined?.[ScribeViewer.state.cp.n];
  const compDebugArr3 = scribe.data.debug.debugImg?.recognizeArea?.[ScribeViewer.state.cp.n];

  if (compDebugArr1 && compDebugArr1.length > 0) compDebugArrArr.push(compDebugArr1);
  if (compDebugArr2 && compDebugArr2.length > 0) compDebugArrArr.push(compDebugArr2);
  if (compDebugArr3 && compDebugArr3.length > 0) compDebugArrArr.push(compDebugArr3);

  if (compDebugArrArr.length > 0) await scribe.utils.drawDebugImages({ canvas: canvasDebug, compDebugArrArr, context: 'browser' });
}

export async function evalSelectedLine() {
  const selectedObjects = ScribeViewer.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  const word0 = selectedObjects[0].word;

  const res = await scribe.evalOCRPage({ page: word0.line, view: true });

  await scribe.utils.drawDebugImages({ canvas: canvasDebug, compDebugArrArr: [[res.debug[0]]], context: 'browser' });
}

export async function downloadCanvas() {
  const dims = scribe.data.pageMetrics[ScribeViewer.state.cp.n].dims;

  const startX = ScribeViewer.layerText.x() > 0 ? Math.round(ScribeViewer.layerText.x()) : 0;
  const startY = ScribeViewer.layerText.y() > 0 ? Math.round(ScribeViewer.layerText.y()) : 0;
  const width = dims.width * ScribeViewer.layerText.scaleX();
  const height = dims.height * ScribeViewer.layerText.scaleY();

  const canvasDataStr = ScribeViewer.stage.toDataURL({
    x: startX, y: startY, width, height,
  });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}_canvas_${String(ScribeViewer.state.cp.n)}.png`;
  const imgBlob = scribe.utils.imageStrToBlob(canvasDataStr);
  scribe.utils.saveAs(imgBlob, fileName);
}

export async function downloadImage(n) {
  const image = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinary(n) : await scribe.data.image.getNative(n);
  const filenameBase = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}`;

  const fileName = `${filenameBase}_${String(n).padStart(3, '0')}.${image.format}`;
  const imgBlob = scribe.utils.imageStrToBlob(image.src);
  scribe.utils.saveAs(imgBlob, fileName);
}

export async function downloadCurrentImage() {
  await downloadImage(ScribeViewer.state.cp.n);
}

export async function downloadAllImages() {
  const binary = scribe.opt.colorMode === 'binary';
  for (let i = 0; i < scribe.data.image.pageCount; i++) {
    await downloadImage(i);
    // Not all files will be downloaded without a delay between downloads
    await new Promise((r) => setTimeout(r, 200));
  }
}

elem.info.downloadStaticVis.addEventListener('click', async () => {
  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.png`;
  const pngBlob = await scribe.utils.renderPageStatic(scribe.data.ocr.active[ScribeViewer.state.cp.n]);
  scribe.utils.saveAs(pngBlob, fileName);
});

elem.info.downloadPDFFonts.addEventListener('click', async () => {
  const muPDFScheduler = await scribe.data.image.muPDFScheduler;
  if (!muPDFScheduler) return;
  muPDFScheduler.extractAllFonts().then(async (x) => {
    for (let i = 0; i < x.length; i++) {
      scribe.utils.saveAs(x[i], `font_${String(i).padStart(2, '0')}.ttf`);
    }
  });
});

export function getExcludedText() {
  for (let i = 0; i <= scribe.data.ocr.active.length; i++) {
    const textArr = getExcludedTextPage(scribe.data.ocr.active[i], scribe.data.layoutRegions.pages[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(`${x} [Page ${String(i)}]`));
    }
  }
}

// Get array of text that will be excluded from exports due to "exclude" layout boxes.
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point.

/**
 * @param {OcrPage} pageA
 * @param {LayoutPage} layoutObj
 * @param {boolean} [applyExclude=true]
 */
export function getExcludedTextPage(pageA, layoutObj, applyExclude = true) {
  const excludedArr = [];

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length === 0) return excludedArr;

  const orderArr = Array(pageA.lines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  orderArr.fill(10);

  for (let i = 0; i < pageA.lines.length; i++) {
    const lineA = pageA.lines[i];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = scribe.utils.calcBoxOverlap(lineA.bbox, obj.coords);
      if (overlap > 0.5) {
        if (obj.type === 'order') {
          orderArr[i] = obj.order;
        } else if (obj.type === 'exclude' && applyExclude) {
          const { words } = lineA;
          let text = '';
          for (let j = 0; j < words.length; j++) {
            text += `${words[j].text} `;
          }
          excludedArr.push(text);
        }
      }
    }
  }

  return excludedArr;
}
