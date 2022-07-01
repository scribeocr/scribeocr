
// Various coordinate systems are used and there is often need to transform between them
// OCR Data Coordinate Space: coordinate system from XML data (Abbyy or Tesseract)
// Image Coordinate Space: coordinate space of a particular image
// Canvas Coordinate Space: coordinate space of canvas, used for user interactions

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));


function rotateBoundingBox(boundingBox, rotateAngle) {
    let angleAdjXRect = 0;
    let angleAdjYRect = 0;

    const pageDims = globalThis.pageMetricsObj["dimsAll"][currentPage.n];

    const sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
    const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

    const shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
    const shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

    const baselineY = boundingBox.top + boundingBox.height - boundingBox.height / 3;

    const angleAdjYInt = (1 - cosAngle) * baselineY - sinAngle * boundingBox.left;
    const angleAdjXInt = sinAngle * (baselineY - angleAdjYInt * 0.5);

    angleAdjXRect = shiftX + angleAdjXInt;
    angleAdjYRect = shiftY + angleAdjYInt;

    return {left : boundingBox.left - angleAdjXRect, top: boundingBox.top - angleAdjYRect, width: boundingBox.width, height: boundingBox.height}

}

// Note: Despite having a page number argument, this function only works on the current page due to the use of `currentPage.leftAdjX`
function canvasToImage(canvasCoords, n, binary = false){

    const imageRotated = binary ? globalThis.imageAll.binaryRotated[n] : globalThis.imageAll.nativeRotated[n];

    // If the rendered image has been rotated to match the user-specified rotation setting (or the angle is so small it doesn't matter)
    // the only difference between coordinate systems is the left margin offset. 
    if (autoRotateCheckboxElem.checked && imageRotated || !autoRotateCheckboxElem.checked && imageRotated || Math.abs(globalThis.pageMetricsObj["angleAll"][n] ?? 0) <= 0.05) {
        return {left : canvasCoords.left - currentPage.leftAdjX, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height}
    }

    // Otherwise, we must also account for rotation applied by the canvas
    const rotateAngle = autoRotateCheckboxElem.checked && !imageRotated ? globalThis.pageMetricsObj["angleAll"][n] : globalThis.pageMetricsObj["angleAll"][n] * -1;

    canvasCoords = rotateBoundingBox(canvasCoords, rotateAngle);

    // In addition to any roatation, the adjustment to the left margin (from "Auto-Standardize Left Margin" option) is applied
    return {left : canvasCoords.left - currentPage.leftAdjX, top: canvasCoords.top, width: canvasCoords.width, height: canvasCoords.height}
}

function ocrToImage(ocrCoords, n, binary = false){

    const imageRotated = binary ? globalThis.imageAll.binaryRotated[n] : globalThis.imageAll.nativeRotated[n];

    // If the image was never rotated, then the xml and image coordinates are the same
    if (!imageRotated) {
        return(ocrCoords);
    }

    // Otherwise, we must also account for rotation applied by the canvas
    const rotateAngle = globalThis.pageMetricsObj["angleAll"][n] * -1;

    return rotateBoundingBox(ocrCoords, rotateAngle);

}

export let coords = {
    canvasToImage: canvasToImage,
    ocrToImage: ocrToImage
}