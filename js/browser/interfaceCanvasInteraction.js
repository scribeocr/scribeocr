/* eslint-disable import/no-cycle */
import { Konva } from '../../lib/konva/_FullInternals.js';
import { cp, renderPageQueue } from '../../main.js';
import { layoutAll } from '../containers/miscContainer.js';
import { showHideElem } from '../utils/miscUtils.js';
import { mergeOcrWords, splitOcrWord } from '../utils/ocrUtils.js';
import {
  KonvaOcrWord,
  ScribeCanvas,
  layerBackground, layerOverlay, layerText, stage,
} from './interfaceCanvas.js';
import { addWordManual, recognizeArea } from './interfaceEdit.js';
import {
  KonvaDataColumn,
  KonvaLayout,
  addLayoutBoxClick,
  addLayoutDataTableClick,
  checkDataColumnsAdjacent, checkDataTablesAdjacent, mergeDataColumns, mergeDataTables, selectLayoutBoxesArea, splitDataColumn, splitDataTable,
} from './interfaceLayout.js';

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

  const deleteLayoutButton = document.createElement('button');
  deleteLayoutButton.id = 'contextMenuDeleteLayoutBoxButton';
  deleteLayoutButton.textContent = 'Delete';
  deleteLayoutButton.style.display = 'none';
  deleteLayoutButton.addEventListener('click', deleteLayoutBoxClick);

  const deleteTableButton = document.createElement('button');
  deleteTableButton.id = 'contextMenuDeleteTableButton';
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
  innerDiv.appendChild(deleteLayoutButton);
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
  const { wordA, wordB } = splitOcrWord(konvaWord.word, splitIndex);

  const wordIndex = konvaWord.word.line.words.findIndex((x) => x.id === konvaWord.word.id);

  konvaWord.word.line.words.splice(wordIndex, 1, wordA, wordB);

  renderPageQueue(cp.n);
};

const mergeWordsClick = () => {
  hideContextMenu();

  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length < 2 || !checkWordsAdjacent(selectedWords)) return;
  const newWord = mergeOcrWords(selectedWords.map((x) => x.word));
  const lineWords = selectedWords[0].word.line.words;
  lineWords.sort((a, b) => a.bbox.left - b.bbox.left);
  const firstIndex = lineWords.findIndex((x) => x.id === selectedWords[0].word.id);
  lineWords.splice(firstIndex, selectedWords.length, newWord);

  renderPageQueue(cp.n);
};

const deleteLayoutDataTableClick = () => {
  hideContextMenu();
  const selectedColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();
  if (selectedColumns.length === 0) return;

  selectedColumns[0].konvaTable.delete();
  ScribeCanvas.destroyControls();
  layerOverlay.batchDraw();
};

