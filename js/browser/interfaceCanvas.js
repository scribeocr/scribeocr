/* eslint-disable import/no-cycle */

import Konva from '../../lib/konva/index.js';
import { calcWordMetrics, addLigatures } from '../fontUtils.js';
import { fontAll } from '../containers/fontContainer.js';
import { addWordManual, recognizeArea } from './interfaceEdit.js';
import ocr from '../objects/ocrObjects.js';
import { showHideElem } from '../miscUtils.js';

const zoomInElem = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));
const zoomOutElem = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

const stage = new Konva.Stage({
  container: 'c',
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

const layerBackground = new Konva.Layer();
const layerText = new Konva.Layer();
const layerOverlay = new Konva.Layer();

stage.add(layerBackground);
stage.add(layerText);
stage.add(layerOverlay);

const selectingRectangle = new Konva.Rect({
  fill: 'rgba(40,123,181,0.5)',
  visible: true,
  // disable events to not interrupt with events
  listening: false,
});

layerText.add(selectingRectangle);

export const canvasObj = {
  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  controlArr: [],
  /** @type {Array<InstanceType<typeof Konva.Rect>>} */
  lineOutlineArr: [],
  /** @type {Array<KonvaWord>} */
  selectedWordArr: [],
  /** @type {?HTMLSpanElement} */
  input: null,
  /** @type {?Function} */
  inputRemove: null,
  selectingRectangle,
  selecting: false,
  /** @type {bbox} */
  bbox: {
    top: 0, left: 0, right: 0, bottom: 0,
  },
  /** @type {('select'|'addWord'|'recognizeWord'|'recognizeArea'|'printCoords')} */
  mode: 'select',

};

export const addControl = (transformer) => {
  canvasObj.controlArr.push(transformer);
};

export const destroyControls = () => {
  globalThis.bsCollapse.hide();
  canvasObj.controlArr.forEach((control) => control.destroy());
  canvasObj.controlArr.length = 0;
  if (canvasObj.input && canvasObj.input.parentElement && canvasObj.inputRemove) canvasObj.inputRemove();
};

export const destroyLineOutlines = () => {
  canvasObj.lineOutlineArr.forEach((line) => line.destroy());
  canvasObj.lineOutlineArr.length = 0;
};

/**
 * Update word textbox on canvas following changes.
 * Whenever a user edits a word in any way (including content and font/style),
 * the position and character spacing need to be re-calculated so they still overlay with the background image.
 * @param {KonvaWord} wordI
 */
export async function updateWordCanvas(wordI) {
  const fontI = fontAll.getWordFont(wordI.word);
  const fontIOpentype = await fontI.opentype;

  wordI.charArr = addLigatures(wordI.word.text, fontIOpentype);

  // 1. Re-calculate left position given potentially new left bearing
  const {
    advanceArr, fontSize, kerningArr, charSpacing, leftSideBearing,
  } = await calcWordMetrics(wordI.word);

  const advanceArrTotal = [];
  for (let i = 0; i < advanceArr.length; i++) {
    let leftI = 0;
    leftI += advanceArr[i] || 0;
    leftI += kerningArr[i] || 0;
    leftI += charSpacing || 0;
    advanceArrTotal.push(leftI);
  }

  wordI.advanceArrTotal = advanceArrTotal;

  wordI.charSpacing = charSpacing;

  // Re-set the x position of the word.
  // This is necessary as changing the font/style/etc. can change the left bearing,
  // which requires shifting the word left/right to maintain the same visual position.
  wordI.x(wordI.visualLeft - leftSideBearing);

  wordI.scaleX(1);

  wordI.fontSize = fontSize;
  wordI.show();

  layerText.draw();
}

export class KonvaWord extends Konva.Shape {
  /**
   *
   * @param {Object} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.topBaseline
   * @param {Array<string>} options.charArr
   * @param {number} options.fontSize
   * @param {string} options.fontStyle
   * @param {string} options.fill
   * @param {Array<number>} options.advanceArrTotal
   * @param {string} options.fontFaceName
   * @param {number} options.charSpacing
   * @param {import('../objects/ocrObjects.js').OcrWord} options.word
   * @param {number} options.rotation
   * @param {number} options.opacity
   * @param {string} options.fontStyleLookup
   * @param {string} options.fontFamilyLookup
   * @param {number} options.visualLeft
   * @param {boolean} options.outline
   * @param {boolean} options.fillBox
   */
  constructor({
    x, y, topBaseline, charArr, fontSize, fontStyle, fill, advanceArrTotal, fontFaceName, charSpacing, word, rotation,
    opacity, fontStyleLookup, fontFamilyLookup, visualLeft, outline, fillBox,
  }) {
    super({
      x,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      y: y - fontSize * 0.6,
      width: advanceArrTotal.reduce((a, b) => a + b, 0),
      height: fontSize * 0.6,
      rotation,
      opacity,
      fill,
      sceneFunc: (context, shape) => {
        context.font = `${shape.fontStyle} ${shape.fontSize}px ${shape.fontFaceName}`;
        context.textBaseline = 'alphabetic';
        context.fillStyle = shape.fill();

        shape.setAttr('y', shape.yActual - shape.fontSize * 0.6);

        let leftI = 0;
        for (let i = 0; i < shape.charArr.length; i++) {
          const charI = shape.charArr[i];
          context.fillText(charI, leftI, shape.fontSize * 0.6);

          leftI += shape.advanceArrTotal[i];
        }

        if (shape.outline) {
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.fillBox) {
          context.fillStyle = '#4278f550';
          context.fillRect(0, 0, shape.width(), shape.height());
        }
      },

      hitFunc: (context, shape) => {
        context.beginPath();
        context.rect(0, 0, shape.width(), shape.height());
        context.closePath();
        context.fillStrokeShape(shape);
      },
    });

    this.word = word;
    this.charArr = charArr;
    this.charSpacing = charSpacing;
    this.advanceArrTotal = advanceArrTotal;
    this.fontSize = fontSize;
    // `yActual` contains the y value that we want to draw the text at, which is usually the baseline.
    this.yActual = y;
    this.fontFaceName = fontFaceName;
    this.fontStyle = fontStyle;
    this.lastX = x;
    this.lastWidth = this.width();
    this.fontStyleLookup = fontStyleLookup;
    this.fontFamilyLookup = fontFamilyLookup;
    this.visualLeft = visualLeft;
    this.outline = outline;
    this.fillBox = fillBox;
    this.baselineAdj = 0;
    this.topBaseline = topBaseline;
    this.topBaselineOrig = topBaseline;

    this.addEventListener('click', () => {
      KonvaWord.addControls(this);
      KonvaWord.updateUI();
    });

    this.addEventListener('dblclick', () => {
      KonvaWord.addTextInput(this);
      KonvaWord.updateUI();
    });

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
        this.visualLeft += leftDelta;
      } else {
        this.word.bbox.right += widthDelta;
      }

      updateWordCanvas(this);
    });
  }

  /**
   * Update the UI to reflect the properties of the word(s) in `canvasObj.selectedWordArr`.
   * This should be called when any word is selected, after adding them to `canvasObj.selectedWordArr`.
   */
  static updateUI = () => {
    const wordFirst = canvasObj.selectedWordArr[0];

    if (!wordFirst) return;

    wordFontElem.value = wordFirst.fontFamilyLookup;
    fontSizeElem.value = String(wordFirst.fontSize);

    if (wordFirst.word.sup !== styleSuperElem.classList.contains('active')) {
      styleSuperButton.toggle();
    }
    const italic = wordFirst.fontStyleLookup === 'italic';
    if (italic !== styleItalicElem.classList.contains('active')) {
      styleItalicButton.toggle();
    }
    const smallCaps = wordFirst.fontStyleLookup === 'small-caps';
    if (smallCaps !== styleSmallCapsElem.classList.contains('active')) {
      styleSmallCapsButton.toggle();
    }
  };

  /**
   * Position and show the input for editing.
   * @param {KonvaWord} textNode
   */
  static addTextInput = (textNode) => {
    const pointerCoordsRel = layerText.getRelativePointerPosition();
    let letterIndex = 0;
    let leftI = textNode.x();
    for (let i = 0; i < textNode.charArr.length; i++) {
      // For most letters, the letter is selected if the pointer is in the left 75% of the letter.
      // This is a compromise, as setting to 50% would be unintuitive for users trying to select the letter they want to edit,
      // and setting to 100% would be unintuitive for users trying to position the cursor between letters.
      // The exception is for the last letter, where the letter is selected if the pointer is in the left 50% of the letter.
      // This is because using the 75% rule would make it extremely difficult to select the end of the word.
      const cutOffPer = i + 1 === textNode.charArr.length ? 0.5 : 0.75;
      const cutOff = leftI + textNode.advanceArrTotal[i] * cutOffPer;
      if (pointerCoordsRel?.x && cutOff > pointerCoordsRel.x) break;
      letterIndex++;
      leftI += textNode.advanceArrTotal[i];
    }

    if (canvasObj.input && canvasObj.input.parentElement && canvasObj.inputRemove) canvasObj.inputRemove();

    canvasObj.input = document.createElement('span');

    const text = textNode.charArr.join('');

    const scale = layerText.scaleY();

    const charSpacingHTML = textNode.charSpacing * scale;

    const { x: x1, y: y1 } = textNode.getAbsolutePosition();

    const fontSizeHTML = textNode.fontSize * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.font = `${textNode.fontStyle} ${fontSizeHTML}px ${textNode.fontFaceName}`;
    const metrics = ctx.measureText(text);

    canvasObj.input.style.position = 'absolute';
    canvasObj.input.style.left = `${x1}px`;
    canvasObj.input.style.top = `${y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6}px`; // Align with baseline
    canvasObj.input.style.fontSize = `${fontSizeHTML}px`;
    canvasObj.input.style.fontFamily = textNode.fontFaceName;
    canvasObj.input.textContent = text;
    canvasObj.input.style.letterSpacing = `${charSpacingHTML}px`;
    canvasObj.input.style.color = textNode.fill();
    canvasObj.input.style.opacity = String(textNode.opacity());
    canvasObj.input.style.fontStyle = textNode.fontStyle;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    canvasObj.input.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;
    canvasObj.input.contentEditable = 'true';

    // Prevent line breaks and hide overflow
    canvasObj.input.style.whiteSpace = 'nowrap';
    // canvasObj.input.style.overflow = 'hidden';

    canvasObj.inputRemove = () => {
      textNode.word.text = ocr.replaceLigatures(canvasObj.input.textContent);
      canvasObj.input.remove();
      canvasObj.input = null;
      updateWordCanvas(textNode);
    };

    // Update the Konva Text node after editing
    canvasObj.input.addEventListener('blur', () => (canvasObj.inputRemove));

    document.body.appendChild(canvasObj.input);

    canvasObj.input.focus();

    // Set the cursor to the correct position
    const range = document.createRange();
    const sel = /** @type {Selection} */ (window.getSelection());

    range.setStart(canvasObj.input.childNodes[0], letterIndex);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);

    textNode.hide();
    layerText.draw();
  };

  /**
   * Add controls for editing.
   * @param {KonvaWord} textNode
   */
  static addControls = (textNode) => {
    destroyControls();
    canvasObj.selectedWordArr.length = 0;
    canvasObj.selectedWordArr.push(textNode);
    const trans = new Konva.Transformer({
      enabledAnchors: ['middle-left', 'middle-right'],
      rotateEnabled: false,
    });
    addControl(trans);
    layerText.add(trans);

    trans.nodes([textNode]);
  };
}

