export class opt {
  static vanillaMode = false;

  static langs = ['eng'];

  static ligatures = true;

  static omitNativeText = false;

  static extractText = false;

  static enableOpt = false;

  static enableUpscale = false;

  static ignorePunct = false;

  static ignoreCap = false;

  static ignoreExtra = false;

  static confThreshHigh = 85;

  static confThreshMed = 75;

  /** @type {'conf'|'data'} */
  static combineMode = 'data';

  static addOverlay = true;

  static standardizePageSize = false;

  static humanReadablePDF = false;

  static intermediatePDF = false;

  static reflow = false;

  static pageBreaks = true;

  /** @type {("invis"|"ebook"|"eval"|"proof")} */
  static displayMode = 'proof';

  /** @type {('color'|'gray'|'binary')} */
  static colorMode = 'color';

  static overlayOpacity = 80;

  static autoRotate = true;

  static enableLayout = false;

  static xlsxFilenameColumn = true;

  static xlsxPageNumberColumn = true;

  static saveDebugImages = false;
}

export class state {
  static pageRendering = Promise.resolve(true);

  static renderIt = 0;

  /** @type {?Function} */
  static promiseResolve = null;

  static recognizeAllPromise = Promise.resolve();

  static downloadReady = false;

  static canvasDimsN = -1;

  static layoutMode = false;

  static pageCount = 0;

  /** @type {Array<Object<string, string>>} */
  static convertPageWarn = [];

  static downloadFileName = '';

  /** @type {?ProgressBar} */
  static progress = null;

  /** @type {?Function} */
  static display = null;

  static warningHandler = (x) => console.warn(x);

  static errorHandler = (x) => console.error(x);

  static debugVis = false;

  static cp = {
    n: 0,
    backgroundOpts: { stroke: '#3d3d3d', strokeWidth: 3 },
    renderStatus: 0,
    renderNum: 0,
  };
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