const deleteLayoutBoxClick = () => {
  hideContextMenu();
  const selectedLayoutBoxes = ScribeCanvas.CanvasSelection.getKonvaLayoutBoxes();
  selectedLayoutBoxes.forEach((obj) => {
    delete layoutAll[cp.n].boxes[obj.layoutBox.id];
    obj.destroy();
  });
  ScribeCanvas.destroyControls();
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
  // const ptr = layerOverlay.getRelativePointerPosition();
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
const contextMenuDeleteLayoutBoxButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteLayoutBoxButton'));
const contextMenuDeleteTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuDeleteTableButton'));
const contextMenuMergeTablesButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuMergeTablesButton'));
const contextMenuSplitTableButtonElem = /** @type {HTMLButtonElement} */(document.getElementById('contextMenuSplitTableButton'));

export const hideContextMenu = () => {
  contextMenuMergeWordsButtonElem.style.display = 'none';
  contextMenuSplitWordButtonElem.style.display = 'none';
  contextMenuMergeColumnsButtonElem.style.display = 'none';
  contextMenuSplitColumnButtonElem.style.display = 'none';
  contextMenuDeleteLayoutBoxButtonElem.style.display = 'none';
  contextMenuDeleteTableButtonElem.style.display = 'none';
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

stage.on('contextmenu', (e) => {
  // prevent default behavior

  const pointer = stage.getPointerPosition();
  const pointerRelative = layerOverlay.getRelativePointerPosition();

  if (!pointer || !pointerRelative) return;

  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  const selectedColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();
  const selectedRegions = ScribeCanvas.CanvasSelection.getKonvaRegions();

  if (e.target === stage || (selectedColumns.length === 0 && selectedRegions.length === 0 && selectedWords.length === 0)) {
    // if we are on empty place of the stage we will do nothing
    return;
  }

  ScribeCanvas.contextMenuPointer = pointerRelative;

  let enableSplitWord = false;
  let enableMergeWords = false;
  if (!globalThis.layoutMode && e.target instanceof KonvaOcrWord) {
    if (selectedWords.length < 2) {
      const cursorIndex = KonvaOcrWord.getCursorIndex(e.target);
      if (cursorIndex > 0 && cursorIndex < e.target.word.text.length) {
        ScribeCanvas.contextMenuWord = e.target;
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
  let enableDelete = false;
  let enableDeleteTable = false;
  let enableSplitTable = false;

  if (selectedTables.length === 1) {
    // The "Merge Columns" button will be enabled if multiple adjacent columns are selected.
    const adjacentColumns = checkDataColumnsAdjacent(selectedColumns);
    if (selectedColumns.length > 1 && adjacentColumns) enableMergeColumns = true;
    if (selectedColumns.length === 1) enableSplit = true;
    if (selectedRegions.length > 0) enableDelete = true;
    if (selectedColumns.length > 0 && adjacentColumns && selectedColumns.length < selectedTables[0].boxes.length) enableSplitTable = true;
    if (selectedColumns.length > 0 && selectedColumns.length === selectedColumns[0].konvaTable.columns.length) enableDeleteTable = true;
  } else if (selectedTables.length > 1 && checkDataTablesAdjacent(selectedTables)) enableMergeTables = true;

  if (!(enableMergeColumns || enableSplit || enableDelete || enableDeleteTable || enableMergeTables || enableSplitTable || enableSplitWord || enableMergeWords)) return;

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
  if (enableDelete) {
    contextMenuDeleteLayoutBoxButtonElem.style.display = 'initial';
  }
  if (enableDeleteTable) {
    contextMenuDeleteTableButtonElem.style.display = 'initial';
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

  e.evt.preventDefault();

  menuNode.style.display = 'initial';
  const containerRect = stage.container().getBoundingClientRect();
  menuNode.style.top = `${containerRect.top + pointer.y + 4}px`;
  menuNode.style.left = `${containerRect.left + pointer.x + 4}px`;
});

const trans = new Konva.Transformer({
  enabledAnchors: ['middle-left', 'middle-right'],
  rotateEnabled: false,
});
layerText.add(trans);

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
    KonvaOcrWord.updateUI();
  }
}

/** @type {import('../../lib/konva/Stage.js').Stage | import('../../lib/konva/Shape.js').Shape<import('../../lib/konva/Shape.js').ShapeConfig>} */
let mouseDownTarget = stage;

stage.on('mousedown touchstart', (e) => {
  hideContextMenu();

  // Left click only
  if (e.evt.button !== 0) return;

  mouseDownTarget = e.target;

  if (ScribeCanvas.isTouchScreen && ScribeCanvas.mode === 'select') return;

  // Move selection rectangle to top.
  ScribeCanvas.selectingRectangle.zIndex(layerText.children.length - 1);

  e.evt.preventDefault();
  const startCoords = layerText.getRelativePointerPosition() || { x: 0, y: 0 };
  ScribeCanvas.bbox.left = startCoords.x;
  ScribeCanvas.bbox.top = startCoords.y;
  ScribeCanvas.bbox.right = startCoords.x;
  ScribeCanvas.bbox.bottom = startCoords.y;

  ScribeCanvas.selectingRectangle.width(0);
  ScribeCanvas.selectingRectangle.height(0);
  ScribeCanvas.selecting = true;
});

stage.on('mousemove touchmove', (e) => {
  // do nothing if we didn't start selection
  if (!ScribeCanvas.selecting) {
    return;
  }
  e.evt.preventDefault();
  const endCoords = layerText.getRelativePointerPosition();
  if (!endCoords) return;

  ScribeCanvas.bbox.right = endCoords.x;
  ScribeCanvas.bbox.bottom = endCoords.y;

  ScribeCanvas.selectingRectangle.setAttrs({
    visible: true,
    x: Math.min(ScribeCanvas.bbox.left, ScribeCanvas.bbox.right),
    y: Math.min(ScribeCanvas.bbox.top, ScribeCanvas.bbox.bottom),
    width: Math.abs(ScribeCanvas.bbox.right - ScribeCanvas.bbox.left),
    height: Math.abs(ScribeCanvas.bbox.bottom - ScribeCanvas.bbox.top),
  });

  layerText.batchDraw();
});

stage.on('mouseup touchend', (event) => {
  // For dragging layout boxes, other events are needed to stop the drag.
  if (!globalThis.layoutMode) {
    event.evt.preventDefault();
    event.evt.stopPropagation();
  }

  const mouseUpTarget = event.target;

  const editingWord = !!ScribeCanvas.input;

  // If a word is being edited, the only action allowed is clicking outside the word to deselect it.
  if (editingWord) {
    if (mouseDownTarget === ScribeCanvas.inputWord || mouseUpTarget === ScribeCanvas.inputWord) {
      ScribeCanvas.selecting = false;
      return;
    }
    ScribeCanvas.destroyControls();
    layerText.batchDraw();

  // Delete any current selections if either (1) this is a new selection or (2) nothing is being clicked.
  // Clicks must pass this check on both start and end.
  // This prevents accidentally clearing a selection when the user is trying to highlight specific letters, but the mouse up happens over another word.
  } else if ((mouseUpTarget instanceof Konva.Stage || mouseUpTarget instanceof Konva.Image)
    && (ScribeCanvas.selecting || event.target instanceof Konva.Stage || event.target instanceof Konva.Image)) {
    ScribeCanvas.destroyControls();
  }

  ScribeCanvas.selecting = false;

  // Return early if this was a drag or pinch rather than a selection.
  // `isDragging` will be true even for a touch event, so a minimum distance moved is required to differentiate between a click and a drag.
  if (event.evt.button === 1 || (ScribeCanvas.drag.isDragging && ScribeCanvas.drag.dragDeltaTotal > 10) || ScribeCanvas.drag.isPinching || ScribeCanvas.drag.isResizingColumns) {
    stopDragPinch(event);
    return;
  }
  // `stopDragPinch` runs regardless of whether this actually is a drag/pinch, since `isDragging` can be enabled for taps.
  stopDragPinch(event);

  // Exit early if the right mouse button was clicked on a selected column or word.
  if (event.evt.button === 2) {
    const selectedColumnIds = ScribeCanvas.CanvasSelection.getKonvaDataColumns().map((x) => x.layoutBox.id);
    const selectedWordIds = ScribeCanvas.CanvasSelection.getKonvaWords().map((x) => x.word.id);

    if (event.target instanceof KonvaDataColumn && selectedColumnIds.includes(event.target.layoutBox.id)) return;
    if (event.target instanceof KonvaOcrWord && selectedWordIds.includes(event.target.word.id)) return;
  }

  // Handle the case where no rectangle is drawn (i.e. a click event), or the rectangle is is extremely small.
  // Clicks are handled in the same function as rectangle selections as using separate events lead to issues when multiple events were triggered.
  if (!ScribeCanvas.selectingRectangle.visible() || (ScribeCanvas.selectingRectangle.width() < 5 && ScribeCanvas.selectingRectangle.height() < 5)) {
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const box = {
      x: ptr.x, y: ptr.y, width: 1, height: 1,
    };
    if (ScribeCanvas.mode === 'select' && !globalThis.layoutMode) {
      ScribeCanvas.destroyControls(!event.evt.ctrlKey);
      selectWords(box);
      KonvaOcrWord.updateUI();
      layerText.batchDraw();
    } else if (ScribeCanvas.mode === 'select' && globalThis.layoutMode) {
      ScribeCanvas.destroyControls(!event.evt.ctrlKey);
      selectLayoutBoxesArea(box);
      KonvaLayout.updateUI();
      layerOverlay.batchDraw();
    }
    return;
  }

  // update visibility in timeout, so we can check it in click event
  ScribeCanvas.selectingRectangle.visible(false);

  if (ScribeCanvas.mode === 'select' && !globalThis.layoutMode) {
    ScribeCanvas.destroyControls(!event.evt.ctrlKey);
    const box = ScribeCanvas.selectingRectangle.getClientRect();
    selectWords(box);
    KonvaOcrWord.updateUI();
  } else if (ScribeCanvas.mode === 'select' && globalThis.layoutMode) {
    ScribeCanvas.destroyControls(!event.evt.ctrlKey);
    const box = ScribeCanvas.selectingRectangle.getClientRect();
    selectLayoutBoxesArea(box);
    KonvaLayout.updateUI();
  } else if (ScribeCanvas.mode === 'addWord') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    addWordManual(box);
  } else if (ScribeCanvas.mode === 'recognizeWord') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, true, false);
  } else if (ScribeCanvas.mode === 'recognizeArea') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, false);
  } else if (ScribeCanvas.mode === 'printCoords') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, true);
  } else if (ScribeCanvas.mode === 'addLayoutBoxOrder') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'order');
  } else if (ScribeCanvas.mode === 'addLayoutBoxExclude') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutBoxClick(box, 'exclude');
  } else if (ScribeCanvas.mode === 'addLayoutBoxDataTable') {
    const box = ScribeCanvas.selectingRectangle.getClientRect({ relativeTo: layerText });
    addLayoutDataTableClick(box);
  }

  ScribeCanvas.mode = 'select';

  layerText.batchDraw();
});

