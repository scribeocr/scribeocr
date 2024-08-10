/* eslint-disable import/no-cycle */

import { opt, state } from '../js/containers/app.js';
import { ocrAll, pageMetricsArr } from '../js/containers/dataContainer.js';
import { fontAll } from '../js/containers/fontContainer.js';
import { calcTableBbox } from '../js/objects/layoutObjects.js';
import ocr from '../js/objects/ocrObjects.js';
import { calcWordMetrics } from '../js/utils/fontUtils.js';
import { replaceSmartQuotes } from '../js/utils/miscUtils.js';
import { assignParagraphs } from '../js/utils/reflowPars.js';
import { Button } from '../lib/bootstrap.esm.bundle.min.js';
import Konva from '../lib/konva/index.js';
import { search } from '../main.js';
import { elem } from './elems.js';
import {
  KonvaDataColumn,
  KonvaLayout,
} from './interfaceLayout.js';

const styleItalicButton = new Button(elem.edit.styleItalic);
const styleBoldButton = new Button(elem.edit.styleBold);
const styleSmallCapsButton = new Button(elem.edit.styleSmallCaps);
const styleSuperButton = new Button(elem.edit.styleSuper);

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
  static _selectedRegionArr = [];

  /** @type {Array<import('./interfaceLayout.js').KonvaDataColumn>} */
  static _selectedDataColumnArr = [];

  static getKonvaWords = () => CanvasSelection._selectedWordArr;

  static getKonvaRegions = () => CanvasSelection._selectedRegionArr;

  static getKonvaDataColumns = () => CanvasSelection._selectedDataColumnArr;

  static getKonvaWordsCopy = () => CanvasSelection._selectedWordArr.slice();

  static getKonvaRegionsCopy = () => CanvasSelection._selectedRegionArr.slice();

  static getKonvaDataColumnsCopy = () => CanvasSelection._selectedDataColumnArr.slice();

  static getKonvaLayoutBoxes = () => [...CanvasSelection._selectedRegionArr, ...CanvasSelection._selectedDataColumnArr];

  /**
   * Gets the distinct data tables associated with the selected data columuns.
   * @returns {Array<import('./interfaceLayout.js').KonvaDataTable>}
   */
  static getKonvaDataTables = () => {
    const selectedDataTableIdArr = [...new Set(CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.table.id))];
    // eslint-disable-next-line no-use-before-define
    return ScribeCanvas._layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
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
    return ScribeCanvas._layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
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
      if (!CanvasSelection._selectedWordArr.map((x) => x.word.id).includes(wordI.word.id)) {
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
      } else if (!CanvasSelection._selectedRegionArr.map((x) => x.layoutBox.id).includes(konvaLayoutBox.layoutBox.id)) {
        CanvasSelection._selectedRegionArr.push(konvaLayoutBox);
      }
    });
    // Other code assumes that these arrays are sorted left to right.
    CanvasSelection._selectedDataColumnArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
    CanvasSelection._selectedRegionArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
  };

  /**
 *
 * @param {Array<string>} layoutBoxIdArr
 */
  static selectLayoutBoxesById = (layoutBoxIdArr) => {
    // eslint-disable-next-line no-use-before-define
    const konvaLayoutBoxes = ScribeCanvas._layoutRegionArr.filter((x) => layoutBoxIdArr.includes(x.layoutBox.id));

    // eslint-disable-next-line no-use-before-define
    ScribeCanvas._layoutDataTableArr.forEach((table) => {
      table.columns.forEach((column) => {
        if (layoutBoxIdArr.includes(column.layoutBox.id)) konvaLayoutBoxes.push(column);
      });
    });

    CanvasSelection.selectLayoutBoxes(konvaLayoutBoxes);
  };

  /**
 *
 * @param {Array<KonvaLayout>} konvaLayoutBoxes
 */
  static selectLayoutBoxes = (konvaLayoutBoxes) => {
    // eslint-disable-next-line no-use-before-define
    const selectedLayoutBoxes = ScribeCanvas.CanvasSelection.getKonvaRegions();
    // eslint-disable-next-line no-use-before-define
    const selectedDataColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();

    // eslint-disable-next-line no-use-before-define
    ScribeCanvas.CanvasSelection.addKonvaLayoutBoxes(konvaLayoutBoxes);

    // Boxes can only be resized one at a time
    if (konvaLayoutBoxes.length === 1) KonvaLayout.addControls(konvaLayoutBoxes[0]);

    selectedDataColumns.forEach((shape) => (shape.select()));
    selectedLayoutBoxes.forEach((shape) => (shape.select()));
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
    const selectedWordsAll = CanvasSelection.getKonvaLayoutBoxes();
    const inclusionRuleArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionRule))));
    const inclusionLevelArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionLevel))));
    return { inclusionRuleArr, inclusionLevelArr };
  };

  static deselectAllWords = () => {
    CanvasSelection._selectedWordArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedWordArr.length = 0;
  };

  static deselectAllRegions = () => {
    CanvasSelection._selectedRegionArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedRegionArr.length = 0;
  };

  static deselectAllDataColumns = () => {
    CanvasSelection._selectedDataColumnArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedDataColumnArr.length = 0;
  };

  static deselectAll = () => {
    CanvasSelection.deselectAllWords();
    CanvasSelection.deselectAllRegions();
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
export class ScribeCanvas {
  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  static _controlArr = [];

  /** @type {Array<KonvaOcrWord>} */
  static _wordArr = [];

  /**
   * Contains `Rect` objects used to outline lines and paragraphs, as well as `Text` objects used to label those boxes.
   * @type {Array<InstanceType<typeof Konva.Rect>|InstanceType<typeof Konva.Text>>}
   */
  static _lineOutlineArr = [];

  /** @type {Array<KonvaLayout>} */
  static _layoutRegionArr = [];

  /** @type {Array<import('./interfaceLayout.js').KonvaDataTable>} */
  static _layoutDataTableArr = [];

  /** @type {?HTMLSpanElement} */
  static input = null;

  /** @type {?KonvaIText} */
  static inputWord = null;

  /** @type {?Function} */
  static inputRemove = null;

  static selectingRectangle = selectingRectangle;

  /** @type {?KonvaOcrWord} */
  static contextMenuWord = null;

  /**
   * Contains the x and y coordinates of the last right-click event.
   * This is required for "right click" functions that are position-dependent,
   * as the cursor moves between the initial right click and selecting the option.
   */
  static contextMenuPointer = { x: 0, y: 0 };

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
    isResizingColumns: false,
    dragDeltaTotal: 0,
    lastX: 0,
    lastY: 0,
    /** @type {?{x: number, y: number}} */
    lastCenter: null,
    /** @type {?number} */
    lastDist: null,
  };

  static getKonvaWords = () => ScribeCanvas._wordArr;

  static getKonvaRegions = () => ScribeCanvas._layoutRegionArr;

  static getKonvaDataTables = () => ScribeCanvas._layoutDataTableArr;

  /**
   * Get all layout boxes, including both regions and data columns.
   * Returns copy.
   */
  static getKonvaLayoutBoxes = () => {
    const layoutBoxes = ScribeCanvas._layoutRegionArr.slice();
    ScribeCanvas._layoutDataTableArr.forEach((x) => {
      layoutBoxes.push(...x.columns);
    });
    return layoutBoxes;
  };

  /**
   *
   * @param {KonvaOcrWord} word
   */
  static addWord = (word) => {
    ScribeCanvas._wordArr.push(word);
    layerText.add(word);
  };

  /**
   *
   * @param {KonvaLayout} region
   */
  static addRegion = (region) => {
    ScribeCanvas._layoutRegionArr.push(region);
    layerOverlay.add(region);
    if (region.label) layerOverlay.add(region.label);
  };

  /**
   *
   * @param {boolean} [deselect=true] - Deselect all words, layout boxes, and data columns.
   */
  static destroyControls = (deselect = true) => {
    elem.edit.collapseRangeBaselineBS.hide();
    ScribeCanvas._controlArr.forEach((control) => control.destroy());
    ScribeCanvas._controlArr.length = 0;

    if (deselect) ScribeCanvas.CanvasSelection.deselectAll();

    if (ScribeCanvas.input && ScribeCanvas.input.parentElement && ScribeCanvas.inputRemove) ScribeCanvas.inputRemove();
  };

  static destroyLineOutlines = () => {
    ScribeCanvas._lineOutlineArr.forEach((x) => x.destroy());
    ScribeCanvas._lineOutlineArr.length = 0;
  };

  static destroyLayoutDataTables = () => {
    ScribeCanvas._layoutDataTableArr.forEach((x) => x.destroy());
    ScribeCanvas._layoutDataTableArr.length = 0;
    ScribeCanvas.CanvasSelection.deselectAllDataColumns();
  };

  static destroyRegions = () => {
    ScribeCanvas._layoutRegionArr.forEach((x) => x.destroy());
    ScribeCanvas._layoutRegionArr.length = 0;
    ScribeCanvas.destroyLayoutDataTables();
    ScribeCanvas.CanvasSelection.deselectAllRegions();
  };

  static destroyWords = () => {
    // Any time words are destroyed, controls must be destroyed as well.
    // If this does not happen controls will have references to destroyed words, which causes errors to be thrown.
    ScribeCanvas.destroyControls();
    ScribeCanvas._wordArr.forEach((obj) => obj.destroy());
    ScribeCanvas.destroyLineOutlines();
    ScribeCanvas._wordArr.length = 0;
  };

  /**
   *
   * @param {string|Array<string>} ids
   */
  static destroyLayoutDataTablesById = (ids) => {
    if (!Array.isArray(ids)) ids = [ids];
    for (let j = 0; j < ScribeCanvas._layoutDataTableArr.length; j++) {
      if (ids.includes(ScribeCanvas._layoutDataTableArr[j].layoutDataTable.id)) {
        ScribeCanvas._layoutDataTableArr[j].destroy();
        ScribeCanvas._layoutDataTableArr.splice(j, 1);
        j--;
      }
    }
  };
}

