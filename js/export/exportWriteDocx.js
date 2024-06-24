import { elem } from '../browser/elems.js';
import { documentEnd, documentStart, docxStrings } from '../docxFiles.js';

import { renderText } from './exportRenderText.js';

import { saveAs } from '../utils/miscUtils.js';

/**
 * Create a Word document from an array of ocrPage objects.
 *
 * @param {Array<OcrPage>} hocrCurrent -
 * @param {number} minpage - The first page to include in the document.
 * @param {number} maxpage - The last page to include in the document.
 */
export async function writeDocx(hocrCurrent, minpage = 0, maxpage = -1) {
  const { BlobWriter, TextReader, ZipWriter } = await import('../../lib/zip.js/index.js');

  if (maxpage === -1) maxpage = hocrCurrent.length - 1;

  const removeLineBreaks = elem.download.docxReflowCheckbox.checked;
  const breaksBetweenPages = elem.download.docxPageBreaksCheckbox.checked;

  const zipFileWriter = new BlobWriter();
  const zipWriter = new ZipWriter(zipFileWriter);

  const textReader = new TextReader(documentStart + renderText(hocrCurrent, minpage, maxpage, removeLineBreaks, breaksBetweenPages, true) + documentEnd);
  await zipWriter.add('word/document.xml', textReader);

  for (let i = 0; i < docxStrings.length; i++) {
    const textReaderI = new TextReader(docxStrings[i].content);
    await zipWriter.add(docxStrings[i].path, textReaderI);
  }

  await zipWriter.close();

  const zipFileBlob = await zipFileWriter.getData();

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.docx`;

  saveAs(zipFileBlob, fileName);
}