/**
 * Check if the wheel event was from a track pad by applying a series of heuristics.
 * This function should be generally reliable, although it is inherently heuristic-based,
 * so should be refined over time as more edge cases are encountered.
 * @param {WheelEvent} event
 */
const checkTrackPad = (event) => {
  // DeltaY is generally 100 or 120 for mice.
  if ([100, 120].includes(event.deltaY)) return false;
  // DeltaY will be multiplied by the zoom level.
  // While the user should not be zoomed in, this is accounted for here as a safeguard.
  // The `window.devicePixelRatio` value is generally the zoom level.
  // The known exceptions are:
  // For high-density (e.g. Retina) displays, `window.devicePixelRatio` is 2, but the zoom level is 1.
  // For Safari, this is bugged and `window.devicePixelRatio` does not scale with zooming.
  // https://bugs.webkit.org/show_bug.cgi?id=124862
  if ([100, 120].includes(Math.abs(Math.round(event.deltaY * window.devicePixelRatio * 1e5) / 1e5))) return false;

  // If delta is an integer, it is likely from a mouse.
  if (Math.round(event.deltaY) === event.deltaY) return false;

  // If none of the above conditions were met, it is likely from a track pad.
  return true;
};

// Function to handle wheel event
/**
 * Handles the wheel event to scroll the layer vertically.
 * @param {WheelEvent} event - The wheel event from the user's mouse.
 */
