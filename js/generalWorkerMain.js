import { gs } from './containers/schedulerContainer.js';

/**
 * Initializes a general worker and returns an object with methods controlled by the worker.
 * @returns {Promise} A promise that resolves to an object with control methods.
 */
export async function initGeneralWorker() {
  // Define `Worker` in Node.js version.
  const Worker = globalThis.Worker || (await import('web-worker')).default;
  return new Promise((resolve, reject) => {
    const obj = {};

    const url = new URL('./worker/generalWorker.js', import.meta.url);
    const worker = new Worker(url, { type: 'module' });

    worker.onerror = (err) => {
      console.error(err);
    };

    const workerPromises = {};
    let promiseId = 0;

    const ready = new Promise((innerResolve, innerReject) => {
      workerPromises['0'] = { resolve: innerResolve, reject: innerReject, func: 'ready' };
    });

    worker.onmessage = async (event) => {
      if (workerPromises[event.data.id]) {
        workerPromises[event.data.id].resolve(event.data.data);
      }
    };

    /**
       * Wraps a function to be called via worker messages.
       * @param {string} func The function name to call.
       * @returns {Function} A function that returns a promise resolving to the worker's response.
       */
    function wrap(func) {
      return function (...args) {
        return new Promise((innerResolve, innerReject) => {
          const id = promiseId++;
          workerPromises[id] = { resolve: innerResolve, reject: innerReject, func };
          worker.postMessage([func, args[0], id]);
        });
      };
    }

    /**
       * Similar to wrap, but handles two promises.
       * @param {string} func The function name to call.
       * @returns {Array} Returns two promises in an array.
       */
    function wrap2(func) {
      return function (...args) {
        const id = promiseId++;
        const promiseB = new Promise((innerResolve, innerReject) => {
          workerPromises[`${id}b`] = { resolve: innerResolve, reject: innerReject, func };
        });

        const promiseA = new Promise((innerResolve, innerReject) => {
          workerPromises[id] = { resolve: innerResolve, reject: innerReject, func };
          worker.postMessage([func, args[0], id]);
        });

        return [promiseA, promiseB];
      };
    }

    obj.convertPageHocr = wrap('convertPageHocr');
    obj.convertPageAbbyy = wrap('convertPageAbbyy');
    obj.convertPageStext = wrap('convertPageStext');

    obj.optimizeFont = wrap('optimizeFont');

    obj.evalPageFont = wrap('evalPageFont');
    obj.evalPage = wrap('evalPage');
    obj.evalWords = wrap('evalWords');
    obj.compareOCR = wrap('compareOCR');
    obj.nudgePageFontSize = wrap('nudgePageFontSize');
    obj.nudgePageBaseline = wrap('nudgePageBaseline');

    obj.reinitialize = wrap('reinitialize');
    obj.recognize = wrap('recognize');
    obj.recognizeAndConvert = wrap('recognizeAndConvert');
    obj.recognizeAndConvert2 = wrap2('recognizeAndConvert2');

    obj.loadFontsWorker = wrap('loadFontsWorker');
    obj.setFontActiveWorker = wrap('setFontActiveWorker');
    obj.setDefaultFontNameWorker = wrap('setDefaultFontNameWorker');

    obj.terminate = () => worker.terminate();

    ready.then(() => resolve(obj));
  });
}

