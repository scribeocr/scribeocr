
// Various coordinate systems are used and there is often need to transform between them
// OCR Data Coordinate Space: coordinate system from XML data (Abbyy or Tesseract)
// Image Coordinate Space: coordinate space of a particular image
// Canvas Coordinate Space: coordinate space of canvas, used for user interactions

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

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
 * 
 * @returns {BoundingBox} A new rotated bounding box.
 */
function rotateBoundingBox(boundingBox, rotateAngle) {
    let angleAdjXRect = 0;
    let angleAdjYRect = 0;

    const pageDims = globalThis.pageMetricsArr[currentPage.n].dims;

    const sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
    const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

    const shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
    const shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

    const baselineY = boundingBox.top + boundingBox.height - boundingBox.height / 3;

    const angleAdjYInt = (1 - cosAngle) * baselineY - sinAngle * boundingBox.left;
    const angleAdjXInt = sinAngle * (baselineY - angleAdjYInt * 0.5);

    angleAdjXRect = shiftX + angleAdjXInt;
    angleAdjYRect = shiftY + angleAdjYInt;

    return {left : boundingBox.left - angleAdjXRect, top: boundingBox.top - angleAdjYRect, width: boundingBox.width, height: boundingBox.height}

}

/**
 * Transform from coordinates in canvas to coordinates in image.
 * 
 * @param {BoundingBox} canvasCoords - Bounding box in canvas coordinates.
 * @param {boolean} imageRotated - Whether target image is rotated.
 * @param {boolean} canvasRotated - Whether source canvas is rotated.
 * @param {number} angle - Angle of rotation.
 * @returns {BoundingBox} Bounding box in image coordinates. 
 * Note: Despite having a page number argument, this function only works on the current page due to the use of `currentPage.leftAdjX`
 */
function canvasToImage(canvasCoords, imageRotated, canvasRotated, angle = 0){

    // If the rendered image has been rotated to match the user-specified rotation setting (or the angle is so small it doesn't matter)
    // the only difference between coordinate systems is the left margin offset. 
    if (canvasRotated && imageRotated || !canvasRotated && !imageRotated || Math.abs(angle ?? 0) <= 0.05) {
        return {left : canvasCoords.left - currentPage.leftAdjX, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height}
    }

    // Otherwise, we must also account for rotation applied by the canvas
    const rotateAngle = canvasRotated && !imageRotated ? angle : angle * -1;

    canvasCoords = rotateBoundingBox(canvasCoords, rotateAngle);

    // In addition to any roatation, the adjustment to the left margin (from "Auto-Standardize Left Margin" option) is applied
    return {left : canvasCoords.left - currentPage.leftAdjX, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height}
}

/**
 * Transform from coordinates in OCR data to coordinates on image.
 * 
 * @param {BoundingBox} ocrCoords - Bounding box in OCR coordinates.
 * @param {number} n - Page number (index 0)
 * @param {boolean} binary - Use binary image
 * @returns {BoundingBox} Bounding box in image coordinates. 
 */
function ocrToImage(ocrCoords, n, binary = false){

    const imageRotated = binary ? globalThis.imageAll.binaryRotated[n] : globalThis.imageAll.nativeRotated[n];

    // If the image was never rotated, then the xml and image coordinates are the same
    if (!imageRotated) {
        return(ocrCoords);
    }

    // Otherwise, we must also account for rotation applied by the canvas
    const rotateAngle = globalThis.pageMetricsArr[n].angle * -1;

    return rotateBoundingBox(ocrCoords, rotateAngle);

}

const coords = {
    canvasToImage: canvasToImage,
    ocrToImage: ocrToImage
}

export default coords;
