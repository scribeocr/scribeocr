/**
 * @param {string} id
 * @param {number} priority
 * @param {bbox} coords
 */
export function LayoutBox(id, priority, coords) {
  /** @type {string} */
  this.id = id;
  /** @type {number} */
  this.priority = priority;
  /** @type {bbox} */
  this.coords = coords;
  /** @type {string} */
  this.type = 'order';
  /** @type {number} */
  this.table = 0;
  /** @type {string} */
  this.inclusionRule = 'majority';
  /** @type {string} */
  this.inclusionLevel = 'word';
}

export function LayoutPage() {
  /** @type {boolean} */
  this.default = true;
  /** @type {Object<string, LayoutBox>} */
  this.boxes = {};
}

/**
 *
 * @param {number} id
 */
export function LayoutDataTable(id) {
  /** @type {number} */
  this.id = id;
  /** @type {Object<string, LayoutBox>} */
  this.boxes = {};
}

export function LayoutDataTablePage() {
  /** @type {boolean} */
  this.default = true;
  /** @type {Object<string, LayoutDataTable>} */
  this.tables = {};
}
