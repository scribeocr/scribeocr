// Various coordinate systems are used and there is often need to transform between them
// OCR Data Coordinate Space: coordinate system from XML data (Abbyy or Tesseract)
// Image Coordinate Space: coordinate space of a particular image
// Canvas Coordinate Space: coordinate space of canvas, used for user interactions

import { imageCont } from './containers/imageContainer.js';

/**
 * @typedef {Object} BoundingBox
 * @property {number} top -
 * @property {number} left -
 * @property {number} width -
 * @property {number} height -
 */

/**
 * Rotates a bounding box by a given angle.
 *
 * @param {BoundingBox} boundingBox - The bounding box to be rotated.
 * @param {number} rotateAngle - Rotation angle in degrees.
 * @param {number} n - Page number (index 0)
 *
 * @returns {BoundingBox} A new rotated bounding box.
 */
function rotateBoundingBox(boundingBox, rotateAngle, n) {
  let angleAdjXRect = 0;
  let angleAdjYRect = 0;

  const pageDims = globalThis.pageMetricsArr[n].dims;

  const sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
  const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

  const shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

  const baselineY = boundingBox.top + boundingBox.height - boundingBox.height / 3;

  const angleAdjYInt = (1 - cosAngle) * baselineY - sinAngle * boundingBox.left;
  const angleAdjXInt = sinAngle * (baselineY - angleAdjYInt * 0.5);

  angleAdjXRect = shiftX + angleAdjXInt;
  angleAdjYRect = shiftY + angleAdjYInt;

  return {
    left: boundingBox.left - angleAdjXRect, top: boundingBox.top - angleAdjYRect, width: boundingBox.width, height: boundingBox.height,
  };
}

/**
 * Transform from coordinates in canvas to coordinates in image.
 *
 * @param {BoundingBox} canvasCoords - Bounding box in canvas coordinates.
 * @param {boolean} imageRotated - Whether target image is rotated.
 * @param {boolean} canvasRotated - Whether source canvas is rotated.
 * @param {number} n - Page number (index 0)
 * @param {number} angle - Angle of rotation.
 * @returns {BoundingBox} Bounding box in image coordinates.
 */
function canvasToImage(canvasCoords, imageRotated, canvasRotated, n, angle = 0) {
  // If the rendered image has been rotated to match the user-specified rotation setting (or the angle is so small it doesn't matter)
  // the only difference between coordinate systems is the left margin offset.
  if (canvasRotated && imageRotated || !canvasRotated && !imageRotated || Math.abs(angle ?? 0) <= 0.05) {
    return {
      left: canvasCoords.left, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height,
    };
  }

  // Otherwise, we must also account for rotation applied by the canvas
  const rotateAngle = canvasRotated && !imageRotated ? angle : angle * -1;

  canvasCoords = rotateBoundingBox(canvasCoords, rotateAngle, n);

  // In addition to any roatation, the adjustment to the left margin (from "Auto-Standardize Left Margin" option) is applied
  return {
    left: canvasCoords.left, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height,
  };
}

/**
 * Transform from coordinates in OCR data to coordinates on image.
 *
 * @param {BoundingBox} ocrCoords - Bounding box in OCR coordinates.
 * @param {number} n - Page number (index 0)
 * @param {boolean} binary - Use binary image
 * @returns {BoundingBox} Bounding box in image coordinates.
 */
function ocrToImage(ocrCoords, n, binary = false) {
  const imageRotated = binary ? imageCont.imageAll.binaryRotated[n] : imageCont.imageAll.nativeRotated[n];

  const imageUpscaled = binary ? imageCont.imageAll.binaryUpscaled[n] : imageCont.imageAll.nativeUpscaled[n];

  // If the image was never rotated or upscaled, then the xml and image coordinates are the same
  if (!imageRotated && !imageUpscaled) {
    return (ocrCoords);
  }

  if (imageUpscaled) {
    ocrCoords.left *= 2;
    ocrCoords.top *= 2;
    ocrCoords.width *= 2;
    ocrCoords.height *= 2;
  }

  if (imageRotated) {
  // Otherwise, we must also account for rotation applied by the canvas
    const rotateAngle = (globalThis.pageMetricsArr[n].angle || 0) * -1;

    rotateBoundingBox(ocrCoords, rotateAngle, n);
  }

  return ocrCoords;
}

const coords = {
  canvasToImage,
  ocrToImage,
};

export default coords;
