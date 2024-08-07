// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */
import { clearData } from '../../js/clear.js';
import { ocrAll } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { importFilesAll } from '../../js/import/import.js';
import { assert, config } from '../../node_modules/chai/chai.js';
// import mocha from '../../node_modules/mocha/mocha.js';
import { renderHOCR } from '../../js/export/exportRenderHOCR.js';
import { loadBuiltInFontsRaw } from '../../js/fontContainerMain.js';
import { initGeneralScheduler, initTesseractInWorkers } from '../../js/generalWorkerMain.js';
import { splitHOCRStr } from '../../js/import/importOCR.js';
import ocr from '../../js/objects/ocrObjects.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

/**
 *
 * @param {Array<OcrPage>} ocrArr
 */
const standardizeOCRPages = (ocrArr) => {
  const ocrArrCopy = ocrArr.map((x) => ocr.clonePage(x));

  ocrArrCopy.forEach((page) => {
    page.lines.forEach((line) => {
      line.raw = null;
      line.bbox.left = Math.round(line.bbox.left);
      line.bbox.top = Math.round(line.bbox.top);
      line.bbox.right = Math.round(line.bbox.right);
      line.bbox.bottom = Math.round(line.bbox.bottom);
      line.words.forEach((word) => {
        word.raw = null;
        word.bbox.left = Math.round(word.bbox.left);
        word.bbox.top = Math.round(word.bbox.top);
        word.bbox.right = Math.round(word.bbox.right);
        word.bbox.bottom = Math.round(word.bbox.bottom);
        if (word.size) word.size = Math.round(word.size);
        word.chars = null;
      });
    });
  });

  return ocrArrCopy;
};

describe('Check .hocr export function.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    await initTesseractInWorkers({});
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());

    await importFilesAll([`${ASSETS_PATH_KARMA}/scribe_test_pdf1_abbyy.xml`]);
  });

  it('Exporting to .hocr and reimporting should restore OCR data without modification', async () => {
    const ocrAllComp1 = standardizeOCRPages(ocrAll.active);

    const hocrOutStrArr = splitHOCRStr(renderHOCR(ocrAll.active));

    const resArrPromises = hocrOutStrArr.map((x, i) => (gs.schedulerInner.addJob('convertPageHocr', { ocrStr: x, n: i, scribeMode: true })));
    const resArr = await Promise.all(resArrPromises);
    const pagesArr = resArr.map((x) => (x.pageObj));

    const ocrAllComp2 = standardizeOCRPages(pagesArr);

    assert.deepStrictEqual(ocrAllComp1, ocrAllComp2);
  }).timeout(10000);

  after(async () => {
    await gs.terminate();
    await clearData();
  });
}).timeout(120000);
