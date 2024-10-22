/* eslint-disable import/no-cycle */

// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import scribe from '../scribe.js/scribe.js';
import { ScribeCanvas, stateGUI } from '../viewer/viewerCanvas.js';
import { elem } from './elems.js';
import { Button } from './lib/bootstrap.esm.bundle.min.js';

elem.edit.styleItalic.addEventListener('click', () => { changeWordFontStyle('italic'); });
elem.edit.styleBold.addEventListener('click', () => { changeWordFontStyle('bold'); });
elem.edit.styleSmallCaps.addEventListener('click', () => toggleSmallCapsWords(elem.edit.styleSmallCaps.classList.contains('active')));
elem.edit.styleSuper.addEventListener('click', toggleSuperSelectedWords);

elem.edit.ligatures.addEventListener('change', () => {
  scribe.opt.ligatures = elem.edit.ligatures.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

const styleItalicButton = new Button(elem.edit.styleItalic);
const styleBoldButton = new Button(elem.edit.styleBold);
const styleSmallCapsButton = new Button(elem.edit.styleSmallCaps);

export function deleteSelectedWords() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  const selectedN = selectedObjects.length;

  /** @type {Object<string, Array<string>>} */
  const selectedIds = {};
  for (let i = 0; i < selectedN; i++) {
    const wordIdI = selectedObjects[i].word.id;
    const n = selectedObjects[i].word.line.page.n;
    if (!selectedIds[n]) selectedIds[n] = [];
    selectedIds[n].push(wordIdI);
    selectedObjects[i].destroy();
  }

  for (const [n, ids] of Object.entries(selectedIds)) {
    scribe.utils.ocr.deletePageWords(scribe.data.ocr.active[n], ids);
  }

  ScribeCanvas.destroyControls();

  ScribeCanvas.layerText.batchDraw();

  // Re-render the page if the user has selected the option to outline lines to update the line boxes.
  if (elem.view.outlineLines.checked) ScribeCanvas.displayPage(stateGUI.cp.n);
}

/**
 *
 * @param {('normal'|'italic'|'bold')} style
 */
export async function changeWordFontStyle(style) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  if (ScribeCanvas.KonvaIText.inputRemove) ScribeCanvas.KonvaIText.inputRemove();

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
    wordI.smallCapsMult = fontI.smallCapsMult;

    wordI.fontFamilyLookup = fontI.family;

    await ScribeCanvas.KonvaIText.updateWordCanvas(wordI);
  }

  ScribeCanvas.layerText.batchDraw();
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

    await ScribeCanvas.KonvaIText.updateWordCanvas(wordI);
  }
  ScribeCanvas.layerText.batchDraw();
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
    wordI.smallCapsMult = fontI.smallCapsMult;

    wordI.fontFamilyLookup = fontI.family;

    await ScribeCanvas.KonvaIText.updateWordCanvas(wordI);
  }
  ScribeCanvas.layerText.batchDraw();
}

export function toggleSuperSelectedWords() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;
  const selectedN = selectedObjects.length;
  for (let i = 0; i < selectedN; i++) {
    const wordI = selectedObjects[i];
    wordI.word.sup = !wordI.word.sup;
  }

  ScribeCanvas.displayPage(stateGUI.cp.n);
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
    await ScribeCanvas.KonvaIText.updateWordCanvas(wordI);
  }
  ScribeCanvas.layerText.batchDraw();
}

/** @type {Array<import('../viewer/viewerWordObjects.js').KonvaOcrWord>} */
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
