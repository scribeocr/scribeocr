/* eslint-disable import/no-cycle */

import {
  calcWordFontSize, calcWordMetrics, calcCharSpacing,
} from '../fontUtils.js';
import { renderLayoutBoxes, updateDataPreview } from './interfaceLayout.js';
import ocr, { OcrPage } from '../objects/ocrObjects.js';
import { ITextWord } from '../objects/fabricObjects.js';
import { cp, search } from '../../main.js';

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const showBoundingBoxesElem = /** @type {HTMLInputElement} */(document.getElementById('showBoundingBoxes'));

/**
 *
 * @param {*} canvas
 * @param {OcrPage} page
 * @param {*} defaultFont
 * @param {*} imgDims
 * @param {*} angle
 * @param {*} leftAdjX
 * @param {*} fontAll
 */
export async function renderPage(canvas, page, defaultFont, imgDims, angle, leftAdjX, fontAll) {
  const layoutMode = globalThis.layoutMode || false;

  // objectCaching slows down page render speeds, and is generally not needed.
  // The exception is when working in layoutMode, where users draw semi-transparent rectangles
  // that overlap with many of the other elements, which requires objectCaching to run smoothly.
  if (layoutMode) {
    fabric.Object.prototype.objectCaching = true;
  } else {
    fabric.Object.prototype.objectCaching = false;
  }

  const enableRotation = autoRotateCheckboxElem.checked && Math.abs(angle ?? 0) > 0.05;

  for (const lineObj of page.lines) {
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = enableRotation ? ocr.calcLineAngleAdj(lineObj) : { x: 0, y: 0 };

    for (const wordObj of lineObj.words) {
      const fillColorHexMatch = wordObj.matchTruth ? '#00ff7b' : '#ff0000';

      if (!wordObj.text) continue;

      const box = wordObj.bbox;

      const boxWidth = box.right - box.left;

      const wordText = wordObj.text;
      const wordSup = wordObj.sup;
      const wordDropCap = wordObj.dropcap;
      const fontStyle = wordObj.style;
      let wordFontFamily = wordObj.font;

      let defaultFontFamily;
      if (wordFontFamily === null || wordFontFamily === undefined) {
        wordFontFamily = defaultFont;
        defaultFontFamily = true;
      } else {
        wordFontFamily = wordFontFamily.trim();
        defaultFontFamily = false;
      }

      const fontI = /** @type {FontContainerFont} */ (fontAll.active[wordFontFamily][fontStyle]);
      const fontOpentypeI = await fontI.opentype;

      const wordFontSize = await calcWordFontSize(wordObj, fontAll.active);

      let scaleX = 1;
      if (wordDropCap) {
        const wordWidthFont = (await calcWordMetrics(wordText.slice(0, 1), fontI, wordFontSize)).visualWidth;
        scaleX = (boxWidth / wordWidthFont);
      }

      const wordConf = wordObj.conf;

      const wordId = wordObj.id;

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

      let opacityArg; let
        fillArg;
      // Set current text color and opacity based on display mode selected
      if (displayMode === 'invis') {
        opacityArg = 0;
        fillArg = 'black';
      } else if (displayMode === 'ebook') {
        opacityArg = 1;
        fillArg = 'black';
      } else if (displayMode === 'eval') {
        opacityArg = 1;
        fillArg = fillColorHexMatch;
      } else {
        opacityArg = 1;
        fillArg = fillColorHex;
      }

      const showTextBoxBorderArg = showBoundingBoxesElem.checked || displayMode === 'eval' && wordConf > confThreshHigh && !wordObj.matchTruth;

      const charSpacing = await calcCharSpacing(wordText, fontI, wordFontSize, boxWidth);

      const wordFirstGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(0, 1)).getMetrics();

      const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontOpentypeI.unitsPerEm);

      const angleAdjWord = enableRotation ? ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

      let visualBaseline;
      if (wordSup || wordDropCap) {
        visualBaseline = box.bottom + angleAdjLine.y + angleAdjWord.y;
      } else if (enableRotation) {
        visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;
      } else {
        visualBaseline = linebox.bottom + baseline[1] + baseline[0] * (box.left - linebox.left);
      }

      // This version uses the angle from the line rather than the page
      // const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (Math.atan(baseline[0]) * (180 / Math.PI)) : 0;

      const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

      const visualLeft = box.left + angleAdjLine.x + angleAdjWord.x + leftAdjX;
      const left = visualLeft - wordLeftBearing;

      const textBackgroundColor = search.search && wordText.toLowerCase().includes(search.search?.toLowerCase()) ? '#4278f550' : '';

      const textbox = new ITextWord(wordText, {
        left,
        top: visualBaseline,
        angle: angleArg,
        word: wordObj,
        selectable: !layoutMode,
        leftOrig: left,
        topOrig: visualBaseline,
        baselineAdj: 0,
        wordSup,
        originY: 'bottom',
        fill: fillArg,
        fill_proof: fillColorHex,
        fill_ebook: 'black',
        fill_eval: fillColorHexMatch,
        fontFamily: fontI.fontFaceName,
        fontStyle: fontI.fontFaceStyle,
        fontObj: fontI,

        // fontFamilyLookup and fontStyleLookup should be used for all purposes other than Fabric.js (e.g. looking up font information)
        fontFamilyLookup: wordFontFamily,
        fontStyleLookup: fontStyle,
        wordID: wordId,
        visualWidth: boxWidth, // TODO: Is this incorrect when rotation exists?
        visualLeft,
        visualBaseline,
        scaleX,
        defaultFontFamily,
        textBackgroundColor,
        // fontFamily: 'times',
        opacity: opacityArg,
        charSpacing: charSpacing * 1000 / wordFontSize,
        fontSize: wordFontSize,
        showTextBoxBorder: showTextBoxBorderArg,
      });

      canvas.add(textbox);
    }
  }

  if (layoutMode) {
    renderLayoutBoxes(Object.keys(globalThis.layout[cp.n].boxes), false);
  }

  updateDataPreview();
}
