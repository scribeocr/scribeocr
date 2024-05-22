/* eslint-disable import/no-cycle */

// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import { renderPageQueue, cp, displayPage } from '../../main.js';
import { fontAll } from '../containers/fontContainer.js';
import ocr from '../objects/ocrObjects.js';
import {
  stage, layerText, updateWordCanvas, KonvaOcrWord, canvasObj,
  getCanvasWords,
  destroyControls,
} from './interfaceCanvas.js';
import { combineData } from '../modifyOCR.js';
import { getRandomAlphanum } from '../miscUtils.js';
import coords from '../coordinates.js';
import { recognizePage } from '../recognizeConvert.js';
import { imageCache } from '../containers/imageContainer.js';
import Tesseract from '../../tess/tesseract.esm.min.js';
import { ocrAll, pageMetricsArr } from '../containers/miscContainer.js';

const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
const fontMinusElem = /** @type {HTMLInputElement} */(document.getElementById('fontMinus'));
const fontPlusElem = /** @type {HTMLInputElement} */(document.getElementById('fontPlus'));
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

const deleteWordElem = /** @type {HTMLInputElement} */(document.getElementById('deleteWord'));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
const recognizeWordDropdownElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWordDropdown'));
const editBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('editBaseline'));
const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
const outlineLinesElem = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));
const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

const outlineWordsElem = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));

const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));
const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));

styleItalicElem.addEventListener('click', () => { changeWordFontStyle('italic'); });
styleSmallCapsElem.addEventListener('click', () => { changeWordFontStyle('small-caps'); });
styleSuperElem.addEventListener('click', toggleSuperSelectedWords);

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

export function deleteSelectedWords() {
  const selectedObjects = canvasObj.selectedWordArr;
  const selectedN = selectedObjects.length;
  const selectedIds = [];

  for (let i = 0; i < selectedN; i++) {
    const wordIDI = selectedObjects[i].word.id;
    selectedIds.push(wordIDI);
    selectedObjects[i].destroy();
  }
  ocr.deletePageWords(ocrAll.active[cp.n], selectedIds);

  destroyControls();

  layerText.batchDraw();

  // Re-render the page if the user has selected the option to outline lines to update the line boxes.
  if (outlineLinesElem.checked) renderPageQueue(cp.n);
}

/**
 *
 * @param {string} style
 */
export async function changeWordFontStyle(style) {
  const selectedObjects = canvasObj.selectedWordArr;
  if (!selectedObjects || selectedObjects.length === 0) return;

  // If first word style already matches target style, disable the style.
  const enable = selectedObjects[0].fontStyleLookup !== style;
  const newStyleLookup = enable ? style : 'normal';

  // For some reason the buttons can go out of sync, so this should prevent that.
  if ((newStyleLookup === 'italic') !== styleItalicElem.classList.contains('active')) {
    styleItalicButton.toggle();
  }
  if ((newStyleLookup === 'small-caps') !== styleSmallCapsElem.classList.contains('active')) {
    styleSmallCapsButton.toggle();
  }

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    wordI.word.style = newStyleLookup;

    wordI.fontStyleLookup = newStyleLookup;

    const fontI = fontAll.getFont(wordI.fontFamilyLookup, newStyleLookup);

    wordI.fontFaceName = fontI.fontFaceName;
    wordI.fontFaceStyle = fontI.fontFaceStyle;

    wordI.fontFamilyLookup = fontI.family;
    wordI.fontStyleLookup = fontI.style;

    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

/**
 *
 * @param {string} fontSizeStr - String containing (1) 'plus', (2) 'minus', or (3) a numeric size.
 */
export async function changeWordFontSize(fontSizeStr) {
  const selectedObjects = canvasObj.selectedWordArr;
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

    fontSizeElem.value = String(fontSize);
    wordI.fontSize = fontSize;

    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

export async function changeWordFontFamily(fontName) {
  const selectedObjects = canvasObj.selectedWordArr;
  if (!selectedObjects) return;

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    const fontI = fontAll.getFont(fontName, wordI.fontStyleLookup);

    if (fontName === 'Default') {
      wordI.word.font = null;
    } else {
      wordI.word.font = fontName;
    }

    wordI.fontFaceName = fontI.fontFaceName;
    wordI.fontFaceStyle = fontI.fontFaceStyle;

    wordI.fontFamilyLookup = fontI.family;
    wordI.fontStyleLookup = fontI.style;

    await updateWordCanvas(wordI);
  }
  layerText.batchDraw();
}

export function toggleSuperSelectedWords() {
  const selectedObjects = canvasObj.selectedWordArr;
  if (!selectedObjects || selectedObjects.length === 0) return;
  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    wordI.word.sup = !wordI.word.sup;
  }

  renderPageQueue(cp.n);
}

/** @type {Array<KonvaOcrWord>} */
let objectsLine;

