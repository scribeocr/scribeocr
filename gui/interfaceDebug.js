/* eslint-disable import/no-cycle */

import { opt, state } from '../js/containers/app.js';
import {
  DebugData,
  fontMetricsObj, LayoutRegions,
  ocrAll, pageMetricsArr
} from '../js/containers/dataContainer.js';
import { ImageCache } from '../js/containers/imageContainer.js';
import { gs } from '../js/containers/schedulerContainer.js';
import { drawDebugImages } from '../js/debug.js';
import { calcOverlap } from '../js/modifyOCR.js';
import ocr from '../js/objects/ocrObjects.js';
import { imageStrToBlob } from '../js/utils/imageUtils.js';
import { saveAs } from '../js/utils/miscUtils.js';
import { elem } from './elems.js';
import {
  layerText,
  ScribeCanvas,
  stage,
} from './interfaceCanvas.js';
import { setCanvasWidthHeightZoom } from './interfaceCanvasInteraction.js';

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

  const compDebugArr1 = DebugData.debugImg?.['Tesseract Combined']?.[state.cp.n];
  const compDebugArr2 = DebugData.debugImg?.Combined?.[state.cp.n];
  const compDebugArr3 = DebugData.debugImg?.recognizeArea?.[state.cp.n];

  if (compDebugArr1 && compDebugArr1.length > 0) compDebugArrArr.push(compDebugArr1);
  if (compDebugArr2 && compDebugArr2.length > 0) compDebugArrArr.push(compDebugArr2);
  if (compDebugArr3 && compDebugArr3.length > 0) compDebugArrArr.push(compDebugArr3);

  if (compDebugArrArr.length > 0) await drawDebugImages({ ctx: ctxDebug, compDebugArrArr, context: 'browser' });
}

export async function evalSelectedLine() {
  await gs.schedulerReady;
  if (!gs.scheduler) throw new Error('GeneralScheduler must be defined before this function can run.');

  const selectedObjects = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  const word0 = selectedObjects[0].word;

  const imageBinary = await ImageCache.getBinary(state.cp.n);

  const pageMetricsObj = pageMetricsArr[state.cp.n];

  const lineObj = ocr.cloneLine(word0.line);

  const imgDims = structuredClone(pageMetricsObj.dims);
  const imgAngle = imageBinary.rotated ? (pageMetricsObj.angle || 0) : 0;
  if (imageBinary.upscaled) {
    ocr.scaleLine(lineObj, 2);
    imgDims.width *= 2;
    imgDims.height *= 2;
  }

  const res = await gs.scheduler.evalWords({
    wordsA: lineObj.words,
    binaryImage: imageBinary.src,
    angle: imgAngle,
    imgDims,
    options: { view: true },
  });

  await drawDebugImages({ ctx: ctxDebug, compDebugArrArr: [[res?.debug]], context: 'browser' });

  setCanvasWidthHeightZoom(pageMetricsArr[state.cp.n].dims, true);
}

export async function downloadCanvas() {
  const dims = pageMetricsArr[state.cp.n].dims;

  const startX = layerText.x() > 0 ? Math.round(layerText.x()) : 0;
  const startY = layerText.y() > 0 ? Math.round(layerText.y()) : 0;
  const width = dims.width * layerText.scaleX();
  const height = dims.height * layerText.scaleY();

  const canvasDataStr = stage.toDataURL({
    x: startX, y: startY, width, height,
  });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}_canvas_${String(state.cp.n)}.png`;
  const imgBlob = imageStrToBlob(canvasDataStr);
  saveAs(imgBlob, fileName);
}

export async function downloadImage(n) {
  const image = opt.colorMode === 'binary' ? await ImageCache.getBinary(n) : await ImageCache.getNative(n);
  const filenameBase = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}`;

  const fileName = `${filenameBase}_${String(n).padStart(3, '0')}.${image.format}`;
  const imgBlob = imageStrToBlob(image.src);
  saveAs(imgBlob, fileName);
}

export async function downloadCurrentImage() {
  await downloadImage(state.cp.n);
}

export async function downloadAllImages() {
  const binary = opt.colorMode === 'binary';
  for (let i = 0; i < ImageCache.pageCount; i++) {
    await downloadImage(i);
    // Not all files will be downloaded without a delay between downloads
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function getExcludedText() {
  for (let i = 0; i <= ocrAll.active.length; i++) {
    const textArr = getExcludedTextPage(ocrAll.active[i], LayoutRegions.pages[i]);

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
      const overlap = calcOverlap(lineA.bbox, obj.coords);
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

function lookupKerning(letterA, letterB) {
  return fontMetricsObj.SerifDefault.normal.kerning[`${letterA.charCodeAt(0)},${letterB.charCodeAt(0)}`];
}