const handleWheel = (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.ctrlKey) { // Zoom in or out
    // Track pads report precise zoom values (many digits after the decimal) while mouses only move in fixed (integer) intervals.
    const trackPadMode = checkTrackPad(event);

    let delta = event.deltaY;

    // If `deltaMode` is `1` (less common), units are in lines rather than pixels.
    if (event.deltaMode === 1) delta *= 10;

    // Zoom by a greater amount for track pads.
    // Without this code, zooming would be extremely slow.
    if (trackPadMode) {
      delta *= 7;
      // Cap at the equivalent of ~6 scrolls of a scroll wheel.
      delta = Math.min(600, Math.max(-720, delta));
    }

    let scaleBy = 0.999 ** delta;
    if (scaleBy > 1.1) scaleBy = 1.1;
    if (scaleBy < 0.9) scaleBy = 0.9;

    zoomAllLayers(scaleBy, stage.getPointerPosition());
    ScribeCanvas.destroyControls();
  } else { // Scroll vertically
    ScribeCanvas.destroyControls();
    panAllLayers({ deltaX: event.deltaX * -1, deltaY: event.deltaY * -1 });
  }
};

/**
 *
 * @param {InstanceType<typeof Konva.Layer>} layer
 * @returns {{x: number, y: number}}
 */
