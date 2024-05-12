import Konva from '../../lib/konva.js';

const zoomInElem = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));
const zoomOutElem = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

const controlArr = [];

export const addControl = (transformer) => {
  controlArr.push(transformer);
};

export const destroyControls = () => {
  controlArr.forEach((control) => control.destroy());
  controlArr.length = 0;
};

const resetCanvasEventListeners = () => {
//   canvas.__eventListeners = {};

  //   canvas.on('mouse:wheel', (opt) => {
  //     const event = /** @type {WheelEvent} */ (opt.e);
  //     if (event.deltaX === 0 && event.deltaY === 0) return;

  //     // If the control key is being held, this is a zoom event.
  //     // In addition to being a standard control scheme, this is required to support laptop trackpads.
  //     // When a user pinches to zoom, browsers set the `ctrlKey` property to `true`, even when the control key is not being touched.
  //     const zoomEvent = event.ctrlKey;

  //     if (zoomEvent) {
  //       // Track pads report precise zoom values (many digits after the decimal) while mouses only move in fixed (integer) intervals.
  //       const trackPadMode = Math.round(event.deltaY) !== event.deltaY;

  //       let delta = event.deltaY;

  //       // If `deltaMode` is `1` (less common), units are in lines rather than pixels.
  //       if (event.deltaMode === 1) delta *= 10;

  //       // Zoom by a greater amount for track pads.
  //       // Without this code, zooming would be extremely slow.
  //       if (trackPadMode) {
  //         delta *= 7;
  //         // Cap at the equivalent of ~6 scrolls of a scroll wheel.
  //         delta = Math.min(600, Math.max(-720, delta));
  //       }
  //       let zoom = canvas.getZoom();
  //       zoom *= 0.999 ** delta;
  //       if (zoom > 20) zoom = 20;
  //       if (zoom < 0.01) zoom = 0.01;

  //       const pointer = canvas.getPointer(event, true);

  //       // Calculate the zoom point
  //       const zoomPoint = new fabric.Point(pointer.x, pointer.y);

  //       // Transform the view of the canvas to the zoom point
  //       canvas.zoomToPoint(zoomPoint, zoom);

  //     // Otherwise, this is a pan event.
  //     } else {
  //       const delta = new fabric.Point(-event.deltaX, -event.deltaY);
  //       canvas.relativePan(delta);
  //     }

  //     event.preventDefault();
  //     event.stopPropagation();
  //     canvas.renderAll();
  //   });

  //   // Variables to track the panning
  //   let allowPanning = false;
  //   let lastClientX = 0;
  //   let lastClientY = 0;

  //   // Event: Mouse down - check if middle button is pressed
  //   canvas.on('mouse:down:before', (opt) => {
  //     if (opt.e.button === 1) { // Middle mouse button
  //       allowPanning = true;
  //       lastClientX = opt.e.clientX;
  //       lastClientY = opt.e.clientY;
  //       opt.e.preventDefault();
  //       opt.e.stopPropagation();
  //     }
  //   });

  //   // Event: Mouse move - pan the canvas
  //   canvas.on('mouse:move', (opt) => {
  //     if (allowPanning) {
  //       const delta = new fabric.Point(opt.e.clientX - lastClientX, opt.e.clientY - lastClientY);
  //       canvas.relativePan(delta);

  //       opt.e.preventDefault();
  //       opt.e.stopPropagation();

  //       canvas.renderAll();

  //       lastClientX = opt.e.clientX;
  //       lastClientY = opt.e.clientY;
  //     }
  //   });

//   // Event: Mouse up - stop panning
//   canvas.on('mouse:up:before', (opt) => {
//     allowPanning = false;
//   });
};

// Filtering was throwing an error when GL was enabled
// May be worth investigating down the line as GL will be faster
// fabric.enableGLFiltering = false;

// On touchscreen devices, gestures may be used to either (1) attempt to scroll or (2) manipulate the canvas.
// Fabric.js does not handle this well out of the box, and simply disables all scrolling when touching the canvas.
// This means that if the user is ever fully zoomed in, they cannot "escape" and zoom out.
// This issue is solved here by intercepting the touch event, and deciding whether it should manipulate the canvas or not.
// The gesture is interpreted as interacting with the canvas if either (1) it is touching an object or
// (2) the variable `globalThis.touchScrollMode` is manually set to `false`.
// `globalThis.touchScrollMode` should be set to `false` whenever the user needs to interact with the canvas--
// for example, when selecting "Recognize Area", and restored to `true` afterwards.
// This code is based on this GitHub comment:
// https://github.com/fabricjs/fabric.js/issues/5903#issuecomment-699011321
// const isTouchScreen = navigator?.maxTouchPoints > 0;
// globalThis.touchScrollMode = true;

