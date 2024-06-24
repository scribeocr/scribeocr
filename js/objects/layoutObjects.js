import { calcBboxUnion, getRandomAlphanum } from '../utils/miscUtils.js';

/**
 * Class representing a layout box.
 */
export class LayoutBoxBase {
  /**
   * Create a layout box.
   * @param {bbox} coords - The coordinates of the layout box.
   */
  constructor(coords) {
    /** @type {string} */
    this.id = getRandomAlphanum(10);
    /** @type {bbox} */
    this.coords = coords;
    /** @type {string} */
    this.inclusionRule = 'majority';
    /** @type {string} */
    this.inclusionLevel = 'word';
  }
}

export class LayoutDataColumn extends LayoutBoxBase {
  /**
   * Create a layout data column.
   * @param {bbox} coords - The coordinates of the layout data column.
   * @param {LayoutDataTable} table - The layout data table to which the column belongs.
   */
  constructor(coords, table) {
    super(coords);
    this.type = 'dataColumn';
    this.table = table;
  }
}

export class LayoutRegion extends LayoutBoxBase {
  /**
   * Create a layout data column.
   * @param {number} priority - The priority of the layout data column.
   * @param {bbox} coords - The coordinates of the layout data column.
   * @param {('order'|'exclude')} type - The type of the layout region.
   */
  constructor(priority, coords, type) {
    super(coords);
    this.type = type;
    this.order = priority;
  }
}

export function LayoutPage() {
  /** @type {boolean} */
  this.default = true;
  /** @type {Object<string, LayoutRegion>} */
  this.boxes = {};
}

/**
 *
 * @param {LayoutDataTable} table
 */
export const calcTableBbox = (table) => {
  const boxesBboxArr = table.boxes.map((box) => box.coords);
  return calcBboxUnion(boxesBboxArr);
};

/**
 * Class representing a layout data table.
 */
export class LayoutDataTable {
  /**
   * Create a layout data table.
   */
  constructor() {
    this.id = getRandomAlphanum(10);

    /** @type {Array<LayoutDataColumn>} */
    this.boxes = [];
  }
}

export function LayoutDataTablePage() {
  /** @type {boolean} */
  this.default = true;
  /** @type {Array<LayoutDataTable>} */
  this.tables = [];
}
