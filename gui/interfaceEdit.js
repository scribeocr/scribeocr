/* eslint-disable import/no-cycle */

// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import { Button } from '../lib/bootstrap.esm.bundle.min.js';
import { displayPage, renderPageQueue, stateGUI } from '../main.js';
import scribe from '../module.js';
import { elem } from './elems.js';
import {
  KonvaOcrWord,
  layerText,
  ScribeCanvas,
  updateWordCanvas,
} from './interfaceCanvas.js';

elem.edit.styleItalic.addEventListener('click', () => { changeWordFontStyle('italic'); });
elem.edit.styleBold.addEventListener('click', () => { changeWordFontStyle('bold'); });
elem.edit.styleSmallCaps.addEventListener('click', () => toggleSmallCapsWords(elem.edit.styleSmallCaps.classList.contains('active')));
elem.edit.styleSuper.addEventListener('click', toggleSuperSelectedWords);

elem.edit.ligatures.addEventListener('change', () => {
  scribe.opt.ligatures = elem.edit.ligatures.checked;
  renderPageQueue(stateGUI.cp.n);
});

const styleItalicButton = new Button(elem.edit.styleItalic);
const styleBoldButton = new Button(elem.edit.styleBold);
const styleSmallCapsButton = new Button(elem.edit.styleSmallCaps);

export function deleteSelectedWords() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  const selectedN = selectedObjects.length;
  const selectedIds = [];

  for (let i = 0; i < selectedN; i++) {
    const wordIDI = selectedObjects[i].word.id;
    selectedIds.push(wordIDI);
    selectedObjects[i].destroy();
  }
  scribe.utils.ocr.deletePageWords(scribe.data.ocr.active[stateGUI.cp.n], selectedIds);

  ScribeCanvas.destroyControls();

  layerText.batchDraw();

  // Re-render the page if the user has selected the option to outline lines to update the line boxes.
  if (elem.view.outlineLines.checked) renderPageQueue(stateGUI.cp.n);
}

/**
 *
 * @param {('normal'|'italic'|'bold')} style
 */
export async function changeWordFontStyle(style) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  if (ScribeCanvas.inputRemove) ScribeCanvas.inputRemove();

  // If first word style already matches target style, disable the style.
  const enable = selectedObjects[0].word.style !== style;
  const newStyle = enable ? style : 'normal';

  // For some reason the buttons can go out of sync, so this should prevent that.
  if ((newStyle === 'italic') !== elem.edit.styleItalic.classList.contains('active')) {
    styleItalicButton.toggle();
  }
  if ((newStyle === 'bold') !== elem.edit.styleBold.classList.contains('active')) {
    styleBoldButton.toggle();
  }

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    wordI.word.style = newStyle;

    // wordI.fontStyle = newStyle;

    const fontI = scribe.data.font.getFont(wordI.fontFamilyLookup, newStyle);

    wordI.fontFaceName = fontI.fontFaceName;
    wordI.fontFaceStyle = fontI.fontFaceStyle;
    wordI.fontFaceWeight = fontI.fontFaceWeight;

    wordI.fontFamilyLookup = fontI.family;

    await updateWordCanvas(wordI);
  }

  layerText.batchDraw();
}

/**
 *
 * @param {string} fontSizeStr - String containing (1) 'plus', (2) 'minus', or (3) a numeric size.
 */
export async function changeWordFontSize(fontSizeStr) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  let fontSize;
  if (fontSizeStr === 'plus') {
    fontSize = selectedObjects[0].fontSize + 1;
  } else if (fontSizeStr === 'minus') {
    fontSize = selectedObjects[0].fontSize - 1;
  } else {
    fontSize = parseFloat(fontSizeStr);
  }

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    // If multiple words are selected, the change in font size only applies to the non-superscript words.
    // Without this behavior, selecting a large area and standardizing the font size would result in
    // the superscripted text becoming the same size as the non-superscript text.
    if (selectedN > 1 && wordI.word.sup) continue;

    wordI.word.size = fontSize;

    elem.edit.fontSize.value = String(fontSize);
    wordI.fontSize = fontSize;

    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

export async function changeWordFontFamily(fontName) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects) return;

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    const fontI = scribe.data.font.getFont(fontName, wordI.word.style);

    if (fontName === 'Default') {
      wordI.word.font = null;
    } else {
      wordI.word.font = fontName;
    }

    wordI.fontFaceName = fontI.fontFaceName;
    wordI.fontFaceStyle = fontI.fontFaceStyle;
    wordI.fontFaceWeight = fontI.fontFaceWeight;

    wordI.fontFamilyLookup = fontI.family;

    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

