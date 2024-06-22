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
  deleteLayoutBoxClick, splitDataTable,
  deleteLayoutDataTableClick, checkDataTablesAdjacent, mergeDataTables,
  KonvaDataColumn,
} from './interfaceLayout.js';
import { cp, search } from '../../main.js';
import { ocrAll, pageMetricsArr } from '../containers/miscContainer.js';
import { calcTableBbox } from '../objects/layoutObjects.js';

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

const selectingRectangle = new Konva.Rect({
  fill: 'rgba(40,123,181,0.5)',
  visible: true,
  // disable events to not interrupt with events
  listening: false,
});

layerText.add(selectingRectangle);

/**
 * Class for managing the selection of words, layout boxes, and data columns on the canvas.
 * This is a class due to JSDoc type considerations. All methods and properties are static.
 */
class CanvasSelection {
  /** @type {Array<KonvaOcrWord>} */
  static _selectedWordArr = [];

  /** @type {Array<KonvaLayout>} */
  static _selectedLayoutBoxArr = [];

  /** @type {Array<import('./interfaceLayout.js').KonvaDataColumn>} */
  static _selectedDataColumnArr = [];

  static getKonvaWords = () => CanvasSelection._selectedWordArr;

  static getKonvaLayoutBoxes = () => CanvasSelection._selectedLayoutBoxArr;

  static getKonvaDataColumns = () => CanvasSelection._selectedDataColumnArr;

  static getKonvaWordsCopy = () => CanvasSelection._selectedWordArr.slice();

  static getKonvaLayoutBoxesCopy = () => CanvasSelection._selectedLayoutBoxArr.slice();

  static getKonvaDataColumnsCopy = () => CanvasSelection._selectedDataColumnArr.slice();

