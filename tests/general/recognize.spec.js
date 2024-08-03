// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */

// import { after, it } from 'mocha';
import { assert, config } from '../../node_modules/chai/chai.js';
// import path from 'path';
import { clearData } from '../../js/clear.js';
import { opt } from '../../js/containers/app.js';
import { DebugData } from '../../js/containers/dataContainer.js';
import { gs } from '../../js/containers/schedulerContainer.js';
import { loadBuiltInFontsRaw } from '../../js/fontContainerMain.js';
import { initGeneralScheduler, initTesseractInWorkers } from '../../js/generalWorkerMain.js';
import { importFilesAll } from '../../js/import/import.js';
import { recognizeAll } from '../../js/recognizeConvert.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0; // Disable truncation for actual/expected values on assertion failure.

// Using arrow functions breaks references to `this`.
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

describe('Check recognition-related features.', function () {
  this.timeout(20000);
  before(async () => {
    await initGeneralScheduler();
    await initTesseractInWorkers({});
    const resReadyFontAllRaw = gs.setFontAllRawReady();
    await loadBuiltInFontsRaw().then(() => resReadyFontAllRaw());
    // For this input image, font optimization significantly improves overlap quality.
    await importFilesAll([`${ASSETS_PATH_KARMA}/analyst_report.png`]);
    await recognizeAll('legacy');
  });

  it('Font optimization improves overlap quality', async () => {
    if (!DebugData.evalRaw) throw new Error('DebugData.evalRaw is not defined');
    if (!DebugData.evalOpt) throw new Error('DebugData.evalOpt is not defined');
    assert.isBelow(DebugData.evalOpt.sansMetrics.NimbusSans, DebugData.evalRaw.sansMetrics.NimbusSans);
    assert.isBelow(DebugData.evalOpt.sansMetrics.NimbusSans, 0.45);
  }).timeout(10000);

  it('Font optimization should be enabled when it improves overlap quality', async () => {
    assert.strictEqual(opt.enableOpt, true);
  }).timeout(10000);

  after(async () => {
    await gs.clear();
    await clearData();
  });
});
