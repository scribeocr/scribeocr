import { inputData, opt, state } from '../containers/app.js';
import {
  fontMetricsObj,
  LayoutDataTables,
  LayoutRegions,
  ocrAll,
  ocrAllRaw,
  pageMetricsArr,
} from '../containers/dataContainer.js';
import { fontAll } from '../containers/fontContainer.js';
import { ImageCache, imageUtils, ImageWrapper } from '../containers/imageContainer.js';
import { gs } from '../containers/schedulerContainer.js';
import { enableDisableFontOpt, optimizeFontContainerAll, setDefaultFontAuto } from '../fontContainerMain.js';
import { runFontOptimization } from '../fontEval.js';
import { calcFontMetricsFromPages } from '../fontStatistics.js';
import { initTesseractInWorkers } from '../generalWorkerMain.js';
import { LayoutDataTablePage, LayoutPage } from '../objects/layoutObjects.js';
import { PageMetrics } from '../objects/pageMetricsObjects.js';
import { checkCharWarn, convertOCRAll } from '../recognizeConvert.js';
import { replaceObjectProperties } from '../utils/miscUtils.js';
import { importOCRFiles } from './importOCR.js';

/**
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
const importImageFile = async (file) => new Promise((resolve, reject) => {
  if (typeof process !== 'undefined') {
    const format = file.name.match(/jpe?g$/i) ? 'jpeg' : 'png';
    // @ts-ignore
    resolve(`data:image/${format};base64,${file.fileData.toString('base64')}`);
    return;
  }

  const reader = new FileReader();

  reader.onloadend = async () => {
    resolve(/** @type {string} */(reader.result));
  };

  reader.onerror = (error) => {
    reject(error);
  };

  reader.readAsDataURL(file);
});

/**
 *
 * @param {Array<File>|FileList|Array<string>} curFiles
 * @returns
 */
