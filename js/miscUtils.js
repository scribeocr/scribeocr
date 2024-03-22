// File summary:
// Various utility functions used in other files.

/**
 * Generates a random integer.
 *
 * @param {number} min - The minimum value (inclusive).
 * @param {number} max - The maximum value (exclusive).
 *
 * Taken from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
export function getRandomInt(min, max) {
  const minI = Math.ceil(min);
  const maxI = Math.floor(max);
  return Math.floor(Math.random() * (maxI - minI) + minI); // The maximum is exclusive and the minimum is inclusive
}

/**
 * Generates a random alphanumeric string of a specified length.
 *
 * @param {number} num - The length of the alphanumeric string to generate.
 */
export function getRandomAlphanum(num) {
  const outArr = new Array(num);
  for (let i = 0; i < num; i++) {
    let intI = getRandomInt(1, 62);
    if (intI <= 10) {
      intI += 47;
    } else if (intI <= 36) {
      intI = intI - 10 + 64;
    } else {
      intI = intI - 36 + 96;
    }
    outArr[i] = String.fromCharCode(intI);
  }
  return outArr.join('');
}

/**
 * Calculates the nth quantile of a given array of numbers.
 * @param {number[]} arr - The array of numbers.
 * @param {number} ntile - The quantile to calculate. Should be a value between 0 and 1.
 * @returns {number|null} The nth quantile value if the array is not empty; otherwise, null.
 */
export function quantile(arr, ntile) {
  if (arr.length === 0) {
    return null;
  }
  const arr1 = [...arr];
  const mid = Math.floor(arr.length * ntile);

  // Using sort() will convert numbers to strings by default
  arr1.sort((a, b) => a - b);

  return arr1[mid];
}

export const mean50 = (arr) => {
  if (arr.length === 0) {
    return null;
  }
  const per25 = Math.floor(arr.length / 4) - 1;
  const per75 = Math.ceil(arr.length * 3 / 4) - 1;
  const nums = [...arr].sort((a, b) => a - b);
  const numsMiddle = nums.slice(per25, per75 + 1);

  return numsMiddle.reduce((a, b) => a + b) / numsMiddle.length;
};

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Unescapes XML in a string
 * @param {String} string
 * @return {String}
 */
