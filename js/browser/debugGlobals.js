// This file adds various functions to a global object named `df` so they can be easily run from the console.
// This object should never be referenced in code--the functions should be imported instead.

import { fontAll } from '../containers/fontContainer.js';
import { calcLineFontSize } from '../fontUtils.js';
import { imageCache } from '../containers/imageContainer.js';
import { stage, layerText } from './interfaceCanvas.js';

// Expose functions in global object for debugging purposes.
export const df = {
  calcLineFontSize,
  fontAll,
  imageCache,
  stage,
  layerText,
};
