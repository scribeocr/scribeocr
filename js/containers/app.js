export class opt {
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

  static addOverlay = true;

  static standardizePageSize = false;

  static humanReadablePDF = false;

  static intermediatePDF = false;

  static reflow = true;

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

  static warningHandler = (x) => console.warn(x);

  static errorHandler = (x) => console.error(x);

  /** @param {ProgressMessage} x */
  // eslint-disable-next-line no-unused-vars
  static progressHandler = (x) => {};

  /** Generate debug visualizations when running OCR. */
  static debugVis = false;
}

export class inputData {
  /** `true` if OCR data exists (whether from upload or built-in engine) */
  static xmlMode = [];

  /** `true` if user uploaded pdf */
  static pdfMode = false;

  /** `true` if user uploaded image files (.png, .jpeg) */
  static imageMode = false;

  /** `true` if user re-uploaded HOCR data created by Scribe OCR */
  static resumeMode = false;

  /** `true` if stext is extracted from a PDF (rather than text layer uploaded seprately) */
  static extractTextMode = false;

  /** `true` if ground truth data is uploaded */
  static evalMode = false;

  static inputFileNames = [];

  static defaultDownloadFileName = '';

  static pageCount = 0;
}
