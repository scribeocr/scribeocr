export class opt {
  static vanillaMode = false;

  static langs = ['eng'];

  static ligatures = true;
}

export class state {
  static pageRendering = Promise.resolve(true);

  static renderIt = 0;

  /** @type {?Function} */
  static promiseResolve = null;

  static recognizeAllPromise = Promise.resolve(true);

  static downloadReady = false;

  static canvasDimsN = -1;

  static layoutMode = false;

  static pageCount = 0;

  static loadCount = 0;

  /** @type {Array<Object<string, string>>} */
  static convertPageWarn = [];
}

/**
 * @typedef inputData
 * @type {object}
 * @property {Boolean[]} xmlMode - true if OCR data exists (whether from upload or built-in engine)
 * @property {Boolean} pdfMode - true if user uploaded pdf
 * @property {Boolean} imageMode - true if user uploaded image files (.png, .jpeg)
 * @property {Boolean} resumeMode - true if user re-uploaded HOCR data created by Scribe OCR
 * @property {Boolean} extractTextMode - true if stext is extracted from a PDF (rather than text layer uploaded seprately)
 * @property {Boolean} evalMode - true if ground truth data is uploaded
 * @property {String[]} inputFileNames - array of file names for image or PDF uploads
 */
/** @type {inputData} */
export const inputData = {
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
  inputFileNames: [],
};
