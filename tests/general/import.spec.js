// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */
import { clearData } from '../../js/clear.js';
import { opt } from '../../js/containers/app.js';
import { ocrAll } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { loadBuiltInFontsRaw } from '../../js/fontContainerMain.js';
import { initGeneralScheduler } from '../../js/generalWorkerMain.js';
import { importFilesAll } from '../../js/import/import.js';
import { assert, config } from '../../node_modules/chai/chai.js';
// import mocha from '../../node_modules/mocha/mocha.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

describe('Check Tesseract import function.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([`${ASSETS_PATH_KARMA}/econometrica_example_tess.hocr`]);
  });

  it('Should correctly import small caps printed using font size adjustments', async () => {
    const text1 = ocrAll.active[0].lines[4].words.map((x) => x.text).join(' ');

    const text2 = ocrAll.active[0].lines[23].words.map((x) => x.text).join(' ');

    assert.strictEqual(text1, 'Shubhdeep Deb');

    assert.strictEqual(text2, 'Wage inequality in the United States has risen sharply since the 1980s. The skill');
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check Abbyy XML import function.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([`${ASSETS_PATH_KARMA}/econometrica_example_abbyy.xml`]);
  });

  it('Should correctly import smallcaps attribute', async () => {
    const text1 = ocrAll.active[0].lines[4].words.map((x) => x.text).join(' ');

    const text2 = ocrAll.active[0].lines[23].words.map((x) => x.text).join(' ');

    assert.strictEqual(text1, 'Shubhdeep Deb');

    assert.strictEqual(text2, 'Wage inequality in the United States has risen sharply since the 1980s. The skill');
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check cleanup functions allow for resetting module.', function () {
  this.timeout(10000);
  it('Check that cleanup functions work properly', async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/chi_eng_mixed_sample.pdf`]);
    await gs.schedulerInner.terminate();
    await gs.clear();
    await clearData();
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/chi_eng_mixed_sample.pdf`]);
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);
