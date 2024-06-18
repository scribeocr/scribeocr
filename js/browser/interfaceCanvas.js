/* eslint-disable import/no-cycle */

import Konva from '../../lib/konva/index.js';
import { calcWordMetrics, addLigatures } from '../fontUtils.js';
import { fontAll } from '../containers/fontContainer.js';
import { addWordManual, recognizeArea } from './interfaceEdit.js';
import ocr from '../objects/ocrObjects.js';
import { showHideElem } from '../miscUtils.js';
import {
  KonvaLayout, updateDataPreview, addLayoutBoxClick, selectLayoutBoxesArea,
  addLayoutDataTableClick, mergeDataColumns, checkDataColumnsAdjacent,
  splitDataColumn,
  deleteLayoutBoxClick,
  deleteLayoutDataTableClick,
} from './interfaceLayout.js';
import { cp, search } from '../../main.js';
import { ocrAll, pageMetricsArr } from '../containers/miscContainer.js';

const zoomInElem = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));
const zoomOutElem = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleBoldElem = /** @type {HTMLInputElement} */(document.getElementById('styleBold'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const outlineLinesElem = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));
const outlineWordsElem = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleBoldButton = new bootstrap.Button(styleBoldElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

Konva.autoDrawEnabled = false;
Konva.dragButtons = [0];

const stage = new Konva.Stage({
  container: 'c',
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

const layerBackground = new Konva.Layer();
const layerText = new Konva.Layer();
const layerOverlay = new Konva.Layer();

stage.add(layerBackground);
stage.add(layerText);
stage.add(layerOverlay);

const createContextMenuHTML = () => {
  const menuDiv = document.createElement('div');
  menuDiv.id = 'menu';

  const innerDiv = document.createElement('div');

  const splitButton = document.createElement('button');
  splitButton.id = 'contextMenuSplitColumnButton';
  splitButton.textContent = 'Split Column';
  splitButton.style.display = 'none';
  splitButton.addEventListener('click', splitDataColumnClick);

  const mergeButton = document.createElement('button');
  mergeButton.id = 'contextMenuMergeColumnButtons';
  mergeButton.textContent = 'Merge Columns';
  mergeButton.style.display = 'none';
  mergeButton.addEventListener('click', mergeDataColumnsClick);

  const deleteLayoutButton = document.createElement('button');
  deleteLayoutButton.id = 'contextMenuDeleteLayoutBoxButton';
  deleteLayoutButton.textContent = 'Delete';
  deleteLayoutButton.style.display = 'none';
  deleteLayoutButton.addEventListener('click', deleteLayoutBoxClick);

  const deleteTableButton = document.createElement('button');
  deleteTableButton.id = 'contextMenuDeleteTableButton';
  deleteTableButton.textContent = 'Delete Table';
  deleteTableButton.style.display = 'none';
  deleteTableButton.addEventListener('click', deleteLayoutDataTableClick);

  innerDiv.appendChild(splitButton);
  innerDiv.appendChild(mergeButton);
  innerDiv.appendChild(deleteLayoutButton);
  innerDiv.appendChild(deleteTableButton);

  menuDiv.appendChild(innerDiv);

  return menuDiv;
};

const mergeDataColumnsClick = () => {
  hideContextMenu();
  mergeDataColumns(canvasObj.selectedDataColumnArr);
};

const splitDataColumnClick = () => {
  hideContextMenu();
  const ptr = layerOverlay.getRelativePointerPosition();
  if (!ptr) return;
  splitDataColumn(canvasObj.selectedDataColumnArr[0], ptr.x);
};

const menuNode = createContextMenuHTML();
document.body.appendChild(menuNode);

const contextMenuMergeColumnButtonsElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeColumnButtons'));
const contextMenuSplitColumnButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitColumnButton'));
const contextMenuDeleteLayoutBoxButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteLayoutBoxButton'));
const contextMenuDeleteTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteTableButton'));

export const hideContextMenu = () => {
  contextMenuMergeColumnButtonsElem.style.display = 'none';
  contextMenuSplitColumnButtonElem.style.display = 'none';
  contextMenuDeleteLayoutBoxButtonElem.style.display = 'none';
  contextMenuDeleteTableButtonElem.style.display = 'none';
  menuNode.style.display = 'none';
};

const style = document.createElement('style');

// Add CSS rules to the style element
style.textContent = `
  #menu {
    display: none;
    position: absolute;
    width: 140px;
    background-color: white;
    box-shadow: 0 0 5px grey;
    border-radius: 3px;
  }
  #menu button {
    width: 100%;
    background-color: white;
    border: none;
    margin: 0;
    padding: 10px;
    text-wrap: nowrap;
    text-align: left;
  }
  #menu button:hover {
    background-color: lightgray;
  }`;

document.head.appendChild(style);

stage.on('contextmenu', (e) => {
  // prevent default behavior

  if (e.target === stage) {
    // if we are on empty place of the stage we will do nothing
    return;
  }

  let enableMerge = false;
  let enableSplit = false;
  let enableDelete = false;
  let enableDeleteTable = false;

  // The "Merge Columns" button will be enabled if multiple adjacent columns are selected.
  if (canvasObj.selectedDataColumnArr.length > 1 && checkDataColumnsAdjacent(canvasObj.selectedDataColumnArr)) enableMerge = true;
  if (canvasObj.selectedDataColumnArr.length === 1) enableSplit = true;
  if (canvasObj.selectedLayoutBoxArr.length > 0) enableDelete = true;
  if (canvasObj.selectedDataColumnArr.length > 0 && canvasObj.selectedDataColumnArr.length === canvasObj.selectedDataColumnArr[0].konvaTable.columns.length) enableDeleteTable = true;

  if (!(enableMerge || enableSplit || enableDelete || enableDeleteTable)) return;

  if (enableMerge) {
    contextMenuMergeColumnButtonsElem.style.display = 'initial';
  }
  if (enableSplit) {
    contextMenuSplitColumnButtonElem.style.display = 'initial';
  }
  if (enableDelete) {
    contextMenuDeleteLayoutBoxButtonElem.style.display = 'initial';
  }
  if (enableDeleteTable) {
    contextMenuDeleteTableButtonElem.style.display = 'initial';
  }

  e.evt.preventDefault();

  menuNode.style.display = 'initial';
  const containerRect = stage.container().getBoundingClientRect();
  menuNode.style.top = `${containerRect.top + stage.getPointerPosition().y + 4}px`;
  menuNode.style.left = `${containerRect.left + stage.getPointerPosition().x + 4}px`;
});

const selectingRectangle = new Konva.Rect({
  fill: 'rgba(40,123,181,0.5)',
  visible: true,
  // disable events to not interrupt with events
  listening: false,
});

layerText.add(selectingRectangle);

export const canvasObj = {
  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  controlArr: [],
  /** @type {Array<InstanceType<typeof Konva.Rect>>} */
  lineOutlineArr: [],
  /** @type {Array<KonvaOcrWord>} */
  selectedWordArr: [],
  /** @type {Array<KonvaLayout>} */
  layoutBoxArr: [],
  /** @type {Array<import('./interfaceLayout.js').KonvaDataTable>} */
  layoutDataTableArr: [],
  /** @type {Array<KonvaLayout>} */
  selectedLayoutBoxArr: [],
  /** @type {Array<import('./interfaceLayout.js').KonvaDataColumn>} */
  selectedDataColumnArr: [],
  /** @type {?HTMLSpanElement} */
  input: null,
  /** @type {?Function} */
  inputRemove: null,
  selectingRectangle,
  selecting: false,
  /** @type {bbox} */
  bbox: {
    top: 0, left: 0, right: 0, bottom: 0,
  },
  /** @type {('select'|'addWord'|'recognizeWord'|'recognizeArea'|'printCoords'|'addLayoutBoxOrder'|'addLayoutBoxExclude'|'addLayoutBoxDataTable')} */
  mode: 'select',
  isTouchScreen: navigator?.maxTouchPoints > 0,
  drag: {
    isPinching: false,
    isDragging: false,
    dragDeltaTotal: 0,
    lastX: 0,
    lastY: 0,
    /** @type {?{x: number, y: number}} */
    lastCenter: null,
    /** @type {?number} */
    lastDist: null,
  },

};

export const deselectAllWords = () => {
  canvasObj.selectedWordArr.forEach((shape) => (shape.deselect()));
  canvasObj.selectedWordArr.length = 0;
};

export const deselectAllLayoutBoxes = () => {
  canvasObj.selectedLayoutBoxArr.forEach((shape) => (shape.deselect()));
  canvasObj.selectedLayoutBoxArr.length = 0;
};

export const deselectAllDataColumns = () => {
  canvasObj.selectedDataColumnArr.forEach((shape) => (shape.deselect()));
  canvasObj.selectedDataColumnArr.length = 0;
};

export const deselectAll = () => {
  deselectAllWords();
  deselectAllLayoutBoxes();
  deselectAllDataColumns();
};

/**
 *
 * @param {boolean} [deselect=true] - Deselect all words, layout boxes, and data columns.
 */
export const destroyControls = (deselect = true) => {
  globalThis.collapseRangeCollapse.hide();
  globalThis.collapseSetLayoutBoxTableCollapse.hide();
  canvasObj.controlArr.forEach((control) => control.destroy());
  canvasObj.controlArr.length = 0;

  if (deselect) deselectAll();

  if (canvasObj.input && canvasObj.input.parentElement && canvasObj.inputRemove) canvasObj.inputRemove();
};

export const destroyLineOutlines = () => {
  canvasObj.lineOutlineArr.forEach((x) => x.destroy());
  canvasObj.lineOutlineArr.length = 0;
};

export const destroyLayoutBoxes = () => {
  canvasObj.layoutBoxArr.forEach((x) => x.destroy());
  canvasObj.layoutBoxArr.length = 0;
  destroyLayoutDataTables();
};

export const destroyLayoutDataTables = () => {
  canvasObj.layoutDataTableArr.forEach((x) => x.destroy());
  canvasObj.layoutDataTableArr.length = 0;
};

/**
 * Update word textbox on canvas following changes.
 * Whenever a user edits a word in any way (including content and font/style),
 * the position and character spacing need to be re-calculated so they still overlay with the background image.
 * @param {KonvaIText} wordI
 */
export async function updateWordCanvas(wordI) {
  const fontI = fontAll.getWordFont(wordI.word);
  const fontIOpentype = fontI.opentype;

  wordI.charArr = addLigatures(wordI.word.text, fontIOpentype);

  // 1. Re-calculate left position given potentially new left bearing
  const {
    advanceArr, fontSize, kerningArr, charSpacing, leftSideBearing, rightSideBearing,
  } = calcWordMetrics(wordI.word);

  const charSpacingFinal = !wordI.dynamicWidth ? charSpacing : 0;

  const advanceArrTotal = [];
  for (let i = 0; i < advanceArr.length; i++) {
    let leftI = 0;
    leftI += advanceArr[i] || 0;
    leftI += kerningArr[i] || 0;
    leftI += charSpacingFinal || 0;
    advanceArrTotal.push(leftI);
  }

  wordI.advanceArrTotal = advanceArrTotal;

  wordI.charSpacing = charSpacingFinal;

  wordI.leftSideBearing = leftSideBearing;

  let width = wordI.dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : wordI.word.bbox.right - wordI.word.bbox.left;

  // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
  if (!wordI.dynamicWidth && !wordI.word.visualCoords) width -= (leftSideBearing + rightSideBearing);

  wordI.width(width);

  wordI.scaleX(1);

  wordI.fontSize = fontSize;
  wordI.show();

  // Test `wordI.parent` to avoid race condition where `wordI` is destroyed before this function completes.
  if (wordI.parent) wordI.draw();
}

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

export class KonvaIText extends Konva.Shape {
  /**
   * The `KonvaIText` class is a Konva shape that displays text, which is interactive and can be edited.
   * While it uses an `OcrWord` object for input information, it is not directly tied to OCR, and can be used for any text with a dummy `OcrWord`.
   * Any logic specific to OCR should be handled in the `OcrWord` object.
   * @param {Object} options
   * @param {number} options.x
   * @param {number} options.yActual
   * @param {import('../objects/ocrObjects.js').OcrWord} options.word
   * @param {number} [options.rotation=0]
   * @param {boolean} [options.outline=false]
   * @param {boolean} [options.selected=false]
   * @param {boolean} [options.fillBox=false]
   * @param {number} [options.opacity=1]
   * @param {string} [options.fill='black']
   * @param {boolean} [options.dynamicWidth=false] - If `true`, the width of the text box will be calculated dynamically based on the text content, rather than using the bounding box.
   *    This is used for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
   * @param {Function} options.editTextCallback
   */
  constructor({
    x, yActual, word, rotation = 0,
    outline = false, selected = false, fillBox = false, opacity = 1, fill = 'black', dynamicWidth = false, editTextCallback,
  }) {
    const {
      visualWidth, charSpacing, leftSideBearing, rightSideBearing, fontSize, charArr, advanceArr, kerningArr,
    } = calcWordMetrics(word);

    const charSpacingFinal = !dynamicWidth ? charSpacing : 0;

    const scaleX = word.dropcap ? ((word.bbox.right - word.bbox.left) / visualWidth) : 1;

    const advanceArrTotal = [];
    for (let i = 0; i < advanceArr.length; i++) {
      let leftI = 0;
      leftI += advanceArr[i] || 0;
      leftI += kerningArr[i] || 0;
      leftI += charSpacingFinal || 0;
      advanceArrTotal.push(leftI);
    }

    // The `dynamicWidth` option is useful for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
    // Setting to `true` for OCR text results in no change for most words, however can cause fringe issues with some words.
    // For example, in some cases Tesseract will misidentify a single character as a multi-character word.
    // In this case, the total advance may be negative, making this method of calculating the width incorrect.
    let width = dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : word.bbox.right - word.bbox.left;

    // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
    if (!dynamicWidth && !word.visualCoords) width -= (leftSideBearing + rightSideBearing);

    super({
      x,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      y: yActual - fontSize * 0.6,
      width,
      height: fontSize * 0.6,
      rotation,
      opacity,
      fill,
      /**
       * @param {InstanceType<typeof Konva.Context>} context
       * @param {KonvaIText} shape
       */
      sceneFunc: (context, shape) => {
        context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
        context.textBaseline = 'alphabetic';
        context.fillStyle = shape.fill();
        context.lineWidth = 1;

        shape.setAttr('y', shape.yActual - shape.fontSize * 0.6);

        let leftI = shape.word.visualCoords ? 0 - this.leftSideBearing : 0;
        for (let i = 0; i < shape.charArr.length; i++) {
          let charI = shape.charArr[i];

          if (shape.fontStyle === 'smallCaps') {
            if (charI === charI.toUpperCase()) {
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
            } else {
              charI = charI.toUpperCase();
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize * 0.8}px ${shape.fontFaceName}`;
            }
          }

          context.fillText(charI, leftI, shape.fontSize * 0.6);

          leftI += shape.advanceArrTotal[i];
        }

        if (shape.outline) {
          context.strokeStyle = 'black';
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.selected) {
          context.strokeStyle = 'rgba(40,123,181,1)';
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.fillBox) {
          context.fillStyle = '#4278f550';
          context.fillRect(0, 0, shape.width(), shape.height());
        }
      },

      hitFunc: (context, shape) => {
        context.beginPath();
        context.rect(0, 0, shape.width(), shape.height());
        context.closePath();
        context.fillStrokeShape(shape);
      },
    });

    const fontI = fontAll.getWordFont(word);

    this.word = word;
    this.charArr = charArr;
    this.charSpacing = charSpacingFinal;
    this.advanceArrTotal = advanceArrTotal;
    this.leftSideBearing = leftSideBearing;
    this.fontSize = fontSize;
    // `yActual` contains the y value that we want to draw the text at, which is usually the baseline.
    this.yActual = yActual;
    this.lastWidth = this.width();
    this.fontFaceStyle = fontI.fontFaceStyle;
    this.fontFaceWeight = fontI.fontFaceWeight;
    this.fontFaceName = fontI.fontFaceName;
    this.fontFamilyLookup = fontI.family;
    this.fontStyle = word.style;
    this.outline = outline;
    this.selected = selected;
    this.fillBox = fillBox;
    this.dynamicWidth = dynamicWidth;
    this.editTextCallback = editTextCallback;

    this.addEventListener('dblclick dbltap', () => {
      KonvaIText.addTextInput(this);
    });

    this.select = () => {
      this.selected = true;
    };

    this.deselect = () => {
      this.selected = false;
    };
  }

  /**
   * Position and show the input for editing.
   * @param {KonvaIText} itext
   */
  static addTextInput = (itext) => {
    const pointerCoordsRel = layerText.getRelativePointerPosition();
    let letterIndex = 0;
    let leftI = itext.x() - itext.leftSideBearing;
    for (let i = 0; i < itext.charArr.length; i++) {
      // For most letters, the letter is selected if the pointer is in the left 75% of the advance.
      // This could be rewritten to be more precise by using the actual bounding box of each letter,
      // however this would require calculating additional metrics for each letter.
      // The 75% rule is a compromise, as setting to 50% would be unintuitive for users trying to select the letter they want to edit,
      // and setting to 100% would be unintuitive for users trying to position the cursor between letters.
      // For the last letter, since using the 75% rule would make it extremely difficult to select the end of the word.
      const cutOffPer = i + 1 === itext.charArr.length ? 0.5 : 0.75;
      const cutOff = leftI + itext.advanceArrTotal[i] * cutOffPer;
      if (pointerCoordsRel?.x && cutOff > pointerCoordsRel.x) break;
      letterIndex++;
      leftI += itext.advanceArrTotal[i];
    }

    if (canvasObj.input && canvasObj.input.parentElement && canvasObj.inputRemove) canvasObj.inputRemove();

    if (canvasObj.input) {
      debugger;
    }

    canvasObj.input = document.createElement('span');

    const text = itext.charArr.join('');

    const scale = layerText.scaleY();

    const charSpacingHTML = itext.charSpacing * scale;

    let { x: x1, y: y1 } = itext.getAbsolutePosition();
    if (itext.word.visualCoords) x1 -= itext.leftSideBearing * scale;

    const fontSizeHTML = itext.fontSize * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const fontI = fontAll.getWordFont(itext.word);

    ctx.font = `${itext.fontFaceStyle} ${itext.fontFaceWeight} ${fontSizeHTML}px ${fontI.fontFaceName}`;

    const metrics = ctx.measureText(text);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * 0.8;

    canvasObj.input.style.position = 'absolute';
    canvasObj.input.style.left = `${x1}px`;
    canvasObj.input.style.top = `${y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6}px`; // Align with baseline
    canvasObj.input.style.fontSize = `${fontSizeHTML}px`;
    canvasObj.input.style.fontFamily = itext.fontFaceName;

    // We cannot make the text uppercase in the input field, as this would result in the text being saved as uppercase.
    // Additionally, while there is a small-caps CSS property, it does not allow for customizing the size of the small caps.
    // Therefore, we handle small caps by making all text print as uppercase using the `text-transform` CSS property,
    // and then wrapping each letter in a span with a smaller font size.
    if (itext.fontStyle === 'smallCaps') {
      canvasObj.input.style.textTransform = 'uppercase';
      canvasObj.input.innerHTML = text.replace(/[a-z]+/g, (matched) => `<span class="input-sub" style="font-size:${fontSizeHTMLSmallCaps}px">${matched}</span>`);
    } else {
      canvasObj.input.textContent = text;
    }

    canvasObj.input.style.letterSpacing = `${charSpacingHTML}px`;
    canvasObj.input.style.color = itext.fill();
    canvasObj.input.style.opacity = String(itext.opacity());
    canvasObj.input.style.fontStyle = itext.fontFaceStyle;
    canvasObj.input.style.fontWeight = itext.fontFaceWeight;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    canvasObj.input.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;
    canvasObj.input.contentEditable = 'true';

    // Prevent line breaks and hide overflow
    canvasObj.input.style.whiteSpace = 'nowrap';
    // canvasObj.input.style.overflow = 'hidden';

    if (itext.fontStyle === 'smallCaps') {
      canvasObj.input.oninput = () => {
        const index = getCursorIndex();
        canvasObj.input.innerHTML = canvasObj.input.textContent.replace(/[a-z]+/g, (matched) => `<span class="input-sub" style="font-size:${fontSizeHTMLSmallCaps}px">${matched}</span>`);
        setCursor(index);
      };
    }

    canvasObj.inputRemove = () => {
      const textNew = ocr.replaceLigatures(canvasObj.input?.textContent || '').trim();

      // Words are not allowed to be empty
      if (textNew) {
        itext.word.text = textNew;
        itext.editTextCallback(itext);
      }
      updateWordCanvas(itext);
      canvasObj.input.remove();
      canvasObj.input = null;
      canvasObj.inputRemove = null;
    };

    // Update the Konva Text node after editing
    canvasObj.input.addEventListener('blur', () => (canvasObj.inputRemove));

    document.body.appendChild(canvasObj.input);

    canvasObj.input.focus();

    /**
     * Returns the cursor position relative to the start of the text box, including all text nodes.
     * @returns {number}
     */
    const getCursorIndex = () => {
      const sel = /** @type {Selection} */ (window.getSelection());
      let nodePrev = sel.anchorNode?.parentElement.className === 'input-sub' ? sel.anchorNode?.parentElement.previousSibling : sel.anchorNode?.previousSibling;
      let nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];

      let index = sel.anchorOffset;
      while (nodePrevText) {
        index += nodePrev.textContent?.length || 0;
        nodePrev = nodePrev.className === 'input-sub' ? nodePrev.previousSibling : nodePrev?.previousSibling;
        nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];
      }
      // console.log(`Cursor index: ${index} (from ${sel.anchorOffset})`);
      return index;
    };

    const setCursor = (index) => {
    // Set the cursor to the correct position
      const range = document.createRange();
      const sel = /** @type {Selection} */ (window.getSelection());

      let letterI = 0;
      for (let i = 0; i < canvasObj.input.childNodes.length; i++) {
        const node = canvasObj.input.childNodes[i];
        const nodeLen = node.textContent?.length || 0;
        if (letterI + nodeLen >= index) {
          const textNode = node.nodeType === 3 ? node : node.childNodes[0];
          // console.log(`Setting cursor to index ${index - letterI} in node ${i}`);
          range.setStart(textNode, index - letterI);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          break;
        } else {
          letterI += nodeLen;
        }
      }
    };

    setCursor(letterIndex);

    itext.hide();
    itext.draw();
  };
}

export class KonvaOcrWord extends KonvaIText {
  /**
   *
   * @param {Object} options
   * @param {number} options.visualLeft
   * @param {number} options.yActual
   * @param {number} options.topBaseline
   * @param {OcrWord} options.word
   * @param {number} options.rotation
   * @param {boolean} options.outline - Draw black outline around text.
   * @param {boolean} options.fillBox
   */
  constructor({
    visualLeft, yActual, topBaseline, word, rotation,
    outline, fillBox,
  }) {
    const { fill, opacity } = getWordFillOpacity(word);

    super({
      x: visualLeft,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      yActual,
      word,
      rotation,
      outline,
      fillBox,
      opacity,
      fill,
      editTextCallback: () => {},
    });

    this.listening(!globalThis.layoutMode);

    this.lastX = this.x();
    this.lastWidth = this.width();
    this.baselineAdj = 0;
    this.topBaseline = topBaseline;
    this.topBaselineOrig = topBaseline;

    this.addEventListener('transformstart', () => {
      this.lastX = this.x();
      this.lastWidth = this.width();
    });

    this.addEventListener('transformend', () => {
      // Sub-integer scaling is allowed to avoid a frustrating user experience, and allow for precise positioning when exporting to PDF.
      // However, the bounding box will be rounded upon export to HOCR, as the HOCR specification requires integer coordinates.
      const leftDelta = this.x() - this.lastX;
      const widthDelta = this.width() * this.scaleX() - this.lastWidth;

      const leftMode = Math.abs(leftDelta) > Math.abs(widthDelta / 2);

      if (leftMode) {
        this.word.bbox.left += leftDelta;
      } else {
        this.word.bbox.right += widthDelta;
      }

      updateWordCanvas(this);
    });
  }

  /**
   * Update the UI to reflect the properties of the word(s) in `canvasObj.selectedWordArr`.
   * This should be called when any word is selected, after adding them to `canvasObj.selectedWordArr`.
   */
  static updateUI = () => {
    const wordFirst = canvasObj.selectedWordArr[0];

    if (!wordFirst) return;

    const fontFamilySelectedArr = Array.from(new Set(canvasObj.selectedWordArr.map((x) => (x.fontFamilyLookup))));
    const fontSizeSelectedArr = Array.from(new Set(canvasObj.selectedWordArr.map((x) => (x.fontSize))));

    if (fontFamilySelectedArr.length === 1) {
      wordFontElem.value = String(wordFirst.fontFamilyLookup);
    } else {
      wordFontElem.value = '';
    }

    if (fontSizeSelectedArr.length === 1) {
      fontSizeElem.value = String(wordFirst.fontSize);
    } else {
      fontSizeElem.value = '';
    }

    if (wordFirst.word.sup !== styleSuperElem.classList.contains('active')) {
      styleSuperButton.toggle();
    }
    const italic = wordFirst.fontStyle === 'italic';
    if (italic !== styleItalicElem.classList.contains('active')) {
      styleItalicButton.toggle();
    }
    const bold = wordFirst.fontStyle === 'bold';
    if (bold !== styleBoldElem.classList.contains('active')) {
      styleBoldButton.toggle();
    }
    const smallCaps = wordFirst.fontStyle === 'smallCaps';
    if (smallCaps !== styleSmallCapsElem.classList.contains('active')) {
      styleSmallCapsButton.toggle();
    }
  };

  /**
   * Add controls for editing.
   * @param {KonvaOcrWord} itext
   */
  static addControls = (itext) => {
    const trans = new Konva.Transformer({
      enabledAnchors: ['middle-left', 'middle-right'],
      rotateEnabled: false,
    });
    canvasObj.controlArr.push(trans);
    layerText.add(trans);

    trans.nodes([itext]);
  };
}

const trans = new Konva.Transformer({
  enabledAnchors: ['middle-left', 'middle-right'],
  rotateEnabled: false,
});
layerText.add(trans);

/**
 *
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.x
 * @param {number} box.y
 */
function selectWords(box) {
  const shapes = getCanvasWords();

  const existingSelectedWordsId = canvasObj.selectedWordArr.map((x) => x.word.id);
  const newSelectedWords = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()) && !existingSelectedWordsId.includes(shape.word.id));

  canvasObj.selectedWordArr.push(...newSelectedWords);

  if (canvasObj.selectedWordArr.length > 1) {
    canvasObj.selectedWordArr.forEach((shape) => (shape.select()));
  } else if (canvasObj.selectedWordArr.length === 1) {
    KonvaOcrWord.addControls(canvasObj.selectedWordArr[0]);
    KonvaOcrWord.updateUI();
  }
}

let clearSelectionStart = false;

stage.on('mousedown touchstart', (e) => {
  hideContextMenu();

  // Left click only
  if (e.evt.button !== 0) return;

  clearSelectionStart = e.target instanceof Konva.Stage || e.target instanceof Konva.Image;

  if (canvasObj.isTouchScreen && canvasObj.mode === 'select') return;

  // Move selection rectangle to top.
  selectingRectangle.zIndex(layerText.children.length - 1);

  e.evt.preventDefault();
  const startCoords = layerText.getRelativePointerPosition() || { x: 0, y: 0 };
  canvasObj.bbox.left = startCoords.x;
  canvasObj.bbox.top = startCoords.y;
  canvasObj.bbox.right = startCoords.x;
  canvasObj.bbox.bottom = startCoords.y;

  selectingRectangle.width(0);
  selectingRectangle.height(0);
  canvasObj.selecting = true;
});

stage.on('mousemove touchmove', (e) => {
  // do nothing if we didn't start selection
  if (!canvasObj.selecting) {
    return;
  }
  e.evt.preventDefault();
  const endCoords = layerText.getRelativePointerPosition();
  if (!endCoords) return;

  canvasObj.bbox.right = endCoords.x;
  canvasObj.bbox.bottom = endCoords.y;

  selectingRectangle.setAttrs({
    visible: true,
    x: Math.min(canvasObj.bbox.left, canvasObj.bbox.right),
    y: Math.min(canvasObj.bbox.top, canvasObj.bbox.bottom),
    width: Math.abs(canvasObj.bbox.right - canvasObj.bbox.left),
    height: Math.abs(canvasObj.bbox.bottom - canvasObj.bbox.top),
  });

  layerText.batchDraw();
});

stage.on('mouseup touchend', (event) => {
  // For dragging layout boxes, other events are needed to stop the drag.
  if (!globalThis.layoutMode) {
    event.evt.preventDefault();
    event.evt.stopPropagation();
  }

  // Delete any current selections if either (1) this is a new selection or (2) nothing is being clicked.
  // Clicks must pass this check on both start and end.
  // This prevents accidentally clearing a selection when the user is trying to highlight specific letters, but the mouse up happens over another word.
  if (clearSelectionStart && (canvasObj.selecting || event.target instanceof Konva.Stage || event.target instanceof Konva.Image)) destroyControls();

  canvasObj.selecting = false;

  // Return early if this was a drag or pinch rather than a selection.
  // `isDragging` will be true even for a touch event, so a minimum distance moved is required to differentiate between a click and a drag.
  if (event.evt.button === 1 || (canvasObj.drag.isDragging && canvasObj.drag.dragDeltaTotal > 10) || canvasObj.drag.isPinching) {
    stopDragPinch(event);
    return;
  }
  // `stopDragPinch` runs regardless of whether this actually is a drag/pinch, since `isDragging` can be enabled for taps.
  stopDragPinch(event);

  // Exit early if the user could be attempting to merge multiple columns.
  if (event.evt.button === 2) {
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const box = {
      x: ptr.x, y: ptr.y, width: 1, height: 1,
    };
    const layoutBoxes = canvasObj.selectedDataColumnArr.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));
    if (layoutBoxes.length > 0) return;
  }

  // Handle the case where no rectangle is drawn (i.e. a click event), or the rectangle is is extremely small.
  // Clicks are handled in the same function as rectangle selections as using separate events lead to issues when multiple events were triggered.
  if (!selectingRectangle.visible() || (selectingRectangle.width() < 5 && selectingRectangle.height() < 5)) {
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const box = {
      x: ptr.x, y: ptr.y, width: 1, height: 1,
    };
    if (canvasObj.mode === 'select' && !globalThis.layoutMode) {
      destroyControls(!event.evt.ctrlKey);
      selectWords(box);
      KonvaOcrWord.updateUI();
      layerText.batchDraw();
    } else if (canvasObj.mode === 'select' && globalThis.layoutMode) {
      destroyControls(!event.evt.ctrlKey);
      selectLayoutBoxesArea(box);
      KonvaLayout.updateUI();
      layerOverlay.batchDraw();
    }
    return;
  }

  // update visibility in timeout, so we can check it in click event
  selectingRectangle.visible(false);

  if (canvasObj.mode === 'select' && !globalThis.layoutMode) {
    destroyControls(!event.evt.ctrlKey);
    const box = selectingRectangle.getClientRect();
    selectWords(box);
    KonvaOcrWord.updateUI();
  } else if (canvasObj.mode === 'select' && globalThis.layoutMode) {
    destroyControls(!event.evt.ctrlKey);
    const box = selectingRectangle.getClientRect();
    selectLayoutBoxesArea(box);
    KonvaLayout.updateUI();
  } else if (canvasObj.mode === 'addWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addWordManual(box);
  } else if (canvasObj.mode === 'recognizeWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, true, false);
  } else if (canvasObj.mode === 'recognizeArea') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, false);
  } else if (canvasObj.mode === 'printCoords') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, true);
  } else if (canvasObj.mode === 'addLayoutBoxOrder') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'order');
  } else if (canvasObj.mode === 'addLayoutBoxExclude') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'exclude');
  } else if (canvasObj.mode === 'addLayoutBoxDataTable') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutDataTableClick(box);
  }

  canvasObj.mode = 'select';

  layerText.batchDraw();
});

/**
 * Check if the wheel event was from a track pad by applying a series of heuristics.
 * This function should be generally reliable, although it is inherently heuristic-based,
 * so should be refined over time as more edge cases are encountered.
 * @param {WheelEvent} event
 */
const checkTrackPad = (event) => {
  // DeltaY is generally 100 or 120 for mice.
  if ([100, 120].includes(event.deltaY)) return false;
  // DeltaY will be multiplied by the zoom level.
  // While the user should not be zoomed in, this is accounted for here as a safeguard.
  // The `window.devicePixelRatio` value is generally the zoom level.
  // The known exceptions are:
  // For high-density (e.g. Retina) displays, `window.devicePixelRatio` is 2, but the zoom level is 1.
  // For Safari, this is bugged and `window.devicePixelRatio` does not scale with zooming.
  // https://bugs.webkit.org/show_bug.cgi?id=124862
  if ([100, 120].includes(Math.abs(Math.round(event.deltaY * window.devicePixelRatio * 1e5) / 1e5))) return false;

  // If delta is an integer, it is likely from a mouse.
  if (Math.round(event.deltaY) === event.deltaY) return false;

  // If none of the above conditions were met, it is likely from a track pad.
  return true;
};

// Function to handle wheel event
/**
 * Handles the wheel event to scroll the layer vertically.
 * @param {WheelEvent} event - The wheel event from the user's mouse.
 */
const handleWheel = (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.ctrlKey) { // Zoom in or out
    // Track pads report precise zoom values (many digits after the decimal) while mouses only move in fixed (integer) intervals.
    const trackPadMode = checkTrackPad(event);

    let delta = event.deltaY;

    // If `deltaMode` is `1` (less common), units are in lines rather than pixels.
    if (event.deltaMode === 1) delta *= 10;

    // Zoom by a greater amount for track pads.
    // Without this code, zooming would be extremely slow.
    if (trackPadMode) {
      delta *= 7;
      // Cap at the equivalent of ~6 scrolls of a scroll wheel.
      delta = Math.min(600, Math.max(-720, delta));
    }

    let scaleBy = 0.999 ** delta;
    if (scaleBy > 1.1) scaleBy = 1.1;
    if (scaleBy < 0.9) scaleBy = 0.9;

    zoomAllLayers(scaleBy, stage.getPointerPosition());
    destroyControls();
  } else { // Scroll vertically
    destroyControls();
    panAllLayers({ deltaX: event.deltaX * -1, deltaY: event.deltaY * -1 });
  }
};

/**
 *
 * @param {InstanceType<typeof Konva.Layer>} layer
 * @returns {{x: number, y: number}}
 */
const getLayerCenter = (layer) => {
  const layerWidth = layer.width();
  const layerHeight = layer.height();

  // Calculate the center point of the layer before any transformations
  const centerPoint = {
    x: layerWidth / 2,
    y: layerHeight / 2,
  };

  // Get the absolute transformation matrix for the layer
  const transform = layer.getAbsoluteTransform();

  // Apply the transformation to the center point
  const transformedCenter = transform.point(centerPoint);

  return transformedCenter;
};

/**
 *
 * @param {InstanceType<typeof Konva.Layer>} layer
 * @param {number} scaleBy
 * @param {?{x: number, y: number}} [center=null] - The center point to zoom in/out from.
 *    If `null` (default), the center of the layer is used.
 */
const zoomLayer = (layer, scaleBy, center = null) => {
  const oldScale = layer.scaleX();
  center = center || getLayerCenter(layer);

  const mousePointTo = {
    x: (center.x - layer.x()) / oldScale,
    y: (center.y - layer.y()) / oldScale,
  };

  const newScale = oldScale * scaleBy;

  layer.scaleX(newScale);
  layer.scaleY(newScale);

  const newPos = {
    x: center.x - mousePointTo.x * newScale,
    y: center.y - mousePointTo.y * newScale,
  };

  layer.position(newPos);
  layer.batchDraw();
};

/**
 *
 * @param {number} scaleBy
 * @param {?{x: number, y: number}} [center=null] - The center point to zoom in/out from.
 *    If `null` (default), the center of the layer is used.
 */
const zoomAllLayers = (scaleBy, center = null) => {
  zoomLayer(layerText, scaleBy, center);
  zoomLayer(layerBackground, scaleBy, center);
  zoomLayer(layerOverlay, scaleBy, center);
};

/**
 *
 * @param {Object} coords
 * @param {number} [coords.deltaX=0]
 * @param {number} [coords.deltaY=0]
 */
const panAllLayers = ({ deltaX = 0, deltaY = 0 }) => {
  layerText.x(layerText.x() + deltaX);
  layerText.y(layerText.y() + deltaY);
  layerBackground.x(layerBackground.x() + deltaX);
  layerBackground.y(layerBackground.y() + deltaY);
  layerOverlay.x(layerOverlay.x() + deltaX);
  layerOverlay.y(layerOverlay.y() + deltaY);

  layerText.batchDraw();
  layerBackground.batchDraw();
  layerOverlay.batchDraw();
};

// Listen for wheel events on the stage
stage.on('wheel', (event) => {
  handleWheel(event.evt);
});

/**
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<MouseEvent>} KonvaMouseEvent
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<TouchEvent>} KonvaTouchEvent
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<WheelEvent>} KonvaWheelEvent
 */

/**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {KonvaMouseEvent} event
 */
const startDrag = (event) => {
  canvasObj.drag.isDragging = true;
  canvasObj.drag.lastX = event.evt.x;
  canvasObj.drag.lastY = event.evt.y;
  event.evt.preventDefault();
};

function getCenter(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {KonvaTouchEvent} event
 */
const startDragTouch = (event) => {
  canvasObj.drag.isDragging = true;
  canvasObj.drag.lastX = event.evt.touches[0].clientX;
  canvasObj.drag.lastY = event.evt.touches[0].clientY;
  event.evt.preventDefault();
};

/**
 * Updates the layer's position based on mouse movement.
 * @param {KonvaMouseEvent} event
 */
const executeDrag = (event) => {
  if (canvasObj.drag.isDragging) {
    const deltaX = event.evt.x - canvasObj.drag.lastX;
    const deltaY = event.evt.y - canvasObj.drag.lastY;

    if (Math.round(deltaX) === 0 && Math.round(deltaY) === 0) return;

    // This is an imprecise heuristic, so not bothering to calculate distance properly.
    canvasObj.drag.dragDeltaTotal += Math.abs(deltaX);
    canvasObj.drag.dragDeltaTotal += Math.abs(deltaY);

    canvasObj.drag.lastX = event.evt.x;
    canvasObj.drag.lastY = event.evt.y;

    panAllLayers({ deltaX, deltaY });
  }
};

/**
 * @param {KonvaTouchEvent} event
 */
const executeDragTouch = (event) => {
  if (canvasObj.drag.isDragging) {
    const deltaX = event.evt.touches[0].clientX - canvasObj.drag.lastX;
    const deltaY = event.evt.touches[0].clientY - canvasObj.drag.lastY;
    canvasObj.drag.lastX = event.evt.touches[0].clientX;
    canvasObj.drag.lastY = event.evt.touches[0].clientY;

    panAllLayers({ deltaX, deltaY });
  }
};

/**
 * @param {KonvaTouchEvent} event
 */
const executePinchTouch = (event) => {
  const touch1 = event.evt.touches[0];
  const touch2 = event.evt.touches[1];
  if (!touch1 || !touch2) return;
  canvasObj.drag.isPinching = true;
  const p1 = {
    x: touch1.clientX,
    y: touch1.clientY,
  };
  const p2 = {
    x: touch2.clientX,
    y: touch2.clientY,
  };

  const center = getCenter(p1, p2);
  const dist = getDistance(p1, p2);

  if (!canvasObj.drag.lastDist || !canvasObj.drag.lastCenter) {
    canvasObj.drag.lastCenter = center;
    canvasObj.drag.lastDist = dist;
    return;
  }

  zoomAllLayers(dist / canvasObj.drag.lastDist, center);
  canvasObj.drag.lastDist = dist;
};

/**
 * Stops dragging when the mouse button is released.
 * @param {KonvaMouseEvent|KonvaTouchEvent} event
 */
const stopDragPinch = (event) => {
  canvasObj.drag.isDragging = false;
  canvasObj.drag.isPinching = false;
  canvasObj.drag.dragDeltaTotal = 0;
  canvasObj.drag.lastCenter = null;
  canvasObj.drag.lastDist = null;
};

// Event listeners for mouse interactions
stage.on('mousedown', (event) => {
  if (event.evt.button === 1) { // Middle mouse button
    startDrag(event);
  }
});
stage.on('mousemove', executeDrag);

stage.on('touchstart', (event) => {
  if (canvasObj.mode === 'select') {
    if (event.evt.touches[1]) {
      executePinchTouch(event);
    } else {
      startDragTouch(event);
    }
  }
});

stage.on('touchmove', (event) => {
  if (event.evt.touches[1]) {
    executePinchTouch(event);
  } else if (canvasObj.drag.isDragging) {
    executeDragTouch(event);
  }
});

/**
 * Adjusts the layer's scale based on key press combinations for zooming in and out.
 * @param {KeyboardEvent} event - The key down event.
 */
const handleZoom = (event) => {
  if (event.ctrlKey) {
    if (['+', '='].includes(event.key)) {
      zoomAllLayers(1.1, getLayerCenter(layerText));
    } else if (['-', '_'].includes(event.key)) {
      zoomAllLayers(0.9, getLayerCenter(layerText));
    } else {
      return; // Ignore other keys
    }

    layerText.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
  }
};

document.addEventListener('keydown', handleZoom);

zoomInElem.addEventListener('click', () => {
  zoomAllLayers(1.1, getLayerCenter(layerText));
});

zoomOutElem.addEventListener('click', () => {
  zoomAllLayers(0.9, getLayerCenter(layerText));
});

/**
 * @returns {Array<KonvaOcrWord>}
 */
export const getCanvasWords = () => layerText.children.filter((obj) => obj instanceof KonvaOcrWord);

/**
 * @returns {Array<KonvaLayout>}
 */
export const getCanvasLayoutBoxes = () => layerOverlay.children.filter((obj) => obj instanceof KonvaLayout);

export const destroyWords = () => {
  // Any time words are destroyed, controls must be destroyed as well.
  // If this does not happen controls will have references to destroyed words, which causes errors to be thrown.
  destroyControls();

  getCanvasWords().forEach((obj) => obj.destroy());

  destroyLineOutlines();
};

const debugCanvasParentDivElem = /** @type {HTMLDivElement} */ (document.getElementById('debugCanvasParentDiv'));

let widthHeightInitial = true;
/**
 *
 * @param {dims} imgDims - Dimensions of image
 */
export const setCanvasWidthHeightZoom = (imgDims, enableConflictsViewer = false) => {
  const totalHeight = enableConflictsViewer ? Math.round(document.documentElement.clientHeight * 0.7) - 1 : document.documentElement.clientHeight;

  // Re-set width/height, in case the size of the window changed since originally set.
  stage.height(totalHeight);
  stage.width(document.documentElement.clientWidth);

  // The first time this function is run, the canvas is centered and zoomed to fit the image.
  // After that, whatever the user does with the canvas is preserved.
  if (widthHeightInitial) {
    widthHeightInitial = false;
    const interfaceHeight = 100;
    const bottomMarginHeight = 50;
    const targetHeight = totalHeight - interfaceHeight - bottomMarginHeight;

    const zoom = targetHeight / imgDims.height;

    layerText.scaleX(zoom);
    layerText.scaleY(zoom);
    layerBackground.scaleX(zoom);
    layerBackground.scaleY(zoom);
    layerOverlay.scaleX(zoom);
    layerOverlay.scaleY(zoom);

    layerText.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerText.y(interfaceHeight);
    layerBackground.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerBackground.y(interfaceHeight);
    layerOverlay.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerOverlay.y(interfaceHeight);
  } else {
    const left = layerText.x();
    const top = layerText.y();
    const scale = layerText.scaleX();
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    // Nudge the document into the viewport, using the lesser of:
    // (1) the shift required to put 50% of the document into view, or
    // (2) the shift required to fill 50% of the viewport.
    // Both conditions are necessary for this to work as expected at all zoom levels.
    if (left < imgDims.width * scale * -0.5
    && left < (stageWidth / 2 - (imgDims.width * scale))) {
      const newX = Math.min(imgDims.width * scale * -0.5, stageWidth / 2 - (imgDims.width * scale));
      layerText.x(newX);
      layerBackground.x(newX);
      layerOverlay.x(newX);
    } else if (left > stageWidth - (imgDims.width * scale * 0.5)
    && left > stageWidth / 2) {
      const newX = Math.max(stageWidth - (imgDims.width * scale * 0.5), stageWidth / 2);
      layerText.x(newX);
      layerBackground.x(newX);
      layerOverlay.x(newX);
    }

    if (top < imgDims.height * scale * -0.5
      && top < (stageHeight / 2 - (imgDims.height * scale))) {
      const newY = Math.min(imgDims.height * scale * -0.5, stageHeight / 2 - (imgDims.height * scale));
      layerText.y(newY);
      layerBackground.y(newY);
      layerOverlay.y(newY);
    } else if (top > stageHeight - (imgDims.height * scale * 0.5)
      && top > stageHeight / 2) {
      const newY = Math.max(stageHeight - (imgDims.height * scale * 0.5), stageHeight / 2);
      layerText.y(newY);
      layerBackground.y(newY);
      layerOverlay.y(newY);
    }
  }

  if (enableConflictsViewer) {
    const debugHeight = Math.round(document.documentElement.clientHeight * 0.3);

    debugCanvasParentDivElem.setAttribute('style', `width:${document.documentElement.clientWidth}px;height:${debugHeight}px;overflow-y:scroll;z-index:10`);
  } else {
    showHideElem(debugCanvasParentDivElem, false);
  }
};

/**
 *
 * @param {OcrPage} page
 */
export function renderPage(page) {
  const matchIdArr = ocr.getMatchingWordIds(search.search, ocrAll.active[cp.n]);

  const angle = pageMetricsArr[cp.n].angle || 0;

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

      const wordDropCap = wordObj.dropcap;

      const confThreshHigh = confThreshHighElem.value !== '' ? parseInt(confThreshHighElem.value) : 85;

      const displayMode = displayModeElem.value;

      const outlineWord = outlineWordsElem.checked || displayMode === 'eval' && wordObj.conf > confThreshHigh && !wordObj.matchTruth;

      const angleAdjWord = enableRotation ? ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

      let visualBaseline;
      if (enableRotation) {
        visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;
      } else {
        visualBaseline = linebox.bottom + baseline[1] + baseline[0] * (box.left - linebox.left);
      }

      let top = visualBaseline;
      if (wordObj.sup || wordDropCap) top = box.bottom + angleAdjLine.y + angleAdjWord.y;

      const visualLeft = box.left + angleAdjLine.x + angleAdjWord.x;

      const wordCanvas = new KonvaOcrWord({
        visualLeft,
        yActual: top,
        topBaseline: visualBaseline,
        rotation: angleArg,
        word: wordObj,
        outline: outlineWord,
        fillBox: matchIdArr.includes(wordObj.id),
      });

      // Add the text node to the given layer
      layerText.add(wordCanvas);
    }
  }

  updateDataPreview();
}

export {
  stage, layerText, layerBackground, layerOverlay,
};