const trans = new Konva.Transformer({
  enabledAnchors: ['middle-left', 'middle-right'],
  rotateEnabled: false,
});
layerText.add(trans);

function selectObjectsRect(box) {
  const shapes = getCanvasWords();

  canvasObj.selectedWordArr.length = 0;
  canvasObj.selectedWordArr.push(...shapes.filter((shape) => Konva.Util.haveIntersection(box, shape.getClientRect())));

  canvasObj.selectedWordArr.forEach((shape) => {
    const rect = new Konva.Rect({
      x: shape.x(),
      y: shape.y(),
      width: shape.width(),
      height: shape.height(),
      stroke: 'rgba(40,123,181,1)',
      visible: true,
      // disable events to not interrupt with events
      listening: false,
    });
    layerText.add(rect);
    canvasObj.controlArr.push(rect);
  });
}

let clearSelectionStart = false;

stage.on('mousedown touchstart', (e) => {
  // do nothing if we mousedown on any shape
  // if (e.target !== stage) {
  //   return;
  // }

  clearSelectionStart = e.target instanceof Konva.Stage || e.target instanceof Konva.Image;

  // Move selection rectangle to top.
  selectingRectangle.zIndex(layerText.children.length - 1);

  e.evt.preventDefault();
  const startCoords = layerText.getRelativePointerPosition() || { x: 0, y: 0 };
  canvasObj.bbox.left = startCoords.x;
  canvasObj.bbox.top = startCoords.y;
  canvasObj.bbox.right = startCoords.x;
  canvasObj.bbox.bottom = startCoords.y;

  selectingRectangle.width(0);
  selectingRectangle.height(0);
  canvasObj.selecting = true;
});

