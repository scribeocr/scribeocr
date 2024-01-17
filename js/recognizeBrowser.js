import { renderPDFImageCache, initOCRVersion, setCurrentHOCR, calculateOverallMetrics } from "../main.js";
import { recognizeAllPages } from "./recognize.js";

export async function recognizeAllPagesBrowser(legacy = true, lstm = true, mainData = false) {

    // Render all PDF pages to PNG if needed
    if (inputDataModes.pdfMode) await renderPDFImageCache([...Array(globalThis.imageAll["native"].length).keys()]);

    if (legacy) {
        const oemText = "Tesseract Legacy";
        initOCRVersion(oemText);
        setCurrentHOCR(oemText);
    }

    if (lstm) {
        const oemText = "Tesseract LSTM";
        initOCRVersion(oemText);
        setCurrentHOCR(oemText);
    }

    await recognizeAllPages(legacy, lstm, mainData);

    if (mainData) await calculateOverallMetrics();
      
}
  