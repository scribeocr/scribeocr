export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 *
 * @param {number} min - First number in the range.
 * @param {number} max - Last number in the range (inclusive).
 * @returns
 * `range(1, 5)` returns `[1, 2, 3, 4, 5]`.
 */
export function range(min, max) {
  const result = [];
  for (let i = min; i <= max; i++) {
    result.push(i);
  }
  return result;
}

/**
 * Delete all properties from `obj` and replace with properties from `obj2`.
 * By default `obj2 = {}`, which clears `obj`.
 * @param {Object} obj
 * @param {Object} [obj2={}]
 */
export function replaceObjectProperties(obj, obj2 = {}) {
  for (const prop in obj) {
    if (Object.hasOwnProperty.call(obj, prop)) {
      delete obj[prop];
    }
  }
  Object.assign(obj, obj2);
}
