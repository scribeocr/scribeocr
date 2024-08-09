// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */

// import { after, it } from 'mocha';
import { assert, config } from '../../node_modules/chai/chai.js';
// import path from 'path';
import { clearData } from '../../js/clear.js';
import { opt } from '../../js/containers/app.js';
import { ocrAll, pageMetricsArr } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { initGeneralScheduler } from '../../js/generalWorkerMain.js';
import { importFilesAll } from '../../js/import/import.js';
import { getLineText, getParText } from '../../js/objects/ocrObjects.js';
import { assignParagraphs } from '../../js/utils/reflowPars.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

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
    await gs.terminate();
    await clearData();
  });
});

describe('Check paragraph detection with complaint.', function () {
  this.timeout(20000);
  before(async () => {
    await initGeneralScheduler();
    opt.extractText = true;
    await importFilesAll([`${ASSETS_PATH_KARMA}/complaint_1.pdf`]);
    ocrAll.active.forEach((page, index) => {
      const angle = pageMetricsArr[index].angle || 0;
      assignParagraphs(page, angle);
    });
  });

  it('Paragraph detection functions with single-column layout with header and footnotes', async () => {
    // The test document contains a header, 3 body paragraphs, and 3 footnotes.
    assert.strictEqual(ocrAll.active[0].pars.length, 7);
    assert.strictEqual(getLineText(ocrAll.active[0].pars[2].lines[3]), 'partially offset by lower sales volumes of ($0.1 billion).” They further represented:');
    assert.strictEqual(getLineText(ocrAll.active[0].pars[3].lines[0]), 'Nutrition operating profit increased 20%. Human Nutrition results were higher');
  }).timeout(10000);

  it('Paragraph detection creates new paragraph when switching to center alignment', async () => {
    assert.strictEqual(getParText(ocrAll.active[1].pars[2]), 'APPLICABILITY OF PRESUMPTION OF RELIANCE: FRAUD-ON-THE-MARKET DOCTRINE');
  }).timeout(10000);

  after(async () => {
    await gs.terminate();
    await clearData();
  });
});
