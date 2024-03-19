/* eslint-disable import/no-cycle */

import { renderPageQueue, cp } from '../../main.js';
import { imageCont } from '../imageContainer.js';
import { enableDisableDownloadPDFAlert } from './interfaceDownload.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value); });

/**
 *
 * @param {string} x
 */
function displayModeClick(x) {
  if (x === 'eval') {
    renderPageQueue(cp.n, true);
  } else {
    selectDisplayMode(displayModeElem.value);
  }
}

/**
 * Change the display mode (e.g. proofread mode vs. ocr mode).
 * Impacts what color the text is printed and whether the background image is displayed.
 *
 * @param { ("invis"|"ebook"|"eval"|"proof")} x
 * @returns
 */
export const selectDisplayMode = (x) => {
  if (inputDataModes.xmlMode[cp.n] && inputDataModes.pdfMode && cp.renderStatus !== 2) { return; }

  let opacityArg; let
    fillArg;
  if (x === 'invis') {
    opacityArg = 0;
    fillArg = 'fill_ebook';
  } else if (x === 'ebook') {
    opacityArg = 1;
    fillArg = 'fill_ebook';
  } else if (x === 'eval') {
    opacityArg = 1;
    fillArg = 'fill_eval';
  } else {
    opacityArg = 1;
    fillArg = 'fill_proof';
  }

  canvas.forEachObject((obj) => {
    // A defined value for obj.get(fillArg) is assumed to indicate that the itext object is an OCR word.
    if (obj.type === 'ITextWord' && obj.get(fillArg)) {
      obj.set('fill', obj.get(fillArg));

      obj.set('opacity', opacityArg);
    }
  });

  // Edit rotation for images that have already been rotated
  if (colorModeElem.value === 'binary' && imageCont.imageAll.binaryRotated[cp.n] || colorModeElem.value !== 'binary' && imageCont.imageAll.nativeRotated[cp.n]) {
    // If rotation is requested,
    if (autoRotateCheckboxElem.checked) {
      cp.backgroundOpts.angle = 0;
    } else {
      cp.backgroundOpts.angle = globalThis.pageMetricsArr[cp.n].angle;
    }
  }

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    canvas.setBackgroundColor('white');
    // canvas.setBackgroundImage(cp.backgroundImage, canvas.renderAll.bind(canvas));
    canvas.setBackgroundImage(cp.backgroundImage, canvas.renderAll.bind(canvas), cp.backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  }

  enableDisableDownloadPDFAlert();
};
