/* eslint-disable import/no-cycle */

import { calcWordMetrics } from '../fontUtils.js';
import { renderLayoutBoxes, updateDataPreview } from './interfaceLayout.js';
import ocr, { OcrPage } from '../objects/ocrObjects.js';
import { createEditableText } from '../objects/fabricObjects.js';
import { cp, search } from '../../main.js';
import { fontAll } from '../containers/fontContainer.js';
// import { Text as KonvaText } from '../../lib/konva/shapes/Text.js';
import Konva from '../../lib/konva.js';
import { layerText } from './interfaceCanvas.js';

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const outlineLinesElem = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));
const outlineWordsElem = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));
const showDebugVisElem = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));
const selectDebugVisElem = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

const ctxLegend = /** @type {CanvasRenderingContext2D} */ (/** @type {HTMLCanvasElement} */ (document.getElementById('legendCanvas')).getContext('2d'));

/**
 *
 * @param {OcrPage} page
 * @param {number} angle - Angle in degrees.
 * @param {*} leftAdjX
 */
export async function renderPage(page, angle, leftAdjX) {
  const layoutMode = globalThis.layoutMode || false;

  // objectCaching slows down page render speeds, and is generally not needed.
  // The exception is when working in layoutMode, where users draw semi-transparent rectangles
  // that overlap with many of the other elements, which requires objectCaching to run smoothly.
  // if (layoutMode) {
  //   fabric.Object.prototype.objectCaching = true;
  // } else {
  //   fabric.Object.prototype.objectCaching = false;
  // }

  const matchIdArr = ocr.getMatchingWordIds(search.search, globalThis.ocrAll.active[cp.n]);

  const enableRotation = autoRotateCheckboxElem.checked && Math.abs(angle ?? 0) > 0.05;

  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  // if (showDebugVisElem.checked && selectDebugVisElem.value !== 'None') {
  //   if (!globalThis.visInstructions[cp.n][selectDebugVisElem.value]) {
  //     console.log('Requested debugging visualization does not exist');
  //     return;
  //   }
  //   canvas.overlayVpt = true;
  //   const imgInstance = new fabric.Image(globalThis.visInstructions[cp.n][selectDebugVisElem.value].canvas);
  //   canvas.setOverlayImage(imgInstance, canvas.renderAll.bind(canvas), {
  //     originX: 'left',
  //     originY: 'top',
  //     // Scale should account for cases where an upscaled version was used to create the visualization.
  //     scaleX: globalThis.pageMetricsArr[cp.n].dims.width / imgInstance.width,
  //     scaleY: globalThis.pageMetricsArr[cp.n].dims.height / imgInstance.height,
  //   });
  //   const offscreenCanvasLegend = globalThis.visInstructions[cp.n][selectDebugVisElem.value].canvasLegend;
  //   if (offscreenCanvasLegend) {
  //     ctxLegend.canvas.width = offscreenCanvasLegend.width;
  //     ctxLegend.canvas.height = offscreenCanvasLegend.height;
  //     ctxLegend.drawImage(offscreenCanvasLegend, 0, 0);
  //   } else {
  //     ctxLegend.clearRect(0, 0, ctxLegend.canvas.width, ctxLegend.canvas.height);
  //   }
  //   return;
  // }
  // Clear overlay
  // canvas.setOverlayImage();

  for (const lineObj of page.lines) {
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = enableRotation ? ocr.calcLineAngleAdj(lineObj) : { x: 0, y: 0 };

    // if (outlineLinesElem.checked) {
    //   const heightAdj = Math.abs(Math.tan(angle * (Math.PI / 180)) * (linebox.right - linebox.left));
    //   const height1 = linebox.bottom - linebox.top - heightAdj;
    //   const height2 = lineObj.words[0] ? lineObj.words[0].bbox.bottom - lineObj.words[0].bbox.top : 0;
    //   const height = Math.max(height1, height2);

    //   const lineRect = new fabric.Rect({
    //     left: linebox.left + angleAdjLine.x + leftAdjX,
    //     top: linebox.bottom + angleAdjLine.y,
    //     originY: 'bottom',
    //     width: linebox.right - linebox.left,
    //     height,
    //     angle: angleArg,
    //     showTextBoxBorder: true,
    //     stroke: 'rgba(0,0,255,0.75)',
    //     fill: null,
    //     selectable: false,
    //     evented: false, // Prevents cursor from changing.
    //   });
    //   canvas.add(lineRect);
    // }

    for (const wordObj of lineObj.words) {
      const fillColorHexMatch = wordObj.matchTruth ? '#00ff7b' : '#ff0000';

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

      const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
      const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

      const confThreshHigh = confThreshHighElem.value !== '' ? parseInt(confThreshHighElem.value) : 85;
      const confThreshMed = confThreshMedElem.value !== '' ? parseInt(confThreshMedElem.value) : 75;

      let fillColorHex;
      if (wordConf > confThreshHigh) {
        fillColorHex = '#00ff7b';
      } else if (wordConf > confThreshMed) {
        fillColorHex = '#ffc800';
      } else {
        fillColorHex = '#ff0000';
      }

      const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));
      const displayMode = displayModeElem.value;

      let opacityArg;
      let fillArg;
      // Set current text color and opacity based on display mode selected
      if (displayMode === 'invis') {
        opacityArg = 0;
        fillArg = 'black';
      } else if (displayMode === 'ebook') {
        opacityArg = 1;
        fillArg = 'black';
      } else if (displayMode === 'eval') {
        opacityArg = parseFloat(rangeOpacityElem.value || '80') / 100;
        fillArg = fillColorHexMatch;
      } else {
        opacityArg = parseFloat(rangeOpacityElem.value || '80') / 100;
        fillArg = fillColorHex;
      }

      const showTextBoxBorderArg = outlineWordsElem.checked || displayMode === 'eval' && wordConf > confThreshHigh && !wordObj.matchTruth;

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

      const visualLeft = box.left + angleAdjLine.x + angleAdjWord.x + leftAdjX;
      const left = visualLeft - leftSideBearing;

      const textBackgroundColor = matchIdArr.includes(wordObj.id) ? '#4278f550' : '';

      // const wordMetrics = await calcWordMetrics(word);
      // const advanceArr = wordMetrics.advanceArr;
      // const kerningArr = wordMetrics.kerningArr;
      // const charSpacing = wordMetrics.charSpacing;

      const advanceArrTotal = [];
      for (let i = 0; i < advanceArr.length; i++) {
        let leftI = 0;
        leftI += advanceArr[i] || 0;
        leftI += kerningArr[i] || 0;
        leftI += charSpacing || 0;
        advanceArrTotal.push(leftI);
      }

      const fontIOpentype = await fontI.opentype;

      createEditableText({
        x: left,
        y: top,
        charArr,
        fontSize,
        fontStyle,
        fillArg,
        advanceArrTotal,
        fontFaceName: fontI.fontFaceName,
        charSpacing,
        fontIOpentype,
        word: wordObj,
      });

      // const textbox = new Konva.Text({
      //   x: left,
      //   y: top,
      //   rotation: angleArg,
      //   text: wordText,
      //   fontSize,
      //   fontFamily: fontI.fontFaceName,
      //   fontStyle,
      //   fill: fillArg,
      //   opacity: opacityArg,
      //   scaleX,
      //   letterSpacing: charSpacing,
      //   // textBaseline: wordObj.sup ? 'top' : 'alphabetic',
      //   textBackgroundColor,
      // });

      // const textbox = new ITextWord(wordText, {
      //   left,
      //   top,
      //   angle: angleArg,
      //   word: wordObj,
      //   selectable: !layoutMode,
      //   topBaseline: visualBaseline,
      //   topBaselineOrig: visualBaseline,
      //   baselineAdj: 0,
      //   originY: 'bottom',
      //   fill: fillArg,
      //   fill_proof: fillColorHex,
      //   fill_ebook: 'black',
      //   fill_eval: fillColorHexMatch,
      //   fontFamily: fontI.fontFaceName,
      //   fontStyle: fontI.fontFaceStyle,
      //   fontObj: fontI,

      //   // fontFamilyLookup and fontStyleLookup should be used for all purposes other than Fabric.js (e.g. looking up font information)
      //   fontFamilyLookup: fontI.family,
      //   fontStyleLookup: fontStyle,
      //   visualLeft,
      //   visualBaseline,
      //   scaleX,
      //   defaultFontFamily: !wordObj.font,
      //   textBackgroundColor,
      //   // fontFamily: 'times',
      //   opacity: opacityArg,
      //   charSpacing: charSpacing * 1000 / fontSize,
      //   fontSize,
      //   showTextBoxBorder: showTextBoxBorderArg,
      // });

      // layer.add(textbox);
    }
  }

  if (layoutMode) {
    renderLayoutBoxes(Object.keys(globalThis.layout[cp.n].boxes), false);
  }

  updateDataPreview();
}
