/* eslint-disable import/no-cycle */

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

  /** @type {Array<{left: number, right: number}>} */
  const columnBounds = [];

  // Sort bounding boxes by their left edge
  boundingBoxes.sort((a, b) => a.left - b.left);

  boundingBoxes.forEach((box) => {
    let addedToColumn = false;

    for (const column of columnBounds) {
      // Check if the bounding box overlaps horizontally with the column
      if (
        box.left <= column.right + tolerance
              && box.right >= column.left - tolerance
      ) {
        // Update column bounds
        column.left = Math.min(column.left, box.left);
        column.right = Math.max(column.right, box.right);
        addedToColumn = true;
        break;
      }
    }

    // If not added to any existing column, create a new column
    if (!addedToColumn) {
      columnBounds.push({
        left: box.left,
        right: box.right,
      });
    }
  });

  return columnBounds;
}

/**
 * @param {number} n - Page number.
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.left
 * @param {number} box.top
 */
export function addLayoutDataTableClick(n, box) {
  const bbox = {
    left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height,
  };

  const lines = scribe.data.ocr.active[n].lines.filter((line) => scribe.utils.calcBoxOverlap(line.bbox, bbox) > 0.5);

  let columnBboxArr;
  if (lines.length > 0) {
    const lineBoxes = lines.map((line) => line.bbox);
    const columnBoundArr = calculateColumnBounds(lineBoxes);
    columnBboxArr = columnBoundArr.map((column) => ({
      left: column.left,
      top: bbox.top,
      right: column.right,
      bottom: bbox.bottom,
    }));

    // Expand column bounds so there is no empty space between columns.
    columnBboxArr[0].left = bbox.left;
    columnBboxArr[columnBboxArr.length - 1].right = bbox.right;
    for (let i = 0; i < columnBboxArr.length - 1; i++) {
      const boundRight = (columnBboxArr[i].right + columnBboxArr[i + 1].left) / 2;
      columnBboxArr[i].right = boundRight;
      columnBboxArr[i + 1].left = boundRight;
    }
  } else {
    columnBboxArr = [{ ...bbox }];
  }

  const dataTable = new scribe.layout.LayoutDataTable(scribe.data.layoutDataTables.pages[n]);

  columnBboxArr.forEach((columnBbox) => {
    const layoutBox = new scribe.layout.LayoutDataColumn(columnBbox, dataTable);
    dataTable.boxes.push(layoutBox);
  });

  scribe.data.layoutDataTables.pages[n].tables.push(dataTable);

  scribe.data.layoutRegions.pages[n].default = false;
  scribe.data.layoutDataTables.pages[n].default = false;

  renderLayoutDataTable(dataTable);
}

/**
 * @param {number} n - Page number.
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.left
 * @param {number} box.top
 */
export function addLayoutBoxClick(n, box, type) {
  layoutBoxTypeElem.textContent = { order: 'Order', exclude: 'Exclude' }[type];

  // Maximum priority for boxes that already exist
  const maxPriority = Math.max(...Object.values(scribe.data.layoutRegions.pages[n].boxes).map((layoutRegion) => layoutRegion.order), -1);

  const bbox = {
    left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height,
  };

  const region = new scribe.layout.LayoutRegion(scribe.data.layoutRegions.pages[n], maxPriority + 1, bbox, type);

  scribe.data.layoutRegions.pages[n].boxes[region.id] = region;

  renderLayoutBoxes(n);
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