export function unescapeXml(string) {
  return string.replace(/&amp;/, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&#x2014;/g, '—')
    .replace(/&#x8211;/g, '–')
    .replace(/&#x201c;/g, '“')
    .replace(/&#x201d;/g, '”')
    .replace(/&#x2018;/g, '‘')
    .replace(/&#x2019;/g, '’')
    .replace(/&#xa7;/g, '§')
    // Soft hyphen
    .replace(/&#xad;/g, '-');
}

// Reads OCR files, which may be compressed as .gz or uncompressed

/**
 * Reads an OCR file, which may be compressed as .gz or uncompressed.
 *
 * @param {File|string} file - OCR file to read
 * @returns {Promise<string>} - Contents of file
 */
export async function readOcrFile(file) {
  const browserMode = typeof process === 'undefined';
  if (!browserMode) {
    const fs = await import('fs');
    return fs.readFileSync(file, 'utf8');
  }

  if (typeof file === 'string') {
    return Promise.resolve(file);
  } if (/\.gz$/i.test(file.name)) {
    return (readTextFileGz(file));
  }
  return (readTextFile(file));
}

/**
 * Reads the contents of a Gzip-compressed text file and returns them as a promise.
 *
 * @param {File} file - The File object representing the Gzip-compressed text file to read.
 * @returns {Promise<string>} A promise that resolves with the decompressed text content of the file
 *                           or rejects with an error if reading or decompression fails.
 */
async function readTextFileGz(file) {
  const pako = await import('../lib/pako.esm.min.js');
  return new Promise(async (resolve, reject) => {
    const zip1 = await file.arrayBuffer();
    const zip2 = await pako.inflate(zip1, { to: 'string' });
    resolve(zip2);
  });
}

/**
 * Reads the contents of a text file and returns them as a promise.
 *
 * @param {File} file - The File object representing the text file to read.
 * @returns {Promise<string>} A promise that resolves with the text content of the file
 *                           or rejects with an error if reading fails.
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function round3(x) {
  return (Math.round(x * 1e3) / 1e3);
}

/**
 * Rounds a number to six decimal places.
 * @param {number} x - The number to be rounded.
 * @returns {number} The rounded number.
 */
export function round6(x) {
  return (Math.round(x * 1e6) / 1e6);
}

/** Function that count occurrences of a substring in a string;
 * @param {String} string               The string
 * @param {String} subString            The sub string to search for
 * @param {Boolean} [allowOverlapping]  Optional. (Default:false)
 *
 * @author Vitim.us https://gist.github.com/victornpb/7736865
 * @see Unit Test https://jsfiddle.net/Victornpb/5axuh96u/
 * @see https://stackoverflow.com/a/7924240/938822
 */
export function occurrences(string, subString, allowOverlapping, caseSensitive = false) {
  string += '';
  subString += '';
  if (subString.length <= 0) return (string.length + 1);

  if (!caseSensitive) {
    string = string.toLowerCase();
    subString = subString.toLowerCase();
  }

  let n = 0;
  let pos = 0;
  const step = allowOverlapping ? 1 : subString.length;

  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }
  return n;
}

// Modified version of code found in FileSaver.js

/**
 * Saves a Blob or a string URL as a file to the user's computer.
 * Modified version of code found in FileSaver.js.
 *
 * @global
 * @param {Blob} blob - The Blob object to save as a file.
 * @param {string} name - File name.
 */
export const saveAs = function (blob, name) {
  const a = document.createElement('a');
  a.download = name;
  a.href = globalThis.URL.createObjectURL(blob);
  a.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
};

/**
 * Loads an image from a given URL and sets it to a specified HTML element.
 *
 * @param {string|Blob|ArrayBuffer} src - Image source.  Accepts ArrayBuffer, Blob, or URL.
 * @param {HTMLImageElement} elem - The image element where the loaded image will be set.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the image element when the image is loaded successfully.
 */
export async function loadImage(src, elem) {
  return new Promise((resolve, reject) => {
    let urlLoad;
    if (src instanceof Blob) {
      urlLoad = URL.createObjectURL(src);
    } else if (src instanceof ArrayBuffer) {
      const blob = new Blob([src]);
      urlLoad = URL.createObjectURL(blob);
    } else {
      urlLoad = src;
    }
    // const urlLoad = url instanceof Blob ? URL.createObjectURL(url) : url;
    elem.onload = () => resolve(elem);
    elem.onerror = reject;
    elem.src = urlLoad;
  });
}

export function imageStrToBlob(imgStr) {
  const imgData = new Uint8Array(atob(imgStr.split(',')[1])
    .split('')
    .map((c) => c.charCodeAt(0)));

  const imgBlob = new Blob([imgData], { type: 'application/octet-stream' });

  return imgBlob;
}

/**
 * Reduces an array of EvalMetrics objects into a single EvalMetrics object
 * by summing all of the corresponding properties.
 * @param {Array<EvalMetrics>} evalMetricsArr - Array of EvalMetrics objects.
 * @returns {EvalMetrics} A single EvalMetrics object with summed properties.
 */
export const reduceEvalMetrics = (evalMetricsArr) => evalMetricsArr.reduce((acc, curr) => ({
  total: acc.total + curr.total,
  correct: acc.correct + curr.correct,
  incorrect: acc.incorrect + curr.incorrect,
  missed: acc.missed + curr.missed,
  extra: acc.extra + curr.extra,
  correctLowConf: acc.correctLowConf + curr.correctLowConf,
  incorrectHighConf: acc.incorrectHighConf + curr.incorrectHighConf,
}), {
  total: 0,
  correct: 0,
  incorrect: 0,
  missed: 0,
  extra: 0,
  correctLowConf: 0,
  incorrectHighConf: 0,
});

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
