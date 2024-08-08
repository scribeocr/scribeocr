/* eslint-disable import/no-cycle */

import {
  ocrAll,
} from '../js/containers/dataContainer.js';
import {
  saveAs,
} from '../js/utils/miscUtils.js';

import { state } from '../js/containers/app.js';
import { ImageCache } from '../js/containers/imageContainer.js';
import { download } from '../js/export/export.js';
import { writeDebugCsv } from '../js/export/exportDebugCsv.js';
import { elem } from './elems.js';
import { ProgressBars } from './utils/progressBars.js';
import { insertAlertMessage } from './utils/warningMessages.js';

elem.info.downloadSourcePDF.addEventListener('click', async () => {
  const muPDFScheduler = await ImageCache.getMuPDFScheduler(1);
  const w = muPDFScheduler.workers[0];

  if (!w.pdfDoc) {
    console.log('No PDF document is open.');
    return;
  }

  const content = await w.write({
    doc1: w.pdfDoc, humanReadable: elem.info.humanReadablePDF.checked,
  });

  const pdfBlob = new Blob([content], { type: 'application/octet-stream' });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  saveAs(pdfBlob, fileName);
});

elem.info.downloadDebugCsv.addEventListener('click', async () => {
  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.csv`;
  writeDebugCsv(ocrAll.active, fileName);
});

// Once per session, if the user opens the "Download" tab and proofreading mode is still enabled,
// the user will be prompted to change display modes before downloading.
// This is because, while printing OCR text visibly is an intended feature (it was the original purpose of this application),
// a user trying to add text to an image-based PDF may be surprised by this behavior.
const pdfAlertElem = insertAlertMessage('To generate a PDF with invisible OCR text, select View > Display Mode > OCR Mode before downloading.', false, 'alertDownloadDiv', false);
export const enableDisableDownloadPDFAlert = () => {
  const enable = elem.view.displayMode.value === 'proof' && elem.download.formatLabelText.textContent === 'PDF';

  if (enable) {
    pdfAlertElem.setAttribute('style', '');
  } else {
    pdfAlertElem.setAttribute('style', 'display:none');
  }
};

export function setFormatLabel(x) {
  if (x.toLowerCase() === 'pdf') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', '');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`;

    elem.download.formatLabelText.innerHTML = 'PDF';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  } else if (x.toLowerCase() === 'hocr') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`;

    elem.download.formatLabelText.innerHTML = 'HOCR';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.hocr`;
  } else if (x.toLowerCase() === 'text') {
    elem.download.textOptions.setAttribute('style', '');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`;

    elem.download.formatLabelText.innerHTML = 'Text';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.txt`;
  } else if (x.toLowerCase() === 'docx') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', '');
    elem.download.xlsxOptions.setAttribute('style', 'display:none');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M5.485 6.879a.5.5 0 1 0-.97.242l1.5 6a.5.5 0 0 0 .967.01L8 9.402l1.018 3.73a.5.5 0 0 0 .967-.01l1.5-6a.5.5 0 0 0-.97-.242l-1.036 4.144-.997-3.655a.5.5 0 0 0-.964 0l-.997 3.655L5.485 6.88z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>`;

    elem.download.formatLabelText.innerHTML = 'Docx';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.docx`;
  } else if (x.toLowerCase() === 'xlsx') {
    elem.download.textOptions.setAttribute('style', 'display:none');
    elem.download.pdfOptions.setAttribute('style', 'display:none');
    elem.download.docxOptions.setAttribute('style', 'display:none');
    elem.download.xlsxOptions.setAttribute('style', '');

    elem.download.formatLabelSVG.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V9H3V2a1 1 0 0 1 1-1h5.5v2zM3 12v-2h2v2H3zm0 1h2v2H4a1 1 0 0 1-1-1v-1zm3 2v-2h3v2H6zm4 0v-2h3v1a1 1 0 0 1-1 1h-2zm3-3h-3v-2h3v2zm-7 0v-2h3v2H6z"/>`;

    elem.download.formatLabelText.innerHTML = 'Xlsx';
    elem.download.downloadFileName.value = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.xlsx`;
  }
  enableDisableDownloadPDFAlert();
}

export function updatePdfPagesLabel() {
  const pageCount = state.pageCount;

  let minValue = parseInt(elem.download.pdfPageMin.value);
  let maxValue = parseInt(elem.download.pdfPageMax.value);

  // Correct various invalid user inputs.
  if (!minValue || minValue < 1 || minValue > pageCount) minValue = 1;
  if (!maxValue || maxValue < 1 || maxValue > pageCount) maxValue = pageCount;
  if (minValue > maxValue) minValue = maxValue;

  let pagesStr;
  if (minValue > 1 || maxValue < pageCount) {
    pagesStr = ` Pages: ${minValue}–${maxValue}`;
  } else {
    pagesStr = ' Pages: All';
    minValue = 1;
    maxValue = pageCount;
  }

  elem.download.pdfPageMin.value = minValue ? minValue.toString() : '1';
  elem.download.pdfPageMax.value = maxValue ? maxValue.toString() : '';
  elem.download.pdfPagesLabelText.innerText = pagesStr;
}

export async function handleDownloadGUI() {
  elem.download.download.removeEventListener('click', handleDownloadGUI);
  elem.download.download.disabled = true;

  state.progress = ProgressBars.download;

  updatePdfPagesLabel();

  const downloadType = (/** @type {string} */ (elem.download.formatLabelText.textContent)).toLowerCase();

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;

  const minValue = parseInt(elem.download.pdfPageMin.value) - 1;
  const maxValue = parseInt(elem.download.pdfPageMax.value) - 1;

  await download(downloadType, fileName, minValue, maxValue);

  elem.download.download.disabled = false;
  elem.download.download.addEventListener('click', handleDownloadGUI);
}
