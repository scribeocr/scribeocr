import { parseDebugInfo } from './fontStatistics.js';
import { GeneralScheduler } from './generalWorkerMain.js';

/**
 *  Calculate what arguments to use with Tesseract `recognize` function relating to rotation.
 *
 * @param {number} n - Page number to recognize.
 */
export const calcRecognizeRotateArgs = (n, areaMode) => {
  // Whether the binary image should be rotated internally by Tesseract
  // This should always be true (Tesseract results are horrible without auto-rotate) but kept as a variable for debugging purposes.
  const rotate = true;

  // Whether the rotated images should be saved, overwriting any non-rotated images.
  const autoRotate = true;

  // Threshold (in radians) under which page angle is considered to be effectively 0.
  const angleThresh = 0.0008726646;

  const { angle } = globalThis.pageMetricsArr[n];

  // Whether the page angle is already known (or needs to be detected)
  const angleKnown = typeof (globalThis.pageMetricsArr[n].angle) === 'number';

  // Calculate additional rotation to apply to page.  Rotation should not be applied if page has already been rotated.
  const rotateDegrees = rotate && angle && Math.abs(angle || 0) > 0.05 && !globalThis.imageAll.nativeRotated[n] ? angle * -1 : 0;
  const rotateRadians = rotateDegrees * (Math.PI / 180);

  let saveNativeImage = false;
  let saveBinaryImageArg = false;

  // Images are not saved when using "recognize area" as these intermediate images are cropped.
  if (!areaMode) {
    // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
    if (autoRotate && !globalThis.imageAll.nativeRotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveNativeImage = true;
    if (!globalThis.imageAll.binary[n] || autoRotate && !globalThis.imageAll.binaryRotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveBinaryImageArg = true;
  }

  return {
    angleThresh,
    angleKnown,
    rotateRadians,
    saveNativeImage,
    saveBinaryImageArg,
  };
};

/**
 * Run recognition on a page and save the results, including OCR data and (possibly) auto-rotated images, to the appropriate global array.
 *
 * @param {GeneralScheduler} scheduler
 * @param {number} n - Page number to recognize.
 * @param {boolean} legacy -
 * @param {boolean} lstm -
 * @param {boolean} areaMode -
 * @param {Object<string, string>} options -
 * @param {boolean} [debugVis=false] - Generate instructions for debugging visualizations.
 */
export const recognizePage = async (scheduler, n, legacy, lstm, areaMode, options = {}, debugVis = false) => {
  const browserMode = typeof process === 'undefined';

  const {
    angleThresh, angleKnown, rotateRadians, saveNativeImage, saveBinaryImageArg,
  } = calcRecognizeRotateArgs(n, areaMode);

  // When the image has not been loaded into an element yet, use the raw source string.
  // We still use imageAll["native"] when it exists as this will have rotation applied (if applicable) while imageAll["nativeSrc"] will not.
  const inputSrc1 = await globalThis.imageAll.native[n];
  let inputSrc;
  if (inputSrc1) {
    if (inputSrc1.src) {
      inputSrc = inputSrc1.src;
    } else {
      inputSrc = inputSrc1;
    }
  } else {
    inputSrc = globalThis.imageAll.nativeSrc[n];
  }

  const config = {
    ...{
      rotateRadians, rotateAuto: !angleKnown, legacy, lstm,
    },
    ...options,
  };

  // If a smaller rectangle is being recognized, then the dimensions of the entire page must be manually specified for the rotation calculations to be correct.
  const pageDims = options && options.rectangle ? globalThis.pageMetricsArr[n].dims : null;

  const resArr = await scheduler.recognizeAndConvert2({
    image: inputSrc,
    options: config,
    output: {
      imageBinary: saveBinaryImageArg,
      imageColor: saveNativeImage,
      debug: true,
      debugVis,
    },
    n,
    knownAngle: globalThis.pageMetricsArr[n].angle,
    pageDims,
  });

  const res0 = await resArr[0];

  // const printDebug = true;
  // if (printDebug) console.log(res0.recognize.debug);

  parseDebugInfo(res0.recognize.debug);

  if (!angleKnown) globalThis.pageMetricsArr[n].angle = res0.recognize.rotateRadians * (180 / Math.PI) * -1;

  // Images from Tesseract should not overwrite the existing images in the case where rotateAuto is true,
  // but no significant rotation was actually detected.
  if (saveBinaryImageArg) {
    globalThis.imageAll.binaryRotated[n] = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;
    if (globalThis.imageAll.binaryRotated[n] || !globalThis.imageAll.binary[n]) {
      if (browserMode) {
        const image = document.createElement('img');
        image.src = res0.recognize.imageBinary;
        globalThis.imageAll.binary[n] = image;
      } else {
        const { loadImage } = await import('canvas');
        globalThis.imageAll.binary[n] = await loadImage(res0.recognize.imageBinary);
      }
    }
  }

  if (saveNativeImage) {
    globalThis.imageAll.nativeRotated[n] = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;
    if (globalThis.imageAll.nativeRotated[n]) {
      if (browserMode) {
        const image = document.createElement('img');
        image.src = res0.recognize.imageColor;
        globalThis.imageAll.native[n] = image;
      } else {
        const { loadImage } = await import('canvas');
        globalThis.imageAll.native[n] = await loadImage(res0.recognize.imageColor);
      }
    }
  }

  return resArr;
};
