// import { updateDataProgress } from "../main.js";
import { readOcrFile } from '../utils/miscUtils.js';

/**
 * Import raw OCR data from files.
 * Currently supports .hocr (used by Tesseract), Abbyy .xml, and stext (an intermediate data format used by mupdf).
 *
 * @param {File[]} hocrFilesAll - Array of OCR files
 * @param {boolean} extractSuppData - Whether to extract font metrics and layout data (if it exists).
 */

export async function importOCRFiles(hocrFilesAll, extractSuppData = true) {
  hocrFilesAll.sort((a, b) => ((a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0)));

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length === 1;

  let hocrStrStart = '';
  let hocrStrEnd = '';
  let abbyyMode = false;
  let stextMode = false;
  let scribeMode = false;

  let hocrStrPages;
  let hocrArrPages;
  let pageCountHOCR;
  let hocrRaw;
  /** @type  {?Object.<string, FontMetricsFamily>} */
  let fontMetricsObj;
  /** @type{?Array<import('../objects/layoutObjects.js').LayoutPage>} */
  let layoutObj = null;
  /** @type{?Array<import('../objects/layoutObjects.js').LayoutDataTablePage>} */
  let layoutDataTableObj = null;
  let defaultFont;
  let enableOpt;
  let sansFont;
  let serifFont;

  if (singleHOCRMode) {
    const hocrStrAll = await readOcrFile(hocrFilesAll[0]);

    // Check whether input is Abbyy XML
    const node2 = hocrStrAll.match(/>([^>]+)/)[1];
    abbyyMode = !!/abbyy/i.test(node2);
    stextMode = !!/<document name/.test(node2);

    if (abbyyMode) {
      hocrArrPages = hocrStrAll.split(/(?=<page)/).slice(1);
    } else if (stextMode) {
      hocrArrPages = hocrStrAll.split(/(?=<page)/).slice(1);
    } else {
      hocrStrStart = hocrStrAll.match(/[\s\S]*?<body>/)[0];
      hocrStrEnd = hocrStrAll.match(/<\/body>[\s\S]*$/)[0];
      hocrStrPages = hocrStrAll.replace(/[\s\S]*?<body>/, '');
      hocrStrPages = hocrStrPages.replace(/<\/body>[\s\S]*$/, '');
      hocrStrPages = hocrStrPages.trim();

      hocrArrPages = hocrStrPages.split(/(?=<div class=['"]ocr_page['"])/);
    }

    pageCountHOCR = hocrArrPages.length;
    hocrRaw = Array(pageCountHOCR);
    for (let i = 0; i < pageCountHOCR; i++) {
      hocrRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }
  } else {
    pageCountHOCR = hocrFilesAll.length;
    hocrRaw = Array(pageCountHOCR);

    // Check whether input is Abbyy XML using the first file
    const hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
    const node2 = hocrStrFirst.match(/>([^>]+)/)[1];
    abbyyMode = !!/abbyy/i.test(node2);

    for (let i = 0; i < pageCountHOCR; i++) {
      const hocrFile = hocrFilesAll[i];
      hocrRaw[i] = await readOcrFile(hocrFile);
    }
  }

  if (!abbyyMode && !stextMode && hocrRaw[0]) {
    const getMeta = (name) => {
      const regex = new RegExp(`<meta name=["']${name}["'][^<]+`, 'i');

      const nodeStr = hocrRaw[0].match(regex)?.[0];
      if (!nodeStr) return null;
      const contentStr = nodeStr.match(/content=["']([\s\S]+?)(?=["']\s{0,5}\/?>)/i)?.[1];
      if (!contentStr) return null;
      return contentStr.replace(/&quot;/g, '"');
    };

    const ocrSystem = getMeta('ocr-system');
    scribeMode = ocrSystem === 'scribeocr';

    // Font optimization and layout settings are skipped in the fringe case where .hocr files are produced individually using Scribe,
    // and then re-uploaded together for further processing, since only the first page is parsed for metadata.
    // Hopefully this case is rare enough that it does not come up often.
    if (singleHOCRMode) {
      const fontMetricsStr = getMeta('font-metrics');
      if (fontMetricsStr) {
        fontMetricsObj = /** @type  {Object.<string, FontMetricsFamily>} */ (JSON.parse(fontMetricsStr));

        // Older versions of the font metrics object used 'small-caps' instead of 'smallCaps'.
        for (const key in fontMetricsObj) {
          if (fontMetricsObj[key]['small-caps'] && !fontMetricsObj[key].smallCaps) fontMetricsObj[key].smallCaps = fontMetricsObj[key]['small-caps'];
        }
      }

      const layoutStr = getMeta('layout');
      if (layoutStr) layoutObj = /** @type{Array<import('../objects/layoutObjects.js').LayoutPage>} */ (JSON.parse(layoutStr));

      const layoutDataTableStr = getMeta('layout-data-table');
      if (layoutDataTableStr) layoutDataTableObj = /** @type{Array<import('../objects/layoutObjects.js').LayoutDataTablePage>} */ (JSON.parse(layoutDataTableStr));

      const enableOptStr = getMeta('enable-opt');
      if (enableOptStr) enableOpt = enableOptStr;
    }

    const defaultFontStr = getMeta('default-font');
    if (defaultFontStr) defaultFont = defaultFontStr;

    const sansFontStr = getMeta('sans-font');
    if (sansFontStr) sansFont = sansFontStr;

    const serifFontStr = getMeta('serif-font');
    if (serifFontStr) serifFont = serifFontStr;
  }

  return {
    hocrRaw, fontMetricsObj, layoutObj, layoutDataTableObj, abbyyMode, stextMode, scribeMode, defaultFont, enableOpt, sansFont, serifFont,
  };
}
