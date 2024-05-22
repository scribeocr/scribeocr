/* eslint-disable import/no-cycle */

import { renderPageQueue, cp } from '../../main.js';
import { imageCache, imageUtils } from '../containers/imageContainer.js';
import { enableDisableDownloadPDFAlert } from './interfaceDownload.js';
import {
  stage, layerText, layerBackground, getCanvasWords, setCanvasWidthHeightZoom,
  layerOverlay, getWordFillOpacity,
} from './interfaceCanvas.js';
import Konva from '../../lib/konva/index.js';
import { renderLayoutBoxes } from './interfaceLayout.js';
import { pageMetricsArr } from '../containers/miscContainer.js';

const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
const selectDebugVisElem = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value); });

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

const ctxLegend = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('legendCanvas')).getContext('2d'));

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
  setWordColorOpacity();
  layerText.batchDraw();
});

/**
 *
 * @param {string} x
 */
function displayModeClick(x) {
  if (x === 'eval') {
    renderPageQueue(cp.n);
  } else {
    selectDisplayMode(getDisplayMode());
  }
}

/**
 * Changes color and opacity of words based on the current display mode.
 */
function setWordColorOpacity() {
  getCanvasWords().forEach((obj) => {
    const { opacity, fill } = getWordFillOpacity(obj.word);
    obj.fill(fill);
    obj.opacity(opacity);
  });
}

/**
 * Change the display mode (e.g. proofread mode vs. ocr mode).
 * Impacts what color the text is printed and whether the background image is displayed.
 *
 * @param { ("invis"|"ebook"|"eval"|"proof")} x
 * @returns
 */
export const selectDisplayMode = async (x) => {
  setWordColorOpacity();

  const pageDims = pageMetricsArr[cp.n].dims;

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (globalThis.inputDataModes.imageMode || globalThis.inputDataModes.pdfMode)) {
    cp.backgroundOpts.originX = 'center';
    cp.backgroundOpts.originY = 'center';

    const backgroundImage = colorModeElem.value === 'binary' ? await imageCache.getBinary(cp.n) : await imageCache.getNative(cp.n);

    const image = colorModeElem.value === 'binary' ? await imageCache.getBinaryBitmap(cp.n) : await imageCache.getNativeBitmap(cp.n);

    let rotation = 0;
    // Case where rotation is requested and the image has not already been rotated
    if (autoRotateCheckboxElem.checked && !backgroundImage.rotated) {
      rotation = (pageMetricsArr[cp.n].angle || 0) * -1;
    // Case where rotation is not requested and the image has already been rotated
    } else if (!autoRotateCheckboxElem.checked && backgroundImage.rotated) {
      rotation = pageMetricsArr[cp.n].angle || 0;
    }

    const scaleX = backgroundImage.upscaled ? 0.5 : 1;
    const scaleY = backgroundImage.upscaled ? 0.5 : 1;

    const backgroundImageKonva = new Konva.Image({
      image,
      rotation,
      scaleX,
      scaleY,
      x: pageDims.width * 0.5,
      y: pageDims.height * 0.5,
      offsetX: image.width * 0.5,
      offsetY: image.height * 0.5,
      strokeWidth: 4,
      stroke: 'black',
    });

    layerBackground.destroyChildren();

    layerBackground.add(backgroundImageKonva);
  } else {
    layerBackground.destroyChildren();
  }

  if (showDebugVisElem.checked && selectDebugVisElem.value !== 'None' && globalThis.visInstructions[cp.n][selectDebugVisElem.value]) {
    const image = globalThis.visInstructions[cp.n][selectDebugVisElem.value].canvas;
    const overlayImageKonva = new Konva.Image({
      image,
      scaleX: pageDims.width / image.width,
      scaleY: pageDims.height / image.height,
      x: pageDims.width * 0.5,
      y: pageDims.width * 0.5,
      offsetX: image.width * 0.5,
      offsetY: image.width * 0.5,
    });

    layerOverlay.destroyChildren();
    layerOverlay.add(overlayImageKonva);

    const offscreenCanvasLegend = globalThis.visInstructions[cp.n][selectDebugVisElem.value].canvasLegend;
    if (offscreenCanvasLegend) {
      ctxLegend.canvas.width = offscreenCanvasLegend.width;
      ctxLegend.canvas.height = offscreenCanvasLegend.height;
      ctxLegend.drawImage(offscreenCanvasLegend, 0, 0);
    } else {
      ctxLegend.clearRect(0, 0, ctxLegend.canvas.width, ctxLegend.canvas.height);
    }
  } else {
    layerOverlay.destroyChildren();
  }

  if (globalThis.layoutMode) {
    renderLayoutBoxes();
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (globalThis.state.canvasDimsN !== cp.n) {
    setCanvasWidthHeightZoom(pageMetricsArr[cp.n].dims, showConflictsElem.checked);

    globalThis.state.canvasDimsN = cp.n;
  // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
  // so we only need to call it here if the zoom is not changed.
  }

  stage.batchDraw();

  enableDisableDownloadPDFAlert();
};
