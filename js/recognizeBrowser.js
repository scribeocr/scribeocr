import { renderPDFImageCache, initOCRVersion, setCurrentHOCR, calculateOverallMetrics } from "../main.js";
import { recognizeAllPages } from "./recognize.js";

export async function recognizeAllPagesBrowser(legacy = true, mainData = false) {

    // Render all PDF pages to PNG if needed
    if (inputDataModes.pdfMode) await renderPDFImageCache([...Array(globalThis.imageAll["native"].length).keys()]);

    const oemMode = legacy ? "0" : "1";

    const oemText = "Tesseract " + (oemMode == "1" ? "LSTM" : "Legacy");
    initOCRVersion(oemText);
    setCurrentHOCR(oemText);  

    await recognizeAllPages(legacy, mainData);

    if (mainData) await calculateOverallMetrics();
      
}
  