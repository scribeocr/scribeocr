import { Image } from './shapes/Image.js';
import { Line } from './shapes/Line.js';
import { Rect } from './shapes/Rect.js';
import { Text } from './shapes/Text.js';
import { Transformer } from './shapes/Transformer.js';
export declare const Konva: {
    _global: any;
    version: string;
    isBrowser: boolean;
    isUnminified: boolean;
    dblClickWindow: number;
    getAngle(angle: number): number;
    enableTrace: boolean;
    pointerEventsEnabled: boolean;
    autoDrawEnabled: boolean;
    hitOnDragEnabled: boolean;
    capturePointerEventsEnabled: boolean;
    _mouseListenClick: boolean;
    _touchListenClick: boolean;
    _pointerListenClick: boolean;
    _mouseInDblClickWindow: boolean;
    _touchInDblClickWindow: boolean;
    _pointerInDblClickWindow: boolean;
    _mouseDblClickPointerId: null;
    _touchDblClickPointerId: null;
    _pointerDblClickPointerId: null;
    pixelRatio: number;
    dragDistance: number;
    angleDeg: boolean;
    showWarnings: boolean;
    dragButtons: number[];
    isDragging(): any;
    isTransforming(): any;
    isDragReady(): boolean;
    releaseCanvasOnDestroy: boolean;
    document: any;
    _injectGlobal(Konva: any): void;
} & {
    Util: {
        _isElement(obj: any): obj is Element;
        _isFunction(obj: any): boolean;
        _isPlainObject(obj: any): boolean;
        _isArray(obj: any): obj is any[];
        _isNumber(obj: any): obj is number;
        _isString(obj: any): obj is string;
        _isBoolean(obj: any): obj is boolean;
        isObject(val: any): val is Object;
        isValidSelector(selector: any): boolean;
        _sign(number: number): 1 | -1;
        requestAnimFrame(callback: Function): void;
        createCanvasElement(): HTMLCanvasElement;
        createImageElement(): HTMLImageElement;
        _isInDocument(el: any): boolean;
        _urlToImage(url: string, callback: Function): void;
        _rgbToHex(r: number, g: number, b: number): string;
        _hexToRgb(hex: string): import("./types.js").RGB;
        getRandomColor(): string;
        getRGB(color: string): import("./types.js").RGB;
        colorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _namedColorToRBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | null;
        _rgbColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _rgbaColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _hex8ColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _hex6ColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _hex4ColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _hex3ColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        _hslColorToRGBA(str: string): {
            r: number;
            g: number;
            b: number;
            a: number;
        } | undefined;
        haveIntersection(r1: import("./types").IRect, r2: import("./types.js").IRect): boolean;
        cloneObject<Any>(obj: Any): Any;
        cloneArray(arr: any[]): any[];
        degToRad(deg: number): number;
        radToDeg(rad: number): number;
        _degToRad(deg: number): number;
        _radToDeg(rad: number): number;
        _getRotation(radians: number): number;
        _capitalize(str: string): string;
        throw(str: string): never;
        error(str: string): void;
        warn(str: string): void;
        each(obj: Object, func: Function): void;
        _inRange(val: number, left: number, right: number): boolean;
        _getProjectionToSegment(x1: any, y1: any, x2: any, y2: any, x3: any, y3: any): any[];
        _getProjectionToLine(pt: import("./types").Vector2d, line: import("./types").Vector2d[], isClosed: boolean): import("./types.js").Vector2d;
        _prepareArrayForTween(startArray: any, endArray: any, isClosed: any): number[];
        _prepareToStringify<T>(obj: any): T | null;
        _assign<T_1, U>(target: T_1, source: U): T_1 & U;
        _getFirstPointerId(evt: any): any;
        releaseCanvas(...canvases: HTMLCanvasElement[]): void;
        drawRoundedRectPath(context: import("./Context.js").Context, width: number, height: number, cornerRadius: number | number[]): void;
    };
    Transform: typeof import("./Util.js").Transform;
    Node: typeof import("./Node.js").Node;
    Container: typeof import("./Container.js").Container;
    Stage: typeof import("./Stage.js").Stage;
    stages: import("./Stage.js").Stage[];
    Layer: typeof import("./Layer.js").Layer;
    FastLayer: typeof import("./FastLayer.js").FastLayer;
    Group: typeof import("./Group.js").Group;
    DD: {
        readonly isDragging: boolean;
        justDragged: boolean;
        readonly node: import("./Node").Node<import("./Node.js").NodeConfig> | undefined;
        _dragElements: Map<number, {
            node: import("./Node").Node<import("./Node.js").NodeConfig>;
            startPointerPos: import("./types.js").Vector2d;
            offset: import("./types.js").Vector2d;
            pointerId?: number | undefined;
            dragStatus: "stopped" | "ready" | "dragging";
        }>;
        _drag(evt: any): void;
        _endDragBefore(evt?: any): void;
        _endDragAfter(evt: any): void;
    };
    Shape: typeof import("./Shape.js").Shape;
    shapes: {
        [key: string]: import("./Shape").Shape<import("./Shape.js").ShapeConfig>;
    };
    Animation: {
        new (effect?: AnimationEffect | null | undefined, timeline?: AnimationTimeline | null | undefined): Animation;
        prototype: Animation;
    };
    Context: typeof import("./Context.js").Context;
    Canvas: typeof import("./Canvas.js").Canvas;
} & {
    Image: typeof Image;
    Line: typeof Line;
    Rect: typeof Rect;
    Text: typeof Text;
    Transformer: typeof Transformer;
};
