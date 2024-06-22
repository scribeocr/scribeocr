/* eslint-disable import/no-cycle */
import Konva from '../../lib/konva/index.js';

import { getRandomAlphanum, showHideElem } from '../miscUtils.js';

import { displayPage, cp } from '../../main.js';

import {
  LayoutDataColumn, LayoutDataTable, LayoutDataTablePage, LayoutRegion, calcTableBbox,
} from '../objects/layoutObjects.js';

import {
  layoutAll, ocrAll, inputDataModes, layoutDataTableAll,
} from '../containers/miscContainer.js';

import ocr from '../objects/ocrObjects.js';

import {
  getCanvasWords, layerOverlay, getCanvasLayoutBoxes, updateWordCanvas,
  KonvaIText, stage, CanvasObjs,
  hideContextMenu,
} from './interfaceCanvas.js';

import { extractSingleTableContent } from '../exportWriteTabular.js';

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));
const xlsxFilenameColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));
const xlsxPageNumberColumnElem = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));

const dataPreviewElem = /** @type {HTMLElement} */ (document.getElementById('dataPreview'));

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

const setLayoutBoxInclusionRuleMajorityElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));
const setLayoutBoxInclusionRuleLeftElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));

const setLayoutBoxInclusionLevelWordElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));
const setLayoutBoxInclusionLevelLineElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));

// const colColors = ['rgba(40,123,181,0.3)', 'rgba(201,74,83,0.3)', 'rgba(45,134,61,0.3)'];
const colColorsHex = ['#287bb5', '#19aa9a', '#099b57'];

/**
 * Converts a hex color to rgba with a specified alpha.
 * @param {string} hex - The hex color code.
 * @param {number} alpha - The alpha value for the rgba color.
 * @returns {string} The rgba color string.
 */
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const setAlpha = (color, alpha) => color.replace(/,\s*[\d.]+\)/, `,${alpha})`);

/**
 * @param {Object} box
 * @param {number} box.x
 * @param {number} box.y
 * @param {number} box.width
 * @param {number} box.height
 */
export function addLayoutDataTableClick({
  x, y, width, height,
}) {
  const bbox = {
    left: x, top: y, right: x + width, bottom: y + height,
  };

  const dataTable = new LayoutDataTable();
  const layoutBox = new LayoutDataColumn(bbox, dataTable);

  dataTable.boxes[layoutBox.id] = layoutBox;

  layoutDataTableAll[cp.n].tables[dataTable.id] = dataTable;

  renderLayoutDataTable(dataTable);
}

/**
 * @param {Object} box
 * @param {number} box.x
 * @param {number} box.y
 * @param {number} box.width
 * @param {number} box.height
 * @param {('order'|'exclude')} type
 */
export function addLayoutBoxClick({
  x, y, width, height,
}, type) {
  layoutBoxTypeElem.textContent = { order: 'Order', exclude: 'Exclude' }[type];

  // Maximum priority for boxes that already exist
  const maxPriority = Math.max(...Object.values(layoutAll[cp.n].boxes).map((x) => x.order), -1);

  const bbox = {
    left: x, top: y, right: x + width, bottom: y + height,
  };

  const region = new LayoutRegion(maxPriority + 1, bbox, type);

  layoutAll[cp.n].boxes[region.id] = region;

  renderLayoutBoxes();
}

export function deleteLayoutBoxClick() {
  hideContextMenu();
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();
  selectedLayoutBoxes.forEach((obj) => {
    delete layoutAll[cp.n].boxes[obj.layoutBox.id];
    obj.destroy();
  });
  CanvasObjs.destroyControls();
}

export function deleteLayoutDataTableClick() {
  hideContextMenu();
  const selectedColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();
  if (selectedColumns.length === 0) return;

  selectedColumns[0].konvaTable.delete();
  CanvasObjs.destroyControls();
  layerOverlay.batchDraw();
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
  setDefaultLayoutDataTableClick();
}

export function setDefaultLayoutDataTableClick() {
  layoutDataTableAll[cp.n].default = true;
  globalThis.defaultLayoutDataTable = structuredClone(layoutDataTableAll[cp.n].tables);
  for (let i = 0; i < layoutDataTableAll.length; i++) {
    if (layoutDataTableAll[i].default) {
      layoutDataTableAll[i].tables = structuredClone(globalThis.defaultLayoutDataTable);
    }
  }
}

export function revertLayoutClick() {
  layoutAll[cp.n].default = true;
  layoutAll[cp.n].boxes = structuredClone(globalThis.defaultLayout);
  layoutDataTableAll[cp.n].default = true;
  layoutDataTableAll[cp.n].tables = structuredClone(globalThis.defaultLayoutDataTable);

  displayPage(cp.n);
  updateDataPreview();
}

export function setLayoutBoxTypeClick(type) {
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();
  selectedLayoutBoxes.forEach((x) => {
    x.layoutBox.type = type;
  });

  renderLayoutBoxes();
}

/**
 * Cleans a table to conform to the following rules:
 * 1. Columns must have no space between them (no overlap, no gap).
 * 2. Columns must have the same height.
 * This function is run after combining tables, as combining separate tables results in columns that do not conform to these rules.
 * @param {LayoutDataTable} table
 */
