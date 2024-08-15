const PI_OVER_180 = Math.PI / 180;
function detectBrowser() {
    return (typeof window !== 'undefined' &&
        ({}.toString.call(window) === '[object Window]' ||
            {}.toString.call(window) === '[object global]'));
}
export const glob = typeof global !== 'undefined'
    ? global
    : typeof window !== 'undefined'
        ? window
        : typeof WorkerGlobalScope !== 'undefined'
            ? self
            : {};
export const Konva = {
    _global: glob,
    version: '9.3.6',
    isBrowser: detectBrowser(),
    isUnminified: /param/.test(function (param) { }.toString()),
    dblClickWindow: 400,
    getAngle(angle) {
        return Konva.angleDeg ? angle * PI_OVER_180 : angle;
    },
    enableTrace: false,
    pointerEventsEnabled: true,
    autoDrawEnabled: true,
    hitOnDragEnabled: false,
    capturePointerEventsEnabled: false,
    _mouseListenClick: false,
    _touchListenClick: false,
    _pointerListenClick: false,
    _mouseInDblClickWindow: false,
    _touchInDblClickWindow: false,
    _pointerInDblClickWindow: false,
    _mouseDblClickPointerId: null,
    _touchDblClickPointerId: null,
    _pointerDblClickPointerId: null,
    pixelRatio: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
    dragDistance: 3,
    angleDeg: true,
    showWarnings: true,
    dragButtons: [0, 1],
    isDragging() {
        return Konva['DD'].isDragging;
    },
    isTransforming() {
        var _a;
        return (_a = Konva['Transformer']) === null || _a === void 0 ? void 0 : _a.isTransforming();
    },
    isDragReady() {
        return !!Konva['DD'].node;
    },
    releaseCanvasOnDestroy: true,
    document: glob.document,
    _injectGlobal(Konva) {
        glob.Konva = Konva;
    },
};
export const _registerNode = (NodeClass) => {
    Konva[NodeClass.prototype.getClassName()] = NodeClass;
};
Konva._injectGlobal(Konva);
