import { assert } from 'chai';
import { after, it } from 'mocha';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearData } from '../../js/clear.js';
import { opt } from '../../js/containers/app.js';
import { ocrAll } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { loadBuiltInFontsRaw } from '../../js/fontContainerMain.js';
import { initGeneralScheduler } from '../../js/generalWorkerMain.js';
import { importFilesAll } from '../../js/import/import.js';

globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Check stext import function.', () => {
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([path.join(__dirname, '../assets/econometrica_example.pdf')]);
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

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);

describe('Check Tesseract import function.', () => {
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([path.join(__dirname, '../assets/econometrica_example_tess.hocr')]);
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

describe('Check Abbyy XML import function.', () => {
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([path.join(__dirname, '../assets/econometrica_example_abbyy.xml')]);
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

describe('Check stext import function language support.', () => {
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([path.join(__dirname, '../assets/chi_eng_mixed_sample.pdf')]);
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

describe('Check Tesseract import function language support.', () => {
  before(async () => {
    await initGeneralScheduler();
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    await importFilesAll([path.join(__dirname, '../assets/chi_eng_mixed_sample_tess.hocr')]);
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

describe('Check cleanup functions allow for resetting module.', () => {
  it('Check that cleanup functions work properly', async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([path.join(__dirname, '../assets/chi_eng_mixed_sample.pdf')]);
    await gs.schedulerInner.terminate();
    await gs.clear();
    await clearData();
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([path.join(__dirname, '../assets/chi_eng_mixed_sample.pdf')]);
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
}).timeout(120000);