// const allowPanning = false;
// const isPanning = false;
// const lastTouchX = 0;
// const lastTouchY = 0;
// let touchStartTarget;
// const panDeltaTotal = 0;
// const touchEventActive = false;

// const defaultOnTouchStartHandler = fabric.Canvas.prototype._onTouchStart;
// fabric.util.object.extend(fabric.Canvas.prototype, {
//   _onTouchStart(e) {
//     // For some reason, new touch events can be started even when the user has not lifted their finger.
//     // These should be ignored by this condition.
//     if (touchEventActive) return;

//     touchEventActive = true;

//     if (!isTouchScreen || !touchScrollMode) {
//       defaultOnTouchStartHandler.call(this, e);
//       return;
//     }

//     touchStartTarget = this.findTarget(e);
//     // if allowTouchScrolling is enabled, no object was at the
//     // the touch position and we're not in drawing mode, then
//     // let the event skip the fabricjs canvas and do default
//     // behavior

//     const activeObjects = canvas.getActiveObjects();
//     const editSelected = touchStartTarget && activeObjects.length === 1 && touchStartTarget?.word && touchStartTarget?.word?.id === activeObjects[0]?.word?.id;

//     if (!editSelected) {
//       canvas.discardActiveObject();
//       canvas.renderAll();

//       const touch = e.touches[0];

//       // Under normal circumstances, the visualViewport should have no offset, as the application is designed to always take up 100% of the viewport.
//       // A non-zero offset indicates the viewport has been offset to support a virtual keyboard.
//       // Opening a virtual keyboard does not always offset a keyboard, however it will if the keyboard would obscure the text being edited.
//       // Clicking out of a keyboard should not pan the page because (1) this is probably not intented and
//       // (2) this can cause a massive/abrupt pan when the shift due to the keyboard being removed is included in `delta` and added to the pan.
//       if (window.visualViewport.offsetTop < 100) allowPanning = true;
//       isPanning = false;
//       lastTouchX = touch.clientX;
//       lastTouchY = touch.clientY;
//       panDeltaTotal = 0;

//       canvas.upperCanvasEl.addEventListener(
//         'touchend',
//         canvas._onTouchEnd,
//         { passive: false },
//       );

//       // returning here should allow the event to propagate and be handled
//       // normally by the browser
//       return;
//     }

//     // otherwise call the default behavior
//     defaultOnTouchStartHandler.call(this, e);
//   },
// });

// const defaultOnTouchEndHandler = fabric.Canvas.prototype._onTouchEnd;

// fabric.util.object.extend(fabric.Canvas.prototype, {
//   _onTouchEnd(e) {
//     // Allow for new touch event to begin.
//     touchEventActive = false;
//     if (isPanning) return;
//     // If a user tapped on a word, and released the tap without panning, the word is selected.
//     if (allowPanning && !isPanning && touchStartTarget) {
//       canvas.setActiveObject(touchStartTarget);
//       canvas.renderAll();
//     }

//     allowPanning = false;
//     isPanning = false;
//     defaultOnTouchEndHandler.call(this, e);
//   },
// });

// const defaultOnDragHandler = fabric.Canvas.prototype._onDrag;

// fabric.util.object.extend(fabric.Canvas.prototype, {
//   _onDrag(e) {
//     if (allowPanning) {
//       if (e.touches && e.touches.length === 1) {
//         e.preventDefault();
//         e.stopPropagation();

//         const touch = e.touches[0];
//         const delta = new fabric.Point(touch.clientX - lastTouchX, touch.clientY - lastTouchY);

//         // For some reason, "drag" events can be triggered with no delta, or a delta that rounds down to 0.
//         if (Math.round(delta.x) === 0 && Math.round(delta.y) === 0) return;

//         // This is an imprecise heuristic, so not bothering to calculate distance properly.
//         panDeltaTotal += Math.abs(delta.x);
//         panDeltaTotal += Math.abs(delta.y);

//         // Single taps may still trigger "drag" events.
//         // Therefore, words can still be selected as long as the total amount dragged is low.
//         if (panDeltaTotal > 10) isPanning = true;

//         canvas.relativePan(delta);

//         canvas.renderAll();

//         lastTouchX = touch.clientX;
//         lastTouchY = touch.clientY;
//       } else {
//         allowPanning = false;
//       }
//     }
//   },
// });

