/* eslint-disable import/no-cycle */

import { calcOverlap } from '../modifyOCR.js';
import ocr from '../objects/ocrObjects.js';
import { saveAs, imageStrToBlob } from '../miscUtils.js';
import { cp, setCanvasWidthHeightZoom } from '../../main.js';
import { imageCont } from '../containers/imageContainer.js';
import { drawDebugImages } from '../debug.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

export function printSelectedWords(printOCR = true) {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  for (let i = 0; i < selectedObjects.length; i++) {
    if (printOCR) {
      console.log(ocr.getPageWord(globalThis.ocrAll.active[cp.n], selectedObjects[i].wordID));
    } else {
      console.log(selectedObjects[i]);
    }
  }
}

export async function evalSelectedLine() {
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length === 0) return;

  const word0 = ocr.getPageWord(globalThis.ocrAll.active[cp.n], selectedObjects[0].wordID);

  if (!word0) return;

  const img = await imageCont.getBinary(cp.n);

  const res = await globalThis.gs?.evalWords({
    wordsA: word0.line.words,
    binaryImage: img,
    imageRotated: imageCont.imageAll.binaryRotated[cp.n],
    pageMetricsObj: pageMetricsArr[cp.n],
    options: { view: true },
  });

  await drawDebugImages({ ctx: globalThis.ctxDebug, compDebugArrArr: [[res?.debug]], context: 'browser' });

  setCanvasWidthHeightZoom(globalThis.state.imgDims, true, false);
}

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

export function downloadCanvas() {
  const canvasDataStr = canvas.toDataURL();
  const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}_canvas_${String(cp.n)}.png`;
  const imgBlob = imageStrToBlob(canvasDataStr);
  saveAs(imgBlob, fileName);
}

export async function downloadCurrentImage() {
  const imageStr = colorModeElem.value === 'binary' ? await Promise.resolve(imageCont.imageAll.binaryStr[cp.n]) : await Promise.resolve(imageCont.imageAll.nativeStr[cp.n]);
  const filenameBase = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}`;

  const fileType = imageStr.match(/^data:image\/([a-z]+)/)?.[1];
  if (!fileType || !['png', 'jpeg'].includes(fileType)) {
    console.log(`Filetype ${fileType} is not jpeg/png; skipping.`);
    return;
  }

  const fileName = `${filenameBase}_${String(cp.n).padStart(3, '0')}.${fileType}`;
  const imgBlob = imageStrToBlob(imageStr);
  saveAs(imgBlob, fileName);
}

export function getExcludedText() {
  for (let i = 0; i <= globalThis.ocrAll.active.length; i++) {
    const textArr = getExcludedTextPage(globalThis.ocrAll.active[i], globalThis.layout[i]);

    if (textArr.length > 0) {
      textArr.map((x) => console.log(`${x} [Page ${String(i)}]`));
    }
  }
}

// Get array of text that will be excluded from exports due to "exclude" layout boxes.
// This was largely copy/pasted from `reorderHOCR` for convenience, so should be rewritten at some point.

/**
 * @param {OcrPage} pageA
 */
export function getExcludedTextPage(pageA, layoutObj, applyExclude = true) {
  const excludedArr = [];

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length === 0) return excludedArr;

  const priorityArr = Array(pageA.lines.length);

  // 10 assumed to be lowest priority for text included in the output and is assigned to any word that does not overlap with a "order" layout box
  priorityArr.fill(10);

  for (let i = 0; i < pageA.lines.length; i++) {
    const lineA = pageA.lines[i];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
      const overlap = calcOverlap(lineA.bbox, obj.coords);
      if (overlap > 0.5) {
        if (obj.type === 'order') {
          priorityArr[i] = obj.priority;
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
