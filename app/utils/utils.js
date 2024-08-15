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

/**
 * Saves a Blob or a string URL as a file to the user's computer.
 * Modified version of code found in FileSaver.js.
 *
 * @global
 * @param {string|ArrayBuffer} content
 * @param {string} fileName - File name.
 */
export const saveAs = async (content, fileName) => {
  if (typeof process !== 'undefined') {
    const { promises: fsPromises } = await import('fs');
    await fsPromises.writeFile(fileName, content);
    return;
  }

  const blob = new Blob([content], { type: 'application/octet-stream' });

  const a = document.createElement('a');
  a.download = fileName;
  a.href = globalThis.URL.createObjectURL(blob);
  a.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
};
