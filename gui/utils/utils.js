/**
 * Adds or removes CSS attribute `display:none` for HTML element.
 * @param {HTMLElement} elem
 * @param {boolean} show
 */
export const showHideElem = (elem, show = true) => {
  const styleCurrent = elem?.getAttribute('style');
  let styleNew = styleCurrent?.replace(/display\s*:\s*\w+/, '')?.replace(/;{2,}/g, ';') || '';
  if (!show) styleNew += ';display:none;';

  elem?.setAttribute('style', styleNew);
};

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