export class GeneralScheduler {
  constructor(scheduler) {
    this.scheduler = scheduler;
    /**
     * @param {Parameters<typeof import('./worker/compareOCRModule.js').compareOCR>[0]} args
     * @returns {ReturnType<typeof import('./worker/compareOCRModule.js').compareOCR>}
     */
    this.compareOCR = async (args) => (await this.scheduler.addJob('compareOCR', args));
    /**
     * @param {Parameters<typeof import('./worker/optimizeFontModule.js').optimizeFont>[0]} args
     * @returns {ReturnType<typeof import('./worker/optimizeFontModule.js').optimizeFont>}
     */
    this.optimizeFont = async (args) => (await this.scheduler.addJob('optimizeFont', args));
    /**
    * @template {Partial<Tesseract.OutputFormats>} TO
    * @param {Object} args
    * @param {Parameters<Tesseract.Worker['recognize']>[0]} args.image
    * @param {Parameters<Tesseract.Worker['recognize']>[1]} args.options
    * @param {TO} args.output
    * @returns {Promise<Tesseract.Page<TO>>}
    * Exported for type inference purposes, should not be imported anywhere.
    */
    this.recognize = async (args) => (await this.scheduler.addJob('recognize', args));
    /**
     * @param {Parameters<typeof import('./worker/generalWorker.js').recognizeAndConvert>[0]} args
     * @returns {ReturnType<typeof import('./worker/generalWorker.js').recognizeAndConvert>}
     */
    this.recognizeAndConvert = async (args) => (await this.scheduler.addJob('recognizeAndConvert', args));
    /**
     * @param {Parameters<typeof import('./worker/generalWorker.js').recognizeAndConvert2>[0]} args
     * @returns {Promise<[ReturnType<typeof import('./worker/generalWorker.js').recognizeAndConvert>, ReturnType<typeof import('./worker/generalWorker.js').recognizeAndConvert>]>}
     */
    this.recognizeAndConvert2 = async (args) => (await this.scheduler.addJob('recognizeAndConvert2', args));
    /**
     * @param {Parameters<typeof import('./worker/compareOCRModule.js').evalPage>[0]} args
     * @returns {ReturnType<typeof import('./worker/compareOCRModule.js').evalPage>}
     */
    this.evalPage = async (args) => (await this.scheduler.addJob('evalPage', args));
    /**
     * @param {Parameters<typeof import('./worker/compareOCRModule.js').evalWords>[0]} args
     * @returns {ReturnType<typeof import('./worker/compareOCRModule.js').evalWords>}
     */
    this.evalWords = async (args) => (await this.scheduler.addJob('evalWords', args));
    /**
     * @param {Parameters<typeof import('./worker/compareOCRModule.js').evalPageFont>[0]} args
     * @returns {ReturnType<typeof import('./worker/compareOCRModule.js').evalPageFont>}
     */
    this.evalPageFont = async (args) => (await this.scheduler.addJob('evalPageFont', args));
  }
}

/**
   *
   * @param {Object} params
   * @param {boolean} [params.anyOk=false] - Is any Tesseract worker okay to use?
   *    If `true`, this function returns immediately if Tesseract workers are already loaded,
   *    without checking the particular language/oem settings.
   * @param {boolean} [params.vanillaMode=false] - Use vanilla Tesseract rather than Scribe OCR fork.
   * @param {string[]} [params.langs] - Array of language codes to load. If not provided, all languages are loaded.
   * @returns
   */
export const initTesseractInWorkers = async ({ anyOk = false, vanillaMode = false, langs = ['eng'] }) => {
  await gs.schedulerReady;

  if (anyOk && gs.schedulerReadyTesseract) return gs.schedulerReadyTesseract;

  gs.setSchedulerReadyTesseract();

  // Wait for the first worker to load.
  // A behavior (likely bug) was observed where, if the workers are loaded in parallel,
  // data will be loaded over network from all workers (rather than downloading once and caching).
  const worker0 = gs.schedulerInner.workers[0];
  await worker0.reinitialize({ langs, vanillaMode });

  if (gs.schedulerInner.workers.length > 0) {
    const resArr = gs.schedulerInner.workers.slice(1).map((x) => x.reinitialize({ langs, vanillaMode }));
    await Promise.allSettled(resArr);
  }
  // @ts-ignore
  gs.resReadyTesseract(true);
  return gs.schedulerReadyTesseract;
};

export async function initGeneralScheduler() {
  // Determine number of workers to use in the browser.
  // This is the minimum of:
  //      1. The number of cores
  //      3. 6 (browser-imposed memory limits make going higher than 6 problematic, even on hardware that could support it)
  // Node.js version only uses 1 worker.
  let workerN = 1;
  if (typeof process === 'undefined') {
    workerN = Math.min(Math.round((globalThis.navigator.hardwareConcurrency || 8) / 2), 6);
  }

  const Tesseract = typeof process === 'undefined' ? (await import('../tess/tesseract.esm.min.js')).default : await import('tesseract.js');

  gs.schedulerInner = await Tesseract.createScheduler();
  gs.schedulerInner.workers = new Array(workerN);

  gs.setSchedulerReadyLoadFonts();
  gs.setSchedulerReady();

  const addGeneralWorker = async (i) => {
    const w = await initGeneralWorker();
    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    gs.schedulerInner.addWorker(w);
    gs.schedulerInner.workers[i] = w;
  };

  // Wait for the first worker to load.
  // A behavior (likely bug) was observed where, if the workers are loaded in parallel,
  // data will be loaded over network from all workers (rather than downloading once and caching).
  await addGeneralWorker(0);

  const resArr = Array.from({ length: workerN }, (v, k) => k).slice(1).map((i) => addGeneralWorker(i));

  await Promise.all(resArr);

  gs.scheduler = new GeneralScheduler(gs.schedulerInner);

  // Fonts are only loaded in the browser.
  // The functions we would use fonts in a worker for also require node-canvas, which does not support workers yet.
  if (typeof process === 'undefined') {
    // @ts-ignore
    gs.resReadyLoadFonts(true);

    // Send raw fonts to workers after they have loaded in the main thread.
    await gs.fontAllRawReady;
  }

  // @ts-ignore
  gs.resReady(true);
}
