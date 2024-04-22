import { imageCache } from '../containers/imageContainer.js';
import { insertAlertMessage, initializeProgress } from '../../main.js';
import {
  sleep, saveAs,
} from '../miscUtils.js';
import { renderText } from '../exportRenderText.js';
import { renderHOCRBrowser } from '../exportRenderHOCRBrowser.js';
import { writeDocx } from '../exportWriteDocx.js';
import { writeXlsx } from '../exportWriteTabular.js';
import { reorderHOCR } from '../modifyOCR.js';

import { hocrToPDF } from '../exportPDF.js';

const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));

const downloadElem = /** @type {HTMLInputElement} */(document.getElementById('download'));

const formatLabelSVGElem = /** @type {HTMLElement} */(document.getElementById('formatLabelSVG'));
const formatLabelTextElem = /** @type {HTMLElement} */(document.getElementById('formatLabelText'));
const textOptionsElem = /** @type {HTMLElement} */(document.getElementById('textOptions'));
const pdfOptionsElem = /** @type {HTMLElement} */(document.getElementById('pdfOptions'));
const docxOptionsElem = /** @type {HTMLElement} */(document.getElementById('docxOptions'));
const xlsxOptionsElem = /** @type {HTMLElement} */(document.getElementById('xlsxOptions'));

const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

const reflowCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('reflowCheckbox'));
const pageBreaksCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('pageBreaksCheckbox'));

const humanReadablePDFElem = /** @type {HTMLInputElement} */(document.getElementById('humanReadablePDF'));
const intermediatePDFElem = /** @type {HTMLInputElement} */(document.getElementById('intermediatePDF'));

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

const addOverlayCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('addOverlayCheckbox'));
const standardizeCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('standardizeCheckbox'));

const enableLayoutElem = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

const rangeOpacityElem = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));

// Once per session, if the user opens the "Download" tab and proofreading mode is still enabled,
// the user will be prompted to change display modes before downloading.
// This is because, while printing OCR text visibly is an intended feature (it was the original purpose of this application),
// a user trying to add text to an image-based PDF may be surprised by this behavior.
const pdfAlertElem = insertAlertMessage('To generate a PDF with invisible OCR text, select View > Display Mode > OCR Mode before downloading.', false, 'alertDownloadDiv', false);
export const enableDisableDownloadPDFAlert = () => {
  const enable = displayModeElem.value === 'proof' && formatLabelTextElem.textContent === 'PDF';

  if (enable) {
    pdfAlertElem.setAttribute('style', '');
  } else {
    pdfAlertElem.setAttribute('style', 'display:none');
  }
};

