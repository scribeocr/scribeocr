import { clearData } from './js/clear.js';
import { opt } from './js/containers/app.js';
import { ImageCache } from './js/containers/imageContainer.js';
import { gs } from './js/containers/schedulerContainer.js';
import { df } from './js/debugGlobals.js';
import { download, exportData } from './js/export/export.js';
import { loadBuiltInFontsRaw } from './js/fontContainerMain.js';
import { initGeneralScheduler, initTesseractInWorkers } from './js/generalWorkerMain.js';
import { importFilesAll } from './js/import/import.js';

/**
 * Initialize the workers that handle most operations.
 * @param {Object} params
 * @param {boolean} [params.pdf=false] - Load PDF renderer.
 * @param {boolean} [params.tesseract=false] - Load Tesseract.
 * The PDF renderer and Tesseract are automatically loaded when needed.
 * Therefore, the only reason to set `pdf` or `tesseract` to `true` is to pre-load them.
 */
const init = async ({
  pdf = false,
  tesseract = false,
}) => {
  const pdfPromise = pdf ? ImageCache.getMuPDFScheduler() : Promise.resolve();

  await initGeneralScheduler();

  if (tesseract) {
    await initTesseractInWorkers({});
    // TODO: Font loading should potentially be its own option.
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
  }

  await pdfPromise;
};

/**
 *
 * @param {Object} options
 * @param {boolean} [options.reflow] - Combine lines into paragraphs in .txt and .docx exports.
 * @param {boolean} [options.extractText] - Extract existing text from PDFs.
 */
const setOptions = (options) => {
  if (options && options.reflow !== undefined && options.reflow !== null) opt.reflow = options.reflow;
  if (options && options.extractText !== undefined && options.extractText !== null) opt.extractText = options.extractText;
};

const importFiles = (files) => importFilesAll(files);

/**
 * Clears all document-specific data.
 */
const clear = async () => {
  await clearData();
};

const terminate = async () => {
  await clearData();
  await gs.terminate();
};

export default {
  clear, exportData, download, importFiles, init, setOptions, terminate, df,
};
