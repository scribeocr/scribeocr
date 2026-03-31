// Relative imports are required to run in browser.
/* eslint-disable import/no-relative-packages */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

import { assert, config } from '../../node_modules/chai/chai.js';
import scribe from '../../scribe.js/scribe.js';
import { ScribeViewer } from '../../scribe.js/scribe-ui/viewer.js';
import { ASSETS_PATH_KARMA } from '../constants.js';

config.truncateThreshold = 0;

describe('highlight dimensions: canvas vs HTML overlay', function () {
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

  it('HTML overlay highlight should match canvas highlight dimensions', async function () {
    this.timeout(10000);

    const words = ScribeViewer.getKonvaWords();
    const word = words.find((w) => w.word.text.length > 3);
    assert.isOk(word, 'No suitable word found');

    // Set highlight properties on the word
    word.highlightColor = '#ffe93b';
    word.highlightOpacity = 0.5;

    const layer = word.getLayer();
    const scale = layer.getAbsoluteScale().y;
    const absPos = word.getAbsolutePosition();

    // Canvas highlight dimensions (from sceneFunc)
    const canvasPad = word.height() * 0.2;
    const canvasRect = {
      top: absPos.y - canvasPad * scale,
      left: absPos.x,
      width: word.width() * scale,
      height: (word.height() + canvasPad * 2) * scale,
    };
    canvasRect.bottom = canvasRect.top + canvasRect.height;
    canvasRect.right = canvasRect.left + canvasRect.width;

    // HTML overlay dimensions
    const inputElem = ScribeViewer.KonvaIText.itextToElem(word);
    document.body.appendChild(inputElem);
    const htmlRect = inputElem.getBoundingClientRect();

    // Extract background dimensions from CSS properties
    const bgSizeParts = inputElem.style.backgroundSize.split(' ');
    const bgHeight = parseFloat(bgSizeParts[1]);
    const bgPositionParts = inputElem.style.backgroundPosition.split(' ');
    const bgTopOffset = parseFloat(bgPositionParts[1]);

    // Content-box width (excluding padding)
    const cs = window.getComputedStyle(inputElem);
    const padLeft = parseFloat(cs.paddingLeft) || 0;
    const padRight = parseFloat(cs.paddingRight) || 0;
    const contentWidth = htmlRect.width - padLeft - padRight;

    // Background top in page coordinates = element top + bgTopOffset
    const bgTop = htmlRect.top + bgTopOffset;

    console.log('=== HIGHLIGHT DIMENSION COMPARISON ===');
    console.log(`Word text: "${word.word.text}"`);
    console.log(`Scale: ${scale}`);
    console.log(`Word height(): ${word.height()}, width(): ${word.width()}, fontSize: ${word.fontSize}`);
    console.log(`Canvas: top=${canvasRect.top.toFixed(2)}, height=${canvasRect.height.toFixed(2)}, width=${canvasRect.width.toFixed(2)}`);
    console.log(`BG:     top=${bgTop.toFixed(2)}, height=${bgHeight.toFixed(2)}, width=${contentWidth.toFixed(2)}`);
    console.log(`Delta top: ${(bgTop - canvasRect.top).toFixed(2)}`);
    console.log(`Delta height: ${(bgHeight - canvasRect.height).toFixed(2)}`);
    console.log(`Delta width: ${(contentWidth - canvasRect.width).toFixed(2)}`);

    // Clean up
    inputElem.remove();

    // Assertions with 2px tolerance
    assert.closeTo(bgTop, canvasRect.top, 2, 'top mismatch');
    assert.closeTo(bgHeight, canvasRect.height, 2, 'height mismatch');
    assert.closeTo(contentWidth, canvasRect.width, 2, 'width mismatch');
  });

  after(async () => {
    await scribe.terminate();
  });
});
