
// File summary:
// Various utility functions used in other files.

import pako from '../lib/pako.esm.min.js';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

export function getRandomAlphanum(num){
  let outArr = new Array(num);
  for(let i=0;i<num;i++){
    let intI = getRandomInt(1,62);
    if(intI <= 10){
      intI = intI + 47;
    } else if(intI <= 36){
      intI = intI - 10 + 64;
    } else {
      intI = intI - 36 + 96;
    }
    outArr[i] = String.fromCharCode(intI);
  }
  return outArr.join('');
}


export function quantile(arr, ntile){
  if(arr.length == 0){
    return null;
  }
  let arr1 = [...arr];
  const mid = Math.floor(arr.length * ntile);

  // Using sort() will convert numbers to strings by default
  arr1.sort((a, b) => a - b);

  return arr1[mid];
};

export const mean50 = arr => {
  if(arr.length == 0){
    return null;
  }
  const per25 = Math.floor(arr.length / 4) - 1;
  const per75 = Math.ceil(arr.length * 3 / 4) - 1;
  const nums = [...arr].sort((a, b) => a - b);
  const numsMiddle = nums.slice(per25, per75+1);

  return numsMiddle.reduce((a, b) => a + b) / numsMiddle.length;};


export function sleep(ms) { return new Promise((r) =>
    setTimeout(r, ms)); }



// Reads OCR files, which may be compressed as .gz or uncompressed
export function readOcrFile(file){
  if (typeof file === 'string') {
    return file;
  } else if(/\.gz$/i.test(file.name)){
    return(readTextFileGz(file));
  } else {
    return(readTextFile(file))
  }
}

async function readTextFileGz(file) {
    return new Promise(async (resolve, reject) => {
        let zip1 = await file.arrayBuffer();
        let zip2 = await pako.inflate(zip1, {"to": "string"});
        resolve(zip2);
      });
}



export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function round3(x){
    return(Math.round(x*1e3)/1e3);
}

export function round6(x){
    return(Math.round(x*1e6)/1e6);
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

  string += "";
  subString += "";
  if (subString.length <= 0) return (string.length + 1);

  if (!caseSensitive) {
    string = string.toLowerCase();
    subString = subString.toLowerCase();
  } 

  var n = 0,
      pos = 0,
      step = allowOverlapping ? 1 : subString.length;

  while (true) {
      pos = string.indexOf(subString, pos);
      if (pos >= 0) {
          ++n;
          pos += step;
      } else break;
  }
  return n;
}
