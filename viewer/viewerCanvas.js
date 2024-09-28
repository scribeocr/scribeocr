/* eslint-disable import/no-cycle */
import scribe from '../scribe.js/scribe.js';
import Konva from '../app/lib/konva/index.js';
import { search, updateFindStats } from './viewerSearch.js';
import { KonvaDataColumn, KonvaLayout } from './viewerLayout.js';
import { replaceObjectProperties } from '../app/utils/utils.js';

Konva.autoDrawEnabled = false;
Konva.dragButtons = [0];

export class stateGUI {
  static pageRendering = Promise.resolve(true);

  static renderIt = 0;

  static canvasDimsN = -1;

  /** @type {?Function} */
  static promiseResolve = null;

  static recognizeAllPromise = Promise.resolve();

  static layoutMode = false;

  /** @type {'color'|'gray'|'binary'} */
  static colorMode = 'color';

  static autoRotate = false;

  static cp = {
    n: 0,
    backgroundOpts: { stroke: '#3d3d3d', strokeWidth: 3 },
    renderStatus: 0,
    renderNum: 0,
  };
}

/**
 * This object contains the values of options for the GUI that do not directly map to options in the `scribe` module.
 * This includes both GUI-specific options and options that are implemented through arguments rather than the `opts` object.
 */
export class optGUI {
  static enableRecognition = true;

  static enableXlsxExport = false;

  static downloadFormat = 'pdf';

  static vanillaMode = false;

  static langs = ['eng'];

  /** @type {'conf'|'data'} */
  static combineMode = 'data';

  static extractText = false;

  static smartQuotes = true;

  /**
   * Whether to show the intermediate, internal versions of OCR.
   * This is useful for debugging and testing, but should not be enabled by default.
   */
  static showInternalOCRVersions = false;

  static outlineWords = false;

  static outlineLines = false;

  static outlinePars = false;
}

// layerText.add(selectingRectangle);

/**
 * Class for managing the selection of words, layout boxes, and data columns on the canvas.
 * This is a class due to JSDoc type considerations. All methods and properties are static.
 */
class CanvasSelection {
  /** @type {Array<KonvaOcrWord>} */
  static _selectedWordArr = [];

  /** @type {?KonvaOcrWord} */
  static selectedWordFirst = null;

  /** @type {Array<KonvaLayout>} */
  static _selectedRegionArr = [];

  /** @type {Array<KonvaDataColumn>} */
  static _selectedDataColumnArr = [];

  static getKonvaWords = () => CanvasSelection._selectedWordArr;

  static getKonvaRegions = () => CanvasSelection._selectedRegionArr;

  static getKonvaDataColumns = () => CanvasSelection._selectedDataColumnArr;

  static getKonvaWordsCopy = () => CanvasSelection._selectedWordArr.slice();

  static getKonvaRegionsCopy = () => CanvasSelection._selectedRegionArr.slice();

  static getKonvaDataColumnsCopy = () => CanvasSelection._selectedDataColumnArr.slice();

  static getKonvaLayoutBoxes = () => [...CanvasSelection._selectedRegionArr, ...CanvasSelection._selectedDataColumnArr];

  /**
   * Gets the distinct data tables associated with the selected data columuns.
   * @returns {Array<import('./viewerLayout.js').KonvaDataTable>}
   */
  static getKonvaDataTables = () => {
    const selectedDataTableIdArr = [...new Set(CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.table.id))];
    // eslint-disable-next-line no-use-before-define
    return ScribeCanvas._layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
      const boxA = scribe.utils.calcTableBbox(a.layoutDataTable);
      const boxB = scribe.utils.calcTableBbox(b.layoutDataTable);
      return boxA.left - boxB.left;
    });
  };

  /**
   * Gets the distinct data tables associated with the selected data columuns.
   */
  static getDataTables = () => {
    const selectedDataTableIdArr = [...new Set(CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.table.id))];
    // eslint-disable-next-line no-use-before-define
    return ScribeCanvas._layoutDataTableArr.filter((x) => selectedDataTableIdArr.includes(x.layoutDataTable.id)).sort((a, b) => {
      const boxA = scribe.utils.calcTableBbox(a.layoutDataTable);
      const boxB = scribe.utils.calcTableBbox(b.layoutDataTable);
      return boxA.left - boxB.left;
    }).map((x) => x.layoutDataTable);
  };

  /**
   * Add word or array of words to the current selection.
   * Ignores words that are already selected.
   * @param {KonvaOcrWord|Array<KonvaOcrWord>} words
   */
  static addWords = (words) => {
    if (!Array.isArray(words)) words = [words];
    for (let i = 0; i < words.length; i++) {
      const wordI = words[i];
      if (i === 0 && CanvasSelection._selectedWordArr.length === 0) CanvasSelection.selectedWordFirst = wordI;
      if (!CanvasSelection._selectedWordArr.map((x) => x.word.id).includes(wordI.word.id)) {
        CanvasSelection._selectedWordArr.push(wordI);
      }
      // if (i === words.length - 1) CanvasSelection.selectedWordLast = wordI;
    }
  };

  /**
   * Add layout boxes, including both regions and data columns, to the current selection.
   * Ignores boxes that are already selected.
   * @param {Array<import('./viewerLayout.js').KonvaLayout>|import('./viewerLayout.js').KonvaLayout|
   * Array<import('./viewerLayout.js').KonvaLayout>|import('./viewerLayout.js').KonvaLayout} konvaLayoutBoxes
   */
  static addKonvaLayoutBoxes = (konvaLayoutBoxes) => {
    if (!Array.isArray(konvaLayoutBoxes)) konvaLayoutBoxes = [konvaLayoutBoxes];
    konvaLayoutBoxes.forEach((konvaLayoutBox) => {
      if (konvaLayoutBox instanceof KonvaDataColumn) {
        if (!CanvasSelection._selectedDataColumnArr.map((x) => x.layoutBox.id).includes(konvaLayoutBox.layoutBox.id)) {
          CanvasSelection._selectedDataColumnArr.push(konvaLayoutBox);
        }
      } else if (!CanvasSelection._selectedRegionArr.map((x) => x.layoutBox.id).includes(konvaLayoutBox.layoutBox.id)) {
        CanvasSelection._selectedRegionArr.push(konvaLayoutBox);
      }
    });
    // Other code assumes that these arrays are sorted left to right.
    CanvasSelection._selectedDataColumnArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
    CanvasSelection._selectedRegionArr.sort((a, b) => a.layoutBox.coords.left - b.layoutBox.coords.left);
  };

  /**
 *
 * @param {Array<string>} layoutBoxIdArr
 */
  static selectLayoutBoxesById = (layoutBoxIdArr) => {
    // eslint-disable-next-line no-use-before-define
    const konvaLayoutBoxes = ScribeCanvas._layoutRegionArr.filter((x) => layoutBoxIdArr.includes(x.layoutBox.id));

    // eslint-disable-next-line no-use-before-define
    ScribeCanvas._layoutDataTableArr.forEach((table) => {
      table.columns.forEach((column) => {
        if (layoutBoxIdArr.includes(column.layoutBox.id)) konvaLayoutBoxes.push(column);
      });
    });

    CanvasSelection.selectLayoutBoxes(konvaLayoutBoxes);
  };

  /**
   *
   * @param {Array<KonvaLayout>} konvaLayoutBoxes
   */
  static selectLayoutBoxes = (konvaLayoutBoxes) => {
    // eslint-disable-next-line no-use-before-define
    const selectedLayoutBoxes = ScribeCanvas.CanvasSelection.getKonvaRegions();
    // eslint-disable-next-line no-use-before-define
    const selectedDataColumns = ScribeCanvas.CanvasSelection.getKonvaDataColumns();

    // eslint-disable-next-line no-use-before-define
    ScribeCanvas.CanvasSelection.addKonvaLayoutBoxes(konvaLayoutBoxes);

    // Boxes can only be resized one at a time
    if (konvaLayoutBoxes.length === 1) KonvaLayout.addControls(konvaLayoutBoxes[0]);

    selectedDataColumns.forEach((shape) => (shape.select()));
    selectedLayoutBoxes.forEach((shape) => (shape.select()));
  };

  /**
   * Get arrays of distinct font families and font sizes from the selected words.
   */
  static getWordProperties = () => {
    const fontFamilyArr = Array.from(new Set(CanvasSelection._selectedWordArr.map((x) => (x.fontFamilyLookup))));
    const fontSizeArr = Array.from(new Set(CanvasSelection._selectedWordArr.map((x) => (x.fontSize))));
    return { fontFamilyArr, fontSizeArr };
  };

  /**
   * Get arrays of distinct layout box properties from the selected layout boxes.
   * Includes both layout boxes and data columns.
   */
  static getLayoutBoxProperties = () => {
    const selectedWordsAll = CanvasSelection.getKonvaLayoutBoxes();
    const inclusionRuleArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionRule))));
    const inclusionLevelArr = Array.from(new Set(selectedWordsAll.map((x) => (x.layoutBox.inclusionLevel))));
    return { inclusionRuleArr, inclusionLevelArr };
  };

  static deselectAllWords = () => {
    CanvasSelection._selectedWordArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedWordArr.length = 0;
    CanvasSelection.selectedWordFirst = null;
  };

  static deselectAllRegions = () => {
    CanvasSelection._selectedRegionArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedRegionArr.length = 0;
  };

  static deselectAllDataColumns = () => {
    CanvasSelection._selectedDataColumnArr.forEach((shape) => (shape.deselect()));
    CanvasSelection._selectedDataColumnArr.length = 0;
  };

  static deselectAll = () => {
    CanvasSelection.deselectAllWords();
    CanvasSelection.deselectAllRegions();
    CanvasSelection.deselectAllDataColumns();
  };

  /**
   *
   * @param {string|Array<string>} ids
   */
  static deselectDataColumnsByIds = (ids) => {
    if (!Array.isArray(ids)) ids = [ids];
    for (let j = 0; j < CanvasSelection._selectedDataColumnArr.length; j++) {
      if (ids.includes(CanvasSelection._selectedDataColumnArr[j].layoutBox.id)) {
        CanvasSelection._selectedDataColumnArr.splice(j, 1);
        j--;
      }
    }
  };
}

