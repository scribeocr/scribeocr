/**
 * @param {number} priority
 * @param {bbox} coords
 */
export function LayoutBox(priority, coords) {
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