export const getLayerCenter = (layer) => {
  const layerWidth = layer.width();
  const layerHeight = layer.height();

  // Calculate the center point of the layer before any transformations
  const centerPoint = {
    x: layerWidth / 2,
    y: layerHeight / 2,
  };

  // Get the absolute transformation matrix for the layer
  const transform = layer.getAbsoluteTransform();

  // Apply the transformation to the center point
  const transformedCenter = transform.point(centerPoint);

  return transformedCenter;
};

/**
 *
 * @param {InstanceType<typeof Konva.Layer>} layer
 * @param {number} scaleBy
 * @param {?{x: number, y: number}} [center=null] - The center point to zoom in/out from.
 *    If `null` (default), the center of the layer is used.
 */
const zoomLayer = (layer, scaleBy, center = null) => {
  const oldScale = layer.scaleX();
  center = center || getLayerCenter(layer);

  const mousePointTo = {
    x: (center.x - layer.x()) / oldScale,
    y: (center.y - layer.y()) / oldScale,
  };

  const newScale = oldScale * scaleBy;

  layer.scaleX(newScale);
  layer.scaleY(newScale);

  const newPos = {
    x: center.x - mousePointTo.x * newScale,
    y: center.y - mousePointTo.y * newScale,
  };

  layer.position(newPos);
  layer.batchDraw();
};

/**
 *
 * @param {number} scaleBy
 * @param {?{x: number, y: number}} [center=null] - The center point to zoom in/out from.
 *    If `null` (default), the center of the layer is used.
 */
export const zoomAllLayers = (scaleBy, center = null) => {
  zoomLayer(layerText, scaleBy, center);
  zoomLayer(layerBackground, scaleBy, center);
  zoomLayer(layerOverlay, scaleBy, center);
};

/**
 *
 * @param {Object} coords
 * @param {number} [coords.deltaX=0]
 * @param {number} [coords.deltaY=0]
 */
const panAllLayers = ({ deltaX = 0, deltaY = 0 }) => {
  layerText.x(layerText.x() + deltaX);
  layerText.y(layerText.y() + deltaY);
  layerBackground.x(layerBackground.x() + deltaX);
  layerBackground.y(layerBackground.y() + deltaY);
  layerOverlay.x(layerOverlay.x() + deltaX);
  layerOverlay.y(layerOverlay.y() + deltaY);

  layerText.batchDraw();
  layerBackground.batchDraw();
  layerOverlay.batchDraw();
};

// Listen for wheel events on the stage
stage.on('wheel', (event) => {
  handleWheel(event.evt);
});

/**
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<MouseEvent>} KonvaMouseEvent
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<TouchEvent>} KonvaTouchEvent
 * @typedef {import('../../lib/konva/Node.js').KonvaEventObject<WheelEvent>} KonvaWheelEvent
 */

/**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {KonvaMouseEvent} event
 */
const startDrag = (event) => {
  ScribeCanvas.drag.isDragging = true;
  ScribeCanvas.drag.lastX = event.evt.x;
  ScribeCanvas.drag.lastY = event.evt.y;
  event.evt.preventDefault();
};

