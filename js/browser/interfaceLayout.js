/* eslint-disable import/no-cycle */
import Konva from '../../lib/konva/index.js';

import { getRandomAlphanum, showHideElem } from '../miscUtils.js';

import { displayPage, cp } from '../../main.js';

import { LayoutBox } from '../objects/layoutObjects.js';

import { layoutAll, ocrAll, inputDataModes } from '../containers/miscContainer.js';

import ocr from '../objects/ocrObjects.js';

import {
  getCanvasWords, layerOverlay, canvasObj, destroyLayoutBoxes, destroyControls, getCanvasLayoutBoxes, updateWordCanvas,
  KonvaIText,
} from './interfaceCanvas.js';

const setLayoutBoxTableElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTable'));

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));
const xlsxFilenameColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));
const xlsxPageNumberColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));

const dataPreviewElem = /** @type {HTMLElement} */ (document.getElementById('dataPreview'));

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

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
  layoutAll[cp.n].boxes[id].type = type;

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

const colors = ['rgba(24,166,217,0.25)', 'rgba(73,104,115,0.25)', 'rgba(52,217,169,0.25)', 'rgba(222,117,109,0.25)', 'rgba(194,95,118,0.25)'];

/**
 * Subclass of Konva.Rect that represents a layout box, which is a rectangle that represents a region of the page, along with an optional editable textbox.
 * The textbox is implemented by manually adding a second Konva object, that moves when the rectangle moves, and is deleted when the rectangle is deleted.
 * This was chosen rather than the built-in Konva "group" object, which appears to offer a cleaner way to group objects,
 * as preliminary testing showed the latter method was less performant and less flexible.
 */
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
    let fill = 'rgba(193,84,57,0.25)';
    if (layoutBox.type === 'order') {
      fill = 'rgba(0,137,114,0.25)';
    } else if (layoutBox.type === 'dataColumn') {
      fill = colors[layoutBox.table % colors.length];
    }

    super({
      x: origX,
      y: origY,
      width,
      height,
      fill,
      stroke: 'rgba(40,123,181,0.4)',
      strokeWidth: 2,
      draggable: true,
    });

    this.select = () => {
      this.stroke('rgba(40,123,181,1)');
      this.fill(this.fill().replace(/,[\d.]+\)/, ',0.4)'));
    };

    this.deselect = () => {
      this.stroke('rgba(40,123,181,0.4)');
      this.fill(this.fill().replace(/,[\d.]+\)/, ',0.25)'));
    };

    this.destroyRect = this.destroy;
    this.destroy = () => {
      if (this.label) this.label.destroy();
      this.label = undefined;
      this.destroyRect();
      return this;
    };

    if (layoutBox.type === 'order') {
      // Create dummy ocr data for the order box
      const pageObj = new ocr.OcrPage(cp.n, { width: 1, height: 1 });
      const box = {
        left: 0, right: 0, top: 0, bottom: 0,
      };
      const lineObjTemp = new ocr.OcrLine(pageObj, box, [0, 0], 10, null);
      pageObj.lines = [lineObjTemp];
      const wordIDNew = getRandomAlphanum(10);
      const wordObj = new ocr.OcrWord(lineObjTemp, String(layoutBox.priority), box, wordIDNew);
      wordObj.excludesBearings = false;
      wordObj.size = 50;
      const label = new KonvaIText({
        x: origX + width * 0.5,
        yActual: origY + height * 0.5,
        word: wordObj,
        dynamicWidth: true,
        editTextCallback: async (obj) => {
          layoutBox.priority = parseInt(obj.word.text);
        },
      });
      this.label = label;
    }

    this.layoutBox = layoutBox;

    this.addEventListener('transformend', () => {
      KonvaLayout.updateLayoutBoxes(this);
    });

    this.addEventListener('dragmove', () => {
      if (canvasObj.input && canvasObj.input.parentElement && canvasObj.inputRemove) canvasObj.inputRemove();
      if (this.label) {
        this.label.x(this.x() + this.width() * 0.5);
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
    const tablesSelectedArr = Array.from(new Set(canvasObj.selectedLayoutBoxArr.map((x) => (x.layoutBox.table))));

    if (tablesSelectedArr.length === 1) {
      setLayoutBoxTableElem.value = String(tablesSelectedArr[0] + 1);
    } else {
      setLayoutBoxTableElem.value = '';
    }
  };
}

/**
 *
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.x
 * @param {number} box.y
 */
export function selectLayoutBoxesArea(box) {
  const shapes = getCanvasLayoutBoxes();

  const layoutBoxes = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));

  selectLayoutBoxes(layoutBoxes);
}

/**
 *
 * @param {Array<KonvaLayout>} konvaLayoutBoxes
 */
export function selectLayoutBoxes(konvaLayoutBoxes) {
  destroyControls();

  canvasObj.selectedLayoutBoxArr.length = 0;
  canvasObj.selectedLayoutBoxArr.push(...konvaLayoutBoxes);

  // Boxes can only be resized one at a time
  if (konvaLayoutBoxes.length === 1) KonvaLayout.addControls(konvaLayoutBoxes[0]);

  canvasObj.selectedLayoutBoxArr.forEach((shape) => (shape.select()));
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
export async function updateDataPreview() {
  if (!globalThis.inputFileNames || !ocrAll.active[cp.n]) return;

  const showDataPreview = enableXlsxExportElem.checked;

  showHideElem(dataPreviewElem, showDataPreview);

  if (!showDataPreview) return;

  const addFilenameMode = xlsxFilenameColumnElem.checked;
  const addPageNumberColumnMode = xlsxPageNumberColumnElem.checked;

  const extraCols = [];
  if (addFilenameMode) {
    if (inputDataModes.pdfMode) {
      extraCols.push(globalThis.inputFileNames[0]);
    } else {
      extraCols.push(globalThis.inputFileNames[cp.n]);
    }
  }
  if (addPageNumberColumnMode) extraCols.push(String(cp.n + 1));

  const createCells = (await import('../exportWriteTabular.js')).createCells;
  dataPreviewElem.innerHTML = createCells(ocrAll.active[cp.n], layoutAll[cp.n], extraCols, 0, false, true).content;
}
