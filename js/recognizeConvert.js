import { parseDebugInfo } from './fontStatistics.js';
import { imageCont, getImageBitmap } from './containers/imageContainer.js';

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

  const angle = globalThis.pageMetricsArr[n]?.angle;

  // Whether the page angle is already known (or needs to be detected)
  const angleKnown = typeof (angle) === 'number';

  // Calculate additional rotation to apply to page.  Rotation should not be applied if page has already been rotated.
  const rotateDegrees = rotate && angle && Math.abs(angle || 0) > 0.05 && !imageCont.imageAll.nativeRotated[n] ? angle * -1 : 0;
  const rotateRadians = rotateDegrees * (Math.PI / 180);

  let saveNativeImage = false;
  let saveBinaryImageArg = false;

  // Images are not saved when using "recognize area" as these intermediate images are cropped.
  if (!areaMode) {
    // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
    if (autoRotate && !imageCont.imageAll.nativeRotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveNativeImage = true;
    if (!imageCont.imageAll.binary[n] || autoRotate && !imageCont.imageAll.binaryRotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveBinaryImageArg = true;
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
  const {
    angleThresh, angleKnown, rotateRadians, saveNativeImage, saveBinaryImageArg,
  } = calcRecognizeRotateArgs(n, areaMode);

  const inputSrc = await (imageCont.imageAll.nativeStr[n] || imageCont.imageAll.nativeSrcStr[n]);

  const config = {
    ...{
      rotateRadians, rotateAuto: !angleKnown, legacy, lstm,
    },
    ...options,
  };

  const pageDims = globalThis.pageMetricsArr[n].dims;

  // If `legacy` and `lstm` are both `false`, recognition is not run, but layout analysis is.
  // This combination of options would be set for debug mode, where the point of running Tesseract
  // is to get debugging images for layout analysis rather than get text.
  const runRecognition = legacy || lstm;

  const resArr = await scheduler.recognizeAndConvert2({
    image: inputSrc,
    options: config,
    output: {
      // text, blocks, hocr, and tsv must all be `false` to disable recognition
      text: runRecognition,
      blocks: runRecognition,
      hocr: runRecognition,
      tsv: runRecognition,
      layoutBlocks: !runRecognition,
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
  // if (printDebug && browserMode) {
  //   if (legacy && lstm) {
  //     resArr[1].then((res1) => {
  //       console.log(res1.recognize.debug);
  //     });
  //   } else {
  //     console.log(res0.recognize.debug);
  //   }
  // }

  parseDebugInfo(res0.recognize.debug);

  if (!angleKnown) globalThis.pageMetricsArr[n].angle = res0.recognize.rotateRadians * (180 / Math.PI) * -1;

  // Images from Tesseract should not overwrite the existing images in the case where rotateAuto is true,
  // but no significant rotation was actually detected.
  if (saveBinaryImageArg) {
    imageCont.imageAll.binaryRotated[n] = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;
    if (imageCont.imageAll.binaryRotated[n] || !imageCont.imageAll.binary[n]) {
      imageCont.imageAll.binaryStr[n] = res0.recognize.imageBinary;
      imageCont.imageAll.binary[n] = getImageBitmap(res0.recognize.imageBinary);
    }
  }

  if (saveNativeImage) {
    imageCont.imageAll.nativeRotated[n] = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;
    if (imageCont.imageAll.nativeRotated[n]) {
      imageCont.imageAll.nativeStr[n] = res0.recognize.imageColor;
      imageCont.imageAll.native[n] = getImageBitmap(res0.recognize.imageColor);
    }
  }

  return resArr;
};
