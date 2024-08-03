import { documentEnd, documentStart, docxStrings } from './resources/docxFiles.js';

import { renderText } from './exportRenderText.js';

import { opt } from '../containers/app.js';
import { saveAs } from '../utils/miscUtils.js';

/**
 * Create a Word document from an array of ocrPage objects.
 *
 * @param {Array<OcrPage>} hocrCurrent -
 * @param {string} fileName
 * @param {number} minpage - The first page to include in the document.
 * @param {number} maxpage - The last page to include in the document.
 */
export async function writeDocx(hocrCurrent, fileName, minpage = 0, maxpage = -1) {
  const { Uint8ArrayWriter, TextReader, ZipWriter } = await import('../../lib/zip.js/index.js');

  if (maxpage === -1) maxpage = hocrCurrent.length - 1;

  const zipFileWriter = new Uint8ArrayWriter();
  const zipWriter = new ZipWriter(zipFileWriter);

  const textReader = new TextReader(documentStart + renderText(hocrCurrent, minpage, maxpage, opt.reflow, true) + documentEnd);
  await zipWriter.add('word/document.xml', textReader);

  for (let i = 0; i < docxStrings.length; i++) {
    const textReaderI = new TextReader(docxStrings[i].content);
    await zipWriter.add(docxStrings[i].path, textReaderI);
  }

  await zipWriter.close();

  const zipFileData = await zipFileWriter.getData();

  saveAs(zipFileData, fileName);
}
