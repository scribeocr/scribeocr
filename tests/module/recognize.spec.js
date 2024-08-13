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

describe('Check basic recognition features.', function () {
  this.timeout(20000);
  it('Should recognize basic .png image using single function', async () => {
    const txt = await scribe.recognizeFiles([`${ASSETS_PATH_KARMA}/simple.png`]);
    assert.strictEqual(txt, 'Tesseract.js');
  }).timeout(10000);

  it('Should recognize basic .jpg image using single function', async () => {
    const txt = await scribe.recognizeFiles([`${ASSETS_PATH_KARMA}/simple.jpg`]);
    assert.strictEqual(txt, 'Tesseract.js');
  }).timeout(10000);
});

describe('Check recognition-related features.', function () {
  this.timeout(20000);
  before(async () => {
    await scribe.init({ ocr: true, font: true });
    // For this input image, font optimization significantly improves overlap quality.
    await scribe.importFiles([`${ASSETS_PATH_KARMA}/analyst_report.png`]);
    await scribe.recognize({
      modeAdv: 'legacy',
    });
  });

  it('Font optimization improves overlap quality', async () => {
    if (!scribe.data.debug.evalRaw) throw new Error('DebugData.evalRaw is not defined');
    if (!scribe.data.debug.evalOpt) throw new Error('DebugData.evalOpt is not defined');
    assert.isBelow(scribe.data.debug.evalOpt.sansMetrics.NimbusSans, scribe.data.debug.evalRaw.sansMetrics.NimbusSans);
    assert.isBelow(scribe.data.debug.evalOpt.sansMetrics.NimbusSans, 0.45);
  }).timeout(10000);

  it('Font optimization should be enabled when it improves overlap quality', async () => {
    assert.strictEqual(scribe.opt.enableOpt, true);
  }).timeout(10000);

  after(async () => {
    await scribe.terminate();
  });
});
