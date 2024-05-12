/* eslint-disable import/no-cycle */

import { renderPageQueue, cp, setCanvasWidthHeightZoom } from '../../main.js';
import { imageCache } from '../containers/imageContainer.js';
import { enableDisableDownloadPDFAlert } from './interfaceDownload.js';
import { stage, layerText, layerBackground } from './interfaceCanvas.js';
import Konva from '../../lib/konva.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

/**
 * Gets the display mode selected in the UI. This function exists for type inference purposes.
 * @returns {("invis"|"ebook"|"eval"|"proof")}
 */
export function getDisplayMode() {
  const value = displayModeElem.value;
  if (value !== 'invis' && value !== 'ebook' && value !== 'eval' && value !== 'proof') {
    throw new Error(`Invalid display mode: ${value}`);
  }

  return value;
}

rangeOpacityElem.addEventListener('input', () => {
  setWordColorOpacity(getDisplayMode());
  canvas.requestRenderAll();
});

/**
 *
 * @param {string} x
 */
function displayModeClick(x) {
  if (x === 'eval') {
    renderPageQueue(cp.n, true);
  } else {
    selectDisplayMode(getDisplayMode());
  }
}

/**
 *
 * Changes color and opacity of words based on the display mode.
 *
 * @param { ("invis"|"ebook"|"eval"|"proof")} x
 * @returns
 */
function setWordColorOpacity(x) {
  let opacityArg;
  let fillArg;
  if (x === 'invis') {
    opacityArg = 0;
    fillArg = 'fill_ebook';
  } else if (x === 'ebook') {
    opacityArg = 1;
    fillArg = 'fill_ebook';
  } else if (x === 'eval') {
    opacityArg = parseFloat(rangeOpacityElem.value || '80') / 100;
    fillArg = 'fill_eval';
  } else {
    opacityArg = parseFloat(rangeOpacityElem.value || '80') / 100;
    fillArg = 'fill_proof';
  }

  // canvas.forEachObject((obj) => {
  //   // A defined value for obj.get(fillArg) is assumed to indicate that the itext object is an OCR word.
  //   if (obj.type === 'ITextWord' && obj.get(fillArg)) {
  //     obj.set('fill', obj.get(fillArg));

  //     obj.set('opacity', opacityArg);
  //   }
  // });
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

  setWordColorOpacity(x);

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode)) {
    cp.backgroundOpts.originX = 'center';
    cp.backgroundOpts.originY = 'center';

    const imgDims = globalThis.pageMetricsArr[cp.n].dims;

    // cp.backgroundOpts.left = imgDims.width * 0.5;
    // cp.backgroundOpts.top = imgDims.height * 0.5;

    // if (autoRotateCheckboxElem.checked) {
    //   cp.backgroundOpts.angle = globalThis.pageMetricsArr[cp.n].angle * -1 ?? 0;
    // } else {
    //   cp.backgroundOpts.angle = 0;
    // }

    const backgroundImage = colorModeElem.value === 'binary' ? await imageCache.getBinary(cp.n) : await imageCache.getNative(cp.n);

    const image = colorModeElem.value === 'binary' ? await imageCache.getBinaryBitmap(cp.n) : await imageCache.getNativeBitmap(cp.n);

    let rotate = 0;
    // Case where rotation is requested and the image has not already been rotated
    if (autoRotateCheckboxElem.checked && !backgroundImage.rotated) {
      rotate = (globalThis.pageMetricsArr[cp.n].angle || 0) * -1;
    // Case where rotation is not requested and the image has already been rotated
    } else if (!autoRotateCheckboxElem.checked && backgroundImage.rotated) {
      rotate = globalThis.pageMetricsArr[cp.n].angle || 0;
    }

    const scaleX = backgroundImage.upscaled ? 0.5 : 1;
    const scaleY = backgroundImage.upscaled ? 0.5 : 1;

    const left = imgDims.width * 0.5;
    const top = imgDims.height * 0.5;

    const backgroundImageKonva = new Konva.Image({
      image,
      rotate,
      scaleX,
      scaleY,
      left,
      top,
      strokeWidth: 4,
      stroke: 'black',
    });

    layerBackground.destroyChildren();

    layerBackground.add(backgroundImageKonva);

    // cp.backgroundImage = new Konva.Image(backgroundImageBitmap, { objectCaching: false });

    // Edit rotation for images that have already been rotated
    // if (backgroundImage.rotated) {
    //   // If rotation is requested,
    //   if (autoRotateCheckboxElem.checked) {
    //     cp.backgroundOpts.angle = 0;
    //   } else {
    //     cp.backgroundOpts.angle = globalThis.pageMetricsArr[cp.n].angle;
    //   }
    // }

    // Edit rotation for images that have been upscaled
    // if (backgroundImage.upscaled) {
    //   cp.backgroundOpts.scaleX = 0.5;
    //   cp.backgroundOpts.scaleY = 0.5;
    // } else {
    //   cp.backgroundOpts.scaleX = 1;
    //   cp.backgroundOpts.scaleY = 1;
    // }

    // canvas.setBackgroundColor('white');
    // // canvas.setBackgroundImage(cp.backgroundImage, canvas.renderAll.bind(canvas));
    // canvas.setBackgroundImage(cp.backgroundImage, null, cp.backgroundOpts);
  } else {
    // canvas.setBackgroundColor(null);
    // canvas.setBackgroundImage(null);
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (globalThis.state.canvasDimsN !== cp.n) {
    setCanvasWidthHeightZoom(globalThis.pageMetricsArr[cp.n].dims, showConflictsElem.checked);

    globalThis.state.canvasDimsN = cp.n;
  // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
  // so we only need to call it here if the zoom is not changed.
  } else {
    // canvas.requestRenderAll();

    layerText.draw();
    stage.add(layerText);
  }

  enableDisableDownloadPDFAlert();
};
