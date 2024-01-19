/**
 * @param {number} priority
 * @param {Array<number>} coords
 */
export function LayoutBox(priority, coords) {
  /** @type {number} */
  this.priority = priority;
  /** @type {Array<number>} */
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
