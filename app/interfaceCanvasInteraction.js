/* eslint-disable import/no-cycle */
import scribe from '../scribe.js/scribe.js';
import {
  optGUI,
  ScribeCanvas,
  stateGUI,
} from '../viewer/viewerCanvas.js';
import {
  addLayoutBoxClick,
  addLayoutDataTableClick,
} from './interfaceLayout.js';
import { Konva } from './lib/konva/_FullInternals.js';
import { elem } from './elems.js';
import {
  checkDataColumnsAdjacent, checkDataTablesAdjacent, KonvaDataColumn, KonvaLayout, mergeDataColumns, mergeDataTables, splitDataColumn, splitDataTable,
} from '../viewer/viewerLayout.js';
import { KonvaOcrWord } from '../viewer/viewerWordObjects.js';

/**
 * Recognize area selected by user in Tesseract.
 * @param {number} n - Page number.
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.left
 * @param {number} box.top
 * @param {boolean} [wordMode=false] - Assume selection is single word.
 *
 * Note: This function assumes OCR data already exists, which this function is adding to.
 * Users should not be allowed to recognize a word/area before OCR data is provided by (1) upload or (2) running "recognize all".
 * Even if recognizing an page for the first time using "recognize area" did not produce an error,
 * it would still be problematic, as running "recognize all" afterwards would overwrite everything.
 */
async function recognizeArea(n, box, wordMode = false) {
  // Return early if the rectangle is too small to be a word.
  if (box.width < 4 || box.height < 4) return;

  const imageCoords = { ...box };

  // As recognizing a single word is fast, it is run in "combined" mode unless a user has explicitly selected "legacy" or "lstm" in the advanced options.
  /** @type {"legacy" | "lstm" | "combined"} */
  let oemMode = 'combined';
  if (elem.info.enableAdvancedRecognition.checked) {
    oemMode = /** @type {"legacy" | "lstm" | "combined"} */(elem.recognize.oemLabelText.innerHTML.toLowerCase());
  }

  const legacy = oemMode === 'legacy' || oemMode === 'combined';
  const lstm = oemMode === 'lstm' || oemMode === 'combined';

  // When a user is manually selecting words to recognize, they are assumed to be in the same block.
  // SINGLE_BLOCK: '6',
  // SINGLE_WORD: '8',
  const psm = wordMode ? '8' : '6';

  const upscale = scribe.inputData.imageMode && scribe.opt.enableUpscale;

  if (upscale) {
    imageCoords.left *= 2;
    imageCoords.top *= 2;
    imageCoords.width *= 2;
    imageCoords.height *= 2;
  }

  // Restrict the rectangle to the page dimensions.
  const pageDims = scribe.data.pageMetrics[n].dims;
  const leftClip = Math.max(0, imageCoords.left);
  const topClip = Math.max(0, imageCoords.top);
  // Tesseract has a bug that subtracting 1 from the width and height (when setting the rectangle to the full image) fixes.
  // See: https://github.com/naptha/tesseract.js/issues/936
  const rightClip = Math.min(pageDims.width - 1, imageCoords.left + imageCoords.width);
  const bottomClip = Math.min(pageDims.height - 1, imageCoords.top + imageCoords.height);
  imageCoords.left = leftClip;
  imageCoords.top = topClip;
  imageCoords.width = rightClip - leftClip;
  imageCoords.height = bottomClip - topClip;
  if (imageCoords.width < 4 || imageCoords.height < 4) return;

  const res0 = await scribe.recognizePage(n, legacy, lstm, true, { rectangle: imageCoords, tessedit_pageseg_mode: psm, upscale });

  let pageNew;
  if (legacy && lstm) {
    const resLegacy = await res0[0];
    const resLSTM = await res0[1];

    const pageObjLSTM = resLSTM.convert.lstm.pageObj;
    const pageObjLegacy = resLegacy.convert.legacy.pageObj;

    const debugLabel = 'recognizeArea';

    if (debugLabel && !scribe.data.debug.debugImg[debugLabel]) {
      scribe.data.debug.debugImg[debugLabel] = new Array(scribe.data.image.pageCount);
      for (let i = 0; i < scribe.data.image.pageCount; i++) {
        scribe.data.debug.debugImg[debugLabel][i] = [];
      }
    }

    /** @type {Parameters<typeof scribe.compareOCR>[2]} */
    const compOptions = {
      mode: 'comb',
      debugLabel,
      ignoreCap: scribe.opt.ignoreCap,
      ignorePunct: scribe.opt.ignorePunct,
      confThreshHigh: scribe.opt.confThreshHigh,
      confThreshMed: scribe.opt.confThreshMed,
      legacyLSTMComb: true,
    };

    const res = await scribe.compareOCR([pageObjLegacy], [pageObjLSTM], compOptions);

    if (scribe.data.debug.debugImg[debugLabel]) scribe.data.debug.debugImg[debugLabel] = res.debug;

    pageNew = res.ocr[0];
  } else if (legacy) {
    const resLegacy = await res0[0];
    pageNew = resLegacy.convert.legacy.pageObj;
  } else {
    const resLSTM = await res0[0];
    pageNew = resLSTM.convert.lstm.pageObj;
  }

  scribe.combineOCRPage(pageNew, scribe.data.ocr.active[n], scribe.data.pageMetrics[n]);

  if (ScribeCanvas.textGroupsRenderIndices.includes(n)) ScribeCanvas.displayPage(stateGUI.cp.n);
}

