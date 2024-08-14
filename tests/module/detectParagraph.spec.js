// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */

// import { after, it } from 'mocha';
import { assert, config } from '../../node_modules/chai/chai.js';
// import path from 'path';
import scribe from '../../module.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

describe('Check paragraph detection with academic article.', function () {
  this.timeout(20000);
  before(async () => {
    await scribe.init();
    scribe.opt.extractText = true;
    await scribe.importFiles([`${ASSETS_PATH_KARMA}/academic_article_1.pdf`]);
    scribe.data.ocr.active.forEach((page, index) => {
      const angle = scribe.data.pageMetrics[index].angle || 0;
      scribe.utils.assignParagraphs(page, angle);
    });
  });

  it('Paragraph detection functions with single-column layout with header and footnotes', async () => {
    // The test document contains a header, 3 body paragraphs, and 3 footnotes.
    assert.strictEqual(scribe.data.ocr.active[0].pars.length, 7);
    assert.strictEqual(scribe.utils.ocr.getParText(scribe.data.ocr.active[0].pars[0]), 'WHISTLEBLOWERS AND ENFORCEMENT ACTIONS 125');
    assert.strictEqual(scribe.utils.ocr.getParText(scribe.data.ocr.active[0].pars[6]), '3 The respondent is the party (either a firm or an individual) targeted by the SEC/DOJ.');
  }).timeout(10000);

  after(async () => {
    await scribe.terminate();
  });
});

describe('Check paragraph detection with complaint.', function () {
  this.timeout(20000);
  before(async () => {
    await scribe.init();
    scribe.opt.extractText = true;
    await scribe.importFiles([`${ASSETS_PATH_KARMA}/complaint_1.pdf`]);
    scribe.data.ocr.active.forEach((page, index) => {
      const angle = scribe.data.pageMetrics[index].angle || 0;
      scribe.utils.assignParagraphs(page, angle);
    });
  });

  it('Paragraph detection functions with single-column layout with header and footnotes', async () => {
    // The test document contains a header, 3 body paragraphs, and 3 footnotes.
    assert.strictEqual(scribe.data.ocr.active[0].pars.length, 7);
    assert.strictEqual(scribe.utils.ocr.getLineText(scribe.data.ocr.active[0].pars[2].lines[3]), 'partially offset by lower sales volumes of ($0.1 billion).” They further represented:');
    assert.strictEqual(scribe.utils.ocr.getLineText(scribe.data.ocr.active[0].pars[3].lines[0]), 'Nutrition operating profit increased 20%. Human Nutrition results were higher');
  }).timeout(10000);

  it('Paragraph detection creates new paragraph when switching to center alignment', async () => {
    assert.strictEqual(scribe.utils.ocr.getParText(scribe.data.ocr.active[1].pars[2]), 'APPLICABILITY OF PRESUMPTION OF RELIANCE: FRAUD-ON-THE-MARKET DOCTRINE');
  }).timeout(10000);

  after(async () => {
    await scribe.terminate();
  });
});

describe('Check paragraph detection with document with significant line sepacing.', function () {
  this.timeout(20000);
  before(async () => {
    await scribe.init({ font: true });
    await scribe.importFiles([`${ASSETS_PATH_KARMA}/complaint_2.hocr`]);
    scribe.data.ocr.active.forEach((page, index) => {
      const angle = scribe.data.pageMetrics[index].angle || 0;
      scribe.utils.assignParagraphs(page, angle);
    });
  });

  it('Paragraph detection creates the correct number of paragraphs', async () => {
    // The test document contains a header, 3 body paragraphs, and 3 footnotes.
    assert.strictEqual(scribe.data.ocr.active[0].pars.length, 5);
    const par2 = scribe.data.ocr.active[0].pars[2];
    const firstWord = par2.lines[0].words[0];
    const lastWord = par2.lines[4].words[par2.lines[4].words.length - 1];
    assert.strictEqual(firstWord.text, '8.');
    assert.strictEqual(lastWord.text, 'Defendant.');
  }).timeout(10000);

  after(async () => {
    await scribe.terminate();
  });
});
