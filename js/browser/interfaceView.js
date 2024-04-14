/* eslint-disable import/no-cycle */

import { renderPageQueue, cp, setCanvasWidthHeightZoom } from '../../main.js';
import { imageCache } from '../containers/imageContainer.js';
import { enableDisableDownloadPDFAlert } from './interfaceDownload.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));

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
export const selectDisplayMode = async (x) => {
  if (globalThis.inputDataModes.xmlMode[cp.n] && globalThis.inputDataModes.pdfMode && cp.renderStatus !== 2) { return; }

  const imageBitmap = await imageCache.getNativeBitmap(cp.n);
  cp.backgroundImage = new fabric.Image(imageBitmap, { objectCaching: false });

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

  // Calculate options for background image and overlay
  if (globalThis.inputDataModes.xmlMode[cp.n]) {
    cp.backgroundOpts.originX = 'center';
    cp.backgroundOpts.originY = 'center';

    const imgDims = globalThis.pageMetricsArr[cp.n].dims;

    cp.backgroundOpts.left = imgDims.width * 0.5;
    cp.backgroundOpts.top = imgDims.height * 0.5;

    // let marginPx = Math.round(imgDims.width * leftGlobal);
    if (autoRotateCheckboxElem.checked) {
      cp.backgroundOpts.angle = globalThis.pageMetricsArr[cp.n].angle * -1 ?? 0;
    } else {
      cp.backgroundOpts.angle = 0;
    }
  } else {
    cp.backgroundOpts.originX = 'left';
    cp.backgroundOpts.originY = 'top';

    cp.backgroundOpts.left = 0;
    cp.backgroundOpts.top = 0;
  }

  const backgroundImage = await (colorModeElem.value === 'binary' ? imageCache.getBinary(cp.n) : imageCache.getNative(cp.n));

  // Edit rotation for images that have already been rotated
  if (backgroundImage.rotated) {
    // If rotation is requested,
    if (autoRotateCheckboxElem.checked) {
      cp.backgroundOpts.angle = 0;
    } else {
      cp.backgroundOpts.angle = globalThis.pageMetricsArr[cp.n].angle;
    }
  }

  // Edit rotation for images that have been upscaled
  if (backgroundImage.upscaled) {
    cp.backgroundOpts.scaleX = 0.5;
    cp.backgroundOpts.scaleY = 0.5;
  } else {
    cp.backgroundOpts.scaleX = 1;
    cp.backgroundOpts.scaleY = 1;
  }

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode)) {
    canvas.setBackgroundColor('white');
    // canvas.setBackgroundImage(cp.backgroundImage, canvas.renderAll.bind(canvas));
    canvas.setBackgroundImage(cp.backgroundImage, null, cp.backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null);
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (globalThis.state.canvasDimsN !== cp.n) {
    setCanvasWidthHeightZoom(globalThis.pageMetricsArr[cp.n].dims, showConflictsElem.checked, true);

    globalThis.state.canvasDimsN = cp.n;
  // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
  // so we only need to call it here if the zoom is not changed.
  } else {
    canvas.requestRenderAll();
  }

  enableDisableDownloadPDFAlert();
};