const baselineRange = 25;
export function adjustBaseline() {
  globalThis.bsCollapse.toggle();

  const selectedObjects = canvasObj.selectedWordArr;
  if (!selectedObjects || selectedObjects.length === 0) return;

  rangeBaselineElem.value = String(baselineRange + selectedObjects[0].baselineAdj);

  // Unlikely identify lines using the ID of the first word on the line.
  const lineI = selectedObjects[0]?.word?.line?.words[0]?.id;

  console.assert(lineI !== undefined, 'Failed to identify line for word.');

  objectsLine = getCanvasWords().filter((x) => x.word.line.words[0].id === lineI);
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
  wordFontElem.disabled = disable;
  fontMinusElem.disabled = disable;
  fontPlusElem.disabled = disable;
  fontSizeElem.disabled = disable;

  styleItalicElem.disabled = disable;
  styleSmallCapsElem.disabled = disable;
  styleSuperElem.disabled = disable;

  deleteWordElem.disabled = disable;
  recognizeWordElem.disabled = disable;
  recognizeWordDropdownElem.disabled = disable;
  editBaselineElem.disabled = disable;
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
  if (autoRotateCheckboxElem.checked && Math.abs(pageMetricsArr[cp.n].angle ?? 0) > 0.05) {
    const rotateAngle = pageMetricsArr[cp.n].angle || 0;

    const pageDims = pageMetricsArr[cp.n].dims;

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

  const pageObj = new ocr.OcrPage(cp.n, ocrAll.active[cp.n].dims);
  // Create a temporary line to hold the word until it gets combined.
  // This should not be used after `combineData` is run as it is not the final line.
  const lineObjTemp = new ocr.OcrLine(pageObj, wordBox, [0, 0], 10, null);
  pageObj.lines = [lineObjTemp];
  const wordIDNew = getRandomAlphanum(10);
  const wordObj = new ocr.OcrWord(lineObjTemp, wordText, wordBox, wordIDNew);
  // Words added by user are assumed to be correct.
  wordObj.conf = 100;
  lineObjTemp.words = [wordObj];

  combineData(pageObj, ocrAll.active[cp.n], pageMetricsArr[cp.n], true, false);

  // Get line word was added to in main data.
  // This will have different metrics from `lineObj` when the line was combined into an existing line.
  const wordObjNew = ocr.getPageWord(ocrAll.active[cp.n], wordIDNew);

  if (!wordObjNew) throw new Error('Failed to add word to page.');

  const angle = pageMetricsArr[cp.n].angle || 0;
  const enableRotation = autoRotateCheckboxElem.checked && Math.abs(angle ?? 0) > 0.05;
  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  const angleAdjLine = enableRotation ? ocr.calcLineAngleAdj(wordObjNew.line) : { x: 0, y: 0 };
  const angleAdjWord = enableRotation ? ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

  const box = wordObjNew.bbox;
  const linebox = wordObjNew.line.bbox;
  const baseline = wordObjNew.line.baseline;

  let visualBaseline;
  if (enableRotation) {
    visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;
  } else {
    visualBaseline = linebox.bottom + baseline[1] + baseline[0] * (box.left - linebox.left);
  }

  const displayMode = displayModeElem.value;
  const confThreshHigh = confThreshHighElem.value !== '' ? parseInt(confThreshHighElem.value) : 85;
  const outlineWord = outlineWordsElem.checked || displayMode === 'eval' && wordObj.conf > confThreshHigh && !wordObj.matchTruth;

  const wordCanvas = new KonvaOcrWord({
    visualLeft: rectLeft,
    yActual: visualBaseline,
    topBaseline: visualBaseline,
    rotation: angleArg,
    word: wordObj,
    outline: outlineWord,
    fillBox: false,
  });

  // Add the text node to the given layer
  layerText.add(wordCanvas);

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
  const canvasRotated = autoRotateCheckboxElem.checked;
  const angle = pageMetricsArr[cp.n].angle || 0;

  const imageCoords = coords.canvasToImage(canvasCoords, imageRotated, canvasRotated, cp.n, angle);

  if (printCoordsOnly) {
    const debugCoords = {
      left: imageCoords.left,
      top: imageCoords.top,
      right: imageCoords.left + imageCoords.width,
      bottom: imageCoords.top + imageCoords.height,
      topInv: pageMetricsArr[cp.n].dims.height - imageCoords.top,
      bottomInv: pageMetricsArr[cp.n].dims.height - (imageCoords.top + imageCoords.height),
    };
    console.log(debugCoords);
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
    globalThis.debugImg[debugLabel] = new Array(imageCache.pageCount);
    for (let i = 0; i < imageCache.pageCount; i++) {
      globalThis.debugImg[debugLabel][i] = [];
    }
  }

  /** @type {Parameters<import('../generalWorkerMain.js').GeneralScheduler['compareHOCR']>[0]['options']} */
  const compOptions = {
    mode: 'comb',
    debugLabel,
    ignoreCap: ignoreCapElem.checked,
    ignorePunct: ignorePunctElem.checked,
    confThreshHigh: parseInt(confThreshHighElem.value),
    confThreshMed: parseInt(confThreshMedElem.value),
    legacyLSTMComb: true,
  };

  const imgBinary = await imageCache.getBinary(n);

  const res = await globalThis.gs.compareHOCR({
    pageA: pageObjLegacy,
    pageB: pageObjLSTM,
    binaryImage: imgBinary,
    pageMetricsObj: pageMetricsArr[n],
    options: compOptions,
  });

  if (globalThis.debugLog === undefined) globalThis.debugLog = '';
  globalThis.debugLog += res.debugLog;

  globalThis.debugImg[debugLabel][n].push(...res.debugImg);

  combineData(res.page, ocrAll.active[n], pageMetricsArr[n]);

  if (n === cp.n) displayPage(cp.n);
}
