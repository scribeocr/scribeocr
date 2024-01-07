
const resetCanvasEventListeners = () => {
    canvas.__eventListeners = {};

    canvas.on('mouse:wheel', function (opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.01) zoom = 0.01;

        const pointer = canvas.getPointer(opt.e, true);

        // Calculate the zoom point
        const zoomPoint = new fabric.Point(pointer.x, pointer.y);

        // Transform the view of the canvas to the zoom point
        canvas.zoomToPoint(zoomPoint, zoom);

        opt.e.preventDefault();
        opt.e.stopPropagation();
        canvas.renderAll();
    });

    // Variables to track the panning
    let isPanning = false;
    let lastClientX = 0;
    let lastClientY = 0;

    // Event: Mouse down - check if middle button is pressed
    canvas.on('mouse:down:before', function (opt) {
        if (opt.e.button === 1) { // Middle mouse button
            isPanning = true;
            lastClientX = opt.e.clientX;
            lastClientY = opt.e.clientY;
            opt.e.preventDefault();
            opt.e.stopPropagation();
        }
    });

    // Event: Mouse move - pan the canvas
    canvas.on('mouse:move', function (opt) {
        if (isPanning) {
            let delta = new fabric.Point(opt.e.clientX - lastClientX, opt.e.clientY - lastClientY);
            canvas.relativePan(delta);

            opt.e.preventDefault();
            opt.e.stopPropagation();

            canvas.renderAll();

            lastClientX = opt.e.clientX;
            lastClientY = opt.e.clientY;
        }
    });

    // Event: Mouse up - stop panning
    canvas.on('mouse:up:before', function (opt) {
        isPanning = false;
    });

}

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
const isTouchScreen = navigator?.maxTouchPoints > 0 ? true : false;
globalThis.touchScrollMode = true;

let isPanning = false;
let lastTouchX = 0;
let lastTouchY = 0;

const defaultOnTouchStartHandler = fabric.Canvas.prototype._onTouchStart;
fabric.util.object.extend(fabric.Canvas.prototype, {
    _onTouchStart: function (e) {
        const target = this.findTarget(e);
        // if allowTouchScrolling is enabled, no object was at the
        // the touch position and we're not in drawing mode, then 
        // let the event skip the fabricjs canvas and do default
        // behavior
        if (!target && isTouchScreen && touchScrollMode) {

            canvas.discardActiveObject()
            canvas.renderAll();


            var touch = e.touches[0];
            isPanning = true;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;


            // returning here should allow the event to propagate and be handled
            // normally by the browser
            return;
        }

        // otherwise call the default behavior
        defaultOnTouchStartHandler.call(this, e);
    }
});

const defaultOnTouchEndHandler = fabric.Canvas.prototype._onTouchEnd;

fabric.util.object.extend(fabric.Canvas.prototype, {
    _onTouchEnd: function (e) {
        isPanning = false;
        defaultOnTouchEndHandler.call(this, e);
    }
});

const defaultOnDragHandler = fabric.Canvas.prototype._onDrag;

fabric.util.object.extend(fabric.Canvas.prototype, {
    _onDrag: function (e) {
        if (isPanning) {
            if (e.touches && e.touches.length == 1) {
                const touch = e.touches[0];
                const delta = new fabric.Point(touch.clientX - lastTouchX, touch.clientY - lastTouchY);
                canvas.relativePan(delta);

                e.preventDefault();
                e.stopPropagation();

                canvas.renderAll();


                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
            } else {
                isPanning = false;
            }
        }
    }
});

let zoomStartScale = 1;
fabric.util.object.extend(fabric.Canvas.prototype, {
    _onGesture: function (e, self) {

        if (e.touches && e.touches.length == 2) {

            if (self.state == "start") {
                zoomStartScale = canvas.getZoom();
            }

            const point = new fabric.Point(self.x, self.y);

            const delta = zoomStartScale * self.scale;

            canvas.zoomToPoint(point, delta);

            canvas.renderAll();

        }

    }
});



// Define canvas
const canvas = new fabric.Canvas('c', {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
    // This allows for scrolling on mobile devices
    allowTouchScrolling: true
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


const canvasDebug = new fabric.Canvas('g');
globalThis.ctxDebug = canvasDebug.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvasDebug.overlayVpt = false;

// Turn off (some) automatic rendering of canvas
canvasDebug.renderOnAddRemove = false;


export { canvas, resetCanvasEventListeners, canvasDebug }