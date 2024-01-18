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
      worker.promises[event.data.id].resolve(event.data);
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
    obj.recognizeAndConvert2 = wrap('recognizeAndConvert2');

    obj.loadFontContainerAllWorker = wrap('loadFontContainerAllWorker');
    obj.setFontActiveWorker = wrap('setFontActiveWorker');
    obj.setGlobalSettings = wrap('setGlobalSettings');

    obj.terminate = () => worker.terminate();

    ready.then((x) => resolve(obj));
  });
}
