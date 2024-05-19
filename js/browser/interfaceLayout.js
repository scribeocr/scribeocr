/* eslint-disable import/no-cycle */
import Konva from '../../lib/konva/index.js';

import { getRandomAlphanum, showHideElem } from '../miscUtils.js';

import { displayPage, cp } from '../../main.js';

import { createCells } from '../exportWriteTabular.js';

import { LayoutBox, layoutAll } from '../objects/layoutObjects.js';

import ocr from '../objects/ocrObjects.js';

import {
  getCanvasWords, layerOverlay, canvasObj, destroyLayoutBoxes, destroyControls, layerText, getCanvasLayoutBoxes, updateWordCanvas,
  KonvaIText,
} from './interfaceCanvas.js';

const setLayoutBoxTableElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTable'));

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));
const xlsxFilenameColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));
const xlsxPageNumberColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));

const dataPreviewElem = /** @type {HTMLElement} */ (document.getElementById('dataPreview'));

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

export function selectLayoutBoxes(box) {
  const shapes = getCanvasLayoutBoxes();

  canvasObj.selectedLayoutBoxArr.length = 0;
  canvasObj.selectedLayoutBoxArr.push(...shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect())));

  // When the rectangle is dragged by the user, the selection rectangle currently does not move with it.
  // As only a single layout box can be dragged at a time, this filter prevents this visual issue.
  if (canvasObj.selectedLayoutBoxArr.length < 2) return;

  canvasObj.selectedLayoutBoxArr.forEach((shape) => {
    const rect = new Konva.Rect({
      x: shape.x(),
      y: shape.y(),
      width: shape.width(),
      height: shape.height(),
      stroke: 'rgba(40,123,181,1)',
      visible: true,
      // disable events to not interrupt with events
      listening: false,
    });
    layerText.add(rect);
    canvasObj.controlArr.push(rect);
  });
}

/**
 * @param {Object} box
 * @param {number} box.x
 * @param {number} box.y
 * @param {number} box.width
 * @param {number} box.height
 * @param {('order'|'exclude'|'dataColumn')} type
 */
export function addLayoutBoxClick({
  x, y, width, height,
}, type) {
  layoutBoxTypeElem.textContent = { order: 'Order', exclude: 'Exclude', dataColumn: 'Column' }[type];

  const id = getRandomAlphanum(10);

  // Maximum priority for boxes that already exist
  const maxPriority = Math.max(...Object.values(layoutAll[cp.n].boxes).map((x) => x.priority), 0);

  const bbox = {
    left: x, top: y, right: x + width, bottom: y + height,
  };

  layoutAll[cp.n].boxes[id] = new LayoutBox(id, maxPriority + 1, bbox);

  renderLayoutBoxes();
}

export function deleteLayoutBoxClick() {
  canvasObj.selectedLayoutBoxArr.forEach((obj) => {
    delete layoutAll[cp.n].boxes[obj.layoutBox.id];
    obj.destroy();
  });
  destroyControls();
}

export function toggleSelectableWords(selectable = true) {
  const allObjects = getCanvasWords();
  allObjects.forEach((obj) => {
    obj.listening(selectable);
  });
}

export function setDefaultLayoutClick() {
  layoutAll[cp.n].default = true;
  globalThis.defaultLayout = structuredClone(layoutAll[cp.n].boxes);
  for (let i = 0; i < layoutAll.length; i++) {
    if (layoutAll[i].default) {
      layoutAll[i].boxes = structuredClone(globalThis.defaultLayout);
    }
  }
}

export function revertLayoutClick() {
  layoutAll[cp.n].default = true;
  layoutAll[cp.n].boxes = structuredClone(globalThis.defaultLayout);
  displayPage(cp.n);
  updateDataPreview();
}

export function setLayoutBoxTypeClick(type) {
  canvasObj.selectedLayoutBoxArr.forEach((x) => {
    x.layoutBox.type = type;
  });

  renderLayoutBoxes();
}

export function setLayoutBoxTable(table) {
  canvasObj.selectedLayoutBoxArr.forEach((x) => {
    x.layoutBox.table = parseInt(table) - 1;
  });

  renderLayoutBoxes();
  updateDataPreview();
}

export function setLayoutBoxInclusionRuleClick(rule) {
  let changed = false;
  canvasObj.selectedLayoutBoxArr.forEach((x) => {
    changed = x.layoutBox.inclusionRule !== rule;
    x.layoutBox.inclusionRule = rule;
  });

  if (changed) {
    renderLayoutBoxes();
    updateDataPreview();
  }
}

export function setLayoutBoxInclusionLevelClick(level) {
  let changed = false;
  canvasObj.selectedLayoutBoxArr.forEach((x) => {
    changed = x.layoutBox.inclusionLevel !== level;
    x.layoutBox.inclusionLevel = level;
  });

  if (changed) {
    renderLayoutBoxes();
    updateDataPreview();
  }
}

export function renderLayoutBoxes() {
  destroyLayoutBoxes();
  Object.values(layoutAll[cp.n].boxes).forEach((box) => {
    renderLayoutBox(box);
  });

  layerOverlay.batchDraw();
}

const colors = ['rgba(24,166,217,0.5)', 'rgba(73,104,115,0.5)', 'rgba(52,217,169,0.5)', 'rgba(222,117,109,0.5)', 'rgba(194,95,118,0.5)'];