/**
 *
 * @param {number} n - Page number.
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.left
 * @param {number} box.top
 *
 */
async function addWordManual(n, box) {
  const wordText = 'A';
  // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
  let angleAdjXRect = 0;
  let angleAdjYRect = 0;
  let sinAngle = 0;
  let shiftX = 0;
  let shiftY = 0;
  if (scribe.opt.autoRotate && Math.abs(scribe.data.pageMetrics[n].angle ?? 0) > 0.05) {
    const rotateAngle = scribe.data.pageMetrics[n].angle || 0;

    const pageDims = scribe.data.pageMetrics[n].dims;

    sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
    const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

    shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
    shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

    const baselineY = (box.top + box.height) - (box.height) / 3;

    const angleAdjYInt = (1 - cosAngle) * (baselineY - shiftY) - sinAngle * (box.left - shiftX);
    const angleAdjXInt = sinAngle * ((baselineY - shiftY) - angleAdjYInt * 0.5);

    angleAdjXRect = angleAdjXInt + shiftX;
    angleAdjYRect = angleAdjYInt + shiftY;
  }

  // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
  const rectTopHOCR = box.top - angleAdjYRect;
  const rectBottomHOCR = box.top + box.height - angleAdjYRect;

  const rectLeftHOCR = box.left - angleAdjXRect;
  const rectRightHOCR = box.left + box.width - angleAdjXRect;

  const wordBox = {
    left: rectLeftHOCR, top: rectTopHOCR, right: rectRightHOCR, bottom: rectBottomHOCR,
  };

  const pageObj = new scribe.utils.ocr.OcrPage(n, scribe.data.ocr.active[n].dims);
  // Create a temporary line to hold the word until it gets combined.
  // This should not be used after `combineData` is run as it is not the final line.
  const lineObjTemp = new scribe.utils.ocr.OcrLine(pageObj, wordBox, [0, 0], 10, null);
  pageObj.lines = [lineObjTemp];
  const wordIDNew = scribe.utils.getRandomAlphanum(10);
  const wordObj = new scribe.utils.ocr.OcrWord(lineObjTemp, wordText, wordBox, wordIDNew);
  // Words added by user are assumed to be correct.
  wordObj.conf = 100;
  lineObjTemp.words = [wordObj];

  scribe.combineOCRPage(pageObj, scribe.data.ocr.active[n], scribe.data.pageMetrics[n], true, false);

  // Get line word was added to in main data.
  // This will have different metrics from `lineObj` when the line was combined into an existing line.
  const wordObjNew = scribe.utils.ocr.getPageWord(scribe.data.ocr.active[n], wordIDNew);

  if (!wordObjNew) throw new Error('Failed to add word to page.');

  const angle = scribe.data.pageMetrics[n].angle || 0;
  const imageRotated = Math.abs(angle ?? 0) > 0.05;

  const angleAdjLine = imageRotated ? scribe.utils.ocr.calcLineStartAngleAdj(wordObjNew.line) : { x: 0, y: 0 };
  const angleAdjWord = imageRotated ? scribe.utils.ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

  const linebox = wordObjNew.line.bbox;
  const baseline = wordObjNew.line.baseline;

  const visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;

  const outlineWord = optGUI.outlineWords || scribe.opt.displayMode === 'eval' && wordObj.conf > scribe.opt.confThreshHigh && !wordObj.matchTruth;

  const wordCanvas = new KonvaOcrWord({
    visualLeft: box.left,
    yActual: visualBaseline,
    topBaseline: visualBaseline,
    rotation: 0,
    word: wordObj,
    outline: outlineWord,
    fillBox: false,
    listening: !stateGUI.layoutMode,
  });

  const group = ScribeCanvas.getTextGroup(n);
  group.add(wordCanvas);

  ScribeCanvas.layerText.batchDraw();
}