export function toggleSuperSelectedWords() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;
  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    wordI.word.sup = !wordI.word.sup;
  }

  renderPageQueue(stateGUI.cp.n);
}

/**
 *
 * @param {boolean} enable
 * @returns
 */
export async function toggleSmallCapsWords(enable) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;
  const selectedN = selectedObjects.length;

  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    wordI.word.smallCaps = enable;
    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

/** @type {Array<KonvaOcrWord>} */
let objectsLine;

const baselineRange = 25;
export function adjustBaseline() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

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

  layerText.batchDraw();
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

export async function addWordManual({
  x: rectLeft, y: rectTop, height: rectHeight, width: rectWidth,
}) {
  const wordText = 'A';
  // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
  let angleAdjXRect = 0;
  let angleAdjYRect = 0;
  let sinAngle = 0;
  let shiftX = 0;
  let shiftY = 0;
  if (scribe.opt.autoRotate && Math.abs(scribe.data.pageMetrics[stateGUI.cp.n].angle ?? 0) > 0.05) {
    const rotateAngle = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;

    const pageDims = scribe.data.pageMetrics[stateGUI.cp.n].dims;

    sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
    const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

    shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
    shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

    const baselineY = (rectTop + rectHeight) - (rectHeight) / 3;

    const angleAdjYInt = (1 - cosAngle) * (baselineY - shiftY) - sinAngle * (rectLeft - shiftX);
    const angleAdjXInt = sinAngle * ((baselineY - shiftY) - angleAdjYInt * 0.5);

    angleAdjXRect = angleAdjXInt + shiftX;
    angleAdjYRect = angleAdjYInt + shiftY;
  }

  // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
  const rectTopHOCR = rectTop - angleAdjYRect;
  const rectBottomHOCR = rectTop + rectHeight - angleAdjYRect;

  const rectLeftHOCR = rectLeft - angleAdjXRect;
  const rectRightHOCR = rectLeft + rectWidth - angleAdjXRect;

  const wordBox = {
    left: rectLeftHOCR, top: rectTopHOCR, right: rectRightHOCR, bottom: rectBottomHOCR,
  };

  const pageObj = new scribe.utils.ocr.OcrPage(stateGUI.cp.n, scribe.data.ocr.active[stateGUI.cp.n].dims);
  // Create a temporary line to hold the word until it gets combined.
  // This should not be used after `combineData` is run as it is not the final line.
  const lineObjTemp = new scribe.utils.ocr.OcrLine(pageObj, wordBox, [0, 0], 10, null);
  pageObj.lines = [lineObjTemp];
  const wordIDNew = scribe.utils.getRandomAlphanum(10);
  const wordObj = new scribe.utils.ocr.OcrWord(lineObjTemp, wordText, wordBox, wordIDNew);
  // Words added by user are assumed to be correct.
  wordObj.conf = 100;
  lineObjTemp.words = [wordObj];

  scribe.combineOCRPage(pageObj, scribe.data.ocr.active[stateGUI.cp.n], scribe.data.pageMetrics[stateGUI.cp.n], true, false);

  // Get line word was added to in main data.
  // This will have different metrics from `lineObj` when the line was combined into an existing line.
  const wordObjNew = scribe.utils.ocr.getPageWord(scribe.data.ocr.active[stateGUI.cp.n], wordIDNew);

  if (!wordObjNew) throw new Error('Failed to add word to page.');

  const angle = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;
  const enableRotation = scribe.opt.autoRotate && Math.abs(angle ?? 0) > 0.05;
  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  const angleAdjLine = enableRotation ? scribe.utils.ocr.calcLineStartAngleAdj(wordObjNew.line) : { x: 0, y: 0 };
  const angleAdjWord = enableRotation ? scribe.utils.ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

  const box = wordObjNew.bbox;
  const linebox = wordObjNew.line.bbox;
  const baseline = wordObjNew.line.baseline;

  let visualBaseline;
  if (enableRotation) {
    visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;
  } else {
    visualBaseline = linebox.bottom + baseline[1] + baseline[0] * (box.left - linebox.left);
  }

  const displayMode = elem.view.displayMode.value;
  const confThreshHigh = elem.info.confThreshHigh.value !== '' ? parseInt(elem.info.confThreshHigh.value) : 85;
  const outlineWord = elem.view.outlineWords.checked || displayMode === 'eval' && wordObj.conf > confThreshHigh && !wordObj.matchTruth;

  const wordCanvas = new KonvaOcrWord({
    visualLeft: rectLeft,
    yActual: visualBaseline,
    topBaseline: visualBaseline,
    rotation: angleArg,
    word: wordObj,
    outline: outlineWord,
    fillBox: false,
  });

  ScribeCanvas.addWord(wordCanvas);

  layerText.batchDraw();
}

