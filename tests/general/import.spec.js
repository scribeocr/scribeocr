// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */
import { clearData } from '../../js/clear.js';
import { opt } from '../../js/containers/app.js';
import { ocrAll, pageMetricsArr } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { loadBuiltInFontsRaw } from '../../js/fontContainerMain.js';
import { initGeneralScheduler } from '../../js/generalWorkerMain.js';
import { importFilesAll } from '../../js/import/import.js';
import { getParText } from '../../js/objects/ocrObjects.js';
import { assignParagraphs } from '../../js/utils/ocrUtils.js';
import { assert, config } from '../../node_modules/chai/chai.js';
// import mocha from '../../node_modules/mocha/mocha.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

describe('Check stext import function.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/econometrica_example.pdf`]);
  });

  it('Should correctly import small caps printed using font size adjustments', async () => {
    const text1 = ocrAll.active[0].lines[3].words.map((x) => x.text).join(' ');

    const text2 = ocrAll.active[0].lines[22].words.map((x) => x.text).join(' ');

    assert.strictEqual(text1, 'Shubhdeep Deb');

    assert.strictEqual(text2, 'Wage inequality in the United States has risen sharply since the 1980s. The skill');
  }).timeout(10000);

  it('Should correctly import trailing superscripts printed using font size adjustments', async () => {
    assert.strictEqual(ocrAll.active[0].lines[25].words[8].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[25].words[8].text, '1');
  }).timeout(10000);

  it('Should correctly import leading superscripts printed using font size adjustments', async () => {
    assert.strictEqual(ocrAll.active[0].lines[43].words[0].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[43].words[0].text, '1');
  }).timeout(10000);

  it('Should correctly calculate line angle for lines that start or end with superscripts.', async () => {
    // Line that ends with superscript.
    assert.strictEqual(ocrAll.active[0].lines[28].baseline[0], 0);
    // Line that starts with superscript.
    assert.strictEqual(ocrAll.active[0].lines[43].baseline[0], 0);
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

// This test is conceptually similar to the previous one, but it uses a different document.
// The tests have failed for this document when they have passed for the previous one, so having both adds value.
describe('Check stext import function (2nd doc).', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/academic_article_1.pdf`]);
  });

  it('Should correctly import trailing superscripts printed using font size adjustments (2nd doc)', async () => {
    assert.strictEqual(ocrAll.active[0].lines[1].words[2].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[1].words[2].text, '1');
  }).timeout(10000);

  it('Should correctly import leading superscripts printed using font size adjustments (2nd doc)', async () => {
    assert.strictEqual(ocrAll.active[0].lines[36].words[0].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[36].words[0].text, '1');
  }).timeout(10000);

  it('Should correctly calculate line angle for lines that start with superscripts (2nd doc).', async () => {
    // Line that starts with superscript.
    assert.strictEqual(ocrAll.active[0].lines[36].baseline[0], 0);
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check stext import function (3rd doc).', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/academic_article_2.pdf`]);
  });

  it('Should correctly import leading superscripts printed using font size adjustments (3rd doc)', async () => {
    assert.strictEqual(ocrAll.active[0].lines[24].words[0].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[24].words[0].text, '2');
  }).timeout(10000);

  it('Should correctly parse font size for lines with superscripts (3rd doc)', async () => {
    const words = ocrAll.active[0].lines[24].words;
    assert.isTrue(words.map((word) => word.size && Math.round(word.size) === 29).reduce((acc, val) => acc && val));
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check paragraph detection with academic article.', function () {
  this.timeout(20000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/academic_article_1.pdf`]);
    ocrAll.active.forEach((page, index) => {
      const angle = pageMetricsArr[index].angle || 0;
      assignParagraphs(page, angle);
    });
  });

  it('Paragraph detection functions with single-column layout with header and footnotes', async () => {
    // The test document contains a header, 3 body paragraphs, and 3 footnotes.
    assert.strictEqual(ocrAll.active[0].pars.length, 7);
    assert.strictEqual(getParText(ocrAll.active[0].pars[0]), 'WHISTLEBLOWERS AND ENFORCEMENT ACTIONS 125');
    assert.strictEqual(getParText(ocrAll.active[0].pars[6]), '3 The respondent is the party (either a firm or an individual) targeted by the SEC/DOJ.');
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
});

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

  it('Should correctly import trailing superscripts with superscript attribute', async () => {
    assert.strictEqual(ocrAll.active[0].lines[26].words[8].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[26].words[8].text, '1');
  }).timeout(10000);

  it('Should correctly import leading superscripts with superscript attribute', async () => {
    assert.strictEqual(ocrAll.active[0].lines[44].words[0].sup, true);
    assert.strictEqual(ocrAll.active[0].lines[44].words[0].text, '1');
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check stext import function language support.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/chi_eng_mixed_sample.pdf`]);
  });

  it('Should import Chinese characters', async () => {
    const text1 = ocrAll.active[0].lines[2].words.map((x) => x.text).join(' ');

    assert.strictEqual(text1, '嚴 重 特 殊 傳 染 性 肺 炎 指 定 處 所 隔 離 通 知 書 及 提 審 權 利 告 知');
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check Tesseract import function language support.', function () {
  this.timeout(10000);
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([`${ASSETS_PATH_KARMA}/chi_eng_mixed_sample_tess.hocr`]);
  });

  it('Should import Chinese characters', async () => {
    const text1 = ocrAll.active[0].lines[2].words.map((x) => x.text).join(' ');

    assert.strictEqual(text1, '严 重 特 殊 传 染 性 肺 粉 指 定 处 所 隔 离 通 知 书 及 提 害 权 利 告 知');
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