// let zoomStartScale = 1;
// fabric.util.object.extend(fabric.Canvas.prototype, {
//   _onGesture(e, self) {
//     if (e.touches && e.touches.length === 2) {
//       if (self.state === 'start') {
//         zoomStartScale = canvas.getZoom();
//       }

//       const point = new fabric.Point(self.x, self.y);

//       const delta = zoomStartScale * self.scale;

//       canvas.zoomToPoint(point, delta);

//       canvas.renderAll();
//     }
//   },
// });

// Define canvas
// const canvas = new fabric.Canvas('c', {
//   width: document.documentElement.clientWidth,
//   height: document.documentElement.clientHeight,
//   // This allows for scrolling on mobile devices
//   allowTouchScrolling: true,
// });

const stage = new Konva.Stage({
  container: 'c',
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

const layerBackground = new Konva.Layer();
const layerText = new Konva.Layer();

stage.add(layerBackground);
stage.add(layerText);

// Function to handle wheel event
/**
 * Handles the wheel event to scroll the layer vertically.
 * @param {WheelEvent} event - The wheel event from the user's mouse.
 */
const handleWheel = (event, layer) => {
  event.evt.preventDefault();

  if (event.evt.ctrlKey) { // Zoom in or out
    const scaleBy = event.evt.deltaY > 0 ? 0.9 : 1.1;

    zoomLayer(layer, scaleBy, false);
  } else { // Scroll vertically
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
});
// Variables to track dragging
let isDragging = false;
let lastX = 0;
let lastY = 0;

// // Function to handle wheel event for vertical scrolling
// /**
//  * Handles the wheel event to scroll the layer vertically.
//  * @param {WheelEvent} event - The wheel event from the user's mouse.
//  */
// const handleWheel = (event) => {
//   event.evt.preventDefault();
//   const oldY = layer.y();
//   const newY = oldY + event.evt.deltaY;

//   layer.y(newY);
//   layer.batchDraw();
// };

// Function to start dragging
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

    layerText.batchDraw();
    layerBackground.batchDraw();
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
const handleZoom = (event, layer) => {
  if (event.ctrlKey) {
    switch (event.key) {
      case '+':
        layer.scaleX(layer.scaleX() * 1.1);
        layer.scaleY(layer.scaleY() * 1.1);
        break;
      case '-':
        layer.scaleX(layer.scaleX() * 0.9);
        layer.scaleY(layer.scaleY() * 0.9);
        break;
      default:
        return; // Ignore other keys
    }
    layer.batchDraw();
    event.preventDefault(); // Prevent the default action to avoid browser zoom
  }
};

document.addEventListener('keydown', (event) => {
  handleZoom(event, layerText);
  handleZoom(event, layerBackground);
});

// globalThis.ctx = canvas.getContext('2d');

// // Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
// canvas.overlayVpt = false;

// // Disable "bring to front" on click
// canvas.preserveObjectStacking = true;

// // Turn off (some) automatic rendering of canvas
// canvas.renderOnAddRemove = false;

// // Disable uniform scaling (locked aspect ratio when scaling corner point of bounding box)
// canvas.uniformScaling = false;

// Run once to add event listners (so zoom works)
resetCanvasEventListeners();

// Fabric.js has no keydown events, so they are added to the document.
// This allows for zooming in/out with these shortcuts, even if "focus" is not on the canvas.
// document.addEventListener('keydown', (event) => {
//   if (event.ctrlKey) {
//     if (['+', '='].includes(event.key)) {
//       // Zoom in by 10% on the center of the canvas.
//       const zoomPoint = new fabric.Point(canvas.width / 2, canvas.height / 2);
//       canvas.zoomToPoint(zoomPoint, canvas.getZoom() * 1.1);

//       event.preventDefault();
//       event.stopPropagation();
//       canvas.requestRenderAll();
//     } else if (['-', '_'].includes(event.key)) {
//       // Zoom out by 10% on the center of the canvas.
//       const zoomPoint = new fabric.Point(canvas.width / 2, canvas.height / 2);
//       canvas.zoomToPoint(zoomPoint, canvas.getZoom() / 1.1);

//       event.preventDefault();
//       event.stopPropagation();
//       canvas.requestRenderAll();
//     }
//   }
// });

zoomInElem.addEventListener('click', () => {
  zoomLayer(layerText, 1.1, true);
  zoomLayer(layerBackground, 1.1, true);
});

zoomOutElem.addEventListener('click', () => {
  zoomLayer(layerText, 0.9, true);
  zoomLayer(layerBackground, 0.9, true);
});

export {
  stage, layerText, layerBackground, resetCanvasEventListeners,
};