stage.on('mousemove touchmove', (e) => {
  // do nothing if we didn't start selection
  if (!canvasObj.selecting) {
    return;
  }
  e.evt.preventDefault();
  const endCoords = layerText.getRelativePointerPosition();
  if (!endCoords) return;

  canvasObj.bbox.right = endCoords.x;
  canvasObj.bbox.bottom = endCoords.y;

  selectingRectangle.setAttrs({
    visible: true,
    x: Math.min(canvasObj.bbox.left, canvasObj.bbox.right),
    y: Math.min(canvasObj.bbox.top, canvasObj.bbox.bottom),
    width: Math.abs(canvasObj.bbox.right - canvasObj.bbox.left),
    height: Math.abs(canvasObj.bbox.bottom - canvasObj.bbox.top),
  });

  layerText.batchDraw();
});

stage.on('mouseup touchend', (e) => {
  // Delete any current selections if either (1) this is a new selection or (2) nothing is being clicked.
  // Clicks must pass this check on both start and end.
  // This prevents accidentally clearing a selection when the user is trying to highlight specific letters, but the mouse up happens over another word.
  if (clearSelectionStart && (canvasObj.selecting || e.target instanceof Konva.Stage || e.target instanceof Konva.Image)) destroyControls();

  // do nothing if we didn't start selection
  canvasObj.selecting = false;
  if (!selectingRectangle.visible()) {
    return;
  }

  e.evt.preventDefault();
  // update visibility in timeout, so we can check it in click event
  selectingRectangle.visible(false);

  if (canvasObj.mode === 'select') {
    const box = selectingRectangle.getClientRect();
    selectObjectsRect(box);
    KonvaWord.updateUI();
  } else if (canvasObj.mode === 'addWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    addWordManual(box);
  } else if (canvasObj.mode === 'recognizeWord') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, true, false);
  } else if (canvasObj.mode === 'recognizeArea') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, false);
  } else if (canvasObj.mode === 'printCoords') {
    const box = selectingRectangle.getClientRect({ relativeTo: layerText });
    recognizeArea(box, false, true);
  }

  canvasObj.mode = 'select';

  layerText.batchDraw();
});