  /**
   * Gets the distinct data tables associated with the selected data columuns.
   * @returns {Array<import('./interfaceLayout.js').KonvaDataTable>}
   */
  static getKonvaDataTables = () => {
    const selectedDataTableIdArr = [...new Set(CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.table.id))];
    // eslint-disable-next-line no-use-before-define
    return CanvasObjs.layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
      const boxA = calcTableBbox(a.layoutDataTable);
      const boxB = calcTableBbox(b.layoutDataTable);
      return boxA.left - boxB.left;
    });
  };

  /**
   * Gets the distinct data tables associated with the selected data columuns.
   */
  static getDataTables = () => {
    const selectedDataTableIdArr = [...new Set(CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.table.id))];
    // eslint-disable-next-line no-use-before-define
    return CanvasObjs.layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
      const boxA = calcTableBbox(a.layoutDataTable);
      const boxB = calcTableBbox(b.layoutDataTable);
      return boxA.left - boxB.left;
    }).map((x) => x.layoutDataTable);
  };

  /**
   * Add word or array of words to the current selection.
   * Ignores words that are already selected.
   * @param {KonvaOcrWord|Array<KonvaOcrWord>} words
   */
  static addWords = (words) => {
    if (!Array.isArray(words)) words = [words];
    words.forEach((wordI) => {
      if (!CanvasSelection._selectedWordArr.map((x) => x.id).includes(wordI.id)) {
        CanvasSelection._selectedWordArr.push(wordI);
      }
    });
  };

  /**
   * Add layout boxes, including both regions and data columns, to the current selection.
   * Ignores boxes that are already selected.
   * @param {Array<import('./interfaceLayout.js').KonvaLayout>|import('./interfaceLayout.js').KonvaLayout|
   * Array<import('./interfaceLayout.js').KonvaLayout>|import('./interfaceLayout.js').KonvaLayout} konvaLayoutBoxes
   */
  static addKonvaLayoutBoxes = (konvaLayoutBoxes) => {
    if (!Array.isArray(konvaLayoutBoxes)) konvaLayoutBoxes = [konvaLayoutBoxes];
    konvaLayoutBoxes.forEach((konvaLayoutBox) => {
      if (konvaLayoutBox instanceof KonvaDataColumn) {
        if (!CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.id).includes(konvaLayoutBox.layoutBox.id)) {
          CanvasSelection._selectedDataColumnArr.push(konvaLayoutBox);
        }
      } else if (!CanvasSelection._selectedLayoutBoxArr.map((x) => x.layoutBox.id).includes(konvaLayoutBox.layoutBox.id)) {
        CanvasSelection._selectedLayoutBoxArr.push(konvaLayoutBox);
      }
    });
    // Other code assumes that these arrays are sorted left to right.
    CanvasSelection._selectedDataColumnArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
    CanvasSelection._selectedLayoutBoxArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
  };

  /**
   * Get arrays of distinct font families and font sizes from the selected words.
   */
  static getWordProperties = () => {
    const fontFamilyArr = Array.from(new Set(CanvasSelection._selectedWordArr.map((x) => (x.fontFamilyLookup))));
    const fontSizeArr = Array.from(new Set(CanvasSelection._selectedWordArr.map((x) => (x.fontSize))));
    return { fontFamilyArr, fontSizeArr };
  };

  /**
   * Get arrays of distinct layout box properties from the selected layout boxes.
   * Includes both layout boxes and data columns.
   */
  static getLayoutBoxProperties = () => {
    const selectedWordsAll = [...CanvasSelection._selectedLayoutBoxArr, ...CanvasSelection._selectedDataColumnArr];
    const inclusionRuleArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionRule))));
    const inclusionLevelArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionLevel))));
    return { inclusionRuleArr, inclusionLevelArr };
  };

  static deselectAllWords = () => {
    CanvasSelection._selectedWordArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedWordArr.length = 0;
  };

  static deselectAllLayoutBoxes = () => {
    CanvasSelection._selectedLayoutBoxArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedLayoutBoxArr.length = 0;
  };

  static deselectAllDataColumns = () => {
    CanvasSelection._selectedDataColumnArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedDataColumnArr.length = 0;
  };

  static deselectAll = () => {
    CanvasSelection.deselectAllWords();
    CanvasSelection.deselectAllLayoutBoxes();
    CanvasSelection.deselectAllDataColumns();
  };

  /**
   *
   * @param {string|Array<string>} ids
   */
  static deselectDataColumnsByIds = (ids) => {
    if (!Array.isArray(ids)) ids = [ids];
    for (let j = 0; j < CanvasSelection._selectedDataColumnArr.length; j++) {
      if (ids.includes(CanvasSelection._selectedDataColumnArr[j].layoutBox.id)) {
        CanvasSelection._selectedDataColumnArr.splice(j, 1);
        j--;
      }
    }
  };
}

/**
 * Class for managing the selection of words, layout boxes, and data columns on the canvas.
 * This is a class due to JSDoc type considerations. All methods and properties are static.
 */
export class CanvasObjs {
  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  static controlArr = [];

  /** @type {Array<InstanceType<typeof Konva.Rect>>} */
  static lineOutlineArr = [];

  /** @type {Array<KonvaLayout>} */
  static layoutBoxArr = [];

  /** @type {Array<import('./interfaceLayout.js').KonvaDataTable>} */
  static layoutDataTableArr = [];

  /** @type {?HTMLSpanElement} */
  static input = null;

  /** @type {?Function} */
  static inputRemove = null;

  static selectingRectangle = selectingRectangle;

  static selecting = false;

  static CanvasSelection = CanvasSelection;

  /** @type {bbox} */
  static bbox = {
    top: 0, left: 0, right: 0, bottom: 0,
  };

  /** @type {('select'|'addWord'|'recognizeWord'|'recognizeArea'|'printCoords'|'addLayoutBoxOrder'|'addLayoutBoxExclude'|'addLayoutBoxDataTable')} */
  static mode = 'select';

  static isTouchScreen = navigator?.maxTouchPoints > 0;

  static drag = {
    isPinching: false,
    isDragging: false,
    dragDeltaTotal: 0,
    lastX: 0,
    lastY: 0,
    /** @type {?{x: number, y: number}} */
    lastCenter: null,
    /** @type {?number} */
    lastDist: null,
  };

