import { loadFontContainerAllRaw, optimizeFontContainerAll } from './objects/fontObjects.js';
import { setFontAllWorker } from './fontEval.js';

const fontPrivate = loadFontContainerAllRaw();

export const fontAll = {
  raw: fontPrivate,
  /** @type {?FontContainerAll} */
  opt: null,
  active: fontPrivate,
};

/**
 *
 * @param {boolean} enable
 */
export async function enableDisableFontOpt(enable) {
  const browserMode = typeof process === 'undefined';

  // Enable/disable optimized font
  if (enable && fontAll.opt) {
    fontAll.active = fontAll.opt;
  } else {
    fontAll.active = fontAll.raw;
  }

  // Enable/disable optimized font in workers
  if (browserMode) {
    await setFontAllWorker(globalThis.generalScheduler, fontAll);
  } else {
    const { setFontAll } = await import('./worker/compareOCRModule.js');
    setFontAll(fontAll);
  }
}