const createContextMenuHTML = () => {
  const menuDiv = document.createElement('div');
  menuDiv.id = 'menu';

  const innerDiv = document.createElement('div');

  const splitWordButton = document.createElement('button');
  splitWordButton.id = 'contextMenuSplitWordButton';
  splitWordButton.textContent = 'Split Word';
  splitWordButton.style.display = 'none';
  splitWordButton.addEventListener('click', splitWordClick);

  const mergeWordsButton = document.createElement('button');
  mergeWordsButton.id = 'contextMenuMergeWordsButton';
  mergeWordsButton.textContent = 'Merge Words';
  mergeWordsButton.style.display = 'none';
  mergeWordsButton.addEventListener('click', mergeWordsClick);

  const splitColumnButton = document.createElement('button');
  splitColumnButton.id = 'contextMenuSplitColumnButton';
  splitColumnButton.textContent = 'Split Column';
  splitColumnButton.style.display = 'none';
  splitColumnButton.addEventListener('click', splitDataColumnClick);

  const mergeButton = document.createElement('button');
  mergeButton.id = 'contextMenuMergeColumnsButton';
  mergeButton.textContent = 'Merge Columns';
  mergeButton.style.display = 'none';
  mergeButton.addEventListener('click', mergeDataColumnsClick);

  const deleteRegionButton = document.createElement('button');
  deleteRegionButton.id = 'contextMenuDeleteLayoutRegionButton';
  deleteRegionButton.textContent = 'Delete';
  deleteRegionButton.style.display = 'none';
  deleteRegionButton.addEventListener('click', deleteLayoutRegionClick);

  const deleteTableButton = document.createElement('button');
  deleteTableButton.id = 'contextMenuDeleteLayoutTableButton';
  deleteTableButton.textContent = 'Delete Table';
  deleteTableButton.style.display = 'none';
  deleteTableButton.addEventListener('click', deleteLayoutDataTableClick);

  const mergeTablesButton = document.createElement('button');
  mergeTablesButton.id = 'contextMenuMergeTablesButton';
  mergeTablesButton.textContent = 'Merge Tables';
  mergeTablesButton.style.display = 'none';
  mergeTablesButton.addEventListener('click', mergeDataTablesClick);

  const splitTableButton = document.createElement('button');
  splitTableButton.id = 'contextMenuSplitTableButton';
  splitTableButton.textContent = 'New Table from Columns';
  splitTableButton.style.display = 'none';
  splitTableButton.addEventListener('click', splitDataTableClick);

  innerDiv.appendChild(splitWordButton);
  innerDiv.appendChild(mergeWordsButton);
  innerDiv.appendChild(splitColumnButton);
  innerDiv.appendChild(mergeButton);
  innerDiv.appendChild(deleteRegionButton);
  innerDiv.appendChild(deleteTableButton);
  innerDiv.appendChild(mergeTablesButton);
  innerDiv.appendChild(splitTableButton);

  menuDiv.appendChild(innerDiv);

  return menuDiv;
};

