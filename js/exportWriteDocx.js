import {
    BlobWriter,
    TextReader,
    ZipWriter,
  } from "../lib/zip.js/index.js";

import { docxStrings, documentStart, documentEnd } from "./docxFiles.js";

import { renderText } from "./exportRenderText.js";
  
const docxReflowCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxReflowCheckbox'));
const docxPageBreaksCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('docxPageBreaksCheckbox'));

export async function writeDocx(hocrCurrent) {

  const removeLineBreaks = docxReflowCheckboxElem.checked;
  const breaksBetweenPages = docxPageBreaksCheckboxElem.checked;

  const zipFileWriter = new BlobWriter();
  const zipWriter = new ZipWriter(zipFileWriter);

  const textReader = new TextReader(documentStart + renderText(hocrCurrent, removeLineBreaks, breaksBetweenPages, true) + documentEnd);
  await zipWriter.add("word/document.xml", textReader);

  for (let i=0; i<docxStrings.length; i++) {
    const textReader = new TextReader(docxStrings[i]["content"]);
    await zipWriter.add(docxStrings[i]["path"], textReader);
  }

  await zipWriter.close();
  
  const zipFileBlob = await zipFileWriter.getData();
  

  const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
  let fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".docx";

  saveAs(zipFileBlob, fileName);

}