export class KonvaLayout extends Konva.Rect {
  /**
   *
   * @param {LayoutBox} layoutBox
   */
  constructor(layoutBox) {
    const origX = layoutBox.coords.left;
    const origY = layoutBox.coords.top;
    const width = layoutBox.coords.right - layoutBox.coords.left;
    const height = layoutBox.coords.bottom - layoutBox.coords.top;

    // "Order" boxes are blue, "exclude" boxes are red, data columns are different colors for each table
    let fill = 'rgba(255,0,0,0.25)';
    if (layoutBox.type === 'order') {
      fill = 'rgba(0,0,255,0.25)';
    } else if (layoutBox.type === 'dataColumn') {
      fill = colors[layoutBox.table % colors.length];
    }

    super({
      x: origX,
      y: origY,
      width,
      height,
      fill,
      stroke: 'rgba(0,0,255,0.75)',
      strokeWidth: 1,
      draggable: true,
    });

    if (layoutBox.type === 'order') {
      // Create dummy ocr data for the order box
      const pageObj = new ocr.OcrPage(cp.n, globalThis.ocrAll.active[cp.n].dims);
      const box = {
        left: 0, right: 0, top: 0, bottom: 0,
      };
      const lineObjTemp = new ocr.OcrLine(pageObj, box, [0, 0], 10, null);
      pageObj.lines = [lineObjTemp];
      const wordIDNew = getRandomAlphanum(10);
      const wordObj = new ocr.OcrWord(lineObjTemp, String(layoutBox.priority), box, wordIDNew);
      wordObj.size = 50;
      const label = new KonvaIText({
        visualLeft: origX + width * 0.5,
        yActual: origY + height * 0.5,
        word: wordObj,
        editTextCallback: async (obj) => {
          layoutBox.priority = parseInt(obj.word.text);
        },
      });
      this.label = label;
    }

    this.layoutBox = layoutBox;

    this.addEventListener('click', () => {
      KonvaLayout.addControls(this);
    });

    this.addEventListener('transformend', () => {
      KonvaLayout.updateLayoutBoxes(this);
    });

    this.addEventListener('dragmove', () => {
      if (this.label) {
        this.label.visualLeft = this.x() + this.width() * 0.5;
        this.label.yActual = this.y() + this.height() * 0.5;
        updateWordCanvas(this.label);
      }
    });

    this.addEventListener('dragend', () => {
      KonvaLayout.updateLayoutBoxes(this);
    });
  }

  /**
   * Add controls for editing.
   * @param {KonvaLayout} konvaLayout
   */
  static addControls = (konvaLayout) => {
    destroyControls();
    canvasObj.selectedLayoutBoxArr.length = 0;
    canvasObj.selectedLayoutBoxArr.push(konvaLayout);
    const trans = new Konva.Transformer({
      enabledAnchors: ['middle-left', 'middle-right', 'top-center', 'bottom-center'],
      rotateEnabled: false,
    });
    canvasObj.controlArr.push(trans);
    layerOverlay.add(trans);

    trans.nodes([konvaLayout]);
  };

  /**
   * Add controls for editing.
   * @param {KonvaLayout} konvaLayout
   */
  static updateLayoutBoxes(konvaLayout) {
    const width = konvaLayout.width() * konvaLayout.scaleX();
    const height = konvaLayout.height() * konvaLayout.scaleY();
    const right = konvaLayout.x() + width;
    const bottom = konvaLayout.y() + height;
    layoutAll[cp.n].boxes[konvaLayout.layoutBox.id].coords = {
      left: konvaLayout.x(), top: konvaLayout.y(), right, bottom,
    };
    updateDataPreview();
  }

  /**
   * Update the UI to reflect the properties of the word(s) in `canvasObj.selectedWordArr`.
   * This should be called when any word is selected, after adding them to `canvasObj.selectedWordArr`.
   */
  static updateUI = () => {
    const wordFirst = canvasObj.selectedLayoutBoxArr[0];

    if (!wordFirst) return;

    setLayoutBoxTableElem.value = String(wordFirst.layoutBox.table + 1);
  };
}

/**
 *
 * @param {LayoutBox} layoutBox
 */
function renderLayoutBox(layoutBox) {
  const konvaLayout = new KonvaLayout(layoutBox);
  canvasObj.layoutBoxArr.push(konvaLayout);
  layerOverlay.add(konvaLayout);
  if (konvaLayout.label) layerOverlay.add(konvaLayout.label);
}

// Update tabular data preview table
// Should be run (1) on edits (to either OCR data or layout), (2) when a new page is rendered,
// or (3) when settings are changed to enable/disable tabular export mode.
export function updateDataPreview() {
  if (!globalThis.inputFileNames) return;

  const showDataPreview = enableXlsxExportElem.checked;

  showHideElem(dataPreviewElem, showDataPreview);

  if (!showDataPreview) return;

  const addFilenameMode = xlsxFilenameColumnElem.checked;
  const addPageNumberColumnMode = xlsxPageNumberColumnElem.checked;

  const extraCols = [];
  if (addFilenameMode) {
    if (globalThis.inputDataModes.pdfMode) {
      extraCols.push(globalThis.inputFileNames[0]);
    } else {
      extraCols.push(globalThis.inputFileNames[cp.n]);
    }
  }
  if (addPageNumberColumnMode) extraCols.push(String(cp.n + 1));

  dataPreviewElem.innerHTML = createCells(globalThis.ocrAll.active[cp.n], layoutAll[cp.n], extraCols, 0, false, true).content;
}
