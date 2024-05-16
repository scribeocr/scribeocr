/* eslint-disable import/no-cycle */

import { calcWordMetrics } from '../fontUtils.js';
import { renderLayoutBoxes, updateDataPreview } from './interfaceLayout.js';
import ocr, { OcrPage } from '../objects/ocrObjects.js';
import { cp, search } from '../../main.js';
import { fontAll } from '../containers/fontContainer.js';
// import { Text as KonvaText } from '../../lib/konva/shapes/Text.js';
import Konva from '../../lib/konva/index.js';
import {
  layerText, KonvaWord, updateWordCanvas, canvasObj,
} from './interfaceCanvas.js';

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const outlineLinesElem = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));
const outlineWordsElem = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

/**
 *
 * @param {OcrWord} word
 */
export function getWordFillOpacity(word) {
  const confThreshHigh = confThreshHighElem.value !== '' ? parseInt(confThreshHighElem.value) : 85;
  const confThreshMed = confThreshMedElem.value !== '' ? parseInt(confThreshMedElem.value) : 75;

  let fillColorHex;
  if (word.conf > confThreshHigh) {
    fillColorHex = '#00ff7b';
  } else if (word.conf > confThreshMed) {
    fillColorHex = '#ffc800';
  } else {
    fillColorHex = '#ff0000';
  }

  const displayMode = displayModeElem.value;

  const fillColorHexMatch = word.matchTruth ? '#00ff7b' : '#ff0000';

  let opacity;
  let fill;
  // Set current text color and opacity based on display mode selected
  if (displayMode === 'invis') {
    opacity = 0;
    fill = 'black';
  } else if (displayMode === 'ebook') {
    opacity = 1;
    fill = 'black';
  } else if (displayMode === 'eval') {
    opacity = parseFloat(rangeOpacityElem.value || '80') / 100;
    fill = fillColorHexMatch;
  } else {
    opacity = parseFloat(rangeOpacityElem.value || '80') / 100;
    fill = fillColorHex;
  }

  return { opacity, fill };
}

/**
 *
 * @param {OcrPage} page
 */
export async function renderPage(page) {
  const layoutMode = globalThis.layoutMode || false;

  const matchIdArr = ocr.getMatchingWordIds(search.search, globalThis.ocrAll.active[cp.n]);

  const angle = globalThis.pageMetricsArr[cp.n].angle || 0;

  const enableRotation = autoRotateCheckboxElem.checked && Math.abs(angle ?? 0) > 0.05;

  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  for (const lineObj of page.lines) {
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = enableRotation ? ocr.calcLineAngleAdj(lineObj) : { x: 0, y: 0 };

    if (outlineLinesElem.checked) {
      const heightAdj = Math.abs(Math.tan(angle * (Math.PI / 180)) * (linebox.right - linebox.left));
      const height1 = linebox.bottom - linebox.top - heightAdj;
      const height2 = lineObj.words[0] ? lineObj.words[0].bbox.bottom - lineObj.words[0].bbox.top : 0;
      const height = Math.max(height1, height2);

      const lineRect = new Konva.Rect({
        x: linebox.left + angleAdjLine.x,
        y: linebox.top + angleAdjLine.y,
        width: linebox.right - linebox.left,
        height,
        rotation: angleArg,
        stroke: 'rgba(0,0,255,0.75)',
        strokeWidth: 1,
        draggable: false,
      });

      canvasObj.lineOutlineArr.push(lineRect);

      layerText.add(lineRect);
    }

    for (const wordObj of lineObj.words) {
      if (!wordObj.text) continue;

      const box = wordObj.bbox;

      const boxWidth = box.right - box.left;

      const wordDropCap = wordObj.dropcap;
      const fontStyle = wordObj.style;

      const fontI = fontAll.getWordFont(wordObj);

      const {
        visualWidth, charSpacing, leftSideBearing, fontSize, charArr, advanceArr, kerningArr,
      } = await calcWordMetrics(wordObj);

      const wordText = charArr.join('');

      const scaleX = wordDropCap ? (boxWidth / visualWidth) : 1;

      const wordConf = wordObj.conf;

      const confThreshHigh = confThreshHighElem.value !== '' ? parseInt(confThreshHighElem.value) : 85;

      const displayMode = displayModeElem.value;

      const outlineWord = outlineWordsElem.checked || displayMode === 'eval' && wordConf > confThreshHigh && !wordObj.matchTruth;

      const angleAdjWord = enableRotation ? ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

      let visualBaseline;
      if (enableRotation) {
        visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;
      } else {
        visualBaseline = linebox.bottom + baseline[1] + baseline[0] * (box.left - linebox.left);
      }

      let top = visualBaseline;
      if (wordObj.sup || wordDropCap) top = box.bottom + angleAdjLine.y + angleAdjWord.y;

      // This version uses the angle from the line rather than the page
      // const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (Math.atan(baseline[0]) * (180 / Math.PI)) : 0;

      const visualLeft = box.left + angleAdjLine.x + angleAdjWord.x;
      const left = visualLeft - leftSideBearing;

      const { fill, opacity } = getWordFillOpacity(wordObj);
      const advanceArrTotal = [];
      for (let i = 0; i < advanceArr.length; i++) {
        let leftI = 0;
        leftI += advanceArr[i] || 0;
        leftI += kerningArr[i] || 0;
        leftI += charSpacing || 0;
        advanceArrTotal.push(leftI);
      }

      const wordCanvas = new KonvaWord({
        x: left,
        y: top,
        topBaseline: visualBaseline,
        rotation: angleArg,
        opacity,
        charArr,
        fontSize,
        fontStyle,
        fill,
        advanceArrTotal,
        fontFaceName: fontI.fontFaceName,
        fontStyleLookup: fontStyle,
        fontFamilyLookup: fontI.family,
        charSpacing,
        word: wordObj,
        visualLeft,
        outline: outlineWord,
        fillBox: matchIdArr.includes(wordObj.id),
      });

      // Add the text node to the given layer
      layerText.add(wordCanvas);
    }
  }

  if (layoutMode) {
    renderLayoutBoxes(Object.keys(globalThis.layout[cp.n].boxes), false);
  }

  updateDataPreview();
}
