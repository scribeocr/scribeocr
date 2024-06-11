// This file contains various objects that are imported by other modules.
// Everything here is essentially a global variable; none of them are technically "containers".

/** @type {Object.<string, FontMetricsFamily>} */
export const fontMetricsObj = {};

/** @type {Array<import('../objects/layoutObjects.js').LayoutPage>} */
export const layoutAll = [];

/** @type {Array<import('../objects/layoutObjects.js').LayoutDataTablePage>} */
export const layoutDataTableAll = [];

/** @type {Object<string, Array<import('../objects/ocrObjects.js').OcrPage>>} */
export const ocrAll = { active: [] };

/** @type {Array<PageMetrics>} */
export const pageMetricsArr = [];

/**
 * @typedef inputDataModes
 * @type {object}
 * @property {Boolean[]} xmlMode - true if OCR data exists (whether from upload or built-in engine)
 * @property {Boolean} pdfMode - true if user uploaded pdf
 * @property {Boolean} imageMode - true if user uploaded image files (.png, .jpeg)
 * @property {Boolean} resumeMode - true if user re-uploaded HOCR data created by Scribe OCR
 * @property {Boolean} extractTextMode - true if stext is extracted from a PDF (rather than text layer uploaded seprately)
 * @property {Boolean} evalMode - true if ground truth data is uploaded
 */
/** @type {inputDataModes} */
export const inputDataModes = {
  // true if OCR data exists (whether from upload or built-in engine)
  xmlMode: [],
  // true if user uploaded pdf
  pdfMode: false,
  // true if user uploaded image files (.png, .jpeg)
  imageMode: false,
  // true if user re-uploaded HOCR data created by Scribe OCR
  resumeMode: false,
  // true if stext is extracted from a PDF (rather than text layer uploaded seprately)
  extractTextMode: false,
  // true if ground truth data is uploaded
  evalMode: false,
};
