/* eslint-disable import/no-cycle */

import { inputData, opt, state } from '../js/containers/app.js';
import { pageMetricsArr, visInstructions } from '../js/containers/dataContainer.js';
import { ImageCache } from '../js/containers/imageContainer.js';
import Konva from '../lib/konva/index.js';
import { elem } from './elems.js';
import {
  getWordFillOpacity,
  layerBackground,
  layerOverlay,
  ScribeCanvas,
  stage,
} from './interfaceCanvas.js';
import { setCanvasWidthHeightZoom } from './interfaceCanvasInteraction.js';
import { enableDisableDownloadPDFAlert } from './interfaceDownload.js';
import { renderLayoutBoxes } from './interfaceLayout.js';

const showConflictsElem = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));

const ctxLegend = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('legendCanvas')).getContext('2d'));

/**
 * Changes color and opacity of words based on the current display mode.
 */
export function setWordColorOpacity() {
  ScribeCanvas.getKonvaWords().forEach((obj) => {
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

  const pageDims = pageMetricsArr[state.cp.n].dims;

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (inputData.imageMode || inputData.pdfMode)) {
    state.cp.backgroundOpts.originX = 'center';
    state.cp.backgroundOpts.originY = 'center';

    const backgroundImage = opt.colorMode === 'binary' ? await ImageCache.getBinary(state.cp.n) : await ImageCache.getNative(state.cp.n);
    const image = opt.colorMode === 'binary' ? await ImageCache.getBinaryBitmap(state.cp.n) : await ImageCache.getNativeBitmap(state.cp.n);
    let rotation = 0;
    // Case where rotation is requested and the image has not already been rotated
    if ((opt.autoRotate || state.layoutMode) && !backgroundImage.rotated) {
      rotation = (pageMetricsArr[state.cp.n].angle || 0) * -1;
    // Case where rotation is not requested and the image has already been rotated
    } else if (!(opt.autoRotate || state.layoutMode) && backgroundImage.rotated) {
      rotation = pageMetricsArr[state.cp.n].angle || 0;
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

  if (state.debugVis && elem.info.selectDebugVis.value !== 'None' && visInstructions[state.cp.n][elem.info.selectDebugVis.value]) {
    const image = visInstructions[state.cp.n][elem.info.selectDebugVis.value].canvas;
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

    const offscreenCanvasLegend = visInstructions[state.cp.n][elem.info.selectDebugVis.value].canvasLegend;
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

  if (state.layoutMode) {
    renderLayoutBoxes();
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (state.canvasDimsN !== state.cp.n) {
    setCanvasWidthHeightZoom(pageMetricsArr[state.cp.n].dims, showConflictsElem.checked);

    state.canvasDimsN = state.cp.n;
  // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
  // so we only need to call it here if the zoom is not changed.
  }

  stage.batchDraw();

  enableDisableDownloadPDFAlert();
};
