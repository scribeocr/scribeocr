/* eslint-disable import/no-cycle */

// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import scribe from '../scribe.js/scribe.js';
import { ScribeCanvas, stateGUI } from '../viewer/viewerCanvas.js';
import { elem } from './elems.js';

elem.edit.styleSmallCaps.addEventListener('click', () => toggleSmallCapsWords(elem.edit.styleSmallCaps.classList.contains('active')));
elem.edit.styleSuper.addEventListener('click', toggleSuperSelectedWords);

elem.edit.ligatures.addEventListener('change', () => {
  scribe.opt.ligatures = elem.edit.ligatures.checked;
  ScribeCanvas.displayPage(stateGUI.cp.n);
});

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