/**
 *
 * @param {Array<KonvaOcrWord>} words
 * @returns
 */
const checkWordsAdjacent = (words) => {
  const sortedWords = words.slice().sort((a, b) => a.word.bbox.left - b.word.bbox.left);
  const lineWords = words[0].word.line.words;
  lineWords.sort((a, b) => a.bbox.left - b.bbox.left);

  const firstIndex = lineWords.findIndex((x) => x.id === sortedWords[0].word.id);
  const lastIndex = lineWords.findIndex((x) => x.id === sortedWords[sortedWords.length - 1].word.id);
  return lastIndex - firstIndex === sortedWords.length - 1;
};

const splitWordClick = () => {
  hideContextMenu();

  const konvaWord = ScribeCanvas.contextMenuWord;

  if (!konvaWord) return;

  const splitIndex = KonvaOcrWord.getCursorIndex(konvaWord);
  const { wordA, wordB } = scribe.utils.splitOcrWord(konvaWord.word, splitIndex);

  const wordIndex = konvaWord.word.line.words.findIndex((x) => x.id === konvaWord.word.id);

  konvaWord.word.line.words.splice(wordIndex, 1, wordA, wordB);

  ScribeCanvas.displayPage(stateGUI.cp.n);
};

const mergeWordsClick = () => {
  hideContextMenu();

  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length < 2 || !checkWordsAdjacent(selectedWords)) return;
  const newWord = scribe.utils.mergeOcrWords(selectedWords.map((x) => x.word));
  const lineWords = selectedWords[0].word.line.words;
  selectedWords.sort((a, b) => a.word.bbox.left - b.word.bbox.left);
  lineWords.sort((a, b) => a.bbox.left - b.bbox.left);
  const firstIndex = lineWords.findIndex((x) => x.id === selectedWords[0].word.id);
  lineWords.splice(firstIndex, selectedWords.length, newWord);

  ScribeCanvas.displayPage(stateGUI.cp.n);
};

const deleteLayoutDataTableClick = () => {
  hideContextMenu();
  const selectedColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();
  if (selectedColumns.length === 0) return;

  scribe.data.layoutDataTables.deleteLayoutDataTable(selectedColumns[0].konvaTable.layoutDataTable, stateGUI.cp.n);

  selectedColumns[0].konvaTable.destroy();
  ScribeCanvas.destroyControls();
  ScribeCanvas.layerOverlay.batchDraw();
};

const deleteLayoutRegionClick = () => {
  hideContextMenu();
  const selectedRegions = ScribeCanvas.CanvasSelection.getKonvaRegions();
  if (selectedRegions.length === 0) return;

  selectedRegions.forEach((region) => {
    scribe.data.layoutRegions.deleteLayoutRegion(region.layoutBox, stateGUI.cp.n);
    region.destroy();
  });
  ScribeCanvas.destroyControls();
  ScribeCanvas.layerOverlay.batchDraw();
};

const mergeDataColumnsClick = () => {
  hideContextMenu();
  mergeDataColumns(ScribeCanvas.CanvasSelection.getKonvaDataColumns());
  ScribeCanvas.destroyControls();
};

const mergeDataTablesClick = () => {
  hideContextMenu();
  const dataTableArr = ScribeCanvas.CanvasSelection.getDataTables();
  mergeDataTables(dataTableArr);
  ScribeCanvas.destroyControls();
};

const splitDataColumnClick = () => {
  hideContextMenu();
  // const ptr = ScribeCanvas.layerOverlay.getRelativePointerPosition();
  // if (!ptr) return;
  const selectedColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();
  splitDataColumn(selectedColumns[0], ScribeCanvas.contextMenuPointer.x);
  ScribeCanvas.destroyControls();
};

