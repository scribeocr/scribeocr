/* eslint-disable import/no-cycle */
import scribe from '../scribe.js/scribe.js';
import Konva from '../app/lib/konva/index.js';
import { search, updateFindStats } from './viewerSearch.js';
import { KonvaDataColumn, KonvaLayout, renderLayoutBoxes } from './viewerLayout.js';
import { replaceObjectProperties } from '../app/utils/utils.js';
import { KonvaIText, KonvaOcrWord } from './viewerWordObjects.js';
import { ViewerImageCache } from './viewerImageCache.js';

Konva.autoDrawEnabled = false;
Konva.dragButtons = [0];

export class stateGUI {
  static recognizeAllPromise = Promise.resolve();

  static layoutMode = false;

  static searchMode = false;

  /** @type {'color'|'gray'|'binary'} */
  static colorMode = 'color';

  static cp = {
    n: 0,
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
    if (konvaLayoutBoxes.length === 1 && !(konvaLayoutBoxes[0] instanceof KonvaDataColumn)) KonvaLayout.addControls(konvaLayoutBoxes[0]);

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

  /** @type {HTMLDivElement} */
  static HTMLOverlayBackstopElem;

  static textOverlayHidden = false;

  /** @type {Array<number>} */
  static #pageStopsStart = [];

  /** @type {Array<number>} */
  static #pageStopsEnd = [];

  /**
   *
   * @param {number} n
   * @param {boolean} start
   * @returns {number}
   */
  static getPageStop = (n, start = true) => {
    // This needs to be here to prevent `ScribeCanvas.calcPageStops` from being called before the final page dimensions are known.
    // This is an issue when a PDF is being uploaded alongside existing OCR data, as the correct dimensions are not known until the OCR data is parsed.
    if (start && n === 0) return 30;

    if (start && ScribeCanvas.#pageStopsStart[n]) return ScribeCanvas.#pageStopsStart[n];
    if (!start && ScribeCanvas.#pageStopsEnd[n]) return ScribeCanvas.#pageStopsEnd[n];

    ScribeCanvas.calcPageStops();

    if (start && ScribeCanvas.#pageStopsStart[n]) return ScribeCanvas.#pageStopsStart[n];
    if (!start && ScribeCanvas.#pageStopsEnd[n]) return ScribeCanvas.#pageStopsEnd[n];

    // The `null` condition is only true briefly during initialization, and is not worth checking for every time throughout the program.
    // @ts-ignore
    return null;
  };

  /** @type {?Function} */
  static displayPageCallback = null;

  /** @type {Array<InstanceType<typeof Konva.Rect>>} */
  static placeholderRectArr = [];

  static calcPageStops = () => {
    const margin = 30;
    let y = margin;
    for (let i = 0; i < scribe.data.pageMetrics.length; i++) {
      ScribeCanvas.#pageStopsStart[i] = y;
      const dims = scribe.data.pageMetrics[i].dims;
      if (!dims) return;

      // TODO: This does not work because angle is not populated at this point.
      // This is true even when uploading a PDF with existing OCR data, as dims are defined before parsing the OCR data.
      const rotation = (scribe.data.pageMetrics[i].angle || 0) * -1;
      y += dims.height + margin;
      ScribeCanvas.#pageStopsEnd[i] = y;

      if (!ScribeCanvas.placeholderRectArr[i]) {
        ScribeCanvas.placeholderRectArr[i] = new Konva.Rect({
          x: 0,
          y: ScribeCanvas.getPageStop(i),
          width: dims.width,
          height: dims.height,
          stroke: 'black',
          strokeWidth: 2,
          strokeScaleEnabled: false,
          listening: false,
          rotation,
        });
        ScribeCanvas.layerBackground.add(ScribeCanvas.placeholderRectArr[i]);
      }
    }
  };

  /**
 *
 * @returns {{x: number, y: number}}
 */
  static getStageCenter = () => {
    const layerWidth = ScribeCanvas.stage.width();
    const layerHeight = ScribeCanvas.stage.height();

    // Calculate the center point of the layer before any transformations
    const centerPoint = {
      x: layerWidth / 2,
      y: layerHeight / 2,
    };

    return centerPoint;
  };

  /**
   *
   * @param {InstanceType<typeof Konva.Layer>|InstanceType<typeof Konva.Stage>} layer
   * @param {number} scaleBy
   * @param {{x: number, y: number}} center - The center point to zoom in/out from.
   */
  static _zoomStageImp = (layer, scaleBy, center) => {
    const oldScale = layer.scaleX();

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
  static _zoomStage = (scaleBy, center = null) => {
    if (!center) {
      const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();

      // If words are selected, zoom in on the selection.
      if (selectedWords.length > 0) {
        const selectionLeft = Math.min(...selectedWords.map((x) => x.x()));
        const selectionRight = Math.max(...selectedWords.map((x) => x.x() + x.width()));
        const selectionTop = Math.min(...selectedWords.map((x) => x.y()));
        const selectionBottom = Math.max(...selectedWords.map((x) => x.y() + x.height()));
        const center0 = { x: (selectionLeft + selectionRight) / 2, y: (selectionTop + selectionBottom) / 2 };

        const transform = ScribeCanvas.layerText.getAbsoluteTransform();

        // Apply the transformation to the center point
        center = transform.point(center0);

        // Otherwise, zoom in on the center of the text layer.
      } else {
        center = ScribeCanvas.getStageCenter();
      }
    }

    ScribeCanvas._zoomStageImp(ScribeCanvas.stage, scaleBy, center);
  };

  /**
   *
   * @param {Object} coords
   * @param {number} [coords.deltaX=0]
   * @param {number} [coords.deltaY=0]
   */
  static panStage = ({ deltaX = 0, deltaY = 0 }) => {
    const yOld = (ScribeCanvas.stage.y() - ScribeCanvas.stage.height() / 2) / ScribeCanvas.stage.getAbsoluteScale().y * -1;
    const yNew = (ScribeCanvas.stage.y() - ScribeCanvas.stage.height() / 2 + deltaY) / ScribeCanvas.stage.getAbsoluteScale().y * -1;

    const pageOld = ScribeCanvas.#pageStopsEnd.findIndex((y) => y > yOld) || 0;
    const pageNew = ScribeCanvas.#pageStopsEnd.findIndex((y) => y > yNew) || 0;

    if (pageOld !== pageNew && pageNew >= 0) {
      ScribeCanvas.displayPage(pageNew);
    }

    ScribeCanvas.stage.x(ScribeCanvas.stage.x() + deltaX);
    ScribeCanvas.stage.y(ScribeCanvas.stage.y() + deltaY);
    ScribeCanvas.stage.batchDraw();
  };

  /**
   * Zoom in or out on the canvas.
   * This function should be used for mapping buttons or other controls to zooming,
   * as it handles redrawing the text overlay in addition to zooming the canvas.
   * @param {number} scaleBy
   * @param {?{x: number, y: number}} [center=null] - The center point to zoom in/out from.
   *    If `null` (default), the center of the layer is used.
   */
  static zoom = (scaleBy, center = null) => {
    ScribeCanvas.deleteHTMLOverlay();
    ScribeCanvas._zoomStage(scaleBy, center);
    if (ScribeCanvas.enableHTMLOverlay) ScribeCanvas.renderHTMLOverlayAfterDelay();
  };

  /**
   * Initiates dragging if the middle mouse button is pressed.
   * @param {MouseEvent} event
   */
  static startDrag = (event) => {
    ScribeCanvas.deleteHTMLOverlay();
    ScribeCanvas.drag.isDragging = true;
    ScribeCanvas.drag.lastX = event.x;
    ScribeCanvas.drag.lastY = event.y;
    event.preventDefault();
  };

  /**
   * Initiates dragging if the middle mouse button is pressed.
   * @param {KonvaTouchEvent} event
   */
  static startDragTouch = (event) => {
    ScribeCanvas.deleteHTMLOverlay();
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

      ScribeCanvas.panStage({ deltaX, deltaY });
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

      ScribeCanvas.panStage({ deltaX, deltaY });
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
    if (ScribeCanvas.enableHTMLOverlay && ScribeCanvas._wordHTMLArr.length === 0) {
      ScribeCanvas.renderHTMLOverlay();
    }
  };

  /**
   * @param {KonvaTouchEvent} event
   */
  static executePinchTouch = (event) => {
    ScribeCanvas.deleteHTMLOverlay();
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

    ScribeCanvas._zoomStage(dist / ScribeCanvas.drag.lastDist, center);
    ScribeCanvas.drag.lastDist = dist;
    if (ScribeCanvas.enableHTMLOverlay) ScribeCanvas.renderHTMLOverlayAfterDelay();
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

    ScribeCanvas.HTMLOverlayBackstopElem = document.createElement('div');
    ScribeCanvas.HTMLOverlayBackstopElem.className = 'endOfContent';
    ScribeCanvas.HTMLOverlayBackstopElem.style.position = 'absolute';
    ScribeCanvas.HTMLOverlayBackstopElem.style.top = '0';
    ScribeCanvas.HTMLOverlayBackstopElem.style.left = '0';
    ScribeCanvas.HTMLOverlayBackstopElem.style.width = `${width}px`;
    ScribeCanvas.HTMLOverlayBackstopElem.style.height = `${height}px`;
    ScribeCanvas.HTMLOverlayBackstopElem.style.display = 'none';

    ScribeCanvas.layerBackground = new Konva.Layer();
    ScribeCanvas.layerText = new Konva.Layer();
    ScribeCanvas.layerOverlay = new Konva.Layer();

    ScribeCanvas.groupText = new Konva.Group();
    ScribeCanvas.groupOverlay = new Konva.Group();

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

      if (!ScribeCanvas.enableCanvasSelection) return;

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
      e.evt.preventDefault();
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

      const editingWord = !!ScribeCanvas.KonvaIText.input;

      // If a word is being edited, the only action allowed is clicking outside the word to deselect it.
      if (editingWord) {
        if (mouseDownTarget === ScribeCanvas.KonvaIText.inputWord || mouseUpTarget === ScribeCanvas.KonvaIText.inputWord) {
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

  static renderHTMLOverlay = () => {
    const words = ScribeCanvas.getKonvaWords();
    words.forEach((word) => {
      const elem = KonvaIText.itextToElem(word);
      ScribeCanvas._wordHTMLArr.push(elem);
      ScribeCanvas.elem.appendChild(elem);
    });
  };

  static _renderHTMLOverlayEvents = 0;

  /**
   * Render the HTML overlay after 150ms, if no other events have been triggered in the meantime.
   * This function should be called whenever a frequently-triggered event needs to render the HTML overlay,
   * such as scrolling or zooming, which can result in performance issues if the overlay is rendered too frequently.
   */
  static renderHTMLOverlayAfterDelay = () => {
    ScribeCanvas._renderHTMLOverlayEvents++;
    const eventN = ScribeCanvas._renderHTMLOverlayEvents;
    setTimeout(() => {
      if (eventN === ScribeCanvas._renderHTMLOverlayEvents && ScribeCanvas._wordHTMLArr.length === 0) {
        ScribeCanvas.renderHTMLOverlay();
      }
    }, 150);
  };

  static deleteHTMLOverlay = () => {
    ScribeCanvas._wordHTMLArr.forEach((elem) => {
      if (elem.parentNode) {
        elem.parentNode.removeChild(elem);
      }
    });
    ScribeCanvas._wordHTMLArr.length = 0;
  };

  static runSetInitial = true;

  /**
   * Set the initial position and zoom of the canvas to reasonable defaults.
   * @param {dims} imgDims - Dimensions of image
   */
  static setInitialPositionZoom = (imgDims) => {
    ScribeCanvas.runSetInitial = false;

    const totalHeight = document.documentElement.clientHeight;

    const interfaceHeight = 100;
    const bottomMarginHeight = 50;
    const targetHeight = totalHeight - interfaceHeight - bottomMarginHeight;

    const zoom = targetHeight / imgDims.height;

    ScribeCanvas.stage.scaleX(zoom);
    ScribeCanvas.stage.scaleY(zoom);
    ScribeCanvas.stage.x(((ScribeCanvas.stage.width() - (imgDims.width * zoom)) / 2));
    ScribeCanvas.stage.y(interfaceHeight);
  };

  // Function that handles page-level info for rendering to canvas
  static renderPage = async (n) => {
    let ocrData = scribe.data.ocr.active?.[n];

    // Return early if there is not enough data to render a page yet
    // (0) Necessary info is not defined yet
    const noInfo = scribe.inputData.xmlMode[n] === undefined;
    // (1) No data has been imported
    const noInput = !scribe.inputData.xmlMode[n] && !(scribe.inputData.imageMode || scribe.inputData.pdfMode);
    // (2) XML data should exist but does not (yet)
    const xmlMissing = scribe.inputData.xmlMode[n]
    && (ocrData === undefined || ocrData === null || scribe.data.pageMetrics[n].dims === undefined);

    const pageStopsMissing = ScribeCanvas.getPageStop(n) === null;

    const imageMissing = false;
    const pdfMissing = false;

    if (noInfo || noInput || xmlMissing || imageMissing || pdfMissing || pageStopsMissing) {
      console.log('Exiting renderPageQueue early');
      return true;
    }

    if (ScribeCanvas.runSetInitial) ScribeCanvas.setInitialPositionZoom(scribe.data.pageMetrics[n].dims);

    if (scribe.inputData.evalMode) {
      await compareGroundTruth();
      // ocrData must be re-assigned after comparing to ground truth or it will not update.
      ocrData = scribe.data.ocr.active?.[n];
    }

    ScribeCanvas.destroyWords();

    if (scribe.inputData.xmlMode[n]) {
      renderCanvasWords(ocrData);
    }

    ScribeCanvas.layerText.batchDraw();

    // Render background images ahead and behind current page to reduce delay when switching pages
    if ((scribe.inputData.pdfMode || scribe.inputData.imageMode)) {
      ViewerImageCache.renderAheadBehindBrowser(n);
    }

    return false;
  };

  /**
  * Render page `n` in the UI.
  * @param {number} n
  * @param {boolean} [scroll=false] - Scroll to the top of the page being rendered.
  * @returns
  */
  static async displayPage(n, scroll = false) {
    ScribeCanvas.deleteHTMLOverlay();

    if (scribe.inputData.xmlMode[stateGUI.cp.n]) {
      // TODO: This is currently run whenever the page is changed.
      // If this adds any meaningful overhead, we should only have stats updated when edits are actually made.
      updateFindStats();
    }

    if (scribe.opt.displayMode === 'ebook') {
      ScribeCanvas.layerBackground.hide();
      ScribeCanvas.layerBackground.batchDraw();
    } else {
      ScribeCanvas.layerBackground.show();
      ScribeCanvas.layerBackground.batchDraw();
    }

    ScribeCanvas.textOverlayHidden = false;

    const err = await ScribeCanvas.renderPage(n);

    if (err) {
      console.log('Exiting displayPage early');
      return;
    }

    if (scroll) {
      ScribeCanvas.stage.y((ScribeCanvas.getPageStop(n) - 100) * ScribeCanvas.stage.getAbsoluteScale().y * -1);
    }

    stateGUI.cp.n = n;

    if (ScribeCanvas.enableHTMLOverlay) ScribeCanvas.renderHTMLOverlay();

    if (ScribeCanvas.displayPageCallback) ScribeCanvas.displayPageCallback();

    if (stateGUI.layoutMode) renderLayoutBoxes();
  }

  /** @type {InstanceType<typeof Konva.Stage>} */
  static stage;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerBackground;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerText;

  /** @type {InstanceType<typeof Konva.Layer>} */
  static layerOverlay;

  /** @type {InstanceType<typeof Konva.Group>} */
  static groupText;

  /** @type {InstanceType<typeof Konva.Group>} */
  static groupOverlay;

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

  static selectingRectangle;

  /** @type {?KonvaOcrWord} */
  static contextMenuWord = null;

  /** @type {Array<HTMLSpanElement>} */
  static _wordHTMLArr = [];

  /**
   * Contains the x and y coordinates of the last right-click event.
   * This is required for "right click" functions that are position-dependent,
   * as the cursor moves between the initial right click and selecting the option.
   */
  static contextMenuPointer = { x: 0, y: 0 };

  static selecting = false;

  static enableCanvasSelection = false;

  static enableHTMLOverlay = false;

  static CanvasSelection = CanvasSelection;

  static KonvaIText = KonvaIText;

  static KonvaOcrWord = KonvaOcrWord;

  static ViewerImageCache = ViewerImageCache;

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
    // ScribeCanvas.layerText.add(word);
    ScribeCanvas.groupText.add(word);
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
    ScribeCanvas.groupOverlay.add(region);
    if (region.label) ScribeCanvas.groupOverlay.add(region.label);
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
    ScribeCanvas.KonvaOcrWord._controlArr.forEach((control) => control.destroy());
    ScribeCanvas.KonvaOcrWord._controlArr.length = 0;

    if (deselect) ScribeCanvas.CanvasSelection.deselectAll();

    if (ScribeCanvas.KonvaIText.inputRemove) ScribeCanvas.KonvaIText.inputRemove();
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

  /** @type {?Range} */
  static _prevRange = null;

  static _prevStart = null;

  static _prevEnd = null;

  static _onSelection = (event) => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    const focusWordElem = selection.focusNode?.nodeType === Node.ELEMENT_NODE ? selection.focusNode : selection.focusNode?.parentNode;

    if (!focusWordElem || !ScribeCanvas._wordHTMLArr.includes(focusWordElem)) return;

    ScribeCanvas.HTMLOverlayBackstopElem.style.display = '';

    ScribeCanvas.elem.insertBefore(ScribeCanvas.HTMLOverlayBackstopElem, focusWordElem);

    ScribeCanvas._prevRange = range.cloneRange();
  };
}

document.addEventListener('mouseup', () => {
  if (ScribeCanvas.enableHTMLOverlay) {
    ScribeCanvas.HTMLOverlayBackstopElem.style.display = 'none';
  }
});
document.addEventListener('touchend', () => {
  if (ScribeCanvas.enableHTMLOverlay) {
    ScribeCanvas.HTMLOverlayBackstopElem.style.display = 'none';
  }
});

document.addEventListener('selectionchange', ScribeCanvas._onSelection);
document.addEventListener('mousedown', ScribeCanvas._onSelection);

function getElementIdsInRange(range) {
  const elementIds = [];
  const treeWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        // Check if the node is within the range and has the class 'scribe-word'
        if (node instanceof HTMLElement && node.classList && node.classList.contains('scribe-word')) {
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
    if (node instanceof HTMLElement && node.id) {
      elementIds.push(node.id);
    }
  }

  return elementIds;
}

document.addEventListener('copy', (e) => {
  const sel = /** @type {Selection} */ (window.getSelection());
  const range = sel.getRangeAt(0);

  const ids = getElementIdsInRange(range);

  if (ids.length === 0) return;

  const text = scribe.utils.renderText([scribe.data.ocr.active[stateGUI.cp.n]], 0, 0, false, false, ids);

  // @ts-ignore
  e.clipboardData.setData('text/plain', text);

  e.preventDefault(); // Prevent the default copy action
});

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

  if (!oemActive) {
    console.error('No OCR data active');
    return;
  }

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

    scribe.data.ocr[oemActive] = res.ocr;
    scribe.data.ocr.active = scribe.data.ocr[oemActive];

    replaceObjectProperties(evalStats, res.metrics);
  }
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

    ScribeCanvas.groupText.add(labelObj);
    ScribeCanvas._lineOutlineArr.push(labelObj);
  }

  ScribeCanvas.groupText.add(blockRect);

  ScribeCanvas._lineOutlineArr.push(blockRect);
};

/**
 *
 * @param {OcrPage} page
 */
export function renderCanvasWords(page) {
  const matchIdArr = stateGUI.searchMode ? scribe.utils.ocr.getMatchingWordIds(search.search, scribe.data.ocr.active[page.n]) : [];

  const dims = scribe.data.pageMetrics[page.n].dims;
  const angle = scribe.data.pageMetrics[page.n].angle || 0;

  const imageRotated = Math.abs(angle ?? 0) > 0.05;

  const textRotation = scribe.opt.autoRotate ? 0 : angle;

  const pageOffsetY = ScribeCanvas.getPageStop(page.n) ?? 30;

  ScribeCanvas.groupText.rotation(textRotation);
  ScribeCanvas.groupText.offset({ x: dims.width * 0.5, y: dims.height * 0.5 });
  ScribeCanvas.groupText.position({ x: dims.width * 0.5, y: pageOffsetY + dims.height * 0.5 });
  ScribeCanvas.groupOverlay.rotation(textRotation);
  ScribeCanvas.groupOverlay.offset({ x: dims.width * 0.5, y: dims.height * 0.5 });
  ScribeCanvas.groupOverlay.position({ x: dims.width * 0.5, y: pageOffsetY + dims.height * 0.5 });

  if (optGUI.outlinePars && page) {
    scribe.utils.assignParagraphs(page, angle);

    page.pars.forEach((par) => {
      const angleAdj = imageRotated ? scribe.utils.ocr.calcLineStartAngleAdj(par.lines[0]) : { x: 0, y: 0 };
      addBlockOutline(par.bbox, angleAdj, par.reason);
    });
  }

  for (let i = 0; i < page.lines.length; i++) {
    const lineObj = page.lines[i];

    const angleAdjLine = imageRotated ? scribe.utils.ocr.calcLineStartAngleAdj(lineObj) : { x: 0, y: 0 };

    if (optGUI.outlineLines) {
      const heightAdj = Math.abs(Math.tan(angle * (Math.PI / 180)) * (lineObj.bbox.right - lineObj.bbox.left));
      const height1 = lineObj.bbox.bottom - lineObj.bbox.top - heightAdj;
      const height2 = lineObj.words[0] ? lineObj.words[0].bbox.bottom - lineObj.words[0].bbox.top : 0;
      const height = Math.max(height1, height2);

      const lineRect = new Konva.Rect({
        x: lineObj.bbox.left + angleAdjLine.x,
        y: lineObj.bbox.bottom + lineObj.baseline[1] + angleAdjLine.y - height,
        width: lineObj.bbox.right - lineObj.bbox.left,
        height,
        stroke: 'rgba(0,0,255,0.75)',
        strokeWidth: 1,
        draggable: false,
        listening: false,
      });

      ScribeCanvas._lineOutlineArr.push(lineRect);

      ScribeCanvas.groupText.add(lineRect);
    }

    for (const wordObj of lineObj.words) {
      if (!wordObj.text) continue;

      const outlineWord = optGUI.outlineWords || scribe.opt.displayMode === 'eval' && wordObj.conf > scribe.opt.confThreshHigh && !wordObj.matchTruth;

      const angleAdjWord = imageRotated ? scribe.utils.ocr.calcWordAngleAdj(wordObj) : { x: 0, y: 0 };

      const visualBaseline = lineObj.bbox.bottom + lineObj.baseline[1] + angleAdjLine.y + angleAdjWord.y;

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
        listening: !stateGUI.layoutMode,
      });

      ScribeCanvas.addWord(wordCanvas);
    }
  }

  ScribeCanvas.layerText.add(ScribeCanvas.groupText);
  ScribeCanvas.layerOverlay.add(ScribeCanvas.groupOverlay);
}

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
  ScribeCanvas.deleteHTMLOverlay();
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

    ScribeCanvas._zoomStage(scaleBy, ScribeCanvas.stage.getPointerPosition());
    ScribeCanvas.destroyControls();
  } else if (event.shiftKey) { // Scroll horizontally
    ScribeCanvas.destroyControls();
    ScribeCanvas.panStage({ deltaX: event.deltaY });
  } else { // Scroll vertically
    ScribeCanvas.destroyControls();
    ScribeCanvas.panStage({ deltaY: event.deltaY * -1 });
  }
  if (ScribeCanvas.enableHTMLOverlay) ScribeCanvas.renderHTMLOverlayAfterDelay();
};

// Event listeners for mouse interactions.
// These are added to the document because adding only to the canvas does not work when overlay text is clicked.
// To avoid unintended interactions, the event listeners are only triggered when the target is within the canvas.
document.addEventListener('wheel', (event) => {
  if (event.target instanceof Node && ScribeCanvas.elem.contains(event.target)) {
    handleWheel(event);
  }
}, { passive: false });

document.addEventListener('mousedown', (event) => {
  if (event.target instanceof Node && ScribeCanvas.elem.contains(event.target)) {
    if (event.button === 1) { // Middle mouse button
      ScribeCanvas.startDrag(event);
    }
  }
});
