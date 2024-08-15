/* eslint-disable import/no-cycle */

import { stateGUI } from '../main.js';
import scribe from '../module.js';
import { elem } from './elems.js';
import {
  layerText,
  ScribeCanvas,
  stage,
} from './interfaceCanvas.js';
import { setCanvasWidthHeightZoom } from './interfaceCanvasInteraction.js';
import { saveAs } from './utils/utils.js';

export function printSelectedWords(printOCR = true) {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects) return;
  for (let i = 0; i < selectedObjects.length; i++) {
    if (printOCR) {
      console.log(selectedObjects[i].word);
    } else {
      console.log(selectedObjects[i]);
    }
  }
}

const ctxDebug = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('g')).getContext('2d'));

export async function showDebugImages() {
  /** @type {Array<Array<CompDebugBrowser>>} */
  const compDebugArrArr = [];

  const compDebugArr1 = scribe.data.debug.debugImg?.['Tesseract Combined']?.[stateGUI.cp.n];
  const compDebugArr2 = scribe.data.debug.debugImg?.Combined?.[stateGUI.cp.n];
  const compDebugArr3 = scribe.data.debug.debugImg?.recognizeArea?.[stateGUI.cp.n];

  if (compDebugArr1 && compDebugArr1.length > 0) compDebugArrArr.push(compDebugArr1);
  if (compDebugArr2 && compDebugArr2.length > 0) compDebugArrArr.push(compDebugArr2);
  if (compDebugArr3 && compDebugArr3.length > 0) compDebugArrArr.push(compDebugArr3);

  if (compDebugArrArr.length > 0) await scribe.utils.drawDebugImages({ ctx: ctxDebug, compDebugArrArr, context: 'browser' });
}

export async function evalSelectedLine() {
  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  const word0 = selectedObjects[0].word;

  const res = await scribe.evalOCRPage({ page: word0.line, view: true });

  await scribe.utils.drawDebugImages({ ctx: ctxDebug, compDebugArrArr: [[res.debug[0]]], context: 'browser' });

  setCanvasWidthHeightZoom(scribe.data.pageMetrics[stateGUI.cp.n].dims, true);
}

export async function downloadCanvas() {
  const dims = scribe.data.pageMetrics[stateGUI.cp.n].dims;

  const startX = layerText.x() > 0 ? Math.round(layerText.x()) : 0;
  const startY = layerText.y() > 0 ? Math.round(layerText.y()) : 0;
  const width = dims.width * layerText.scaleX();
  const height = dims.height * layerText.scaleY();

  const canvasDataStr = stage.toDataURL({
    x: startX, y: startY, width, height,
  });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}_canvas_${String(stateGUI.cp.n)}.png`;
  const imgBlob = scribe.utils.imageStrToBlob(canvasDataStr);
  saveAs(imgBlob, fileName);
}

export async function downloadImage(n) {
  const image = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinary(n) : await scribe.data.image.getNative(n);
  const filenameBase = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}`;

  const fileName = `${filenameBase}_${String(n).padStart(3, '0')}.${image.format}`;
  const imgBlob = scribe.utils.imageStrToBlob(image.src);
  saveAs(imgBlob, fileName);
}

export async function downloadCurrentImage() {
  await downloadImage(stateGUI.cp.n);
}

export async function downloadAllImages() {
  const binary = scribe.opt.colorMode === 'binary';
  for (let i = 0; i < scribe.data.image.pageCount; i++) {
    await downloadImage(i);
    // Not all files will be downloaded without a delay between downloads
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function getExcludedText() {
  for (let i = 0; i <= scribe.data.ocr.active.length; i++) {
    const textArr = getExcludedTextPage(scribe.data.ocr.active[i], scribe.data.layoutRegions.pages[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(`${x} [Page ${String(i)}]`));
    }
  }
}

// Get array of text that will be excluded from exports due to "exclude" layout boxes.
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point.

/**
 * @param {OcrPage} pageA
 * @param {import('../js/objects/layoutObjects.js').LayoutPage} layoutObj
 * @param {boolean} [applyExclude=true]
 */
export function getExcludedTextPage(pageA, layoutObj, applyExclude = true) {
  const excludedArr = [];

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length === 0) return excludedArr;

  const orderArr = Array(pageA.lines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  orderArr.fill(10);

  for (let i = 0; i < pageA.lines.length; i++) {
    const lineA = pageA.lines[i];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = scribe.utils.calcBoxOverlap(lineA.bbox, obj.coords);
      if (overlap > 0.5) {
        if (obj.type === 'order') {
          orderArr[i] = obj.order;
        } else if (obj.type === 'exclude' && applyExclude) {
          const { words } = lineA;
          let text = '';
          for (let j = 0; j < words.length; j++) {
            text += `${words[j].text} `;
          }
          excludedArr.push(text);
        }
      }
    }
  }

  return excludedArr;
}

// function lookupKerning(letterA, letterB) {
//   return fontMetricsObj.SerifDefault.normal.kerning[`${letterA.charCodeAt(0)},${letterB.charCodeAt(0)}`];
// }
