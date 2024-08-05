import fs from 'fs';
import path from 'path';
import { clearData } from '../js/clear.js';
import { opt } from '../js/containers/app.js';
import { gs } from '../js/containers/schedulerContainer.js';
import { handleDownload } from '../js/export/export.js';
import { loadBuiltInFontsRaw } from '../js/fontContainerMain.js';
import { initGeneralScheduler } from '../js/generalWorkerMain.js';
import { importFilesAll } from '../js/import/import.js';

/**
 *
 * @param {string} pdfFile - Path to PDF file.
 * @param {?string} [output='.'] - Output file or directory.
 * @param {Object} [options]
 * @param {'txt'|'json'} [options.format]
 * @param {boolean} [options.reflow]
 */
export const extract = async (pdfFile, output, options) => {
  const format = options?.format || 'txt';

  output = output || '.';
  const outputDir = path.dirname(output);
  const outputFile = outputDir === output ? `${path.basename(pdfFile).replace(/\.\w{1,5}$/i, `.${format}`)}` : path.basename(output);
  const outputPath = `${outputDir}/${outputFile}`;

  if (options?.reflow) opt.reflow = true;

  await initGeneralScheduler();
  const resReadyFontAllRaw = gs.setFontAllRawReady();
  await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
  opt.extractText = true;
  await importFilesAll([pdfFile]);

  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  await handleDownload(format, outputPath);

  await gs.clear();
  await clearData();
};
