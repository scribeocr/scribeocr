
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
  return(outArr);
}


export function quantile(arr, ntile){
  if(arr.length == 0){
    return null;
  }
  let arr1 = [...arr];
  const mid = Math.floor(arr.length * ntile)
  arr1.sort((a, b) => a - b);

  return arr1[mid];
};


export function rotateBoundingBox(box, angle, origin, baselineOffset = 0, deltaMode = false) {

  const angleRad = angle * (Math.PI / 180);
  let sinAngle = Math.sin(angleRad);
  let cosAngle = Math.cos(angleRad);


  const shiftX = sinAngle * origin[0] * -1 || 0;
  const shiftY = sinAngle * ((origin[1] * 2 - shiftX) * 0.5) || 0;

  const angleAdjXInt = sinAngle * (box[3] + baselineOffset);
  const angleAdjYInt = sinAngle * (box[0] + angleAdjXInt / 2) * -1;

  return [angleAdjXInt + shiftX, angleAdjYInt + shiftY]
  

  // const shiftX = sinAngle * origin[0] * -1 || 0;
  // const shiftY = sinAngle * origin[1] || 0;

  // const originNew = [origin[0] + shiftX, origin[1] + shiftY];
  // // const originNew = origin;

  // sinAngle = Math.sin(angleRad);
  // cosAngle = Math.cos(angleRad);

  // const boxNew = [0, 0, 0, 0];
  // boxNew[0] = (box[0] - origin[0]) * cosAngle - (box[1] - origin[1]) * sinAngle + originNew[0]; 
  // boxNew[1] = (box[0] - origin[0]) * sinAngle + (box[1] - origin[1]) * cosAngle + originNew[1];
  // if (deltaMode) {
  //   // Deltas are multiplied by 0.5 because the canvas size is not increased with the rotation,
  //   // so the corners of the page are cut off in the rotated version. 
  //   return [(boxNew[0] - box[0]), (boxNew[1] - box[1])].map((x) => Math.round(x));
  // }
  // boxNew[2] = boxNew[0] + (box[2] - box[0]);
  // boxNew[3] = boxNew[1] + (box[3] - box[1]);

  // return boxNew.map((x) => Math.round(x));

}

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
  if(/\.gz$/i.test(file.name)){
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