  /**
   *
   * @param {boolean} [deselect=true] - Deselect all words, layout boxes, and data columns.
   */
  static destroyControls = (deselect = true) => {
    globalThis.collapseRangeCollapse.hide();
    CanvasObjs.controlArr.forEach((control) => control.destroy());
    CanvasObjs.controlArr.length = 0;

    if (deselect) CanvasObjs.CanvasSelection.deselectAll();

    if (CanvasObjs.input && CanvasObjs.input.parentElement && CanvasObjs.inputRemove) CanvasObjs.inputRemove();
  };

  static destroyLineOutlines = () => {
    CanvasObjs.lineOutlineArr.forEach((x) => x.destroy());
    CanvasObjs.lineOutlineArr.length = 0;
  };

  static destroyLayoutDataTables = () => {
    CanvasObjs.layoutDataTableArr.forEach((x) => x.destroy());
    CanvasObjs.layoutDataTableArr.length = 0;
    CanvasObjs.CanvasSelection.deselectAllDataColumns();
  };

  static destroyLayoutBoxes = () => {
    CanvasObjs.layoutBoxArr.forEach((x) => x.destroy());
    CanvasObjs.layoutBoxArr.length = 0;
    CanvasObjs.destroyLayoutDataTables();
    CanvasObjs.CanvasSelection.deselectAllLayoutBoxes();
  };

  /**
   *
   * @param {string|Array<string>} ids
   */
  static destroyLayoutDataTablesById = (ids) => {
    if (!Array.isArray(ids)) ids = [ids];
    for (let j = 0; j < CanvasObjs.layoutDataTableArr.length; j++) {
      if (ids.includes(CanvasObjs.layoutDataTableArr[j].layoutDataTable.id)) {
        CanvasObjs.layoutDataTableArr[j].destroy();
        CanvasObjs.layoutDataTableArr.splice(j, 1);
        j--;
      }
    }
  };
}

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
  mergeButton.id = 'contextMenuMergeColumnsButton';
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

  const mergeTablesButton = document.createElement('button');
  mergeTablesButton.id = 'contextMenuMergeTablesButton';
  mergeTablesButton.textContent = 'Merge Tables';
  mergeTablesButton.style.display = 'none';
  mergeTablesButton.addEventListener('click', mergeDataTablesClick);

  const splitTableButton = document.createElement('button');
  splitTableButton.id = 'contextMenuSplitTableButton';
  splitTableButton.textContent = 'New Table from Columns';
  splitTableButton.style.display = 'none';
  splitTableButton.addEventListener('click', splitDataTableClick);

  innerDiv.appendChild(splitButton);
  innerDiv.appendChild(mergeButton);
  innerDiv.appendChild(deleteLayoutButton);
  innerDiv.appendChild(deleteTableButton);
  innerDiv.appendChild(mergeTablesButton);
  innerDiv.appendChild(splitTableButton);

  menuDiv.appendChild(innerDiv);

  return menuDiv;
};

const mergeDataColumnsClick = () => {
  hideContextMenu();
  mergeDataColumns(CanvasObjs.CanvasSelection.getKonvaDataColumns());
  CanvasObjs.destroyControls();
};

const mergeDataTablesClick = () => {
  hideContextMenu();
  const dataTableArr = CanvasObjs.CanvasSelection.getDataTables();
  mergeDataTables(dataTableArr);
  CanvasObjs.destroyControls();
};

const splitDataColumnClick = () => {
  hideContextMenu();
  const ptr = layerOverlay.getRelativePointerPosition();
  if (!ptr) return;
  const selectedColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();
  splitDataColumn(selectedColumns[0], ptr.x);
  CanvasObjs.destroyControls();
};

const splitDataTableClick = () => {
  hideContextMenu();
  splitDataTable(CanvasObjs.CanvasSelection.getKonvaDataColumns());
  CanvasObjs.destroyControls();
};

