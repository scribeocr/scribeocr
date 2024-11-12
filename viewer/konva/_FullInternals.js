import { Konva as Core } from './_CoreInternals.js';
import { Image } from './shapes/Image.js';
import { Line } from './shapes/Line.js';
import { Rect } from './shapes/Rect.js';
import { Text } from './shapes/Text.js';
import { Transformer } from './shapes/Transformer.js';
export const Konva = Core.Util._assign(Core, {
    Image,
    Line,
    Rect,
    Text,
    Transformer,
});
