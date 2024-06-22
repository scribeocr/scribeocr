/* eslint-disable import/no-cycle */

import { calcOverlap } from '../modifyOCR.js';
import ocr from '../objects/ocrObjects.js';
import { saveAs } from '../miscUtils.js';
import { imageStrToBlob } from '../imageUtils.js';
import { cp } from '../../main.js';
import { imageCache } from '../containers/imageContainer.js';
import { drawDebugImages } from '../debug.js';
import {
  stage, layerText, CanvasObjs, setCanvasWidthHeightZoom,
} from './interfaceCanvas.js';
import { layoutAll, ocrAll, pageMetricsArr } from '../containers/miscContainer.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

export function printSelectedWords(printOCR = true) {
  const selectedObjects = CanvasObjs.CanvasSelection.getKonvaWords();
  if (!selectedObjects) return;
  for (let i = 0; i < selectedObjects.length; i++) {
    if (printOCR) {
      console.log(selectedObjects[i].word);
    } else {
      console.log(selectedObjects[i]);
    }
  }
}

export async function evalSelectedLine() {
  const selectedObjects = CanvasObjs.CanvasSelection.getKonvaWords();
  if (!selectedObjects || selectedObjects.length === 0) return;

  const word0 = selectedObjects[0].word;

  const imageBinary = await imageCache.getBinary(cp.n);

  const pageMetricsObj = pageMetricsArr[cp.n];

  const lineObj = ocr.cloneLine(word0.line);

  const imgDims = structuredClone(pageMetricsObj.dims);
  const imgAngle = imageBinary.rotated ? (pageMetricsObj.angle || 0) : 0;
  if (imageBinary.upscaled) {
    ocr.scaleLine(lineObj, 2);
    imgDims.width *= 2;
    imgDims.height *= 2;
  }

  const res = await globalThis.gs?.evalWords({
    wordsA: lineObj.words,
    binaryImage: imageBinary.src,
    angle: imgAngle,
    imgDims,
    options: { view: true },
  });

  await drawDebugImages({ ctx: globalThis.ctxDebug, compDebugArrArr: [[res?.debug]], context: 'browser' });

  setCanvasWidthHeightZoom(pageMetricsArr[cp.n].dims, true);
}

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

export async function downloadCanvas() {
  const dims = pageMetricsArr[cp.n].dims;

  const startX = layerText.x() > 0 ? Math.round(layerText.x()) : 0;
  const startY = layerText.y() > 0 ? Math.round(layerText.y()) : 0;
  const width = dims.width * layerText.scaleX();
  const height = dims.height * layerText.scaleY();

  const canvasDataStr = stage.toDataURL({
    x: startX, y: startY, width, height,
  });

  const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}_canvas_${String(cp.n)}.png`;
  const imgBlob = imageStrToBlob(canvasDataStr);
  saveAs(imgBlob, fileName);
}

export async function downloadImage(n) {
  const image = colorModeElem.value === 'binary' ? await imageCache.getBinary(n) : await imageCache.getNative(n);
  const filenameBase = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}`;

  const fileName = `${filenameBase}_${String(n).padStart(3, '0')}.${image.format}`;
  const imgBlob = imageStrToBlob(image.src);
  saveAs(imgBlob, fileName);
}

export async function downloadCurrentImage() {
  await downloadImage(cp.n);
}

export async function downloadAllImages() {
  const binary = colorModeElem.value === 'binary';
  for (let i = 0; i < imageCache.pageCount; i++) {
    await downloadImage(i);
    // Not all files will be downloaded without a delay between downloads
    await new Promise((r) => setTimeout(r, 200));
  }
}

globalThis.downloadAllImages = downloadAllImages;

export function getExcludedText() {
  for (let i = 0; i <= ocrAll.active.length; i++) {
    const textArr = getExcludedTextPage(ocrAll.active[i], layoutAll[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(`${x} [Page ${String(i)}]`));
    }
  }
}

// Get array of text that will be excluded from exports due to "exclude" layout boxes.
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point.

/**
 * @param {OcrPage} pageA
 * @param {import('../objects/layoutObjects.js').LayoutPage} layoutObj
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
