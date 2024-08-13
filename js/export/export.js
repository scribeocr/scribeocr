import { inputData, opt } from '../containers/app.js';
import { layoutRegions, ocrAll, pageMetricsArr } from '../containers/dataContainer.js';
import { ImageCache } from '../containers/imageContainer.js';
import { reorderOcrPage } from '../modifyOCR.js';
import { saveAs } from '../utils/miscUtils.js';
import { hocrToPDF } from './exportPDF.js';
import { renderHOCR } from './exportRenderHOCR.js';
import { renderText } from './exportRenderText.js';

/**
 * @param {'pdf'|'hocr'|'docx'|'xlsx'|'txt'|'text'} format
 * @param {number} [minValue=0]
 * @param {number} [maxValue=-1]
 * @returns {Promise<string|ArrayBuffer>}
 */
export async function exportData(format, minValue = 0, maxValue = -1) {
  if (format === 'text') format = 'txt';

  if (maxValue === -1) maxValue = inputData.pageCount - 1;

  /** @type {Array<OcrPage>} */
  let ocrDownload = [];

  if (format !== 'hocr' && opt.enableLayout) {
    // Reorder HOCR elements according to layout boxes
    for (let i = 0; i < ocrAll.active.length; i++) {
      ocrDownload.push(reorderOcrPage(ocrAll.active[i], layoutRegions.pages[i]));
    }
  } else {
    ocrDownload = ocrAll.active;
  }

  /** @type {string|ArrayBuffer} */
  let content;

  if (format === 'pdf') {
    const dimsLimit = { width: -1, height: -1 };
    if (opt.standardizePageSize) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit.height = Math.max(dimsLimit.height, pageMetricsArr[i].dims.height);
        dimsLimit.width = Math.max(dimsLimit.width, pageMetricsArr[i].dims.width);
      }
    }

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (opt.displayMode !== 'ebook') {
      const insertInputPDF = inputData.pdfMode && opt.addOverlay;

      const rotateBackground = !insertInputPDF && opt.autoRotate;

      const rotateText = !rotateBackground;

      // Currently makes a pdf with all pages, regardless of what the user requests
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images.
      // The `maxpage` argument must be set manually to `inputData.pageCount-1`, as this avoids an error in the case where there is no OCR data (`hocrDownload` has length 0).
      // In all other cases, this should be equivalent to using the default argument of `-1` (which results in `hocrDownload.length` being used).
      const pdfStr = await hocrToPDF(ocrDownload, 0, inputData.pageCount - 1, opt.displayMode, rotateText, rotateBackground,
        { width: -1, height: -1 }, opt.confThreshHigh, opt.confThreshMed, opt.overlayOpacity / 100);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      if (opt.intermediatePDF) return pdfEnc;

      // Create a new scheduler if one does not yet exist.
      // This would be the case for image uploads.
      const muPDFScheduler = await ImageCache.getMuPDFScheduler(1);
      const w = muPDFScheduler.workers[0];
      // const fileData = await pdfOverlayBlob.arrayBuffer();
      // The file name is only used to detect the ".pdf" extension
      const pdfOverlay = await w.openDocument(pdfEnc.buffer, 'document.pdf');

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
            humanReadable: opt.humanReadablePDF,
          });
        } catch (error) {
          console.error('Failed to insert contents into input PDF, creating new PDF from rendered images instead.');
          console.error(error);
          insertInputFailed = true;
        }
      }

      // If the input is a series of images, those images need to be inserted into a new pdf
      if (!insertInputPDF && (inputData.pdfMode || inputData.imageMode) || insertInputFailed) {
        const props = { rotated: rotateBackground, upscaled: false, colorMode: opt.colorMode };
        const binary = opt.colorMode === 'binary';

        // An image could be rendered if either (1) binary is selected or (2) the input data is a PDF.
        // Otherwise, the images uploaded by the user are used.
        const renderImage = binary || inputData.pdfMode;

        // Pre-render to benefit from parallel processing, since the loop below is synchronous.
        if (renderImage) await ImageCache.preRenderRange(minValue, maxValue, binary, props);

        await w.overlayTextImageStart({ humanReadable: opt.humanReadablePDF });
        for (let i = minValue; i < maxValue + 1; i++) {
          /** @type {import('../containers/imageContainer.js').ImageWrapper} */
          let image;
          if (binary) {
            image = await ImageCache.getBinary(i, props);
          } else if (inputData.pdfMode) {
            image = await ImageCache.getNative(i, props);
          } else {
            image = await ImageCache.nativeSrc[i];
          }

          // Angle the PDF viewer is instructed to rotated the image by.
          // This method is currently only used when rotation is needed but the user's (unrotated) source images are being used.
          // If the images are being rendered, then rotation is expected to be applied within the rendering process.
          const angleImagePdf = rotateBackground && !renderImage ? (pageMetricsArr[i].angle || 0) * -1 : 0;

          await w.overlayTextImageAddPage({
            doc1: pdfOverlay, image: image.src, i, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, angle: angleImagePdf,
          });
          opt.progressHandler({ n: i, type: 'export', info: { } });
        }
        content = await w.overlayTextImageEnd();

        // Otherwise, there is only OCR data and not image data.
      } else if (!insertInputPDF) {
        content = await w.write({
          doc1: pdfOverlay, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: opt.humanReadablePDF,
        });
      }
    } else {
      const pdfStr = await hocrToPDF(ocrDownload, minValue, maxValue, opt.displayMode, false, true, dimsLimit, opt.confThreshHigh, opt.confThreshMed,
        opt.overlayOpacity / 100);

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
      if (opt.intermediatePDF) return pdfEnc;

      const muPDFScheduler = await ImageCache.getMuPDFScheduler(1);
      const w = muPDFScheduler.workers[0];

      // The file name is only used to detect the ".pdf" extension
      const pdf = await w.openDocument(pdfEnc.buffer, 'document.pdf');

      content = await w.write({
        doc1: pdf, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: opt.humanReadablePDF,
      });
    }
  } if (format === 'hocr') {
    content = renderHOCR(ocrAll.active, minValue, maxValue);
  } if (format === 'txt') {
    content = renderText(ocrDownload, minValue, maxValue, opt.reflow, false);
  } if (format === 'docx') {
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeDocx = (await import('./exportWriteDocx.js')).writeDocx;
    content = await writeDocx(ocrDownload, minValue, maxValue);
  } if (format === 'xlsx') {
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeXlsx = (await import('./exportWriteTabular.js')).writeXlsx;
    content = await writeXlsx(ocrDownload, minValue, maxValue);
  }
  return content;
}

/**
 * Runs `exportData` and saves the result as a download (browser) or local file (Node.js).
 * @param {'pdf'|'hocr'|'docx'|'xlsx'|'txt'|'text'} format
 * @param {string} fileName
 * @param {number} [minValue=0]
 * @param {number} [maxValue=-1]
 */
export async function download(format, fileName, minValue = 0, maxValue = -1) {
  if (format === 'text') format = 'txt';
  fileName = fileName.replace(/\.\w{1,4}$/, `.${format}`);
  const content = await exportData(format, minValue, maxValue);
  saveAs(content, fileName);
}
