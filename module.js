import { clearData } from './js/clear.js';
import { opt } from './js/containers/app.js';
import { gs } from './js/containers/schedulerContainer.js';
import { download, exportData } from './js/export/export.js';
import { initGeneralScheduler } from './js/generalWorkerMain.js';
import { importFilesAll } from './js/import/import.js';

const init = async () => {
  await initGeneralScheduler();
  // await initTesseractInWorkers({});
  // const resReadyFontAllRaw = gs.setFontAllRawReady();
  // await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
};

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
  clear, exportData, download, importFiles, init, setOptions, terminate,
};