// Function to handle wheel event
/**
 * Handles the wheel event to scroll the layer vertically.
 * @param {import('../../lib/konva/Node.js').KonvaEventObject<WheelEvent>} event - The wheel event from the user's mouse.
 */
const handleWheel = (event, layer) => {
  event.evt.preventDefault();

  if (event.evt.ctrlKey) { // Zoom in or out
    const scaleBy = event.evt.deltaY > 0 ? 0.9 : 1.1;

    zoomLayer(layer, scaleBy, false);
    destroyControls();
  } else { // Scroll vertically
    destroyControls();
    const newY = layer.y() - event.evt.deltaY;
    layer.y(newY);
    layer.batchDraw();
  }
};

const getLayerCenter = (layer) => {
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

const zoomLayer = (layer, scaleBy, centerMode = false) => {
  const oldScale = layer.scaleX();
  const pointer = centerMode ? getLayerCenter(layer) : stage.getPointerPosition();

  const mousePointTo = {
    x: (pointer.x - layer.x()) / oldScale,
    y: (pointer.y - layer.y()) / oldScale,
  };

  const newScale = oldScale * scaleBy;

  layer.scaleX(newScale);
  layer.scaleY(newScale);

  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };

  layer.position(newPos);
  layer.batchDraw();
};

// Listen for wheel events on the stage
stage.on('wheel', (event) => {
  handleWheel(event, layerText);
  handleWheel(event, layerBackground);
  handleWheel(event, layerOverlay);
});
// Variables to track dragging
let isDragging = false;
let lastX = 0;
let lastY = 0;

