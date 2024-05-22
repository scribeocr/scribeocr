import { Konva as Global } from './Global.js';
import { Util, Transform } from './Util.js';
import { Node } from './Node.js';
import { Container } from './Container.js';
import { Stage, stages } from './Stage.js';
import { Layer } from './Layer.js';
import { FastLayer } from './FastLayer.js';
import { Group } from './Group.js';
import { DD } from './DragAndDrop.js';
import { Shape, shapes } from './Shape.js';
import { Context } from './Context.js';
import { Canvas } from './Canvas.js';
export const Konva = Util._assign(Global, {
    Util,
    Transform,
    Node,
    Container,
    Stage,
    stages,
    Layer,
    FastLayer,
    Group,
    DD,
    Shape,
    shapes,
    Animation,
    Context,
    Canvas,
});
export default Konva;
