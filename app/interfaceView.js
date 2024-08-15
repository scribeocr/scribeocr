/* eslint-disable import/no-cycle */

import { stateGUI } from '../main.js';
import scribe from '../module.js';
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
import Konva from './lib/konva/index.js';

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

  const pageDims = scribe.data.pageMetrics[stateGUI.cp.n].dims;

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (scribe.inputData.imageMode || scribe.inputData.pdfMode)) {
    stateGUI.cp.backgroundOpts.originX = 'center';
    stateGUI.cp.backgroundOpts.originY = 'center';

    const backgroundImage = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinary(stateGUI.cp.n) : await scribe.data.image.getNative(stateGUI.cp.n);
    const image = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinaryBitmap(stateGUI.cp.n) : await scribe.data.image.getNativeBitmap(stateGUI.cp.n);
    let rotation = 0;
    // Case where rotation is requested and the image has not already been rotated
    if ((scribe.opt.autoRotate || stateGUI.layoutMode) && !backgroundImage.rotated) {
      rotation = (scribe.data.pageMetrics[stateGUI.cp.n].angle || 0) * -1;
    // Case where rotation is not requested and the image has already been rotated
    } else if (!(scribe.opt.autoRotate || stateGUI.layoutMode) && backgroundImage.rotated) {
      rotation = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;
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

  if (scribe.opt.debugVis && elem.info.selectDebugVis.value !== 'None' && scribe.data.vis[stateGUI.cp.n][elem.info.selectDebugVis.value]) {
    const image = scribe.data.vis[stateGUI.cp.n][elem.info.selectDebugVis.value].canvas;
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

    const offscreenCanvasLegend = scribe.data.vis[stateGUI.cp.n][elem.info.selectDebugVis.value].canvasLegend;
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

  if (stateGUI.layoutMode) {
    renderLayoutBoxes();
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (stateGUI.canvasDimsN !== stateGUI.cp.n) {
    setCanvasWidthHeightZoom(scribe.data.pageMetrics[stateGUI.cp.n].dims, showConflictsElem.checked);

    stateGUI.canvasDimsN = stateGUI.cp.n;
  // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
  // so we only need to call it here if the zoom is not changed.
  }

  stage.batchDraw();

  enableDisableDownloadPDFAlert();
};
