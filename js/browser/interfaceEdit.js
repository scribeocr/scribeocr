/* eslint-disable import/no-cycle */

// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import { calcWordMetrics } from '../fontUtils.js';
import { renderPageQueue, cp } from '../../main.js';
import { fontAll } from '../containers/fontContainer.js';
import ocr from '../objects/ocrObjects.js';

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

styleItalicElem.addEventListener('click', () => { changeWordFontStyle('italic'); });
styleSmallCapsElem.addEventListener('click', () => { changeWordFontStyle('small-caps'); });
styleSuperElem.addEventListener('click', toggleSuperSelectedWords);

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

export function deleteSelectedWords() {
  const selectedObjects = window.canvas.getActiveObjects();
  const selectedN = selectedObjects.length;
  const selectedIds = [];

  for (let i = 0; i < selectedN; i++) {
    const wordIDI = selectedObjects[i].wordID;
    selectedIds.push(wordIDI);
    window.canvas.remove(selectedObjects[i]);
  }
  window.canvas.discardActiveObject();
  window.canvas.renderAll();
  ocr.deletePageWords(globalThis.ocrAll.active[cp.n], selectedIds);
}

/**
 *
 * @param {string} style
 */
export async function changeWordFontStyle(style) {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length === 0) return;

  // If first word style already matches target style, disable the style.
  const enable = selectedObjects[0].fontStyleLookup !== style;
  const newStyleLookup = enable ? style : 'normal';

  if ((newStyleLookup === 'italic') !== styleItalicElem.classList.contains('active')) {
    styleItalicButton.toggle();
  }
  if ((newStyleLookup === 'small-caps') !== styleSmallCapsElem.classList.contains('active')) {
    styleSmallCapsButton.toggle();
  }

  const fontActive = fontAll.get('active');

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDI);

    if (!wordObj) {
      console.warn(`Canvas element contains ID${wordIDI}that does not exist in OCR data.  Skipping word.`);
      continue;
    }

    wordObj.style = newStyleLookup;

    wordI.fontStyleLookup = newStyleLookup;

    const fontI = fontActive[wordI.fontFamilyLookup][newStyleLookup];

    wordI.fontFamily = fontI.fontFaceName;
    wordI.fontStyle = fontI.fontFaceStyle;

    wordI.fontObj = fontI;

    await updateWordCanvas(wordI);
  }
  window.canvas.renderAll();
}

/**
 *
 * @param {string} fontSizeStr - String containing (1) 'plus', (2) 'minus', or (3) a numeric size.
 */
export async function changeWordFontSize(fontSizeStr) {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length === 0) return;

  let fontSize;
  if (fontSizeStr === 'plus') {
    fontSize = parseFloat(selectedObjects[0].fontSize) + 1;
  } else if (fontSizeStr === 'minus') {
    fontSize = parseFloat(selectedObjects[0].fontSize) - 1;
  } else {
    fontSize = parseFloat(fontSizeStr);
  }

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];

    // If multiple words are selected, the change in font size only applies to the non-superscript words.
    // Without this behavior, selecting a large area and standardizing the font size would result in
    // the superscripted text becoming the same size as the non-superscript text.
    if (selectedN > 1 && wordI.wordSup) continue;

    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDI);

    if (!wordObj) {
      console.warn(`Canvas element contains ID${wordIDI}that does not exist in OCR data.  Skipping word.`);
      continue;
    }

    wordObj.size = fontSize;

    fontSizeElem.value = String(fontSize);
    wordI.fontSize = fontSize;

    await updateWordCanvas(wordI);
  }
  window.canvas.renderAll();
}