export async function importFiles(curFiles) {
  if (!curFiles || curFiles.length === 0) return;

  if (typeof process !== 'undefined') {
    const { wrapFilesNode } = await import('./nodeAdapter.js');
    curFiles = wrapFilesNode(curFiles);
  }

  state.downloadReady = false;
  ImageCache.loadCount = 0;

  pageMetricsArr.length = 0;

  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  /** @type {Array<File>} */
  const imageFilesAll = [];
  /** @type {Array<File>} */
  const hocrFilesAll = [];
  /** @type {Array<File>} */
  const pdfFilesAll = [];
  /** @type {Array<File>} */
  const unsupportedFilesAll = [];
  const unsupportedExt = {};
  for (let i = 0; i < curFiles.length; i++) {
    const file = curFiles[i];
    const fileExt = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() || '';

    // TODO: Investigate whether other file formats are supported (without additional changes)
    // Tesseract.js definitely supports more formats, so if the .pdfs we make also support a format,
    // then we should be able to expand the list of supported types without issue.
    // Update: It looks like .bmp does not work.
    if (['png', 'jpeg', 'jpg'].includes(fileExt)) {
      imageFilesAll.push(file);
      // All .gz files are assumed to be OCR data (xml) since all other file types can be compressed already
    } else if (['hocr', 'xml', 'html', 'gz', 'stext'].includes(fileExt)) {
      hocrFilesAll.push(file);
    } else if (['pdf'].includes(fileExt)) {
      pdfFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  imageFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));
  hocrFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));

  if (pdfFilesAll.length === 0 && imageFilesAll.length === 0 && hocrFilesAll.length === 0) {
    const errorText = 'No supported files found.';
    state.errorHandler(errorText);
    return;
  } if (unsupportedFilesAll.length > 0) {
    const errorText = `Import includes unsupported file types: ${Object.keys(unsupportedExt).join(', ')}`;
    state.warningHandler(errorText);
  } else if (pdfFilesAll.length > 0 && imageFilesAll.length > 0) {
    const errorText = 'PDF and image files cannot be imported together. Only first PDF file will be imported.';
    state.warningHandler(errorText);
    pdfFilesAll.length = 1;
    imageFilesAll.length = 0;
  } else if (pdfFilesAll.length > 1) {
    const errorText = 'Multiple PDF files are not supported. Only first PDF file will be imported.';
    state.warningHandler(errorText);
    pdfFilesAll.length = 1;
    imageFilesAll.length = 0;
  }

  inputData.pdfMode = pdfFilesAll.length === 1;
  inputData.imageMode = !!(imageFilesAll.length > 0 && !inputData.pdfMode);
  ImageCache.inputModes.image = !!(imageFilesAll.length > 0 && !inputData.pdfMode);

  const xmlModeImport = hocrFilesAll.length > 0;

  // Extract text from PDF document
  // Only enabled if (1) user selects this option, (2) user uploads a PDF, and (3) user does not upload XML data.
  inputData.extractTextMode = opt.extractText && inputData.pdfMode && !xmlModeImport;

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, '');
  downloadFileName += '.pdf';
  state.downloadFileName = downloadFileName;

  // The loading bar should be initialized before anything significant runs (e.g. `ImageCache.openMainPDF` to provide some visual feedback).
  // All pages of OCR data and individual images (.png or .jpeg) contribute to the import loading bar.
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  let progressMax = 0;
  if (inputData.imageMode) progressMax += imageFilesAll.length;
  if (xmlModeImport) progressMax += hocrFilesAll.length;

  // Loading bars are necessary for automated testing as the tests wait for the loading bar to fill up.
  // Therefore, a dummy loading bar with a max of 1 is created even when progress is not meaningfully tracked.
  let dummyLoadingBar = false;
  if (progressMax === 0) {
    dummyLoadingBar = true;
    progressMax = 1;
  }

  if (state.progress) state.progress.show(progressMax);

  let pageCount;
  let pageCountImage;
  let abbyyMode = false;
  let scribeMode = false;

  if (inputData.pdfMode) {
    const pdfFile = pdfFilesAll[0];
    inputData.inputFileNames = [pdfFile.name];

    // Start loading mupdf workers as soon as possible, without waiting for `pdfFile.arrayBuffer` (which can take a while).
    ImageCache.getMuPDFScheduler();

    const pdfFileData = await pdfFile.arrayBuffer();

    // If no XML data is provided, page sizes are calculated using muPDF alone
    await ImageCache.openMainPDF(pdfFileData, opt.omitNativeText, !xmlModeImport, inputData.extractTextMode);

    pageCountImage = ImageCache.pageCount;
    ImageCache.loadCount = ImageCache.pageCount;
  } else if (inputData.imageMode) {
    inputData.inputFileNames = imageFilesAll.map((x) => x.name);
    pageCountImage = imageFilesAll.length;
  }

  let existingLayout = false;
  let existingLayoutDataTable = false;
  let existingOpt = false;
  const oemName = 'User Upload';
  let stextMode;

  if (xmlModeImport || inputData.extractTextMode) {
    // Initialize a new array on `ocrAll` if one does not already exist
    if (!ocrAll[oemName]) ocrAll[oemName] = Array(state.pageCount);
    ocrAll.active = ocrAll[oemName];

    let stextModeImport;
    if (xmlModeImport) {
      const ocrData = await importOCRFiles(Array.from(hocrFilesAll), true);

      ocrAllRaw.active = ocrData.hocrRaw;
      // Subset OCR data to avoid uncaught error that occurs when there are more pages of OCR data than image data.
      // While this should be rare, it appears to be fairly common with Archive.org documents.
      // TODO: Add warning message displayed to user for this.
      if (pageCountImage && ocrAllRaw.active.length > pageCountImage) {
        console.log(`Identified ${ocrAllRaw.active.length} pages of OCR data but ${pageCountImage} pages of image/pdf data. Only first ${pageCountImage} pages will be used.`);
        ocrAllRaw.active = ocrAllRaw.active.slice(0, pageCountImage);
      }

      // Restore font metrics and optimize font from previous session (if applicable)
      if (ocrData.fontMetricsObj && Object.keys(ocrData.fontMetricsObj).length > 0) {
        existingOpt = true;

        replaceObjectProperties(fontMetricsObj, ocrData.fontMetricsObj);
        await gs.schedulerReady;
        setDefaultFontAuto(fontMetricsObj);

        // If `ocrData.enableOpt` is `false`, then the metrics are present but ignored.
        // This occurs if optimization was found to decrease accuracy for both sans and serif,
        // not simply because the user disabled optimization in the view settings.
        // If no `enableOpt` property exists but metrics are present, then optimization is enabled.
        if (ocrData.enableOpt === 'false') {
          opt.enableOpt = false;
        } else {
          const fontRaw = fontAll.getContainer('raw');
          if (!fontRaw) throw new Error('Raw font data not found.');
          fontAll.opt = await optimizeFontContainerAll(fontRaw, fontMetricsObj);
          opt.enableOpt = true;
          await enableDisableFontOpt(true);
        }
      }

      if (ocrData.defaultFont) fontAll.defaultFontName = ocrData.defaultFont;

      if (ocrData.sansFont) {
        fontAll.sansDefaultName = ocrData.sansFont;
      }

      if (ocrData.serifFont) {
        fontAll.serifDefaultName = ocrData.serifFont;
      }

      // Restore layout data from previous session (if applicable)
      if (ocrData.layoutObj) {
        for (let i = 0; i < ocrData.layoutObj.length; i++) {
          LayoutRegions.pages[i] = ocrData.layoutObj[i];
        }
        existingLayout = true;
      }

      if (ocrData.layoutDataTableObj) {
        for (let i = 0; i < ocrData.layoutDataTableObj.length; i++) {
          LayoutDataTables.pages[i] = ocrData.layoutDataTableObj[i];
        }
        existingLayoutDataTable = true;
      }

      stextModeImport = ocrData.stextMode;
      abbyyMode = ocrData.abbyyMode;
      scribeMode = ocrData.scribeMode;
    }

    // stext may be imported or extracted from an input PDF
    stextMode = inputData.extractTextMode || stextModeImport;
  }

  const pageCountHOCR = ocrAllRaw.active?.length;

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (xmlModeImport && (inputData.imageMode || inputData.pdfMode)) {
    if (pageCountImage !== pageCountHOCR) {
      const warningHTML = `Page mismatch detected. Image data has ${pageCountImage} pages while OCR data has ${pageCountHOCR} pages.`;
      state.warningHandler(warningHTML);
    }
  }

  state.pageCount = pageCountImage ?? pageCountHOCR;

  ocrAllRaw.active = ocrAllRaw.active || Array(pageCount);

  if (!existingLayout) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutRegions.pages[i] = new LayoutPage();
    }
  }

  if (!existingLayoutDataTable) {
    for (let i = 0; i < state.pageCount; i++) {
      LayoutDataTables.pages[i] = new LayoutDataTablePage();
    }
  }

  inputData.xmlMode = new Array(state.pageCount);
  if (xmlModeImport || inputData.extractTextMode) {
    inputData.xmlMode.fill(true);
  } else {
    inputData.xmlMode.fill(false);
  }

  // Render first page for PDF only
  if (inputData.pdfMode && !xmlModeImport && state.display) state.display(0);

  if (inputData.imageMode) {
    ImageCache.pageCount = state.pageCount;
    for (let i = 0; i < state.pageCount; i++) {
      ImageCache.nativeSrc[i] = await importImageFile(imageFilesAll[i]).then(async (imgStr) => {
        const format = imageFilesAll[i].name.match(/jpe?g$/i) ? 'jpeg' : 'png';
        const imgWrapper = new ImageWrapper(i, imgStr, format, 'native', false, false);
        const imageDims = await imageUtils.getDims(imgWrapper);
        pageMetricsArr[i] = new PageMetrics(imageDims);
        return imgWrapper;
      });
      ImageCache.loadCount++;
      if (state.display && i === 0) state.display(0);
      if (state.progress) state.progress.increment();
    }
  }

  if (xmlModeImport || inputData.extractTextMode) {
    /** @type {("hocr" | "abbyy" | "stext")} */
    let format = 'hocr';
    if (abbyyMode) format = 'abbyy';
    if (stextMode) format = 'stext';

    // Process HOCR using web worker, reading from file first if that has not been done already
    await convertOCRAll(ocrAllRaw.active, true, format, oemName, scribeMode).then(async () => {
      // Skip this step if optimization info was already restored from a previous session, or if using stext (which is character-level but not visually accurate).
      if (!existingOpt && !stextMode) {
        await checkCharWarn(state.convertPageWarn);
        calcFontMetricsFromPages(ocrAll.active);
        opt.enableOpt = await runFontOptimization(ocrAll.active);
      }
    });
  }

  if (dummyLoadingBar && state.progress) state.progress.increment();

  // Start loading Tesseract if it was not already loaded.
  // Tesseract is not loaded on startup, however if the user uploads data, they presumably want to run something that requires Tesseract.
  await initTesseractInWorkers({ anyOk: true, vanillaMode: opt.vanillaMode, langs: opt.langs });
}