const menuNode = createContextMenuHTML();
document.body.appendChild(menuNode);

const contextMenuMergeColumnsButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeColumnsButton'));
const contextMenuSplitColumnButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitColumnButton'));
const contextMenuDeleteLayoutBoxButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteLayoutBoxButton'));
const contextMenuDeleteTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteTableButton'));
const contextMenuMergeTablesButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeTablesButton'));
const contextMenuSplitTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitTableButton'));

export const hideContextMenu = () => {
  contextMenuMergeColumnsButtonElem.style.display = 'none';
  contextMenuSplitColumnButtonElem.style.display = 'none';
  contextMenuDeleteLayoutBoxButtonElem.style.display = 'none';
  contextMenuDeleteTableButtonElem.style.display = 'none';
  contextMenuMergeTablesButtonElem.style.display = 'none';
  contextMenuSplitTableButtonElem.style.display = 'none';
  menuNode.style.display = 'none';
};

const style = document.createElement('style');

// Add CSS rules to the style element
style.textContent = `
  #menu {
    display: none;
    position: absolute;
    width: min-content;
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

  const selectedColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();

  if (e.target === stage || (selectedColumns.length === 0 && selectedLayoutBoxes.length === 0)) {
    // if we are on empty place of the stage we will do nothing
    return;
  }

  const selectedTables = CanvasObjs.CanvasSelection.getDataTables();

  let enableMergeTables = false;
  let enableMergeColumns = false;
  let enableSplit = false;
  let enableDelete = false;
  let enableDeleteTable = false;
  let enableSplitTable = false;

  if (selectedTables.length === 1) {
  // The "Merge Columns" button will be enabled if multiple adjacent columns are selected.
    const adjacentColumns = checkDataColumnsAdjacent(selectedColumns);
    if (selectedColumns.length > 1 && adjacentColumns) enableMergeColumns = true;
    if (selectedColumns.length === 1) enableSplit = true;
    if (selectedLayoutBoxes.length > 0) enableDelete = true;
    if (selectedColumns.length > 0 && adjacentColumns) enableSplitTable = true;
    if (selectedColumns.length > 0 && selectedColumns.length === selectedColumns[0].konvaTable.columns.length) enableDeleteTable = true;
  } else if (selectedTables.length > 1 && checkDataTablesAdjacent(selectedTables)) enableMergeTables = true;

  if (!(enableMergeColumns || enableSplit || enableDelete || enableDeleteTable || enableMergeTables || enableSplitTable)) return;

  if (enableMergeColumns) {
    contextMenuMergeColumnsButtonElem.style.display = 'initial';
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
  if (enableMergeTables) {
    contextMenuMergeTablesButtonElem.style.display = 'initial';
  }
  if (enableMergeTables) {
    contextMenuMergeTablesButtonElem.style.display = 'initial';
  }
  if (enableSplitTable) {
    contextMenuSplitTableButtonElem.style.display = 'initial';
  }

  e.evt.preventDefault();

  menuNode.style.display = 'initial';
  const containerRect = stage.container().getBoundingClientRect();
  menuNode.style.top = `${containerRect.top + stage.getPointerPosition().y + 4}px`;
  menuNode.style.left = `${containerRect.left + stage.getPointerPosition().x + 4}px`;
});

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

    // const scaleX = word.dropcap ? ((word.bbox.right - word.bbox.left) / visualWidth) : 1;

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

    if (CanvasObjs.input && CanvasObjs.input.parentElement && CanvasObjs.inputRemove) CanvasObjs.inputRemove();

    CanvasObjs.input = document.createElement('span');

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

    CanvasObjs.input.style.position = 'absolute';
    CanvasObjs.input.style.left = `${x1}px`;
    CanvasObjs.input.style.top = `${y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6}px`; // Align with baseline
    CanvasObjs.input.style.fontSize = `${fontSizeHTML}px`;
    CanvasObjs.input.style.fontFamily = itext.fontFaceName;

    // We cannot make the text uppercase in the input field, as this would result in the text being saved as uppercase.
    // Additionally, while there is a small-caps CSS property, it does not allow for customizing the size of the small caps.
    // Therefore, we handle small caps by making all text print as uppercase using the `text-transform` CSS property,
    // and then wrapping each letter in a span with a smaller font size.
    if (itext.fontStyle === 'smallCaps') {
      CanvasObjs.input.style.textTransform = 'uppercase';
      CanvasObjs.input.innerHTML = text.replace(/[a-z]+/g, (matched) => `<span class="input-sub" style="font-size:${fontSizeHTMLSmallCaps}px">${matched}</span>`);
    } else {
      CanvasObjs.input.textContent = text;
    }

    CanvasObjs.input.style.letterSpacing = `${charSpacingHTML}px`;
    CanvasObjs.input.style.color = itext.fill();
    CanvasObjs.input.style.opacity = String(itext.opacity());
    CanvasObjs.input.style.fontStyle = itext.fontFaceStyle;
    CanvasObjs.input.style.fontWeight = itext.fontFaceWeight;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    CanvasObjs.input.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;
    CanvasObjs.input.contentEditable = 'true';

    // Prevent line breaks and hide overflow
    CanvasObjs.input.style.whiteSpace = 'nowrap';
    // CanvasObjs.input.style.overflow = 'hidden';

    if (itext.fontStyle === 'smallCaps') {
      CanvasObjs.input.oninput = () => {
        const index = getCursorIndex();
        CanvasObjs.input.innerHTML = CanvasObjs.input.textContent.replace(/[a-z]+/g, (matched) => `<span class="input-sub" style="font-size:${fontSizeHTMLSmallCaps}px">${matched}</span>`);
        setCursor(index);
      };
    }

    CanvasObjs.inputRemove = () => {
      if (!CanvasObjs.input) return;

      const textNew = ocr.replaceLigatures(CanvasObjs.input.textContent || '').trim();

      // Words are not allowed to be empty
      if (textNew) {
        itext.word.text = textNew;
        itext.editTextCallback(itext);
      }
      updateWordCanvas(itext);
      CanvasObjs.input.remove();
      CanvasObjs.input = null;
      CanvasObjs.inputRemove = null;
    };

    // Update the Konva Text node after editing
    CanvasObjs.input.addEventListener('blur', () => (CanvasObjs.inputRemove));

    document.body.appendChild(CanvasObjs.input);

    CanvasObjs.input.focus();

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

    /**
     * Set cursor position to `index` within the input.
     * @param {number} index
     */
    const setCursor = (index) => {
      if (!CanvasObjs.input) {
        console.error('Input element not found');
        return;
      }
      const range = document.createRange();
      const sel = /** @type {Selection} */ (window.getSelection());

      let letterI = 0;
      for (let i = 0; i < CanvasObjs.input.childNodes.length; i++) {
        const node = CanvasObjs.input.childNodes[i];
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
   * Update the UI to reflect the properties of selected words.
   * This should be called when any word is selected, after adding them to the selection.
   */
  static updateUI = () => {
    const wordFirst = CanvasObjs.CanvasSelection.getKonvaWords()[0];

    if (!wordFirst) return;

    const { fontFamilyArr, fontSizeArr } = CanvasObjs.CanvasSelection.getWordProperties();

    if (fontFamilyArr.length === 1) {
      wordFontElem.value = String(wordFirst.fontFamilyLookup);
    } else {
      wordFontElem.value = '';
    }

    if (fontSizeArr.length === 1) {
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
    CanvasObjs.controlArr.push(trans);
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

  const newSelectedWords = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));
  CanvasObjs.CanvasSelection.addWords(newSelectedWords);

  const selectedWords = CanvasObjs.CanvasSelection.getKonvaWords();

  if (selectedWords.length > 1) {
    selectedWords.forEach((shape) => (shape.select()));
  } else if (selectedWords.length === 1) {
    KonvaOcrWord.addControls(selectedWords[0]);
    KonvaOcrWord.updateUI();
  }
}

let clearSelectionStart = false;

stage.on('mousedown touchstart', (e) => {
  hideContextMenu();

  // Left click only
  if (e.evt.button !== 0) return;

  clearSelectionStart = e.target instanceof Konva.Stage || e.target instanceof Konva.Image;

  if (CanvasObjs.isTouchScreen && CanvasObjs.mode === 'select') return;

  // Move selection rectangle to top.
  selectingRectangle.zIndex(layerText.children.length - 1);

  e.evt.preventDefault();
  const startCoords = layerText.getRelativePointerPosition() || { x: 0, y: 0 };
  CanvasObjs.bbox.left = startCoords.x;
  CanvasObjs.bbox.top = startCoords.y;
  CanvasObjs.bbox.right = startCoords.x;
  CanvasObjs.bbox.bottom = startCoords.y;

  selectingRectangle.width(0);
  selectingRectangle.height(0);
  CanvasObjs.selecting = true;
});

stage.on('mousemove touchmove', (e) => {
  // do nothing if we didn't start selection
  if (!CanvasObjs.selecting) {
    return;
  }
  e.evt.preventDefault();
  const endCoords = layerText.getRelativePointerPosition();
  if (!endCoords) return;

  CanvasObjs.bbox.right = endCoords.x;
  CanvasObjs.bbox.bottom = endCoords.y;

  selectingRectangle.setAttrs({
    visible: true,
    x: Math.min(CanvasObjs.bbox.left, CanvasObjs.bbox.right),
    y: Math.min(CanvasObjs.bbox.top, CanvasObjs.bbox.bottom),
    width: Math.abs(CanvasObjs.bbox.right - CanvasObjs.bbox.left),
    height: Math.abs(CanvasObjs.bbox.bottom - CanvasObjs.bbox.top),
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
  if (clearSelectionStart && (CanvasObjs.selecting || event.target instanceof Konva.Stage || event.target instanceof Konva.Image)) CanvasObjs.destroyControls();

  CanvasObjs.selecting = false;

  // Return early if this was a drag or pinch rather than a selection.
  // `isDragging` will be true even for a touch event, so a minimum distance moved is required to differentiate between a click and a drag.
  if (event.evt.button === 1 || (CanvasObjs.drag.isDragging && CanvasObjs.drag.dragDeltaTotal > 10) || CanvasObjs.drag.isPinching) {
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
    const selectedColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();
    const layoutBoxes = selectedColumns.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));
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
    if (CanvasObjs.mode === 'select' && !globalThis.layoutMode) {
      CanvasObjs.destroyControls(!event.evt.ctrlKey);
      selectWords(box);
      KonvaOcrWord.updateUI();
      layerText.batchDraw();
    } else if (CanvasObjs.mode === 'select' && globalThis.layoutMode) {
      CanvasObjs.destroyControls(!event.evt.ctrlKey);
      selectLayoutBoxesArea(box);
      KonvaLayout.updateUI();
      layerOverlay.batchDraw();
    }
    return;
  }

  // update visibility in timeout, so we can check it in click event
  selectingRectangle.visible(false);

  if (CanvasObjs.mode === 'select' && !globalThis.layoutMode) {
    CanvasObjs.destroyControls(!event.evt.ctrlKey);
    const box = selectingRectangle.getClientRect();
    selectWords(box);
    KonvaOcrWord.updateUI();
  } else if (CanvasObjs.mode === 'select' && globalThis.layoutMode) {
    CanvasObjs.destroyControls(!event.evt.ctrlKey);
    const box = selectingRectangle.getClientRect();
    selectLayoutBoxesArea(box);
    KonvaLayout.updateUI();
  } else if (CanvasObjs.mode === 'addWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addWordManual(box);
  } else if (CanvasObjs.mode === 'recognizeWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, true, false);
  } else if (CanvasObjs.mode === 'recognizeArea') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, false);
  } else if (CanvasObjs.mode === 'printCoords') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, true);
  } else if (CanvasObjs.mode === 'addLayoutBoxOrder') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'order');
  } else if (CanvasObjs.mode === 'addLayoutBoxExclude') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'exclude');
  } else if (CanvasObjs.mode === 'addLayoutBoxDataTable') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutDataTableClick(box);
  }

  CanvasObjs.mode = 'select';

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
    CanvasObjs.destroyControls();
  } else { // Scroll vertically
    CanvasObjs.destroyControls();
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
  CanvasObjs.drag.isDragging = true;
  CanvasObjs.drag.lastX = event.evt.x;
  CanvasObjs.drag.lastY = event.evt.y;
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
  CanvasObjs.drag.isDragging = true;
  CanvasObjs.drag.lastX = event.evt.touches[0].clientX;
  CanvasObjs.drag.lastY = event.evt.touches[0].clientY;
  event.evt.preventDefault();
};

/**
 * Updates the layer's position based on mouse movement.
 * @param {KonvaMouseEvent} event
 */
const executeDrag = (event) => {
  if (CanvasObjs.drag.isDragging) {
    const deltaX = event.evt.x - CanvasObjs.drag.lastX;
    const deltaY = event.evt.y - CanvasObjs.drag.lastY;

    if (Math.round(deltaX) === 0 && Math.round(deltaY) === 0) return;

    // This is an imprecise heuristic, so not bothering to calculate distance properly.
    CanvasObjs.drag.dragDeltaTotal += Math.abs(deltaX);
    CanvasObjs.drag.dragDeltaTotal += Math.abs(deltaY);

    CanvasObjs.drag.lastX = event.evt.x;
    CanvasObjs.drag.lastY = event.evt.y;

    panAllLayers({ deltaX, deltaY });
  }
};

/**
 * @param {KonvaTouchEvent} event
 */
const executeDragTouch = (event) => {
  if (CanvasObjs.drag.isDragging) {
    const deltaX = event.evt.touches[0].clientX - CanvasObjs.drag.lastX;
    const deltaY = event.evt.touches[0].clientY - CanvasObjs.drag.lastY;
    CanvasObjs.drag.lastX = event.evt.touches[0].clientX;
    CanvasObjs.drag.lastY = event.evt.touches[0].clientY;

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
  CanvasObjs.drag.isPinching = true;
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

  if (!CanvasObjs.drag.lastDist || !CanvasObjs.drag.lastCenter) {
    CanvasObjs.drag.lastCenter = center;
    CanvasObjs.drag.lastDist = dist;
    return;
  }

  zoomAllLayers(dist / CanvasObjs.drag.lastDist, center);
  CanvasObjs.drag.lastDist = dist;
};

/**
 * Stops dragging when the mouse button is released.
 * @param {KonvaMouseEvent|KonvaTouchEvent} event
 */
const stopDragPinch = (event) => {
  CanvasObjs.drag.isDragging = false;
  CanvasObjs.drag.isPinching = false;
  CanvasObjs.drag.dragDeltaTotal = 0;
  CanvasObjs.drag.lastCenter = null;
  CanvasObjs.drag.lastDist = null;
};

// Event listeners for mouse interactions
stage.on('mousedown', (event) => {
  if (event.evt.button === 1) { // Middle mouse button
    startDrag(event);
  }
});
stage.on('mousemove', executeDrag);

stage.on('touchstart', (event) => {
  if (CanvasObjs.mode === 'select') {
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
  } else if (CanvasObjs.drag.isDragging) {
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
  CanvasObjs.destroyControls();

  getCanvasWords().forEach((obj) => obj.destroy());

  CanvasObjs.destroyLineOutlines();
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

  // Layout mode features assume that auto-rotate is enabled.
  const enableRotation = (autoRotateCheckboxElem.checked || globalThis.layoutMode) && Math.abs(angle ?? 0) > 0.05;

  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  for (const lineObj of page.lines) {
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = enableRotation ? ocr.calcLineStartAngleAdj(lineObj) : { x: 0, y: 0 };

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

      CanvasObjs.lineOutlineArr.push(lineRect);

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