export async function changeWordFontFamily(fontName) {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  const fontNameLookup = fontName === 'Default' ? fontAll.defaultFontName : fontName;

  const fontActive = fontAll.get('active');

  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;

    const fontI = fontActive[fontNameLookup][wordI.fontStyleLookup];

    const wordObj = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDI);

    if (!wordObj) {
      console.warn(`Canvas element contains ID${wordIDI}that does not exist in OCR data.  Skipping word.`);
      continue;
    }

    if (fontName === 'Default') {
      wordObj.font = null;
    } else {
      wordObj.font = fontName;
    }

    wordI.fontFamily = fontI.fontFaceName;
    wordI.fontStyle = fontI.fontFaceStyle;

    wordI.defaultFontFamily = fontName === 'Default';
    wordI.fontFamilyLookup = fontNameLookup;
    wordI.fontObj = fontI;

    await updateWordCanvas(wordI);
  }
  window.canvas.renderAll();
}

// Update word textbox on canvas following changes.
// Whenever a user edits a word in any way (including content and font/style),
// the position and character spacing need to be re-calculated so they still overlay with the background image.
export async function updateWordCanvas(wordI) {
  const fontOpentype = await wordI.fontObj.opentype;
  // 1. Re-calculate left position given potentially new left bearing
  const wordMetrics = await calcWordMetrics(wordI.text, fontOpentype, wordI.fontSize);

  // When the user selects multiple words at the same time, the coordinates becomes relative to the "group"
  const groupOffsetLeft = wordI?.group?.ownMatrixCache?.value[4] || 0;

  wordI.left = wordI.visualLeft - wordMetrics.leftSideBearing - groupOffsetLeft;

  // 2. Re-calculate character spacing (if the word has multiple letters)
  if (wordI.text.length > 1) {
    const visualWidthNew = wordMetrics.visualWidth;
    const kerning = (wordI.visualWidth - visualWidthNew) / (wordI.text.length - 1);
    wordI.charSpacing = kerning * 1000 / wordI.fontSize;
  }

  window.canvas.requestRenderAll();
}

export function toggleSuperSelectedWords() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length === 0) return;
  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDI);

    if (!wordObj) {
      console.warn(`Canvas element contains ID${wordIDI}that does not exist in OCR data.  Skipping word.`);
      continue;
    }

    wordObj.sup = !wordObj.sup;
  }

  renderPageQueue(cp.n);
}

let objectsLine;

const baselineRange = 50;
export function adjustBaseline() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length === 0) return;

  // For some reason the text jumps around the page when >1 word is selected
  window.canvas.setActiveObject(selectedObjects[0]);

  rangeBaselineElem.value = baselineRange + selectedObjects[0].baselineAdj;
  window.bsCollapse.show();

  // Unlikely identify lines using the ID of the first word on the line.
  const lineI = selectedObjects[0]?.word?.line?.words[0]?.id;

  console.assert(lineI !== undefined, 'Failed to identify line for word.');

  objectsLine = canvas.getObjects().filter((x) => x?.word?.line?.words[0]?.id === lineI);

  for (let i = 0; i < objectsLine.length; i++) {
    objectsLine[i].objectCaching = true;
    objectsLine[i].ownCaching = true;
    objectsLine[i].renderCache();
  }
}

/**
 * Visually moves the selected line's baseline on the canvas.
 * Called when user is actively dragging the adjust baseline slider.
 *
 * @param {string | number} value - New baseline value.
 */
export function adjustBaselineRange(value) {
  const valueNum = typeof value === 'string' ? parseInt(value) : value;
  for (let i = 0; i < objectsLine.length; i++) {
    const objectI = objectsLine[i];
    objectI.set('top', objectI.topOrig + (valueNum - baselineRange));
  }

  window.canvas.requestRenderAll();
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
    const wordIDI = wordI.wordID;

    wordI.set('baselineAdj', valueNew);

    const wordObj = ocr.getPageWord(globalThis.ocrAll.active[cp.n], wordIDI);

    if (!wordObj) {
      console.warn(`Canvas element contains ID${wordIDI}that does not exist in OCR data.  Skipping word.`);
      continue;
    }

    // Adjust baseline offset for line
    if (i === 0) {
      wordObj.line.baseline[1] += valueChange;
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
