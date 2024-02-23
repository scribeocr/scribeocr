import { loadFontContainerAllRaw, optimizeFontContainerAll } from './objects/fontObjects.js';

const fontPrivate = loadFontContainerAllRaw();

/**
 * @this {{[key: string]: ?FontContainerAll}}
 */
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

let loadedRaw = false;
let loadedOpt = false;

/**
 *
 * @param {*} scheduler
 * @param {Object<string, ?FontContainerAll>} fontAll
 */
export async function setFontAllWorker(scheduler, fontAll) {
  if (!fontAll.active) return;

  // const opt = !(typeof fontAll.active.Carlito.normal.src == 'string');
  const { opt } = fontAll.active.Carlito.normal;

  const alreadyLoaded = (!opt && loadedRaw) || (opt && loadedOpt);

  // If the active font data is not already loaded, load it now.
  // This assumes that only one version of the raw/optimized fonts ever exist--
  // it does not check whether the current optimized font changed since it was last loaded.
  if (!alreadyLoaded) {
    const resArr = [];
    for (let i = 0; i < scheduler.workers.length; i++) {
      const worker = scheduler.workers[i];
      const res = worker.loadFontContainerAllWorker({
        src: {
          Carlito: { normal: fontAll.active.Carlito.normal.src, italic: fontAll.active.Carlito.italic.src, smallCaps: fontAll.active.Carlito['small-caps'].src },
          Century: { normal: fontAll.active.Century.normal.src, italic: fontAll.active.Century.italic.src, smallCaps: fontAll.active.Century['small-caps'].src },
          Garamond: { normal: fontAll.active.Garamond.normal.src, italic: fontAll.active.Garamond.italic.src, smallCaps: fontAll.active.Garamond['small-caps'].src },
          Palatino: { normal: fontAll.active.Palatino.normal.src, italic: fontAll.active.Palatino.italic.src, smallCaps: fontAll.active.Palatino['small-caps'].src },
          NimbusRomNo9L: { normal: fontAll.active.NimbusRomNo9L.normal.src, italic: fontAll.active.NimbusRomNo9L.italic.src, smallCaps: fontAll.active.NimbusRomNo9L['small-caps'].src },
          NimbusSans: { normal: fontAll.active.NimbusSans.normal.src, italic: fontAll.active.NimbusSans.italic.src, smallCaps: fontAll.active.NimbusSans['small-caps'].src },
        },
        opt,
      });
      resArr.push(res);
    }
    await Promise.all(resArr);

    // Theoretically this should be changed to use promises to avoid the race condition when `setFontAllWorker` is called multiple times quickly and `loadFontContainerAllWorker` is still running.
    if (opt) {
      loadedOpt = true;
    } else {
      loadedRaw = true;
    }
  }

  // Set the active font in the workers to match the active font in `fontAll`
  const resArr = [];
  for (let i = 0; i < scheduler.workers.length; i++) {
    const worker = scheduler.workers[i];
    const res = worker.setFontActiveWorker({ opt, fontFamilySans: fontAll.active.SansDefault.normal.family, fontFamilySerif: fontAll.active.SerifDefault.normal.family });
    resArr.push(res);
  }
  await Promise.all(resArr);
}