export function setFormatLabel(x) {
  if (x.toLowerCase() === 'pdf') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', '');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`;

    formatLabelTextElem.innerHTML = 'PDF';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  } else if (x.toLowerCase() === 'hocr') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`;

    formatLabelTextElem.innerHTML = 'HOCR';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.hocr`;
  } else if (x.toLowerCase() === 'text') {
    textOptionsElem.setAttribute('style', '');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`;

    formatLabelTextElem.innerHTML = 'Text';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.txt`;
  } else if (x.toLowerCase() === 'docx') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', '');
    xlsxOptionsElem.setAttribute('style', 'display:none');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M5.485 6.879a.5.5 0 1 0-.97.242l1.5 6a.5.5 0 0 0 .967.01L8 9.402l1.018 3.73a.5.5 0 0 0 .967-.01l1.5-6a.5.5 0 0 0-.97-.242l-1.036 4.144-.997-3.655a.5.5 0 0 0-.964 0l-.997 3.655L5.485 6.88z"/>
    <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>`;

    formatLabelTextElem.innerHTML = 'Docx';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.docx`;
  } else if (x.toLowerCase() === 'xlsx') {
    textOptionsElem.setAttribute('style', 'display:none');
    pdfOptionsElem.setAttribute('style', 'display:none');
    docxOptionsElem.setAttribute('style', 'display:none');
    xlsxOptionsElem.setAttribute('style', '');

    formatLabelSVGElem.innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V9H3V2a1 1 0 0 1 1-1h5.5v2zM3 12v-2h2v2H3zm0 1h2v2H4a1 1 0 0 1-1-1v-1zm3 2v-2h3v2H6zm4 0v-2h3v1a1 1 0 0 1-1 1h-2zm3-3h-3v-2h3v2zm-7 0v-2h3v2H6z"/>`;

    formatLabelTextElem.innerHTML = 'Xlsx';
    downloadFileNameElem.value = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.xlsx`;
  }
  enableDisableDownloadPDFAlert();
}

export function updatePdfPagesLabel() {
  const pageCount = globalThis.pageCount;

  let minValue = parseInt(pdfPageMinElem.value);
  let maxValue = parseInt(pdfPageMaxElem.value);

  if (!minValue || minValue < 0) minValue = 1;
  if (!maxValue || maxValue > pageCount) maxValue = pageCount;

  let pagesStr;
  if (minValue > 0 && maxValue > 0 && (minValue > 1 || maxValue < pageCount)) {
    pagesStr = ` Pages: ${minValue}–${maxValue}`;
  } else {
    pagesStr = ' Pages: All';
    minValue = 1;
    maxValue = pageCount;
  }

  pdfPageMinElem.value = minValue ? minValue.toString() : '1';
  pdfPageMaxElem.value = maxValue ? maxValue.toString() : '';
  document.getElementById('pdfPagesLabelText').innerText = pagesStr;
}

export async function handleDownload() {
  downloadElem.removeEventListener('click', handleDownload);
  downloadElem.disabled = true;

  updatePdfPagesLabel();

  const downloadType = formatLabelTextElem?.textContent?.toLowerCase();

  // If recognition is currently running, wait for it to finish.
  await globalThis.state.recognizeAllPromise;

  const minValue = parseInt(pdfPageMinElem.value) - 1;
  const maxValue = parseInt(pdfPageMaxElem.value) - 1;
  // const pagesArr = [...Array(maxValue - minValue + 1).keys()].map((i) => i + minValue);

  /** @type {Array<OcrPage>} */
  let hocrDownload = [];

  if (downloadType !== 'hocr' && downloadType !== 'xlsx' && enableLayoutElem.checked) {
    // Reorder HOCR elements according to layout boxes
    for (let i = minValue; i <= maxValue; i++) {
      hocrDownload.push(reorderHOCR(globalThis.ocrAll.active[i], globalThis.layout[i]));
    }
  } else {
    hocrDownload = globalThis.ocrAll.active;
  }

  if (downloadType === 'pdf') {
    const standardizeSizeMode = standardizeCheckboxElem.checked;
    const dimsLimit = { width: -1, height: -1 };
    if (standardizeSizeMode) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit.height = Math.max(dimsLimit.height, globalThis.pageMetricsArr[i].dims.height);
        dimsLimit.width = Math.max(dimsLimit.width, globalThis.pageMetricsArr[i].dims.width);
      }
    }

    const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.pdf`;
    let pdfBlob;

    const confThreshHigh = parseInt(confThreshHighElem.value) || 85;
    const confThreshMed = parseInt(confThreshMedElem.value) || 75;

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (displayModeElem.value !== 'ebook') {
      const steps = addOverlayCheckboxElem.checked ? 2 : 3;
      const downloadProgress = initializeProgress('generate-download-progress-collapse', (maxValue + 1) * steps);
      await sleep(0);

      const insertInputPDF = globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked;

      const rotateBackground = !insertInputPDF && autoRotateCheckboxElem.checked;

      const rotateText = !rotateBackground;

      // Currently makes a pdf with all pages, regardless of what the user requests
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images.
      // The `maxpage` argument must be set manually to `globalThis.pageCount-1`, as this avoids an error in the case where there is no OCR data (`hocrDownload` has length 0).
      // In all other cases, this should be equivalent to using the default argument of `-1` (which results in `hocrDownload.length` being used).
      const pdfStr = await hocrToPDF(hocrDownload, 0, globalThis.pageCount - 1, displayModeElem.value, rotateText, rotateBackground,
        { width: -1, height: -1 }, downloadProgress, confThreshHigh, confThreshMed, parseFloat(rangeOpacityElem.value || '80') / 100);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      // await initSchedulerIfNeeded('muPDFScheduler');

      // Create a new scheduler if one does not yet exist.
      // This would be the case for image uploads.
      const muPDFScheduler = await imageCache.initMuPDFScheduler(null, 1);
      const w = muPDFScheduler.workers[0];
      // const fileData = await pdfOverlayBlob.arrayBuffer();
      // The file name is only used to detect the ".pdf" extension
      const pdfOverlay = await w.openDocument(pdfEnc.buffer, 'document.pdf');

      let content;

      // If the input document is a .pdf and "Add Text to Import PDF" option is enabled, we insert the text into that pdf (rather than making a new one from scratch)
      if (globalThis.inputDataModes.pdfMode && addOverlayCheckboxElem.checked) {
        // Text is always skipped for PDF downloads, regardless of whether it was skipped when rendering PNG files.
        // (1) If native text was skipped when rendering .png files, then it should be skipped in the output PDF for consistency.
        // (2) If native text was included when rendering .png files, then any text should be in the recognition OCR data,
        //  so including both would result in duplicative text.
        content = await w.overlayText({
          doc2: pdfOverlay,
          minpage: minValue,
          maxpage: maxValue,
          pagewidth: dimsLimit.width,
          pageheight: dimsLimit.height,
          humanReadable: humanReadablePDFElem.checked,
          skipText: true,
        });

        // Unfortunately there currently is not a real way to track progress using the w.overlayText function, as pages are incremented using C++ (webassembly).
        for (let i = minValue; i < maxValue + 1; i++) {
          downloadProgress.increment();
        }

        // If the input is a series of images, those images need to be inserted into a new pdf
      } else if (globalThis.inputDataModes.pdfMode || globalThis.inputDataModes.imageMode) {
        const colorMode = /** @type {('color'|'gray'|'binary')} */ (colorModeElem.value);

        const props = { rotated: autoRotateCheckboxElem.checked, upscaled: false, colorMode };
        const binary = colorModeElem.value === 'binary';

        // Pre-render to benefit from parallel processing, since the loop below is synchronous.
        await imageCache.preRenderRange(minValue, maxValue, binary, props, downloadProgress);

        await w.overlayTextImageStart({ humanReadable: humanReadablePDFElem.checked });
        for (let i = minValue; i < maxValue + 1; i++) {
          const image = binary ? await imageCache.getBinary(i, props) : await imageCache.getNative(i, props);

          // await w.overlayTextImageAddPage([pdfOverlay, imgArr[i], i, dimsLimit.width, dimsLimit.height]);
          await w.overlayTextImageAddPage({
            doc1: pdfOverlay, image: image.src, i, pagewidth: dimsLimit.width, pageheight: dimsLimit.height,
          });
          downloadProgress.increment();
        }
        content = await w.overlayTextImageEnd([]);
        // Otherwise, there is only OCR data and not image data.
      } else {
        content = await w.write({
          doc1: pdfOverlay, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: humanReadablePDFElem.checked,
        });

        // Fill up progress bar to 100%
        for (let i = downloadProgress.value; i < downloadProgress.maxValue; i++) downloadProgress.increment();
      }

      pdfBlob = new Blob([content], { type: 'application/octet-stream' });
    } else {
      const downloadProgress = initializeProgress('generate-download-progress-collapse', maxValue + 1);
      await sleep(0);

      const pdfStr = await hocrToPDF(hocrDownload, minValue, maxValue, displayModeElem.value, false, true, dimsLimit, downloadProgress, confThreshHigh, confThreshMed,
        parseFloat(rangeOpacityElem.value || '80') / 100);

      // The PDF is still run through muPDF, even thought in eBook mode no background layer is added.
      // This is because muPDF cleans up the PDF we made in the previous step, including:
      // (1) Removing fonts that are not used (significantly reduces file size)
      // (2) Compresses PDF (significantly reduces file size)
      // (3) Fixes minor errors
      //      Being slightly outside of the PDF specification often does not impact readability,
      //      however certain picky programs (e.g. Adobe Acrobat) will throw warning messages.
      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      // Skip mupdf processing if the intermediate PDF is requested. Debugging purposes only.
      if (intermediatePDFElem.checked) {
        pdfBlob = new Blob([pdfEnc], { type: 'application/octet-stream' });
      } else {
        const muPDFScheduler = await imageCache.initMuPDFScheduler(null, 1);
        const w = muPDFScheduler.workers[0];

        // The file name is only used to detect the ".pdf" extension
        const pdf = await w.openDocument(pdfEnc.buffer, 'document.pdf');

        const content = await w.write({
          doc1: pdf, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: humanReadablePDFElem.checked,
        });

        pdfBlob = new Blob([content], { type: 'application/octet-stream' });
      }
    }
    saveAs(pdfBlob, fileName);
  } else if (downloadType === 'hocr') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);
    renderHOCRBrowser(globalThis.ocrAll.active);
    downloadProgress.increment();
  } else if (downloadType === 'text') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    const removeLineBreaks = reflowCheckboxElem.checked;
    const breaksBetweenPages = pageBreaksCheckboxElem.checked;

    const textStr = renderText(hocrDownload, removeLineBreaks, breaksBetweenPages);

    const textBlob = new Blob([textStr], { type: 'text/plain' });
    const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.txt`;

    saveAs(textBlob, fileName);
    downloadProgress.increment();
  } else if (downloadType === 'docx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    writeDocx(hocrDownload);
    downloadProgress.increment();
  } else if (downloadType === 'xlsx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    writeXlsx(hocrDownload);
    downloadProgress.increment();
  }

  downloadElem.disabled = false;
  downloadElem.addEventListener('click', handleDownload);
}