const splitDataTableClick = () => {
  hideContextMenu();
  splitDataTable(ScribeCanvas.CanvasSelection.getKonvaDataColumns());
  ScribeCanvas.destroyControls();
};

const menuNode = createContextMenuHTML();
document.body.appendChild(menuNode);

const contextMenuSplitWordButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitWordButton'));
const contextMenuMergeWordsButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeWordsButton'));
const contextMenuMergeColumnsButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeColumnsButton'));
const contextMenuSplitColumnButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitColumnButton'));
const contextMenuDeleteLayoutRegionButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteLayoutRegionButton'));
const contextMenuDeleteLayoutTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteLayoutTableButton'));
const contextMenuMergeTablesButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeTablesButton'));
const contextMenuSplitTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitTableButton'));

export const hideContextMenu = () => {
  contextMenuMergeWordsButtonElem.style.display = 'none';
  contextMenuSplitWordButtonElem.style.display = 'none';
  contextMenuMergeColumnsButtonElem.style.display = 'none';
  contextMenuSplitColumnButtonElem.style.display = 'none';
  contextMenuDeleteLayoutRegionButtonElem.style.display = 'none';
  contextMenuDeleteLayoutTableButtonElem.style.display = 'none';
  contextMenuMergeTablesButtonElem.style.display = 'none';
  contextMenuSplitTableButtonElem.style.display = 'none';
  menuNode.style.display = 'none';
};

const style = document.createElement('style');

// Add CSS rules to the style element
style.textContent = `
    #menu {
      display: none;
      position: absolute;
      width: min-content;
      background-color: white;
      box-shadow: 0 0 5px grey;
      border-radius: 3px;
    }
    #menu button {
      width: 100%;
      background-color: white;
      border: none;
      margin: 0;
      padding: 10px;
      text-wrap: nowrap;
      text-align: left;
    }
    #menu button:hover {
      background-color: lightgray;
    }`;

document.head.appendChild(style);