function getCenter(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

let mouseDownTarget;

/**
 * @typedef {import('../app/lib/konva/Node.js').KonvaEventObject<MouseEvent>} KonvaMouseEvent
 * @typedef {import('../app/lib/konva/Node.js').KonvaEventObject<TouchEvent>} KonvaTouchEvent
 * @typedef {import('../app/lib/konva/Node.js').KonvaEventObject<WheelEvent>} KonvaWheelEvent
 */

/**
 * Class for managing the selection of words, layout boxes, and data columns on the canvas.
 * Only one canvas should be used at a time, as most properties are static.
 */
export class ScribeCanvas {
  /** @type {HTMLElement} */
  static elem;

  /**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {KonvaMouseEvent} event
 */
  static startDrag = (event) => {
    ScribeCanvas.drag.isDragging = true;
    ScribeCanvas.drag.lastX = event.evt.x;
    ScribeCanvas.drag.lastY = event.evt.y;
    event.evt.preventDefault();
  };

  /**
   * Initiates dragging if the middle mouse button is pressed.
   * @param {KonvaTouchEvent} event
   */
  static startDragTouch = (event) => {
    ScribeCanvas.drag.isDragging = true;
    ScribeCanvas.drag.lastX = event.evt.touches[0].clientX;
    ScribeCanvas.drag.lastY = event.evt.touches[0].clientY;
    event.evt.preventDefault();
  };

  /**
 * Updates the layer's position based on mouse movement.
 * @param {KonvaMouseEvent} event
 */
  static executeDrag = (event) => {
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
  static executeDragTouch = (event) => {
    if (ScribeCanvas.drag.isDragging) {
      const deltaX = event.evt.touches[0].clientX - ScribeCanvas.drag.lastX;
      const deltaY = event.evt.touches[0].clientY - ScribeCanvas.drag.lastY;
      ScribeCanvas.drag.lastX = event.evt.touches[0].clientX;
      ScribeCanvas.drag.lastY = event.evt.touches[0].clientY;

      panAllLayers({ deltaX, deltaY });
    }
  };

  /**
   * Stops dragging when the mouse button is released.
   * @param {KonvaMouseEvent|KonvaTouchEvent} event
   */
  static stopDragPinch = (event) => {
    ScribeCanvas.drag.isDragging = false;
    ScribeCanvas.drag.isPinching = false;
    ScribeCanvas.drag.dragDeltaTotal = 0;
    ScribeCanvas.drag.lastCenter = null;
    ScribeCanvas.drag.lastDist = null;
  };

  /**
   * @param {KonvaTouchEvent} event
   */
  static executePinchTouch = (event) => {
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

  static mouseupFunc2 = (event) => {};

  /**
   *
   * @param {HTMLDivElement} elem
   * @param {number} width
   * @param {number} height
   */
  static init(elem, width, height) {
    this.elem = elem;

    ScribeCanvas.stage = new Konva.Stage({
      container: elem,
      // width: document.documentElement.clientWidth,
      // height: document.documentElement.clientHeight,
      // width: this.elem.scrollWidth,
      // height: this.elem.scrollHeight,
      width,
      height,

    });

    ScribeCanvas.layerBackground = new Konva.Layer();
    ScribeCanvas.layerText = new Konva.Layer();
    ScribeCanvas.layerOverlay = new Konva.Layer();

    ScribeCanvas.stage.add(ScribeCanvas.layerBackground);
    ScribeCanvas.stage.add(ScribeCanvas.layerText);
    ScribeCanvas.stage.add(ScribeCanvas.layerOverlay);

    ScribeCanvas.selectingRectangle = new Konva.Rect({
      fill: 'rgba(40,123,181,0.5)',
      visible: true,
      // disable events to not interrupt with events
      listening: false,
    });

    ScribeCanvas.layerText.add(ScribeCanvas.selectingRectangle);

    // Listen for wheel events on the ScribeCanvas.stage
    ScribeCanvas.stage.on('wheel', (event) => {
      handleWheel(event.evt);
    });

    // Event listeners for mouse interactions
    ScribeCanvas.stage.on('mousedown', (event) => {
      if (event.evt.button === 1) { // Middle mouse button
        ScribeCanvas.startDrag(event);
      }
    });
    ScribeCanvas.stage.on('mousemove', ScribeCanvas.executeDrag);

    ScribeCanvas.stage.on('touchstart', (event) => {
      if (ScribeCanvas.mode === 'select') {
        if (event.evt.touches[1]) {
          ScribeCanvas.executePinchTouch(event);
        } else {
          ScribeCanvas.startDragTouch(event);
        }
      }
    });

    ScribeCanvas.stage.on('touchmove', (event) => {
      if (event.evt.touches[1]) {
        ScribeCanvas.executePinchTouch(event);
      } else if (ScribeCanvas.drag.isDragging) {
        ScribeCanvas.executeDragTouch(event);
      }
    });

    ScribeCanvas.stage.on('mousedown touchstart', (event) => {
      // Left click only
      if (event.type === 'mousedown' && event.evt.button !== 0) return;

      mouseDownTarget = event.target;

      if (ScribeCanvas.isTouchScreen && ScribeCanvas.mode === 'select') return;

      // Move selection rectangle to top.
      ScribeCanvas.selectingRectangle.zIndex(ScribeCanvas.layerText.children.length - 1);

      event.evt.preventDefault();
      const startCoords = ScribeCanvas.layerText.getRelativePointerPosition() || { x: 0, y: 0 };
      ScribeCanvas.bbox.left = startCoords.x;
      ScribeCanvas.bbox.top = startCoords.y;
      ScribeCanvas.bbox.right = startCoords.x;
      ScribeCanvas.bbox.bottom = startCoords.y;

      ScribeCanvas.selectingRectangle.width(0);
      ScribeCanvas.selectingRectangle.height(0);
      ScribeCanvas.selecting = true;
    });

    ScribeCanvas.stage.on('mousemove touchmove', (e) => {
      // do nothing if we didn't start selection
      if (!ScribeCanvas.selecting) {
        return;
      }
      e.evt.preventDefault();
      const endCoords = ScribeCanvas.layerText.getRelativePointerPosition();
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

      ScribeCanvas.layerText.batchDraw();
    });

    ScribeCanvas.stage.on('mouseup touchend', (event) => {
      // const navBarElem = /** @type {HTMLDivElement} */(document.getElementById('navBar'));
      // const activeElem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // if (activeElem && navBarElem.contains(activeElem)) activeElem.blur();

      // For dragging layout boxes, other events are needed to stop the drag.
      if (!stateGUI.layoutMode) {
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
        ScribeCanvas.layerText.batchDraw();

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
        ScribeCanvas.stopDragPinch(event);
        return;
      }

      ScribeCanvas.mouseupFunc2(event);

      ScribeCanvas.mode = 'select';

      ScribeCanvas.layerText.batchDraw();
    });
  }

  static working = false;

  /**
  * Render page `n` in the UI.
  * @param {number} n
  * @param {boolean} [force=false] - Render even if another page is actively being rendered.
  * @returns
  */
  static async displayPage(n, force = false) {
    // ScribeCanvas.working = true;

    if (scribe.inputData.xmlMode[stateGUI.cp.n]) {
      // TODO: This is currently run whenever the page is changed.
      // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
      updateFindStats();
    }

    stateGUI.cp.n = n;
    await renderPageQueue(stateGUI.cp.n);

    // Render background images ahead and behind current page to reduce delay when switching pages
    if (scribe.inputData.pdfMode || scribe.inputData.imageMode) scribe.data.image.preRenderAheadBehindBrowser(n, stateGUI.colorMode === 'binary');

    // ScribeCanvas.working = false;
  }

  /** @type {InstanceType<typeof Konva.Stage>} */
  static stage;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerBackground;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerText;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerOverlay;

  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  static _controlArr = [];

  /** @type {Array<KonvaOcrWord>} */
  static _wordArr = [];

  /**
   * Contains `Rect` objects used to outline lines and paragraphs, as well as `Text` objects used to label those boxes.
   * @type {Array<InstanceType<typeof Konva.Rect>|InstanceType<typeof Konva.Text>>}
   */
  static _lineOutlineArr = [];

  /** @type {Array<KonvaLayout>} */
  static _layoutRegionArr = [];

  /** @type {Array<import('./viewerLayout.js').KonvaDataTable>} */
  static _layoutDataTableArr = [];

  /** @type {?HTMLSpanElement} */
  static input = null;

  /** @type {?KonvaIText} */
  static inputWord = null;

  /** @type {?Function} */
  static inputRemove = null;

  static selectingRectangle;

  /** @type {?KonvaOcrWord} */
  static contextMenuWord = null;

  /**
   * Contains the x and y coordinates of the last right-click event.
   * This is required for "right click" functions that are position-dependent,
   * as the cursor moves between the initial right click and selecting the option.
   */
  static contextMenuPointer = { x: 0, y: 0 };

  static selecting = false;

  static CanvasSelection = CanvasSelection;

  /** @type {bbox} */
  static bbox = {
    top: 0, left: 0, right: 0, bottom: 0,
  };

  /** @type {('select'|'addWord'|'recognizeWord'|'recognizeArea'|'printCoords'|'addLayoutBoxOrder'|'addLayoutBoxExclude'|'addLayoutBoxDataTable')} */
  static mode = 'select';

  static isTouchScreen = navigator?.maxTouchPoints > 0;

  static drag = {
    isPinching: false,
    isDragging: false,
    isResizingColumns: false,
    dragDeltaTotal: 0,
    lastX: 0,
    lastY: 0,
    /** @type {?{x: number, y: number}} */
    lastCenter: null,
    /** @type {?number} */
    lastDist: null,
  };

  static getKonvaWords = () => ScribeCanvas._wordArr;

  static getKonvaRegions = () => ScribeCanvas._layoutRegionArr;

  static getKonvaDataTables = () => ScribeCanvas._layoutDataTableArr;

  /**
   * Get all layout boxes, including both regions and data columns.
   * Returns copy.
   */
  static getKonvaLayoutBoxes = () => {
    const layoutBoxes = ScribeCanvas._layoutRegionArr.slice();
    ScribeCanvas._layoutDataTableArr.forEach((x) => {
      layoutBoxes.push(...x.columns);
    });
    return layoutBoxes;
  };

  /**
   *
   * @param {KonvaOcrWord} word
   */
  static addWord = (word) => {
    ScribeCanvas._wordArr.push(word);
    ScribeCanvas.layerText.add(word);
  };

  /**
   *
   * @param {KonvaOcrWord} word
   */
  static destroyWord = (word) => {
    word.destroy();
    ScribeCanvas._wordArr = ScribeCanvas._wordArr.filter((x) => x !== word);
  };

  /**
   *
   * @param {import('./viewerLayout.js').KonvaDataTable} dataTable
   */
  static destroyDataTable = (dataTable) => {
    dataTable.destroy();
    ScribeCanvas._layoutDataTableArr = ScribeCanvas._layoutDataTableArr.filter((x) => x.layoutDataTable.id !== dataTable.layoutDataTable.id);
  };

  /**
   *
   * @param {import('./viewerLayout.js').KonvaLayout} region
   */
  static addRegion = (region) => {
    ScribeCanvas._layoutRegionArr.push(region);
    ScribeCanvas.layerOverlay.add(region);
    if (region.label) ScribeCanvas.layerOverlay.add(region.label);
  };

  /**
   *
   * @param {import('./viewerLayout.js').KonvaLayout} region
   */
  static destroyRegion = (region) => {
    region.destroy();
    ScribeCanvas._layoutRegionArr = ScribeCanvas._layoutRegionArr.filter((x) => x.layoutBox.id !== region.layoutBox.id);
  };

  /**
   *
   * @param {boolean} [deselect=true] - Deselect all words, layout boxes, and data columns.
   */
  static destroyControls = (deselect = true) => {
    // elem.edit.collapseRangeBaselineBS.hide();
    ScribeCanvas._controlArr.forEach((control) => control.destroy());
    ScribeCanvas._controlArr.length = 0;

    if (deselect) ScribeCanvas.CanvasSelection.deselectAll();

    if (ScribeCanvas.inputRemove) ScribeCanvas.inputRemove();
  };

  static destroyLineOutlines = () => {
    ScribeCanvas._lineOutlineArr.forEach((x) => x.destroy());
    ScribeCanvas._lineOutlineArr.length = 0;
  };

  static destroyLayoutDataTables = () => {
    ScribeCanvas._layoutDataTableArr.forEach((x) => x.destroy());
    ScribeCanvas._layoutDataTableArr.length = 0;
    ScribeCanvas.CanvasSelection.deselectAllDataColumns();
  };

  static destroyRegions = () => {
    ScribeCanvas._layoutRegionArr.forEach((x) => x.destroy());
    ScribeCanvas._layoutRegionArr.length = 0;
    ScribeCanvas.destroyLayoutDataTables();
    ScribeCanvas.CanvasSelection.deselectAllRegions();
  };

  static destroyWords = () => {
    // Any time words are destroyed, controls must be destroyed as well.
    // If this does not happen controls will have references to destroyed words, which causes errors to be thrown.
    ScribeCanvas.destroyControls();
    ScribeCanvas._wordArr.forEach((obj) => obj.destroy());
    ScribeCanvas.destroyLineOutlines();
    ScribeCanvas._wordArr.length = 0;
  };
}

/**
 *
 * @param {number} degrees
 */
export const rotateAllLayers = (degrees) => {
  ScribeCanvas.layerText.rotation(degrees);
  ScribeCanvas.layerBackground.rotation(degrees);
  ScribeCanvas.layerOverlay.rotation(degrees);

  ScribeCanvas.layerText.batchDraw();
  ScribeCanvas.layerBackground.batchDraw();
  ScribeCanvas.layerOverlay.batchDraw();
};

/**
 * Update word textbox on canvas following changes.
 * Whenever a user edits a word in any way (including content and font/style),
 * the position and character spacing need to be re-calculated so they still overlay with the background image.
 * @param {KonvaIText} wordI
 */
export async function updateWordCanvas(wordI) {
  // Re-calculate left position given potentially new left bearing
  const {
    advanceArr, fontSize, kerningArr, charSpacing, charArr, leftSideBearing, rightSideBearing,
  } = scribe.utils.calcWordMetrics(wordI.word);

  wordI.charArr = charArr;

  const charSpacingFinal = !wordI.dynamicWidth ? charSpacing : 0;

  const advanceArrTotal = [];
  for (let i = 0; i < advanceArr.length; i++) {
    let leftI = 0;
    leftI += advanceArr[i] || 0;
    leftI += kerningArr[i] || 0;
    leftI += charSpacingFinal || 0;
    advanceArrTotal.push(leftI);
  }

  wordI.advanceArrTotal = advanceArrTotal;

  wordI.charSpacing = charSpacingFinal;

  wordI.leftSideBearing = leftSideBearing;

  let width = wordI.dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : wordI.word.bbox.right - wordI.word.bbox.left;

  // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
  if (!wordI.dynamicWidth && !wordI.word.visualCoords) width -= (leftSideBearing + rightSideBearing);

  wordI.width(width);

  wordI.scaleX(1);

  wordI.fontSize = fontSize;
  wordI.height(fontSize * 0.6);
  wordI.show();

  // Test `wordI.parent` to avoid race condition where `wordI` is destroyed before this function completes.
  if (wordI.parent) wordI.draw();
}

export class KonvaIText extends Konva.Shape {
  /**
   * The `KonvaIText` class is a Konva shape that displays text, which is interactive and can be edited.
   * While it uses an `OcrWord` object for input information, it is not directly tied to OCR, and can be used for any text with a dummy `OcrWord`.
   * Any logic specific to OCR should be handled in the `OcrWord` object.
   * @param {Object} options
   * @param {number} options.x
   * @param {number} options.yActual
   * @param {InstanceType<typeof scribe.utils.ocr.OcrWord>} options.word
   * @param {number} [options.rotation=0]
   * @param {boolean} [options.outline=false]
   * @param {boolean} [options.selected=false]
   * @param {boolean} [options.fillBox=false]
   * @param {number} [options.opacity=1]
   * @param {string} [options.fill='black']
   * @param {boolean} [options.dynamicWidth=false] - If `true`, the width of the text box will be calculated dynamically based on the text content, rather than using the bounding box.
   *    This is used for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
   * @param {Function} options.editTextCallback
   */
  constructor({
    x, yActual, word, rotation = 0,
    outline = false, selected = false, fillBox = false, opacity = 1, fill = 'black', dynamicWidth = false, editTextCallback,
  }) {
    const {
      charSpacing, leftSideBearing, rightSideBearing, fontSize, charArr, advanceArr, kerningArr, font,
    } = scribe.utils.calcWordMetrics(word);

    const charSpacingFinal = !dynamicWidth ? charSpacing : 0;

    // const scaleX = word.dropcap ? ((word.bbox.right - word.bbox.left) / visualWidth) : 1;

    const advanceArrTotal = [];
    for (let i = 0; i < advanceArr.length; i++) {
      let leftI = 0;
      leftI += advanceArr[i] || 0;
      leftI += kerningArr[i] || 0;
      leftI += charSpacingFinal || 0;
      advanceArrTotal.push(leftI);
    }

    // The `dynamicWidth` option is useful for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
    // Setting to `true` for OCR text results in no change for most words, however can cause fringe issues with some words.
    // For example, in some cases Tesseract will misidentify a single character as a multi-character word.
    // In this case, the total advance may be negative, making this method of calculating the width incorrect.
    let width = dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : word.bbox.right - word.bbox.left;

    // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
    if (!dynamicWidth && !word.visualCoords) {
      width -= (leftSideBearing + rightSideBearing);
      width = Math.max(width, 7);
    }

    let y = yActual - fontSize * 0.6;
    if (!word.visualCoords && (word.sup || word.dropcap)) {
      const fontDesc = font.opentype.descender / font.opentype.unitsPerEm * fontSize;
      y = yActual - fontSize * 0.6 + fontDesc;
    }

    super({
      x,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      y,
      width,
      height: fontSize * 0.6,
      rotation,
      opacity,
      fill,
      /**
       * @param {InstanceType<typeof Konva.Context>} context
       * @param {KonvaIText} shape
       */
      // @ts-ignore
      sceneFunc: (context, shape) => {
        context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
        context.textBaseline = 'alphabetic';
        context.fillStyle = shape.fill();
        context.lineWidth = 1;

        if (!shape.word.visualCoords && (shape.word.sup || shape.word.dropcap)) {
          const fontI = scribe.data.font.getWordFont(shape.word);
          const fontDesc = fontI.opentype.descender / fontI.opentype.unitsPerEm * shape.fontSize;
          shape.setAttr('y', shape.yActual - shape.fontSize * 0.6 + fontDesc);
        } else {
          shape.setAttr('y', shape.yActual - shape.fontSize * 0.6);
        }

        let leftI = shape.word.visualCoords ? 0 - this.leftSideBearing : 0;
        for (let i = 0; i < shape.charArr.length; i++) {
          let charI = shape.charArr[i];

          if (shape.word.smallCaps) {
            if (charI === charI.toUpperCase()) {
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
            } else {
              charI = charI.toUpperCase();
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize * shape.smallCapsMult}px ${shape.fontFaceName}`;
            }
          }

          context.fillText(charI, leftI, shape.fontSize * 0.6);

          leftI += shape.advanceArrTotal[i];
        }

        if (shape.outline) {
          context.strokeStyle = 'black';
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.selected) {
          context.strokeStyle = 'rgba(40,123,181,1)';
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.fillBox) {
          context.fillStyle = '#4278f550';
          context.fillRect(0, 0, shape.width(), shape.height());
        }
      },
      /**
       * @param {InstanceType<typeof Konva.Context>} context
       * @param {KonvaIText} shape
       */
      // @ts-ignore
      hitFunc: (context, shape) => {
        context.beginPath();
        context.rect(0, 0, shape.width(), shape.height());
        context.closePath();
        context.fillStrokeShape(shape);
      },
    });

    this.word = word;
    this.charArr = charArr;
    this.charSpacing = charSpacingFinal;
    this.advanceArrTotal = advanceArrTotal;
    this.leftSideBearing = leftSideBearing;
    this.fontSize = fontSize;
    this.smallCapsMult = font.smallCapsMult;
    // `yActual` contains the y value that we want to draw the text at, which is usually the baseline.
    this.yActual = yActual;
    this.lastWidth = this.width();
    this.fontFaceStyle = font.fontFaceStyle;
    this.fontFaceWeight = font.fontFaceWeight;
    this.fontFaceName = font.fontFaceName;
    this.fontFamilyLookup = font.family;
    this.outline = outline;
    this.selected = selected;
    this.fillBox = fillBox;
    this.dynamicWidth = dynamicWidth;
    this.editTextCallback = editTextCallback;

    this.addEventListener('dblclick dbltap', (event) => {
      if (event instanceof MouseEvent && event.button !== 0) return;
      KonvaIText.addTextInput(this);
    });

    this.select = () => {
      this.selected = true;
    };

    this.deselect = () => {
      this.selected = false;
    };
  }

  /**
   * Get the index of the letter that the cursor is closest to.
   * This function should be used when selecting a letter to edit;
   * when actively editing, `getInputCursorIndex` should be used instead.
   * @param {KonvaIText} itext
   */
  static getCursorIndex = (itext) => {
    const pointerCoordsRel = ScribeCanvas.layerText.getRelativePointerPosition();
    let letterIndex = 0;
    let leftI = itext.x() - itext.leftSideBearing;
    for (let i = 0; i < itext.charArr.length; i++) {
      // For most letters, the letter is selected if the pointer is in the left 75% of the advance.
      // This could be rewritten to be more precise by using the actual bounding box of each letter,
      // however this would require calculating additional metrics for each letter.
      // The 75% rule is a compromise, as setting to 50% would be unintuitive for users trying to select the letter they want to edit,
      // and setting to 100% would be unintuitive for users trying to position the cursor between letters.
      // For the last letter, since using the 75% rule would make it extremely difficult to select the end of the word.
      const cutOffPer = i + 1 === itext.charArr.length ? 0.5 : 0.75;
      const cutOff = leftI + itext.advanceArrTotal[i] * cutOffPer;
      if (pointerCoordsRel?.x && cutOff > pointerCoordsRel.x) break;
      letterIndex++;
      leftI += itext.advanceArrTotal[i];
    }
    return letterIndex;
  };

  /**
   *
   * @param {string} text
   * @param {number} fontSizeHTMLSmallCaps
   */
  static makeSmallCapsDivs = (text, fontSizeHTMLSmallCaps) => {
    const textDivs0 = text.match(/([a-z]+)|([^a-z]+)/g);
    if (!textDivs0) return '';
    const textDivs = textDivs0.map((x) => {
      const lower = /[a-z]/.test(x);
      const styleStr = lower ? `style="font-size:${fontSizeHTMLSmallCaps}px"` : '';
      return `<span class="input-sub" ${styleStr}>${x}</span>`;
    });
    return textDivs.join('');
  };

  static itextToElem = (itext) => {
    const inputElem = document.createElement('span');

    const wordStr = itext.charArr.join('');

    const scale = ScribeCanvas.layerText.scaleY();

    const charSpacingHTML = itext.charSpacing * scale;

    let { x: x1, y: y1 } = itext.getAbsolutePosition();
    if (itext.word.visualCoords) x1 -= itext.leftSideBearing * scale;

    const fontSizeHTML = itext.fontSize * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const fontI = scribe.data.font.getWordFont(itext.word);

    ctx.font = `${itext.fontFaceStyle} ${itext.fontFaceWeight} ${fontSizeHTML}px ${fontI.fontFaceName}`;

    const metrics = ctx.measureText(wordStr);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * fontI.smallCapsMult;

    // Align with baseline
    const topHTML = y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6;

    // Some padding needs to be present for the cursor to be visible when before the first letter or after the last letter.
    const pad = 5;
    inputElem.style.paddingLeft = `${pad}px`;
    inputElem.style.paddingRight = `${pad}px`;
    inputElem.style.position = 'absolute';
    inputElem.style.left = `${x1 - pad}px`;
    inputElem.style.top = `${topHTML}px`;
    inputElem.style.fontSize = `${fontSizeHTML}px`;
    inputElem.style.fontFamily = itext.fontFaceName;

    const angle = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;
    if (!scribe.opt.autoRotate && Math.abs(angle ?? 0) > 0.05) {
      inputElem.style.transformOrigin = `left ${y1 - topHTML}px`;
      inputElem.style.transform = `rotate(${angle}deg)`;
    }

    // We cannot make the text uppercase in the input field, as this would result in the text being saved as uppercase.
    // Additionally, while there is a small-caps CSS property, it does not allow for customizing the size of the small caps.
    // Therefore, we handle small caps by making all text print as uppercase using the `text-transform` CSS property,
    // and then wrapping each letter in a span with a smaller font size.
    if (itext.word.smallCaps) {
      inputElem.style.textTransform = 'uppercase';
      inputElem.innerHTML = KonvaIText.makeSmallCapsDivs(wordStr, fontSizeHTMLSmallCaps);
    } else {
      inputElem.textContent = wordStr;
    }

    inputElem.style.letterSpacing = `${charSpacingHTML}px`;
    inputElem.style.color = itext.fill();
    inputElem.style.opacity = String(itext.opacity());
    inputElem.style.fontStyle = itext.fontFaceStyle;
    inputElem.style.fontWeight = itext.fontFaceWeight;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    inputElem.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;

    // By default the browser will add an outline when the field is focused
    inputElem.style.outline = 'none';

    // Prevent line breaks and hide overflow
    inputElem.style.whiteSpace = 'nowrap';

    inputElem.classList.add('scribe-word');

    inputElem.id = itext.word.id;

    return inputElem;
  };

  /**
   * Position and show the input for editing.
   * @param {KonvaIText} itext
   * @param {?number} cursorIndex - Index to position the cursor at. If `null`, position is determined by mouse location.
   */
  static addTextInput = (itext, cursorIndex = null) => {
    const letterIndex = cursorIndex ?? KonvaIText.getCursorIndex(itext);

    if (ScribeCanvas.inputRemove) ScribeCanvas.inputRemove();

    const inputElem = KonvaIText.itextToElem(itext);
    inputElem.contentEditable = 'true';

    ScribeCanvas.inputWord = itext;
    ScribeCanvas.input = inputElem;

    const scale = ScribeCanvas.layerText.scaleY();

    const fontI = scribe.data.font.getWordFont(itext.word);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * fontI.smallCapsMult;

    if (itext.word.smallCaps) {
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        const textContent = inputElem.textContent || '';
        inputElem.innerHTML = KonvaIText.makeSmallCapsDivs(textContent, fontSizeHTMLSmallCaps);
        setCursor(index);
      };
    } else {
      // When users copy/paste text, formatting is often copied as well.
      // For example, copying contents of a low-conf word into a high-conf word will also copy the red color.
      // This code removes any formatting from the pasted text.
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        // eslint-disable-next-line no-self-assign
        inputElem.textContent = inputElem.textContent;
        setCursor(index);
      };
    }

    ScribeCanvas.inputRemove = () => {
      if (!ScribeCanvas.input) return;

      let textNew = scribe.utils.ocr.replaceLigatures(ScribeCanvas.input.textContent || '').trim();

      if (optGUI.smartQuotes) textNew = scribe.utils.replaceSmartQuotes(textNew);

      // Words are not allowed to be empty
      if (textNew) {
        itext.word.text = textNew;
        itext.editTextCallback(itext);
      }
      updateWordCanvas(itext);
      ScribeCanvas.input.remove();
      ScribeCanvas.input = null;
      ScribeCanvas.inputRemove = null;
      ScribeCanvas.inputWord = null;
    };

    // Update the Konva Text node after editing
    ScribeCanvas.input.addEventListener('blur', () => (ScribeCanvas.inputRemove));
    ScribeCanvas.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && ScribeCanvas.inputRemove) {
        ScribeCanvas.inputRemove();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.body.appendChild(ScribeCanvas.input);

    ScribeCanvas.input.focus();

    /**
     * Returns the cursor position relative to the start of the text box, including all text nodes.
     * @returns {number}
     */
    const getInputCursorIndex = () => {
      const sel = /** @type {Selection} */ (window.getSelection());
      // The achor node may be either (1) a text element or (2) a `<span>` element that contains a text element.
      const anchor = /** @type {HTMLElement} */ (sel.anchorNode);
      let nodePrev = anchor?.parentElement?.className === 'input-sub' ? anchor?.parentElement.previousElementSibling : anchor?.previousElementSibling;
      let nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];

      let index = sel.anchorOffset;
      while (nodePrevText && nodePrev) {
        index += nodePrevText.textContent?.length || 0;
        nodePrev = nodePrev.className === 'input-sub' ? nodePrev.previousElementSibling : nodePrev?.previousElementSibling;
        nodePrevText = nodePrev?.nodeType === 3 ? nodePrev : nodePrev?.childNodes[0];
      }
      return index;
    };

    /**
     * Set cursor position to `index` within the input.
     * @param {number} index
     */
    const setCursor = (index) => {
      if (!ScribeCanvas.input) {
        console.error('Input element not found');
        return;
      }
      const range = document.createRange();
      const sel = /** @type {Selection} */ (window.getSelection());

      let letterI = 0;
      for (let i = 0; i < ScribeCanvas.input.childNodes.length; i++) {
        const node = ScribeCanvas.input.childNodes[i];
        const nodeLen = node.textContent?.length || 0;
        if (letterI + nodeLen >= index) {
          const textNode = node.nodeType === 3 ? node : node.childNodes[0];
          // console.log(`Setting cursor to index ${index - letterI} in node ${i}`);
          range.setStart(textNode, index - letterI);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          break;
        } else {
          letterI += nodeLen;
        }
      }
    };

    setCursor(letterIndex);

    // For reasons that are unclear, when using the enter key to add the input,
    // using `itext.draw()` does not clear the background text but `layerText.batchDraw` does.
    itext.hide();
    ScribeCanvas.layerText.batchDraw();
  };
}

function getElementIdsInRange(range) {
  const elementIds = [];
  const treeWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        // Check if the node is within the range and has the class 'scribe-word'
        if (node.classList && node.classList.contains('scribe-word')) {
          const nodeRange = document.createRange();
          nodeRange.selectNode(node);
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    },
  );

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    if (node.id) {
      elementIds.push(node.id);
    }
  }

  return elementIds;
}

document.addEventListener('copy', (e) => {
  const sel = /** @type {Selection} */ (window.getSelection());
  const range = sel.getRangeAt(0);

  const ids = getElementIdsInRange(range);

  const text = scribe.utils.renderText([scribe.data.ocr.active[stateGUI.cp.n]], 0, 0, false, false, ids);

  // @ts-ignore
  e.clipboardData.setData('text/plain', text);

  e.preventDefault(); // Prevent the default copy action
});

globalThis.renderAllWordsHTML = () => {
  const words = ScribeCanvas.getKonvaWords();
  words.forEach((word) => {
    const elem = KonvaIText.itextToElem(word);
    document.body.appendChild(elem);
  });
};

export class KonvaOcrWord extends KonvaIText {
  /**
   *
   * @param {Object} options
   * @param {number} options.visualLeft
   * @param {number} options.yActual
   * @param {number} options.topBaseline
   * @param {OcrWord} options.word
   * @param {number} options.rotation
   * @param {boolean} options.outline - Draw black outline around text.
   * @param {boolean} options.fillBox
   */
  constructor({
    visualLeft, yActual, topBaseline, word, rotation,
    outline, fillBox,
  }) {
    // const { fill, opacity } = getWordFillOpacityGUI(word);
    const { fill, opacity } = scribe.utils.ocr.getWordFillOpacity(word, scribe.opt.displayMode,
      scribe.opt.confThreshMed, scribe.opt.confThreshHigh, scribe.opt.overlayOpacity);

    super({
      x: visualLeft,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      yActual,
      word,
      rotation,
      outline,
      fillBox,
      opacity,
      fill,
      editTextCallback: () => {},
    });

    this.listening(!stateGUI.layoutMode);

    this.lastX = this.x();
    this.lastWidth = this.width();
    this.baselineAdj = 0;
    this.topBaseline = topBaseline;
    this.topBaselineOrig = topBaseline;

    this.addEventListener('transformstart', () => {
      this.lastX = this.x();
      this.lastWidth = this.width();
    });

    this.addEventListener('transformend', () => {
      // Sub-integer scaling is allowed to avoid a frustrating user experience, and allow for precise positioning when exporting to PDF.
      // However, the bounding box will be rounded upon export to HOCR, as the HOCR specification requires integer coordinates.
      const leftDelta = this.x() - this.lastX;
      const widthDelta = this.width() * this.scaleX() - this.lastWidth;

      const leftMode = Math.abs(leftDelta) > Math.abs(widthDelta / 2);

      if (leftMode) {
        this.word.bbox.left += leftDelta;
      } else {
        this.word.bbox.right += widthDelta;
      }

      updateWordCanvas(this);
    });
  }

  /**
   * Update the UI to reflect the properties of selected words.
   * This should be called when any word is selected, after adding them to the selection.
   */
  static updateUI = () => {};

  /**
   * Add controls for editing left/right bounds of word.
   * @param {KonvaOcrWord} itext
   */
  static addControls = (itext) => {
    const trans = new Konva.Transformer({
      enabledAnchors: ['middle-left', 'middle-right'],
      rotateEnabled: false,
      // This width is automatically scaled by Konva based on the zoom level.
      borderStrokeWidth: 2,
    });

    ScribeCanvas._controlArr.push(trans);
    ScribeCanvas.layerText.add(trans);

    trans.nodes([itext]);
  };
}

// const working = false;

/**
 * Changes color and opacity of words based on the current display mode.
 */
export function setWordColorOpacity() {
  ScribeCanvas.getKonvaWords().forEach((obj) => {
    // const { opacity, fill } = getWordFillOpacityGUI(obj.word);

    const { fill, opacity } = scribe.utils.ocr.getWordFillOpacity(obj.word, scribe.opt.displayMode,
      scribe.opt.confThreshMed, scribe.opt.confThreshHigh, scribe.opt.overlayOpacity);

    obj.fill(fill);
    obj.opacity(opacity);
  });
}

/**
 * Change the display mode (e.g. proofread mode vs. ocr mode).
 * Impacts what color the text is printed and whether the background image is displayed.
 *
 * @param { ("invis"|"ebook"|"eval"|"proof")} x
 * @returns
 */
export const selectDisplayMode = async (x) => {
  setWordColorOpacity();

  const pageDims = scribe.data.pageMetrics[stateGUI.cp.n].dims;

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (scribe.inputData.imageMode || scribe.inputData.pdfMode)) {
    stateGUI.cp.backgroundOpts.originX = 'center';
    stateGUI.cp.backgroundOpts.originY = 'center';

    const backgroundImage = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinary(stateGUI.cp.n) : await scribe.data.image.getNative(stateGUI.cp.n);
    const image = scribe.opt.colorMode === 'binary' ? await scribe.data.image.getBinaryBitmap(stateGUI.cp.n) : await scribe.data.image.getNativeBitmap(stateGUI.cp.n);
    let rotation = 0;
    if (!backgroundImage.rotated) {
      rotation = (scribe.data.pageMetrics[stateGUI.cp.n].angle || 0) * -1;
    }

    const scaleX = backgroundImage.upscaled ? 0.5 : 1;
    const scaleY = backgroundImage.upscaled ? 0.5 : 1;

    const backgroundImageKonva = new Konva.Image({
      image,
      rotation,
      scaleX,
      scaleY,
      x: pageDims.width * 0.5,
      y: pageDims.height * 0.5,
      offsetX: image.width * 0.5,
      offsetY: image.height * 0.5,
      strokeWidth: 4,
      stroke: 'black',
    });

    ScribeCanvas.layerBackground.destroyChildren();

    ScribeCanvas.layerBackground.add(backgroundImageKonva);
  } else {
    ScribeCanvas.layerBackground.destroyChildren();
  }

  // When the page changes, the dimensions and zoom are modified.
  // This should be disabled when the page is not changing, as it would be frustrating for the zoom to be reset (for example) after recognizing a word.
  if (stateGUI.canvasDimsN !== stateGUI.cp.n) {
    setCanvasWidthHeightZoom(scribe.data.pageMetrics[stateGUI.cp.n].dims);

    stateGUI.canvasDimsN = stateGUI.cp.n;
    // The setCanvasWidthHeightZoom function will call canvas.requestRenderAll() if the zoom is changed,
    // so we only need to call it here if the zoom is not changed.
  }

  const angle = scribe.data.pageMetrics[stateGUI.cp.n]?.angle || 0;
  if (scribe.opt.autoRotate) {
    rotateAllLayers(0);
  } else {
    rotateAllLayers(angle);
  }

  ScribeCanvas.stage.batchDraw();
};

let evalStatsConfig = {
  /** @type {string|undefined} */
  ocrActive: undefined,
  ignorePunct: scribe.opt.ignorePunct,
  ignoreCap: scribe.opt.ignoreCap,
  ignoreExtra: scribe.opt.ignoreExtra,
};

/** @type {Array<EvalMetrics>} */
export const evalStats = [];

export async function compareGroundTruth() {
  const oemActive = Object.keys(scribe.data.ocr).find((key) => scribe.data.ocr[key] === scribe.data.ocr.active && key !== 'active');

  const evalStatsConfigNew = {
    ocrActive: oemActive,
    ignorePunct: scribe.opt.ignorePunct,
    ignoreCap: scribe.opt.ignoreCap,
    ignoreExtra: scribe.opt.ignoreExtra,
  };
  /** @type {Parameters<typeof scribe.compareOCR>[2]} */
  const compOptions = {
    ignorePunct: scribe.opt.ignorePunct,
    ignoreCap: scribe.opt.ignoreCap,
    confThreshHigh: scribe.opt.confThreshHigh,
    confThreshMed: scribe.opt.confThreshMed,
  };

  // Compare all pages if this has not been done already with the current settings
  if (JSON.stringify(evalStatsConfig) !== JSON.stringify(evalStatsConfigNew) || evalStats.length === 0) {
    evalStatsConfig = evalStatsConfigNew;

    // TODO: This will overwrite any edits made by the user while `compareOCR` is running.
    // Is this a problem that is likely to occur in real use? If so, how should it be fixed?
    const res = await scribe.compareOCR(scribe.data.ocr.active, scribe.data.ocr['Ground Truth'], compOptions);

    // TODO: Replace this with a version that assigns the new value to the specific OCR version in question,
    // rather than the currently active OCR.
    // Assigning to "active" will overwrite whatever version the user currently has open.
    scribe.data.ocr.active = res.ocr;

    replaceObjectProperties(evalStats, res.metrics);
  }
}

let widthHeightInitial = true;

/**
 *
 * @param {dims} imgDims - Dimensions of image
 */
export const setCanvasWidthHeightZoom = (imgDims) => {
  // const enableConflictsViewer = false;
  // const totalHeight = enableConflictsViewer ? Math.round(document.documentElement.clientHeight * 0.7) - 1 : document.documentElement.clientHeight;

  const totalHeight = document.documentElement.clientHeight;

  // // Re-set width/height, in case the size of the window changed since originally set.
  // stage.height(totalHeight);
  // ScribeCanvas.stage.width(document.documentElement.clientWidth);

  // The first time this function is run, the canvas is centered and zoomed to fit the image.
  // After that, whatever the user does with the canvas is preserved.
  if (widthHeightInitial) {
    widthHeightInitial = false;
    const interfaceHeight = 100;
    const bottomMarginHeight = 50;
    const targetHeight = totalHeight - interfaceHeight - bottomMarginHeight;

    const zoom = targetHeight / imgDims.height;

    ScribeCanvas.layerText.scaleX(zoom);
    ScribeCanvas.layerText.scaleY(zoom);
    ScribeCanvas.layerBackground.scaleX(zoom);
    ScribeCanvas.layerBackground.scaleY(zoom);
    ScribeCanvas.layerOverlay.scaleX(zoom);
    ScribeCanvas.layerOverlay.scaleY(zoom);

    ScribeCanvas.layerText.x(((ScribeCanvas.stage.width() - (imgDims.width * zoom)) / 2));
    ScribeCanvas.layerText.y(interfaceHeight);
    ScribeCanvas.layerBackground.x(((ScribeCanvas.stage.width() - (imgDims.width * zoom)) / 2));
    ScribeCanvas.layerBackground.y(interfaceHeight);
    ScribeCanvas.layerOverlay.x(((ScribeCanvas.stage.width() - (imgDims.width * zoom)) / 2));
    ScribeCanvas.layerOverlay.y(interfaceHeight);
  } else {
    const left = ScribeCanvas.layerText.x();
    const top = ScribeCanvas.layerText.y();
    const scale = ScribeCanvas.layerText.scaleX();
    const stageWidth = ScribeCanvas.stage.width();
    const stageHeight = ScribeCanvas.stage.height();

    // Nudge the document into the viewport, using the lesser of:
    // (1) the shift required to put 50% of the document into view, or
    // (2) the shift required to fill 50% of the viewport.
    // Both conditions are necessary for this to work as expected at all zoom levels.
    if (left < imgDims.width * scale * -0.5
    && left < (stageWidth / 2 - (imgDims.width * scale))) {
      const newX = Math.min(imgDims.width * scale * -0.5, stageWidth / 2 - (imgDims.width * scale));
      ScribeCanvas.layerText.x(newX);
      ScribeCanvas.layerBackground.x(newX);
      ScribeCanvas.layerOverlay.x(newX);
    } else if (left > stageWidth - (imgDims.width * scale * 0.5)
    && left > stageWidth / 2) {
      const newX = Math.max(stageWidth - (imgDims.width * scale * 0.5), stageWidth / 2);
      ScribeCanvas.layerText.x(newX);
      ScribeCanvas.layerBackground.x(newX);
      ScribeCanvas.layerOverlay.x(newX);
    }

    if (top < imgDims.height * scale * -0.5
      && top < (stageHeight / 2 - (imgDims.height * scale))) {
      const newY = Math.min(imgDims.height * scale * -0.5, stageHeight / 2 - (imgDims.height * scale));
      ScribeCanvas.layerText.y(newY);
      ScribeCanvas.layerBackground.y(newY);
      ScribeCanvas.layerOverlay.y(newY);
    } else if (top > stageHeight - (imgDims.height * scale * 0.5)
      && top > stageHeight / 2) {
      const newY = Math.max(stageHeight - (imgDims.height * scale * 0.5), stageHeight / 2);
      ScribeCanvas.layerText.y(newY);
      ScribeCanvas.layerBackground.y(newY);
      ScribeCanvas.layerOverlay.y(newY);
    }
  }
};

// Function that handles page-level info for rendering to canvas
export async function renderPageQueue(n) {
  let ocrData = scribe.data.ocr.active?.[n];

  // Return early if there is not enough data to render a page yet
  // (0) Necessary info is not defined yet
  const noInfo = scribe.inputData.xmlMode[n] === undefined;
  // (1) No data has been imported
  const noInput = !scribe.inputData.xmlMode[n] && !(scribe.inputData.imageMode || scribe.inputData.pdfMode);
  // (2) XML data should exist but does not (yet)
  const xmlMissing = scribe.inputData.xmlMode[n]
    && (ocrData === undefined || ocrData === null || scribe.data.pageMetrics[n].dims === undefined);

  const imageMissing = false;
  const pdfMissing = false;

  if (noInfo || noInput || xmlMissing || imageMissing || pdfMissing) {
    console.log('Exiting renderPageQueue early');
    return;
  }

  const renderItI = stateGUI.renderIt + 1;
  stateGUI.renderIt = renderItI;

  // If a page is already being rendered, wait for it to complete
  await stateGUI.pageRendering;
  // If another page has been requested already, return early
  if (stateGUI.renderIt !== renderItI) return;

  stateGUI.pageRendering = new Promise((resolve, reject) => {
    stateGUI.promiseResolve = resolve;
  });

  if (scribe.inputData.evalMode) {
    await compareGroundTruth();
    // ocrData must be re-assigned after comparing to ground truth or it will not update.
    ocrData = scribe.data.ocr.active?.[n];
  }

  ScribeCanvas.destroyWords();

  // These are all quick fixes for issues that occur when multiple calls to this function happen quickly
  // (whether by quickly changing pages or on the same page).
  // TODO: Find a better solution.
  stateGUI.cp.renderNum += 1;
  const renderNum = stateGUI.cp.renderNum;

  // The active OCR version may have changed, so this needs to be re-checked.
  if (stateGUI.cp.n === n && scribe.inputData.xmlMode[n]) {
    renderPage(ocrData);
    if (stateGUI.cp.n === n && stateGUI.cp.renderNum === renderNum) {
      await selectDisplayMode(scribe.opt.displayMode);
    }
  } else {
    await selectDisplayMode(scribe.opt.displayMode);
  }

  // @ts-ignore
  stateGUI.promiseResolve();
}

/**
 *
 * @param {bbox} box
 * @param {{x: number, y: number}} angleAdj
 * @param {string} [label]
 */
const addBlockOutline = (box, angleAdj, label) => {
  const height = box.bottom - box.top;

  const blockRect = new Konva.Rect({
    x: box.left + angleAdj.x,
    y: box.top + angleAdj.y,
    width: box.right - box.left,
    height,
    stroke: 'rgba(0,0,255,0.75)',
    strokeWidth: 1,
    draggable: false,
    listening: false,
  });

  if (label) {
    const labelObj = new Konva.Text({
      x: box.left + angleAdj.x,
      y: box.top + angleAdj.y,
      text: label,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: 'rgba(0,0,255,0.75)',
      draggable: false,
      listening: false,
    });

    ScribeCanvas.layerText.add(labelObj);
    ScribeCanvas._lineOutlineArr.push(labelObj);
  }

  ScribeCanvas.layerText.add(blockRect);

  ScribeCanvas._lineOutlineArr.push(blockRect);
};

/**
 *
 * @param {OcrPage} page
 */
export function renderPage(page) {
  const matchIdArr = scribe.utils.ocr.getMatchingWordIds(search.search, scribe.data.ocr.active[stateGUI.cp.n]);

  const angle = scribe.data.pageMetrics[stateGUI.cp.n].angle || 0;

  const imageRotated = Math.abs(angle ?? 0) > 0.05;

  if (optGUI.outlinePars && page) {
    scribe.utils.assignParagraphs(page, angle);

    page.pars.forEach((par) => {
      const angleAdj = imageRotated ? scribe.utils.ocr.calcLineStartAngleAdj(par.lines[0]) : { x: 0, y: 0 };
      addBlockOutline(par.bbox, angleAdj, par.reason);
    });
  }

  for (let i = 0; i < page.lines.length; i++) {
    const lineObj = page.lines[i];
    const linebox = lineObj.bbox;
    const { baseline } = lineObj;

    const angleAdjLine = imageRotated ? scribe.utils.ocr.calcLineStartAngleAdj(lineObj) : { x: 0, y: 0 };

    if (optGUI.outlineLines) {
      const heightAdj = Math.abs(Math.tan(angle * (Math.PI / 180)) * (linebox.right - linebox.left));
      const height1 = linebox.bottom - linebox.top - heightAdj;
      const height2 = lineObj.words[0] ? lineObj.words[0].bbox.bottom - lineObj.words[0].bbox.top : 0;
      const height = Math.max(height1, height2);

      const lineRect = new Konva.Rect({
        x: linebox.left + angleAdjLine.x,
        y: linebox.bottom + baseline[1] + angleAdjLine.y - height,
        width: linebox.right - linebox.left,
        height,
        stroke: 'rgba(0,0,255,0.75)',
        strokeWidth: 1,
        draggable: false,
        listening: false,
      });

      ScribeCanvas._lineOutlineArr.push(lineRect);

      ScribeCanvas.layerText.add(lineRect);
    }

    for (const wordObj of lineObj.words) {
      if (!wordObj.text) continue;

      // const confThreshHigh = elem.info.confThreshHigh.value !== '' ? parseInt(elem.info.confThreshHigh.value) : 85;

      // const displayMode = elem.view.displayMode.value;

      const outlineWord = optGUI.outlineWords || scribe.opt.displayMode === 'eval' && wordObj.conf > scribe.opt.confThreshHigh && !wordObj.matchTruth;

      const angleAdjWord = imageRotated ? scribe.utils.ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

      const visualBaseline = linebox.bottom + baseline[1] + angleAdjLine.y + angleAdjWord.y;

      let top = visualBaseline;
      if (wordObj.sup || wordObj.dropcap) top = wordObj.bbox.bottom + angleAdjLine.y + angleAdjWord.y;

      const visualLeft = wordObj.bbox.left + angleAdjLine.x + angleAdjWord.x;

      const wordCanvas = new KonvaOcrWord({
        visualLeft,
        yActual: top,
        topBaseline: visualBaseline,
        rotation: 0,
        word: wordObj,
        outline: outlineWord,
        fillBox: matchIdArr.includes(wordObj.id),
      });

      ScribeCanvas.addWord(wordCanvas);
    }
  }
}

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
  zoomLayer(ScribeCanvas.layerText, scaleBy, center);
  zoomLayer(ScribeCanvas.layerBackground, scaleBy, center);
  zoomLayer(ScribeCanvas.layerOverlay, scaleBy, center);
};

/**
 *
 * @param {Object} coords
 * @param {number} [coords.deltaX=0]
 * @param {number} [coords.deltaY=0]
 */
export const panAllLayers = ({ deltaX = 0, deltaY = 0 }) => {
  ScribeCanvas.layerText.x(ScribeCanvas.layerText.x() + deltaX);
  ScribeCanvas.layerText.y(ScribeCanvas.layerText.y() + deltaY);
  ScribeCanvas.layerBackground.x(ScribeCanvas.layerBackground.x() + deltaX);
  ScribeCanvas.layerBackground.y(ScribeCanvas.layerBackground.y() + deltaY);
  ScribeCanvas.layerOverlay.x(ScribeCanvas.layerOverlay.x() + deltaX);
  ScribeCanvas.layerOverlay.y(ScribeCanvas.layerOverlay.y() + deltaY);

  ScribeCanvas.layerText.batchDraw();
  ScribeCanvas.layerBackground.batchDraw();
  ScribeCanvas.layerOverlay.batchDraw();
};

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

/**
 * Handles the wheel event to scroll the layer vertically.
 * @param {WheelEvent} event - The wheel event from the user's mouse.
 */
export const handleWheel = (event) => {
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

    zoomAllLayers(scaleBy, ScribeCanvas.stage.getPointerPosition());
    ScribeCanvas.destroyControls();
  } else { // Scroll vertically
    ScribeCanvas.destroyControls();
    panAllLayers({ deltaX: event.deltaX * -1, deltaY: event.deltaY * -1 });
  }
};
