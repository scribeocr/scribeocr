/* eslint-disable import/no-cycle */

import { initializeProgress, insertAlertMessage } from '../../main.js';
import { imageCache } from '../containers/imageContainer.js';
import {
  inputDataModes,
  layoutAll,
  ocrAll, pageMetricsArr,
} from '../containers/miscContainer.js';
import { renderHOCRBrowser } from '../export/exportRenderHOCRBrowser.js';
import { renderText } from '../export/exportRenderText.js';
import { reorderHOCR } from '../modifyOCR.js';
import {
  saveAs,
  sleep,
} from '../utils/miscUtils.js';
import { getDisplayMode } from './interfaceView.js';

import { hocrToPDF } from '../export/exportPDF.js';
import { elem } from './elems.js';

const humanReadablePDFElem = /** @type {HTMLInputElement} */(document.getElementById('humanReadablePDF'));
const intermediatePDFElem = /** @type {HTMLInputElement} */(document.getElementById('intermediatePDF'));

const standardizeCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('standardizeCheckbox'));

const downloadSourcePDFElem = /** @type {HTMLInputElement} */(document.getElementById('downloadSourcePDF'));

downloadSourcePDFElem.addEventListener('click', async () => {
  const muPDFScheduler = await imageCache.getMuPDFScheduler(1);
  const w = muPDFScheduler.workers[0];

  if (!w.pdfDoc) {
    console.log('No PDF document is open.');
    return;
  }

  const content = await w.write({
    doc1: w.pdfDoc, humanReadable: humanReadablePDFElem.checked,
  });

  const pdfBlob = new Blob([content], { type: 'application/octet-stream' });

  const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
  saveAs(pdfBlob, fileName);
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
  const pageCount = globalThis.pageCount;

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

export async function handleDownload() {
  elem.download.download.removeEventListener('click', handleDownload);
  elem.download.download.disabled = true;

  updatePdfPagesLabel();

  const downloadType = elem.download.formatLabelText.textContent?.toLowerCase();

  // If recognition is currently running, wait for it to finish.
  await globalThis.state.recognizeAllPromise;

  const minValue = parseInt(elem.download.pdfPageMin.value) - 1;
  const maxValue = parseInt(elem.download.pdfPageMax.value) - 1;

  /** @type {Array<OcrPage>} */
  let hocrDownload = [];

  if (downloadType !== 'hocr' && elem.info.enableLayout.checked) {
    // Reorder HOCR elements according to layout boxes
    for (let i = 0; i < ocrAll.active.length; i++) {
      hocrDownload.push(reorderHOCR(ocrAll.active[i], layoutAll[i]));
    }
  } else {
    hocrDownload = ocrAll.active;
  }

  if (downloadType === 'pdf') {
    const standardizeSizeMode = standardizeCheckboxElem.checked;
    const dimsLimit = { width: -1, height: -1 };
    if (standardizeSizeMode) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit.height = Math.max(dimsLimit.height, pageMetricsArr[i].dims.height);
        dimsLimit.width = Math.max(dimsLimit.width, pageMetricsArr[i].dims.width);
      }
    }

    const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.pdf`;
    let pdfBlob;

    const confThreshHigh = parseInt(elem.info.confThreshHigh.value) || 85;
    const confThreshMed = parseInt(elem.info.confThreshMed.value) || 75;

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (elem.view.displayMode.value !== 'ebook') {
      const steps = elem.info.addOverlayCheckbox.checked ? 2 : 3;
      const downloadProgress = initializeProgress('generate-download-progress-collapse', (maxValue + 1) * steps);
      await sleep(0);

      const insertInputPDF = inputDataModes.pdfMode && elem.info.addOverlayCheckbox.checked;

      const rotateBackground = !insertInputPDF && elem.view.autoRotateCheckbox.checked;

      const rotateText = !rotateBackground;

      // Currently makes a pdf with all pages, regardless of what the user requests
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images.
      // The `maxpage` argument must be set manually to `globalThis.pageCount-1`, as this avoids an error in the case where there is no OCR data (`hocrDownload` has length 0).
      // In all other cases, this should be equivalent to using the default argument of `-1` (which results in `hocrDownload.length` being used).
      const pdfStr = await hocrToPDF(hocrDownload, 0, globalThis.pageCount - 1, getDisplayMode(), rotateText, rotateBackground,
        { width: -1, height: -1 }, downloadProgress, confThreshHigh, confThreshMed, parseFloat(elem.view.rangeOpacity.value || '80') / 100);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      if (intermediatePDFElem.checked) {
        pdfBlob = new Blob([pdfEnc], { type: 'application/octet-stream' });
        // Fill up progress bar to 100%
        for (let i = downloadProgress.value; i < downloadProgress.maxValue; i++) downloadProgress.increment();
        saveAs(pdfBlob, fileName);
        elem.download.download.disabled = false;
        elem.download.download.addEventListener('click', handleDownload);
        return;
      }

      // Create a new scheduler if one does not yet exist.
      // This would be the case for image uploads.
      const muPDFScheduler = await imageCache.getMuPDFScheduler(1);
      const w = muPDFScheduler.workers[0];
      // const fileData = await pdfOverlayBlob.arrayBuffer();
      // The file name is only used to detect the ".pdf" extension
      const pdfOverlay = await w.openDocument(pdfEnc.buffer, 'document.pdf');

      let content;

      let insertInputFailed = false;

      // If the input document is a .pdf and "Add Text to Import PDF" option is enabled, we insert the text into that pdf (rather than making a new one from scratch)
      if (insertInputPDF) {
        // TODO: Figure out how to handle duplicative text--where the same text is in the source document and the OCR overlay.
        // An earlier version handled this by deleting the text in the source document,
        // however this resulted in results that were not as expected by the user (a visual element disappeared).
        try {
          content = await w.overlayText({
            doc2: pdfOverlay,
            minpage: minValue,
            maxpage: maxValue,
            pagewidth: dimsLimit.width,
            pageheight: dimsLimit.height,
            humanReadable: humanReadablePDFElem.checked,
          });

          // Fill up progress bar to 100%
          for (let i = downloadProgress.value; i < downloadProgress.maxValue; i++) downloadProgress.increment();
        } catch (error) {
          console.error('Failed to insert contents into input PDF, creating new PDF from rendered images instead.');
          console.error(error);
          insertInputFailed = true;
        }
      }

      // If the input is a series of images, those images need to be inserted into a new pdf
      if (!insertInputPDF && (inputDataModes.pdfMode || inputDataModes.imageMode) || insertInputFailed) {
        const colorMode = /** @type {('color'|'gray'|'binary')} */ (elem.view.colorMode.value);

        const props = { rotated: rotateBackground, upscaled: false, colorMode };
        const binary = elem.view.colorMode.value === 'binary';

        // An image could be rendered if either (1) binary is selected or (2) the input data is a PDF.
        // Otherwise, the images uploaded by the user are used.
        const renderImage = binary || inputDataModes.pdfMode;

        // Pre-render to benefit from parallel processing, since the loop below is synchronous.
        if (renderImage) await imageCache.preRenderRange(minValue, maxValue, binary, props, downloadProgress);

        await w.overlayTextImageStart({ humanReadable: humanReadablePDFElem.checked });
        for (let i = minValue; i < maxValue + 1; i++) {
          /** @type {import('../containers/imageContainer.js').ImageWrapper} */
          let image;
          if (binary) {
            image = await imageCache.getBinary(i, props);
          } else if (inputDataModes.pdfMode) {
            image = await imageCache.getNative(i, props);
          } else {
            image = await imageCache.nativeSrc[i];
          }

          // Angle the PDF viewer is instructed to rotated the image by.
          // This method is currently only used when rotation is needed but the user's (unrotated) source images are being used.
          // If the images are being rendered, then rotation is expected to be applied within the rendering process.
          const angleImagePdf = rotateBackground && !renderImage ? (pageMetricsArr[i].angle || 0) * -1 : 0;

          await w.overlayTextImageAddPage({
            doc1: pdfOverlay, image: image.src, i, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, angle: angleImagePdf,
          });
          downloadProgress.increment();
        }
        content = await w.overlayTextImageEnd();

        // Fill up progress bar to 100%
        for (let i = downloadProgress.value; i < downloadProgress.maxValue; i++) downloadProgress.increment();

        // Otherwise, there is only OCR data and not image data.
      } else if (!insertInputPDF) {
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

      const pdfStr = await hocrToPDF(hocrDownload, minValue, maxValue, getDisplayMode(), false, true, dimsLimit, downloadProgress, confThreshHigh, confThreshMed,
        parseFloat(elem.view.rangeOpacity.value || '80') / 100);

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
        const muPDFScheduler = await imageCache.getMuPDFScheduler(1);
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
    renderHOCRBrowser(ocrAll.active, minValue, maxValue);
    downloadProgress.increment();
  } else if (downloadType === 'text') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);

    const removeLineBreaks = elem.download.reflowCheckbox.checked;
    const breaksBetweenPages = elem.download.pageBreaksCheckbox.checked;

    const textStr = renderText(hocrDownload, minValue, maxValue, removeLineBreaks, breaksBetweenPages);

    const textBlob = new Blob([textStr], { type: 'text/plain' });
    const fileName = `${elem.download.downloadFileName.value.replace(/\.\w{1,4}$/, '')}.txt`;

    saveAs(textBlob, fileName);
    downloadProgress.increment();
  } else if (downloadType === 'docx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeDocx = (await import('../export/exportWriteDocx.js')).writeDocx;
    writeDocx(hocrDownload, minValue, maxValue);
    downloadProgress.increment();
  } else if (downloadType === 'xlsx') {
    const downloadProgress = initializeProgress('generate-download-progress-collapse', 1);
    await sleep(0);
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeXlsx = (await import('../export/exportWriteTabular.js')).writeXlsx;
    writeXlsx(hocrDownload, minValue, maxValue);
    downloadProgress.increment();
  }

  elem.download.download.disabled = false;
  elem.download.download.addEventListener('click', handleDownload);
}