export const contextMenuFunc = (event) => {
  const pointer = ScribeCanvas.stage.getPointerPosition();
  const pointerRelative = ScribeCanvas.layerOverlay.getRelativePointerPosition();

  if (!pointer || !pointerRelative) return;

  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  const selectedColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();
  const selectedRegions = ScribeCanvas.CanvasSelection.getKonvaRegions();

  if (event.target === ScribeCanvas.stage || (selectedColumns.length === 0 && selectedRegions.length === 0 && selectedWords.length === 0)) {
    // if we are on empty place of the ScribeCanvas.stage we will do nothing
    return;
  }

  ScribeCanvas.contextMenuPointer = pointerRelative;

  let enableSplitWord = false;
  let enableMergeWords = false;
  if (!stateGUI.layoutMode && event.target instanceof KonvaOcrWord) {
    if (selectedWords.length < 2) {
      const cursorIndex = KonvaOcrWord.getCursorIndex(event.target);
      if (cursorIndex > 0 && cursorIndex < event.target.word.text.length) {
        ScribeCanvas.contextMenuWord = event.target;
        enableSplitWord = true;
      }
    } else {
      const adjacentWords = checkWordsAdjacent(selectedWords);
      if (adjacentWords) enableMergeWords = true;
    }
  }

  const selectedTables = ScribeCanvas.CanvasSelection.getDataTables();

  let enableMergeTables = false;
  let enableMergeColumns = false;
  let enableSplit = false;
  let enableDeleteRegion = false;
  let enableDeleteTable = false;
  let enableSplitTable = false;

  if (selectedTables.length === 1) {
    // The "Merge Columns" button will be enabled if multiple adjacent columns are selected.
    const adjacentColumns = checkDataColumnsAdjacent(selectedColumns);
    if (selectedColumns.length > 1 && adjacentColumns) enableMergeColumns = true;
    if (selectedColumns.length === 1) enableSplit = true;
    if (selectedRegions.length > 0) enableDeleteRegion = true;
    if (selectedColumns.length > 0 && adjacentColumns && selectedColumns.length < selectedTables[0].boxes.length) enableSplitTable = true;
    if (selectedColumns.length > 0 && selectedColumns.length === selectedColumns[0].konvaTable.columns.length) enableDeleteTable = true;
  } else if (selectedTables.length > 1 && checkDataTablesAdjacent(selectedTables)) {
    enableMergeTables = true;
  } else if (selectedRegions.length > 0) {
    enableDeleteRegion = true;
  }

  if (!(enableMergeColumns || enableSplit || enableDeleteRegion || enableDeleteTable || enableMergeTables || enableSplitTable || enableSplitWord || enableMergeWords)) return;

  if (enableMergeWords) {
    contextMenuMergeWordsButtonElem.style.display = 'initial';
  }
  if (enableSplitWord) {
    contextMenuSplitWordButtonElem.style.display = 'initial';
  }
  if (enableMergeColumns) {
    contextMenuMergeColumnsButtonElem.style.display = 'initial';
  }
  if (enableSplit) {
    contextMenuSplitColumnButtonElem.style.display = 'initial';
  }
  if (enableDeleteRegion) {
    contextMenuDeleteLayoutRegionButtonElem.style.display = 'initial';
  }
  if (enableDeleteTable) {
    contextMenuDeleteLayoutTableButtonElem.style.display = 'initial';
  }
  if (enableMergeTables) {
    contextMenuMergeTablesButtonElem.style.display = 'initial';
  }
  if (enableMergeTables) {
    contextMenuMergeTablesButtonElem.style.display = 'initial';
  }
  if (enableSplitTable) {
    contextMenuSplitTableButtonElem.style.display = 'initial';
  }

  event.evt.preventDefault();

  menuNode.style.display = 'initial';
  const containerRect = ScribeCanvas.stage.container().getBoundingClientRect();
  menuNode.style.top = `${containerRect.top + pointer.y + 4}px`;
  menuNode.style.left = `${containerRect.left + pointer.x + 4}px`;
};

/**
 *
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.x
 * @param {number} box.y
 */
function selectWords(box) {
  const shapes = ScribeCanvas.getKonvaWords();

  const newSelectedWords = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));
  ScribeCanvas.CanvasSelection.addWords(newSelectedWords);

  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();

  if (selectedWords.length > 1) {
    selectedWords.forEach((shape) => (shape.select()));
  } else if (selectedWords.length === 1) {
    KonvaOcrWord.addControls(selectedWords[0]);
    selectedWords[0].select();
    KonvaOcrWord.updateUI();
  }
}

/**
 *
 * @param {Object} box
 * @param {number} box.width
 * @param {number} box.height
 * @param {number} box.x
 * @param {number} box.y
 */
export function selectLayoutBoxesArea(box) {
  // const shapes = ScribeCanvas.getKonvaLayoutBoxes();
  const shapes = [...ScribeCanvas.getKonvaDataColumns(), ...ScribeCanvas.getKonvaRegions()];
  const layoutBoxes = shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect()));

  ScribeCanvas.CanvasSelection.selectLayoutBoxes(layoutBoxes);
}