const cleanLayoutDataColumns = (table) => {
  const columnsArr = table.boxes;
  columnsArr.sort((a, b) => a.coords.left - b.coords.left);

  // Step 1: If columns overlap by a small amount, separate them.
  for (let i = 0; i < columnsArr.length - 1; i++) {
    const column = columnsArr[i];
    const nextColumn = columnsArr[i + 1];

    const gap = nextColumn.coords.left - column.coords.right;

    if (gap < 0 && gap >= 10) {
      const midpoint = Math.round(column.coords.right + gap / 2);
      column.coords.right = midpoint;
      nextColumn.coords.left = midpoint;
    }
  }

  // Step 2: If columns overlap by a large amount, delete one of them.
  for (let i = 0; i < columnsArr.length - 1; i++) {
    const column = columnsArr[i];
    const nextColumn = columnsArr[i + 1];

    column.coords.top = Math.min(column.coords.top, nextColumn.coords.top);
    column.coords.bottom = Math.max(column.coords.bottom, nextColumn.coords.bottom);

    const gap = nextColumn.coords.left - column.coords.right;

    if (gap < 0) {
      columnsArr.splice(i + 1, 1);
      i--;
    }
  }

  // Step 3: If columns have a gap between them, expand the columns to fill the gap.
  for (let i = 0; i < columnsArr.length - 1; i++) {
    const column = columnsArr[i];
    const nextColumn = columnsArr[i + 1];

    const gap = nextColumn.coords.left - column.coords.right;

    if (gap > 0) {
      const midpoint = Math.round(column.coords.right + gap / 2);
      column.coords.right = midpoint;
      nextColumn.coords.left = midpoint;
    }
  }

  // Step 4: Standardize all columns to the same height.
  const tableTop = Math.min(...columnsArr.map((x) => x.coords.top));
  const tableBottom = Math.max(...columnsArr.map((x) => x.coords.bottom));

  columnsArr.forEach((x) => {
    x.coords.top = tableTop;
    x.coords.bottom = tableBottom;
  });

  // Replace table boxes with cleaned columns.
  table.boxes = columnsArr;
};

export function setLayoutBoxInclusionRuleClick(rule) {
  // Save the selected boxes to reselect them after re-rendering.
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();
  const selectedDataColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();

  const selectedArr = selectedLayoutBoxes.map((x) => x.layoutBox.id);
  selectedArr.push(...selectedDataColumns.map((x) => x.layoutBox.id));

  let changed = false;
  selectedLayoutBoxes.forEach((x) => {
    changed = changed || x.layoutBox.inclusionRule !== rule;
    x.layoutBox.inclusionRule = rule;
  });
  selectedDataColumns.forEach((x) => {
    changed = changed || x.layoutBox.inclusionRule !== rule;
    x.layoutBox.inclusionRule = rule;
  });

  if (changed) {
    renderLayoutBoxes();
    updateDataPreview();
    selectLayoutBoxesById(selectedArr);
  }
}

export function setLayoutBoxInclusionLevelClick(level) {
  // Save the selected boxes to reselect them after re-rendering.
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();
  const selectedDataColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();

  const selectedArr = selectedLayoutBoxes.map((x) => x.layoutBox.id);
  selectedArr.push(...selectedDataColumns.map((x) => x.layoutBox.id));

  let changed = false;
  selectedLayoutBoxes.forEach((x) => {
    changed = changed || x.layoutBox.inclusionLevel !== level;
    x.layoutBox.inclusionLevel = level;
  });

  selectedDataColumns.forEach((x) => {
    changed = changed || x.layoutBox.inclusionLevel !== level;
    x.layoutBox.inclusionLevel = level;
  });

  if (changed) {
    renderLayoutBoxes();
    updateDataPreview();
    selectLayoutBoxesById(selectedArr);
  }
}

export function renderLayoutBoxes() {
  CanvasObjs.destroyLayoutBoxes();
  Object.values(layoutAll[cp.n].boxes).forEach((box) => {
    renderLayoutBox(box);
  });
  renderLayoutDataTables();

  layerOverlay.batchDraw();
}

/**
 * Subclass of Konva.Rect that represents a layout box, which is a rectangle that represents a region of the page, along with an optional editable textbox.
 * The textbox is implemented by manually adding a second Konva object, that moves when the rectangle moves, and is deleted when the rectangle is deleted.
 * This was chosen rather than the built-in Konva "group" object, which appears to offer a cleaner way to group objects,
 * as preliminary testing showed the latter method was less performant and less flexible.
 */