/**
 * Update word textbox on canvas following changes.
 * Whenever a user edits a word in any way (including content and font/style),
 * the position and character spacing need to be re-calculated so they still overlay with the background image.
 * @param {KonvaIText} wordI
 */
export async function updateWordCanvas(wordI) {
  // Re-calculate left position given potentially new left bearing
  const {
    advanceArr, fontSize, kerningArr, charSpacing, charArr, leftSideBearing, rightSideBearing,
  } = calcWordMetrics(wordI.word);

  wordI.charArr = charArr;

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
  wordI.height(fontSize * 0.6);
  wordI.show();

  // Test `wordI.parent` to avoid race condition where `wordI` is destroyed before this function completes.
  if (wordI.parent) wordI.draw();
}

/**
 *
 * @param {OcrWord} word
 */
export function getWordFillOpacity(word) {
  const confThreshHigh = elem.info.confThreshHigh.value !== '' ? parseInt(elem.info.confThreshHigh.value) : 85;
  const confThreshMed = elem.info.confThreshMed.value !== '' ? parseInt(elem.info.confThreshMed.value) : 75;

  let fillColorHex;
  if (word.conf > confThreshHigh) {
    fillColorHex = '#00ff7b';
  } else if (word.conf > confThreshMed) {
    fillColorHex = '#ffc800';
  } else {
    fillColorHex = '#ff0000';
  }

  const displayMode = elem.view.displayMode.value;

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
    opacity = opt.overlayOpacity / 100;
    fill = fillColorHexMatch;
  } else {
    opacity = opt.overlayOpacity / 100;
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
   * @param {import('../js/objects/ocrObjects.js').OcrWord} options.word
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
      charSpacing, leftSideBearing, rightSideBearing, fontSize, charArr, advanceArr, kerningArr,
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
    if (!dynamicWidth && !word.visualCoords) {
      width -= (leftSideBearing + rightSideBearing);
      width = Math.max(width, 7);
    }

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
      // @ts-ignore
      sceneFunc: (context, shape) => {
        context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
        context.textBaseline = 'alphabetic';
        context.fillStyle = shape.fill();
        context.lineWidth = 1;

        shape.setAttr('y', shape.yActual - shape.fontSize * 0.6);

        let leftI = shape.word.visualCoords ? 0 - this.leftSideBearing : 0;
        for (let i = 0; i < shape.charArr.length; i++) {
          let charI = shape.charArr[i];

          if (shape.word.smallCaps) {
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
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.selected) {
          context.strokeStyle = 'rgba(40,123,181,1)';
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.fillBox) {
          context.fillStyle = '#4278f550';
          context.fillRect(0, 0, shape.width(), shape.height());
        }
      },
      /**
       * @param {InstanceType<typeof Konva.Context>} context
       * @param {KonvaIText} shape
       */
      // @ts-ignore
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
    this.outline = outline;
    this.selected = selected;
    this.fillBox = fillBox;
    this.dynamicWidth = dynamicWidth;
    this.editTextCallback = editTextCallback;

    this.addEventListener('dblclick dbltap', (event) => {
      // @ts-ignore
      if (event.button === 0) KonvaIText.addTextInput(this);
    });

    this.select = () => {
      this.selected = true;
    };

    this.deselect = () => {
      this.selected = false;
    };
  }

  /**
   * Get the index of the letter that the cursor is closest to.
   * This function should be used when selecting a letter to edit;
   * when actively editing, `getInputCursorIndex` should be used instead.
   * @param {KonvaIText} itext
   */
  static getCursorIndex = (itext) => {
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
    return letterIndex;
  };

  /**
   * Position and show the input for editing.
   * @param {KonvaIText} itext
   */
  static addTextInput = (itext) => {
    const letterIndex = KonvaIText.getCursorIndex(itext);

    if (ScribeCanvas.input && ScribeCanvas.input.parentElement && ScribeCanvas.inputRemove) ScribeCanvas.inputRemove();

    const inputElem = document.createElement('span');

    ScribeCanvas.inputWord = itext;
    ScribeCanvas.input = inputElem;

    const wordStr = itext.charArr.join('');

    const scale = layerText.scaleY();

    const charSpacingHTML = itext.charSpacing * scale;

    let { x: x1, y: y1 } = itext.getAbsolutePosition();
    if (itext.word.visualCoords) x1 -= itext.leftSideBearing * scale;

    const fontSizeHTML = itext.fontSize * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const fontI = fontAll.getWordFont(itext.word);

    ctx.font = `${itext.fontFaceStyle} ${itext.fontFaceWeight} ${fontSizeHTML}px ${fontI.fontFaceName}`;

    const metrics = ctx.measureText(wordStr);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * 0.8;

    inputElem.style.position = 'absolute';
    inputElem.style.left = `${x1}px`;
    inputElem.style.top = `${y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6}px`; // Align with baseline
    inputElem.style.fontSize = `${fontSizeHTML}px`;
    inputElem.style.fontFamily = itext.fontFaceName;

    /**
     *
     * @param {string} text
     */
    const makeSmallCapsDivs = (text) => {
      const textDivs0 = text.match(/([a-z]+)|([^a-z]+)/g);
      if (!textDivs0) return '';
      const textDivs = textDivs0.map((x) => {
        const lower = /[a-z]/.test(x);
        const styleStr = lower ? `style="font-size:${fontSizeHTMLSmallCaps}px"` : '';
        return `<span class="input-sub" ${styleStr}>${x}</span>`;
      });
      return textDivs.join('');
    };

    // We cannot make the text uppercase in the input field, as this would result in the text being saved as uppercase.
    // Additionally, while there is a small-caps CSS property, it does not allow for customizing the size of the small caps.
    // Therefore, we handle small caps by making all text print as uppercase using the `text-transform` CSS property,
    // and then wrapping each letter in a span with a smaller font size.
    if (itext.word.smallCaps) {
      inputElem.style.textTransform = 'uppercase';
      inputElem.innerHTML = makeSmallCapsDivs(wordStr);
    } else {
      inputElem.textContent = wordStr;
    }

    inputElem.style.letterSpacing = `${charSpacingHTML}px`;
    inputElem.style.color = itext.fill();
    inputElem.style.opacity = String(itext.opacity());
    inputElem.style.fontStyle = itext.fontFaceStyle;
    inputElem.style.fontWeight = itext.fontFaceWeight;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    inputElem.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;
    inputElem.contentEditable = 'true';

    // Prevent line breaks and hide overflow
    inputElem.style.whiteSpace = 'nowrap';

    if (itext.word.smallCaps) {
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        const textContent = inputElem.textContent || '';
        inputElem.innerHTML = makeSmallCapsDivs(textContent);
        setCursor(index);
      };
    } else {
      // When users copy/paste text, formatting is often copied as well.
      // For example, copying contents of a low-conf word into a high-conf word will also copy the red color.
      // This code removes any formatting from the pasted text.
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        // eslint-disable-next-line no-self-assign
        inputElem.textContent = inputElem.textContent;
        setCursor(index);
      };
    }

    ScribeCanvas.inputRemove = () => {
      if (!ScribeCanvas.input) return;

      let textNew = ocr.replaceLigatures(ScribeCanvas.input.textContent || '').trim();

      if (elem.edit.smartQuotes.value) textNew = replaceSmartQuotes(textNew);

      // Words are not allowed to be empty
      if (textNew) {
        itext.word.text = textNew;
        itext.editTextCallback(itext);
      }
      updateWordCanvas(itext);
      ScribeCanvas.input.remove();
      ScribeCanvas.input = null;
      ScribeCanvas.inputRemove = null;
      ScribeCanvas.inputWord = null;
    };

    // Update the Konva Text node after editing
    ScribeCanvas.input.addEventListener('blur', () => (ScribeCanvas.inputRemove));
    ScribeCanvas.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && ScribeCanvas.inputRemove) {
        ScribeCanvas.inputRemove();
      }
    });

    document.body.appendChild(ScribeCanvas.input);

    ScribeCanvas.input.focus();

    /**
     * Returns the cursor position relative to the start of the text box, including all text nodes.
     * @returns {number}
     */
    const getInputCursorIndex = () => {
      const sel = /** @type {Selection} */ (window.getSelection());
      // The achor node may be either (1) a text element or (2) a `<span>` element that contains a text element.
      const anchor = /** @type {HTMLElement} */ (sel.anchorNode);
      let nodePrev = anchor?.parentElement?.className === 'input-sub' ? anchor?.parentElement.previousElementSibling : anchor?.previousElementSibling;
      let nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];

      let index = sel.anchorOffset;
      while (nodePrevText && nodePrev) {
        index += nodePrevText.textContent?.length || 0;
        nodePrev = nodePrev.className === 'input-sub' ? nodePrev.previousElementSibling : nodePrev?.previousElementSibling;
        nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];
      }
      return index;
    };

    /**
     * Set cursor position to `index` within the input.
     * @param {number} index
     */
    const setCursor = (index) => {
      if (!ScribeCanvas.input) {
        console.error('Input element not found');
        return;
      }
      const range = document.createRange();
      const sel = /** @type {Selection} */ (window.getSelection());

      let letterI = 0;
      for (let i = 0; i < ScribeCanvas.input.childNodes.length; i++) {
        const node = ScribeCanvas.input.childNodes[i];
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

    this.listening(!state.layoutMode);

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
    const wordFirst = ScribeCanvas.CanvasSelection.getKonvaWords()[0];

    if (!wordFirst) return;

    const { fontFamilyArr, fontSizeArr } = ScribeCanvas.CanvasSelection.getWordProperties();

    if (fontFamilyArr.length === 1) {
      elem.edit.wordFont.value = String(wordFirst.fontFamilyLookup);
    } else {
      elem.edit.wordFont.value = '';
    }

    if (fontSizeArr.length === 1) {
      elem.edit.fontSize.value = String(wordFirst.fontSize);
    } else {
      elem.edit.fontSize.value = '';
    }

    if (wordFirst.word.sup !== elem.edit.styleSuper.classList.contains('active')) {
      styleSuperButton.toggle();
    }
    if (wordFirst.word.smallCaps !== elem.edit.styleSmallCaps.classList.contains('active')) {
      styleSmallCapsButton.toggle();
    }
    const italic = wordFirst.word.style === 'italic';
    if (italic !== elem.edit.styleItalic.classList.contains('active')) {
      styleItalicButton.toggle();
    }
    const bold = wordFirst.word.style === 'bold';
    if (bold !== elem.edit.styleBold.classList.contains('active')) {
      styleBoldButton.toggle();
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
      // This width is automatically scaled by Konva based on the zoom level.
      borderStrokeWidth: 2,
    });
    ScribeCanvas._controlArr.push(trans);
    layerText.add(trans);

    trans.nodes([itext]);
  };
}