/**
 * Initiates dragging if the middle mouse button is pressed.
 * @param {MouseEvent} event - The mouse down event.
 */
const startDrag = (event) => {
  if (event.evt.button === 1) { // Middle mouse button
    isDragging = true;
    lastX = event.evt.x;
    lastY = event.evt.y;
    event.evt.preventDefault();
  }
};

// Function to execute during dragging
/**
 * Updates the layer's position based on mouse movement.
 * @param {MouseEvent} event - The mouse move event.
 */
const executeDrag = (event) => {
  if (isDragging) {
    const deltaX = event.evt.x - lastX;
    const deltaY = event.evt.y - lastY;
    lastX = event.evt.x;
    lastY = event.evt.y;

    // Both layers need to be adjusted in a single function call,
    // as `lastX` and `lastY` are updated in this function.
    layerText.x(layerText.x() + deltaX);
    layerText.y(layerText.y() + deltaY);
    layerBackground.x(layerBackground.x() + deltaX);
    layerBackground.y(layerBackground.y() + deltaY);
    layerOverlay.x(layerOverlay.x() + deltaX);
    layerOverlay.y(layerOverlay.y() + deltaY);

    layerText.batchDraw();
    layerBackground.batchDraw();
    layerOverlay.batchDraw();
  }
};

// Function to stop dragging
/**
 * Stops dragging when the mouse button is released.
 * @param {MouseEvent} event - The mouse up event.
 */
const stopDrag = (event) => {
  if (event.evt.button === 1) { // Middle mouse button
    isDragging = false;
  }
};

// Event listeners for mouse interactions
stage.on('mousedown', startDrag);
stage.on('mousemove', executeDrag);
stage.on('mouseup', stopDrag);

/**
 * Adjusts the layer's scale based on key press combinations for zooming in and out.
 * @param {KeyboardEvent} event - The key down event.
 */
const handleZoom = (event) => {
  if (event.ctrlKey) {
    if (['+', '='].includes(event.key)) {
      zoomLayer(layerText, 1.1, true);
      zoomLayer(layerBackground, 1.1, true);
      zoomLayer(layerOverlay, 1.1, true);
    } else if (['-', '_'].includes(event.key)) {
      zoomLayer(layerText, 0.9, true);
      zoomLayer(layerBackground, 0.9, true);
      zoomLayer(layerOverlay, 0.9, true);
    } else {
      return; // Ignore other keys
    }

    layerText.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
    event.stopPropagation();
  }
};

document.addEventListener('keydown', handleZoom);

zoomInElem.addEventListener('click', () => {
  zoomLayer(layerText, 1.1, true);
  zoomLayer(layerBackground, 1.1, true);
  zoomLayer(layerOverlay, 1.1, true);
});

zoomOutElem.addEventListener('click', () => {
  zoomLayer(layerText, 0.9, true);
  zoomLayer(layerBackground, 0.9, true);
  zoomLayer(layerOverlay, 0.9, true);
});

/**
 *
 * @returns {Array<KonvaWord>}
 */
export const getCanvasWords = () => layerText.children.filter((obj) => obj instanceof KonvaWord);

export const destroyWords = () => {
  // Any time words are destroyed, controls must be destroyed as well.
  // If this does not happen controls will have references to destroyed words, which causes errors to be thrown.
  destroyControls();

  getCanvasWords().forEach((obj) => obj.destroy());

  destroyLineOutlines();
};

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

export {
  stage, layerText, layerBackground, layerOverlay,
};