export class KonvaLayout extends Konva.Rect {
  /**
   *
   * @param {LayoutDataColumn|LayoutRegion} layoutBox
   */
  constructor(layoutBox) {
    const origX = layoutBox.coords.left;
    const origY = layoutBox.coords.top;
    const width = layoutBox.coords.right - layoutBox.coords.left;
    const height = layoutBox.coords.bottom - layoutBox.coords.top;

    // "Order" boxes are blue, "exclude" boxes are red, data columns are uncolored, as the color is added by the table.
    let fill;
    let stroke;
    if (layoutBox.type === 'order') {
      fill = 'rgba(0,137,114,0.25)';
      stroke = 'rgba(0,137,114,0.4)';
    } else if (layoutBox.type === 'exclude') {
      fill = 'rgba(193,84,57,0.25)';
      stroke = 'rgba(0,137,114,0.4)';
    } else if (layoutBox.type === 'dataColumn') {
      const colIndex = layoutBox.table.boxes.findIndex((x) => x.id === layoutBox.id);
      const colorBase = colColorsHex[colIndex % colColorsHex.length];
      fill = hexToRgba(colorBase, 0.3);
    }

    super({
      x: origX,
      y: origY,
      width,
      height,
      fill,
      stroke,
      strokeWidth: 2,
      draggable: true,
    });

    this.select = () => {
      this.stroke('rgba(40,123,181,1)');
      this.fill(setAlpha(this.fill(), 0.4));
    };

    this.deselect = () => {
      this.stroke('rgba(40,123,181,0.4)');
      this.fill(setAlpha(this.fill(), 0.25));
    };

    this.destroyRect = this.destroy;
    this.destroy = () => {
      if (this.label) this.label.destroy();
      this.label = undefined;
      // Deselect the box if it is selected.
      CanvasObjs.CanvasSelection.deselectDataColumnsByIds([this.layoutBox.id]);

      this.destroyRect();
      return this;
    };

    if (layoutBox instanceof LayoutRegion) {
      // Create dummy ocr data for the order box
      const pageObj = new ocr.OcrPage(cp.n, { width: 1, height: 1 });
      const box = {
        left: 0, right: 0, top: 0, bottom: 0,
      };
      const lineObjTemp = new ocr.OcrLine(pageObj, box, [0, 0], 10, null);
      pageObj.lines = [lineObjTemp];
      const wordIDNew = getRandomAlphanum(10);
      const wordObj = new ocr.OcrWord(lineObjTemp, String(layoutBox.order), box, wordIDNew);
      wordObj.visualCoords = false;
      wordObj.size = 50;
      const label = new KonvaIText({
        x: origX + width * 0.5,
        yActual: origY + height * 0.5,
        word: wordObj,
        dynamicWidth: true,
        editTextCallback: async (obj) => {
          layoutBox.order = parseInt(obj.word.text);
        },
      });
      this.label = label;
    }

    this.layoutBox = layoutBox;

    this.addEventListener('transformend', () => {
      KonvaLayout.updateLayoutBoxes(this);
    });

    this.addEventListener('dragmove', () => {
      if (CanvasObjs.input && CanvasObjs.input.parentElement && CanvasObjs.inputRemove) CanvasObjs.inputRemove();
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
    const enabledAnchors = ['middle-left', 'middle-right', 'top-center', 'bottom-center'];

    if (konvaLayout instanceof KonvaDataColumn && konvaLayout.konvaTable.lockColumns) {
      // const enabledAnchorsTable = ['top-center', 'bottom-center'];
      const trans = new Konva.Transformer({
        enabledAnchors,
        rotateEnabled: false,
      });
      CanvasObjs.controlArr.push(trans);
      layerOverlay.add(trans);
      trans.nodes([konvaLayout.konvaTable.tableRect]);
      return;
    }

    const trans = new Konva.Transformer({
      enabledAnchors,
      rotateEnabled: false,
    });
    CanvasObjs.controlArr.push(trans);
    layerOverlay.add(trans);

    trans.nodes([konvaLayout]);
  };

  /**
   * Add controls for editing.
   * @param {KonvaLayout|KonvaDataColumn} konvaLayout
   */
  static updateLayoutBoxes(konvaLayout) {
    const width = konvaLayout.width() * konvaLayout.scaleX();
    const height = konvaLayout.height() * konvaLayout.scaleY();
    const right = konvaLayout.x() + width;
    const bottom = konvaLayout.y() + height;
    konvaLayout.layoutBox.coords = {
      left: konvaLayout.x(), top: konvaLayout.y(), right, bottom,
    };
    updateDataPreview();
  }

  /**
   * Update the UI to reflect the properties of the selected objects.
   * Should be called after new objects are selected.
   */
  static updateUI = () => {
    const { inclusionRuleArr, inclusionLevelArr } = CanvasObjs.CanvasSelection.getLayoutBoxProperties();

    if (inclusionRuleArr.length === 1) {
      setLayoutBoxInclusionRuleMajorityElem.checked = inclusionRuleArr[0] === 'majority';
      setLayoutBoxInclusionRuleLeftElem.checked = inclusionRuleArr[0] === 'left';
    } else {
      setLayoutBoxInclusionRuleMajorityElem.checked = false;
      setLayoutBoxInclusionRuleLeftElem.checked = false;
    }

    if (inclusionLevelArr.length === 1) {
      setLayoutBoxInclusionLevelWordElem.checked = inclusionLevelArr[0] === 'word';
      setLayoutBoxInclusionLevelLineElem.checked = inclusionLevelArr[0] === 'line';
    } else {
      setLayoutBoxInclusionLevelWordElem.checked = false;
      setLayoutBoxInclusionLevelLineElem.checked = false;
    }
  };
}

export class KonvaDataColSep extends Konva.Line {
  /**
   *
   * @param {KonvaDataColumn} columnLeft
   * @param {KonvaDataColumn} columnRight
   * @param {KonvaDataTable} konvaTable
   */
  constructor(columnLeft, columnRight, konvaTable) {
    super({
      x: columnRight.layoutBox.coords.left,
      y: columnRight.layoutBox.coords.top,
      points: [0, 0, 0, konvaTable.coords.bottom - konvaTable.coords.top],
      stroke: 'black',
      strokeWidth: 1,
      draggable: true,
      dragBoundFunc(pos) {
        const newX = Math.max(this.boundLeft, Math.min(this.boundRight, pos.x));

        // Restrict vertical movement by setting the y position to the initial y position.
        return {
          x: newX,
          y: this.absolutePosition().y,
        };
      },
      hitFunc(context, shape) {
        context.beginPath();
        context.rect(-5, 0, 5, shape.height());
        context.closePath();
        context.fillStrokeShape(shape);
      },

    });

    this.next = () => {
      const next = this.konvaTable.colLines.find((x) => x.x() > this.x());
      return next;
    };

    this.prev = () => {
      const prev = this.konvaTable.colLines.slice().reverse().find((x) => x.x() < this.x());
      return prev;
    };

    this.boundLeft = konvaTable.tableRect.absolutePosition().x;
    this.boundRight = konvaTable.tableRect.absolutePosition().x + (konvaTable.tableRect.width() * konvaTable.tableRect.getAbsoluteScale().x);

    this.konvaTable = konvaTable;
    this.columnLeft = columnLeft;
    this.columnRight = columnRight;

    this.on('dragstart', () => {
      const tableWidthAbsolute = konvaTable.tableRect.width() * konvaTable.tableRect.getAbsoluteScale().x;
      const boundLeftTable = konvaTable.tableRect.absolutePosition().x;
      const boundRightTable = konvaTable.tableRect.absolutePosition().x + tableWidthAbsolute;

      const boundLeftNeighbor = this.prev()?.absolutePosition()?.x;
      const boundRightNeighbor = this.next()?.absolutePosition()?.x;

      const boundLeftRaw = boundLeftNeighbor ?? boundLeftTable;
      const boundRightRaw = boundRightNeighbor ?? boundRightTable;

      // Add minimum width between columns to prevent lines from overlapping.
      const minColWidthAbs = Math.min((boundRightRaw - boundLeftRaw) / 3, 10);

      this.boundLeft = boundLeftRaw + minColWidthAbs;
      this.boundRight = boundRightRaw - minColWidthAbs;
    });
    this.addEventListener('dragmove', () => {
      this.columnLeft.layoutBox.coords.right = this.x();
      this.columnRight.layoutBox.coords.left = this.x();

      this.columnLeft.width(this.columnLeft.layoutBox.coords.right - this.columnLeft.layoutBox.coords.left);
      this.columnRight.x(this.columnRight.layoutBox.coords.left);
      this.columnRight.width(this.columnRight.layoutBox.coords.right - this.columnRight.layoutBox.coords.left);
    });
    this.addEventListener('dragend', () => {
      KonvaDataTable.colorTableWords(this.konvaTable);
    });

    this.on('mouseover', () => {
      document.body.style.cursor = 'col-resize';
    });
    this.on('mouseout', () => {
      document.body.style.cursor = 'default';
    });
  }
}

export class KonvaDataColumn extends KonvaLayout {
  /**
   *
   * @param {LayoutDataColumn} layoutBox
   * @param {KonvaDataTable} konvaTable
   */
  constructor(layoutBox, konvaTable) {
    super(layoutBox);
    // Overwrite layoutBox so type inference works correctly, and `layoutBox` gets type `LayoutDataColumn` instead of `LayoutBox`.
    this.layoutBox = layoutBox;
    this.konvaTable = konvaTable;
    this.draggable(false);
    this.select = () => {
      this.fill(setAlpha(this.fill(), 0.5));
      this.fillEnabled(true);
    };
    this.deselect = () => {
      this.fill(setAlpha(this.fill(), 0.3));
      this.strokeEnabled(false);
    };

    /**
     * Delete the column, both from the layout data and from the canvas.
     */
    this.delete = () => {
      const colIndexI = this.layoutBox.table.boxes.findIndex((x) => x.id === this.layoutBox.id);
      this.layoutBox.table.boxes.splice(colIndexI, 1);
      this.destroy();
      if (this.layoutBox.table.boxes.length === 0) {
        const tableIndex = layoutDataTableAll[cp.n].tables.findIndex((x) => x.id === this.layoutBox.table.id);
        layoutDataTableAll[cp.n].tables.splice(tableIndex, 1);
        this.konvaTable.destroy();
      }
    };

    this.next = () => {
      const next = this.konvaTable.columns.find((x) => x.x() > this.x());
      return next;
    };

    this.prev = () => {
      const prev = this.konvaTable.columns.slice().reverse().find((x) => x.x() < this.x());
      return prev;
    };
  }
}

export class KonvaDataTable {
  /**
   * @param {OcrPage|undefined} pageObj - The page object that the table is on.
   *    This can be undefined in the fringe case where the user makes layout boxes without any OCR data.
   * @param {import('../objects/layoutObjects.js').LayoutDataTable} layoutDataTable
   * @param {boolean} [lockColumns=true]
   */
  constructor(pageObj, layoutDataTable, lockColumns = true) {
    // The `columns` array is expected to be sorted left to right in other code.
    this.layoutBoxesArr = Object.values(layoutDataTable.boxes).sort((a, b) => a.coords.left - b.coords.left);

    const tableLeft = Math.min(...this.layoutBoxesArr.map((x) => x.coords.left));
    const tableRight = Math.max(...this.layoutBoxesArr.map((x) => x.coords.right));
    const tableTop = Math.min(...this.layoutBoxesArr.map((x) => x.coords.top));
    const tableBottom = Math.max(...this.layoutBoxesArr.map((x) => x.coords.bottom));
    const tableWidth = tableRight - tableLeft;
    const tableHeight = tableBottom - tableTop;

    this.coords = {
      left: tableLeft, top: tableTop, right: tableRight, bottom: tableBottom,
    };

    const tableRect = new Konva.Rect({
      x: tableLeft,
      y: tableTop,
      width: tableWidth,
      height: tableHeight,
      stroke: 'rgba(40,123,181,1)',
      strokeWidth: 5,
      draggable: false,
    });

    this.pageObj = pageObj;

    this.layoutDataTable = layoutDataTable;
    this.lockColumns = lockColumns;

    this.tableRect = tableRect;

    layerOverlay.add(tableRect);

    this.columns = this.layoutBoxesArr.map((layoutBox) => new KonvaDataColumn(layoutBox, this));

    this.columns.forEach((column) => {
      layerOverlay.add(column);
    });

    /**
     * Removes the table from the canvas.
     * Does not impact the underlying data.
     */
    this.destroy = () => {
      this.tableRect.destroy();
      this.columns.forEach((column) => column.destroy());
      this.colLines.forEach((colLine) => colLine.destroy());
      this.rowLines.forEach((rowLine) => rowLine.destroy());
      this.rowSpans.forEach((rowSpan) => rowSpan.destroy());
      return this;
    };

    /**
     * Delete the table, both from the layout data and from the canvas.
    */
    this.delete = () => {
      const tableIndex = layoutDataTableAll[cp.n].tables.findIndex((x) => x.id === this.layoutDataTable.id);
      layoutDataTableAll[cp.n].tables.splice(tableIndex, 1);
      this.destroy();
    };

    this.tableRect.addEventListener('transform', () => {
      KonvaDataTable.updateTableBoxVertical(this);
    });

    this.tableRect.addEventListener('transformend', () => {
      // `KonvaDataTable.updateTableBoxHorizontal` deletes data, so is only run once after the user finishes resizing the table.
      KonvaDataTable.updateTableBoxHorizontal(this);
      renderLayoutDataTable(this.layoutDataTable);
      layerOverlay.batchDraw();
    });

    /** @type {Array<KonvaDataColSep>} */
    this.colLines = [];
    for (let i = 1; i < this.columns.length; i++) {
      const colLine = new KonvaDataColSep(this.columns[i - 1], this.columns[i], this);
      this.colLines.push(colLine);
      layerOverlay.add(colLine);
    }

    /** @type {Array<InstanceType<typeof Konva.Line>>} */
    this.rowLines = [];

    this.rowSpans = [];

    if (pageObj) {
      const tableWordObj = extractSingleTableContent(pageObj, this.layoutBoxesArr);

      this.rowLines = tableWordObj.rowBottomArr.map((rowBottom) => new Konva.Line({
        points: [tableLeft, rowBottom, tableRight, rowBottom],
        stroke: 'rgba(0,0,0,0.25)',
        strokeWidth: 1,
      }));

      KonvaDataTable.colorTableWords(this, tableWordObj);

      this.rowLines.forEach((rowLine) => {
        layerOverlay.add(rowLine);
      });
    }

    layerOverlay.batchDraw();

    updateDataPreview();
  }

  /**
   * Calculate what words are in each column and color them accordingly.
   * @param {KonvaDataTable} konvaDataTable
   * @param {ReturnType<typeof extractSingleTableContent>} [tableWordObj] - The words in the table, if already calculated.
   *    If not provided, this function will calculate them. This is an expensive operation, so should not be done repeatedly without reason.
   */
  static colorTableWords(konvaDataTable, tableWordObj) {
    if (!konvaDataTable.pageObj) return;

    if (!tableWordObj) tableWordObj = extractSingleTableContent(konvaDataTable.pageObj, konvaDataTable.layoutBoxesArr);

    konvaDataTable.rowSpans.forEach((rowSpan) => rowSpan.destroy());

    /** @type {Array<Array<string>>} */
    const colWordIdArr = [];
    for (let i = 0; i < konvaDataTable.columns.length; i++) {
      colWordIdArr.push([]);
    }

    for (let i = 0; i < tableWordObj.rowWordArr.length; i++) {
      const row = tableWordObj.rowWordArr[i];
      for (let j = 0; j < row.length; j++) {
        const wordArr = row[j];
        if (wordArr.length === 0) continue;
        colWordIdArr[j].push(...wordArr.map((word) => (word.id)));
        const wordBoxArr = wordArr.map((word) => word.bbox);
        const spanBox = ocr.calcBboxUnion(wordBoxArr);
        const colorBase = colColorsHex[j % colColorsHex.length];
        const fillCol = hexToRgba(colorBase, 0.3);
        const stroke = fillCol;

        const rowSpan = new Konva.Rect({
          x: spanBox.left,
          y: spanBox.top,
          width: spanBox.right - spanBox.left,
          height: spanBox.bottom - spanBox.top,
          fill: fillCol,
          stroke,
          strokeWidth: 1,
        });
        konvaDataTable.rowSpans.push(rowSpan);
        layerOverlay.add(rowSpan);
      }
    }

    const canvasWords = getCanvasWords();
    for (let i = 0; i < colWordIdArr.length; i++) {
      const colWordIndex = colWordIdArr[i];
      const colorBase = colColorsHex[i % colColorsHex.length];
      const fillCol = setAlpha(colorBase, 1);
      // const fillCol = colColors[i % colColors.length].replace(/,[\d.]+\)/, ',1)');
      canvasWords.filter((x) => colWordIndex.includes(x.word.id)).forEach((x) => {
        x.fill(fillCol);
        x.opacity(1);
      });
    }
  }

  /**
   * Add controls for editing.
   * @param {KonvaDataTable} konvaDataTable
   */
  static updateTableBoxHorizontal(konvaDataTable) {
    const width = konvaDataTable.tableRect.width() * konvaDataTable.tableRect.scaleX();
    const right = konvaDataTable.tableRect.x() + width;

    const leftDelta = konvaDataTable.tableRect.x() - konvaDataTable.coords.left;
    const rightDelta = right - konvaDataTable.coords.right;

    if (leftDelta === 0 && rightDelta === 0) return;

    konvaDataTable.coords.left = konvaDataTable.tableRect.x();
    konvaDataTable.coords.right = right;

    const leftMode = Math.abs(leftDelta) > Math.abs(rightDelta);

    // The code below assumes that the columns are sorted left to right.
    konvaDataTable.columns.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);

    if (leftMode) {
      for (let i = 0; i < konvaDataTable.columns.length; i++) {
        if (konvaDataTable.columns[i].layoutBox.coords.right < (konvaDataTable.tableRect.x() + 10)) {
          // Delete any columns that are now outside the table.
          konvaDataTable.columns[i].delete();
        } else {
          // Update the leftmost column to reflect the new table position.
          konvaDataTable.columns[i].layoutBox.coords.left = konvaDataTable.tableRect.x();
          break;
        }
      }
    } else {
      for (let i = konvaDataTable.columns.length - 1; i >= 0; i--) {
        if (konvaDataTable.columns[i].layoutBox.coords.left > (right - 10)) {
          // Delete any columns that are now outside the table.
          konvaDataTable.columns[i].delete();
        } else {
          // Update the rightmost column to reflect the new table position.
          konvaDataTable.columns[i].layoutBox.coords.right = right;
          break;
        }
      }
    }

    layerOverlay.batchDraw();
  }

  /**
   * Add controls for editing.
   * @param {KonvaDataTable} konvaDataTable
   */
  static updateTableBoxVertical(konvaDataTable) {
    const height = konvaDataTable.tableRect.height() * konvaDataTable.tableRect.scaleY();
    const bottom = konvaDataTable.tableRect.y() + height;

    const topDelta = konvaDataTable.tableRect.y() - konvaDataTable.coords.top;
    const bottomDelta = bottom - konvaDataTable.coords.bottom;

    if (topDelta === 0 && bottomDelta === 0) return;

    konvaDataTable.coords.top = konvaDataTable.tableRect.y();
    konvaDataTable.coords.bottom = bottom;

    konvaDataTable.columns.forEach((column) => {
      column.layoutBox.coords.top += topDelta;
      column.layoutBox.coords.bottom += bottomDelta;
      column.y(column.y() + topDelta);
      column.height(column.height() - topDelta + bottomDelta);
    });

    konvaDataTable.colLines.forEach((colLine) => {
      const points = colLine.points();
      colLine.y(konvaDataTable.coords.top);
      colLine.points([points[0], points[1], points[2], konvaDataTable.coords.bottom - konvaDataTable.coords.top]);
    });

    layerOverlay.batchDraw();
  }
}

/**
 * Render a layout data table on the canvas.
 * If the data table already exists on the canvas, it is automatically removed.
 * @param {import('../objects/layoutObjects.js').LayoutDataTable} layoutDataTable
 */
function renderLayoutDataTable(layoutDataTable) {
  if (!layoutDataTable || Object.keys(layoutDataTable.boxes).length === 0) {
    console.log(`Skipping table ${layoutDataTable?.id} as it has no boxes`);
    return;
  }
  const konvaLayoutExisting = CanvasObjs.layoutDataTableArr.find((x) => x.layoutDataTable.id === layoutDataTable.id);
  if (konvaLayoutExisting) CanvasObjs.destroyLayoutDataTablesById(konvaLayoutExisting.layoutDataTable.id);

  const konvaLayout = new KonvaDataTable(ocrAll.active[cp.n], layoutDataTable);
  CanvasObjs.layoutDataTableArr.push(konvaLayout);
}

export function renderLayoutDataTables() {
  if (!layoutDataTableAll[cp.n].tables) return;
  CanvasObjs.destroyLayoutDataTables();
  Object.values(layoutDataTableAll[cp.n].tables).forEach((table) => {
    renderLayoutDataTable(table);
  });

  layerOverlay.batchDraw();
}

/**
 *
 * @param {Array<KonvaDataColumn>} selectedDataColumns
 * @returns
 */
export const checkDataColumnsAdjacent = (selectedDataColumns) => {
  selectedDataColumns.sort((a, b) => a.x() - b.x());
  const selectedDataColumnsIds = selectedDataColumns.map((x) => x.layoutBox.id);
  let colI = selectedDataColumns[0];
  let adjacent = true;
  for (let i = 1; i < selectedDataColumns.length; i++) {
    const colINext = colI.next();
    if (!colINext || !selectedDataColumnsIds.includes(colINext.layoutBox.id)) {
      adjacent = false;
      break;
    }
    colI = colINext;
  }
  return adjacent;
};

/**
 *
 * @param {LayoutDataTable} table
 */
const getAdjacentTables = (table) => {
  const adjacentTables = [];

  const tableBox = calcTableBbox(table);

  const tableYMid = (tableBox.top + tableBox.bottom) / 2;

  // Filter to tables that have vertial overlap, and sort by horizontal position.
  const tablesBoxesAll = layoutDataTableAll[cp.n].tables.map((x) => calcTableBbox(x));
  const tables = layoutDataTableAll[cp.n].tables.filter((x, i) => tablesBoxesAll[i].top < tableYMid && tablesBoxesAll[i].bottom > tableYMid).sort((a, b) => {
    const boxA = calcTableBbox(a);
    const boxB = calcTableBbox(b);
    return boxA.left - boxB.left;
  });

  const index = tables.findIndex((x) => x.id === table.id);

  if (index > 0) adjacentTables.push(tables[index - 1]);
  if (index < tables.length - 1) adjacentTables.push(tables[index + 1]);
  return adjacentTables;
};

/**
 *
 * @param {Array<LayoutDataTable>} dataTables
 * @returns
 */
export const checkDataTablesAdjacent = (dataTables) => {
  for (let i = 0; i < dataTables.length - 1; i++) {
    const table = dataTables[i];
    const tableNext = dataTables[i + 1];
    const adjacentTableIds = getAdjacentTables(table).map((x) => x.id);

    if (!adjacentTableIds.includes(tableNext.id)) {
      return false;
    }
  }

  return true;
};

/**
 *
 * @param {Array<KonvaDataColumn>} columns
 */
export const mergeDataColumns = (columns) => {
  // Double-check that columns are adjacent before merging.
  // The selection may change between the time when the user clicks the context menu and when this function is called.
  if (!columns || columns.length < 2 || !checkDataColumnsAdjacent(columns)) return;

  // Make copy so `.delete()` doesn't affect the loop.
  columns = columns.slice();

  const table = columns[0].konvaTable.layoutDataTable;

  // Expand leftmost column to include the width of all columns.
  columns.sort((a, b) => a.x() - b.x());
  columns[0].layoutBox.coords.right = columns[columns.length - 1].layoutBox.coords.right;

  for (let i = 1; i < columns.length; i++) {
    columns[i].delete();
  }

  columns[0].konvaTable.destroy();
  renderLayoutDataTable(table);
};

/**
 *
 * @param {Array<LayoutDataTable>} tables
 */
export const mergeDataTables = (tables) => {
  // Double-check that columns are adjacent before merging.
  // The selection may change between the time when the user clicks the context menu and when this function is called.
  if (!tables || tables.length < 2 || !checkDataTablesAdjacent(tables)) return;

  const tableFirst = tables[0];

  for (let i = 1; i < tables.length; i++) {
    tables[i].boxes.forEach((x) => {
      x.table = tableFirst;
      tableFirst.boxes.push(x);
    });
    const tableIndex = layoutDataTableAll[cp.n].tables.findIndex((x) => x.id === tables[i].id);
    layoutDataTableAll[cp.n].tables.splice(tableIndex, 1);
  }

  cleanLayoutDataColumns(tableFirst);

  renderLayoutBoxes();
  updateDataPreview();
};

/**
 *
 * @param {KonvaDataColumn} column
 * @param {number} x - Point to split the column at
 */
export const splitDataColumn = (column, x) => {
  if (!column) return;

  // Add minimum width between columns to prevent lines from overlapping.
  const minColWidthAbs = Math.min((column.layoutBox.coords.right - column.layoutBox.coords.left) / 3, 10);

  // If the split point is outside the column, split at the center.
  if (x <= (column.layoutBox.coords.left + minColWidthAbs) || x >= (column.layoutBox.coords.right - minColWidthAbs)) {
    x = Math.round(column.layoutBox.coords.left + (column.layoutBox.coords.right - column.layoutBox.coords.left) / 2);
  }

  const bboxLeft = {
    left: column.layoutBox.coords.left, top: column.layoutBox.coords.top, right: x, bottom: column.layoutBox.coords.bottom,
  };
  const bboxRight = {
    left: x, top: column.layoutBox.coords.top, right: column.layoutBox.coords.right, bottom: column.layoutBox.coords.bottom,
  };

  column.layoutBox.coords = bboxLeft;

  const layoutBoxLeft = new LayoutDataColumn(bboxRight, column.layoutBox.table);

  column.konvaTable.layoutDataTable.boxes.push(layoutBoxLeft);

  column.konvaTable.layoutDataTable.boxes.sort((a, b) => a.coords.left - b.coords.left);

  column.konvaTable.destroy();
  renderLayoutDataTable(column.konvaTable.layoutDataTable);
};

/**
 * Splits a table into two or three tables.
 * All columns in `columns` are inserted into a new table, all columns to the left of `columns` are inserted into a new table,
 * and all columns to the right of `columns` are inserted into a new table.
 * The old table is removed.
 * @param {Array<KonvaDataColumn>} columns
 */
export const splitDataTable = (columns) => {
  // For this function to be run, `columns` must be a subset of the columns in a single table, and the columns must be adjacent.
  if (!columns || columns.length === 0 || columns.length === columns[0].layoutBox.table.boxes.length || !checkDataColumnsAdjacent(columns)) return;

  columns.sort((a, b) => a.x() - b.x());

  const layoutDataColumns0 = columns[0].layoutBox.table.boxes.filter((x) => x.coords.left < columns[0].layoutBox.coords.left);
  const layoutDataColumns1 = columns.map((x) => x.layoutBox);
  const layoutDataColumns2 = columns[0].layoutBox.table.boxes.filter((x) => x.coords.left > columns[columns.length - 1].layoutBox.coords.left);

  // Remove old table
  const tableExisting = layoutDataColumns1[0].table;
  const tableIndex = layoutDataTableAll[cp.n].tables.findIndex((x) => x.id === tableExisting.id);
  layoutDataTableAll[cp.n].tables.splice(tableIndex, 1);

  [layoutDataColumns0, layoutDataColumns1, layoutDataColumns2].forEach((layoutDataColumns) => {
    if (layoutDataColumns.length === 0) return;

    const table = new LayoutDataTable();

    layoutDataColumns.forEach((layoutDataColumn) => {
      layoutDataColumn.table = table;
      table.boxes.push(layoutDataColumn);
    });

    layoutDataTableAll[cp.n].tables.push(table);
  });

  renderLayoutDataTables();
};

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
 * @param {Array<string>} layoutBoxIdArr
 */
export function selectLayoutBoxesById(layoutBoxIdArr) {
  const konvaLayoutBoxes = CanvasObjs.layoutBoxArr.filter((x) => layoutBoxIdArr.includes(x.layoutBox.id));

  CanvasObjs.layoutDataTableArr.forEach((table) => {
    table.columns.forEach((column) => {
      if (layoutBoxIdArr.includes(column.layoutBox.id)) konvaLayoutBoxes.push(column);
    });
  });

  selectLayoutBoxes(konvaLayoutBoxes);
}

/**
 *
 * @param {Array<KonvaLayout>} konvaLayoutBoxes
 */
export function selectLayoutBoxes(konvaLayoutBoxes) {
  const selectedLayoutBoxes = CanvasObjs.CanvasSelection.getKonvaLayoutBoxes();
  const selectedDataColumns = CanvasObjs.CanvasSelection.getKonvaDataColumns();

  CanvasObjs.CanvasSelection.addKonvaLayoutBoxes(konvaLayoutBoxes);

  // Boxes can only be resized one at a time
  if (konvaLayoutBoxes.length === 1) KonvaLayout.addControls(konvaLayoutBoxes[0]);

  selectedDataColumns.forEach((shape) => (shape.select()));
  selectedLayoutBoxes.forEach((shape) => (shape.select()));
}

/**
 *
 * @param {LayoutDataColumn|LayoutRegion} layoutBox
 */
function renderLayoutBox(layoutBox) {
  const konvaLayout = new KonvaLayout(layoutBox);
  CanvasObjs.layoutBoxArr.push(konvaLayout);
  layerOverlay.add(konvaLayout);
  if (konvaLayout.label) layerOverlay.add(konvaLayout.label);
}

// Update tabular data preview table
// Should be run (1) on edits (to either OCR data or layout), (2) when a new page is rendered,
// or (3) when settings are changed to enable/disable tabular export mode.
export async function updateDataPreview() {
  // Disable this function for now.
  // No HTML preview pane currently exists.
  return;

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

  const { extractTableContent, createCells, extractSingleTableContent } = (await import('../exportWriteTabular.js'));

  const tableWordObj = extractTableContent(ocrAll.active[cp.n], layoutDataTableAll[cp.n]);

  for (const [key, value] of Object.entries(tableWordObj)) {
    const boxes = Object.values(layoutAll[cp.n].boxes).filter((x) => String(x.table) === key);
    const tableLeft = Math.min(...boxes.map((x) => x.coords.left));
    const tableRight = Math.max(...boxes.map((x) => x.coords.right));

    value.rowBottomArr.forEach((rowBottom) => {
      const rowLine = new Konva.Line({
        points: [tableLeft, rowBottom, tableRight, rowBottom],
        stroke: 'black',
        strokeWidth: 1,
      });
      layerOverlay.add(rowLine);
    });
  }

  layerOverlay.batchDraw();

  dataPreviewElem.innerHTML = createCells(tableWordObj, extraCols, 0, false, true).content;
}
