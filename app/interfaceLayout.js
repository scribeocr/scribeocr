/* eslint-disable import/no-cycle */
import Konva from './lib/konva/index.js';

import { displayPageGUI } from '../main.js';

import scribe from '../scribe.js/scribe.js';

import {
  ScribeCanvas,
  stateGUI,
} from '../viewer/viewerCanvas.js';

import {
  renderLayoutBoxes, renderLayoutDataTable,
} from '../viewer/viewerLayout.js';

const layoutBoxTypeElem = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

/**
 *
 * @param {Array<bbox>} boundingBoxes
 */
function calculateColumnBounds(boundingBoxes) {
  const tolerance = 5; // Adjust as needed
  const columns = [];

  // Sort bounding boxes by their left edge
  boundingBoxes.sort((a, b) => a.left - b.left);

  boundingBoxes.forEach((box) => {
    let addedToColumn = false;

    for (const column of columns) {
      // Check if the bounding box overlaps horizontally with the column
      if (
        box.left <= column.right + tolerance
              && box.right >= column.left - tolerance
      ) {
        // Update column bounds
        column.left = Math.min(column.left, box.left);
        column.right = Math.max(column.right, box.right);
        column.boxes.push(box);
        addedToColumn = true;
        break;
      }
    }

    // If not added to any existing column, create a new column
    if (!addedToColumn) {
      columns.push({
        left: box.left,
        right: box.right,
        boxes: [box],
      });
    }
  });

  // Extract column bounds
  return columns.map((column) => ({
    left: column.left,
    right: column.right,
  }));
}

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

  const lines = scribe.data.ocr.active[stateGUI.cp.n].lines.filter((line) => scribe.utils.calcBoxOverlap(line.bbox, bbox) > 0.5);
  const lineBoxes = lines.map((line) => line.bbox);
  const columnBoundArr = calculateColumnBounds(lineBoxes);
  const columnBboxArr = columnBoundArr.map((column) => ({
    left: column.left,
    top: bbox.top,
    right: column.right,
    bottom: bbox.bottom,
  }));

  if (columnBboxArr.length > 0) {
  // Expand column bounds so there is no empty space between columns.
    columnBboxArr[0].left = bbox.left;
    columnBboxArr[columnBboxArr.length - 1].right = bbox.right;
    for (let i = 0; i < columnBboxArr.length - 1; i++) {
      const boundRight = (columnBboxArr[i].right + columnBboxArr[i + 1].left) / 2;
      columnBboxArr[i].right = boundRight;
      columnBboxArr[i + 1].left = boundRight;
    }
  } else {
    columnBboxArr.push(bbox);
  }

  const dataTable = new scribe.layout.LayoutDataTable();

  columnBboxArr.forEach((columnBbox) => {
    const layoutBox = new scribe.layout.LayoutDataColumn(columnBbox, dataTable);
    dataTable.boxes.push(layoutBox);
  });

  scribe.data.layoutDataTables.pages[stateGUI.cp.n].tables.push(dataTable);

  scribe.data.layoutRegions.pages[stateGUI.cp.n].default = false;
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].default = false;

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
  const maxPriority = Math.max(...Object.values(scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes).map((box) => box.order), -1);

  const bbox = {
    left: x, top: y, right: x + width, bottom: y + height,
  };

  const region = new scribe.layout.LayoutRegion(maxPriority + 1, bbox, type);

  scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes[region.id] = region;

  renderLayoutBoxes();
}

export function toggleSelectableWords(selectable = true) {
  const allObjects = ScribeCanvas.getKonvaWords();
  allObjects.forEach((obj) => {
    obj.listening(selectable);
  });
}

export function setDefaultLayoutClick() {
  scribe.data.layoutRegions.defaultRegions = structuredClone(scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes);
  for (let i = 0; i < scribe.data.layoutRegions.pages.length; i++) {
    if (scribe.data.layoutRegions.pages[i].default) {
      scribe.data.layoutRegions.pages[i].boxes = structuredClone(scribe.data.layoutRegions.defaultRegions);
    }
  }
  setDefaultLayoutDataTableClick();
}

export function setDefaultLayoutDataTableClick() {
  scribe.data.layoutDataTables.defaultTables = structuredClone(scribe.data.layoutDataTables.pages[stateGUI.cp.n].tables);
  for (let i = 0; i < scribe.data.layoutDataTables.pages.length; i++) {
    if (scribe.data.layoutDataTables.pages[i].default) {
      scribe.data.layoutDataTables.pages[i].tables = structuredClone(scribe.data.layoutDataTables.defaultTables);
    }
  }
}

export function revertLayoutClick() {
  scribe.data.layoutRegions.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes = structuredClone(scribe.data.layoutRegions.defaultRegions);
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].tables = structuredClone(scribe.data.layoutDataTables.defaultTables);

  displayPageGUI(stateGUI.cp.n);
}

export function setLayoutBoxTypeClick(type) {
  const selectedLayoutBoxes = ScribeCanvas.CanvasSelection.getKonvaRegions();
  selectedLayoutBoxes.forEach((x) => {
    x.layoutBox.type = type;
  });

  renderLayoutBoxes();
}

export function setLayoutBoxInclusionRuleClick(rule) {
  // Save the selected boxes to reselect them after re-rendering.
  const selectedRegions = ScribeCanvas.CanvasSelection.getKonvaRegions();
  const selectedDataColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();

  const selectedArr = selectedRegions.map((x) => x.layoutBox.id);
  selectedArr.push(...selectedDataColumns.map((x) => x.layoutBox.id));

  let changed = false;
  selectedRegions.forEach((x) => {
    changed = changed || x.layoutBox.inclusionRule !== rule;
    x.layoutBox.inclusionRule = rule;
  });
  selectedDataColumns.forEach((x) => {
    changed = changed || x.layoutBox.inclusionRule !== rule;
    x.layoutBox.inclusionRule = rule;
  });

  if (changed) {
    renderLayoutBoxes();
    ScribeCanvas.CanvasSelection.selectLayoutBoxesById(selectedArr);
  }
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
  const shapes = ScribeCanvas.getKonvaLayoutBoxes();
  const layoutBoxes = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));

  ScribeCanvas.CanvasSelection.selectLayoutBoxes(layoutBoxes);
}