function getCenter(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {KonvaTouchEvent} event
 */
const startDragTouch = (event) => {
  ScribeCanvas.drag.isDragging = true;
  ScribeCanvas.drag.lastX = event.evt.touches[0].clientX;
  ScribeCanvas.drag.lastY = event.evt.touches[0].clientY;
  event.evt.preventDefault();
};

/**
 * Updates the layer's position based on mouse movement.
 * @param {KonvaMouseEvent} event
 */
const executeDrag = (event) => {
  if (ScribeCanvas.drag.isDragging) {
    const deltaX = event.evt.x - ScribeCanvas.drag.lastX;
    const deltaY = event.evt.y - ScribeCanvas.drag.lastY;

    if (Math.round(deltaX) === 0 && Math.round(deltaY) === 0) return;

    // This is an imprecise heuristic, so not bothering to calculate distance properly.
    ScribeCanvas.drag.dragDeltaTotal += Math.abs(deltaX);
    ScribeCanvas.drag.dragDeltaTotal += Math.abs(deltaY);

    ScribeCanvas.drag.lastX = event.evt.x;
    ScribeCanvas.drag.lastY = event.evt.y;

    panAllLayers({ deltaX, deltaY });
  }
};

/**
 * @param {KonvaTouchEvent} event
 */
const executeDragTouch = (event) => {
  if (ScribeCanvas.drag.isDragging) {
    const deltaX = event.evt.touches[0].clientX - ScribeCanvas.drag.lastX;
    const deltaY = event.evt.touches[0].clientY - ScribeCanvas.drag.lastY;
    ScribeCanvas.drag.lastX = event.evt.touches[0].clientX;
    ScribeCanvas.drag.lastY = event.evt.touches[0].clientY;

    panAllLayers({ deltaX, deltaY });
  }
};

/**
 * @param {KonvaTouchEvent} event
 */
const executePinchTouch = (event) => {
  const touch1 = event.evt.touches[0];
  const touch2 = event.evt.touches[1];
  if (!touch1 || !touch2) return;
  ScribeCanvas.drag.isPinching = true;
  const p1 = {
    x: touch1.clientX,
    y: touch1.clientY,
  };
  const p2 = {
    x: touch2.clientX,
    y: touch2.clientY,
  };

  const center = getCenter(p1, p2);
  const dist = getDistance(p1, p2);

  if (!ScribeCanvas.drag.lastDist || !ScribeCanvas.drag.lastCenter) {
    ScribeCanvas.drag.lastCenter = center;
    ScribeCanvas.drag.lastDist = dist;
    return;
  }

  zoomAllLayers(dist / ScribeCanvas.drag.lastDist, center);
  ScribeCanvas.drag.lastDist = dist;
};

/**
 * Stops dragging when the mouse button is released.
 * @param {KonvaMouseEvent|KonvaTouchEvent} event
 */
const stopDragPinch = (event) => {
  ScribeCanvas.drag.isDragging = false;
  ScribeCanvas.drag.isPinching = false;
  ScribeCanvas.drag.dragDeltaTotal = 0;
  ScribeCanvas.drag.lastCenter = null;
  ScribeCanvas.drag.lastDist = null;
};

// Event listeners for mouse interactions
stage.on('mousedown', (event) => {
  if (event.evt.button === 1) { // Middle mouse button
    startDrag(event);
  }
});
stage.on('mousemove', executeDrag);

stage.on('touchstart', (event) => {
  if (ScribeCanvas.mode === 'select') {
    if (event.evt.touches[1]) {
      executePinchTouch(event);
    } else {
      startDragTouch(event);
    }
  }
});

stage.on('touchmove', (event) => {
  if (event.evt.touches[1]) {
    executePinchTouch(event);
  } else if (ScribeCanvas.drag.isDragging) {
    executeDragTouch(event);
  }
});

/**
 * Adjusts the layer's scale based on key press combinations for zooming in and out.
 * @param {KeyboardEvent} event - The key down event.
 */
const handleZoom = (event) => {
  if (event.ctrlKey) {
    if (['+', '='].includes(event.key)) {
      zoomAllLayers(1.1, getLayerCenter(layerText));
    } else if (['-', '_'].includes(event.key)) {
      zoomAllLayers(0.9, getLayerCenter(layerText));
    } else {
      return; // Ignore other keys
    }

    layerText.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
  }
};

document.addEventListener('keydown', handleZoom);

const debugCanvasParentDivElem = /** @type {HTMLDivElement} */ (document.getElementById('debugCanvasParentDiv'));

let widthHeightInitial = true;
/**
 *
 * @param {dims} imgDims - Dimensions of image
 */
export const setCanvasWidthHeightZoom = (imgDims, enableConflictsViewer = false) => {
  const totalHeight = enableConflictsViewer ? Math.round(document.documentElement.clientHeight * 0.7) - 1 : document.documentElement.clientHeight;

  // Re-set width/height, in case the size of the window changed since originally set.
  stage.height(totalHeight);
  stage.width(document.documentElement.clientWidth);

  // The first time this function is run, the canvas is centered and zoomed to fit the image.
  // After that, whatever the user does with the canvas is preserved.
  if (widthHeightInitial) {
    widthHeightInitial = false;
    const interfaceHeight = 100;
    const bottomMarginHeight = 50;
    const targetHeight = totalHeight - interfaceHeight - bottomMarginHeight;

    const zoom = targetHeight / imgDims.height;

    layerText.scaleX(zoom);
    layerText.scaleY(zoom);
    layerBackground.scaleX(zoom);
    layerBackground.scaleY(zoom);
    layerOverlay.scaleX(zoom);
    layerOverlay.scaleY(zoom);

    layerText.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerText.y(interfaceHeight);
    layerBackground.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerBackground.y(interfaceHeight);
    layerOverlay.x(((document.documentElement.clientWidth - (imgDims.width * zoom)) / 2));
    layerOverlay.y(interfaceHeight);
  } else {
    const left = layerText.x();
    const top = layerText.y();
    const scale = layerText.scaleX();
    const stageWidth = stage.width();
    const stageHeight = stage.height();

    // Nudge the document into the viewport, using the lesser of:
    // (1) the shift required to put 50% of the document into view, or
    // (2) the shift required to fill 50% of the viewport.
    // Both conditions are necessary for this to work as expected at all zoom levels.
    if (left < imgDims.width * scale * -0.5
    && left < (stageWidth / 2 - (imgDims.width * scale))) {
      const newX = Math.min(imgDims.width * scale * -0.5, stageWidth / 2 - (imgDims.width * scale));
      layerText.x(newX);
      layerBackground.x(newX);
      layerOverlay.x(newX);
    } else if (left > stageWidth - (imgDims.width * scale * 0.5)
    && left > stageWidth / 2) {
      const newX = Math.max(stageWidth - (imgDims.width * scale * 0.5), stageWidth / 2);
      layerText.x(newX);
      layerBackground.x(newX);
      layerOverlay.x(newX);
    }

    if (top < imgDims.height * scale * -0.5
      && top < (stageHeight / 2 - (imgDims.height * scale))) {
      const newY = Math.min(imgDims.height * scale * -0.5, stageHeight / 2 - (imgDims.height * scale));
      layerText.y(newY);
      layerBackground.y(newY);
      layerOverlay.y(newY);
    } else if (top > stageHeight - (imgDims.height * scale * 0.5)
      && top > stageHeight / 2) {
      const newY = Math.max(stageHeight - (imgDims.height * scale * 0.5), stageHeight / 2);
      layerText.y(newY);
      layerBackground.y(newY);
      layerOverlay.y(newY);
    }
  }

  if (enableConflictsViewer) {
    const debugHeight = Math.round(document.documentElement.clientHeight * 0.3);

    debugCanvasParentDivElem.setAttribute('style', `width:${document.documentElement.clientWidth}px;height:${debugHeight}px;overflow-y:scroll;z-index:10`);
  } else {
    showHideElem(debugCanvasParentDivElem, false);
  }
};
