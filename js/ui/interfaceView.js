import { renderPageQueue, enableDisableDownloadPDFAlert } from '../../main.js';

const colorModeElem = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));
const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

// const rangeLeftMarginElem = /** @type {HTMLInputElement} */(document.getElementById('rangeLeftMargin'));
// rangeLeftMarginElem.addEventListener('input', () => { adjustMarginRange(rangeLeftMarginElem.value) });
// rangeLeftMarginElem.addEventListener('mouseup', () => { adjustMarginRangeChange(rangeLeftMarginElem.value) });

const displayModeElem = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value); });

// function adjustMarginRange(value) {
//     globalThis.canvas.viewportTransform[4] = (parseInt(value) - 200);
//     globalThis.canvas.renderAll();
// }

// function adjustMarginRangeChange(value) {
//     globalThis.pageMetricsArr[currentPage.n].manAdj = (parseInt(value) - 200);
// }

function displayModeClick(x) {
  if (x == 'eval') {
    renderPageQueue(currentPage.n, true);
  } else {
    selectDisplayMode(displayModeElem.value);
  }
}

/**
 * Change the display mode (e.g. proofread mode vs. ocr mode).
 * Impacts what color the text is printed and whether the background image is displayed.
 *
 * @param { ("invis"|"ebook"|"eval"|"proof")} x
 * @returns
 */
export const selectDisplayMode = function (x) {
  if (inputDataModes.xmlMode[currentPage.n] && inputDataModes.pdfMode && currentPage.renderStatus != 2) { return; }

  let opacityArg; let
    fillArg;
  if (x == 'invis') {
    opacityArg = 0;
    fillArg = 'fill_ebook';
  } else if (x == 'ebook') {
    opacityArg = 1;
    fillArg = 'fill_ebook';
  } else if (x == 'eval') {
    opacityArg = 1;
    fillArg = 'fill_eval';
  } else {
    opacityArg = 1;
    fillArg = 'fill_proof';
  }

  canvas.forEachObject((obj) => {
    // A defined value for obj.get(fillArg) is assumed to indicate that the itext object is an OCR word.
    if (obj.type == 'ITextWord' && obj.get(fillArg)) {
      obj.set('fill', obj.get(fillArg));

      obj.set('opacity', opacityArg);
    }
  });

  // Edit rotation for images that have already been rotated
  if (colorModeElem.value == 'binary' && globalThis.imageAll.binaryRotated[currentPage.n] || colorModeElem.value != 'binary' && globalThis.imageAll.nativeRotated[currentPage.n]) {
    // If rotation is requested,
    if (autoRotateCheckboxElem.checked) {
      currentPage.backgroundOpts.angle = 0;
    } else {
      currentPage.backgroundOpts.angle = globalThis.pageMetricsArr[currentPage.n].angle;
    }
  }

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    canvas.setBackgroundColor('white');
    // canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas));
    canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas), currentPage.backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  }

  enableDisableDownloadPDFAlert();
};
