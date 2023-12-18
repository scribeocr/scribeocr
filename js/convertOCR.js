import { combineData } from "./modifyOCR.js";
import { pageMetrics } from "./objects/pageMetricsObjects.js";



/**
 * Convert from raw OCR data to the internal hocr format used here
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {string} ocrRaw - String containing raw OCR data for single page.
 * @param {number} n - Page number
 * @param {boolean} mainData - Whether this is the "main" data that document metrics are calculated from.
 *  For imports of user-provided data, the first data provided should be flagged as the "main" data.
 *  For Tesseract.js recognition, the Tesseract Legacy results should be flagged as the "main" data.
 * @param {("hocr"|"abbyy"|"stext")} format - Format of raw data.  
 * @param {string} engineName - Name of OCR engine.  
 * @param {boolean} areaMode - Whether the OCR is for an area of the current page, rather than full page.
 */
export async function convertOCRPage(ocrRaw, n, mainData, format = "hocr", engineName, areaMode = false) {

    let func = "convertPageHocr";
    if (format == "abbyy") {
        func = "convertPageAbbyy";
    } else if (format == "stext") {
        func = "convertPageStext";
    }

    await globalThis.generalScheduler.ready;
    
    const res = (await globalThis.generalScheduler.addJob(func, { ocrStr: ocrRaw, n: n })).data;

    await convertPageCallback(res, n, mainData, engineName, areaMode);

}

/**
 * Convert from raw OCR data to the internal hocr format used here
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {string[]} ocrRawArr - Array with raw OCR data, with an element for each page
 * @param {boolean} mainData - Whether this is the "main" data that document metrics are calculated from.
 *  For imports of user-provided data, the first data provided should be flagged as the "main" data.
 *  For Tesseract.js recognition, the Tesseract Legacy results should be flagged as the "main" data.
 * @param {("hocr"|"abbyy"|"stext")} format - Format of raw data.  
 * @param {string} engineName - Name of OCR engine.  
 * @param {boolean} areaMode - Whether the OCR is for an area of the current page, rather than full page.
 */
export async function convertOCRAll(ocrRawArr, mainData, format = "hocr", engineName, areaMode = false) {
    // For each page, process HOCR using web worker
    const promiseArr = [];
    for (let n = 0; n < ocrRawArr.length; n++) {

        let func = "convertPageHocr";
        if (format == "abbyy") {
            func = "convertPageAbbyy";
        } else if (format == "stext") {
            func = "convertPageStext";
        }

        promiseArr.push(convertOCRPage(ocrRawArr[n], n, mainData, format, engineName, areaMode));
    }
    await Promise.all(promiseArr);
}

/**
 * This function is called after running a `convertPage` (or `recognizeAndConvert`) function, updating the globals with the results.
 * This needs to be a separate function from `convertOCRPage`, given that sometimes recognition and conversion are combined by using `recognizeAndConvert`.
 * 
 * @param {Object} params - Object returned by `convertPage` functions
 * @param {number} n 
 * @param {boolean} mainData 
 * @param {string} engineName - Name of OCR engine.  
 * @param {boolean} areaMode - Whether the OCR is for an area of the current page, rather than full page.
 * @param {boolean} combMode - If `combMode = true`, document-wide statistics are calculated after recognition is half done (after Legacy component).
 * @returns 
 */
export async function convertPageCallback({ pageObj, fontMetricsObj, layoutBoxes, warn }, n, mainData, engineName, areaMode = false, combMode = false) {

    // This should be true in the browser and false in Node.js.
    // Several steps are skipped when run in Node.js, relating to either the UI or browser-only features. 
    const browserMode = typeof process === "undefined";

    // Handle case where (1) area mode is enabled and (2) content already exists on the current page.
    // In this case, the new data is combined with the existing data, and the function returns early to avoid overwriting existing data.
    if (areaMode) {
        const lines = globalThis.ocrAll.active[n].lines;
        if (lines && lines.length > 0) {
            combineData(pageObj, globalThis.ocrAll.active[currentPage.n], globalThis.pageMetricsArr[currentPage.n]);
            if (browserMode) displayPage(currentPage.n);
            return;
        }
    }

    // If an OEM engine is specified, save to the appropriate object within ocrAll,
    // and only set to ocrAll.active if appropriate.  This prevents "Recognize All" from
    // overwriting the wrong output if a user switches ocrAll.active to another OCR engine
    // while the recognition job is running.
    let oemCurrent = false;
    if (browserMode) {
        if (areaMode || engineName == document.getElementById("displayLabelText")?.innerHTML) oemCurrent = true;
    }
    
    if (engineName) globalThis.ocrAll[engineName][n] = pageObj || null;
    // if (oemCurrent) globalThis.ocrAll.active[n] = pageObj || null;

    // If this is flagged as the "main" data, then save the stats.
    if (mainData && !areaMode) {

        globalThis.fontMetricObjsMessage[n] = fontMetricsObj;
        globalThis.convertPageWarn[n] = warn;

        // The page metrics object may have been initialized earlier through some other method (e.g. using PDF info).
        if (!globalThis.pageMetricsArr[n]) {
            globalThis.pageMetricsArr[n] = new pageMetrics(pageObj.dims);
        }

        globalThis.pageMetricsArr[n].angle = pageObj.angle;
        globalThis.pageMetricsArr[n].left = pageObj.left;

    }

    if (browserMode) inputDataModes.xmlMode[n] = true;

    // Layout boxes are only overwritten if none exist yet for the page
    if (Object.keys(globalThis.layout[n].boxes).length == 0) globalThis.layout[n].boxes = layoutBoxes;

    // If this is the page the user has open, render it to the canvas
    if (browserMode && n == currentPage.n && oemCurrent) {
        displayPage(currentPage.n);
    }

    if (browserMode && !areaMode) globalThis.convertPageActiveProgress.increment();
}

