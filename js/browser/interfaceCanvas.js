const resetCanvasEventListeners = () => {
  canvas.__eventListeners = {};

  canvas.on('mouse:wheel', (opt) => {
    const event = /** @type {WheelEvent} */ (opt.e);
    if (event.deltaX === 0 && event.deltaY === 0) return;

    // If the control key is being held, this is a zoom event.
    // In addition to being a standard control scheme, this is required to support laptop trackpads.
    // When a user pinches to zoom, browsers set the `ctrlKey` property to `true`, even when the control key is not being touched.
    const zoomEvent = event.ctrlKey;

    if (zoomEvent) {
      // Track pads report precise zoom values (many digits after the decimal) while mouses only move in fixed (integer) intervals.
      const trackPadMode = Math.round(event.deltaY) !== event.deltaY;

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
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;

      const pointer = canvas.getPointer(event, true);

      // Calculate the zoom point
      const zoomPoint = new fabric.Point(pointer.x, pointer.y);

      // Transform the view of the canvas to the zoom point
      canvas.zoomToPoint(zoomPoint, zoom);

    // Otherwise, this is a pan event.
    } else {
      const delta = new fabric.Point(-event.deltaX, -event.deltaY);
      canvas.relativePan(delta);
    }

    event.preventDefault();
    event.stopPropagation();
    canvas.renderAll();
  });

  // Variables to track the panning
  let allowPanning = false;
  let lastClientX = 0;
  let lastClientY = 0;

  // Event: Mouse down - check if middle button is pressed
  canvas.on('mouse:down:before', (opt) => {
    if (opt.e.button === 1) { // Middle mouse button
      allowPanning = true;
      lastClientX = opt.e.clientX;
      lastClientY = opt.e.clientY;
      opt.e.preventDefault();
      opt.e.stopPropagation();
    }
  });

  // Event: Mouse move - pan the canvas
  canvas.on('mouse:move', (opt) => {
    if (allowPanning) {
      const delta = new fabric.Point(opt.e.clientX - lastClientX, opt.e.clientY - lastClientY);
      canvas.relativePan(delta);

      opt.e.preventDefault();
      opt.e.stopPropagation();

      canvas.renderAll();

      lastClientX = opt.e.clientX;
      lastClientY = opt.e.clientY;
    }
  });

  // Event: Mouse up - stop panning
  canvas.on('mouse:up:before', (opt) => {
    allowPanning = false;
  });
};

// Filtering was throwing an error when GL was enabled
// May be worth investigating down the line as GL will be faster
fabric.enableGLFiltering = false;

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
const isTouchScreen = navigator?.maxTouchPoints > 0;
globalThis.touchScrollMode = true;

let allowPanning = false;
let isPanning = false;
let lastTouchX = 0;
let lastTouchY = 0;
let touchStartTarget;
let panDeltaTotal = 0;
let touchEventActive = false;

const defaultOnTouchStartHandler = fabric.Canvas.prototype._onTouchStart;
fabric.util.object.extend(fabric.Canvas.prototype, {
  _onTouchStart(e) {
    // For some reason, new touch events can be started even when the user has not lifted their finger.
    // These should be ignored by this condition.
    if (touchEventActive) return;

    touchEventActive = true;

    if (!isTouchScreen || !touchScrollMode) {
      defaultOnTouchStartHandler.call(this, e);
      return;
    }

    touchStartTarget = this.findTarget(e);
    // if allowTouchScrolling is enabled, no object was at the
    // the touch position and we're not in drawing mode, then
    // let the event skip the fabricjs canvas and do default
    // behavior

    const activeObjects = canvas.getActiveObjects();
    const editSelected = touchStartTarget && activeObjects.length === 1 && touchStartTarget?.wordID && touchStartTarget?.wordID === activeObjects[0]?.wordID;

    if (!editSelected) {
      canvas.discardActiveObject();
      canvas.renderAll();

      const touch = e.touches[0];

      // Under normal circumstances, the visualViewport should have no offset, as the application is designed to always take up 100% of the viewport.
      // A non-zero offset indicates the viewport has been offset to support a virtual keyboard.
      // Opening a virtual keyboard does not always offset a keyboard, however it will if the keyboard would obscure the text being edited.
      // Clicking out of a keyboard should not pan the page because (1) this is probably not intented and
      // (2) this can cause a massive/abrupt pan when the shift due to the keyboard being removed is included in `delta` and added to the pan.
      if (window.visualViewport.offsetTop < 100) allowPanning = true;
      isPanning = false;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      panDeltaTotal = 0;

      canvas.upperCanvasEl.addEventListener(
        'touchend',
        canvas._onTouchEnd,
        { passive: false },
      );

      // returning here should allow the event to propagate and be handled
      // normally by the browser
      return;
    }

    // otherwise call the default behavior
    defaultOnTouchStartHandler.call(this, e);
  },
});

const defaultOnTouchEndHandler = fabric.Canvas.prototype._onTouchEnd;

fabric.util.object.extend(fabric.Canvas.prototype, {
  _onTouchEnd(e) {
    // Allow for new touch event to begin.
    touchEventActive = false;
    if (isPanning) return;
    // If a user tapped on a word, and released the tap without panning, the word is selected.
    if (allowPanning && !isPanning && touchStartTarget) {
      canvas.setActiveObject(touchStartTarget);
      canvas.renderAll();
    }

    allowPanning = false;
    isPanning = false;
    defaultOnTouchEndHandler.call(this, e);
  },
});

const defaultOnDragHandler = fabric.Canvas.prototype._onDrag;

fabric.util.object.extend(fabric.Canvas.prototype, {
  _onDrag(e) {
    if (allowPanning) {
      if (e.touches && e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches[0];
        const delta = new fabric.Point(touch.clientX - lastTouchX, touch.clientY - lastTouchY);

        // For some reason, "drag" events can be triggered with no delta, or a delta that rounds down to 0.
        if (Math.round(delta.x) === 0 && Math.round(delta.y) === 0) return;

        // This is an imprecise heuristic, so not bothering to calculate distance properly.
        panDeltaTotal += Math.abs(delta.x);
        panDeltaTotal += Math.abs(delta.y);

        // Single taps may still trigger "drag" events.
        // Therefore, words can still be selected as long as the total amount dragged is low.
        if (panDeltaTotal > 10) isPanning = true;

        canvas.relativePan(delta);

        canvas.renderAll();

        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      } else {
        allowPanning = false;
      }
    }
  },
});

let zoomStartScale = 1;
fabric.util.object.extend(fabric.Canvas.prototype, {
  _onGesture(e, self) {
    if (e.touches && e.touches.length === 2) {
      if (self.state === 'start') {
        zoomStartScale = canvas.getZoom();
      }

      const point = new fabric.Point(self.x, self.y);

      const delta = zoomStartScale * self.scale;

      canvas.zoomToPoint(point, delta);

      canvas.renderAll();
    }
  },
});

// Define canvas
const canvas = new fabric.Canvas('c', {
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
  // This allows for scrolling on mobile devices
  allowTouchScrolling: true,
});

globalThis.ctx = canvas.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvas.overlayVpt = false;

// Disable "bring to front" on click
canvas.preserveObjectStacking = true;

// Turn off (some) automatic rendering of canvas
canvas.renderOnAddRemove = false;

// Disable uniform scaling (locked aspect ratio when scaling corner point of bounding box)
canvas.uniformScaling = false;

// Run once to add event listners (so zoom works)
resetCanvasEventListeners();

export { canvas, resetCanvasEventListeners };