/**
 *
 * @param {bbox} box
 * @param {number} angle
 * @param {{x: number, y: number}} angleAdj
 * @param {string} [label]
 */
const addBlockOutline = (box, angle, angleAdj, label) => {
  const height = box.bottom - box.top;

  const blockRect = new Konva.Rect({
    x: box.left + angleAdj.x,
    y: box.top + angleAdj.y,
    width: box.right - box.left,
    height,
    rotation: angle,
    stroke: 'rgba(0,0,255,0.75)',
    strokeWidth: 1,
    draggable: false,
    listening: false,
  });

  if (label) {
    const labelObj = new Konva.Text({
      x: box.left + angleAdj.x,
      y: box.top + angleAdj.y,
      text: label,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: 'rgba(0,0,255,0.75)',
      rotation: angle,
      draggable: false,
      listening: false,
    });

    layerText.add(labelObj);
    ScribeCanvas._lineOutlineArr.push(labelObj);
  }

  layerText.add(blockRect);

  ScribeCanvas._lineOutlineArr.push(blockRect);
};

/**
 *
 * @param {OcrPage} page
 */
export function renderPage(page) {
  const matchIdArr = ocr.getMatchingWordIds(search.search, ocrAll.active[state.cp.n]);

  const angle = pageMetricsArr[state.cp.n].angle || 0;

  // Layout mode features assume that auto-rotate is enabled.
  const enableRotation = (opt.autoRotate || state.layoutMode) && Math.abs(angle ?? 0) > 0.05;

  const angleArg = Math.abs(angle) > 0.05 && !enableRotation ? (angle) : 0;

  if (elem.view.outlinePars.checked && page) {
    assignParagraphs(page, angle);

    page.pars.forEach((par) => {
      const angleAdj = enableRotation ? ocr.calcLineStartAngleAdj(par.lines[0]) : { x: 0, y: 0 };
      addBlockOutline(par.bbox, angleArg, angleAdj, par.reason);
    });
  }

  for (let i = 0; i < page.lines.length; i++) {
    const lineObj = page.lines[i];
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = enableRotation ? ocr.calcLineStartAngleAdj(lineObj) : { x: 0, y: 0 };

    if (elem.view.outlineLines.checked) {
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
        listening: false,
      });

      ScribeCanvas._lineOutlineArr.push(lineRect);

      layerText.add(lineRect);
    }

    for (const wordObj of lineObj.words) {
      if (!wordObj.text) continue;

      const box = wordObj.bbox;

      const wordDropCap = wordObj.dropcap;

      const confThreshHigh = elem.info.confThreshHigh.value !== '' ? parseInt(elem.info.confThreshHigh.value) : 85;

      const displayMode = elem.view.displayMode.value;

      const outlineWord = elem.view.outlineWords.checked || displayMode === 'eval' && wordObj.conf > confThreshHigh && !wordObj.matchTruth;

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

      ScribeCanvas.addWord(wordCanvas);
    }
  }
}

export {
  layerBackground, layerOverlay, layerText, stage,
};
