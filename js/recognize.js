import { parseDebugInfo } from "./fontStatistics.js";
import { getTesseractConfigs, renderPDFImageCache, createTesseractScheduler, addDisplayLabel, setCurrentHOCR, updateDataProgress } from "../main.js";


export async function recognizeAllPages(legacy = true, comb = false) {

    // Render all PDF pages to PNG if needed
    if (inputDataModes.pdfMode) await renderPDFImageCache([...Array(globalThis.imageAll["native"].length).keys()]);

    // Set Tesseract configs to our defaults, except for engine specified
    const allConfig = getTesseractConfigs();
    allConfig.tessedit_ocr_engine_mode = legacy ? "0" : "1";

    // Determine number of workers to use.
    // This is the minimum of:
    //      1. The number of cores
    //      2. The number of pages
    //      3. 6 (browser-imposed memory limits make going higher than 6 problematic, even on hardware that could support it)
    const workerN = Math.min(Math.round((globalThis.navigator.hardwareConcurrency || 8) / 2), Math.ceil(globalThis.imageAll["native"].length), 6);
    console.log("Using " + workerN + " workers for OCR.")

    const scheduler = await createTesseractScheduler(workerN, allConfig);

    const oemText = "Tesseract " + (allConfig.tessedit_ocr_engine_mode == "1" ? "LSTM" : "Legacy");
    addDisplayLabel(oemText);
    setCurrentHOCR(oemText);  

    const inputPages = [...Array(globalThis.imageAll["native"].length).keys()];

    await Promise.allSettled(inputPages.map((x) => recognizePage(scheduler, x, oemText, true).then(() => updateDataProgress(true, comb))));
  
  }
  

/**
 * Run recognition on a page and save the results, including OCR data and (possibly) auto-rotated images, to the appropriate global array.
 *
 * @param {number} n - Page number to recognize.
 * @param {string} engineName - Name of OCR engine (used to save result to correct array)
 * @param {boolean} autoRotate - Whether the user has the "auto-rotate" mode enabled
 */
const recognizePage = async (scheduler, n, engineName, autoRotate = true) => {

    // Whether the binary image should be rotated internally by Tesseract
    // This should always be true (Tesseract results are horrible without auto-rotate) but kept as a variable for debugging purposes. 
    const rotate = true;

    // Whether the page angle is already known (or needs to be detected)
    const angleKnown = typeof (globalThis.pageMetricsObj["angleAll"]?.[n]) == "number";

    // Threshold (in radians) under which page angle is considered to be effectively 0.
    const angleThresh = 0.0008726646;

    // Do not rotate an image that has already been rotated
    const rotateDegrees = rotate && Math.abs(globalThis.pageMetricsObj["angleAll"][n]) > 0.05 && !globalThis.imageAll["nativeRotated"][n] ? globalThis.pageMetricsObj["angleAll"][n] * -1 || 0 : 0;
    const rotateRadians = rotateDegrees * (Math.PI / 180);

    // When the image has not been loaded into an element yet, use the raw source string.
    // We still use imageAll["native"] when it exists as this will have rotation applied (if applicable) while imageAll["nativeSrc"] will not.
    const inputSrc = globalThis.imageAll["native"][n] ? (await globalThis.imageAll["native"][n]).src : globalThis.imageAll["nativeSrc"][n];

    // Images are saved if either (1) we do not have any such image at present or (2) the current version is not rotated but the user has the "auto rotate" option enabled.
    const saveNativeImage = autoRotate && !globalThis.imageAll["nativeRotated"][n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh);

    const saveBinaryImageArg = !globalThis.imageAll["binary"][n] || autoRotate && !globalThis.imageAll["binaryRotated"][n] && (!angleKnown || Math.abs(rotateRadians) > angleThresh) ? true : false;

    // Run recognition
    const res = await scheduler.addJob('recognize', inputSrc, { rotateRadians: rotateRadians, rotateAuto: !angleKnown }, {
        imageBinary: saveBinaryImageArg,
        imageColor: saveNativeImage, debug: true
    });

    parseDebugInfo(res.data.debug);

    if (!angleKnown) globalThis.pageMetricsObj["angleAll"][n] = res.data.rotateRadians * (180 / Math.PI) * -1;

    // Images from Tesseract should not overwrite the existing images in the case where rotateAuto is true,
    // but no significant rotation was actually detected. 
    if (saveBinaryImageArg) {
        globalThis.imageAll["binaryRotated"][n] = Math.abs(res.data.rotateRadians) > angleThresh;
        if (globalThis.imageAll["binaryRotated"][n] || !globalThis.imageAll["binary"][n]) {
            const image = document.createElement('img');
            image.src = res.data.imageBinary;
            globalThis.imageAll["binary"][n] = image;
        }
    }

    if (saveNativeImage) {
        globalThis.imageAll["nativeRotated"][n] = Math.abs(res.data.rotateRadians) > angleThresh;
        if (globalThis.imageAll["nativeRotated"][n]) {
            const image = document.createElement('img');
            image.src = res.data.imageColor;
            globalThis.imageAll["native"][n] = image;
        }
    }

    globalThis.hocrCurrentRaw[n] = res.data.hocr;

    const argsObj = {
        "engine": engineName,
        "angle": globalThis.pageMetricsObj["angleAll"][n],
        "mode": "full"
    }

    return globalThis.convertPageScheduler.addJob("convertPage", [res.data.hocr, n, false, argsObj]);

}