/**
 * Recognize area selected by user in Tesseract.
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.x
 * @param {number} box.y
 * @param {boolean} [wordMode=false] - Assume selection is single word.
 * @param {boolean} [printCoordsOnly=false] - Print rect coords only, do not run recognition. Used for debugging.
 *
 * Note: This function assumes OCR data already exists, which this function is adding to.
 * Users should not be allowed to recognize a word/area before OCR data is provided by (1) upload or (2) running "recognize all".
 * Even if recognizing an page for the first time using "recognize area" did not produce an error,
 * it would still be problematic, as running "recognize all" afterwards would overwrite everything.
 */
export async function recognizeArea(box, wordMode = false, printCoordsOnly = false) {
  // Return early if the rectangle is too small to be a word.
  if (box.width < 4 || box.height < 4) return;

  const canvasCoords = {
    left: box.x, top: box.y, width: box.width, height: box.height,
  };

  // This should always be running on a rotated image, as the recognize area button is only enabled after the angle is already known.
  const imageRotated = true;
  const angle = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;

  const imageCoords = scribe.utils.coords.canvasToImage(canvasCoords, imageRotated, scribe.opt.autoRotate, stateGUI.cp.n, angle);

  if (printCoordsOnly) {
    const debugCoords = {
      left: imageCoords.left,
      top: imageCoords.top,
      right: imageCoords.left + imageCoords.width,
      bottom: imageCoords.top + imageCoords.height,
      topInv: scribe.data.pageMetrics[stateGUI.cp.n].dims.height - imageCoords.top,
      bottomInv: scribe.data.pageMetrics[stateGUI.cp.n].dims.height - (imageCoords.top + imageCoords.height),
    };
    console.log(debugCoords);
    return;
  }

  // When a user is manually selecting words to recognize, they are assumed to be in the same block.
  // SINGLE_BLOCK: '6',
  // SINGLE_WORD: '8',
  const psm = wordMode ? '8' : '6';
  const n = stateGUI.cp.n;

  const res0 = await scribe.recognizePage(n, true, true, true, { rectangle: imageCoords, tessedit_pageseg_mode: psm });

  const resLegacy = await res0[0];
  const resLSTM = await res0[1];

  const debug = false;
  if (debug) {
    console.log(resLegacy.recognize);
  }

  const pageObjLSTM = resLSTM.convert.lstm.pageObj;
  const pageObjLegacy = resLegacy.convert.legacy.pageObj;

  const debugLabel = 'recognizeArea';

  if (debugLabel && !scribe.data.debug.debugImg[debugLabel]) {
    scribe.data.debug.debugImg[debugLabel] = new Array(scribe.data.image.pageCount);
    for (let i = 0; i < scribe.data.image.pageCount; i++) {
      scribe.data.debug.debugImg[debugLabel][i] = [];
    }
  }

  /** @type {Parameters<typeof import('../js/recognizeConvert.js').compareOCRPage>[3]} */
  const compOptions = {
    mode: 'comb',
    debugLabel,
    ignoreCap: elem.evaluate.ignoreCap.checked,
    ignorePunct: elem.evaluate.ignorePunct.checked,
    confThreshHigh: parseInt(elem.info.confThreshHigh.value),
    confThreshMed: parseInt(elem.info.confThreshMed.value),
    legacyLSTMComb: true,
  };

  const res = await scribe.compareOCRPage(pageObjLegacy, pageObjLSTM, n, compOptions);

  scribe.data.debug.debugImg[debugLabel][n].push(...res.debugImg);

  scribe.combineOCRPage(res.page, scribe.data.ocr.active[n], scribe.data.pageMetrics[n]);

  if (n === stateGUI.cp.n) displayPage(stateGUI.cp.n);
}
