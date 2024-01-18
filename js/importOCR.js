// import { updateDataProgress } from "../main.js";
import { readOcrFile } from './miscUtils.js';

/**
 * Import raw OCR data from files.
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {File[]} hocrFilesAll - Array of OCR files
 * @param {boolean} extractSuppData - Whether to extract font metrics and layout data (if it exists).
 */

export async function importOCR(hocrFilesAll, extractSuppData = true) {
  hocrFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1;

  let hocrStrStart = '';
  let hocrStrEnd = '';
  let abbyyMode = false;
  let stextMode = false;

  let hocrStrPages; let hocrArrPages; let pageCountHOCR; let hocrRaw; let fontMetricsObj; let
    layoutObj;

  if (singleHOCRMode) {
    const singleHOCRMode = true;
    const hocrStrAll = await readOcrFile(hocrFilesAll[0]);

    // Check whether input is Abbyy XML
    const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
    abbyyMode = !!/abbyy/i.test(node2);
    stextMode = !!/\<document name/.test(node2);

    if (abbyyMode) {
      // hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
      // hocrArrPages = hocrStrPages.split(/(?=\<page)/);

      hocrArrPages = hocrStrAll.split(/(?=\<page)/).slice(1);
    } else if (stextMode) {
      hocrArrPages = hocrStrAll.split(/(?=\<page)/).slice(1);
    } else {
      if (extractSuppData) {
        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

        if (inputDataModes.resumeMode) {
          const fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
          const contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
          fontMetricsObj = JSON.parse(contentStr);
        }

        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        const layoutDataExists = /\<meta name\=[\"\']layout[\"\']/i.test(hocrStrAll);

        if (layoutDataExists) {
          const layoutStr = hocrStrAll.match(/\<meta name\=[\"\']layout[\"\'][^\<]+/i)[0];
          const contentStr = layoutStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
          layoutObj = JSON.parse(contentStr);
        }
      }

      hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
      hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
      hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, '');
      hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, '');
      hocrStrPages = hocrStrPages.trim();

      hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
    }

    pageCountHOCR = hocrArrPages.length;
    hocrRaw = Array(pageCountHOCR);
    for (let i = 0; i < pageCountHOCR; i++) {
      hocrRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }
  } else {
    const singleHOCRMode = false;
    pageCountHOCR = hocrFilesAll.length;
    hocrRaw = Array(pageCountHOCR);

    // Check whether input is Abbyy XML using the first file
    const hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
    const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
    abbyyMode = !!/abbyy/i.test(node2);

    for (let i = 0; i < pageCountHOCR; i++) {
      const hocrFile = hocrFilesAll[i];
      hocrRaw[i] = await readOcrFile(hocrFile);
    }
  }

  return {
    hocrRaw, fontMetricsObj, layoutObj, abbyyMode, stextMode,
  };
}
