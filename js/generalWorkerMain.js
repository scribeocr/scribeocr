export async function initGeneralWorker() {
  return new Promise((resolve, reject) => {
    const obj = {};

    const url = new URL('./worker/generalWorker.js', import.meta.url);
    const worker = new Worker(url, { type: 'module' });

    worker.onerror = (err) => {
      console.error(err);
    };
    worker.promises = {};
    worker.promiseId = 0;

    const ready = new Promise((resolve, reject) => {
      worker.promises[0] = { resolve, reject, func: 'ready' };
    });

    worker.onmessage = async function (event) {
      worker.promises[event.data.id].resolve(event.data.data);
    };

    function wrap(func) {
      return function (...args) {
        return new Promise((resolve, reject) => {
          const id = worker.promiseId++;
          worker.promises[id] = { resolve, reject, func };
          worker.postMessage([func, args[0], id]);
        });
      };
    }

    function wrap2(func) {
      return function (...args) {
        const id = worker.promiseId++;
        const promiseB = new Promise((resolve, reject) => {
          worker.promises[`${id}b`] = { resolve, reject, func };
        });

        const promiseA = new Promise((resolve, reject) => {
          worker.promises[id] = { resolve, reject, func };
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
    obj.compareHOCR = wrap('compareHOCR');
    obj.nudgePageFontSize = wrap('nudgePageFontSize');
    obj.nudgePageBaseline = wrap('nudgePageBaseline');

    obj.reinitialize = wrap('reinitialize');
    obj.recognize = wrap('recognize');
    obj.recognizeAndConvert = wrap('recognizeAndConvert');
    obj.recognizeAndConvert2 = wrap2('recognizeAndConvert2');

    obj.loadFontContainerAllWorker = wrap('loadFontContainerAllWorker');
    obj.setFontActiveWorker = wrap('setFontActiveWorker');
    obj.setGlobalSettings = wrap('setGlobalSettings');

    obj.terminate = () => worker.terminate();

    ready.then(() => resolve(obj));
  });
}

export class GeneralScheduler {
  constructor(scheduler) {
    this.scheduler = scheduler;
    /**
     * @param {Parameters<typeof import('./worker/compareOCRModule.js').compareHOCR>[0]} args
     * @returns {ReturnType<typeof import('./worker/compareOCRModule.js').compareHOCR>}
     */
    this.compareHOCR = async (args) => (await this.scheduler.addJob('compareHOCR', args));
    /**
     * @param {Parameters<typeof import('./worker/optimizeFontModule.js').optimizeFont>[0]} args
     * @returns {ReturnType<typeof import('./worker/optimizeFontModule.js').optimizeFont>}
     */
    this.optimizeFont = async (args) => (await this.scheduler.addJob('optimizeFont', args));
    /**
     * @param {Parameters<typeof import('./worker/generalWorker.js').recognize>[0]} args
     * @returns {ReturnType<typeof import('./worker/generalWorker.js').recognize>}
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
