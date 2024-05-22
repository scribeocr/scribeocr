import { imageCache, ImageWrapper } from './containers/imageContainer.js';
import { pageMetricsArr } from './containers/miscContainer.js';

/**
 *  Calculate what arguments to use with Tesseract `recognize` function relating to rotation.
 *
 * @param {number} n - Page number to recognize.
 */
export const calcRecognizeRotateArgs = async (n, areaMode) => {
  // Whether the binary image should be rotated internally by Tesseract
  // This should always be true (Tesseract results are horrible without auto-rotate) but kept as a variable for debugging purposes.
  const rotate = true;

  // Whether the rotated images should be saved, overwriting any non-rotated images.
  const autoRotate = true;

  // Threshold (in radians) under which page angle is considered to be effectively 0.
  const angleThresh = 0.0008726646;

  const angle = pageMetricsArr[n]?.angle;

  // Whether the page angle is already known (or needs to be detected)
  const angleKnown = typeof (angle) === 'number';

  const nativeN = await imageCache.getNative(n);

  // Calculate additional rotation to apply to page.  Rotation should not be applied if page has already been rotated.
  const rotateDegrees = rotate && angle && Math.abs(angle || 0) > 0.05 && !nativeN.rotated ? angle * -1 : 0;
  const rotateRadians = rotateDegrees * (Math.PI / 180);

  let saveNativeImage = false;
  let saveBinaryImageArg = false;

  // Images are not saved when using "recognize area" as these intermediate images are cropped.
  if (!areaMode) {
    const binaryN = await imageCache.binary[n];
    // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
    if (autoRotate && !nativeN.rotated[n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveNativeImage = true;
    if (!binaryN || autoRotate && !binaryN.rotated && (!angleKnown || Math.abs(rotateRadians) > angleThresh)) saveBinaryImageArg = true;
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
 * @param {Object<string, string>} tessOptions - Options to pass to Tesseract.js.
 * @param {boolean} [debugVis=false] - Generate instructions for debugging visualizations.
 */
export const recognizePage = async (scheduler, n, legacy, lstm, areaMode, tessOptions = {}, debugVis = false) => {
  const {
    angleThresh, angleKnown, rotateRadians, saveNativeImage, saveBinaryImageArg,
  } = await calcRecognizeRotateArgs(n, areaMode);

  const nativeN = await imageCache.getNative(n);

  if (!nativeN) throw new Error(`No image source found for page ${n}`);

  const config = {
    ...{
      rotateRadians, rotateAuto: !angleKnown, legacy, lstm,
    },
    ...tessOptions,
  };

  const pageDims = pageMetricsArr[n].dims;

  // If `legacy` and `lstm` are both `false`, recognition is not run, but layout analysis is.
  // This combination of options would be set for debug mode, where the point of running Tesseract
  // is to get debugging images for layout analysis rather than get text.
  const runRecognition = legacy || lstm;

  const resArr = await scheduler.recognizeAndConvert2({
    image: nativeN.src,
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
    knownAngle: pageMetricsArr[n].angle,
    pageDims,
  });

  const res0 = await resArr[0];

  // const printDebug = true;
  // if (printDebug && typeof process === 'undefined') {
  //   if (legacy && lstm) {
  //     resArr[1].then((res1) => {
  //       console.log(res1.recognize.debug);
  //     });
  //   } else {
  //     console.log(res0.recognize.debug);
  //   }
  // }

  // parseDebugInfo(res0.recognize.debug);

  if (!angleKnown) pageMetricsArr[n].angle = res0.recognize.rotateRadians * (180 / Math.PI) * -1;

  // An image is rotated if either the source was rotated or rotation was applied by Tesseract.
  const isRotated = Boolean(res0.recognize.rotateRadians || 0) || nativeN.rotated;

  // Images from Tesseract should not overwrite the existing images in the case where rotateAuto is true,
  // but no significant rotation was actually detected.
  const significantRotation = Math.abs(res0.recognize.rotateRadians || 0) > angleThresh;

  const upscale = tessOptions.upscale || false;
  if (saveBinaryImageArg && res0.recognize.imageBinary && (significantRotation || !imageCache.binary[n])) {
    imageCache.binary[n] = new ImageWrapper(n, res0.recognize.imageBinary, 'png', 'binary', isRotated, upscale);
  }

  if (saveNativeImage && res0.recognize.imageColor && significantRotation) {
    imageCache.native[n] = new ImageWrapper(n, res0.recognize.imageColor, 'png', 'native', isRotated, upscale);
  }

  return resArr;
};
