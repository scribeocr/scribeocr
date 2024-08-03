import { inputData, opt, state } from '../containers/app.js';
import { LayoutRegions, ocrAll, pageMetricsArr } from '../containers/dataContainer.js';
import { ImageCache } from '../containers/imageContainer.js';
import { reorderOcrPage } from '../modifyOCR.js';
import { saveAs, sleep } from '../utils/miscUtils.js';
import { renderParJSON } from './exportParJSON.js';
import { hocrToPDF } from './exportPDF.js';
import { renderHOCR } from './exportRenderHOCR.js';
import { renderText } from './exportRenderText.js';

/**
 * @param {'pdf'|'hocr'|'docx'|'xlsx'|'txt'|'text'|'json'} downloadType
 * @param {string} fileName
 * @param {number} [minValue=0]
 * @param {number} [maxValue=-1]
 */
export async function handleDownload(downloadType, fileName, minValue = 0, maxValue = -1) {
  if (downloadType === 'text') downloadType = 'txt';

  // If recognition is currently running, wait for it to finish.
  await state.recognizeAllPromise;

  if (maxValue === -1) maxValue = state.pageCount - 1;

  /** @type {Array<OcrPage>} */
  let ocrDownload = [];

  if (downloadType !== 'hocr' && opt.enableLayout) {
    // Reorder HOCR elements according to layout boxes
    for (let i = 0; i < ocrAll.active.length; i++) {
      ocrDownload.push(reorderOcrPage(ocrAll.active[i], LayoutRegions.pages[i]));
    }
  } else {
    ocrDownload = ocrAll.active;
  }

  if (downloadType === 'pdf') {
    const dimsLimit = { width: -1, height: -1 };
    if (opt.standardizePageSize) {
      for (let i = minValue; i <= maxValue; i++) {
        dimsLimit.height = Math.max(dimsLimit.height, pageMetricsArr[i].dims.height);
        dimsLimit.width = Math.max(dimsLimit.width, pageMetricsArr[i].dims.width);
      }
    }

    fileName = `${fileName.replace(/\.\w{1,4}$/, '')}.pdf`;
    let content;

    // For proof or ocr mode the text layer needs to be combined with a background layer
    if (opt.displayMode !== 'ebook') {
      const steps = opt.addOverlay ? 2 : 3;
      if (state.progress) state.progress.show((maxValue + 1) * steps);
      await sleep(0);

      const insertInputPDF = inputData.pdfMode && opt.addOverlay;

      const rotateBackground = !insertInputPDF && opt.autoRotate;

      const rotateText = !rotateBackground;

      // Currently makes a pdf with all pages, regardless of what the user requests
      // (as the mupdf part of the code expects both the background and overlay pdf to have corresponding page numbers)
      // Consider reworking if performance hit is meaningful.

      // Page sizes should not be standardized at this step, as the overlayText/overlayTextImage functions will perform this,
      // and assume that the overlay PDF is the same size as the input images.
      // The `maxpage` argument must be set manually to `state.pageCount-1`, as this avoids an error in the case where there is no OCR data (`hocrDownload` has length 0).
      // In all other cases, this should be equivalent to using the default argument of `-1` (which results in `hocrDownload.length` being used).
      const pdfStr = await hocrToPDF(ocrDownload, 0, state.pageCount - 1, opt.displayMode, rotateText, rotateBackground,
        { width: -1, height: -1 }, opt.confThreshHigh, opt.confThreshMed, opt.overlayOpacity / 100);

      const enc = new TextEncoder();
      const pdfEnc = enc.encode(pdfStr);

      if (opt.intermediatePDF) {
        // Fill up progress bar to 100%
        if (state.progress) state.progress.fill();
        saveAs(pdfEnc, fileName);
        return;
      }

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

          // Fill up progress bar to 100%
          if (state.progress) state.progress.fill();
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
        if (renderImage) await ImageCache.preRenderRange(minValue, maxValue, binary, props, state.progress);

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
          if (state.progress) state.progress.increment();
        }
        content = await w.overlayTextImageEnd();

        // Fill up progress bar to 100%
        if (state.progress) state.progress.fill();

        // Otherwise, there is only OCR data and not image data.
      } else if (!insertInputPDF) {
        content = await w.write({
          doc1: pdfOverlay, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: opt.humanReadablePDF,
        });

        // Fill up progress bar to 100%
        if (state.progress) state.progress.fill();
      }
    } else {
      if (state.progress) state.progress.show(maxValue + 1);
      await sleep(0);

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
      if (opt.intermediatePDF) {
        content = new Blob([pdfEnc], { type: 'application/octet-stream' });
      } else {
        const muPDFScheduler = await ImageCache.getMuPDFScheduler(1);
        const w = muPDFScheduler.workers[0];

        // The file name is only used to detect the ".pdf" extension
        const pdf = await w.openDocument(pdfEnc.buffer, 'document.pdf');

        content = await w.write({
          doc1: pdf, minpage: minValue, maxpage: maxValue, pagewidth: dimsLimit.width, pageheight: dimsLimit.height, humanReadable: opt.humanReadablePDF,
        });
      }
    }
    saveAs(content, fileName);
  } else if (downloadType === 'hocr') {
    if (state.progress) state.progress.show(1);
    await sleep(0);
    fileName = /** @type {HTMLInputElement} */`${fileName.replace(/\.\w{1,4}$/, '')}.hocr`;
    const content = renderHOCR(ocrAll.active, minValue, maxValue);
    saveAs(content, fileName);
    if (state.progress) state.progress.increment();
  } else if (downloadType === 'json') {
    if (state.progress) state.progress.show(1);
    await sleep(0);
    fileName = /** @type {HTMLInputElement} */`${fileName.replace(/\.\w{1,4}$/, '')}.json`;
    const content = renderParJSON(ocrDownload, minValue, maxValue);
    saveAs(content, fileName);
    if (state.progress) state.progress.increment();
  } else if (downloadType === 'txt') {
    if (state.progress) state.progress.show(1);
    await sleep(0);

    const content = renderText(ocrDownload, minValue, maxValue, opt.reflow, false);

    // const textBlob = new Blob([textStr], { type: 'text/plain' });
    fileName = `${fileName.replace(/\.\w{1,4}$/, '')}.txt`;

    saveAs(content, fileName);
    if (state.progress) state.progress.increment();
  } else if (downloadType === 'docx') {
    if (state.progress) state.progress.show(1);
    await sleep(0);
    fileName = `${fileName.replace(/\.\w{1,4}$/, '')}.docx`;
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeDocx = (await import('./exportWriteDocx.js')).writeDocx;
    await writeDocx(ocrDownload, fileName, minValue, maxValue);
    if (state.progress) state.progress.increment();
  } else if (downloadType === 'xlsx') {
    if (state.progress) state.progress.show(1);
    await sleep(0);
    fileName = `${fileName.replace(/\.\w{1,4}$/, '')}.xlsx`;
    // Less common export formats are loaded dynamically to reduce initial load time.
    const writeXlsx = (await import('./exportWriteTabular.js')).writeXlsx;
    await writeXlsx(ocrDownload, fileName, minValue, maxValue);
    if (state.progress) state.progress.increment();
  }
}
