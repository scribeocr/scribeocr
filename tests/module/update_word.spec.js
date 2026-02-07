// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

import { assert, config } from '../../node_modules/chai/chai.js';
import scribe from '../../scribe-ui/scribe.js/scribe.js';
import { ScribeViewer } from '../../scribe-ui/viewer.js';
import { ASSETS_PATH_KARMA, BASE_URL_KARMA } from '../constants.js';

config.truncateThreshold = 0;

const SCRIBE_JS_ASSETS = `${BASE_URL_KARMA}/scribe-ui/scribe.js/tests/assets`;

/**
 * Capture rendering-relevant state from a KonvaOcrWord.
 * @param {Object} w - KonvaOcrWord instance
 */
function captureState(w) {
  return {
    x: w.x(),
    y: w.y(),
    yActual: w.yActual,
    width: w.width(),
    height: w.height(),
    scaleX: w.scaleX(),
    fontSize: w.fontSize,
    charArr: w.charArr.slice(),
    advanceArrTotal: w.advanceArrTotal.slice(),
    charSpacing: w.charSpacing,
    leftSideBearing: w.leftSideBearing,
    fontFaceName: w.fontFaceName,
    fontFaceStyle: w.fontFaceStyle,
    fontFaceWeight: w.fontFaceWeight,
    smallCapsMult: w.smallCapsMult,
  };
}

const styleProps = ['sup', 'bold', 'italic', 'smallCaps', 'underline'];

function registerStyleTests() {
  for (const prop of styleProps) {
    it(`toggling '${prop}' produces same state as fresh render`, async function () {
      this.timeout(10000);

      const words = ScribeViewer.getKonvaWords();
      const word = words.find((w) => w.word.text.length > 2);
      assert.isOk(word, 'No suitable word found');

      const wordId = word.word.id;

      // Toggle the style property
      word.word.style[prop] = !word.word.style[prop];

      // Update font info (mirrors modifySelectedWordStyle)
      const fontI = scribe.data.font.getFont(word.word.style, word.word.lang);
      word.fontFaceName = fontI.fontFaceName;
      word.fontFaceStyle = fontI.fontFaceStyle;
      word.fontFaceWeight = fontI.fontFaceWeight;
      word.smallCapsMult = fontI.smallCapsMult;
      word.fontFamilyLookup = fontI.family;

      // Run updateWordCanvas (the update path)
      ScribeViewer.KonvaIText.updateWordCanvas(word);
      const stateAfterUpdate = captureState(word);

      // Re-render the page from scratch (the fresh-creation path)
      await ScribeViewer.displayPage(ScribeViewer.state.cp.n);

      // Find the same word in the freshly created canvas objects
      const freshWord = ScribeViewer.getKonvaWords().find((w) => w.word.id === wordId);
      assert.isOk(freshWord, 'Could not find word after re-render');
      const stateAfterFresh = captureState(freshWord);

      // Compare Konva transform attributes
      assert.closeTo(stateAfterUpdate.x, stateAfterFresh.x, 0.01, `x mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.y, stateAfterFresh.y, 0.01, `y mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.yActual, stateAfterFresh.yActual, 0.01, `yActual mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.width, stateAfterFresh.width, 0.01, `width mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.height, stateAfterFresh.height, 0.01, `height mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.scaleX, stateAfterFresh.scaleX, 0.01, `scaleX mismatch after toggling ${prop}`);

      // Compare rendering properties
      assert.strictEqual(stateAfterUpdate.fontSize, stateAfterFresh.fontSize, `fontSize mismatch after toggling ${prop}`);
      assert.deepEqual(stateAfterUpdate.charArr, stateAfterFresh.charArr, `charArr mismatch after toggling ${prop}`);
      assert.deepEqual(stateAfterUpdate.advanceArrTotal, stateAfterFresh.advanceArrTotal, `advanceArrTotal mismatch after toggling ${prop}`);
      assert.strictEqual(stateAfterUpdate.charSpacing, stateAfterFresh.charSpacing, `charSpacing mismatch after toggling ${prop}`);
      assert.closeTo(stateAfterUpdate.leftSideBearing, stateAfterFresh.leftSideBearing, 0.01, `leftSideBearing mismatch after toggling ${prop}`);
      assert.strictEqual(stateAfterUpdate.fontFaceName, stateAfterFresh.fontFaceName, `fontFaceName mismatch after toggling ${prop}`);
      assert.strictEqual(stateAfterUpdate.fontFaceStyle, stateAfterFresh.fontFaceStyle, `fontFaceStyle mismatch after toggling ${prop}`);
      assert.strictEqual(stateAfterUpdate.fontFaceWeight, stateAfterFresh.fontFaceWeight, `fontFaceWeight mismatch after toggling ${prop}`);
      assert.strictEqual(stateAfterUpdate.smallCapsMult, stateAfterFresh.smallCapsMult, `smallCapsMult mismatch after toggling ${prop}`);
    });
  }
}

describe('updateWordCanvas matches fresh render (visualCoords=true)', function () {
  this.timeout(60000);

  before(async function () {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    await scribe.init({ ocr: true, font: true });
    ScribeViewer.init(container, 800, 600);

    await scribe.importFiles([
      `${ASSETS_PATH_KARMA}/academic_article_2.pdf`,
      `${SCRIBE_JS_ASSETS}/academic_article_2_analyzeDocResponse.json`,
    ]);
    await ScribeViewer.displayPage(0);
  });

  registerStyleTests();

  after(async () => {
    await scribe.terminate();
  });
});

describe('updateWordCanvas matches fresh render (visualCoords=false)', function () {
  this.timeout(60000);

  before(async function () {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    await scribe.init({ ocr: true, font: true });
    ScribeViewer.init(container, 800, 600);

    await scribe.importFiles([`${ASSETS_PATH_KARMA}/academic_article_2.pdf`]);
    await ScribeViewer.displayPage(0);
  });

  registerStyleTests();

  after(async () => {
    await scribe.terminate();
  });
});