export const mouseupFunc2 = (event) => {
  hideContextMenu();

  const navBarElem = /** @type {HTMLDivElement} */(document.getElementById('navBar'));
  const activeElem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (activeElem && navBarElem.contains(activeElem)) activeElem.blur();

  ScribeCanvas.stopDragPinch(event);

  // Exit early if the right mouse button was clicked on a selected column or word.
  if (event.evt.button === 2) {
    const selectedColumnIds = ScribeCanvas.CanvasSelection.getKonvaDataColumns().map((x) => x.layoutBox.id);
    const selectedWordIds = ScribeCanvas.CanvasSelection.getKonvaWords().map((x) => x.word.id);

    if (event.target instanceof KonvaDataColumn && selectedColumnIds.includes(event.target.layoutBox.id)) return;
    if (event.target instanceof KonvaOcrWord && selectedWordIds.includes(event.target.word.id)) return;
  }

  // Hide the baseline adjustment range if the user clicks somewhere outside of the currently selected word and outside of the range adjustment box.
  if (activeElem && elem.edit.collapseRangeBaseline.contains(activeElem)) {
    const open = elem.edit.collapseRangeBaselineBS._element.classList.contains('show');
    if (open) elem.edit.collapseRangeBaselineBS.toggle();
  }

  // Handle the case where no rectangle is drawn (i.e. a click event), or the rectangle is is extremely small.
  // Clicks are handled in the same function as rectangle selections as using separate events lead to issues when multiple events were triggered.
  if (!ScribeCanvas.selectingRectangle.visible() || (ScribeCanvas.selectingRectangle.width() < 5 && ScribeCanvas.selectingRectangle.height() < 5)) {
    const ptr = ScribeCanvas.stage.getPointerPosition();
    if (!ptr) return;
    const box = {
      x: ptr.x, y: ptr.y, width: 1, height: 1,
    };
    if (ScribeCanvas.mode === 'select' && !stateGUI.layoutMode) {
      ScribeCanvas.destroyControls(!event.evt.ctrlKey);
      selectWords(box);
      KonvaOcrWord.updateUI();
      ScribeCanvas.layerText.batchDraw();
    } else if (ScribeCanvas.mode === 'select' && stateGUI.layoutMode) {
      ScribeCanvas.destroyControls(!event.evt.ctrlKey);
      selectLayoutBoxesArea(box);
      KonvaLayout.updateUI();
      ScribeCanvas.layerOverlay.batchDraw();
    }
    return;
  }

  // update visibility in timeout, so we can check it in click event
  ScribeCanvas.selectingRectangle.visible(false);

  if (ScribeCanvas.mode === 'select' && !stateGUI.layoutMode) {
    ScribeCanvas.destroyControls(!event.evt.ctrlKey);
    const box = ScribeCanvas.selectingRectangle.getClientRect();
    selectWords(box);
    KonvaOcrWord.updateUI();
  } else if (ScribeCanvas.mode === 'select' && stateGUI.layoutMode) {
    ScribeCanvas.destroyControls(!event.evt.ctrlKey);
    const box = ScribeCanvas.selectingRectangle.getClientRect();
    selectLayoutBoxesArea(box);
    KonvaLayout.updateUI();
  } else if (['addWord', 'recognizeWord', 'recognizeArea', 'printCoords', 'addLayoutBoxOrder', 'addLayoutBoxExclude', 'addLayoutBoxDataTable'].includes(ScribeCanvas.mode)) {
    const { n, box } = ScribeCanvas.calcSelectionImageCoords();

    if (ScribeCanvas.mode === 'addWord') {
      addWordManual(n, box);
    } else if (ScribeCanvas.mode === 'recognizeWord') {
      recognizeArea(n, box, true);
    } else if (ScribeCanvas.mode === 'recognizeArea') {
      recognizeArea(n, box, false);
    } else if (ScribeCanvas.mode === 'printCoords') {
      const debugCoords = {
        left: box.left,
        top: box.top,
        right: box.left + box.width,
        bottom: box.top + box.height,
        topInv: scribe.data.pageMetrics[n].dims.height - box.top,
        bottomInv: scribe.data.pageMetrics[n].dims.height - (box.top + box.height),
      };
      console.log(debugCoords);
    } else if (ScribeCanvas.mode === 'addLayoutBoxOrder') {
      addLayoutBoxClick(n, box, 'order');
    } else if (ScribeCanvas.mode === 'addLayoutBoxExclude') {
      addLayoutBoxClick(n, box, 'exclude');
    } else if (ScribeCanvas.mode === 'addLayoutBoxDataTable') {
      addLayoutDataTableClick(n, box);
    }
  }
};
